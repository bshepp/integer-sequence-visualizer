// tests/viz3d/frame.test.ts
import { describe, it, expect } from 'vitest';
import { framingFor, frustumFor } from '../../src/viz3d/frame';
import type { Geometry3D } from '../../src/viz3d/types';

const realBounds: Geometry3D['bounds'] = { min: [0, 0, 0], max: [10, 4, 0] };

describe('framingFor', () => {
  it('reproduces the real-only centre and half-extent when there is no null object', () => {
    const framing = framingFor(realBounds, null, 0);
    expect(framing.centre).toEqual([5, 2, 0]);
    expect(framing.halfExtent).toBe(5);
  });

  it('widens the half-extent and moves the centre towards the midpoint of the pair when a null object is present', () => {
    const nullBounds: Geometry3D['bounds'] = { min: [0, 0, 0], max: [10, 4, 0] };
    const nullOffsetX = 12; // matches scene.ts's own (width * 1.2) placement
    const soloFraming = framingFor(realBounds, null, 0);
    const pairFraming = framingFor(realBounds, nullBounds, nullOffsetX);

    // Union spans x in [0, 22], y in [0, 4]: wider than the real object alone.
    expect(pairFraming.halfExtent).toBeGreaterThan(soloFraming.halfExtent);
    expect(pairFraming.halfExtent).toBeCloseTo(11);

    // The centre moves off the real object's own centre (x=5) towards the
    // midpoint of the two objects' centres (real at x=5, null at x=17 -> 11).
    expect(pairFraming.centre[0]).toBeGreaterThan(soloFraming.centre[0]);
    expect(pairFraming.centre[0]).toBeCloseTo(11);
  });

  it('still fits a null object that is taller than the real object', () => {
    const tallNullBounds: Geometry3D['bounds'] = { min: [0, -20, 0], max: [10, 20, 0] };
    const nullOffsetX = 12;
    const framing = framingFor(realBounds, tallNullBounds, nullOffsetX);

    // Union y-span is 40 (from the tall null), dwarfing the 22-wide x-span -
    // the half-extent must take the max over all three axes, not just x.
    expect(framing.halfExtent).toBeCloseTo(20);
  });
});

describe('frustumFor', () => {
  it('widens horizontally on a wide window, holding the vertical half-extent fixed', () => {
    const f = frustumFor(10, 2); // wide: 2:1
    expect(f.right).toBeCloseTo(10 * 2 * 1.1);
    expect(f.top).toBeCloseTo(10 * 1.1);
  });

  it('widens VERTICALLY on a narrow window, instead of clipping the sides', () => {
    // Below the ~0.91 aspect this branch calls out - a portrait window. The
    // old form (halfExtent * aspect, horizontal only) would shrink `right`
    // to below halfExtent here, clipping the real/null pair's sides.
    const f = frustumFor(10, 0.5); // narrow: 1:2
    expect(f.right).toBeCloseTo(10 * 1.1); // horizontal stays at plain half-extent
    expect(f.top).toBeCloseTo(10 * (1 / 0.5) * 1.1); // vertical widens instead
    expect(f.right).toBeGreaterThanOrEqual(10); // never clips inside the half-extent
    expect(f.top).toBeGreaterThanOrEqual(10);
  });

  it('is symmetric and holds both axes at the half-extent on a square window', () => {
    const f = frustumFor(10, 1);
    expect(f.right).toBeCloseTo(10 * 1.1);
    expect(f.top).toBeCloseTo(10 * 1.1);
    expect(f.left).toBe(-f.right);
    expect(f.bottom).toBe(-f.top);
  });
});
