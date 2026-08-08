import type { Sequence } from '../sequence/sequence';
import type { UrlState } from '../ui/urlState';
import type { SurrogateType } from '../nullmodel/surrogates';

/**
 * A recorded measurement backing a verdict - everything needed to reproduce
 * the claim deterministically, so tests/gallery/verdicts.test.ts can recompute
 * it rather than trusting the caption.
 */
export interface Evidence {
  statistic: string;
  measured: number;
  bandLo: number;
  bandHi: number;
  surrogate: SurrogateType;
  n: number;
  seed: number;
}

export type Verdict =
  /** Survives the null: the structure is a property of the sequence. */
  | 'real'
  /** Reproduced by the null, or produced by the layout itself. */
  | 'artifact'
  /** Not measured. Say so; do not guess. */
  | 'open';

export interface GalleryEntry {
  id: string;
  title: string;
  /** The exact engine view. Clicking the entry applies this hash. */
  state: UrlState;
  /** Bundled so the landing renders with zero network round-trips. */
  sequence: Sequence;
  verdict: Verdict;
  caption: string;
  body: string;
  /** Required when verdict === 'real'. */
  evidence?: Evidence;
}
