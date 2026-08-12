/**
 * When a modulus has nothing left to reduce.
 *
 * `a(n) mod b` is `a(n)` itself whenever `0 <= a(n) < b`, so a sequence whose
 * terms are all small draws the identical picture for every b above the
 * largest of them. On A000002, whose terms are only ever 1 or 2, that is every
 * setting from 3 to 360: b = 2 draws one figure and the remaining 357
 * positions of the slider draw a second one, pixel for pixel.
 *
 * Which is correct, and looks exactly like a broken control. It was reported
 * as one. A slider that spans 359 values and visibly responds at one of them
 * is telling the truth in a form nobody can read, so the app says the sentence
 * out loud at the moment it becomes true.
 *
 * Negative terms are the exception, and the reason this returns null rather
 * than a threshold for them: `mod` here is the non-negative residue, so -3 is
 * 2 under b = 5 and 97 under b = 100. A sequence with any negative term keeps
 * responding to b forever, however small its terms are.
 */
export function inertModulusAbove(terms: readonly bigint[]): number | null {
  if (terms.length === 0) return null;
  let max = 0n;
  for (const t of terms) {
    if (t < 0n) return null;
    if (t > max) max = t;
  }
  // Clamped because the caller only ever compares it against a slider that
  // stops at 360; a term with four hundred digits does not need converting
  // exactly to answer "bigger than that?".
  return max > 1_000_000n ? Number.MAX_SAFE_INTEGER : Number(max);
}

/** Said once, when a reader first pushes the modulus past the point of effect. */
export function inertModulusMessage(threshold: number): string {
  return `Every term is ${threshold} or less, so the residues are just the terms: `
    + `any modulus above ${threshold} draws the same picture.`;
}
