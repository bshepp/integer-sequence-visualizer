import { describe, it, expect } from 'vitest';
import { spiralCoord } from '../../src/viz/gridUtils';
import { ulamViz } from '../../src/viz/ulamSpiral';
import { modGridViz } from '../../src/viz/modGrid';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('spiralCoord', () => {
  it('matches the canonical counterclockwise spiral', () => {
    const expected = [
      [0, 0], [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1], [2, -1],
    ];
    expected.forEach(([x, y], i) => {
      expect(spiralCoord(i)).toEqual({ x, y });
    });
  });
});

describe('grid render smoke tests', () => {
  const edgeSeqs = [
    mk([1n, 2n, 3n, 4n]),
    mk(Array.from({ length: 200 }, (_, i) => BigInt(i * i))),
    mk([-5n, 0n, 10n ** 40n, 3n]),
  ];
  for (const viz of [ulamViz, modGridViz]) {
    it(`${viz.id} renders edge cases without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, { width: 400, height: 400 })).not.toThrow();
      }
    });
  }
});
