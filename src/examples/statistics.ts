import type { SequenceView } from '../sequence/sequence';
import { spiralCoords } from '../viz/gridUtils';

/**
 * Fraction of adjacent pairs whose terms differ.
 *
 * A pure ordering statistic: a permutation surrogate preserves the exact
 * value multiset, so any difference in switch rate between a sequence and its
 * shuffle is entirely down to arrangement. For a two-valued sequence at
 * roughly equal density a shuffle sits near 0.5; anything materially above
 * that alternates more regularly than chance.
 */
export function switchRate(seq: SequenceView): number {
  if (seq.length < 2) return 0;
  let switches = 0;
  for (let i = 0; i + 1 < seq.length; i++) {
    if (seq.term(i) !== seq.term(i + 1)) switches++;
  }
  return switches / (seq.length - 1);
}

/** Length of the longest run of identical consecutive terms. */
export function longestRun(seq: SequenceView): number {
  if (seq.length === 0) return 0;
  let best = 1, current = 1;
  for (let i = 1; i < seq.length; i++) {
    current = seq.term(i) === seq.term(i - 1) ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
}

/**
 * Variance of the mean colour-class direction on the Ulam spiral.
 *
 * Groups cells by term residue mod `modulus`, and for each class computes the
 * mean unit vector from the spiral centre to its cells. A class whose cells
 * are spread evenly in all directions has a near-zero resultant; a class
 * clumped into one sector has a long one. The statistic is the variance of
 * those resultant lengths across classes - low means every class is spread
 * evenly (unusual regularity), high means classes clump into sectors.
 *
 * Deterministic and pure: no RNG, so the same sequence always measures the
 * same value and the recorded evidence reproduces exactly.
 *
 * NOTE: this statistic does NOT distinguish Kolakoski from its own
 * permutation null - measured 2.28e-5 against a band of 5.6e-7..1.32e-3, well
 * inside. It is kept because that negative result is worth having on record
 * (tests/examples/verdicts.test.ts pins it), and because the reason is
 * instructive: the spiral distributes any two-valued sequence over roughly
 * the same directions regardless of order, so a direction-based statistic is
 * nearly blind to arrangement. switchRate is what actually separates them.
 */
export function angularVariance(seq: SequenceView, modulus: number): number {
  const coords = spiralCoords(seq.length);
  const sumX = new Array<number>(modulus).fill(0);
  const sumY = new Array<number>(modulus).fill(0);
  const count = new Array<number>(modulus).fill(0);

  for (let i = 0; i < seq.length; i++) {
    const c = coords[i]!;
    const r = Math.hypot(c.x, c.y);
    if (r === 0) continue; // the centre cell has no direction
    const k = seq.mod(i, modulus);
    sumX[k]! += c.x / r;
    sumY[k]! += c.y / r;
    count[k]!++;
  }

  const resultants: number[] = [];
  for (let k = 0; k < modulus; k++) {
    if (count[k] === 0) continue;
    resultants.push(Math.hypot(sumX[k]!, sumY[k]!) / count[k]!);
  }
  if (resultants.length === 0) return 0;
  const mean = resultants.reduce((s, v) => s + v, 0) / resultants.length;
  return resultants.reduce((s, v) => s + (v - mean) ** 2, 0) / resultants.length;
}

/**
 * Lag-1 autocorrelation of the residues a(n) mod k.
 *
 * -1 for a perfect two-value alternation, ~0 for a shuffle. A turtle walk
 * turns by (angle x term mod k), so this measures the one thing about the
 * residues that a permutation surrogate destroys: whether adjacent terms
 * reverse each other. A sequence whose residues alternate strictly turns by
 * the same amount every pair of terms, which is what makes a walk close into
 * a regular figure instead of wandering.
 *
 * Deterministic and pure, so recorded evidence reproduces exactly.
 *
 * Uses the conventional (biased) estimator: n-1 cross terms over n variance
 * terms, so a perfect alternation of length n reads -(n-1)/n rather than a
 * round -1. The shrink toward 0 on short series is the point - a five-term
 * alternation is much weaker evidence than a fifty-term one, and the
 * statistic should say so.
 */
export function residueAlternation(seq: SequenceView, modulus: number): number {
  const r: number[] = [];
  for (let i = 0; i < seq.length; i++) r.push(seq.mod(i, modulus));
  return alternation(r);
}

/**
 * The bare estimator, over any series of numbers. Split out from
 * residueAlternation because the pentagram experiment needs to run it over
 * thousands of shuffled residue arrays that never become a SequenceView, and
 * two copies of a statistic is how a published claim and its own experiment
 * quietly stop agreeing.
 */
export function alternation(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i]! - mean;
    den += d * d;
    if (i + 1 < n) num += d * (values[i + 1]! - mean);
  }
  return den === 0 ? 0 : num / den;
}

/**
 * How far the residue moves from one term to the next, on average, as a
 * fraction of the furthest it could move.
 *
 * 0 is a sequence whose residues never change; 1 is one that jumps to the
 * opposite side of the modulus every time. Distance is circular, because
 * residue 1 and residue m-1 are neighbours on a dial - a term that steps
 * across zero has moved a little, not the whole way round.
 *
 * This is the statistic behind the smoothness of an arc drawing. Each term
 * bends the path by an angle set by its residue, so consecutive residues that
 * are close together make consecutive arcs that are nearly the same, and the
 * path curves instead of jinking. It is what the eye is reading when one of
 * these pictures looks organic rather than scribbled.
 *
 * Worth knowing before citing it: this is a function of the multiset of steps.
 * Reorder the steps and every value is preserved exactly, so the difference
 * null has no power over it at all, which is a fact about the statistic rather
 * than about any sequence you measure with it.
 */
export function residueStep(seq: SequenceView, modulus: number): number {
  if (seq.length < 2 || modulus < 2) return 0;
  let sum = 0;
  for (let i = 1; i < seq.length; i++) {
    const d = Math.abs(seq.mod(i, modulus) - seq.mod(i - 1, modulus));
    sum += Math.min(d, modulus - d);
  }
  return sum / (seq.length - 1) / (modulus / 2);
}
