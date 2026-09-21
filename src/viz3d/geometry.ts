import type { SequenceView } from '../sequence/sequence';
import type { Params } from '../viz/types';
import { turtlePath } from '../viz/turtle';
import { polyarcPath, segmentsFor, handOf } from '../viz/polyarc';
import { digitWalkPath, digitWalkOwners } from '../viz/digitWalk';
import { liftPath, type LiftOptions } from './lift';
import type { Geometry3D } from './types';

/** The views whose drawing is a cumulative path, so an index-lift means something. */
export const SUPPORTED_3D = ['turtle', 'polyarc', 'digitwalk'] as const;

/**
 * The 3D geometry for a view, or null where lifting would be meaningless.
 *
 * Every branch calls the same path function the 2D view calls, so the object
 * cannot drift from the drawing it claims to be a lift of. The term map differs
 * per view only because their vertex densities differ: one vertex per term for
 * the turtle, `segments` per term for the polyarc, one per digit for the digit
 * walk. Vertex 0 is the origin in all three and belongs to term 0.
 */
export function geometryFor(
  vizId: string,
  seq: SequenceView,
  params: Params,
  lift: LiftOptions,
): Geometry3D | null {
  if (vizId === 'turtle') {
    const path = turtlePath(seq, Number(params.angle), Number(params.k));
    return liftPath(path, (i) => Math.max(0, i - 1), lift);
  }

  if (vizId === 'polyarc') {
    const opts = {
      angle: Number(params.angle),
      modulus: Number(params.modulus),
      offset: Number(params.offset),
      hand: handOf(params),
    };
    const segments = segmentsFor(seq, opts);
    const path = polyarcPath(seq, { ...opts, segments });
    return liftPath(path, (i) => Math.min(seq.length - 1, Math.max(0, Math.floor((i - 1) / segments))), lift);
  }

  if (vizId === 'digitwalk') {
    const base = Number(params.base);
    const path = digitWalkPath(seq, base);
    const owners = digitWalkOwners(seq, base);
    return liftPath(path, (i) => owners[Math.max(0, i - 1)]?.index ?? 0, lift);
  }

  return null;
}
