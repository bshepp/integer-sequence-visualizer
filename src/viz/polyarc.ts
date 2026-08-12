import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokePath } from './turtle';
import { styleFromParams } from './style';
import { pathTransform, toScreen, nearestIndex } from './pathTransform';

/** Arc segments drawn per term. Each term therefore owns 8 path points. */
const SEGMENTS = 8;

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

export function polyarcPath(
  seq: SequenceView,
  opts: { angle: number; modulus: number; offset: number; segments?: number },
): Array<{ x: number; y: number }> {
  const segments = opts.segments ?? SEGMENTS;
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
    strokePath(
      polyarcPath(seq, {
        angle: Number(params.angle),
        modulus: Number(params.modulus),
        offset: Number(params.offset),
      }),
      ctx,
      size,
      styleFromParams(params),
    );
  },
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const pts = polyarcPath(seq, {
      angle: Number(params.angle), modulus: Number(params.modulus),
      offset: Number(params.offset),
    });
    // Last segment of term `index`, i.e. where that term finished bending.
    return toScreen(pathTransform(pts, size), pts[Math.min(pts.length - 1, (index + 1) * SEGMENTS)]!);
  },
  origin(seq: SequenceView, params: Params, size: Size) {
    const pts = polyarcPath(seq, {
      angle: Number(params.angle), modulus: Number(params.modulus),
      offset: Number(params.offset),
    });
    return pts.length ? toScreen(pathTransform(pts, size), pts[0]!) : null;
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const pts = polyarcPath(seq, {
      angle: Number(params.angle), modulus: Number(params.modulus),
      offset: Number(params.offset),
    });
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null) return null;
    const index = Math.min(seq.length - 1, Math.max(0, Math.floor((p - 1) / SEGMENTS)));
    return { kind: 'term' as const, index };
  },
};
