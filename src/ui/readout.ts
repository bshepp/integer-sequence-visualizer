import type { SequenceView } from '../sequence/sequence';
import type { Hit } from '../viz/hit';
import { permutationWithMap, type SurrogateType } from '../nullmodel/surrogates';
import { canvasTheme } from '../viz/theme';

/**
 * Human-readable description of what is under the cursor.
 *
 * Terms print via BigInt toString, never toNumber: a term past float64-safe
 * range would otherwise read as a clamped MAX_SAFE_INTEGER, which is exactly
 * the class of silent wrongness this project keeps having to design out.
 */
export function describeHit(hit: Hit, seq: SequenceView): string {
  switch (hit.kind) {
    case 'term':
      return `n = ${hit.index}   a(n) = ${seq.term(hit.index).toString()}`;
    case 'digit': {
      const digits = seq.digits(hit.index);
      const d = digits[hit.digitPos];
      return `n = ${hit.index}   a(n) = ${seq.term(hit.index).toString()}   digit ${hit.digitPos + 1} of ${digits.length}${d === undefined ? '' : ` = ${d}`}`;
    }
    case 'bin': {
      const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toPrecision(4));
      return `${hit.count} value${hit.count === 1 ? '' : 's'} in [${fmt(hit.lo)}, ${fmt(hit.hi)})`;
    }
    case 'lag':
      return `lag ${hit.lag}`;
  }
}

/**
 * Where the term at `realIndex` corresponds to in the surrogate.
 *
 * `traced: true` means the *same term* is at that position - only possible
 * for permutation surrogates, which preserve the value multiset. Difference
 * and matched-random surrogates contain entirely new values, so the only
 * honest correspondence is index-for-index, and the UI must say so rather
 * than implying a term was followed when it was not.
 */
export function correspondingIndex(
  realIndex: number, surrogate: SurrogateType, terms: bigint[], seed: number,
): { index: number; traced: boolean } {
  if (surrogate !== 'permutation') return { index: realIndex, traced: false };
  const { map } = permutationWithMap(terms, seed);
  const index = map[realIndex];
  return index === undefined ? { index: realIndex, traced: false } : { index, traced: true };
}

export function drawMarker(
  ctx: CanvasRenderingContext2D, pt: { x: number; y: number }, color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  // Crosshair ticks either side, so the marker stays findable against a busy
  // multi-hue render where a bare ring can vanish.
  ctx.beginPath();
  ctx.moveTo(pt.x - 12, pt.y); ctx.lineTo(pt.x - 4, pt.y);
  ctx.moveTo(pt.x + 4, pt.y); ctx.lineTo(pt.x + 12, pt.y);
  ctx.stroke();
  ctx.restore();
}

export interface Readout { el: HTMLElement; set(text: string | null): void; }

export function buildReadout(): Readout {
  const el = document.createElement('div');
  el.className = 'readout readout--empty';
  // Polite, not assertive: this updates on every pointer move and must never
  // interrupt a screen reader mid-sentence.
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('role', 'status');
  return {
    el,
    set(text) {
      el.textContent = text ?? '';
      el.classList.toggle('readout--empty', !text);
    },
  };
}

/**
 * A caption drawn over a rendering, with a backing so it survives whatever is
 * underneath.
 *
 * The labels used to sit at the bottom of each panel, where the readout later
 * collided with them; moving them to the top solved that and created this,
 * because a drawing can reach the top edge too - and once zoom exists it can
 * reach anywhere. Neither corner is safe, so the fix is to stop looking for a
 * safe corner and give the text its own ground.
 */
export function drawCanvasLabel(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
): void {
  if (!text) return;
  const theme = canvasTheme();
  ctx.save();
  ctx.font = '12px system-ui';
  ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(text).width;
  // Same translucency as the readout, so the two read as one family and the
  // drawing stays faintly visible behind rather than being blanked out.
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(x - 5, y - 12, w + 10, 17);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.muted;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * The two endpoints of a drawing: a hollow ring where it begins, a solid disc
 * where it ends.
 *
 * Distinguished by shape rather than colour, for two reasons. The spectrum
 * ramp already encodes direction, so a second colour scheme either duplicates
 * it or - as the first version did - contradicts it, putting a cool dot on the
 * warm end of the line. And colour cannot work at all in 'flat' or 'none'
 * mode, which is exactly where knowing the direction matters most.
 *
 * Drawn in the text colour against a halo of the canvas colour, so both read
 * on a black or a white ground and neither competes with the drawing's hue.
 */
export function drawEndMark(
  ctx: CanvasRenderingContext2D, pt: { x: number; y: number }, kind: 'start' | 'end',
): void {
  const r = 6;
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = canvasTheme().bg;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  ctx.stroke();                       // halo first, punching the mark free
  ctx.lineWidth = 2;
  ctx.strokeStyle = canvasTheme().text;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  if (kind === 'end') {
    ctx.fillStyle = canvasTheme().text;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}
