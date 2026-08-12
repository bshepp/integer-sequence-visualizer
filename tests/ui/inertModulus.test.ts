import { describe, it, expect } from 'vitest';
import { inertModulusAbove, inertModulusMessage } from '../../src/ui/inertModulus';
import { polyarcPath } from '../../src/viz/polyarc';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const view = (terms: number[]) =>
  new SequenceView({ terms: terms.map(BigInt), name: 't', offset: 1, source: 'paste' } as Sequence);

const kolakoski = [1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 2, 2, 1, 1, 2, 1, 1, 2, 2, 1];

describe('inertModulusAbove', () => {
  it('is the largest term when every term is non-negative', () => {
    expect(inertModulusAbove(kolakoski.map(BigInt))).toBe(2);
    expect(inertModulusAbove([0n, 7n, 3n])).toBe(7);
  });

  it('is null when any term is negative', () => {
    // The non-negative residue of -3 is 2 under b = 5 and 97 under b = 100, so
    // the control never stops responding and there is nothing to report.
    expect(inertModulusAbove([1n, -3n, 2n])).toBeNull();
  });

  it('is null for an empty sequence', () => {
    expect(inertModulusAbove([])).toBeNull();
  });

  it('does not try to convert an astronomically large term exactly', () => {
    const huge = 10n ** 400n;
    expect(inertModulusAbove([1n, huge])).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('names the threshold in the message', () => {
    expect(inertModulusMessage(2)).toContain('2');
    expect(inertModulusMessage(2)).toMatch(/modulus above 2/);
  });
});

describe('the claim the message makes is true of the drawing', () => {
  const draw = (terms: number[], modulus: number) =>
    JSON.stringify(polyarcPath(view(terms), { angle: 30, modulus, offset: -90 }));

  it('every modulus above the largest term draws the identical path', () => {
    const t = inertModulusAbove(kolakoski.map(BigInt))!;
    const reference = draw(kolakoski, t + 1);
    for (const b of [t + 2, 9, 17, 100, 360]) {
      expect(draw(kolakoski, b), `b = ${b} differs from b = ${t + 1}`).toBe(reference);
    }
  });

  it('at the threshold itself it still differs, so the boundary is not off by one', () => {
    const t = inertModulusAbove(kolakoski.map(BigInt))!;
    expect(draw(kolakoski, t)).not.toBe(draw(kolakoski, t + 1));
  });

  it('a negative term keeps the modulus live at every setting', () => {
    const alternating = [1, -3, 1, -3, 1, -3, 1, -3];
    expect(inertModulusAbove(alternating.map(BigInt))).toBeNull();
    expect(draw(alternating, 5)).not.toBe(draw(alternating, 100));
  });
});
