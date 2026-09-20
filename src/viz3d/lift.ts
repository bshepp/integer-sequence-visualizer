import type { Geometry3D } from './types';

export interface LiftOptions {
  /**
   * Total z rise across the whole drawing, as a fraction of its own xy
   * diagonal. 0 is flat and reproduces the 2D picture exactly; 1 makes the
   * object as tall as it is wide. Per-vertex advance is constant, which is
   * what keeps z monotonic and the strand count readable.
   */
  step: number;
}

export function liftPath(
  path: ReadonlyArray<{ x: number; y: number }>,
  termOf: (vertexIndex: number) => number,
  opts: LiftOptions,
): Geometry3D {
  const n = path.length;
  if (n === 0) {
    return {
      positions: new Float32Array(0),
      mode: 'lines',
      termOf: new Uint32Array(0),
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  const dz = n > 1 ? (opts.step * diagonal) / (n - 1) : 0;

  const positions = new Float32Array(n * 3);
  const terms = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const p = path[i]!;
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = i * dz;
    terms[i] = termOf(i);
  }

  return {
    positions,
    mode: 'lines',
    termOf: terms,
    bounds: { min: [minX, minY, 0], max: [maxX, maxY, (n - 1) * dz] },
  };
}
