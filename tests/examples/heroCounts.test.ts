import { describe, it, expect } from 'vitest';
import { residueStep } from '../../src/examples/statistics';
import { primes } from '../../src/examples/sequences';
import { makeSurrogate } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { heroEntry } from '../../src/examples/entries';

/**
 * The hero's write-up quotes four numbers that the landing page lets a visitor
 * produce for themselves, so they have to be right at all four counts rather
 * than only at the one the entry ships with.
 *
 * The prediction going in was that the comparison would weaken with more terms,
 * because at 10,000 primes the two panels look like the same tangle. It gets
 * stronger. The eye loses the structure at that scale and the statistic does
 * not, which is the entry's point and worth having pinned.
 */
const MOD = 187;
const view = (terms: bigint[]) =>
  new SequenceView({ terms, name: 'p', offset: 0, source: 'oeis' } as Sequence);

/** count -> the percentage the body quotes for it. */
const QUOTED: Array<[number, number]> = [[58, 5.0], [500, 7.6], [2000, 9.3], [10000, 11.2]];

describe('the residue step at each of the four hero counts', () => {
  for (const [n, quoted] of QUOTED) {
    it(`is ${quoted}% at ${n.toLocaleString()} primes, as the write-up says`, () => {
      const measured = residueStep(view(primes(n)), MOD) * 100;
      // Rounded the way the sentence is read, not with a tolerance: 500 terms
      // measure 7.6495%, which a toBeCloseTo(_, 1) check passes by 0.0005 and
      // would have let the prose say 7.7% - which it did, until this ran.
      expect(Math.round(measured * 10) / 10, `${n} terms measured ${measured.toFixed(3)}%`)
        .toBe(quoted);
      // toFixed(1), because `${5.0}` is "5" and the body says "5.0%".
      const asWritten = `${quoted.toFixed(1)}%`;
      expect(heroEntry().body, `body never quotes ${asWritten}`).toContain(asWritten);
    });
  }

  it('rises with the count, because prime gaps grow', () => {
    const vals = QUOTED.map(([n]) => residueStep(view(primes(n)), MOD));
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]!, `${QUOTED[i]![0]} terms did not exceed ${QUOTED[i - 1]![0]}`)
        .toBeGreaterThan(vals[i - 1]!);
    }
  });

  it('leaves a shuffle near half the dial at every count', () => {
    // The claim "a shuffle of the same terms sits near 50% at every count".
    for (const [n] of QUOTED) {
      const terms = primes(n);
      const vals = Array.from({ length: 30 }, (_, i) =>
        residueStep(view(makeSurrogate(terms, 'permutation', 1 + i)), MOD) * 100);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      expect(mean, `${n} terms: shuffle averaged ${mean.toFixed(1)}%`).toBeGreaterThan(45);
      expect(mean).toBeLessThan(55);
    }
  });

  it('leaves the difference null powerless at every count, so the verdict holds', () => {
    // Why the entry reads `untestable` rather than claiming a result, and why
    // that does not change when a visitor picks a different count: residueStep
    // is a function of the multiset of steps, which this null preserves
    // exactly. Every surrogate returns the same number, to the last bit.
    for (const [n] of QUOTED) {
      const terms = primes(n);
      const real = residueStep(view(terms), MOD);
      for (let i = 0; i < 20; i++) {
        expect(residueStep(view(makeSurrogate(terms, 'difference', 1 + i)), MOD),
          `${n} terms, surrogate ${i} moved`).toBe(real);
      }
    }
    expect(heroEntry().verdict).toBe('untestable');
    expect(heroEntry().body).toMatch(/no power at any of the four counts/i);
  });
});
