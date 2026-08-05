import { describe, it, expect } from 'vitest';
import { percentileBands } from '../../src/nullmodel/bands';

describe('percentileBands', () => {
  it('computes per-index median and band edges', () => {
    const bands = percentileBands([[1, 10], [2, 20], [3, 30]]);
    expect(bands.median).toEqual([2, 20]);
    expect(bands.lo[0]!).toBeGreaterThanOrEqual(1);
    expect(bands.lo[0]!).toBeLessThanOrEqual(2);
    expect(bands.hi[0]!).toBeGreaterThanOrEqual(2);
    expect(bands.hi[0]!).toBeLessThanOrEqual(3);
  });

  it('honors custom percentiles (p0/p100 = min/max)', () => {
    const bands = percentileBands([[1], [2], [3]], 0, 100);
    expect(bands.lo).toEqual([1]);
    expect(bands.hi).toEqual([3]);
  });

  it('throws on ragged input', () => {
    expect(() => percentileBands([[1, 2], [3]])).toThrow();
    expect(() => percentileBands([])).toThrow();
  });
});
