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
 * Nearest point to a screen coordinate, or null if nothing is within
 * maxDist pixels. O(n) - fine for a click, and fine for rAF-throttled hover
 * up to roughly 50k points. Bucket only if a specific view measurably drags.
 */
export function nearestIndex(
  pts: Pt[], t: PathTransform, x: number, y: number, maxDist = 24,
): number | null {
  let best = -1, bestD2 = maxDist * maxDist;
  for (let i = 0; i < pts.length; i++) {
    const s = toScreen(t, pts[i]!);
    const dx = s.x - x, dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) { bestD2 = d2; best = i; }
  }
  return best === -1 ? null : best;
}
