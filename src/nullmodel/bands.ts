export interface Bands { lo: number[]; median: number[]; hi: number[]; }

function percentile(sortedVals: number[], pct: number): number {
  const q = (sortedVals.length - 1) * (pct / 100);
  const base = Math.floor(q);
  const frac = q - base;
  const lo = sortedVals[base]!;
  const hi = sortedVals[Math.min(base + 1, sortedVals.length - 1)]!;
  return lo + (hi - lo) * frac;
}

export function percentileBands(arrays: number[][], loPct = 5, hiPct = 95): Bands {
  if (arrays.length === 0) throw new Error('percentileBands: no arrays');
  const len = arrays[0]!.length;
  if (arrays.some((a) => a.length !== len)) throw new Error('percentileBands: ragged input');
  const lo: number[] = [], median: number[] = [], hi: number[] = [];
  for (let i = 0; i < len; i++) {
    const col = arrays.map((a) => a[i]!).sort((x, y) => x - y);
    lo.push(percentile(col, loPct));
    median.push(percentile(col, 50));
    hi.push(percentile(col, hiPct));
  }
  return { lo, median, hi };
}
