import type { Sequence } from '../sequence/sequence';
import type { UrlState } from '../ui/urlState';
import type { SurrogateType } from '../nullmodel/surrogates';

/** One rung of the ladder: what this null did with the statistic. */
export interface RungEvidence {
  surrogate: SurrogateType;
  bandLo: number;
  bandHi: number;
  /** Needed for the skill score, and for telling a narrow band from a shifted one. */
  median: number;
}

/**
 * A recorded measurement backing a verdict - everything needed to reproduce
 * the claim deterministically, so tests/examples/verdicts.test.ts can recompute
 * it rather than trusting the caption.
 *
 * One measured value against every rung, not against a single null. A number
 * outside a permutation band used to be the whole claim, and it is the weakest
 * thing on the ladder: for a monotone sequence it is a foregone conclusion,
 * and for a statistic the stricter nulls preserve it is not a test at all.
 */
export interface Evidence {
  statistic: string;
  measured: number;
  n: number;
  seed: number;
  /** Weakest null first, in RUNGS order. */
  rungs: RungEvidence[];
}

export type Verdict =
  /**
   * Outside the band of every null we have, including the one that keeps the
   * exact multiset of steps. The strongest thing this site can say.
   */
  | 'survives-steps'
  /**
   * The step-preserving null draws it too, and had room not to. The feature
   * belongs to how the sequence moves rather than to the order it moves in -
   * which is a finding, not a failure, and usually a sharper one.
   */
  | 'explained-by-steps'
  /** Reproduced once the trend is held fixed: the trend was doing the work. */
  | 'explained-by-trend'
  /**
   * The strictest null has no room to disagree, because the statistic is a
   * function of what that null preserves. Every surrogate returns the same
   * number. Not evidence either way - the absence of a test, which reads
   * identically to agreement unless it is said out loud.
   */
  | 'untestable'
  /**
   * The sequence is monotone, so a shuffle was always going to look different
   * and the rejection says only that the sequence increases. Kept as its own
   * verdict because it is the objection a reader raises unprompted, and the
   * site should raise it first.
   */
  | 'foregone'
  /** Not measured. Say so; do not guess. */
  | 'open';

export interface ExampleEntry {
  id: string;
  title: string;
  /** The exact engine view. Clicking the entry applies this hash. */
  state: UrlState;
  /** Bundled so the landing renders with zero network round-trips. */
  sequence: Sequence;
  verdict: Verdict;
  caption: string;
  body: string;
  /** Required by every verdict that reports an outcome at a rung. */
  evidence?: Evidence;
  /**
   * Which shelf the entry sits on.
   *
   * 'thread' entries came from the SeqFan discussion and are shown drawn but
   * untested, so they must not be mixed in with the worked ones under a
   * heading promising work. Keeping them apart is the honest arrangement and
   * also the useful one: a shelf of good pictures nobody has measured is an
   * invitation, and that is the whole pitch of the site.
   */
  group?: 'worked' | 'thread';
}
