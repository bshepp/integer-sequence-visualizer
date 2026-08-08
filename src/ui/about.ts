export interface Citation {
  /** Rendered verbatim; keep exactly as published. */
  text: string;
  href?: string;
  /** Why it is here — one line, shown under the reference. */
  note: string;
}

/**
 * The mathematical lineage of this class of picture.
 *
 * The two 1980s references came from Jean-Paul Allouche on the SeqFan thread
 * and are reproduced exactly as he gave them. As he noted there, neither
 * appears to be linked from the relevant OEIS entries, which is a real and
 * easy contribution still going spare.
 */
export const CITATIONS: Citation[] = [
  {
    text: 'N. J. A. Sloane, The On-Line Encyclopedia of Integer Sequences (OEIS).',
    href: 'https://oeis.org/',
    note: 'Every sequence rendered here comes from the OEIS. Nothing about this project would exist without it.',
  },
  {
    text: 'F. M. Dekking, M. Mendès France, "Uniform distribution modulo one: a geometrical viewpoint", J. Reine Angew. Math. 329 (1981), 143–153. [cf. pp. 149 and 151]',
    note: 'The mathematical grounding for drawing sequences as curves, forty years before any of this. Supplied by Jean-Paul Allouche.',
  },
  {
    text: 'J.-M. Deshouillers, "Geometric aspect of Weyl sums", in Elementary and Analytic Theory of Numbers (Warsaw, 1982), Banach Center Publ. 17, PWN, Warsaw, 1985, pp. 75–82.',
    href: 'https://bibliotekanauki.pl/articles/721340.pdf',
    note: 'Similar pictures throughout. Also supplied by Jean-Paul Allouche.',
  },
  {
    text: 'M. L. Stein, S. M. Ulam, M. B. Wells, "A visual display of some properties of the distribution of primes", American Mathematical Monthly 71 (1964), 516–520.',
    note: 'The square-spiral display this site is named after, and the original instance of noticing a pattern in a drawing of numbers.',
  },
  {
    text: 'W. Kolakoski, Problem 5304, American Mathematical Monthly 72 (1965), 674.',
    href: 'https://oeis.org/A000002',
    note: 'A000002, the self-describing sequence used as the worked example on the landing page.',
  },
  {
    text: 'George Whale, NCurve — an app rendering OEIS sequences as polyarc curves.',
    href: 'https://openprocessing.org/@GeorgeWhaleResearch/2986029',
    note: 'The tool that prompted the question this project was built to answer.',
  },
];

const PARA = (text: string): HTMLParagraphElement => {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
};

function section(title: string, id: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  h.id = id;
  return h;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = text;
  return a;
}

export interface AboutOptions {
  onGallery(): void;
  onEngine(): void;
}

export function buildAbout(opts: AboutOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'about';

  const h1 = document.createElement('h1');
  h1.className = 'about-title';
  h1.textContent = 'About Ulam';

  const nav = document.createElement('div');
  nav.className = 'page-nav';
  const toGallery = document.createElement('button');
  toGallery.className = 'page-nav-button';
  toGallery.type = 'button';
  toGallery.textContent = '← Gallery';
  toGallery.addEventListener('click', () => opts.onGallery());
  const toEngine = document.createElement('button');
  toEngine.className = 'page-nav-button page-nav-button--primary';
  toEngine.type = 'button';
  toEngine.textContent = 'Open the engine →';
  toEngine.addEventListener('click', () => opts.onEngine());
  nav.append(toGallery, toEngine);

  const body = document.createElement('div');
  body.className = 'about-body';

  body.append(
    section('The question', 'about-question'),
    PARA('In August 2026, George Whale introduced NCurve on the SeqFan mailing list — an app that draws OEIS sequences as polyarc curves. He asked whether such visualizations tell us, at a glance, anything useful or significant about the structure and character of the underlying sequences. Nobody answered. This site is an attempt to.'),
    PARA('The difficulty is that a drawing of a sequence is also a drawing of the drawing method. A square spiral imposes a spiral; a cumulative walk imposes drift. Some of what you see is in the numbers and some of it was put there by the technique, and staring harder does not separate them.'),

    section('The method', 'about-method'),
    PARA('Every rendering here can be placed beside a null model of itself: the same terms in a random order, the same steps between terms reordered, or fresh numbers matched to the same trend and spread. If a pattern survives having the sequence scrambled underneath it, the technique produced the pattern rather than the numbers.'),
    PARA('That test is necessary but not sufficient, and the gallery includes a deliberate counterexample: a(n) = n on a spiral produces striking structure that the null model endorses, because shuffling really does destroy it — yet every sequence climbing by a constant draws the same picture, so it distinguishes nothing. A null model tells you whether a pattern survived a particular scrambling. It cannot tell you whether the pattern is worth anything.'),
  );

  const citeHead = section('Citations', 'about-citations');
  citeHead.className = 'about-citations-head';
  body.append(citeHead);
  body.append(PARA('This class of picture has a history considerably older than this website.'));

  const list = document.createElement('ol');
  list.className = 'citation-list';
  for (const c of CITATIONS) {
    const li = document.createElement('li');
    const ref = document.createElement('p');
    ref.className = 'citation-text';
    if (c.href) ref.appendChild(link(c.href, c.text));
    else ref.textContent = c.text;
    const note = document.createElement('p');
    note.className = 'citation-note';
    note.textContent = c.note;
    li.append(ref, note);
    list.appendChild(li);
  }
  body.appendChild(list);

  body.append(
    section('Credit', 'about-credit'),
    PARA('The SeqFan thread that started this is archived in the repository. From it: George Whale built NCurve and asked the question. Bill McEachen went looking through the sequences, gave eleven of them names — French curve, pie crust, propeller, tire, saw blade, record disc, zipper, Slinky — and highlighted A019488, a find of Neil Sloane\'s; all eleven are preset in the sidebar under his names. Jean-Paul Allouche supplied the 1980s references above.'),
    PARA('Nothing here is claimed on their behalf, and none of them has endorsed this site. They are credited because the work descends from theirs.'),
  );

  const threadLink = document.createElement('p');
  threadLink.append('The thread: ');
  threadLink.appendChild(link('https://groups.google.com/d/topic/seqfan/vGfMma6DkDk', '[SeqFan] A new visualization tool for OEIS sequences'));
  body.appendChild(threadLink);

  body.append(
    section('How it was built', 'about-build'),
    PARA('This site was written with substantial AI assistance — Anthropic\'s Claude, specifically the Fable 5, Sonnet 5 and Opus 5 models, which produced most of the code and much of the analysis under direction.'),
    PARA('Since the site makes empirical claims, that seems worth stating plainly rather than leaving to be discovered. The claims do not rest on trusting any of it: every measurement quoted on the site is computed by code in the public repository and checked by a test that recomputes it, so a claim that stopped reproducing would fail the build. Corrections are welcome.'),
  );

  const repo = document.createElement('p');
  repo.append('Source, MIT licensed: ');
  repo.appendChild(link('https://github.com/bshepp/integer-sequence-visualizer', 'github.com/bshepp/integer-sequence-visualizer'));
  body.appendChild(repo);

  const attribution = document.createElement('p');
  attribution.className = 'about-attribution';
  attribution.append('Sequence data from ');
  attribution.appendChild(link('https://oeis.org/', 'The On-Line Encyclopedia of Integer Sequences'));
  attribution.append('®, © OEIS Foundation Inc., used under ');
  attribution.appendChild(link('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'));
  attribution.append('.');
  body.appendChild(attribution);

  // One measure for the whole page: per-element max-width in `ch` units
  // misaligns, because a ch is relative to the element's own font size and the
  // heading is twice the body size.
  const inner = document.createElement('div');
  inner.className = 'about-inner';
  inner.append(nav, h1, body);
  el.append(inner);
  return el;
}
