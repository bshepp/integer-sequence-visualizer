import { describe, it, expect } from 'vitest';
import { percentileBands, DEFAULT_LEVELS, bandAt } from '../../src/nullmodel/bands';

describe('percentileBands', () => {
  it('computes per-index median and band edges', () => {
    const bands = percentileBands([[1, 10], [2, 20], [3, 30]], [90]);
    expect(bands.median).toEqual([2, 20]);
    const level = bands.levels[0]!;
    expect(level.lo[0]!).toBeGreaterThanOrEqual(1);
    expect(level.lo[0]!).toBeLessThanOrEqual(2);
    expect(level.hi[0]!).toBeGreaterThanOrEqual(2);
    expect(level.hi[0]!).toBeLessThanOrEqual(3);
  });

  it('a 100% level spans min to max', () => {
    const bands = percentileBands([[1], [2], [3]], [100]);
    expect(bands.levels[0]!.lo).toEqual([1]);
    expect(bands.levels[0]!.hi).toEqual([3]);
  });

  it('throws on ragged input', () => {
    expect(() => percentileBands([[1, 2], [3]])).toThrow();
    expect(() => percentileBands([])).toThrow();
  });
});

describe('nested percentile levels', () => {
  // 101 rows, column 0 = row index, so quantiles are exactly predictable.
  const arrays = Array.from({ length: 101 }, (_, r) => [r, r * 2]);

  it('produces one level per requested percentage, widest first', () => {
    const b = percentileBands(arrays, [50, 90, 99]);
    expect(b.levels.map((l) => l.pct)).toEqual([99, 90, 50]);
  });

  it('nests: each level is contained by the next wider one', () => {
    const b = percentileBands(arrays, DEFAULT_LEVELS);
    for (let i = 0; i + 1 < b.levels.length; i++) {
      const wide = b.levels[i]!, narrow = b.levels[i + 1]!;
      for (let j = 0; j < wide.lo.length; j++) {
        expect(wide.lo[j]!).toBeLessThanOrEqual(narrow.lo[j]!);
        expect(wide.hi[j]!).toBeGreaterThanOrEqual(narrow.hi[j]!);
      }
    }
  });

  it('the 90% level reproduces the old 5-95 band exactly', () => {
    const b = percentileBands(arrays, [90]);
    expect(b.levels[0]!.lo[0]).toBeCloseTo(5, 10);
    expect(b.levels[0]!.hi[0]).toBeCloseTo(95, 10);
  });

  it('median is unchanged by the level set', () => {
    expect(percentileBands(arrays, [50]).median[0]).toBeCloseTo(50, 10);
    expect(percentileBands(arrays, [99]).median[0]).toBeCloseTo(50, 10);
  });

  it('bandAt finds a level by percentage', () => {
    const b = percentileBands(arrays, [50, 90]);
    expect(bandAt(b, 90)?.pct).toBe(90);
    expect(bandAt(b, 75)).toBeUndefined();
  });

  it('still rejects ragged input', () => {
    expect(() => percentileBands([[1, 2], [3]])).toThrow(/ragged/);
  });
});
