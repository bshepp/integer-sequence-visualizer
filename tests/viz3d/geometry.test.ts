import { describe, it, expect } from 'vitest';
import { geometryFor, SUPPORTED_3D } from '../../src/viz3d/geometry';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { turtlePath } from '../../src/viz/turtle';
import { polyarcPath, segmentsFor, handOf } from '../../src/viz/polyarc';
import { digitWalkPath } from '../../src/viz/digitWalk';

const seq = new SequenceView({
  terms: [3n, 17n, 250n, 91n, 7n, 12n, 44n, 5n],
  name: 't', offset: 0, source: 'paste',
} as Sequence);
const flat = { step: 0 };

describe('geometryFor', () => {
  it('reproduces the turtle path exactly', () => {
    const g = geometryFor('turtle', seq, { angle: 90, k: 4 }, flat)!;
    const path = turtlePath(seq, 90, 4);
    expect(g.positions).toHaveLength(path.length * 3);
    path.forEach((p, i) => expect(g.positions[i * 3]).toBe(Math.fround(p.x)));
  });

  it('reproduces the polyarc path at its own sampling and handedness', () => {
    const params = { angle: 1, modulus: 360, offset: -180, turn: 'ncurve' };
    const opts = { angle: 1, modulus: 360, offset: -180, hand: handOf(params) };
    const path = polyarcPath(seq, { ...opts, segments: segmentsFor(seq, opts) });
    const g = geometryFor('polyarc', seq, params, flat)!;
    expect(g.positions).toHaveLength(path.length * 3);
    path.forEach((p, i) => expect(g.positions[i * 3 + 1]).toBe(Math.fround(p.y)));
  });

  it('reproduces the digit walk and attributes every vertex to its term', () => {
    const g = geometryFor('digitwalk', seq, { base: 10 }, flat)!;
    const path = digitWalkPath(seq, 10);
    expect(g.positions).toHaveLength(path.length * 3);
    // One vertex per digit after the origin, so the last vertex belongs to the
    // last term, and term indices never decrease along the walk.
    expect(g.termOf[g.termOf.length - 1]).toBe(seq.length - 1);
    for (let i = 1; i < g.termOf.length; i++) {
      expect(g.termOf[i]).toBeGreaterThanOrEqual(g.termOf[i - 1]!);
    }
  });

  it('returns null for views with no 3D meaning', () => {
    for (const id of ['scatter', 'histogram', 'autocorr', 'differences', 'ulam', 'modgrid']) {
      expect(geometryFor(id, seq, {}, flat), id).toBeNull();
    }
  });

  it('lists exactly the supported ids', () => {
    expect([...SUPPORTED_3D].sort()).toEqual(['digitwalk', 'polyarc', 'turtle']);
  });
});
