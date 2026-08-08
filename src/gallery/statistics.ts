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
 * same value and the evidence recorded in the gallery reproduces exactly.
 *
 * NOTE: this statistic does NOT distinguish Kolakoski from its own
 * permutation null - measured 2.28e-5 against a band of 5.6e-7..1.32e-3, well
 * inside. It is kept because that negative result is worth having on record
 * (tests/gallery/verdicts.test.ts pins it), and because the reason is
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
