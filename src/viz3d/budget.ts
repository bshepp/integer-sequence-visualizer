// src/viz3d/budget.ts

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
