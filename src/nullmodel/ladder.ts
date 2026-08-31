import type { SurrogateType } from './surrogates';

/**
 * The null models, ordered by how much of the sequence they leave standing.
 *
 * A permutation asks the weakest question there is: could these same terms in
 * some other order have drawn this? For most OEIS sequences the answer is no
 * before you start, because the ordering IS the sequence - nine of the sixteen
 * worked examples on this site are monotone, and shuffling a monotone sequence
 * destroys sortedness, which no interesting property had to be responsible for.
 * "Of course it falls apart when you shuffle it" is a fair complaint about a
 * test that stops there, and it is the standard one: a naive permutation tests
 * against exchangeability, which is the bottom rung of the surrogate-data
 * ladder (Theiler et al. 1992). The literature's answer is not one null but a
 * sequence of them, each preserving more structure than the last, reported by
 * how far up a finding survives.
 *
 * These three are ordered but not strictly nested, and it would be dishonest
 * to imply otherwise: they preserve different things, not progressively more
 * of the same thing. What the order does capture is how much a surrogate has
 * to agree with the real sequence before it is allowed to disagree.
 *
 *   permutation  the exact multiset of values, and nothing about their order
 *   matched      the trend and the spread, with every value newly invented
 *   difference   the exact multiset of steps, so trend, endpoint, and - the
 *                point of the whole exercise - monotonicity all survive
 *
 * That last one is why no new surrogate was needed for the monotone problem.
 * Shuffling the steps of a non-decreasing sequence re-integrates to another
 * non-decreasing sequence: every step is still positive, they merely arrive in
 * a different order. It is a constrained realization in the literature's
 * sense, and it was already here, defaulted past.
 */
export const RUNGS: readonly SurrogateType[] = ['permutation', 'matched', 'difference'];

/** What each null actually asserts, in the words a reader can check. */
export const NULL_QUESTION: Record<SurrogateType, string> = {
  permutation: 'Could these same terms, in some other order, have drawn this?',
  matched: 'Could any sequence with this trend and this spread have drawn this?',
  difference: 'Could these same steps, taken in some other order, have drawn this?',
};

export function rungOf(type: SurrogateType): number {
  return RUNGS.indexOf(type);
}

/**
 * Whether rejecting this null was settled before the measurement was taken.
 *
 * Only claims the case it can prove. A monotone sequence cannot survive its
 * own permutation: sortedness is one arrangement out of n!, so any statistic
 * that notices sortedness rejects with certainty, and the rejection says
 * nothing that "this sequence increases" did not already say.
 *
 * KNOWN GAP, to be closed before this is wired into the engine. It reads the
 * raw terms, but several views never see them: the polyarc and the mod-N grid
 * consume `a(n) mod b`, and monotone terms say nothing at all about their
 * residues. Fibonacci is the counterexample already on the site - its terms are
 * strictly increasing, so this returns true and calls the comparison vacuous,
 * while the fibonacci-rosette entry rests on a permutation null that keeps
 * every residue and their sum and destroys only the arrangement. That is the
 * least vacuous comparison here, and this function currently marks it as the
 * most.
 *
 * The fix is to ask what the statistic consumes rather than what the sequence
 * is, which means this needs the view's modulus - see
 * docs/ladder-in-the-engine-brief.md.
 */
export function foregone(terms: readonly bigint[], type: SurrogateType): boolean {
  if (type !== 'permutation' || terms.length < 3) return false;
  let up = true, down = true;
  for (let i = 1; i < terms.length; i++) {
    if (terms[i]! < terms[i - 1]!) up = false;
    if (terms[i]! > terms[i - 1]!) down = false;
    if (!up && !down) return false;
  }
  return true;
}

export type Outcome =
  /** The real sequence is outside the null's band: this null cannot explain it. */
  | 'rejects'
  /** Inside the band, and the band is wide enough for that to mean something. */
  | 'reproduced'
  /**
   * The band has no width. The statistic is a function of what this null
   * preserves, so every surrogate returns the same number and the test cannot
   * come out any other way. Not evidence of anything - the absence of a test.
   *
   * Reported separately because it is otherwise indistinguishable from
   * 'reproduced', and means the opposite of what that would be taken to mean.
   * Kolakoski's switch rate against the difference null is exactly this: the
   * switch rate counts non-zero steps, the difference null preserves the
   * multiset of steps, so the answer is 0.667 for every surrogate forever.
   */
  | 'no-power';

/** Band width below which a null is not testing anything. */
const NO_POWER = 1e-9;

export function outcomeOf(measured: number, lo: number, hi: number): Outcome {
  if (hi - lo < NO_POWER) return 'no-power';
  return measured < lo || measured > hi ? 'rejects' : 'reproduced';
}

export interface RungReading {
  type: SurrogateType;
  measured: number;
  lo: number;
  hi: number;
  median: number;
}

/**
 * How much of a finding against a weaker null is already explained by a
 * stricter one reproducing it.
 *
 * The skill-score shape (Murphy 1988): the observed effect, measured against
 * what a reference that already contains the boring explanation achieves.
 * 1 means the stricter null lands exactly where the real sequence does and the
 * whole result was the structure that null preserves; 0 means the stricter
 * null is no closer than chance and the finding is the sequence's own.
 *
 * Returns null when the weak null has no effect to explain, rather than
 * dividing by something near zero and reporting a large number confidently.
 */
export function explainedByStricter(weak: RungReading, strict: RungReading): number | null {
  const effect = weak.measured - weak.median;
  if (Math.abs(effect) < 1e-9) return null;
  const explained = (strict.median - weak.median) / effect;
  return Math.max(0, Math.min(1, explained));
}

/** The strictest null a finding survives, or null if the weakest already explains it. */
export function highestSurviving(readings: readonly RungReading[]): SurrogateType | null {
  let best: SurrogateType | null = null;
  for (const r of readings) {
    if (outcomeOf(r.measured, r.lo, r.hi) !== 'rejects') continue;
    if (best === null || rungOf(r.type) > rungOf(best)) best = r.type;
  }
  return best;
}
