import { describe, it, expect } from 'vitest';
import { polyarcPath, segmentsFor, segmentTurns } from '../../src/viz/polyarc';
import { chordArc, pathTransform, toScreen, VISIBLE_PX } from '../../src/viz/pathTransform';
import { makeSurrogate, type SurrogateType } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

/**
 * Whether the renderer's optimisations can put structure into a comparison.
 *
 * They would be free to, if nobody checked. The two panels are fitted to their
 * own bounding boxes, so they are drawn at different scales, so the sub-pixel
 * arc cull fires at different rates on each: at the hero's own settings, 46.6%
 * of the real panel's segments are culled to straight chords against 67.2% of
 * the permutation null's. If that cull were sloppy, the null would be
 * systematically straighter than the real sequence for a reason that has
 * nothing to do with the numbers - and this site's entire claim is that the
 * difference between the panels comes from the numbers.
 *
 * It is not sloppy, and this is what says so.
 */
const HERO = { angle: 64, modulus: 187, offset: -90 };
const SIZE = { width: 670, height: 650 };

const primes = (n: number): bigint[] => {
  const out: bigint[] = [];
  for (let k = 2; out.length < n; k++) {
    let p = true;
    for (let d = 2; d * d <= k; d++) if (k % d === 0) { p = false; break; }
    if (p) out.push(BigInt(k));
  }
  return out;
};
const view = (terms: bigint[]) =>
  new SequenceView({ terms, name: 'x', offset: 0, source: 'paste' } as Sequence);

/** Worst distance, in screen pixels, between a drawn chord and the arc it replaced. */
function worstCulledError(terms: bigint[]): { worst: number; culled: number; total: number } {
  const v = view(terms);
  const segments = segmentsFor(v, HERO);
  const opts = { ...HERO, segments };
  const pts = polyarcPath(v, opts);
  const t = pathTransform(pts, SIZE);
  const turnAt = segmentTurns(v, opts);
  let worst = 0, culled = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = toScreen(t, pts[i - 1]!), b = toScreen(t, pts[i]!);
    if (chordArc(a, b, turnAt(i), 1)) continue;
    culled++;
    const phi = -turnAt(i);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!Number.isFinite(phi) || Math.abs(phi) < 1e-9 || Math.abs(phi) >= 2 * Math.PI) continue;
    if (len < 1e-9) continue;
    // Sagitta: how far the true arc bulges away from the chord drawn instead.
    const r = Math.abs(len / (2 * Math.sin(phi / 2)));
    const sag = r * (1 - Math.cos(phi / 2));
    if (Number.isFinite(sag) && sag > worst) worst = sag;
  }
  return { worst, culled, total: pts.length - 1 };
}

describe('the sub-pixel cull cannot draw a difference the numbers did not put there', () => {
  const real = primes(58);
  const panels: Array<[string, bigint[]]> = [
    ['real', real],
    ...(['permutation', 'difference', 'matched'] as SurrogateType[])
      .map((k) => [`${k} null`, makeSurrogate(real, k, 1)] as [string, bigint[]]),
  ];

  for (const [name, terms] of panels) {
    it(`keeps every culled arc under ${VISIBLE_PX}px in the ${name} panel`, () => {
      const { worst, culled } = worstCulledError(terms);
      expect(culled, `${name} culled nothing, so this proves nothing`).toBeGreaterThan(0);
      expect(worst, `${name}: a culled arc was off by ${worst.toFixed(3)}px`)
        .toBeLessThan(VISIBLE_PX);
    });
  }

  it('the panels really are culled at different rates, which is why the bound matters', () => {
    // Guards the premise. If both panels ever culled identically this test file
    // would be pinning nothing, and should be reconsidered rather than kept.
    const a = worstCulledError(real);
    const b = worstCulledError(makeSurrogate(real, 'permutation', 1));
    const rate = (x: typeof a) => x.culled / x.total;
    expect(Math.abs(rate(a) - rate(b))).toBeGreaterThan(0.1);
  });

  it('sampling density differs between panels but cannot move the curve', () => {
    // segmentsFor reads the sharpest turn, and the difference and matched
    // surrogates hold different values from the real sequence, so the panels
    // are sampled at different densities: 96 against 99 and 94 here. That is
    // only safe because polyarcPath integrates each term as an arc, so samples
    // land on the true curve and density is a rendering choice rather than a
    // geometric one.
    const density = (t: bigint[]) => segmentsFor(view(t), HERO);
    const densities = panels.map(([, t]) => density(t));
    expect(new Set(densities).size, 'panels sampled identically - premise gone').toBeGreaterThan(1);

    const coarse = polyarcPath(view(real), { ...HERO, segments: 20 });
    const fine = polyarcPath(view(real), { ...HERO, segments: 100 });
    for (let i = 0; i < coarse.length; i++) {
      expect(coarse[i]!.x).toBeCloseTo(fine[i * 5]!.x, 9);
      expect(coarse[i]!.y).toBeCloseTo(fine[i * 5]!.y, 9);
    }
  });
});
