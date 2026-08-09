import { describe, it, expect } from 'vitest';
import {
  runPentagramExperiment, headings, orderParameter, alternation, foldFromPairTurn, residuesOf,
} from '../../src/experiments/pentagram';
import { permutationSurrogate } from '../../src/nullmodel/surrogates';
import { A000464 } from './a000464.fixture';

// The configuration the star was spotted in.
const CONFIG = { angleDeg: 73, k: 4 };

describe('the statistics themselves', () => {
  it('scores a perfect alternation at its floor, and a constant at 0', () => {
    // The conventional (biased) estimator divides n-1 cross terms by n
    // variance terms, so a perfect alternation of length n reads -(n-1)/n
    // rather than a round -1. That shrink toward 0 on short series is the
    // point of the estimator, not a defect, so the floor is asserted exactly.
    expect(alternation([1, 3, 1, 3, 1, 3, 1, 3])).toBeCloseTo(-7 / 8, 12);
    expect(alternation([2, 2, 2, 2, 2])).toBe(0);
  });

  it('scores a clean m-pointed figure near 1 at that m', () => {
    const five = Array.from({ length: 40 }, (_, i) => ((i % 5) * 72 * Math.PI) / 180);
    expect(orderParameter(five, 5)).toBeCloseTo(1, 6);
    expect(orderParameter(five, 3)).toBeLessThan(0.3);
  });

  it('keeps residues positive for negative terms', () => {
    // -1 mod 4 is 3, not -1; a negative residue would turn the wrong way.
    expect(residuesOf([-1n, -5n, 7n], 4)).toEqual([3, 3, 3]);
  });
});

describe('what the sequence contributes', () => {
  const v = runPentagramExperiment(A000464, CONFIG);

  it('is a real and total alternation of the residues', () => {
    // a(n) mod 4 is 1, 3, 1, 3, ... for every one of the 216 terms in the
    // b-file. Nothing about that is an artifact of drawing.
    // Exactly the floor for 30 terms: every adjacent pair is a reversal.
    expect(v.realAlternation).toBeCloseTo(-29 / 30, 12);
    expect(v.pAlternation).toBe(0);
  });

  it('is nowhere near reachable by shuffling the same terms', () => {
    expect(v.nullAlternation.lo).toBeGreaterThan(-0.6);
    expect(v.nullAlternation.mean).toBeGreaterThan(-0.2);
  });
});

describe('what the angle contributes', () => {
  it('picks the number of points, and the sequence has no say in it', () => {
    // A pair of terms turns 1 + 3 = 4 times the angle. Five-pointedness is
    // 4 x 73 = 292 sitting close to 288 = 4 x 360/5, and nothing else.
    const v = runPentagramExperiment(A000464, CONFIG);
    expect(v.pairTurnDeg).toBe(292);
    expect(v.fold).toBe(5);

    // Feed the same perfect alternation a different angle and the fold count
    // follows the angle, not the sequence.
    expect(foldFromPairTurn(4 * 100).fold).toBe(9);   // 400 = 40 mod 360, closes in 9
    expect(foldFromPairTurn(4 * 45).fold).toBe(2);    // 180: retraces a line
    expect(foldFromPairTurn(4 * 30).fold).toBe(3);    // 120: a triangle
  });

  it('does not close exactly, which is why the figure creeps round', () => {
    const v = runPentagramExperiment(A000464, CONFIG);
    // 5 x 292 = 1460 = 20 mod 360.
    expect(v.driftPerCircuitDeg).toBe(20);
    expect(v.driftPerCircuitDeg).toBeGreaterThan(0);
  });
});

describe('the honest negative', () => {
  const v = runPentagramExperiment(A000464, CONFIG);

  it('direction concentration does not separate the real from a shuffle', () => {
    // The tempting statistic - "does the walk stick to five compass
    // directions?" - fails, and it fails in the unhelpful direction: the real
    // sequence scores no better than the null band, and here scores worse. A
    // shuffle wanders in clumps; the real walk covers a similar spread in
    // strict rotational order. The order is what the eye reads.
    expect(v.realDirectionR).toBeLessThan(v.nullDirectionR.hi);
  });
});

describe('how far the star holds up', () => {
  // Heading after each completed pair: the vertices of the figure.
  const pairHeadings = (pairs: number, pairTurnDeg: number) =>
    Array.from({ length: pairs }, (_, j) => (j * pairTurnDeg * Math.PI) / 180);

  it('is a short-run picture: run it long enough and the star smears', () => {
    // Every circuit lands 20 degrees on from the last. Over the 15 terms the
    // site loads by default that reads as a star; over a full b-file the same
    // walk fills in a rosette - which is why this figure looks cleaner with
    // fewer terms, the opposite of the site's usual advice.
    const r = (terms: number) => orderParameter(pairHeadings(Math.floor(terms / 2), 292), 5);
    expect(r(15)).toBeGreaterThan(0.7);
    expect(r(400)).toBeLessThan(0.2);
  });

  it('holds for the real sequence at the length the site loads by default', () => {
    const first15 = A000464.slice(0, 15);
    expect(alternation(residuesOf(first15, 4))).toBeCloseTo(-14 / 15, 12);
    expect(orderParameter(headings(residuesOf(first15, 4), 73), 5)).toBeGreaterThan(0.5);
  });
});

describe('why a shuffle sometimes draws a star too', () => {
  // The observation that started this: at some seeds the null model produces
  // its own pentagram, which reads as the null failing. It is the sample size.
  const starryShare = (n: number, threshold: number) => {
    const terms = A000464.slice(0, n);
    const draws = 2000;
    let hits = 0;
    for (let i = 1; i <= draws; i++) {
      if (alternation(residuesOf(permutationSurrogate(terms, i), 4)) < threshold) hits++;
    }
    return hits / draws;
  };

  it('is common at the length the site loads by default', () => {
    // About one seed in twenty, so pressing Reshuffle a few times finds one.
    const p = starryShare(15, -0.5);
    expect(p).toBeGreaterThan(0.03);
    expect(p).toBeLessThan(0.08);
  });

  it('all but vanishes once more terms are loaded', () => {
    // An order of magnitude rarer at 30 terms: the fix is more data, or Sweep.
    expect(starryShare(30, -0.5)).toBeLessThan(0.01);
    expect(starryShare(30, -0.5)).toBeLessThan(starryShare(15, -0.5));
  });
});
