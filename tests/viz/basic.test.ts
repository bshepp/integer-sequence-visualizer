import { describe, it, expect } from 'vitest';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { scatterViz } from '../../src/viz/scatter';
import { differencesViz } from '../../src/viz/differences';
import { registerAll } from '../../src/viz/all';
import { allVisualizers } from '../../src/viz/registry';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

const SIZE = { width: 400, height: 300 };

describe('scatterViz.statistics', () => {
  it('linear scale returns clamped numbers', () => {
    const stats = scatterViz.statistics!(mk([0n, 1n, 10n ** 30n]), { scale: 'linear' });
    expect(stats.value).toEqual([0, 1, Number.MAX_SAFE_INTEGER]);
  });
  it('log scale returns log magnitudes', () => {
    const stats = scatterViz.statistics!(mk([1n, 1000n]), { scale: 'log' });
    expect(stats.value![0]).toBeCloseTo(0, 5);
    expect(stats.value![1]).toBeCloseTo(3, 5);
  });
});

describe('differencesViz.statistics', () => {
  it('differences mode', () => {
    const stats = differencesViz.statistics!(mk([0n, 1n, 1n, 2n, 3n, 5n]), { mode: 'differences' });
    expect(stats.value).toEqual([1, 0, 1, 1, 2]);
  });
  it('ratios mode guards division by zero', () => {
    const stats = differencesViz.statistics!(mk([0n, 2n, 4n]), { mode: 'ratios' });
    expect(stats.value).toEqual([0, 2]);
  });
});

describe('render smoke tests', () => {
  const cases: Array<[string, typeof scatterViz]> = [
    ['scatter', scatterViz],
    ['differences', differencesViz],
  ];
  const edgeSeqs = [
    mk([1n, 2n]),                    // minimum-ish length
    mk([-5n, 0n, 5n]),               // negatives and zero
    mk([10n ** 40n, -(10n ** 40n), 1n]), // beyond float64
  ];
  for (const [name, viz] of cases) {
    it(`${name} renders every edge case without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, SIZE)).not.toThrow();
      }
    });
  }
});

describe('registerAll', () => {
  it('registers shipped visualizers once, idempotently', () => {
    registerAll();
    registerAll();
    const ids = allVisualizers().map((v) => v.id);
    expect(ids).toContain('scatter');
    expect(ids).toContain('differences');
  });
});
