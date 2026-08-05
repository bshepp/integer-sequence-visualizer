import { describe, it, expect } from 'vitest';
import { mulberry32, shuffleInPlace } from '../../src/nullmodel/rng';
import {
  permutationSurrogate, differenceSurrogate, matchedRandomSurrogate, makeSurrogate,
} from '../../src/nullmodel/surrogates';

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

describe('makeSurrogate', () => {
  it('dispatches by type', () => {
    expect(makeSurrogate(fib, 'permutation', 3)).toEqual(permutationSurrogate(fib, 3));
    expect(makeSurrogate(fib, 'difference', 3)).toEqual(differenceSurrogate(fib, 3));
    expect(makeSurrogate(fib, 'matched', 3)).toEqual(matchedRandomSurrogate(fib, 3));
  });
});
