import { describe, it, expect } from 'vitest';
import { registerAll } from '../../src/viz/all';
import { SequenceView } from '../../src/sequence/sequence';
import { sequenceFromFormula } from '../../src/sequence/formula';
import { polyarcPath, segmentsFor } from '../../src/viz/polyarc';
import { nextDigit, polyarc3dGeometry } from '../../src/viz3d/polyarc3d';
import { geometryFor } from '../../src/viz3d/geometry';

registerAll();

const NCURVE = { angle: 1, modulus: 360, offset: -180, hand: -1 };
const view = (src: string, terms: number): SequenceView => new SequenceView(sequenceFromFormula(src, terms));

describe('nextDigit: the base-b digit the flat rule throws away', () => {
  it('is zero while the term is below the modulus', () => {
    expect(nextDigit(0n, 360)).toBe(0);
    expect(nextDigit(359n, 360)).toBe(0);
  });

  it('is the second base-b digit, signed so that it is centred on zero', () => {
    expect(nextDigit(361n, 360)).toBe(1);
    expect(nextDigit(360n * 179n + 7n, 360)).toBe(179);
    expect(nextDigit(360n * 180n + 7n, 360)).toBe(-180);
    expect(nextDigit(360n * 359n + 7n, 360)).toBe(-1);
    expect(nextDigit(360n * 360n + 7n, 360)).toBe(0);
  });

  it('floors for negative terms, as the residue does', () => {
    // -1 = 360 * (-1) + 359: residue 359, next digit -1.
    expect(nextDigit(-1n, 360)).toBe(-1);
  });
});

describe('polyarc3dGeometry', () => {
  it('is exactly the flat drawing while every term is below the modulus', () => {
    const seq = view('n', 300); // 0..299, all below 360
    const segments = segmentsFor(seq, NCURVE);
    const flat = polyarcPath(seq, { ...NCURVE, segments });
    const g = polyarc3dGeometry(seq, { ...NCURVE, segments });
    expect(g.positions.length).toBe(flat.length * 3);
    for (let i = 0; i < flat.length; i++) {
      expect(g.positions[i * 3]).toBeCloseTo(flat[i]!.x, 4);
      expect(g.positions[i * 3 + 1]).toBeCloseTo(flat[i]!.y, 4);
      expect(g.positions[i * 3 + 2]).toBe(0);
    }
  });

  it('keeps the squares in the plane for 19 terms and then leaves it', () => {
    // 18^2 = 324 < 360 <= 361 = 19^2
    const seq = view('n^2', 60);
    const g = polyarc3dGeometry(seq, { ...NCURVE, segments: 4 });
    for (let v = 0; v <= 19 * 4; v++) expect(g.positions[v * 3 + 2]).toBe(0);
    let maxZ = 0;
    for (let v = 0; v < g.positions.length / 3; v++) maxZ = Math.max(maxZ, Math.abs(g.positions[v * 3 + 2]!));
    expect(maxZ).toBeGreaterThan(0.5);
  });

  it('draws every term as an arc of length 1 at constant speed', () => {
    const segments = 64;
    const g = polyarc3dGeometry(view('n^2', 200), { ...NCURVE, segments });
    for (let term = 0; term < 200; term++) {
      let length = 0;
      for (let s = 1; s <= segments; s++) {
        const a = (term * segments + s - 1) * 3, b = a + 3;
        length += Math.hypot(
          g.positions[b]! - g.positions[a]!, g.positions[b + 1]! - g.positions[a + 1]!, g.positions[b + 2]! - g.positions[a + 2]!,
        );
      }
      // Chords under-measure the arc slightly; 64 samples of at most 255 degrees is within 0.1%.
      expect(length).toBeGreaterThan(0.998);
      expect(length).toBeLessThanOrEqual(1.0001);
    }
  });

  it('agrees with the independent Python prototype on where the walks end', () => {
    // base360.py, written first and separately: squares and triangular numbers, 2160 terms.
    const end = (src: string): number[] => {
      const g = polyarc3dGeometry(view(src, 2160), { ...NCURVE, segments: 1 });
      const n = g.positions.length;
      return [g.positions[n - 3]!, g.positions[n - 2]!, g.positions[n - 1]!];
    };
    const sq = end('n^2'), tr = end('n*(n+1)/2');
    // The prototype works in maths coordinates with NCurve's hand already applied to the yaw.
    [12.691912, -22.465702, -1.63466].forEach((v, i) => expect(sq[i]).toBeCloseTo(v, 2));
    [14.116156, -14.815128, -15.8527].forEach((v, i) => expect(tr[i]).toBeCloseTo(v, 2));
  });

  it('reports bounds that contain every vertex and a term for each one', () => {
    const g = polyarc3dGeometry(view('n^2', 500), { ...NCURVE, segments: 2 });
    expect(g.termOf.length).toBe(g.positions.length / 3);
    expect(g.termOf[0]).toBe(0);
    expect(g.termOf[g.termOf.length - 1]).toBe(499);
    for (let v = 0; v < g.termOf.length; v++) {
      for (let k = 0; k < 3; k++) {
        expect(g.positions[v * 3 + k]!).toBeGreaterThanOrEqual(g.bounds.min[k]! - 1e-6);
        expect(g.positions[v * 3 + k]!).toBeLessThanOrEqual(g.bounds.max[k]! + 1e-6);
      }
    }
    expect(g.bounds.max[2] - g.bounds.min[2]).toBeGreaterThan(1);
  });
});

describe('geometryFor with depth from the next digit', () => {
  const params = { angle: 1, modulus: 360, offset: -180, turn: 'ncurve' };

  it('builds the curve view with the same vertex count as the position lift', () => {
    const seq = view('n^2', 400);
    const byPosition = geometryFor('polyarc', seq, params, { step: 0.5 })!;
    const byDigit = geometryFor('polyarc', seq, params, { step: 0.5, depth: 'digit' })!;
    expect(byDigit.positions.length).toBe(byPosition.positions.length);
    expect(byDigit.bounds.max[2] - byDigit.bounds.min[2]).toBeGreaterThan(1);
  });

  it('leaves the position lift untouched when depth is not asked for', () => {
    const seq = view('n^2', 100);
    const a = geometryFor('polyarc', seq, params, { step: 0.5 })!;
    const b = geometryFor('polyarc', seq, params, { step: 0.5, depth: 'position' })!;
    expect(Array.from(b.positions)).toEqual(Array.from(a.positions));
  });

  it('has no digit walk for the other views, and says so by returning null', () => {
    const seq = view('n^2', 50);
    expect(geometryFor('turtle', seq, { angle: 90, k: 4 }, { step: 0.5, depth: 'digit' })).toBeNull();
    expect(geometryFor('digitwalk', seq, { base: 10 }, { step: 0.5, depth: 'digit' })).toBeNull();
  });
});
