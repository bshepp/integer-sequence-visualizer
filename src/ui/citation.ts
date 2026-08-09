import type { Sequence } from '../sequence/sequence';

/**
 * A pasteable reference to one specific view.
 *
 * The audience is a mailing list of mathematicians, for whom a citation of an
 * exact figure is worth considerably more than a share button. The URL encodes
 * sequence, visualizer, parameters, comparison mode, seed, style and zoom, so
 * the reference reproduces the picture rather than merely pointing at the site.
 */
export function citationFor(opts: {
  seq: Sequence; vizName: string; url: string; accessed: string;
}): string {
  const { seq, vizName, url, accessed } = opts;
  const subject = seq.aNumber ? `${seq.aNumber} (${seq.name})` : seq.name;
  return [
    `Ulam: OEIS sequence visualizer. ${vizName} of ${subject}, ${seq.terms.length} terms.`,
    `Retrieved ${accessed} from ${url}.`,
    'Sequence data from The On-Line Encyclopedia of Integer Sequences (OEIS),',
    '(c) OEIS Foundation Inc., CC BY-SA 4.0.',
  ].join(' ');
}
