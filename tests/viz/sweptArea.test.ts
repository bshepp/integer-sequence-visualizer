import { describe, it, expect } from 'vitest';
import { sweptArea } from '../../src/viz/sweptArea';

const SQUARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
const SEGMENT = [{ x: 0, y: 0 }, { x: 10, y: 0 }];

describe('sweptArea', () => {
  it('a single straight segment is length x width', () => {
    expect(sweptArea(SEGMENT, 2, 'miter', 'butt')).toBeCloseTo(20, 6);
  });

  it('scales with stroke width', () => {
    expect(sweptArea(SQUARE, 2, 'miter', 'butt')).toBeGreaterThan(sweptArea(SQUARE, 1, 'miter', 'butt'));
  });

  it('round joins add less area than miter joins at a right angle', () => {
    // A miter spike reaches r*sec(θ/2) from the vertex; a round join fills
    // only the circular sector. At 90° the miter is strictly larger.
    expect(sweptArea(SQUARE, 4, 'miter', 'butt')).toBeGreaterThan(sweptArea(SQUARE, 4, 'round', 'butt'));
  });

  it('orders the joins bevel < round < miter at a right angle', () => {
    // Per-vertex contributions at exterior angle θ, radius r = w/2:
    //   bevel = (r²/2)·sin θ   -> 0.500 r²  (corner cut flat)
    //   round = (θ/2)·r²       -> 0.785 r²  (circular sector)
    //   miter = r²·tan(θ/2)    -> 1.000 r²  (spike out to the miter point)
    const w = 4;
    const bevel = sweptArea(SQUARE, w, 'bevel', 'butt');
    const round = sweptArea(SQUARE, w, 'round', 'butt');
    const miter = sweptArea(SQUARE, w, 'miter', 'butt');
    expect(bevel).toBeLessThan(round);
    expect(round).toBeLessThan(miter);
  });

  it('matches the closed form for each join on a single right angle', () => {
    const corner = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const w = 4, r = w / 2;
    const bodies = 20 * w; // two 10-long segments
    expect(sweptArea(corner, w, 'bevel', 'butt') - bodies).toBeCloseTo((r * r / 2) * Math.sin(Math.PI / 2), 9);
    expect(sweptArea(corner, w, 'round', 'butt') - bodies).toBeCloseTo((Math.PI / 4) * r * r, 9);
    expect(sweptArea(corner, w, 'miter', 'butt') - bodies).toBeCloseTo(r * r, 9);
  });

  it('square caps add w^2 over butt caps (w^2/2 at each of the two ends)', () => {
    const w = 3;
    expect(sweptArea(SEGMENT, w, 'miter', 'square') - sweptArea(SEGMENT, w, 'miter', 'butt'))
      .toBeCloseTo(w * w, 6);
  });

  it('round caps add one whole disc over butt caps (two half-discs)', () => {
    const w = 3;
    expect(sweptArea(SEGMENT, w, 'miter', 'round') - sweptArea(SEGMENT, w, 'miter', 'butt'))
      .toBeCloseTo(Math.PI * (w / 2) ** 2, 6);
  });

  it('a straight path has no join contribution regardless of join type', () => {
    const straight = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
    const miter = sweptArea(straight, 4, 'miter', 'butt');
    expect(sweptArea(straight, 4, 'round', 'butt')).toBeCloseTo(miter, 9);
    expect(sweptArea(straight, 4, 'bevel', 'butt')).toBeCloseTo(miter, 9);
  });

  it('falls back to bevel past the miter limit instead of returning a spike to infinity', () => {
    // A near-doubling-back turn drives sec(θ/2) past the canvas miter limit.
    const spike = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0.0001 }];
    const area = sweptArea(spike, 4, 'miter', 'butt');
    expect(Number.isFinite(area)).toBe(true);
    expect(area).toBeCloseTo(sweptArea(spike, 4, 'bevel', 'butt'), 6);
  });

  it('is zero for a degenerate path', () => {
    expect(sweptArea([], 2, 'miter', 'butt')).toBe(0);
    expect(sweptArea([{ x: 1, y: 1 }], 2, 'miter', 'butt')).toBe(0);
  });

  it('ignores zero-length segments rather than producing NaN', () => {
    const withDup = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(Number.isFinite(sweptArea(withDup, 2, 'miter', 'butt'))).toBe(true);
  });
});
