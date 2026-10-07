import { describe, it, expect } from 'vitest';
import { foldCount, polygonalK, displacementPerPeriod, polygonal } from '../../src/experiments/foldCount';
import { SequenceView } from '../../src/sequence/sequence';
import { sequenceFromFormula } from '../../src/sequence/formula';
import { polyarcPath } from '../../src/viz/polyarc';

function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a; }

describe('fold counts of polygonal-number curves (A400844)', () => {
  it('generates the polygonal numbers', () => {
    expect([0, 1, 2, 3, 4].map((n) => polygonal(3, n))).toEqual([0, 1, 3, 6, 10]);
    expect([0, 1, 2, 3, 4].map((n) => polygonal(5, n))).toEqual([0, 1, 5, 12, 22]);
  });

  it('gives the table posted to SeqFan at NCurve\'s modulus', () => {
    const folds = Array.from({ length: 12 }, (_, i) => foldCount(i + 3, 360).folds);
    // 1 here is what the mail called "drifts": no net turn per repeat.
    expect(folds).toEqual([3, 12, 1, 6, 3, 4, 3, 6, 1, 12, 3, 2]);
  });

  it('measures the periods and turns quoted for the squares and triangular numbers', () => {
    expect(foldCount(4, 360)).toEqual({ period: 180, turn: 30, folds: 12 });
    expect(foldCount(3, 360)).toEqual({ period: 720, turn: 240, folds: 3 });
    expect(foldCount(5, 360)).toEqual({ period: 720, turn: 0, folds: 1 });
  });

  it('equals gcd(m, K(s)) for every modulus tried, with K of period 12', () => {
    for (let s = 2; s <= 30; s++) {
      expect(polygonalK(s + 12)).toBe(polygonalK(s));
      for (let m = 1; m <= 120; m++) {
        expect(foldCount(s, m).folds, `s=${s} m=${m}`).toBe(gcd(m, polygonalK(s)));
      }
    }
  });

  it('closes the real curve after folds x period terms, and not one term sooner', () => {
    const opts = { angle: 1, modulus: 360, offset: -180, segments: 1, hand: -1 };
    const end = (src: string, terms: number): number => {
      const pts = polyarcPath(new SequenceView(sequenceFromFormula(src, terms)), opts);
      const last = pts[pts.length - 1]!;
      return Math.hypot(last.x, last.y);
    };
    expect(end('n^2', 12 * 180)).toBeLessThan(1e-8);
    expect(end('n^2', 12 * 180 - 1)).toBeGreaterThan(0.1);
    expect(end('n*(n+1)/2', 3 * 720)).toBeLessThan(1e-8);
  });

  it('does not confuse "no net turn" with "never closes"', () => {
    // Pentagonal numbers have no net turn at any modulus. Under straight
    // steps they nonetheless close in one period at m = 4; under arcs, the
    // rule this project draws with, they do not.
    expect(foldCount(5, 4).folds).toBe(1);
    expect(displacementPerPeriod(5, 4, 'step')).toBeLessThan(1e-9);
    expect(displacementPerPeriod(5, 4, 'arc')).toBeGreaterThan(0.1);
  });
});
