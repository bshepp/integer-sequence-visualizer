import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '../../src/examples/entries';
import { switchRate, longestRun, angularVariance, residueAlternation, residueStep, residuePeriodicity } from '../../src/examples/statistics';
import { makeSurrogate, type SurrogateType } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import type { Evidence } from '../../src/examples/types';
import { RUNGS, outcomeOf, foregone, highestSurviving, type RungReading } from '../../src/nullmodel/ladder';

/** Statistic name -> implementation, for reproducing recorded evidence. */
const STATISTICS: Record<string, (seq: SequenceView, params: Record<string, unknown>) => number> = {
  switchRate: (seq) => switchRate(seq),
  longestRun: (seq) => longestRun(seq),
  angularVariance: (seq, params) => angularVariance(seq, Number(params.modulus ?? 2)),
  residueAlternation: (seq, params) => residueAlternation(seq, Number(params.k ?? 2)),
  residueStep: (seq, params) => residueStep(seq, Number(params.modulus ?? 2)),
  residuePeriodicity: (seq, params) => residuePeriodicity(seq, Number(params.modulus ?? 2)),
};

const asSeq = (terms: bigint[]): Sequence => ({ terms, name: 's', offset: 0, source: 'paste' });

/** Recompute one rung's band exactly as the recorded evidence describes it. */
function rungBand(
  stat: (seq: SequenceView, params: Record<string, unknown>) => number,
  surrogate: SurrogateType, n: number, seed: number,
  terms: bigint[], params: Record<string, unknown>,
): { lo: number; hi: number; median: number } {
  const vals: number[] = [];
  for (let j = 0; j < n; j++) {
    vals.push(stat(new SequenceView(asSeq(makeSurrogate(terms, surrogate, seed + j))), params));
  }
  vals.sort((a, b) => a - b);
  const at = (p: number) => vals[Math.min(vals.length - 1, Math.floor((vals.length - 1) * p))]!;
  return { lo: at(0.025), hi: at(0.975), median: at(0.5) };
}

describe('verdicts are computed, not asserted', () => {
  const claimed = EXAMPLES.filter((e) => e.evidence);

  it('has at least one measured claim', () => {
    expect(claimed.length).toBeGreaterThan(0);
  });

  for (const entry of claimed) {
    const ev = entry.evidence!;

    it(`${entry.id}: the recorded measurement reproduces`, () => {
      const stat = STATISTICS[ev.statistic];
      expect(stat, `no implementation for statistic "${ev.statistic}"`).toBeDefined();
      const measured = stat!(new SequenceView(entry.sequence), entry.state.params);
      expect(measured).toBeCloseTo(ev.measured, 9);
    });

    it(`${entry.id}: every recorded rung reproduces`, () => {
      const stat = STATISTICS[ev.statistic]!;
      expect(ev.rungs.map((r) => r.surrogate), 'rungs must be in ladder order').toEqual([...RUNGS]);
      for (const rung of ev.rungs) {
        const band = rungBand(stat, rung.surrogate, ev.n, ev.seed, entry.sequence.terms, entry.state.params);
        expect(band.lo, `${rung.surrogate} lo`).toBeCloseTo(rung.bandLo, 9);
        expect(band.hi, `${rung.surrogate} hi`).toBeCloseTo(rung.bandHi, 9);
        expect(band.median, `${rung.surrogate} median`).toBeCloseTo(rung.median, 9);
      }
    });

    it(`${entry.id}: the verdict is the one the rungs imply`, () => {
      // The whole point of the redesign. A verdict is now a readable
      // consequence of the numbers beside it, so a caption cannot drift away
      // from what was measured without this failing.
      const readings: RungReading[] = ev.rungs.map((r) => ({
        type: r.surrogate, measured: ev.measured, lo: r.bandLo, hi: r.bandHi, median: r.median,
      }));
      const top = readings[readings.length - 1]!;
      const topOutcome = outcomeOf(top.measured, top.lo, top.hi);

      if (entry.verdict === 'survives-steps') {
        expect(topOutcome, 'the strictest null must actually reject').toBe('rejects');
        expect(highestSurviving(readings)).toBe('difference');
      } else if (entry.verdict === 'explained-by-steps') {
        // Must be reproduced *with power*: a band that could not have missed
        // is 'untestable', and calling it 'explained' would claim a result the
        // measurement never had the room to produce.
        expect(topOutcome).toBe('reproduced');
      } else if (entry.verdict === 'untestable') {
        expect(topOutcome).toBe('no-power');
      }
    });
  }

  it("every 'foregone' verdict is on a sequence that really is monotone", () => {
    for (const e of EXAMPLES) {
      if (e.verdict !== 'foregone') continue;
      expect(foregone(e.sequence.terms, 'permutation'), `${e.id} is not monotone`).toBe(true);
    }
  });

  it("every verdict without evidence explains itself in prose", () => {
    for (const e of EXAMPLES) {
      if (e.verdict !== 'open' && !e.evidence) {
        expect(e.body.length, `${e.id}`).toBeGreaterThan(150);
      }
    }
  });
});

describe('negative result: angular variance does not separate Kolakoski', () => {
  // Recorded because it is a real finding and the obvious statistic to reach
  // for on a spiral. It was the hero's first candidate and had to be replaced.
  // Pinning it stops a later contributor from adopting it as evidence, and
  // makes the failure visible if the statistic or the sequence ever changes.
  it('measures inside its own permutation null band', () => {
    // Named, not EXAMPLES[0]. This records a fact about Kolakoski, and reading
    // it off whichever entry happens to be the hero silently re-pointed the
    // negative result at a different sequence when the hero changed.
    const entry = EXAMPLES.find((e) => e.id === 'kolakoski-spiral')!;
    const params = entry.state.params;
    const measured = angularVariance(new SequenceView(entry.sequence), Number(params.modulus ?? 2));
    const band = rungBand(STATISTICS.angularVariance!, 'permutation', 200, 1, entry.sequence.terms, params);
    expect(measured).toBeGreaterThan(band.lo);
    expect(measured).toBeLessThan(band.hi);
  });
});

describe('negative result: the switch rate is untestable by the strictest null', () => {
  // The hero used to claim the switch rate. It counts non-zero steps, and the
  // difference null preserves the multiset of steps, so the band collapses to
  // a point for any sequence at all. Pinned as a property of the statistic
  // rather than of Kolakoski, because that is what makes it a trap.
  it('collapses to a point for both two-valued sequences that used to cite it', () => {
    for (const id of ['kolakoski-spiral', 'thue-morse']) {
      const entry = EXAMPLES.find((e) => e.id === id)!;
      const band = rungBand(STATISTICS.switchRate!, 'difference', 60, 1, entry.sequence.terms, entry.state.params);
      expect(outcomeOf(switchRate(new SequenceView(entry.sequence)), band.lo, band.hi), id).toBe('no-power');
    }
  });
});

describe('definitional facts asserted rather than claimed', () => {
  it('Kolakoski never has a run longer than 2', () => {
    // Follows from the definition (it encodes its own run lengths, and its
    // terms are 1 and 2), so this is checked rather than measured against a
    // band -- but the hero's body states it, so it is still tested.
    const entry = EXAMPLES.find((e) => e.id === 'kolakoski-spiral')!;
    expect(longestRun(new SequenceView(entry.sequence))).toBe(2);
  });

  it('every step of A000464 is even, which is why its residues alternate', () => {
    // The hero claim of that entry after the rewrite, and the reason its
    // strictest null has nothing to test: the alternation is arithmetic, not
    // arrangement. Checked directly rather than inferred from a band.
    const terms = EXAMPLES.find((e) => e.id === 'a000464-pentagram')!.sequence.terms;
    for (let i = 1; i < terms.length; i++) {
      expect((terms[i]! - terms[i - 1]!) % 2n, `step ${i}`).toBe(0n);
    }
  });
});

// Kept out of the loop above: `Evidence` is imported for its type only, and an
// unused import fails the build.
export type { Evidence };
