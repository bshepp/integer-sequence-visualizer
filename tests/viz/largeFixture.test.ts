import { describe, it, expect } from 'vitest';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, getVisualizer } from '../../src/viz/registry';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';
import { FIB_2000, fib2000View, independentLogMagnitude } from '../helpers/fixtures';
import { autocorrelation } from '../../src/viz/autocorrelation';
import { differencesViz } from '../../src/viz/differences';

registerAll();

const SIZE = { width: 600, height: 450 };
// Small slack beyond the raw canvas dimensions: legitimate non-coordinate
// numeric args (radii, angles in radians, line widths, small offsets) are
// tiny compared to a 600x450 canvas, so a generous-but-real bound still
// catches what actually broke here - a spread-crash producing NaN/Infinity,
// or a clamp-to-MAX_SAFE_INTEGER (9007199254740991) leaking into a drawn
// coordinate - without being a pixel-exact layout assertion this test isn't
// meant to be.
const SLACK = 50;
// fakeCtx's call log doesn't tag which position an argument occupies (x, y,
// width, height, radius, angle, …), so the bound must be the larger of the
// two canvas dimensions applied uniformly - not each argument checked
// against both axes independently (an x-coordinate near size.width would
// wrongly fail a "< size.height" check on a non-square canvas).
const MAX_DIM = Math.max(SIZE.width, SIZE.height) + SLACK;

describe('every visualizer survives a 2000-term Fibonacci sequence (task FR test gap)', () => {
  // Every render test before this one used <= 8 terms - nothing was large
  // enough to clamp past float64-safe range (C2) or to exceed V8's ~250k
  // spread-argument limit (C3: digitWalk alone produces hundreds of
  // thousands of points from this fixture, since late Fibonacci terms have
  // hundreds of digits each). Nothing asserted *what* was drawn either;
  // this does, via fakeCtx's call log.
  const view = fib2000View();

  it('covers all nine shipped visualizers (regression: this list must not silently shrink)', () => {
    expect(allVisualizers().map((v) => v.id).sort()).toEqual(
      ['autocorr', 'differences', 'digitwalk', 'histogram', 'modgrid', 'polyarc', 'scatter', 'turtle', 'ulam'].sort(),
    );
  });

  for (const viz of allVisualizers()) {
    it(`${viz.id} renders without throwing and every numeric draw argument is finite and on-canvas`, () => {
      const { ctx, callLog } = fakeCtx();
      expect(() => viz.render(view, defaultParams(viz.params), ctx, SIZE)).not.toThrow();
      expect(callLog.length).toBeGreaterThan(0);
      // A digit-walk-style path from this fixture is hundreds of thousands
      // of points (that scale is the whole point - see C3 above), so the
      // bounds check itself must stay a plain boolean scan: calling
      // vitest's expect() (which eagerly builds its failure message) once
      // per numeric arg here was itself slow enough to time the test out.
      let badCount = 0;
      let firstBad = '';
      for (const call of callLog) {
        for (const arg of call.args) {
          if (typeof arg !== 'number') continue;
          const ok = Number.isFinite(arg) && arg > -SLACK && arg < MAX_DIM;
          if (!ok) {
            badCount++;
            if (!firstBad) firstBad = `${call.name}(${call.args.join(',')})`;
          }
        }
      }
      expect(badCount, `${badCount} out-of-bounds/non-finite numeric draw args, e.g. ${firstBad}`).toBe(0);
    });
  }
});

describe('stats-level correctness on the 2000-term Fibonacci fixture, checked independently (task FR test gap)', () => {
  const view = fib2000View();

  it('autocorrelation switches to the sign-preserving log-magnitude series once terms overflow, matching an independent computation', () => {
    const maxLag = 10;
    // Fibonacci is non-negative throughout, so the sign fold is a no-op -
    // still routed through the same independentLogMagnitude used elsewhere
    // in this file, not through the module under test.
    const independentLogSeries = FIB_2000.map((t) => independentLogMagnitude(t));
    const expectedR = autocorrelation(independentLogSeries, maxLag);

    const stats = getVisualizer('autocorr').statistics!(view, { maxLag });
    const [key, r] = Object.entries(stats)[0]!;
    expect(key).toMatch(/log-magnitude/i); // panel is labeled, not silently swapped
    for (let k = 0; k <= maxLag; k++) expect(r[k]!).toBeCloseTo(expectedR[k]!, 9);
  });

  it('differences (mode: differences) matches an independently BigInt-diffed, log-transformed series', () => {
    const expected: number[] = [];
    for (let i = 0; i + 1 < FIB_2000.length; i++) {
      const d = FIB_2000[i + 1]! - FIB_2000[i]!;
      expected.push(independentLogMagnitude(d) * (d < 0n ? -1 : 1));
    }
    const stats = differencesViz.statistics!(view, { mode: 'differences' });
    expect(stats.value!.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) expect(stats.value![i]!).toBeCloseTo(expected[i]!, 9);
    // Signature of the bug this replaces: mass collapse onto one clamped
    // value (measured: a single distinct value across 1900 of 1999 entries).
    expect(new Set(stats.value!.map((v) => v.toFixed(6))).size).toBeGreaterThan(100);
  });

  it('differences (mode: ratios) matches term(i+1)/term(i) computed independently via exact log-magnitude subtraction; index 500 is within 1e-9 of phi', () => {
    const phi = (1 + Math.sqrt(5)) / 2;
    const expected: number[] = [];
    for (let i = 0; i + 1 < FIB_2000.length; i++) {
      const denom = FIB_2000[i]!, numer = FIB_2000[i + 1]!;
      expected.push(denom === 0n || numer === 0n ? 0 : 10 ** (independentLogMagnitude(numer) - independentLogMagnitude(denom)));
    }
    const stats = differencesViz.statistics!(view, { mode: 'ratios' });
    expect(stats.value!.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) expect(stats.value![i]!).toBeCloseTo(expected[i]!, 9);
    expect(Math.abs(stats.value![500]! - phi)).toBeLessThan(1e-9);
    // Signature of the bug this replaces: ratios track phi through index 77,
    // then saturate to exactly 1 forever once both terms clamp to the same
    // MAX_SAFE_INTEGER. Fibonacci's ratio converges to phi so fast that,
    // correctly computed, everything from a couple hundred terms in on is
    // indistinguishable from phi at float64 precision - the opposite of "1".
    for (let i = 200; i < stats.value!.length; i++) expect(stats.value![i]!).toBeCloseTo(phi, 6);
  });
});
