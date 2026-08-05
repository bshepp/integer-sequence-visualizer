import { describe, it, expect } from 'vitest';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { computeHistogram, histogramViz, shouldUseLogScale } from '../../src/viz/histogram';
import { autocorrelation, autocorrViz } from '../../src/viz/autocorrelation';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

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
