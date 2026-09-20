import { describe, it, expect } from 'vitest';
import { liftPath } from '../../src/viz3d/lift';
import { turtlePath } from '../../src/viz/turtle';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const seq = new SequenceView({
  terms: [1n, 2n, 3n, 1n, 2n, 3n, 1n, 2n],
  name: 't', offset: 0, source: 'paste',
} as Sequence);

describe('liftPath', () => {
  it('copies x and y from the 2D path, value for value', () => {
    // The canonical zero: viewed down z, the object IS the flat drawing.
    const path = turtlePath(seq, 90, 4);
    const g = liftPath(path, (i) => Math.max(0, i - 1), { step: 0.5 });
    expect(g.positions).toHaveLength(path.length * 3);
    path.forEach((p, i) => {
      expect(g.positions[i * 3]).toBe(Math.fround(p.x));
      expect(g.positions[i * 3 + 1]).toBe(Math.fround(p.y));
    });
  });

  it('step 0 leaves every z at zero', () => {
    const path = turtlePath(seq, 90, 4);
    const g = liftPath(path, (i) => Math.max(0, i - 1), { step: 0 });
    for (let i = 0; i < path.length; i++) expect(g.positions[i * 3 + 2]).toBe(0);
  });

  it('z rises monotonically and totals step x diagonal', () => {
    const path = turtlePath(seq, 90, 4);
    const g = liftPath(path, (i) => Math.max(0, i - 1), { step: 2 });
    for (let i = 1; i < path.length; i++) {
      expect(g.positions[i * 3 + 2]).toBeGreaterThan(g.positions[(i - 1) * 3 + 2]!);
    }
    const xs = path.map((p) => p.x), ys = path.map((p) => p.y);
    const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(g.positions[(path.length - 1) * 3 + 2]).toBeCloseTo(2 * diagonal, 5);
  });

  it('normalises against the drawing, so two scales lift alike', () => {
    // A drawing ten times wider must be ten times taller at the same step,
    // which is what stops a 2,001-term digit walk becoming a tall thread.
    const small = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    const big = small.map((p) => ({ x: p.x * 10, y: p.y * 10 }));
    const zOf = (path: typeof small) =>
      liftPath(path, () => 0, { step: 1 }).positions[(path.length - 1) * 3 + 2]!;
    expect(zOf(big)).toBeCloseTo(zOf(small) * 10, 5);
  });

  it('records the term behind every vertex, and the bounds', () => {
    const path = turtlePath(seq, 90, 4);
    const g = liftPath(path, (i) => Math.max(0, i - 1), { step: 1 });
    expect(g.termOf).toHaveLength(path.length);
    expect(g.termOf[0]).toBe(0);
    expect(g.termOf[path.length - 1]).toBe(seq.length - 1);
    expect(g.mode).toBe('lines');
    expect(g.bounds.min[2]).toBe(0);
    expect(g.bounds.max[2]).toBeCloseTo(g.positions[(path.length - 1) * 3 + 2]!, 6);
  });

  it('survives an empty path', () => {
    const g = liftPath([], () => 0, { step: 1 });
    expect(g.positions).toHaveLength(0);
    expect(g.bounds.min).toEqual([0, 0, 0]);
  });
});
