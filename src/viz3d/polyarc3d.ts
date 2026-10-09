import type { SequenceView } from '../sequence/sequence';
import { arcDegrees } from '../viz/polyarc';
import type { Geometry3D } from './types';

/**
 * The polyarc curve walked in three dimensions, with the depth taken from the
 * sequence instead of from position in it.
 *
 * The flat rule reads one number off each term: its residue mod b, which sets
 * how far the arc bends. Everything else about the term is thrown away. This
 * walk keeps the next piece: writing the term in base b, the last digit still
 * sets the sideways turn exactly as before, and the digit above it sets an
 * up-or-down tilt over the same step.
 *
 *   yaw   = hand x (angle x (a(n) mod b) + offset)        the flat rule, unchanged
 *   pitch = angle x nextDigit(a(n), b)                     zero while a(n) < b
 *
 * Two properties make this more than a second free angle:
 *
 *   - The flat drawing is inside it. With the tilt at zero the walk never
 *     leaves the plane and is polyarcPath's curve, vertex for vertex; a
 *     sequence only lifts off once its terms reach the modulus.
 *   - It still only depends on residues, of b squared this time, so a sequence
 *     that repeats mod b^2 repeats its motion. In the plane one repeat is a
 *     rotation and the figure closes or drifts; in space it is a rotation
 *     about an axis plus a slide along it, so the usual result is a helix of
 *     copies and closed figures are the rare case.
 *
 * It is a different instrument from the index lift in lift.ts, not a
 * replacement: that one answers "when was this drawn", this one "what else is
 * in the numbers". Like every 3D view here it is exploratory - a second angle
 * is a second way to see structure that is not there, so it is drawn beside
 * the same null model as everything else.
 */

/**
 * The second base-b digit of `term`, signed: 0, 1, ..., then wrapping to
 * negative from the midpoint, so that 0 means "no tilt" and small digits
 * either side of it mean small tilts either way.
 *
 * Floors for negative terms, to agree with the residue `SequenceView.mod`
 * takes: -1 = b x (-1) + (b - 1), so its residue is b - 1 and this is -1.
 */
export function nextDigit(term: bigint, modulus: number): number {
  const b = BigInt(modulus);
  const residue = ((term % b) + b) % b;
  const quotient = (term - residue) / b;
  const digit = Number(((quotient % b) + b) % b);
  return digit * 2 < modulus ? digit : digit - modulus;
}

type Vec = [number, number, number];

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** `v` turned by `angle` about the unit vector `axis`, by the Rodrigues formula. */
function rotate(v: Vec, axis: Vec, angle: number): Vec {
  const c = Math.cos(angle), s = Math.sin(angle);
  const k = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
  const x = cross(axis, v);
  return [
    v[0] * c + x[0] * s + axis[0] * k * (1 - c),
    v[1] * c + x[1] * s + axis[1] * k * (1 - c),
    v[2] * c + x[2] * s + axis[2] * k * (1 - c),
  ];
}

export function polyarc3dGeometry(
  seq: SequenceView,
  opts: { angle: number; modulus: number; offset: number; segments: number; hand?: number },
): Geometry3D {
  const { angle, modulus, offset, segments } = opts;
  const hand = opts.hand ?? 1;
  const n = seq.length * segments + 1;
  const positions = new Float32Array(n * 3);
  const termOf = new Uint32Array(n);

  // The walker carries its own frame: where it is heading, its left, and its
  // up. Yaw is a turn about `up`, pitch a turn about `left`.
  let heading: Vec = [1, 0, 0], left: Vec = [0, 1, 0], up: Vec = [0, 0, 1];
  let x = 0, y = 0, z = 0;
  let v = 1;

  for (let i = 0; i < seq.length; i++) {
    const yaw = (hand * arcDegrees(seq.mod(i, modulus), angle, offset) * Math.PI) / 180;
    const pitch = (angle * nextDigit(seq.term(i), modulus) * Math.PI) / 180;
    // Turning steadily about two of the walker's own axes at once is turning
    // about one fixed axis, so the step is an exact circular arc of length 1
    // in a tilted plane. With pitch = 0 the axis is `up` and this is the arc
    // polyarcPath draws.
    const phi = Math.hypot(yaw, pitch);

    if (phi < 1e-12) {
      for (let s = 1; s <= segments; s++, v++) {
        const t = s / segments;
        positions[v * 3] = x + heading[0] * t;
        positions[v * 3 + 1] = y + heading[1] * t;
        positions[v * 3 + 2] = z + heading[2] * t;
        termOf[v] = i;
      }
      x += heading[0]; y += heading[1]; z += heading[2];
      continue;
    }

    const axis: Vec = [
      (yaw * up[0] + pitch * left[0]) / phi,
      (yaw * up[1] + pitch * left[1]) / phi,
      (yaw * up[2] + pitch * left[2]) / phi,
    ];
    const side = cross(axis, heading);
    for (let s = 1; s <= segments; s++, v++) {
      const t = (phi * s) / segments;
      const along = Math.sin(t) / phi, across = (1 - Math.cos(t)) / phi;
      positions[v * 3] = x + along * heading[0] + across * side[0];
      positions[v * 3 + 1] = y + along * heading[1] + across * side[1];
      positions[v * 3 + 2] = z + along * heading[2] + across * side[2];
      termOf[v] = i;
    }
    const along = Math.sin(phi) / phi, across = (1 - Math.cos(phi)) / phi;
    x += along * heading[0] + across * side[0];
    y += along * heading[1] + across * side[1];
    z += along * heading[2] + across * side[2];

    heading = rotate(heading, axis, phi);
    left = rotate(left, axis, phi);
    // Re-squared every step so rounding cannot shear the frame over a long
    // walk. With no pitch this leaves `up` at exactly (0, 0, 1), which is
    // what keeps a flat sequence at z = 0 to the last bit.
    const hl = Math.hypot(heading[0], heading[1], heading[2]);
    heading = [heading[0] / hl, heading[1] / hl, heading[2] / hl];
    const d = left[0] * heading[0] + left[1] * heading[1] + left[2] * heading[2];
    left = [left[0] - d * heading[0], left[1] - d * heading[1], left[2] - d * heading[2]];
    const ll = Math.hypot(left[0], left[1], left[2]);
    left = [left[0] / ll, left[1] / ll, left[2] / ll];
    up = cross(heading, left);
  }

  const min: Vec = [0, 0, 0], max: Vec = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    for (let c = 0; c < 3; c++) {
      const p = positions[k * 3 + c]!;
      if (p < min[c]!) min[c] = p;
      if (p > max[c]!) max[c] = p;
    }
  }

  return { positions, mode: 'lines', termOf, bounds: { min, max } };
}
