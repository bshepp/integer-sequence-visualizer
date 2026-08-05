import { mulberry32, shuffleInPlace } from './rng';

export type SurrogateType = 'permutation' | 'difference' | 'matched';

export function permutationSurrogate(terms: bigint[], seed: number): bigint[] {
  return shuffleInPlace([...terms], mulberry32(seed));
}

export function differenceSurrogate(terms: bigint[], seed: number): bigint[] {
  if (terms.length < 2) return [...terms];
  const diffs = terms.slice(1).map((v, i) => v - terms[i]!);
  shuffleInPlace(diffs, mulberry32(seed));
  const out = [terms[0]!];
  for (const d of diffs) out.push(out[out.length - 1]! + d);
  return out;
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampNum = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

function fitLine(ys: number[]): { a: number; b: number; mse: number } {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
  const a = den === 0 ? 0 : num / den;
  const b = my - a * mx;
  const mse = ys.reduce((s, y, i) => s + (y - (a * i + b)) ** 2, 0) / n;
  return { a, b, mse };
}

export function matchedRandomSurrogate(terms: bigint[], seed: number): bigint[] {
  if (terms.length === 0) return [];
  const nums = terms.map(clampNum);
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const rand = mulberry32(seed);

  const lin = fitLine(nums);
  let model: (i: number) => number;
  let residual: number;
  const allPositive = nums.every((v) => v > 0);
  if (allPositive) {
    const logs = nums.map((v) => Math.log10(v));
    const exp = fitLine(logs);
    // compare in value space: normalize linear mse by value scale, exp mse by log scale
    const linRelMse = lin.mse / Math.max(1, (hi - lo) ** 2);
    const expRelMse = exp.mse / Math.max(1e-12, (Math.max(...logs) - Math.min(...logs)) ** 2 || 1);
    if (expRelMse < linRelMse) {
      const maxRes = Math.max(...logs.map((y, i) => Math.abs(y - (exp.a * i + exp.b))));
      model = (i) => 10 ** (exp.a * i + exp.b + (rand() * 2 - 1) * maxRes);
      residual = 0; // residual folded into model above
      return nums.map((_, i) => toClampedBigint(model(i), lo, hi));
    }
  }
  const maxRes = Math.max(...nums.map((y, i) => Math.abs(y - (lin.a * i + lin.b))));
  model = (i) => lin.a * i + lin.b;
  residual = maxRes;
  return nums.map((_, i) => toClampedBigint(model(i) + (rand() * 2 - 1) * residual, lo, hi));
}

function toClampedBigint(v: number, lo: number, hi: number): bigint {
  return BigInt(Math.round(Math.min(hi, Math.max(lo, v))));
}

export function makeSurrogate(terms: bigint[], type: SurrogateType, seed: number): bigint[] {
  switch (type) {
    case 'permutation': return permutationSurrogate(terms, seed);
    case 'difference': return differenceSurrogate(terms, seed);
    case 'matched': return matchedRandomSurrogate(terms, seed);
  }
}
