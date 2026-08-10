import { GALLERY, heroEntry } from '../gallery/entries';
import type { GalleryEntry } from '../gallery/types';
import { decodeState } from './urlState';
import { SequenceView, type Sequence } from '../sequence/sequence';
import { getVisualizer } from '../viz/registry';
import { surrogateSequence } from './comparison';
import { canvasTheme, withCanvas } from '../viz/theme';

/** Reserved literal hashes, checked before decodeState so they cannot collide. */
export const GALLERY_HASH = 'gallery';
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
  if (raw === '' || raw === GALLERY_HASH) return 'landing';
  return decodeState(raw) === null ? 'landing' : 'engine';
}

export function shouldShowLanding(hash: string): boolean {
  return routeFor(hash) === 'landing';
}

const VERDICT_LABEL: Record<GalleryEntry['verdict'], string> = {
  real: 'Survives the null',
  artifact: 'Drawn by the layout',
  split: 'Half real, half technique',
  open: 'Not yet measured',
};

/**
 * Renders an entry into a canvas at the given size.
 *
 * A live render, not a stored image: a screenshot would eventually assert
 * something the code no longer produces, which is precisely the drift the
 * verdict tests exist to prevent.
 */
export function paintEntry(entry: GalleryEntry, canvas: HTMLCanvasElement, w: number, h: number): void {
  // Drawings are black-backed everywhere, page chrome follows the theme. A
  // light-mode visitor gets a light page with dark plates in it, which is the
  // arrangement a printed paper uses and keeps every image on the site looking
  // the same to everybody.
  withCanvas('black', () => paintEntryInner(entry, canvas, w, h));
}

function paintEntryInner(entry: GalleryEntry, canvas: HTMLCanvasElement, w: number, h: number): void {
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
  onPick(entry: GalleryEntry): void;
  onAbout(): void;
  /** See AboutOptions.themeToggle - this page hides the engine's copy too. */
  themeToggle?: HTMLElement;
}

export function buildLanding(opts: LandingOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'landing';

  const hero = heroEntry();

  const h1 = document.createElement('h1');
  h1.className = 'landing-title';
  h1.textContent = 'Is that pattern real?';

  const lede = document.createElement('p');
  lede.className = 'landing-lede';
  lede.textContent =
    'Integer sequences make beautiful pictures. Every pattern you see is really there; the question is whether it belongs to the sequence or to the way it is drawn. This tool renders both at once - your sequence, and a null model built from the same numbers - so you can tell which.';

  // The origin credit belongs on the first page a visitor sees, not three
  // clicks away on About. "Prompted by" rather than "based on" because that is
  // what is true: NCurve asked the question this site tries to answer, and one
  // of the nine views here is drawn in its style. Overstating the debt would
  // read as implying George had a hand in the rest of it.
  const credit = document.createElement('p');
  credit.className = 'landing-credit';
  credit.append('Prompted by ');
  const ncurve = document.createElement('a');
  ncurve.href = 'https://openprocessing.org/@GeorgeWhaleResearch/2986029';
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
  heroButton.addEventListener('click', () => opts.onPick(hero));
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
  heroFigure.append(heroButton, heroCaption);

  const heroBody = document.createElement('p');
  heroBody.className = 'landing-hero-body';
  heroBody.textContent = hero.body;

  const actions = document.createElement('div');
  actions.className = 'landing-actions';
  const open = document.createElement('button');
  open.className = 'landing-open';
  open.type = 'button';
  open.textContent = 'Open the full engine →';
  open.addEventListener('click', () => opts.onOpen());
  const about = document.createElement('button');
  about.className = 'landing-about';
  about.type = 'button';
  about.textContent = 'About & citations';
  about.addEventListener('click', () => opts.onAbout());
  actions.append(open, about);

  const stripLabel = document.createElement('h2');
  stripLabel.className = 'landing-strip-label';
  stripLabel.textContent = 'More examples: click any to open it in the engine';

  const strip = document.createElement('div');
  strip.className = 'gallery-strip';
  for (const entry of GALLERY.slice(1)) {
    const btn = document.createElement('button');
    btn.className = 'gallery-thumb';
    btn.type = 'button';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'gallery-thumb-label';
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
  el.append(h1, lede, credit, heroFigure, heroBody, actions, stripLabel, strip, attribution);
  requestAnimationFrame(() => paintEntry(hero, heroCanvas, 760, 340));
  return el;
}
