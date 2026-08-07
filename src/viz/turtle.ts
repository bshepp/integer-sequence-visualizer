import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { minMax } from './mathUtils';

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
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  // Math.min/max(...array) spreads every element as a call argument; a
  // digit-walk/turtle path from a large loaded sequence can have hundreds of
  // thousands of points (measured: a 2001-term b-file's 2D digit walk
  // produces 418,487), well past V8's ~250k argument-count limit — this
  // threw `RangeError: Maximum call stack size exceeded` and left a blank
  // canvas with a red error banner three clicks from the landing page.
  const { lo: minX, hi: maxX } = minMax(xs);
  const { lo: minY, hi: maxY } = minMax(ys);
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const pad = 0.1;
  const scale = Math.min((size.width * (1 - 2 * pad)) / spanX, (size.height * (1 - 2 * pad)) / spanY);
  const ox = (size.width - spanX * scale) / 2 - minX * scale;
  const oy = (size.height - spanY * scale) / 2 - minY * scale;
  ctx.lineWidth = 1.25;
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = `hsl(${(i / pts.length) * 300}, 70%, 60%)`;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1]!.x * scale + ox, size.height - (pts[i - 1]!.y * scale + oy));
    ctx.lineTo(pts[i]!.x * scale + ox, size.height - (pts[i]!.y * scale + oy));
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
};
