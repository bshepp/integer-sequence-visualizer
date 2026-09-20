import { SequenceView } from '../../sequence/sequence';
import { makeSurrogate } from '../../nullmodel/surrogates';
import type { SurrogateType } from '../../nullmodel/surrogates';

/**
 * The same sequence, scrambled by one of the site's own null models.
 *
 * Deliberately the shared implementation rather than a 3D reimplementation: a
 * null model that differed between the 2D and 3D views would make the two
 * pictures incomparable, which is the whole point of drawing them side by side.
 */
export function surrogateView(seq: SequenceView, type: SurrogateType, seed: number): SequenceView {
  const terms = Array.from({ length: seq.length }, (_, i) => seq.term(i));
  return new SequenceView({ ...seq.seq, terms: makeSurrogate(terms, type, seed) });
}
