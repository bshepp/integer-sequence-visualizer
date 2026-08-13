import { describe, it, expect } from 'vitest';
import {
  RUNGS, NULL_QUESTION, rungOf, foregone, outcomeOf, explainedByStricter, highestSurviving,
  type RungReading,
} from '../../src/nullmodel/ladder';
import { makeSurrogate, type SurrogateType } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { switchRate, residueAlternation } from '../../src/examples/statistics';
import { EXAMPLES } from '../../src/examples/entries';

const monotone = (t: readonly bigint[]) => {
  for (let i = 1; i < t.length; i++) if (t[i]! < t[i - 1]!) return false;
  return true;
};
const view = (terms: bigint[]) =>
  new SequenceView({ terms, name: 's', offset: 0, source: 'paste' } as Sequence);

function reading(
  terms: bigint[], type: SurrogateType, stat: (s: SequenceView) => number, n = 80,
): RungReading {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(stat(view(makeSurrogate(terms, type, i + 1))));
  vals.sort((a, b) => a - b);
  return {
    type,
    measured: stat(view(terms)),
    lo: vals[Math.floor(0.025 * n)]!,
    hi: vals[Math.floor(0.975 * n)]!,
    median: vals[Math.floor(0.5 * n)]!,
  };
}

describe('the ladder', () => {
  it('runs from the weakest null to the strictest', () => {
    expect([...RUNGS]).toEqual(['permutation', 'matched', 'difference']);
    expect(rungOf('permutation')).toBeLessThan(rungOf('difference'));
  });

  it('states each null as a question a reader can check', () => {
    for (const r of RUNGS) {
      expect(NULL_QUESTION[r].endsWith('?'), r).toBe(true);
      expect(NULL_QUESTION[r].length).toBeGreaterThan(30);
    }
  });
});

describe('the difference null preserves what makes the monotone case work', () => {
  // The whole design rests on this. If shuffling the steps of an increasing
  // sequence could produce a decreasing one, the difference null would be no
  // better than a permutation for exactly the sequences that need it most.
  it('re-integrates a monotone sequence into another monotone sequence', () => {
    for (const id of ['primes-spiral', 'thread-zipper', 'thread-sloane', 'a000464-pentagram']) {
      const terms = EXAMPLES.find((e) => e.id === id)!.sequence.terms.slice(0, 200);
      expect(monotone(terms), `${id} fixture is not monotone`).toBe(true);
      for (const seed of [1, 2, 7, 99]) {
        expect(monotone(makeSurrogate(terms, 'difference', seed)), `${id} seed ${seed}`).toBe(true);
      }
    }
  });

  it('a permutation of the same sequence does not', () => {
    const terms = EXAMPLES.find((e) => e.id === 'primes-spiral')!.sequence.terms.slice(0, 200);
    expect(monotone(makeSurrogate(terms, 'permutation', 1))).toBe(false);
  });
});

describe('foregone', () => {
  it('flags a permutation null on a monotone sequence', () => {
    expect(foregone([1n, 2n, 3n, 4n, 5n], 'permutation')).toBe(true);
    expect(foregone([5n, 4n, 3n, 2n, 1n], 'permutation')).toBe(true);
  });

  it('does not flag a sequence that moves both ways', () => {
    expect(foregone([1n, 2n, 1n, 2n, 1n], 'permutation')).toBe(false);
  });

  it('only ever claims it of the permutation null', () => {
    // The difference and matched nulls both survive a monotone sequence, so
    // rejecting them is never a foregone conclusion.
    expect(foregone([1n, 2n, 3n, 4n, 5n], 'difference')).toBe(false);
    expect(foregone([1n, 2n, 3n, 4n, 5n], 'matched')).toBe(false);
  });

  it('says nothing about a sequence too short to have a direction', () => {
    expect(foregone([1n, 2n], 'permutation')).toBe(false);
  });
});

describe('outcomeOf', () => {
  it('separates a null that reproduces a value from one that could not have done otherwise', () => {
    expect(outcomeOf(0.5, 0.2, 0.8)).toBe('reproduced');
    expect(outcomeOf(0.9, 0.2, 0.8)).toBe('rejects');
    // The distinction the whole redesign turns on: a band with no width is not
    // a null that agrees, it is a null that was never asked anything.
    expect(outcomeOf(0.667, 0.667, 0.667)).toBe('no-power');
  });
});

describe('measured against the real sequences, which is the point', () => {
  const terms = (id: string, n = 300) =>
    EXAMPLES.find((e) => e.id === id)!.sequence.terms.slice(0, n);

  it("Kolakoski's switch rate cannot be tested by the difference null at all", () => {
    // The switch rate counts adjacent pairs that differ, i.e. non-zero steps.
    // The difference null preserves the multiset of steps. So every surrogate
    // returns the identical number and the test has no power - which read as
    // "the null reproduced it" before this distinction existed.
    const r = reading(terms('kolakoski-spiral'), 'difference', switchRate);
    expect(outcomeOf(r.measured, r.lo, r.hi)).toBe('no-power');
  });

  it("Kolakoski's residue alternation survives all the way up", () => {
    const t = terms('kolakoski-spiral');
    const stat = (s: SequenceView) => residueAlternation(s, 4);
    const readings = RUNGS.map((type) => reading(t, type, stat));
    expect(highestSurviving(readings)).toBe('difference');
  });

  it("A000464's alternation is entirely explained by its steps", () => {
    // Its terms are 1, 3, 1, 3 mod 4 without exception, which follows from
    // every step being even - and the difference null keeps the steps. So the
    // strictest null draws the same alternation every time, and the finding
    // belongs to the sequence's arithmetic rather than to the arrangement of
    // its terms. The permutation null could never have shown that.
    const t = terms('a000464-pentagram');
    const stat = (s: SequenceView) => residueAlternation(s, 4);
    const weak = reading(t, 'permutation', stat);
    const strict = reading(t, 'difference', stat);
    expect(outcomeOf(weak.measured, weak.lo, weak.hi)).toBe('rejects');
    expect(outcomeOf(strict.measured, strict.lo, strict.hi)).not.toBe('rejects');
    expect(explainedByStricter(weak, strict)!).toBeGreaterThan(0.95);
  });
});

describe('explainedByStricter', () => {
  const mk = (type: SurrogateType, measured: number, median: number): RungReading =>
    ({ type, measured, median, lo: median - 0.1, hi: median + 0.1 });

  it('is 1 when the stricter null lands on the real value', () => {
    expect(explainedByStricter(mk('permutation', 1, 0), mk('difference', 1, 1))).toBe(1);
  });

  it('is 0 when the stricter null is no closer than the weaker one', () => {
    expect(explainedByStricter(mk('permutation', 1, 0), mk('difference', 1, 0))).toBe(0);
  });

  it('declines to divide by an effect that is not there', () => {
    expect(explainedByStricter(mk('permutation', 0.5, 0.5), mk('difference', 0.5, 0.5))).toBeNull();
  });

  it('never reports outside 0 to 1, however the medians fall', () => {
    expect(explainedByStricter(mk('permutation', 1, 0), mk('difference', 1, 3))).toBe(1);
    expect(explainedByStricter(mk('permutation', 1, 0), mk('difference', 1, -2))).toBe(0);
  });
});
