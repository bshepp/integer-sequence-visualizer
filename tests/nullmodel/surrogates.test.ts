import { describe, it, expect } from 'vitest';
import { mulberry32, shuffleInPlace } from '../../src/nullmodel/rng';
import {
  permutationSurrogate, differenceSurrogate, matchedRandomSurrogate, makeSurrogate,
} from '../../src/nullmodel/surrogates';
import { FIB_2000 } from '../helpers/fixtures';

const sorted = (xs: bigint[]) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const fib = [0n, 1n, 1n, 2n, 3n, 5n, 8n, 13n, 21n, 34n, 55n, 89n];

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const va = Array.from({ length: 5 }, () => a());
    const vb = Array.from({ length: 5 }, () => b());
    expect(va).toEqual(vb);
    for (const v of va) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
});

describe('shuffleInPlace', () => {
  it('permutes deterministically under a seed', () => {
    const a = shuffleInPlace([1, 2, 3, 4, 5, 6], mulberry32(1));
    const b = shuffleInPlace([1, 2, 3, 4, 5, 6], mulberry32(1));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('permutationSurrogate', () => {
  it('preserves the exact multiset, destroys order, reproducible', () => {
    const s1 = permutationSurrogate(fib, 7);
    const s2 = permutationSurrogate(fib, 7);
    expect(s1).toEqual(s2);
    expect(sorted(s1)).toEqual(sorted(fib));
    expect(s1).not.toEqual(fib); // astronomically unlikely to be identity
    expect(fib).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 8n, 13n, 21n, 34n, 55n, 89n]); // input untouched
  });
});

describe('differenceSurrogate', () => {
  it('preserves first term, last term, and the multiset of differences', () => {
    const s = differenceSurrogate(fib, 7);
    expect(s.length).toBe(fib.length);
    expect(s[0]).toBe(fib[0]);
    expect(s[s.length - 1]).toBe(fib[fib.length - 1]); // sum of diffs is invariant
    const diffs = (xs: bigint[]) => xs.slice(1).map((v, i) => v - xs[i]!);
    expect(sorted(diffs(s))).toEqual(sorted(diffs(fib)));
  });
});

describe('matchedRandomSurrogate', () => {
  it('matches length, stays within the value envelope, reproducible', () => {
    const s1 = matchedRandomSurrogate(fib, 7);
    const s2 = matchedRandomSurrogate(fib, 7);
    expect(s1).toEqual(s2);
    expect(s1.length).toBe(fib.length);
    for (const v of s1) {
      expect(v >= 0n && v <= 89n).toBe(true);
    }
    expect(matchedRandomSurrogate(fib, 8)).not.toEqual(s1);
  });
});

describe('matchedRandomSurrogate on an overflowing sequence (task FR, I1)', () => {
  it('does not clamp every overflowing term to the same MAX_SAFE_INTEGER value', () => {
    const s = matchedRandomSurrogate(FIB_2000, 1);
    expect(s.length).toBe(FIB_2000.length);
    // Measured before the fix (2001-term Fibonacci): 945 of 2001 terms
    // pinned at MAX_SAFE_INTEGER, only 1057 distinct values overall.
    const atMax = s.filter((v) => v === BigInt(Number.MAX_SAFE_INTEGER)).length;
    expect(atMax).toBe(0);
    const distinct = new Set(s.map(String)).size;
    expect(distinct).toBeGreaterThan(FIB_2000.length - 10);
  });

  it('stays within the true (unclamped) value envelope of the original terms', () => {
    const s = matchedRandomSurrogate(FIB_2000, 1);
    let trueMin = FIB_2000[0]!, trueMax = FIB_2000[0]!;
    for (const t of FIB_2000) { if (t < trueMin) trueMin = t; if (t > trueMax) trueMax = t; }
    for (const v of s) expect(v >= trueMin && v <= trueMax).toBe(true);
  });

  it('is still deterministic under a seed, and different seeds diverge', () => {
    const s1 = matchedRandomSurrogate(FIB_2000, 1);
    const s2 = matchedRandomSurrogate(FIB_2000, 1);
    expect(s1).toEqual(s2);
    expect(matchedRandomSurrogate(FIB_2000, 2)).not.toEqual(s1);
  });

  it('a leading zero term (the OEIS offset-0 convention, e.g. Fibonacci a(0)=0) does not defeat the overflow-safe path', () => {
    expect(FIB_2000[0]).toBe(0n); // sanity: the fixture actually has this shape
    const s = matchedRandomSurrogate(FIB_2000, 1);
    expect(s.some((v) => v === BigInt(Number.MAX_SAFE_INTEGER))).toBe(false);
  });
});

describe('matchedRandomSurrogate on a sign-mixed overflowing sequence (task FR, I1 follow-up)', () => {
  // pasteParser.ts places no cap on magnitude or sign, so this is reachable
  // today via the app's own "Custom" paste tab, not a synthetic-only case:
  // a user pastes alternating huge positive/negative terms and picks the
  // 'matched' null model. An earlier version of the I1 fix only routed
  // non-negative overflowing sequences through the log-space path
  // (`terms.every(t => t >= 0n)`), so this exact shape fell through to the
  // plain clamped path and reproduced the original defect (clamping every
  // overflowing term — regardless of sign — to the same
  // +/-MAX_SAFE_INTEGER, modelling the clamp artifact instead of the data).
  const terms: bigint[] = [];
  for (let i = 0; i < 40; i++) terms.push(i % 2 === 0 ? 10n ** 20n : -(10n ** 20n));

  it('does not clamp every overflowing term to the same +/-MAX_SAFE_INTEGER value', () => {
    const s = matchedRandomSurrogate(terms, 1);
    expect(s.length).toBe(terms.length);
    const clampedCount = s.filter(
      (v) => v === BigInt(Number.MAX_SAFE_INTEGER) || v === -BigInt(Number.MAX_SAFE_INTEGER),
    ).length;
    expect(clampedCount).toBe(0);
    const distinct = new Set(s.map(String)).size;
    expect(distinct).toBeGreaterThan(terms.length / 2);
  });

  it('generates both positive and negative values (sign is not collapsed by the log-space fit)', () => {
    const s = matchedRandomSurrogate(terms, 1);
    expect(s.some((v) => v > 0n)).toBe(true);
    expect(s.some((v) => v < 0n)).toBe(true);
  });

  it('stays within the true (unclamped) signed value envelope of the original terms', () => {
    const s = matchedRandomSurrogate(terms, 1);
    let trueMin = terms[0]!, trueMax = terms[0]!;
    for (const t of terms) { if (t < trueMin) trueMin = t; if (t > trueMax) trueMax = t; }
    for (const v of s) expect(v >= trueMin && v <= trueMax).toBe(true);
  });

  it('is still deterministic under a seed, and different seeds diverge', () => {
    const s1 = matchedRandomSurrogate(terms, 1);
    const s2 = matchedRandomSurrogate(terms, 1);
    expect(s1).toEqual(s2);
    expect(matchedRandomSurrogate(terms, 2)).not.toEqual(s1);
  });
});

describe('matchedRandomSurrogate noise is Gaussian at the residual sd, not uniform on the max envelope (task FR, I2)', () => {
  // Starts with 0 (like this file's `fib` fixture above) so allPositive is
  // false and the plain linear branch is exercised deterministically,
  // independent of the exp-vs-linear model comparison — with one modest
  // outlier so the OLS fit has a non-degenerate residual spread to compare
  // against.
  const terms = [0n, 10n, 20n, 30n, 140n, 50n, 60n, 70n, 80n, 90n, 100n];
  const nums = terms.map(Number);
  let lo = nums[0]!, hi = nums[0]!;
  for (const v of nums) { if (v < lo) lo = v; if (v > hi) hi = v; }

  // Independent OLS re-derivation (standard formula; not an import of the
  // module's own private fitLine). xs are 0..n-1.
  function fitLineIndependent(ys: number[]): { a: number; b: number; mse: number } {
    const n = ys.length;
    const mx = (n - 1) / 2;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - mx) * (ys[i]! - my); den += (i - mx) ** 2; }
    const a = den === 0 ? 0 : num / den;
    const b = my - a * mx;
    const mse = ys.reduce((s, y, i) => s + (y - (a * i + b)) ** 2, 0) / n;
    return { a, b, mse };
  }

  it('empirical noise sd across many seeds tracks the residual sd, clearly tighter than the old uniform-max-envelope sd', () => {
    const { a, b, mse } = fitLineIndependent(nums);
    const residualSd = Math.sqrt(mse);
    const maxAbsResidual = Math.max(...nums.map((y, i) => Math.abs(y - (a * i + b))));
    const oldUniformSd = maxAbsResidual / Math.sqrt(3); // sd of Uniform(-maxRes, +maxRes)
    expect(oldUniformSd).toBeGreaterThan(residualSd); // sanity: the fixture actually separates the two

    const draws = 500;
    const noiseSamples: number[] = [];
    for (let seed = 0; seed < draws; seed++) {
      const s = matchedRandomSurrogate(terms, seed);
      for (let i = 0; i < s.length; i++) {
        const v = Number(s[i]!);
        // Exclude samples clamped at the envelope boundary: clamping
        // compresses the tails regardless of which noise model produced
        // them, which would bias the empirical sd down for either model and
        // muddy the comparison.
        if (v > lo && v < hi) noiseSamples.push(v - (a * i + b));
      }
    }
    const mean = noiseSamples.reduce((s, v) => s + v, 0) / noiseSamples.length;
    const empiricalSd = Math.sqrt(noiseSamples.reduce((s, v) => s + (v - mean) ** 2, 0) / noiseSamples.length);

    expect(empiricalSd).toBeLessThan(oldUniformSd * 0.7); // clearly tighter than the old (too-wide) approach
    expect(empiricalSd).toBeGreaterThan(residualSd * 0.5);
    expect(empiricalSd).toBeLessThan(residualSd * 2);
  });

  it('keeps the existing determinism guarantee: same seed -> identical output', () => {
    const s1 = matchedRandomSurrogate(terms, 11);
    const s2 = matchedRandomSurrogate(terms, 11);
    expect(s1).toEqual(s2);
  });
});

describe('makeSurrogate', () => {
  it('dispatches by type', () => {
    expect(makeSurrogate(fib, 'permutation', 3)).toEqual(permutationSurrogate(fib, 3));
    expect(makeSurrogate(fib, 'difference', 3)).toEqual(differenceSurrogate(fib, 3));
    expect(makeSurrogate(fib, 'matched', 3)).toEqual(matchedRandomSurrogate(fib, 3));
  });
});
