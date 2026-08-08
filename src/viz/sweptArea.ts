import type { Pt } from './pathTransform';

/**
 * Area covered by stroking `pts` with the given width, join and cap.
 *
 * Computed analytically rather than by counting pixels, so it is exact,
 * deterministic and runs in CI without a canvas. This is the quantity the
 * line-shape experiment compares: if changing the join changes the swept area
 * by less than the null model moves it, then the shape cannot be responsible
 * for any structure you think you see.
 *
 * Overlap where the stroke crosses itself is not subtracted — the measure is
 * additive swept area, and the comparison is like-for-like across shapes on
 * the same path, so the bias is identical in every arm of the experiment.
 */
export function sweptArea(pts: Pt[], width: number, join: CanvasLineJoin, cap: CanvasLineCap): number {
  if (pts.length < 2 || width <= 0) return 0;
  const w = width, r = w / 2;

  const seg: Array<{ len: number; ux: number; uy: number }> = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x, dy = pts[i]!.y - pts[i - 1]!.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue; // duplicate point: contributes nothing, and would divide by zero
    seg.push({ len, ux: dx / len, uy: dy / len });
  }
  if (seg.length === 0) return 0;

  let area = 0;
  for (const s of seg) area += s.len * w;

  // Joins: the wedge between consecutive segments, outside the rectangles.
  for (let i = 1; i < seg.length; i++) {
    const a = seg[i - 1]!, b = seg[i]!;
    const dot = Math.min(1, Math.max(-1, a.ux * b.ux + a.uy * b.uy));
    const turn = Math.acos(dot); // exterior angle: 0 = straight, π = doubling back
    if (turn === 0) continue;
    const half = turn / 2;
    if (join === 'round') {
      area += half * r * r;                        // circular sector of angle `turn`
    } else if (join === 'bevel') {
      area += r * r * Math.sin(half) * Math.cos(half); // triangle between the two offsets
    } else {
      // miter: out to the miter point at r*sec(half). Canvas falls back to a
      // bevel once that exceeds the miter limit (default 10).
      const cosHalf = Math.cos(half);
      const miterRatio = cosHalf === 0 ? Infinity : 1 / cosHalf;
      area += miterRatio > 10
        ? r * r * Math.sin(half) * Math.cos(half)
        : r * r * Math.tan(half);
    }
  }

  // Caps at each end of the polyline. A square cap extends the stroke by r
  // beyond the endpoint across the full width w, so each adds r*w = w^2/2 and
  // the pair adds w^2. A round cap is a half-disc of radius r, so the pair
  // adds one whole disc.
  if (cap === 'round') area += Math.PI * r * r;
  else if (cap === 'square') area += 2 * r * w;

  return area;
}
