import { buildFeedbackLink } from './feedbackLink';
import { NCURVE_URL } from './links';

export interface Citation {
  /** Rendered verbatim; keep exactly as published. */
  text: string;
  href?: string;
  /** Why it is here - one line, shown under the reference. */
  note: string;
}

/**
 * The mathematical lineage of this class of picture.
 *
 * Four of these were handed over by the SeqFan thread rather than found here,
 * which is worth recording as a fact about the thread: post a construction to
 * that list and its precedents arrive within days. Jean-Paul Allouche supplied
 * the two 1980s papers and Zantema, reproduced exactly as he gave them; Ed Pegg
 * identified Pickover's curlicues as the 1995 precedent for a technique the
 * thread had been discussing as new.
 *
 * As Allouche noted, neither 1980s paper appears to be linked from the relevant
 * OEIS entries - a real and easy contribution still going spare.
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
    // Raised by Ed Pegg on the SeqFan thread, 11 August 2026, as the precedent
    // for a construction the thread had been treating as new. Attribution and
    // date are his words; the links are the two he gave.
    text: 'Clifford A. Pickover, Curlicue fractals (1995).',
    href: 'https://mathworld.wolfram.com/CurlicueFractal.html',
    note: 'The 1995 precedent for this class of construction: a path turning by an angle derived from a term index. Identified by Ed Pegg, who asked the obvious question nobody else had.',
  },
  {
    text: 'H. Zantema, "Turtle graphics of morphic sequences", Fractals 24 (2016), no. 1.',
    href: 'https://hzantema.win.tue.nl/turtle.pdf',
    note: 'Turtle-graphic renderings of sequences, treated as mathematics rather than as illustration. Supplied by Jean-Paul Allouche, along with the corrected link.',
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
    text: 'George Whale, NCurve - an app rendering OEIS sequences as polyarc curves.',
    href: NCURVE_URL,
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

/**
 * The opening paragraph, built by hand rather than through PARA so that the
 * first mention of NCurve is the link. It is named three times on this page
 * and was reachable only from the citation list at the bottom, which is a long
 * way from where a reader first wonders what it is.
 */
function questionOpening(): HTMLParagraphElement {
  const p = document.createElement('p');
  p.append('In August 2026, George Whale introduced ');
  p.appendChild(link(NCURVE_URL, 'NCurve'));
  p.append(
    ' on the SeqFan mailing list. It is an app that draws OEIS sequences as '
    + 'polyarc curves. He asked whether such visualizations tell us, at a '
    + 'glance, anything useful or significant about the structure and character '
    + 'of the underlying sequences. Twelve days later Neil Sloane asked the '
    + 'sharper version of it on the same thread - what do the pictures tell you '
    + 'about a sequence, and what exactly are they good for? Two people offered '
    + 'partial answers and the thread moved on to more pictures. This site is an '
    + 'attempt at a fuller one.',
  );
  return p;
}

export interface AboutOptions {
  onExamples(): void;
  onEngine(): void;
  /**
   * The theme switch, built by the caller so there is one implementation of
   * it. This page covers the engine and marks it inert, so without a copy
   * here the switch is simply unreachable from the About page.
   */
  themeToggle?: HTMLElement;
}

export function buildAbout(opts: AboutOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'about';

  const h1 = document.createElement('h1');
  h1.className = 'about-title';
  h1.textContent = 'About Ulam';

  // "About Ulam" reads as a biography until you know otherwise, and the site
  // is named after a person most visitors will not be able to place. These two
  // paragraphs settle who he was, why his name is on this, and that the page
  // is about the software.
  const who = document.createElement('p');
  who.className = 'about-who';
  who.append('Named for ');
  who.appendChild(link('https://en.wikipedia.org/wiki/Stanis%C5%82aw_Ulam', 'Stanislaw Ulam'));
  who.append(
    ' (1909-1984), a Polish-American mathematician who worked on the Manhattan '
    + 'Project and co-invented the Monte Carlo method. This page is about the '
    + 'software, not the man.',
  );

  const whyName = document.createElement('p');
  whyName.className = 'about-who';
  whyName.textContent =
    'The name is owed to a doodle. Sitting through a dull talk in 1963, Ulam '
    + 'wrote the integers in a square spiral and noticed the primes falling '
    + 'along diagonal lines; he published it with Myron Stein and Mark Wells '
    + 'the following year. That is the founding example of what this site is '
    + 'for: a drawing of numbers that appears to show something, and thereby '
    + 'raises the question of whether it really does. The other half of the '
    + 'debt is Monte Carlo. Every null model here is a few hundred random '
    + 'draws used to establish what an ordinary result looks like, which is '
    + 'his method as well.';

  const nav = document.createElement('div');
  nav.className = 'page-nav';
  const toExamples = document.createElement('button');
  toExamples.className = 'page-nav-button';
  toExamples.type = 'button';
  toExamples.textContent = 'Worked examples';
  toExamples.addEventListener('click', () => opts.onExamples());
  const toEngine = document.createElement('button');
  toEngine.className = 'page-nav-button page-nav-button--primary';
  toEngine.type = 'button';
  toEngine.textContent = 'Open the engine';
  toEngine.addEventListener('click', () => opts.onEngine());
  nav.append(toExamples, toEngine);
  // Trailing, and set apart in CSS: it is a display preference sitting beside
  // two navigation actions, and grouping it with them implied it was a third
  // way to leave the page. Also keeps it clear of the initial focus target,
  // which is the first .page-nav-button.
  if (opts.themeToggle) nav.append(opts.themeToggle);

  const body = document.createElement('div');
  body.className = 'about-body';

  body.append(
    section('The question', 'about-question'),
    questionOpening(),
    PARA('The difficulty is that a drawing of a sequence is also a drawing of the drawing method. A square spiral imposes a spiral; a cumulative walk imposes drift. The pattern on the screen is real either way, and staring harder will not tell you whether it belongs to these numbers or to any numbers put through the same machinery.'),

    section('The method', 'about-method'),
    PARA('Every rendering here can be placed beside a null model of itself: the same terms in a random order, the same steps between terms reordered, or fresh numbers matched to the same trend and spread. If the same pattern is still there once the numbers underneath have been scrambled, the technique drew it rather than the sequence.'),
    PARA('That test is necessary but not sufficient, and the worked examples include a deliberate counterexample: a(n) = n on a spiral produces striking structure that the null model endorses, because shuffling really does destroy it. Yet every sequence climbing by a constant draws the same picture, so it distinguishes nothing. A null model tells you whether one measured number was reproduced by one particular scrambling. It cannot tell you whether the thing you are looking at is worth anything.'),
    // Issue #4's second half, and the harder one to keep in view: the site's
    // best entry is entirely about this gap, and the copy above it used to
    // flatten exactly the distinction that entry exists to draw.
    PARA('There is a second gap, and the worked examples are built around it: what you see and what gets measured are different objects. A000464 draws a five-pointed star, and the number underneath it is the alternation of consecutive residues. The walk closing on itself is in the sequence; the five-pointedness is in the protractor, an artifact of the angle it happens to be drawn at. Only one of those is what the null model was asked about. Every measured entry here names its statistic for that reason, and when the picture and the number disagree, the number is the narrow claim and the picture is only the reason anyone looked.'),

    section('How the randomness works', 'about-randomness'),
    PARA('Nothing here uses the browser\'s random number generator. Every null model is drawn by a mulberry32 generator started from the seed shown in the null model bar, and shuffles are Fisher-Yates over that stream. The consequence worth knowing is that the randomness is reproducible: the same sequence, surrogate and seed always produce the same null model, on any machine and on any day. That is why a shared link reproduces the exact picture it was shared for, and why every measurement quoted on this site can be recomputed rather than taken on trust.'),
    PARA('The three surrogates destroy different things, which is what makes them worth choosing between. A permutation keeps the exact terms and discards their order, so it asks whether the arrangement matters. A difference surrogate keeps the steps between terms and shuffles those instead, preserving the overall trend, which makes it a much harder test for anything that grows. A matched surrogate keeps only the trend and spread and invents new numbers to fit, so nothing arithmetic about the original survives at all. The (i) button beside the visualizer names whichever one is currently loaded.'),
    PARA('One surrogate is one sample, and a single draw can mislead in either direction. Reshuffle draws another for a quick second opinion. Sweep is the version that settles it: it runs a few hundred draws and reports where the real sequence falls against the whole spread, which is the number worth quoting.'),
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
    PARA('The SeqFan thread that started this is archived in the repository. From it: George Whale built NCurve and asked the question. Bill McEachen went looking through the sequences, named eight of them (French curve, pie crust, propeller, tire, saw blade, record disc, zipper, Slinky) and highlighted A019488, a sequence of Neil Sloane\'s; all eleven are preset in the sidebar, under his names where he gave them. Jean-Paul Allouche supplied the 1980s references above.'),
    PARA('Nothing here is claimed on their behalf, and none of them has endorsed this site. They are credited because the work descends from theirs.'),
  );

  const threadLink = document.createElement('p');
  threadLink.append('The thread: ');
  threadLink.appendChild(link('https://groups.google.com/d/topic/seqfan/vGfMma6DkDk', '[SeqFan] A new visualization tool for OEIS sequences'));
  body.appendChild(threadLink);

  body.append(
    section('How it was built', 'about-build'),
    PARA('This site was written with substantial AI assistance from Anthropic\'s Claude, specifically the Fable 5, Sonnet 5 and Opus 5 models, which produced most of the code and much of the analysis under direction.'),
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

  const feedback = document.createElement('p');
  feedback.className = 'about-feedback';
  feedback.appendChild(buildFeedbackLink('about-feedback-link'));
  body.appendChild(feedback);

  // One measure for the whole page: per-element max-width in `ch` units
  // misaligns, because a ch is relative to the element's own font size and the
  // heading is twice the body size.
  const inner = document.createElement('div');
  inner.className = 'about-inner';
  inner.append(nav, h1, who, whyName, body);
  el.append(inner);
  return el;
}
