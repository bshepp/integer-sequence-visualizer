import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { pathTransform, toScreen, nearestIndex } from './pathTransform';

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
): void {
  // The bounding-box maths (and its loop-based min/max, which exists because
  // a 2001-term b-file's digit walk produces 418,487 points — past V8's ~250k
  // spread-argument limit) now lives in pathTransform, so locate() can invert
  // exactly the numbers this draws with.
  const t = pathTransform(pts, size);
  ctx.lineWidth = 1.25;
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = `hsl(${(i / pts.length) * 300}, 70%, 60%)`;
    const a = toScreen(t, pts[i - 1]!), b = toScreen(t, pts[i]!);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
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
    strokePath(turtlePath(seq, Number(params.angle), Number(params.k)), ctx, size);
  },
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const pts = turtlePath(seq, Number(params.angle), Number(params.k));
    // turtlePath pushes the origin first, so path point i+1 is term i.
    return toScreen(pathTransform(pts, size), pts[index + 1]!);
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const pts = turtlePath(seq, Number(params.angle), Number(params.k));
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null) return null;
    const index = Math.max(0, p - 1);
    return index < seq.length ? { kind: 'term' as const, index } : null;
  },
};
