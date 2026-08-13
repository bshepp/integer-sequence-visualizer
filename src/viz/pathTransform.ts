import type { Size } from './types';
import { minMax } from './mathUtils';

export interface Pt { x: number; y: number; }

export interface PathTransform {
  scale: number;
  ox: number;
  oy: number;
  height: number;
}

const PAD = 0.1;

/**
 * The sequence-space -> screen mapping that strokePath used to compute inline
 * and then throw away. Extracted so a click can be inverted through the exact
 * same numbers the drawing used - anything else would put the marker
 * somewhere the line is not.
 */
export function pathTransform(pts: Pt[], size: Size): PathTransform {
  // Loop-based min/max, never a spread: a 2001-term b-file's digit walk
  // produces 418,487 points, well past V8's ~250k argument limit.
  const { lo: minX, hi: maxX } = minMax(pts.map((p) => p.x));
  const { lo: minY, hi: maxY } = minMax(pts.map((p) => p.y));
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const scale = Math.min((size.width * (1 - 2 * PAD)) / spanX, (size.height * (1 - 2 * PAD)) / spanY);
  return {
    scale,
    ox: (size.width - spanX * scale) / 2 - minX * scale,
    oy: (size.height - spanY * scale) / 2 - minY * scale,
    height: size.height,
  };
}

export function toScreen(t: PathTransform, p: Pt): Pt {
  // Canvas y grows downward; the drawing flips so the path matches maths
  // orientation, and this must flip identically.
  return { x: p.x * t.scale + t.ox, y: t.height - (p.y * t.scale + t.oy) };
}

/**
 * Path units to device pixels, read off the live canvas transform.
 *
 * Picks up the device pixel ratio and the viewport zoom in one number, because
 * both are already in the matrix by the time anything draws. Falls back to 1
 * for a context that cannot answer - jsdom has no getTransform, and the test
 * fake answers every call with undefined, so the result is checked rather than
 * the method's existence.
 */
export function deviceScaleOf(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform?.();
  const s = m ? Math.hypot(m.a, m.b) : NaN;
  return Number.isFinite(s) && s > 0 ? s : 1;
}

export interface ScreenArc {
  cx: number; cy: number; r: number; start: number; end: number; ccw: boolean;
}

/** The full circle canvas silently clamps a longer sweep to. */
const TWO_PI = 2 * Math.PI;

/**
 * How far an arc has to stand off its chord, in *device* pixels, before it is
 * drawn as one.
 *
 * Not a performance compromise. Measured in the browser on a 10,000-term walk
 * with all 80,000 segments curved, timing each render through to rasterisation
 * rather than to the queued commands: 391ms with arcs against 397ms with
 * chords, medians of 15, ranges overlapping. Arcs are free. (An earlier
 * unflushed measurement said 27% slower and was measurement noise; the timer
 * was stopping before the drawing happened.)
 *
 * It is here because the circle through two nearly collinear points is
 * enormous - a hundredth of a radian across a 100px chord puts its centre
 * 10,000px away - and asking the rasteriser for a fragment of that, through an
 * atan2 on coordinates that far out, is a worse way to say "straight line"
 * than a straight line. Below half a pixel of stand-off the two are the same
 * picture anyway.
 *
 * Device pixels, not path units, and that word is the whole of the zoom fix.
 * Judged in path units this decision is made once and then magnified with
 * everything else: a segment written off at 0.2px of stand-off becomes a
 * 3.5px-deep flat facet at 10x zoom, and since stroke width is divided by the
 * zoom to hold its on-screen thickness, nothing hides it. The caller passes
 * the scale from the canvas transform, which carries the zoom and the device
 * pixel ratio together, so the test asks what the reader will actually see.
 */
const VISIBLE_PX = 0.35;

/**
 * The circular arc joining two drawn points, given how far the path turns
 * between them.
 *
 * A path sampled at equal steps with equal turning has vertices that are
 * concyclic - the samples are corners of a regular polygon, and this recovers
 * the circle that polygon was inscribed in. So the arc passes exactly through
 * both sample points: drawing it changes what fills the gap between samples,
 * never where the samples are. Every existing address keeps rendering the same
 * path, and hit-testing, which still measures against the samples, cannot
 * drift away from the line.
 *
 * The sweep is negated on the way in because toScreen flips y: a left turn in
 * sequence space is still a left turn to the eye, but raw canvas angles
 * increase the other way.
 *
 * Returns null where an arc is not the right answer - a straight or nearly
 * straight segment, a repeated point, a bend too slight to see, and a segment
 * turning a full circle or more, where the sample pair no longer determines
 * one circle. Callers draw the chord instead.
 */
export function chordArc(a: Pt, b: Pt, worldTurn: number, deviceScale = 1): ScreenArc | null {
  const phi = -worldTurn;
  // Absolute, and deliberately not scaled: this one guards atan2 against a
  // centre thousands of units away, which is a numerical concern rather than
  // a visual one and does not get more urgent when the reader zooms in.
  if (!Number.isFinite(phi) || Math.abs(phi) < 1e-4 || Math.abs(phi) >= TWO_PI) return null;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;

  const half = phi / 2;
  // Signed: the sign of sin(half) carries which side of the chord the centre
  // falls on, so one expression covers both directions of turn.
  const signed = len / (2 * Math.sin(half));
  const nx = -dy / len, ny = dx / len;
  const cx = (a.x + b.x) / 2 + nx * signed * Math.cos(half);
  const cy = (a.y + b.y) / 2 + ny * signed * Math.cos(half);
  const r = Math.abs(signed);
  // Sagitta: the gap between the arc and its chord at their widest, in path
  // units, scaled up to what the display will actually show.
  const scale = Number.isFinite(deviceScale) && deviceScale > 0 ? deviceScale : 1;
  if (r * (1 - Math.cos(half)) * scale < VISIBLE_PX) return null;

  const start = Math.atan2(a.y - cy, a.x - cx);
  return { cx, cy, r, start, end: start + phi, ccw: phi < 0 };
}

/**
 * Nearest drawn point to a screen coordinate, or null if the cursor is more
 * than maxDist pixels from the path.
 *
 * Distance is measured to the *segment*, not to the vertices. Measuring to
 * vertices makes hit-testing depend on the scale factor, and the scale factor
 * depends on how compact the sequence is: a Kolakoski turtle walk spans about
 * 9 units and so is blown up to ~60px per step, putting the middle of every
 * segment 30px from either end, while its own permutation surrogate sprawls
 * over 13 units, is scaled to ~42px per step, and lands inside a 24px radius.
 * The result was a cursor that reported reliably on the shuffled panel and
 * only intermittently on the real one, which is exactly backwards from what
 * the eye expects: you are pointing at a line, not at its corners.
 *
 * Returns the index of the nearer endpoint of the closest segment, so callers
 * keep receiving a point index.
 *
 * O(n), which is fine for a click and for rAF-throttled hover up to roughly
 * 50k points. Bucket only if a specific view measurably drags.
 */
export function nearestIndex(
  pts: Pt[], t: PathTransform, x: number, y: number, maxDist = 16,
): number | null {
  if (pts.length === 0) return null;
  if (pts.length === 1) {
    const only = toScreen(t, pts[0]!);
    return Math.hypot(only.x - x, only.y - y) <= maxDist ? 0 : null;
  }

  let best = -1, bestD2 = maxDist * maxDist;
  let prev = toScreen(t, pts[0]!);
  for (let i = 1; i < pts.length; i++) {
    const cur = toScreen(t, pts[i]!);
    const dx = cur.x - prev.x, dy = cur.y - prev.y;
    const len2 = dx * dx + dy * dy;
    // Projection of the cursor onto the segment, clamped to its extent so a
    // point beyond either end measures to that end rather than to the
    // infinite line.
    const u = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - prev.x) * dx + (y - prev.y) * dy) / len2));
    const ex = prev.x + u * dx - x, ey = prev.y + u * dy - y;
    const d2 = ex * ex + ey * ey;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = u < 0.5 ? i - 1 : i;
    }
    prev = cur;
  }
  return best === -1 ? null : best;
}
