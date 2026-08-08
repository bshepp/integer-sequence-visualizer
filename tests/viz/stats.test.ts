import { describe, it, expect } from 'vitest';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { computeHistogram, histogramViz, shouldUseLogScale } from '../../src/viz/histogram';
import { autocorrelation, autocorrViz } from '../../src/viz/autocorrelation';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';
import { makeSurrogate } from '../../src/nullmodel/surrogates';
import { fibonacciTerms } from '../helpers/fixtures';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('computeHistogram', () => {
  it('bins uniformly and puts max in the last bin', () => {
    const { edges, counts } = computeHistogram([1, 2, 2, 3], 3);
    expect(edges.length).toBe(4);
    expect(edges[0]).toBeCloseTo(1);
    expect(edges[3]).toBeCloseTo(3);
    expect(counts).toEqual([1, 2, 1]);
  });
  it('handles constant input in one bin', () => {
    const { counts } = computeHistogram([5, 5, 5], 4);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('histogramViz.statistics targets', () => {
  it('digits pools every base-10 digit', () => {
    const stats = histogramViz.statistics!(mk([12n, 345n]), { target: 'digits', bins: 10 });
    // digits: 1,2,3,4,5 → counts sum to 5
    expect(stats.count!.reduce((a, b) => a + b, 0)).toBe(5);
  });
  it('leading takes the first digit of each term', () => {
    const stats = histogramViz.statistics!(mk([123n, 91n, 8n]), { target: 'leading', bins: 9 });
    expect(stats.count!.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('shouldUseLogScale', () => {
  it('is false for small terms well within float64 safe range', () => {
    expect(shouldUseLogScale(mk([1n, 2n, 3n]))).toBe(false);
  });
  it('is false for a sequence with exactly one huge term', () => {
    expect(shouldUseLogScale(mk([10n ** 30n, 1n, 2n]))).toBe(false);
  });
  it('is true for a sequence with two distinct huge terms', () => {
    expect(shouldUseLogScale(mk([10n ** 30n, 10n ** 31n, 1n]))).toBe(true);
  });
});

describe('histogramViz adaptive terms target', () => {
  it('does not collapse huge distinct terms into a single bin (regression)', () => {
    // All terms exceed Number.MAX_SAFE_INTEGER, so a naive toNumber() histogram
    // clamps every one of them to the same value and pins them in one bin.
    const seq = mk([10n ** 30n, 10n ** 31n, 10n ** 32n, 10n ** 33n]);
    const stats = histogramViz.statistics!(seq, { target: 'terms', bins: 10 });
    const nonZeroBins = stats.count!.filter((c) => c > 0).length;
    expect(nonZeroBins).toBeGreaterThanOrEqual(2);
  });

  it('explicit logmagnitude target returns counts summing to sequence length', () => {
    const seq = mk([10n ** 30n, 10n ** 31n, 1n, 2n]);
    const stats = histogramViz.statistics!(seq, { target: 'logmagnitude', bins: 5 });
    expect(stats.count!.reduce((a, b) => a + b, 0)).toBe(seq.length);
  });
});

describe('computeHistogram: no stack overflow on a large input (task FR, C3)', () => {
  it('bins 300,000 values without throwing (V8 spreads over ~250k args into RangeError)', () => {
    const values = Array.from({ length: 300_000 }, (_, i) => i - 150_000);
    expect(() => computeHistogram(values, 20)).not.toThrow();
    const { counts } = computeHistogram(values, 20);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(300_000);
  });

  it('an explicit domain still clamps out-of-range values into the first/last bin, not dropped', () => {
    const { counts } = computeHistogram([-5, 0, 1, 2, 3, 100], 3, { lo: 0, hi: 3 });
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6); // nothing silently dropped
    expect(counts[0]).toBeGreaterThanOrEqual(2); // -5 clamped into the first bin alongside 0
    expect(counts[2]).toBeGreaterThanOrEqual(2); // 100 clamped into the last bin alongside 3
  });

  it('an explicit domain pins the bin edges verbatim instead of re-deriving them from the values', () => {
    const { edges } = computeHistogram([1, 2, 3], 2, { lo: 0, hi: 10 });
    expect(edges).toEqual([0, 5, 10]);
  });
});

describe('histogramViz target "gaps" on an overflowing sequence (task FR, C2)', () => {
  it('Fibonacci(300) gaps no longer pile up in the last bin (regression: BV-2 fixed "terms" but not "gaps")', () => {
    const fib300 = fibonacciTerms(300);
    const seq = mk(fib300);
    const stats = histogramViz.statistics!(seq, { target: 'gaps', bins: 20 });
    const counts = stats.count!;
    expect(counts.reduce((a, b) => a + b, 0)).toBe(299);
    // Measured before the fix: 220 of 299 gaps piled into the last bin
    // (clampBig saturating every overflowing gap to the same
    // MAX_SAFE_INTEGER). A handful of bins should now carry the mass.
    expect(Math.max(...counts)).toBeLessThan(220);
    expect(counts.filter((c) => c > 0).length).toBeGreaterThan(2);
  });

  it('a non-monotone sequence keeps negative gaps distinguishable from positive ones of the same magnitude (sign-preserving)', () => {
    // Two overflowing terms (needed for shouldUseLogScale to fire - it
    // requires 2+, not just 1, overflowing terms): gap 0 = +1e30 (positive),
    // gap 1 = -1e30 (negative, same magnitude). An unsigned log transform
    // would put both in the same bin; a 2-bin split at 0 should instead put
    // one in each.
    const seq = mk([10n ** 30n, 2n * 10n ** 30n, 10n ** 30n]);
    expect(shouldUseLogScale(seq)).toBe(true); // sanity: confirms this test exercises the log path
    const stats = histogramViz.statistics!(seq, { target: 'gaps', bins: 2 });
    expect(stats.count![0]).toBe(1); // the negative gap
    expect(stats.count![1]).toBe(1); // the positive gap
  });
});

describe('histogramViz honors an explicit logScaleOverride (cross-surrogate scale sync)', () => {
  // A sequence whose own auto-detected scale is log (two terms ~2e16, well
  // past the safe-integer threshold), mixed with several ~1e13 terms that
  // are safe but still a tiny fraction of the outliers' magnitude.
  const REAL = [
    0n, 10_000_000_000_000n, 20_000_000_000_000n, 30_000_000_000_000n, 40_000_000_000_000n,
    20_000_000_000_000_000n, 20_000_000_000_050_000n,
  ];
  // A 'difference' surrogate (same gap multiset, reshuffled) that happens to
  // place both overflowing gaps so that only the very last term ends up
  // beyond the safe range. Confirmed deterministic for this exact input:
  // shouldUseLogScale is FALSE for this draw even though REAL's is TRUE -
  // exactly the cross-draw disagreement the ensemble sync fix targets.
  const SURROGATE = makeSurrogate(REAL, 'difference', 2);

  it('real and this surrogate draw disagree on their own auto-detected scale', () => {
    expect(shouldUseLogScale(mk(REAL))).toBe(true);
    expect(shouldUseLogScale(mk(SURROGATE))).toBe(false);
  });

  it('without an override, the disagreeing surrogate auto-detects linear scale, collapsing 6 of 7 values into one bin', () => {
    const stats = histogramViz.statistics!(mk(SURROGATE), { target: 'terms', bins: 10 });
    expect(Math.max(...stats.count!)).toBeGreaterThanOrEqual(6);
  });

  it('logScaleOverride:true forces log scale on that same surrogate, spreading the values across more bins', () => {
    const stats = histogramViz.statistics!(mk(SURROGATE), { target: 'terms', bins: 10, logScaleOverride: true });
    expect(Math.max(...stats.count!)).toBeLessThanOrEqual(4);
  });

  it('logScaleOverride:false forces linear scale even on a sequence that would auto-detect log', () => {
    const stats = histogramViz.statistics!(mk(REAL), { target: 'terms', bins: 10, logScaleOverride: false });
    expect(Math.max(...stats.count!)).toBeGreaterThanOrEqual(5);
  });
});

describe('autocorrelation', () => {
  it('r[0] is 1; alternating series has r[1] = -(n-1)/n', () => {
    const alt = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 1 : -1));
    const r = autocorrelation(alt, 2);
    expect(r[0]).toBeCloseTo(1, 10);
    expect(r[1]).toBeCloseTo(-0.9, 10);
  });
  it('returns zeros for constant series', () => {
    expect(autocorrelation([4, 4, 4, 4], 2)).toEqual([0, 0, 0]);
  });
});

describe('render smoke tests', () => {
  const edgeSeqs = [
    mk([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]),
    mk([-5n, 0n, 5n, -5n, 0n, 5n, -5n, 0n]),
    mk([10n ** 40n, 1n, 10n ** 40n, 1n, 2n, 3n, 4n, 5n]),
  ];
  for (const viz of [histogramViz, autocorrViz]) {
    it(`${viz.id} renders edge cases without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, { width: 400, height: 300 })).not.toThrow();
      }
    });
  }
});
