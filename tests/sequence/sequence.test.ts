import { describe, it, expect } from 'vitest';
import { Sequence, SequenceView } from '../../src/sequence/sequence';

function mkSeq(terms: bigint[]): Sequence {
  return { terms, name: 'test', offset: 0, source: 'paste' };
}

describe('SequenceView', () => {
  it('exposes length and raw terms', () => {
    const v = new SequenceView(mkSeq([0n, 1n, 1n, 2n, 3n]));
    expect(v.length).toBe(5);
    expect(v.term(3)).toBe(2n);
    expect(() => v.term(5)).toThrow(RangeError);
    expect(() => v.term(-1)).toThrow(RangeError);
  });

  it('toNumber clamps beyond float64 safe range', () => {
    const huge = 10n ** 30n;
    const v = new SequenceView(mkSeq([7n, -7n, huge, -huge]));
    expect(v.toNumber(0)).toBe(7);
    expect(v.toNumber(1)).toBe(-7);
    expect(v.toNumber(2)).toBe(Number.MAX_SAFE_INTEGER);
    expect(v.toNumber(3)).toBe(-Number.MAX_SAFE_INTEGER);
  });

  it('logMagnitude works for huge values via digit count', () => {
    const v = new SequenceView(mkSeq([0n, 1000n, -1000n, 10n ** 25n]));
    expect(v.logMagnitude(0)).toBe(0);
    expect(v.logMagnitude(1)).toBeCloseTo(3, 5);
    expect(v.logMagnitude(2)).toBeCloseTo(3, 5);
    expect(v.logMagnitude(3)).toBeCloseTo(25, 5);
  });

  it('mod is mathematical (never negative)', () => {
    const v = new SequenceView(mkSeq([-7n, 7n]));
    expect(v.mod(0, 5)).toBe(3);
    expect(v.mod(1, 5)).toBe(2);
  });

  it('digits returns most-significant-first in the given base', () => {
    const v = new SequenceView(mkSeq([123n, -45n, 0n]));
    expect(v.digits(0)).toEqual([1, 2, 3]);
    expect(v.digits(1)).toEqual([4, 5]);   // absolute value
    expect(v.digits(2)).toEqual([0]);
    expect(v.digits(0, 2)).toEqual([1, 1, 1, 1, 0, 1, 1]); // 123 = 0b1111011
  });

  it('sign', () => {
    const v = new SequenceView(mkSeq([-3n, 0n, 9n]));
    expect(v.sign(0)).toBe(-1);
    expect(v.sign(1)).toBe(0);
    expect(v.sign(2)).toBe(1);
  });

  it('digits rejects invalid bases', () => {
    const v = new SequenceView(mkSeq([123n]));
    expect(() => v.digits(0, 1)).toThrow(RangeError);
    expect(() => v.digits(0, 2.5)).toThrow(RangeError);
    expect(v.digits(0, 2)).toEqual([1, 1, 1, 1, 0, 1, 1]);
  });
});
