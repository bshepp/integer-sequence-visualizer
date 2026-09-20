// src/viz3d/budget.ts
import type { SequenceView } from '../sequence/sequence';
import type { Params } from '../viz/types';
import { segmentsFor } from '../viz/polyarc';
import { digitWalkOwners } from '../viz/digitWalk';

/**
 * The largest vertex count measured comfortable at build+upload cost - see
 * docs/3d-measurements.md, measured on an NVIDIA GeForce GTX 1650 SUPER
 * (ANGLE, Direct3D11). 1,000,000 vertices cost 65ms to build and upload;
 * 2,000,000 cost 244ms, a visible stall; 5,000,000 cost 606ms, unusable.
 *
 * This is a fact about one GPU on one machine, not a law about all of them,
 * which is why `overBudget` below warns rather than forbids.
 */
export const MEASURED_CEILING = 1_000_000;

export function overBudget(vertices: number): boolean {
  return vertices > MEASURED_CEILING;
}

/**
 * The vertex count `geometryFor` will produce for ONE object in this view,
 * without doing any of the path-building work itself - cheap enough to check
 * before committing to a build. That is the whole reason this exists apart
 * from `geometryFor`: the route's ceiling gate has to know the cost *before*
 * calling `geometryFor`, not after (see route.ts's rebuild), so a 100,000-term
 * digit walk can be refused rather than built and then complained about.
 *
 * Mirrors geometryFor's own per-view vertex counts exactly - pinned against
 * real geometry, for all three views, in tests/viz3d/budget.test.ts:
 * - turtle: one vertex per term, plus the origin.
 * - polyarc: `segmentsFor` vertices per term, plus the origin.
 * - digit walk: one vertex per digit (`digitWalkOwners`), plus the origin.
 *
 * This counts a single object. When the null model is on, the route must
 * double it itself - the null model draws the same view at the same term
 * count, so its cost is identical, but doubling is the caller's job because
 * only the caller knows whether the null model is on.
 */
export function estimatedVertices(vizId: string, seq: SequenceView, params: Params): number {
  if (vizId === 'turtle') return seq.length + 1;
  if (vizId === 'polyarc') {
    const opts = { angle: Number(params.angle), modulus: Number(params.modulus), offset: Number(params.offset) };
    return seq.length * segmentsFor(seq, opts) + 1;
  }
  if (vizId === 'digitwalk') {
    return digitWalkOwners(seq, Number(params.base)).length + 1;
  }
  return 0;
}
