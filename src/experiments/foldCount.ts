/**
 * How many times does the curve of a polygonal-number sequence fold?
 *
 * Draw one arc per term, turning by (a(n) mod m)/m of a full turn - NCurve's
 * rule when m is 360. The residues of a polygonal sequence repeat, and each
 * repeat turns the heading by the sum of one period of residues. The fold
 * count is how many repeats it takes for those turns to add up to whole
 * circles: the additive order of that sum mod m.
 *
 * The claim, OEIS A400844: for the s-gonal numbers and every modulus m the
 * fold count is gcd(m, K(s)), where K depends only on s mod 12. The proof is
 * in docs/fold-count-proof.md; this module is the computation it is checked
 * against, and nothing here assumes the theorem.
 *
 * A fold count of 1 means no net turn per repeat, NOT that the curve never
 * closes. One repeat is then a straight shift, and whether that shift is zero
 * depends on the drawing rule - see `displacementPerPeriod`.
 */

/** The s-gonal numbers: 0, 1, s, 3s-3, ... */
export function polygonal(s: number, n: number): number {
  return ((s - 2) * n * n - (s - 4) * n) / 2;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}

/** Least period of the s-gonal numbers mod m, found by search rather than by formula. */
export function leastPeriod(s: number, m: number): number {
  // The period divides 2m; comparing 4m terms against their shift is more
  // than enough to rule out a false match on a shorter prefix.
  const span = 4 * m;
  const r = Array.from({ length: span + 2 * m + 1 }, (_, n) => polygonal(s, n) % m);
  for (let p = 1; p <= 2 * m; p++) {
    let ok = true;
    for (let i = 0; i < span; i++) {
      if (r[i] !== r[i + p]) { ok = false; break; }
    }
    if (ok) return p;
  }
  throw new Error(`no period up to 2m for s=${s}, m=${m}`);
}

export interface FoldResult {
  period: number;
  /** Sum of one period of residues, mod m: the net turn per repeat in units of 1/m of a circle. */
  turn: number;
  /** Additive order of `turn` mod m; 1 when there is no net turn. */
  folds: number;
}

export function foldCount(s: number, m: number): FoldResult {
  const period = leastPeriod(s, m);
  let turn = 0;
  for (let n = 0; n < period; n++) turn = (turn + (polygonal(s, n) % m)) % m;
  return { period, turn, folds: turn === 0 ? 1 : m / gcd(turn, m) };
}

/** The closed form the theorem asserts: K(s) with fold count gcd(m, K(s)). */
export function polygonalK(s: number): number {
  const a = s - 2;
  const k2 = a % 2 !== 0 ? 1 : a % 4 === 2 ? 4 : 2;
  const k3 = a % 3 === 0 ? 1 : 3;
  return k2 * k3;
}

/**
 * How far the pen has moved after one period, under either drawing rule.
 *
 * 'arc' is this project's rule and NCurve's: a unit-length arc bending by the
 * term's turn. 'step' turns first and then takes a straight unit step. When
 * the fold count is 1 the curve closes exactly when this is zero, and the two
 * rules disagree about when that happens.
 */
export function displacementPerPeriod(s: number, m: number, rule: 'arc' | 'step'): number {
  const period = leastPeriod(s, m);
  let h = 0, x = 0, y = 0;
  for (let n = 0; n < period; n++) {
    const d = (2 * Math.PI * (polygonal(s, n) % m)) / m;
    if (rule === 'step') {
      h += d; x += Math.cos(h); y += Math.sin(h);
    } else if (Math.abs(d) < 1e-15) {
      x += Math.cos(h); y += Math.sin(h);
    } else {
      x += (Math.sin(h + d) - Math.sin(h)) / d;
      y += (Math.cos(h) - Math.cos(h + d)) / d;
      h += d;
    }
  }
  return Math.hypot(x, y);
}
