import { describe, it, expect } from 'vitest';
import { pathTransform, toScreen, nearestIndex } from '../../src/viz/pathTransform';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';

const SIZE = { width: 400, height: 300 };

export const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('pathTransform', () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

  it('maps every point inside the canvas', () => {
    const t = pathTransform(pts, SIZE);
    for (const p of pts) {
      const s = toScreen(t, p);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(SIZE.width);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(SIZE.height);
    }
  });

  it('round-trips: the nearest point to a projected point is that point', () => {
    const t = pathTransform(pts, SIZE);
    pts.forEach((p, i) => {
      const s = toScreen(t, p);
      expect(nearestIndex(pts, t, s.x, s.y)).toBe(i);
    });
  });

  it('returns null when the cursor is far from every point', () => {
    const t = pathTransform(pts, SIZE);
    expect(nearestIndex(pts, t, -500, -500, 10)).toBeNull();
  });

  it('survives a degenerate single-point path without dividing by zero', () => {
    const t = pathTransform([{ x: 5, y: 5 }], SIZE);
    const s = toScreen(t, { x: 5, y: 5 });
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Number.isFinite(s.y)).toBe(true);
  });
});

export { SIZE, defaultParams };
