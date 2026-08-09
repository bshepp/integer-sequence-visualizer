import type { Params, ParamValue } from './types';
import { canvasTheme } from './theme';

export type ColorMode = 'spectrum' | 'flat' | 'none';

export interface RenderStyle {
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  colorMode: ColorMode;
  /** Hue in degrees at the start of the path. */
  hueStart: number;
  /** Hue in degrees at the end of the path. */
  hueEnd: number;
}

export const DEFAULT_STYLE: RenderStyle = {
  // Deliberately fine: a hairline shows path structure that a fatter stroke
  // fills in. Adjustable up to 12 for presentation renders.
  lineWidth: 0.75,
  lineJoin: 'miter',
  lineCap: 'butt',
  colorMode: 'spectrum',
  hueStart: 0,
  hueEnd: 300,
};

const JOINS: CanvasLineJoin[] = ['miter', 'round', 'bevel'];
const CAPS: CanvasLineCap[] = ['butt', 'round', 'square'];
const MODES: ColorMode[] = ['spectrum', 'flat', 'none'];

const MAX_WIDTH = 12;
const NEUTRAL = '#9aa0aa';

// Style rides in `params` under reserved keys rather than as a new render()
// argument. That is the pattern this codebase already uses for
// logScaleOverride and histogramDomainLo/Hi, it needs no signature change
// across nine visualizers and their tests, and visualizers that do not care
// simply never read the keys.
export function styleToParams(s: RenderStyle): Params {
  return {
    styleLineWidth: s.lineWidth,
    styleLineJoin: s.lineJoin,
    styleLineCap: s.lineCap,
    styleColorMode: s.colorMode,
    styleHueStart: s.hueStart,
    styleHueEnd: s.hueEnd,
  };
}

const num = (v: ParamValue | undefined, fallback: number, lo: number, hi: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

const pick = <T extends string>(v: ParamValue | undefined, allowed: T[], fallback: T): T =>
  typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;

export function styleFromParams(p: Params): RenderStyle {
  return {
    lineWidth: num(p.styleLineWidth, DEFAULT_STYLE.lineWidth, 0.25, MAX_WIDTH),
    lineJoin: pick(p.styleLineJoin, JOINS, DEFAULT_STYLE.lineJoin),
    lineCap: pick(p.styleLineCap, CAPS, DEFAULT_STYLE.lineCap),
    colorMode: pick(p.styleColorMode, MODES, DEFAULT_STYLE.colorMode),
    hueStart: num(p.styleHueStart, DEFAULT_STYLE.hueStart, 0, 360),
    hueEnd: num(p.styleHueEnd, DEFAULT_STYLE.hueEnd, 0, 360),
  };
}

/**
 * Colour at position `t` (0..1) along whatever is being drawn.
 *
 * 'none' deliberately returns a neutral grey rather than a hue: the point of
 * that mode is to remove colour as a variable entirely, so that any structure
 * still visible cannot be an artifact of the palette.
 */
export function strokeColorAt(s: RenderStyle, t: number): string {
  if (s.colorMode === 'none') return canvasTheme().muted;
  // Lightness follows the theme. 60% reads well against a dark canvas and
  // washes out to pastel on a light one, so the light theme darkens the ramp
  // instead of inheriting a palette tuned for the opposite background.
  const l = canvasTheme().spectrumLightness;
  if (s.colorMode === 'flat') return `hsl(${s.hueStart}, 70%, ${l}%)`;
  const clamped = Math.min(1, Math.max(0, t));
  return `hsl(${s.hueStart + (s.hueEnd - s.hueStart) * clamped}, 70%, ${l}%)`;
}

export function applyStyle(ctx: CanvasRenderingContext2D, s: RenderStyle): void {
  ctx.lineWidth = s.lineWidth;
  ctx.lineJoin = s.lineJoin;
  ctx.lineCap = s.lineCap;
}
