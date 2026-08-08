export type SequenceSource = 'oeis' | 'paste' | 'formula';

export interface Sequence {
  terms: bigint[];
  aNumber?: string;
  name: string;
  offset: number;
  source: SequenceSource;
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

// Exact (BigInt-precision) base-10 magnitude of a term, independent of
// float64's ~15.95-digit exact-integer ceiling: log10(d.dddd × 10^(len-1)) =
// (len-1) + log10(leading digits), computed from the decimal digit string
// rather than from `Number(t)` (which would already have lost precision, or
// saturated to +/-Infinity, for anything past MAX_SAFE_INTEGER). Zero is a
// sentinel (0, not -Infinity) so it composes into sums/fits/histograms
// without special-casing at every call site. Exported standalone (not just
// as a SequenceView method) so other modules that need an overflow-safe
// magnitude for a bare bigint - not one already living inside a
// SequenceView - compute it identically instead of re-deriving this formula
// and risking it drifting out of sync (src/viz/histogram.ts's 'gaps' target
// and src/nullmodel/surrogates.ts's matched-surrogate log-space fit both use
// this, per task FR C2/I1).
export function bigMagnitude(t: bigint): number {
  if (t === 0n) return 0;
  const s = (t < 0n ? -t : t).toString();
  const lead = Number(s.slice(0, 15)) / 10 ** (Math.min(s.length, 15) - 1);
  return s.length - 1 + Math.log10(lead);
}

// Same magnitude, with the original sign folded back in. Plain (unsigned)
// magnitude is fine for a value like a histogram 'terms' target where most
// OEIS sequences are non-negative; it is NOT fine for a quantity that
// routinely goes negative - e.g. successive-term gaps in a non-monotone
// sequence (Recamán-like) - where collapsing sign would silently relabel a
// decrease as an increase of the same size once it's past float64's exact
// range.
export function signedLogMagnitude(t: bigint): number {
  return bigMagnitude(t) * (t < 0n ? -1 : 1);
}

export class SequenceView {
  constructor(readonly seq: Sequence) {}

  get length(): number {
    return this.seq.terms.length;
  }

  term(i: number): bigint {
    const t = this.seq.terms[i];
    if (t === undefined) throw new RangeError(`term index ${i} out of range`);
    return t;
  }

  toNumber(i: number): number {
    const t = this.term(i);
    if (t > MAX_SAFE) return Number.MAX_SAFE_INTEGER;
    if (t < -MAX_SAFE) return -Number.MAX_SAFE_INTEGER;
    return Number(t);
  }

  logMagnitude(i: number): number {
    return bigMagnitude(this.term(i));
  }

  mod(i: number, n: number): number {
    const bn = BigInt(n);
    return Number(((this.term(i) % bn) + bn) % bn);
  }

  digits(i: number, base = 10): number[] {
    if (base < 2 || !Number.isInteger(base)) {
      throw new RangeError(`digits(): base must be an integer >= 2, got ${base}`);
    }
    let t = this.term(i);
    if (t < 0n) t = -t;
    if (t === 0n) return [0];
    const b = BigInt(base);
    const out: number[] = [];
    while (t > 0n) {
      out.push(Number(t % b));
      t /= b;
    }
    return out.reverse();
  }

  sign(i: number): -1 | 0 | 1 {
    const t = this.term(i);
    return t < 0n ? -1 : t > 0n ? 1 : 0;
  }
}
