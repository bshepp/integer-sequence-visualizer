import { GALLERY, heroEntry } from '../gallery/entries';
import type { GalleryEntry } from '../gallery/types';
import { decodeState } from './urlState';
import { SequenceView, type Sequence } from '../sequence/sequence';
import { getVisualizer } from '../viz/registry';
import { surrogateSequence } from './comparison';

/** Reserved literal hash, checked before decodeState so it can never collide. */
export const GALLERY_HASH = 'gallery';

export function shouldShowLanding(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '' || raw === GALLERY_HASH) return true;
  // An undecodable hash shows the landing rather than dropping the visitor
  // into an engine with no sequence and no explanation of why.
  return decodeState(raw) === null;
}

const VERDICT_LABEL: Record<GalleryEntry['verdict'], string> = {
  real: 'Survives the null',
  artifact: 'Rendering artifact',
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
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // jsdom / unsupported
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#14161a';
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

  if (entry.state.mode === 'side') {
    const half = w / 2 - 1;
    paint(entry.sequence, 0, half);
    ctx.strokeStyle = '#333';
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    paint(surrogateSequence(entry.sequence, entry.state.surrogate, entry.state.seed), w / 2 + 1, half);
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '11px system-ui';
    ctx.fillText('real', 8, h - 8);
    ctx.fillText(`${entry.state.surrogate} null`, w / 2 + 9, h - 8);
  } else {
    paint(entry.sequence, 0, w);
  }
}

export interface LandingOptions {
  onOpen(): void;
  onPick(entry: GalleryEntry): void;
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
    'Integer sequences make beautiful pictures. Some of that beauty is in the numbers, and some of it is drawn by the technique. This tool shows you both at once — the sequence, and a null model built from it — so you can tell which is which.';

  const heroFigure = document.createElement('figure');
  heroFigure.className = 'landing-hero';
  const heroCanvas = document.createElement('canvas');
  heroCanvas.setAttribute('role', 'img');
  heroCanvas.setAttribute('aria-label', `${hero.title}. ${hero.caption}`);
  const heroCaption = document.createElement('figcaption');
  heroCaption.className = 'landing-hero-caption';
  const verdictTag = document.createElement('span');
  verdictTag.className = `verdict verdict--${hero.verdict}`;
  verdictTag.textContent = VERDICT_LABEL[hero.verdict];
  heroCaption.append(verdictTag, document.createTextNode(` ${hero.caption}`));
  heroFigure.append(heroCanvas, heroCaption);

  const heroBody = document.createElement('p');
  heroBody.className = 'landing-hero-body';
  heroBody.textContent = hero.body;

  const open = document.createElement('button');
  open.className = 'landing-open';
  open.type = 'button';
  open.textContent = 'Open the full engine →';
  open.addEventListener('click', () => opts.onOpen());

  const stripLabel = document.createElement('h2');
  stripLabel.className = 'landing-strip-label';
  stripLabel.textContent = 'More examples — click any to open it in the engine';

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

  el.append(h1, lede, heroFigure, heroBody, open, stripLabel, strip, attribution);
  requestAnimationFrame(() => paintEntry(hero, heroCanvas, 760, 340));
  return el;
}
