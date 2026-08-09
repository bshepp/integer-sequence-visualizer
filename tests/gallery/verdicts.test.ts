import { describe, it, expect } from 'vitest';
import { GALLERY } from '../../src/gallery/entries';
import { switchRate, longestRun, angularVariance, residueAlternation } from '../../src/gallery/statistics';
import { makeSurrogate } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import type { Evidence } from '../../src/gallery/types';

/** Statistic name -> implementation, for reproducing recorded evidence. */
const STATISTICS: Record<string, (seq: SequenceView, params: Record<string, unknown>) => number> = {
  switchRate: (seq) => switchRate(seq),
  longestRun: (seq) => longestRun(seq),
  angularVariance: (seq, params) => angularVariance(seq, Number(params.modulus ?? 2)),
  residueAlternation: (seq, params) => residueAlternation(seq, Number(params.k ?? 2)),
};

const asSeq = (terms: bigint[]): Sequence => ({ terms, name: 's', offset: 0, source: 'paste' });

/** Recompute the null band exactly as the recorded evidence describes it. */
function nullBand(
  stat: (seq: SequenceView, params: Record<string, unknown>) => number,
  ev: Evidence,
  terms: bigint[],
  params: Record<string, unknown>,
): { lo: number; hi: number } {
  const vals: number[] = [];
  for (let j = 0; j < ev.n; j++) {
    vals.push(stat(new SequenceView(asSeq(makeSurrogate(terms, ev.surrogate, ev.seed + j))), params));
  }
  vals.sort((a, b) => a - b);
  const at = (p: number) => vals[Math.min(vals.length - 1, Math.floor((vals.length - 1) * p))]!;
  return { lo: at(0.025), hi: at(0.975) };
}

describe('gallery verdicts are computed, not asserted', () => {
  const claimed = GALLERY.filter((e) => e.evidence);

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

    it(`${entry.id}: the recorded null band reproduces`, () => {
      const stat = STATISTICS[ev.statistic]!;
      const band = nullBand(stat, ev, entry.sequence.terms, entry.state.params);
      expect(band.lo).toBeCloseTo(ev.bandLo, 9);
      expect(band.hi).toBeCloseTo(ev.bandHi, 9);
    });

    it(`${entry.id}: a 'real' or 'split' verdict means the measurement is outside the band`, () => {
      // 'split' claims only half a result, but that half has to clear the
      // band exactly as 'real' does - the hedge is about what the number
      // means, not about whether it holds.
      if (entry.verdict === 'real' || entry.verdict === 'split') {
        expect(ev.measured < ev.bandLo || ev.measured > ev.bandHi).toBe(true);
      }
    });
  }

  it("every 'artifact' without evidence explains itself in prose", () => {
    for (const e of GALLERY) {
      if (e.verdict === 'artifact' && !e.evidence) {
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
    const entry = GALLERY[0]!;
    const ev: Evidence = { statistic: 'angularVariance', measured: 0, bandLo: 0, bandHi: 0,
      surrogate: 'permutation', n: 200, seed: 1 };
    const params = entry.state.params;
    const measured = angularVariance(new SequenceView(entry.sequence), Number(params.modulus ?? 2));
    const band = nullBand(STATISTICS.angularVariance!, ev, entry.sequence.terms, params);
    expect(measured).toBeGreaterThan(band.lo);
    expect(measured).toBeLessThan(band.hi);
  });
});

describe('definitional facts asserted rather than claimed', () => {
  it('Kolakoski never has a run longer than 2', () => {
    // Follows from the definition (it encodes its own run lengths, and its
    // terms are 1 and 2), so this is checked rather than measured against a
    // band -- but the hero's body states it, so it is still tested.
    const entry = GALLERY.find((e) => e.id === 'kolakoski-spiral')!;
    expect(longestRun(new SequenceView(entry.sequence))).toBe(2);
  });
});
