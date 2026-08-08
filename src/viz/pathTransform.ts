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
