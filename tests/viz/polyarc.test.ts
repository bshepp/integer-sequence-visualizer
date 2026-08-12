import { describe, it, expect } from 'vitest';
import { polyarcPath, polyarcViz, arcDegrees } from '../../src/viz/polyarc';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('polyarcPath', () => {
  it('zero arc angle gives straight unit steps along +x', () => {
    const path = polyarcPath(mk([0n, 7n, 14n]), { angle: 30, modulus: 7, offset: 0 });
    expect(path.length).toBe(3 * 8 + 1);
    expect(path[path.length - 1]!.x).toBeCloseTo(3, 8);
    expect(path[path.length - 1]!.y).toBeCloseTo(0, 8);
  });

  it('is deterministic and respects the segments option', () => {
    const opts = { angle: 30, modulus: 7, offset: -90, segments: 4 };
    expect(polyarcPath(mk([1n, 2n, 3n]), opts)).toEqual(polyarcPath(mk([1n, 2n, 3n]), opts));
    expect(polyarcPath(mk([1n, 2n, 3n]), opts).length).toBe(3 * 4 + 1);
  });

  it('an offset of -angle(b-1)/2 reproduces the old centred mode', () => {
    // The centred variant is not a separate mode any more, it is one point in
    // the offset range: 45 x (r - 1) is 45r - 45 for modulus 3.
    const centred = (r: bigint) => polyarcPath(mk([r]), { angle: 45, modulus: 3, offset: -45 });
    const lo = centred(0n), hi = centred(2n);
    expect(lo[lo.length - 1]!.y).toBeCloseTo(-hi[hi.length - 1]!.y, 8);
    expect(lo[lo.length - 1]!.x).toBeCloseTo(hi[hi.length - 1]!.x, 8);
  });

  it('reproduces the NCurve rule at angle 1', () => {
    // NCurve documents arc(n) degrees = a(n) mod b + c. At angle 1 this view
    // computes exactly that, which is the whole point of generalising it.
    for (const [r, b, c] of [[7n, 360, -180], [359n, 360, -180], [5n, 12, 0]] as const) {
      expect(arcDegrees(Number(r % BigInt(b)), 1, c)).toBe(Number(r % BigInt(b)) + c);
    }
    const path = polyarcPath(mk([90n]), { angle: 1, modulus: 360, offset: -180, segments: 1 });
    // One term, arc 90 - 180 = -90 degrees: the step ends pointing straight down.
    const last = path[path.length - 1]!;
    expect(Math.atan2(last.y, last.x) * 180 / Math.PI).toBeCloseTo(-90, 6);
  });

  it('defaults draw what the centred defaults used to draw', () => {
    // angle 30, mod 7, offset -90 is 30(r - 3), the previous default exactly.
    const now = polyarcPath(mk([1n, 5n, 2n, 6n]), { angle: 30, modulus: 7, offset: -90 });
    const then = polyarcPath(mk([1n, 5n, 2n, 6n]), { angle: 30, modulus: 7, offset: -30 * (7 - 1) / 2 });
    expect(now).toEqual(then);
    const spec = polyarcViz.params.map((p) => [p.id, (p as { default: unknown }).default]);
    expect(spec).toEqual([['angle', 30], ['modulus', 7], ['offset', -90]]);
  });

  it('reaches every whole degree once b is opened up', () => {
    // The old cap of 32 residues meant at most 32 distinct arc angles. NCurve
    // defaults to b = 360, and that unreachability was the actual gap.
    const mod = polyarcViz.params.find((p) => p.id === 'modulus')!;
    expect((mod as { max: number }).max).toBe(360);
    const angles = new Set<number>();
    for (let r = 0; r < 360; r++) angles.add(arcDegrees(r, 1, -180));
    expect(angles.size).toBe(360);
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

