import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { pathTransform, toScreen, nearestIndex, chordArc } from './pathTransform';
import { edgeUses } from './overlap';
import { applyStyle, strokeColorAt, styleFromParams, DEFAULT_STYLE, type RenderStyle } from './style';

export function turtlePath(seq: SequenceView, angleDeg: number, k: number): Array<{ x: number; y: number }> {
  const pts = [{ x: 0, y: 0 }];
  let heading = 0;
  let x = 0, y = 0;
  for (let i = 0; i < seq.length; i++) {
    heading += (angleDeg * seq.mod(i, k) * Math.PI) / 180;
    x += Math.cos(heading);
    y += Math.sin(heading);
    pts.push({ x, y });
  }
  return pts;
}

export function strokePath(
  pts: Array<{ x: number; y: number }>,
  ctx: CanvasRenderingContext2D,
  size: Size,
  style: RenderStyle = DEFAULT_STYLE,
  /**
   * How far the path turns across segment i, in radians, for views whose
   * samples are corners of a curve rather than the corners of the drawing.
   * Omitted - the turtle walk, the digit walk - and every segment is the
   * straight line it has always been.
   */
  turnAt?: (segment: number) => number,
): void {
  // The bounding-box maths (and its loop-based min/max, which exists because
  // a 2001-term b-file's digit walk produces 418,487 points - past V8's ~250k
  // spread-argument limit) now lives in pathTransform, so locate() can invert
  // exactly the numbers this draws with.
  const t = pathTransform(pts, size);
  applyStyle(ctx, style);

  // Drawn as nested bands rather than one fat stroke. Segments are painted in
  // path order, so giving the first visit the widest stroke and each later one
  // a narrower stroke on the same centreline leaves every visit's colour
  // showing as a band. That fixes the second half of the problem: widening
  // alone would say how often an edge was walked, but the last visit would
  // still paint over the colours of all the earlier ones.
  //
  // Nothing is displaced, so this adds no geometry that is not really there -
  // the line is still exactly where the line is.
  const uses = style.showOverlap ? edgeUses(pts) : null;
  // Past a few bands the widths are too close to tell apart, so deeper visits
  // share the widest stroke. The count stops being readable there; the 3D lift
  // in issue #1 is the version that does not saturate.
  const MAX_BANDS = 4;

  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = strokeColorAt(style, i / Math.max(1, pts.length - 1));
    if (uses) {
      const u = uses[i - 1]!;
      const depth = Math.min(u.total - u.rank, MAX_BANDS - 1);
      ctx.lineWidth = style.lineWidth * (1 + depth);
    }
    const a = toScreen(t, pts[i - 1]!), b = toScreen(t, pts[i]!);
    const curve = turnAt ? chordArc(a, b, turnAt(i)) : null;
    ctx.beginPath();
    if (curve) {
      // moveTo first: arc() would otherwise join from wherever the previous
      // subpath ended, and each segment is its own path here.
      ctx.moveTo(a.x, a.y);
      ctx.arc(curve.cx, curve.cy, curve.r, curve.start, curve.end, curve.ccw);
    } else {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
}

export const turtleViz: Visualizer = {
  id: 'turtle',
  name: 'Turtle walk',
  family: 'trajectory',
  minTerms: 4,
  explain: {
    short: 'A path that turns by an angle set by each term, mod k.',
    long: 'Starts at the origin and, for each term, turns by (angle x term mod k) degrees and steps forward one unit. The path is cumulative, so every term displaces everything drawn after it -- which makes this view extremely sensitive to ordering and a good place to see a null model bite hard. A permutation surrogate of the same sequence typically wanders somewhere completely different.',
  },
  params: [
    { kind: 'number', id: 'angle', label: 'Angle °', default: 90, min: 1, max: 180, step: 1 },
    { kind: 'number', id: 'k', label: 'Mod k', default: 4, min: 2, max: 24, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    strokePath(turtlePath(seq, Number(params.angle), Number(params.k)), ctx, size, styleFromParams(params));
  },
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const pts = turtlePath(seq, Number(params.angle), Number(params.k));
    // turtlePath pushes the origin first, so path point i+1 is term i.
    return toScreen(pathTransform(pts, size), pts[index + 1]!);
  },
  origin(seq: SequenceView, params: Params, size: Size) {
    const pts = turtlePath(seq, Number(params.angle), Number(params.k));
    return pts.length ? toScreen(pathTransform(pts, size), pts[0]!) : null;
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const pts = turtlePath(seq, Number(params.angle), Number(params.k));
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null) return null;
    const index = Math.max(0, p - 1);
    return index < seq.length ? { kind: 'term' as const, index } : null;
  },
};
