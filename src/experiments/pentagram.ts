import { permutationSurrogate } from '../nullmodel/surrogates';
import { alternation } from '../examples/statistics';

// Re-exported so this module reads as the single place the pentagram question
// is answered, while the statistic itself stays shared with the worked-example
// evidence that quotes it.
export { alternation };

/**
 * Is the A000464 pentagram real?
 *
 * A000464 drawn as a turtle walk at 73 degrees, mod 4, produces a clean
 * five-pointed star. The site's question applies to the site's own output: is
 * that star a property of the sequence, or of the way it is being drawn?
 *
 * It is both, in separable parts, which is why it is worth measuring:
 *
 *   - THAT the walk closes into a regular figure is the sequence's doing. Its
 *     residues mod 4 alternate 1, 3, 1, 3 without exception, so every pair of
 *     terms turns by the same amount. A permutation destroys this, and that is
 *     what `alternation` measures.
 *
 *   - That the figure has FIVE points is the angle's doing. A pair of terms
 *     turns 4 x 73 = 292 degrees, and 292 is close to 288 = 4 x 360/5. Nothing
 *     about the sequence chose five; `foldFromPairTurn` recovers it from the
 *     angle alone.
 *
 * A caution the numbers forced, recorded because it is the sort of thing this
 * site exists to catch: the obvious statistic does NOT work here. Direction
 * concentration - how tightly the steps cluster onto five compass directions -
 * is no higher for the real sequence than for a shuffle of it, and is often
 * lower. A shuffle wanders, but it wanders in clumps; the real walk visits a
 * similar spread of directions in strict rotational order. The eye is reading
 * the order, not the spread, so a statistic that scores only the spread finds
 * nothing. `runPentagramExperiment` reports it anyway rather than quietly
 * choosing the statistic that agrees.
 */

/** Headings of each unit step, in radians, for a turtle walk over residues. */
export function headings(residues: number[], angleDeg: number): number[] {
  const step = (angleDeg * Math.PI) / 180;
  const out: number[] = [];
  let h = 0;
  for (const r of residues) {
    h += step * r;
    out.push(h);
  }
  return out;
}

/**
 * How tightly directions cluster onto m equally spaced directions: 1 when
 * every one points along one of m exactly, ~1/sqrt(n) when they are spread at
 * random.
 */
export function orderParameter(hs: number[], m: number): number {
  if (hs.length === 0) return 0;
  let c = 0, s = 0;
  for (const h of hs) {
    c += Math.cos(m * h);
    s += Math.sin(m * h);
  }
  return Math.hypot(c, s) / hs.length;
}

/** Angular distance from x to the nearest whole turn, in degrees. */
const toWholeTurn = (deg: number): number => {
  const r = ((deg % 360) + 360) % 360;
  return Math.min(r, 360 - r);
};

/**
 * How many points a figure built from a repeated `pairTurn` shows.
 *
 * The walk closes after m repeats when m x pairTurn is a whole number of
 * turns. Exact closure is rare; what the eye reads is the m that comes
 * closest, with the leftover showing up as the figure slowly precessing.
 * Returns that m and the leftover per circuit.
 */
export function foldFromPairTurn(pairTurnDeg: number, maxFold = 12): { fold: number; driftDeg: number } {
  let best = { fold: 0, driftDeg: Infinity };
  for (let m = 2; m <= maxFold; m++) {
    const drift = toWholeTurn(m * pairTurnDeg);
    if (drift < best.driftDeg) best = { fold: m, driftDeg: drift };
  }
  return best;
}

export function residuesOf(terms: bigint[], k: number): number[] {
  const kk = BigInt(k);
  // Positive residue: a(n) can be negative in general, and -1n % 4n is -1n,
  // which would be a turn in the wrong direction.
  return terms.map((t) => Number(((t % kk) + kk) % kk));
}

export interface Band { lo: number; hi: number; mean: number }

const band = (xs: number[]): Band => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
  return { lo: at(0.025), hi: at(0.975), mean: s.reduce((a, b) => a + b, 0) / s.length };
};

export interface PentagramVerdict {
  n: number;
  angleDeg: number;
  k: number;
  /** The sequence's contribution: does the ordering beat a shuffle? */
  realAlternation: number;
  nullAlternation: Band;
  pAlternation: number;
  /** The angle's contribution, from the angle alone. */
  pairTurnDeg: number;
  fold: number;
  /** Degrees the figure rotates per circuit; why it eventually smears. */
  driftPerCircuitDeg: number;
  /** The statistic that does NOT separate them, kept so the record is honest. */
  realDirectionR: number;
  nullDirectionR: Band;
}

export function runPentagramExperiment(
  terms: bigint[],
  opts: { angleDeg: number; k: number; ensembleN?: number; seed?: number },
): PentagramVerdict {
  const { angleDeg, k, ensembleN = 200, seed = 1 } = opts;
  const real = residuesOf(terms, k);
  const realAlt = alternation(real);

  // One "pair" is the repeating unit of an alternation: two terms.
  const pairTurnDeg = (real[0]! + real[1]!) * angleDeg;
  const { fold, driftDeg } = foldFromPairTurn(pairTurnDeg);
  const realR = orderParameter(headings(real, angleDeg), fold);

  const nullAlt: number[] = [];
  const nullR: number[] = [];
  for (let i = 0; i < ensembleN; i++) {
    // The repo's own surrogate, so this measures what the site draws.
    const shuffled = residuesOf(permutationSurrogate(terms, seed + i), k);
    nullAlt.push(alternation(shuffled));
    nullR.push(orderParameter(headings(shuffled, angleDeg), fold));
  }

  return {
    n: terms.length, angleDeg, k,
    realAlternation: realAlt,
    nullAlternation: band(nullAlt),
    // One-sided: the claim is specifically that the real alternates more than
    // chance, so only that tail counts.
    pAlternation: nullAlt.filter((a) => a <= realAlt).length / ensembleN,
    pairTurnDeg, fold, driftPerCircuitDeg: driftDeg,
    realDirectionR: realR,
    nullDirectionR: band(nullR),
  };
}
