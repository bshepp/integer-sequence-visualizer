import { describe, it, expect } from 'vitest';
import { compileFormula, validateFormula, sequenceFromFormula } from '../../src/sequence/formula';

describe('compileFormula', () => {
  it('evaluates polynomials in n', () => {
    const f = compileFormula('n*n + n + 41');
    expect(f(0n)).toBe(41n);
    expect(f(1n)).toBe(43n);
    expect(f(10n)).toBe(151n);
  });

  it('handles precedence and parentheses', () => {
    expect(compileFormula('2 + 3 * 4')(0n)).toBe(14n);
    expect(compileFormula('(2 + 3) * 4')(0n)).toBe(20n);
  });

  it('power is right-associative with bigint results', () => {
    expect(compileFormula('2^10')(0n)).toBe(1024n);
    expect(compileFormula('2^3^2')(0n)).toBe(512n); // 2^(3^2)
    expect(compileFormula('2^100')(0n)).toBe(2n ** 100n);
  });

  it('division truncates toward zero; % is remainder', () => {
    expect(compileFormula('7/2')(0n)).toBe(3n);
    expect(compileFormula('-7/2')(0n)).toBe(-3n);
    expect(compileFormula('7%3')(0n)).toBe(1n);
  });

  it('unary minus and functions', () => {
    expect(compileFormula('-n')(5n)).toBe(-5n);
    expect(compileFormula('abs(-8)')(0n)).toBe(8n);
    expect(compileFormula('min(3, n)')(1n)).toBe(1n);
    expect(compileFormula('max(3, n)')(1n)).toBe(3n);
    expect(compileFormula('gcd(12, 18)')(0n)).toBe(6n);
  });

  it('rejects bad syntax with messages', () => {
    expect(() => compileFormula('n +')).toThrow();
    expect(() => compileFormula('2 ** 3')).toThrow();
    expect(() => compileFormula('foo(n)')).toThrow(/foo/);
    expect(() => compileFormula('1/0')(0n)).toThrow(/zero/i);
    expect(() => compileFormula('2^-1')(0n)).toThrow(/exponent/i);
  });

  it('validateFormula returns null or the message', () => {
    expect(validateFormula('n^2')).toBeNull();
    expect(typeof validateFormula('n +')).toBe('string');
  });

  it('sequenceFromFormula builds a Sequence', () => {
    const s = sequenceFromFormula('n*n', 4);
    expect(s.terms).toEqual([0n, 1n, 4n, 9n]);
    expect(s.name).toBe('n*n');
    expect(s.source).toBe('formula');
    const s1 = sequenceFromFormula('n', 3, 5);
    expect(s1.terms).toEqual([5n, 6n, 7n]);
    expect(s1.offset).toBe(5);
  });
});
