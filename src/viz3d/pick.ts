// src/viz3d/pick.ts
import type { Geometry3D } from './types';

/**
 * A smaller copy for raycasting against.
 *
 * A raycast over millions of vertices is far too slow to run per mouse move,
 * which is why picking happens on click and against this proxy. Uniform stride
 * rather than anything cleverer: the proxy only has to get the cursor to the
 * right neighbourhood of the walk.
 */
export function decimate(g: Geometry3D, maxVertices: number): {
  positions: Float32Array;
  sourceIndex: Uint32Array;
} {
  const n = g.termOf.length;
  const stride = Math.max(1, Math.ceil(n / Math.max(1, maxVertices)));
  const kept = Math.ceil(n / stride);
  const positions = new Float32Array(kept * 3);
  const sourceIndex = new Uint32Array(kept);
  for (let i = 0, k = 0; i < n; i += stride, k++) {
    positions[k * 3] = g.positions[i * 3]!;
    positions[k * 3 + 1] = g.positions[i * 3 + 1]!;
    positions[k * 3 + 2] = g.positions[i * 3 + 2]!;
    sourceIndex[k] = i;
  }
  return { positions, sourceIndex };
}
