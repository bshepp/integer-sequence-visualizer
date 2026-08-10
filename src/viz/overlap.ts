import type { Pt } from './pathTransform';
import { minMax } from './mathUtils';

/**
 * How often each edge of a path is re-traversed.
 *
 * A cumulative walk can tread the same ground repeatedly, and the renderer
 * throws that away twice over: the stacked strokes are indistinguishable from
 * a single one, and because each segment is stroked separately with its own
 * colour, the last visit paints over every earlier one. So on a heavily
 * retraced path the spectrum does not merely omit information, it misreports
 * it - what you see is the most recent visit presented as the only one.
 * A000002 as a turtle walk at 90 degrees, mod 4, lives on a grid and does this
 * constantly.
 *
 * Coordinates are quantised before comparison. Headings accumulate through
 * repeated cos/sin, so a walk that returns to "the same" lattice point arrives
 * a few parts in 1e15 away from where it started, and exact equality would
 * find no repeats at all. The tolerance is relative to the path's own extent,
 * which keeps it meaningful whether the walk spans 9 units or 9000.
 *
 * Paths on irrational angles genuinely never retrace, and correctly report a
 * multiplicity of 1 everywhere. This is meant to light up only where there is
 * something to see.
 */

export interface EdgeUse {
  /** How many times this edge is traversed across the whole path. */
  total: number;
  /** Which traversal this segment is, 1-based, in path order. */
  rank: number;
}

/** Quantisation as a fraction of the path's larger dimension. */
const TOLERANCE = 1e-6;

/**
 * Per-segment traversal counts. Result index i describes the segment from
 * pts[i] to pts[i + 1], so the array is one shorter than `pts`.
 */
export function edgeUses(pts: Pt[]): EdgeUse[] {
  const n = pts.length - 1;
  if (n < 1) return [];

  const { lo: minX, hi: maxX } = minMax(pts.map((p) => p.x));
  const { lo: minY, hi: maxY } = minMax(pts.map((p) => p.y));
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const inv = 1 / (span * TOLERANCE);

  // Two passes over ids rather than string keys per edge: a b-file digit walk
  // is 418,487 points, and one string per *point* is affordable where one per
  // *edge* plus a second for the undirected pair is not. Measured at 107ms for
  // that worst case, which is well under what stroking 418k segments costs
  // anyway, and is only paid when the toggle is on.
  const ids = new Map<string, number>();
  const idOf = (p: Pt): number => {
    const k = `${Math.round(p.x * inv)},${Math.round(p.y * inv)}`;
    let id = ids.get(k);
    if (id === undefined) { id = ids.size; ids.set(k, id); }
    return id;
  };
  const pointId = pts.map(idOf);

  // Undirected: an edge walked back the other way is the same ink. Packed as
  // a single number, safe while unique points stay under 2^21 (~2.1M) - far
  // past any path this renders, and the pack is exact below 2^53 regardless.
  const SHIFT = 2 ** 21;
  const edgeKey = (a: number, b: number): number =>
    a < b ? a * SHIFT + b : b * SHIFT + a;

  const totals = new Map<number, number>();
  const keys = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const k = edgeKey(pointId[i]!, pointId[i + 1]!);
    keys[i] = k;
    totals.set(k, (totals.get(k) ?? 0) + 1);
  }

  const seen = new Map<number, number>();
  const out = new Array<EdgeUse>(n);
  for (let i = 0; i < n; i++) {
    const k = keys[i]!;
    const rank = (seen.get(k) ?? 0) + 1;
    seen.set(k, rank);
    out[i] = { total: totals.get(k)!, rank };
  }
  return out;
}

/**
 * Fraction of segments that are re-treading ground the path has already
 * covered: 0 when every edge is walked once, approaching 1 when almost
 * everything is a repeat.
 *
 * This is the number behind the picture, and unlike the rest of the site's
 * statistics it measures the drawing rather than the sequence.
 *
 * It is NOT automatically a discriminator, and the angle decides whether it
 * says anything. Where the turn set contains a half turn, every one of them
 * re-walks the edge just walked, and since a permutation preserves the term
 * multiset that component is identical in the real sequence and in every
 * surrogate. Kolakoski at 90 degrees is exactly this trap: about half its
 * reuse is forced, and the statistic lands inside its own null band. At 120
 * degrees, with no half turn available, the same sequence separates hard -
 * and in the opposite direction to the obvious guess, re-treading far LESS
 * than its shuffles. Compactness and self-avoidance are different properties.
 * See tests/viz/overlap.test.ts, which pins both results.
 */
export function edgeReuse(pts: Pt[]): number {
  const uses = edgeUses(pts);
  if (uses.length === 0) return 0;
  return uses.filter((u) => u.rank > 1).length / uses.length;
}
