export type SequenceSource = 'oeis' | 'paste' | 'formula';

export interface Sequence {
  terms: bigint[];
  aNumber?: string;
  name: string;
  offset: number;
  source: SequenceSource;
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

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
    const t = this.term(i);
    if (t === 0n) return 0;
    const s = (t < 0n ? -t : t).toString();
    // log10(d.dddd × 10^(len-1)) = (len-1) + log10(leading digits)
    const lead = Number(s.slice(0, 15)) / 10 ** (Math.min(s.length, 15) - 1);
    return s.length - 1 + Math.log10(lead);
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
