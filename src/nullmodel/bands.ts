function percentile(sortedVals: number[], pct: number): number {
  const q = (sortedVals.length - 1) * (pct / 100);
  const base = Math.floor(q);
  const frac = q - base;
  const lo = sortedVals[base]!;
  const hi = sortedVals[Math.min(base + 1, sortedVals.length - 1)]!;
  return lo + (hi - lo) * frac;
}

export interface BandLevel { pct: number; lo: number[]; hi: number[]; }
export interface Bands { median: number[]; levels: BandLevel[]; }

// Widest first, so drawing them in array order paints wide-to-narrow and the
// narrower (more significant) levels land on top rather than being buried.
export const DEFAULT_LEVELS = [99, 90, 50];

export function bandAt(bands: Bands, pct: number): BandLevel | undefined {
  return bands.levels.find((l) => l.pct === pct);
}

// Extra quantiles are near-free: the per-index sort below is the entire cost
// of this function, and every additional level is O(1) lookups against an
// array that is already sorted. Going from one flat band to three nested ones
// therefore adds no meaningful work to the ensemble worker, while turning an
// outlier from a binary in/out read into a graded one — "outside the 99%
// contour" rather than merely "outside the band".
export function percentileBands(arrays: number[][], levels: number[] = DEFAULT_LEVELS): Bands {
  if (arrays.length === 0) throw new Error('percentileBands: no arrays');
  const len = arrays[0]!.length;
  if (arrays.some((a) => a.length !== len)) throw new Error('percentileBands: ragged input');

  const sorted = [...levels].sort((a, b) => b - a); // widest first
  const median: number[] = [];
  const out: BandLevel[] = sorted.map((pct) => ({ pct, lo: [], hi: [] }));

  for (let i = 0; i < len; i++) {
    const col = arrays.map((a) => a[i]!).sort((x, y) => x - y);
    median.push(percentile(col, 50));
    for (let k = 0; k < sorted.length; k++) {
      const tail = (100 - sorted[k]!) / 2;
      out[k]!.lo.push(percentile(col, tail));
      out[k]!.hi.push(percentile(col, 100 - tail));
    }
  }
  return { median, levels: out };
}
