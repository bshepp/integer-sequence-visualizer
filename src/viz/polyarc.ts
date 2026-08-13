import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokePath } from './turtle';
import { styleFromParams } from './style';
import { pathTransform, toScreen, nearestIndex } from './pathTransform';

/** Samples per term for a gently bending path. What this view always used. */
const MIN_SEGMENTS = 8;

/**
 * How far one segment is allowed to turn, in degrees, before the path is
 * sampled more finely.
 *
 * Eight samples per term is enough only while a term stays inside about a
 * quarter turn. Past a full turn the samples land more than a circle apart and
 * the polyline stops approximating the curve at all: it traces a star polygon,
 * a different and much larger shape. Measured on a term turning 12.3 circles,
 * against the same term sampled until the shape stopped moving:
 *
 *     8 samples   extent 0.1250      <- what this view used to draw
 *    64 samples          0.0275
 *   256 samples          0.0259
 *   true value           0.0258
 *
 * Five times too big, and pointy where the curve is round. Reported as
 * "geometric shapes at smaller scales" - which is exactly the signature,
 * because a term that bends hard makes a small tight feature and a term that
 * bends gently makes a big smooth one.
 *
 * 15 degrees puts the worst case inside half a percent of the true extent.
 */
const DEG_PER_SEGMENT = 15;

/**
 * Ceiling on total path points, so a long walk stays interactive.
 *
 * Costs nothing in fidelity where it binds. A term's feature is at most 2/|turn|
 * across, so on a 10,000-term walk the tight coils are a thousandth of the
 * drawing's extent - under a pixel on any screen, aliased or not. Fine sampling
 * only shows when there are few enough terms for one to be worth looking at,
 * which is exactly when this budget is nowhere near binding.
 */
const MAX_POINTS = 120_000;

/**
 * Samples per term for this sequence at these settings.
 *
 * Uniform across terms rather than per-term, which keeps the index arithmetic
 * that position() and locate() depend on to a multiplication. A sequence with
 * one wild term therefore samples the gentle ones finely too - wasteful, and
 * cheaper than the prefix-sum table the alternative needs.
 */
export function segmentsFor(
  seq: SequenceView,
  opts: { angle: number; modulus: number; offset: number },
): number {
  let maxDeg = 0;
  for (let i = 0; i < seq.length; i++) {
    const d = Math.abs(arcDegrees(seq.mod(i, opts.modulus), opts.angle, opts.offset));
    if (d > maxDeg) maxDeg = d;
  }
  const wanted = Math.ceil(maxDeg / DEG_PER_SEGMENT);
  const affordable = Math.floor(MAX_POINTS / Math.max(1, seq.length));
  return Math.max(MIN_SEGMENTS, Math.min(wanted, Math.max(MIN_SEGMENTS, affordable)));
}

/**
 * Arc angle per term, in degrees: `angle x (a(n) mod b) + c`.
 *
 * One formula covering two techniques that were previously exclusive.
 *
 *   angle = 1                  gives NCurve's rule exactly, arc = a(n) mod b + c
 *   c = -angle x (b - 1) / 2   gives this view's old "centred residues" mode
 *
 * The multiplier used to be the only control and the offset was a boolean
 * pinned to the centring value, which capped the reachable arc angles at `b`
 * distinct multiples of `angle`. With b limited to 32 that was 32 directions
 * where NCurve reaches 360, so its drawings were not merely hard to match -
 * they were outside the parameter space.
 */
export function arcDegrees(residue: number, angle: number, offset: number): number {
  return angle * residue + offset;
}

/**
 * How far each segment of the sampled path turns, in radians.
 *
 * Precomputed per term rather than asked per segment: the residue costs a
 * bigint modulo, and the renderer would otherwise pay for it eight times over
 * for a number that cannot change within a term.
 */
export function segmentTurns(
  seq: SequenceView,
  opts: { angle: number; modulus: number; offset: number; segments?: number },
): (segment: number) => number {
  const segments = opts.segments ?? MIN_SEGMENTS;
  const perTerm = new Float64Array(seq.length);
  for (let i = 0; i < seq.length; i++) {
    const deg = arcDegrees(seq.mod(i, opts.modulus), opts.angle, opts.offset);
    perTerm[i] = (deg * Math.PI) / 180 / segments;
  }
  // Segment i runs from pts[i-1] to pts[i], and term t owns the `segments`
  // points after the origin, so the first segment belongs to term 0.
  return (i) => perTerm[Math.floor((i - 1) / segments)] ?? 0;
}

export function polyarcPath(
  seq: SequenceView,
  opts: { angle: number; modulus: number; offset: number; segments?: number },
): Array<{ x: number; y: number }> {
  const segments = opts.segments ?? MIN_SEGMENTS;
  const pts = [{ x: 0, y: 0 }];
  let heading = 0;
  let x = 0, y = 0;
  for (let i = 0; i < seq.length; i++) {
    const residue = seq.mod(i, opts.modulus);
    const deltaRad = (arcDegrees(residue, opts.angle, opts.offset) * Math.PI) / 180;
    for (let s = 0; s < segments; s++) {
      heading += deltaRad / segments;
      x += Math.cos(heading) / segments;
      y += Math.sin(heading) / segments;
      pts.push({ x, y });
    }
  }
  return pts;
}

/**
 * The four entry points all need the same four numbers, and the sample count
 * has to be identical across them or the index arithmetic in position() and
 * locate() addresses a path that was drawn differently.
 */
function sampled(seq: SequenceView, params: Params): {
  angle: number; modulus: number; offset: number; segments: number;
} {
  const opts = {
    angle: Number(params.angle),
    modulus: Number(params.modulus),
    offset: Number(params.offset),
  };
  return { ...opts, segments: segmentsFor(seq, opts) };
}

export const polyarcViz: Visualizer = {
  id: 'polyarc',
  name: 'Polyarc curve',
  family: 'trajectory',
  minTerms: 4,
  explain: {
    short: 'An NCurve-style smooth curve, bending by each term mod N.',
    long: 'The technique from the SeqFan thread that prompted this project: each term bends the path by an angle set by its residue, drawn as a smooth arc rather than a hard corner. The arc is angle x (a(n) mod b) + c degrees, which covers the NCurve rule at angle 1 and the centred-residue variant at c = -angle x (b-1)/2. Raising b past a handful of residues is where the organic shapes come from: at b = 360 every whole degree is reachable. It has a limit worth knowing: once b is larger than every term, the residues are the terms and raising it further changes nothing, so A000002 with its 1s and 2s has exactly two distinct settings of b and looks like a broken control. Whether those shapes mean anything is exactly the open question here -- compare against a null and see which features survive.',
  },
  params: [
    // Defaults reproduce the previous centred view exactly: 30 x (r - 3) is
    // 30r - 90, so angle 30 / mod 7 / offset -90 draws what it always drew.
    { kind: 'number', id: 'angle', label: 'Angle x', default: 30, min: 1, max: 120, step: 1 },
    // To 360 rather than 32. NCurve's default is mod 360, and the old cap was
    // what put its drawings out of reach.
    { kind: 'number', id: 'modulus', label: 'Mod b', default: 7, min: 2, max: 360, step: 1 },
    { kind: 'number', id: 'offset', label: '+/- c', default: -90, min: -360, max: 360, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const opts = sampled(seq, params);
    // Two things happen here that used to be one. The path is sampled finely
    // enough to be a curve rather than a star polygon, and what joins the
    // samples is the arc they were always corners of rather than the chord.
    // Both are the same fix from opposite ends: the arcs make the gaps right,
    // and the sampling makes sure there is a curve in the gaps to be right
    // about.
    strokePath(polyarcPath(seq, opts), ctx, size, styleFromParams(params), segmentTurns(seq, opts));
  },
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const opts = sampled(seq, params);
    const pts = polyarcPath(seq, opts);
    // Last sample of term `index`, i.e. where that term finished bending.
    return toScreen(
      pathTransform(pts, size),
      pts[Math.min(pts.length - 1, (index + 1) * opts.segments)]!,
    );
  },
  origin(seq: SequenceView, params: Params, size: Size) {
    const pts = polyarcPath(seq, sampled(seq, params));
    return pts.length ? toScreen(pathTransform(pts, size), pts[0]!) : null;
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const opts = sampled(seq, params);
    const pts = polyarcPath(seq, opts);
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null) return null;
    const index = Math.min(seq.length - 1, Math.max(0, Math.floor((p - 1) / opts.segments)));
    return { kind: 'term' as const, index };
  },
};
