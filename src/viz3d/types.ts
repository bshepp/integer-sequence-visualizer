/** How the vertices are joined: one open polyline, or loose points. */
export type DrawMode = 'lines' | 'points';

export interface Geometry3D {
  /** xyz triples, in the same units as the 2D path they came from. */
  positions: Float32Array;
  mode: DrawMode;
  /** Which term each vertex belongs to, for picking and the readout. */
  termOf: Uint32Array;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}
