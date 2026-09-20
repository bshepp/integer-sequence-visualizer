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
