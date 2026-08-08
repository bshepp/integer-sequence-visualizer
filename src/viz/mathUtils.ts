// Math.min(...values) / Math.max(...values) spread every element into a
// function call's argument list. V8's argument-count limit is ~250k
// (verified: fine at 200k, `RangeError: Maximum call stack size exceeded` at
// 300k) - well within reach of a loaded b-file's point count (e.g. a
// 2000-term sequence's 2D digit walk produces hundreds of thousands of
// points). A loop has no such limit, so every min/max over a
// caller-supplied-length array goes through this helper instead of a spread.
export function minMax(values: number[]): { lo: number; hi: number } {
  if (values.length === 0) return { lo: 0, hi: 0 };
  let lo = values[0]!;
  let hi = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return { lo, hi };
}
