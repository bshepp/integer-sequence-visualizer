// tests/viz3d/pick.test.ts
import { describe, it, expect } from 'vitest';
import { decimate } from '../../src/viz3d/pick';
import { liftPath } from '../../src/viz3d/lift';

const path = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: (i * 7) % 13 }));
const geometry = liftPath(path, (i) => i, { step: 1 });

describe('decimate', () => {
  it('returns no more than the requested vertices', () => {
    const { positions, sourceIndex } = decimate(geometry, 100);
    expect(positions.length / 3).toBeLessThanOrEqual(100);
    expect(sourceIndex).toHaveLength(positions.length / 3);
  });

  it('maps every kept vertex back to where it came from', () => {
    const { positions, sourceIndex } = decimate(geometry, 100);
    for (let i = 0; i < sourceIndex.length; i++) {
      const src = sourceIndex[i]!;
      expect(positions[i * 3]).toBe(geometry.positions[src * 3]);
      expect(positions[i * 3 + 2]).toBe(geometry.positions[src * 3 + 2]);
    }
  });

  it('keeps everything when it already fits', () => {
    const small = liftPath(path.slice(0, 10), (i) => i, { step: 1 });
    const { sourceIndex } = decimate(small, 100);
    expect(Array.from(sourceIndex)).toEqual([...Array(10).keys()]);
  });
});
