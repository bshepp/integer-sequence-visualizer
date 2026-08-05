import { describe, it, expect } from 'vitest';
import { polyarcPath, polyarcViz } from '../../src/viz/polyarc';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('polyarcPath', () => {
  it('zero residues, uncentered → straight unit steps along +x', () => {
    const path = polyarcPath(mk([0n, 7n, 14n]), { angle: 30, modulus: 7, centered: false });
    expect(path.length).toBe(3 * 8 + 1);
    expect(path[path.length - 1]!.x).toBeCloseTo(3, 8);
    expect(path[path.length - 1]!.y).toBeCloseTo(0, 8);
  });

  it('is deterministic and respects the segments option', () => {
    const a = polyarcPath(mk([1n, 2n, 3n]), { angle: 30, modulus: 7, centered: true, segments: 4 });
    const b = polyarcPath(mk([1n, 2n, 3n]), { angle: 30, modulus: 7, centered: true, segments: 4 });
    expect(a).toEqual(b);
    expect(a.length).toBe(3 * 4 + 1);
  });

  it('centered flips curvature sign around the middle residue', () => {
    // modulus 3, centered: residue 0 → −angle, residue 2 → +angle. Mirror-symmetric y.
    const lo = polyarcPath(mk([0n]), { angle: 45, modulus: 3, centered: true });
    const hi = polyarcPath(mk([2n]), { angle: 45, modulus: 3, centered: true });
    expect(lo[lo.length - 1]!.y).toBeCloseTo(-hi[hi.length - 1]!.y, 8);
    expect(lo[lo.length - 1]!.x).toBeCloseTo(hi[hi.length - 1]!.x, 8);
  });
});

describe('polyarc render smoke test', () => {
  it('renders edge cases without throwing', () => {
    for (const seq of [mk([1n, 2n, 3n, 4n]), mk([-5n, 0n, 10n ** 40n, 3n])]) {
      const { ctx } = fakeCtx();
      expect(() => polyarcViz.render(seq, defaultParams(polyarcViz.params), ctx, { width: 400, height: 400 })).not.toThrow();
    }
  });
});
