import { strokeColorAt, DEFAULT_STYLE, type RenderStyle } from '../viz/style';
import type { Geometry3D } from './types';

/**
 * Per-vertex RGB, from the same ramp the 2D views use.
 *
 * Going through strokeColorAt rather than reimplementing the ramp is what makes
 * the canonical zero true of colour as well as shape: seen from straight down,
 * the object should be the flat drawing in every respect.
 */
export function colorsFor(g: Geometry3D, terms: number, style: RenderStyle = DEFAULT_STYLE): Uint8Array {
  const out = new Uint8Array(g.termOf.length * 3);
  const last = Math.max(1, terms - 1);
  const cache = new Map<number, [number, number, number]>();
  for (let i = 0; i < g.termOf.length; i++) {
    const term = g.termOf[i]!;
    let rgb = cache.get(term);
    if (!rgb) {
      rgb = parseCssColor(strokeColorAt(style, term / last));
      cache.set(term, rgb);
    }
    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }
  return out;
}

/** hsl(h, s%, l%) - the only form strokeColorAt returns - to bytes. */
function parseCssColor(css: string): [number, number, number] {
  const parts = css.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return [255, 255, 255];
  const [h, s, l] = [Number(parts[0]), Number(parts[1]) / 100, Number(parts[2]) / 100];
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
