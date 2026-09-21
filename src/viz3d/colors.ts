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

/**
 * Parses whatever CSS colour string strokeColorAt can actually return:
 * `hsl(h, s%, l%)` from spectrum/flat mode, or `#rrggbb`/`#rgb` from
 * blackLine's '#000000' and the theme's muted grey in 'none' mode. Anything
 * else throws, naming the string, rather than falling back to a made-up
 * colour: a fallback here is how a real style bug turns into a silently
 * white vertex instead of a stack trace, which is exactly the failure this
 * function used to produce for both of the non-hsl forms above.
 */
function parseCssColor(css: string): [number, number, number] {
  const hsl = css.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/);
  if (hsl) {
    const h = Number(hsl[1]!);
    const s = Number(hsl[2]!) / 100;
    const l = Number(hsl[3]!) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  const hex6 = css.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) {
    const n = parseInt(hex6[1]!, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const hex3 = css.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    const digits = hex3[1]!;
    const [r, g, b] = [digits[0]!, digits[1]!, digits[2]!].map((d) => parseInt(d + d, 16));
    return [r!, g!, b!];
  }
  throw new Error(`parseCssColor: unrecognised colour string from strokeColorAt: ${css}`);
}
