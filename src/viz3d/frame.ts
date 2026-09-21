import type { Geometry3D } from './types';

export interface Framing {
  centre: [number, number, number];
  halfExtent: number;
}

/**
 * The camera framing for the real object alone, or for the real object and
 * the null object considered together.
 *
 * `nullBounds` is translated by `nullOffsetX` before the union is taken, so
 * this matches wherever the null object is actually placed in the scene (see
 * scene.ts's own `nullOffsetX` computation) rather than assuming it sits at
 * the origin. With `nullBounds` absent this reproduces exactly the
 * real-object-only answer this module used to compute inline: the centre and
 * half-extent of `real` alone.
 *
 * Extracted from scene.ts, which cannot be unit-tested (no GPU in the test
 * environment), so the one piece of real arithmetic in the framing decision -
 * union bounds in, a centre and a half-extent out - lives somewhere a test
 * can reach it.
 */
export function framingFor(
  real: Geometry3D['bounds'],
  nullBounds: Geometry3D['bounds'] | null,
  nullOffsetX: number,
): Framing {
  let minX = real.min[0], minY = real.min[1], minZ = real.min[2];
  let maxX = real.max[0], maxY = real.max[1], maxZ = real.max[2];

  if (nullBounds) {
    minX = Math.min(minX, nullBounds.min[0] + nullOffsetX);
    minY = Math.min(minY, nullBounds.min[1]);
    minZ = Math.min(minZ, nullBounds.min[2]);
    maxX = Math.max(maxX, nullBounds.max[0] + nullOffsetX);
    maxY = Math.max(maxY, nullBounds.max[1]);
    maxZ = Math.max(maxZ, nullBounds.max[2]);
  }

  const centre: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const halfExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 || 1;
  return { centre, halfExtent };
}

export interface Frustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The orthographic camera's left/right/top/bottom for a given half-extent and
 * canvas aspect ratio (width / height), sized so the frustum always holds a
 * square of side `2 * halfExtent` regardless of the window's shape.
 *
 * Scaling only the horizontal axis by `aspect` - this module's original
 * form - widens the correct axis on a wide window but starves the vertical
 * axis on a narrow one: `aspect` drops below 1 there, so `halfExtent * aspect`
 * shrinks the horizontal half-extent below `halfExtent` while the vertical
 * half-extent stays at plain `halfExtent`, which is too small for the union
 * bounds `halfExtent` was computed from. On a portrait window (aspect below
 * about 0.91 for the real/null pair) that clips the sides of the pair - the
 * same failure class as the framing bug already fixed on this branch, just
 * along the other axis.
 *
 * Scaling whichever axis's own aspect factor is >= 1, and leaving the other
 * at the plain half-extent, fits both orientations: a wide window widens
 * horizontally (as before), a tall one widens vertically instead, and a
 * square window (aspect 1) leaves both at `halfExtent`.
 */
export function frustumFor(halfExtent: number, aspect: number, margin = 1.1): Frustum {
  const x = halfExtent * Math.max(aspect, 1) * margin;
  const y = halfExtent * Math.max(1 / aspect, 1) * margin;
  return { left: -x, right: x, top: y, bottom: -y };
}
