import { EXAMPLES, heroEntry, workedEntries, threadEntries } from '../examples/entries';
import type { ExampleEntry } from '../examples/types';
import { decodeState } from './urlState';
import { SequenceView, type Sequence } from '../sequence/sequence';
import { getVisualizer } from '../viz/registry';
import { surrogateSequence } from './comparison';
import { canvasTheme, withCanvas } from '../viz/theme';
import { buildFeedbackLink } from './feedbackLink';
import { NCURVE_URL } from './links';
import { primes } from '../examples/sequences';

/** Reserved literal hashes, checked before decodeState so they cannot collide. */
export const EXAMPLES_HASH = 'examples';
export const ABOUT_HASH = 'about';

export type Route = 'landing' | 'about' | 'engine';

/**
 * Three pages, one hash. Reserved words are matched first so an encoded state
 * can never be mistaken for a page, and anything undecodable falls back to the
 * landing rather than dropping the visitor into an engine with no sequence and
 * no explanation of why.
 */
export function routeFor(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === ABOUT_HASH) return 'about';
  if (raw === '' || raw === EXAMPLES_HASH) return 'landing';
  return decodeState(raw) === null ? 'landing' : 'engine';
}

export function shouldShowLanding(hash: string): boolean {
  return routeFor(hash) === 'landing';
}

/**
 * The site's headline, in the one place all five copies of it come from.
 *
 * It used to read "Is that pattern real?", which promised something no null
 * model on this site can deliver. A null reports whether one named number is
 * reproduced by one named scrambling; it returns no verdict on whether a
 * pattern is real, meaningful, or characteristic of the sequence - and the
 * worked examples say so outright, so the headline was contradicting the
 * gallery beneath it. Asking which part of the picture is the sequence is a
 * question the apparatus can actually answer something about.
 *
 * The <title>, og:title and twitter:title in index.html carry it too and
 * cannot import it; tests/ui/copy.test.ts reads the file and pins all three.
 */
export const HEADLINE = 'Which part of the picture is the sequence?';

/**
 * Character budget for the line under the hero's term-count buttons.
 *
 * That box reserves two lines of height so the page does not resize when the
 * message changes, and two lines at its measure is about this many characters.
 * Exceeding it pushes everything below the hero down and back up on every
 * button press, which is what it used to do. Enforced in landing.test.ts,
 * because the copy is what changes and the CSS is not.
 */
export const NOTE_MAX_CHARS = 176;

/**
 * Named for the rung reached, not for a verdict on reality.
 *
 * "Survives the null" was the old label on most of these, and it claimed more
 * than any null model can deliver: a null answers whether one named scrambling
 * reproduces one named number, which is not the same as whether a pattern is
 * real, meaningful, or characteristic of the sequence.
 */
const VERDICT_LABEL: Record<ExampleEntry['verdict'], string> = {
  // "every null" invited the reading "every null model there could be", which
  // is infinitely many and not what was run. Three were.
  'survives-steps': 'Survives all three nulls',
  'explained-by-steps': 'Explained by its steps',
  'explained-by-trend': 'Explained by its trend',
  untestable: 'No null can test it',
  foregone: 'Rejection was guaranteed',
  open: 'Not yet measured',
};

/**
 * Renders an entry into a canvas at the given size.
 *
 * A live render, not a stored image: a screenshot would eventually assert
 * something the code no longer produces, which is precisely the drift the
 * verdict tests exist to prevent.
 */
export function paintEntry(entry: ExampleEntry, canvas: HTMLCanvasElement, w: number, h: number): void {
  // Drawings are black-backed everywhere, page chrome follows the theme. A
  // light-mode visitor gets a light page with dark plates in it, which is the
  // arrangement a printed paper uses and keeps every image on the site looking
  // the same to everybody.
  withCanvas('black', () => paintEntryInner(entry, canvas, w, h));
}

function paintEntryInner(entry: ExampleEntry, canvas: HTMLCanvasElement, w: number, h: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // jsdom / unsupported
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = canvasTheme().bg;
  ctx.fillRect(0, 0, w, h);

  const viz = getVisualizer(entry.state.vizId);
  const paint = (seq: Sequence, x: number, panelW: number) => {
    ctx.save();
    ctx.translate(x, 0);
    ctx.beginPath();
    ctx.rect(0, 0, panelW, h);
    ctx.clip();
    try {
      viz.render(new SequenceView(seq), entry.state.params, ctx, { width: panelW, height: h });
    } catch {
      // A single bad entry degrades to an empty panel, never a blank landing.
    }
    ctx.restore();
  };

  // Same identity line the engine draws, at the top for the same reason: these
  // images get screenshotted and shared, and a picture of a sequence that does
  // not say which sequence - or how many terms of it - is not much use.
  const who = entry.sequence.aNumber ?? entry.sequence.name;
  const identity = `${who} · ${entry.sequence.terms.length.toLocaleString()} terms`;
  // Backed for the same reason the engine's are: the drawing reaches the top
  // edge of these thumbnails routinely.
  const caption = (text: string, x: number) => {
    ctx.save();
    ctx.font = '11px system-ui';
    const w = ctx.measureText(text).width;
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = canvasTheme().bg;
    ctx.fillRect(x - 4, 3, w + 8, 15);
    ctx.globalAlpha = 1;
    ctx.fillStyle = canvasTheme().muted;
    ctx.fillText(text, x, 14);
    ctx.restore();
  };

  if (entry.state.mode === 'side') {
    const half = w / 2 - 1;
    paint(entry.sequence, 0, half);
    ctx.strokeStyle = canvasTheme().grid;
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    paint(surrogateSequence(entry.sequence, entry.state.surrogate, entry.state.seed), w / 2 + 1, half);
    caption(`real - ${identity}`, 8);
    caption(`${entry.state.surrogate} null`, w / 2 + 9);
  } else {
    paint(entry.sequence, 0, w);
    caption(identity, 8);
  }
}

export interface LandingOptions {
  onOpen(): void;
  onPick(entry: ExampleEntry): void;
  onAbout(): void;
  /** See AboutOptions.themeToggle - this page hides the engine's copy too. */
  themeToggle?: HTMLElement;
}

export function buildLanding(opts: LandingOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'landing';

  const hero = heroEntry();

  /**
   * Term counts the hero can be redrawn at, from the landing page itself.
   *
   * The engine doing its job in one click, rather than something you have to
   * navigate to another page and operate controls to see. The counts are also
   * the honest answer to "wouldn't more terms be better": they would not, and
   * this is the cheapest possible way to find that out. A longer walk has a
   * bigger bounding box, so the drawing is fitted smaller to fit the frame and
   * every coil shrinks - 10,000 primes carry less visible detail than 58, not
   * more.
   *
   * Generated rather than bundled: primes(10000) runs in 5ms and ends at
   * 104,729, exactly where the OEIS b-file ends, so this is the same data
   * rather than a stand-in. Bundling it would have cost about 60KB.
   */
  const HERO_COUNTS = [hero.sequence.terms.length, 500, 2000, 10000];
  const heroCache = new Map<number, ExampleEntry>();
  const heroAt = (n: number): ExampleEntry => {
    let e = heroCache.get(n);
    if (!e) {
      e = n === hero.sequence.terms.length
        ? hero
        : { ...hero, sequence: { ...hero.sequence, terms: primes(n) } };
      heroCache.set(n, e);
    }
    return e;
  };
  let shownCount = HERO_COUNTS[0]!;

  const h1 = document.createElement('h1');
  h1.className = 'landing-title';
  h1.textContent = HEADLINE;

  const lede = document.createElement('p');
  lede.className = 'landing-lede';
  // Two sentences, which is what a deck is. It ran to five lines centred, and
  // the rule this page follows - set out on the hero write-up below - is that
  // centred text stops being readable at about three, because the ragged left
  // edge makes the eye hunt for each line start. It had already been cut from
  // eight to six on that reasoning; stopping at six was applying the rule until
  // it felt better rather than until it was satisfied.
  //
  // What went was the mechanism and the caveat, and neither is lost. The
  // mechanism is the hero image directly below - two labelled panels, the real
  // sequence beside its null - which explains it better than a sentence about
  // it can. The caveat that a measurement is narrower than what you can see is
  // still made by the hero caption, by the write-up, and by About's method
  // section, and the headline no longer overclaims in the way that made it
  // necessary here.
  lede.textContent =
    'Integer sequences make beautiful pictures. Every pattern you see is really there; the question is which of them belong to the sequence and which to the way it is drawn.';

  // The origin credit belongs on the first page a visitor sees, not three
  // clicks away on About. "Prompted by" rather than "based on" because that is
  // what is true: NCurve asked the question this site tries to answer, and one
  // of the nine views here is drawn in its style. Overstating the debt would
  // read as implying George had a hand in the rest of it.
  const credit = document.createElement('p');
  credit.className = 'landing-credit';
  credit.append('Prompted by ');
  const ncurve = document.createElement('a');
  ncurve.href = NCURVE_URL;
  ncurve.target = '_blank';
  ncurve.rel = 'noopener noreferrer';
  ncurve.textContent = 'NCurve';
  credit.appendChild(ncurve);
  credit.append(", George Whale's OEIS curve visualizer, and the question he asked about it on the SeqFan mailing list.");

  const heroFigure = document.createElement('figure');
  heroFigure.className = 'landing-hero';
  // The hero is an image AND a link into the engine, like every other image
  // on this page - clicking the picture you are being pitched on should open
  // that exact view.
  const heroButton = document.createElement('button');
  heroButton.className = 'landing-hero-button';
  heroButton.type = 'button';
  heroButton.setAttribute('aria-label', `Open ${hero.title} in the engine`);
  // openEntry() takes the entry's own sequence, so this opens the engine at the
  // count currently displayed. Handing it the 58-term hero while a 10,000-term
  // drawing was on screen would be the exact mismatch this site keeps hunting.
  heroButton.addEventListener('click', () => opts.onPick(heroAt(shownCount)));
  const heroCanvas = document.createElement('canvas');
  heroCanvas.setAttribute('role', 'img');
  heroCanvas.setAttribute('aria-label', `${hero.title}. ${hero.caption}`);
  heroButton.appendChild(heroCanvas);
  const heroCaption = document.createElement('figcaption');
  heroCaption.className = 'landing-hero-caption';
  const verdictTag = document.createElement('span');
  verdictTag.className = `verdict verdict--${hero.verdict}`;
  verdictTag.textContent = VERDICT_LABEL[hero.verdict];
  heroCaption.append(verdictTag, document.createTextNode(` ${hero.caption}`));

  // Redraws the hero in place. The whole engine runs on this page already -
  // the hero is a live render, not a screenshot - so letting a visitor change
  // one input and watch it redraw costs nothing and is the shortest possible
  // demonstration that the thing works.
  const countRow = document.createElement('div');
  countRow.className = 'hero-counts';
  countRow.setAttribute('role', 'group');
  countRow.setAttribute('aria-label', 'Redraw the hero with this many primes');
  const countLabel = document.createElement('span');
  countLabel.className = 'hero-counts-label';
  countLabel.textContent = 'Draw it with';
  countRow.appendChild(countLabel);

  const heroNote = document.createElement('p');
  heroNote.className = 'hero-note';
  heroNote.setAttribute('role', 'status');

  const countButtons: HTMLButtonElement[] = HERO_COUNTS.map((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hero-count';
    b.textContent = n.toLocaleString();
    b.setAttribute('aria-label', `${n.toLocaleString()} primes`);
    b.addEventListener('click', () => showCount(n));
    countRow.appendChild(b);
    return b;
  });
  const countUnit = document.createElement('span');
  countUnit.className = 'hero-counts-label';
  countUnit.textContent = 'primes';
  countRow.appendChild(countUnit);

  function paintCount(n: number): void {
    const t0 = performance.now();
    paintEntry(heroAt(n), heroCanvas, 760, 340);
    const ms = Math.round(performance.now() - t0);
    // Both messages are kept inside two lines at the note's measure, because
    // the box reserves exactly two: a third line would resize the page every
    // time a count button was pressed. NOTE_MAX_CHARS is the budget, and a test
    // enforces it - the copy is the thing that will drift, not the CSS.
    heroNote.textContent = n === HERO_COUNTS[0]
      ? `${n.toLocaleString()} primes - all the OEIS publishes inline - drawn in ${ms} ms.`
      // Names the count the prose below is about. That prose opens "This is 58
      // primes" and carries measurements taken at 58, so leaving it unqualified
      // under a 10,000-term drawing would be a caption describing the wrong
      // picture - the exact fault this site spends its time pointing out.
      : `${n.toLocaleString()} primes, drawn in ${ms} ms. A longer walk is fitted smaller, `
        + 'so every coil shrinks: detail goes down, not up. '
        + `The write-up below describes the ${HERO_COUNTS[0]!.toLocaleString()}-term drawing.`;
  }

  function showCount(n: number): void {
    shownCount = n;
    countButtons.forEach((b, i) => {
      const on = HERO_COUNTS[i] === n;
      b.classList.toggle('hero-count--on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    heroButton.setAttribute('aria-label',
      `Open ${hero.title}, ${n.toLocaleString()} terms, in the engine`);
    heroCanvas.setAttribute('aria-label',
      `${hero.title}, ${n.toLocaleString()} terms. ${hero.caption}`);
    if (n < 2000) { paintCount(n); return; }
    // The big ones block the main thread for around a second. Two frames: one
    // to show the pressed button and the notice, one to start the render -
    // otherwise the page freezes with no sign it heard the click.
    heroNote.textContent = `Drawing ${n.toLocaleString()} primes...`;
    requestAnimationFrame(() => requestAnimationFrame(() => paintCount(n)));
  }

  heroFigure.append(heroButton, heroCaption, countRow, heroNote);

  const heroBody = document.createElement('p');
  heroBody.className = 'landing-hero-body';
  heroBody.textContent = hero.body;

  const actions = document.createElement('div');
  actions.className = 'landing-actions';
  const open = document.createElement('button');
  open.className = 'landing-open';
  open.type = 'button';
  open.textContent = 'Open the full engine';
  open.addEventListener('click', () => opts.onOpen());
  const about = document.createElement('button');
  about.className = 'landing-about';
  about.type = 'button';
  about.textContent = 'About & citations';
  about.addEventListener('click', () => opts.onAbout());
  actions.append(open, about);

  function buildStrip(entries: ExampleEntry[]): HTMLElement {
    const strip = document.createElement('div');
    strip.className = 'examples-strip';
    for (const entry of entries) {
      const btn = document.createElement('button');
      btn.className = 'example-thumb';
      btn.type = 'button';
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'example-thumb-label';
      const tag = document.createElement('span');
      tag.className = `verdict verdict--${entry.verdict}`;
      tag.textContent = VERDICT_LABEL[entry.verdict];
      label.append(tag, document.createTextNode(` ${entry.title}`));
      btn.append(canvas, label);
      btn.addEventListener('click', () => opts.onPick(entry));
      strip.appendChild(btn);
      // Painted after layout so the canvas has real dimensions.
      requestAnimationFrame(() => paintEntry(entry, canvas, 220, 130));
    }
    return strip;
  }

  const stripLabel = document.createElement('h2');
  stripLabel.className = 'landing-strip-label';
  stripLabel.textContent = 'More worked examples: click any to open it in the engine';

  const strip = buildStrip(workedEntries().slice(1));

  // The second shelf. Kept below the worked one and labelled for what it is:
  // pictures somebody liked, with nothing measured about any of them.
  const threadLabel = document.createElement('h2');
  threadLabel.className = 'landing-strip-label';
  threadLabel.textContent = 'From the SeqFan thread: named, drawn, and never tested';

  const threadNote = document.createElement('p');
  threadNote.className = 'landing-strip-note';
  threadNote.append('Sequences Bill McEachen picked out of ');
  const ncurve2 = document.createElement('a');
  ncurve2.href = NCURVE_URL;
  ncurve2.target = '_blank';
  ncurve2.rel = 'noopener noreferrer';
  ncurve2.textContent = 'NCurve';
  threadNote.append(ncurve2);
  // Kept to three lines. It has to be centred - the shelf below is a wrapping
  // flex row whose left edge moves with how many thumbnails fit, so there is no
  // stable edge to align to - and centred text stops being readable at about
  // three lines. It ran to five.
  threadNote.append(
    ' and named, drawn by his rule: arc = (a(n) mod 360) - 180. Each opens with a '
    + 'null model beside it, and nobody has run one yet - so you can be the first.',
  );

  const threadStrip = buildStrip(threadEntries());

  const attribution = document.createElement('p');
  attribution.className = 'landing-attribution';
  attribution.append('Sequence data from ');
  const link = document.createElement('a');
  link.href = 'https://oeis.org/';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'The On-Line Encyclopedia of Integer Sequences';
  attribution.append(link, '®, © OEIS Foundation Inc., used under ');
  const cc = document.createElement('a');
  cc.href = 'https://creativecommons.org/licenses/by-sa/4.0/';
  cc.target = '_blank';
  cc.rel = 'noopener noreferrer';
  cc.textContent = 'CC BY-SA 4.0';
  attribution.append(cc, '.');

  if (opts.themeToggle) {
    const nav = document.createElement('div');
    nav.className = 'landing-nav';
    nav.appendChild(opts.themeToggle);
    el.appendChild(nav);
  }
  const feedback = buildFeedbackLink('landing-feedback');

  el.append(
    // Actions sit directly under the figure and above the write-up. They used
    // to follow it, which put the way into the site behind thirty-two lines of
    // prose - most visitors would never have reached them. Above the image was
    // the other option and is worse: the picture is what earns the click, and
    // the image is itself a button into the engine, so there is already a call
    // to action above the fold. What was needed was not to bury the buttons,
    // not to promote them.
    h1, lede, credit, heroFigure, actions, heroBody,
    stripLabel, strip,
    threadLabel, threadNote, threadStrip,
    attribution, feedback,
  );
  requestAnimationFrame(() => showCount(HERO_COUNTS[0]!));
  return el;
}
