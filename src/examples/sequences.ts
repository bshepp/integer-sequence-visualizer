import type { Sequence } from '../sequence/sequence';

/**
 * Kolakoski (A000002): the sequence is its own run-length encoding.
 *
 * Generated rather than pasted so it is exactly right at any length, and
 * still labelled with its A-number so the OEIS attribution and entry link
 * survive - the reason example entries bundle a full Sequence rather than a
 * bare term list.
 */
export function kolakoski(n: number): bigint[] {
  const out: number[] = [1, 2, 2];
  let i = 2;
  while (out.length < n) {
    const run = out[i]!;
    const next = out[out.length - 1] === 1 ? 2 : 1;
    for (let k = 0; k < run && out.length < n; k++) out.push(next);
    i++;
  }
  return out.slice(0, n).map(BigInt);
}

export function fibonacci(n: number): bigint[] {
  const out: bigint[] = [0n, 1n];
  while (out.length < n) out.push(out[out.length - 1]! + out[out.length - 2]!);
  return out.slice(0, n);
}

/** A001477: the non-negative integers, a(n) = n. */
export function naturals(n: number): bigint[] {
  return Array.from({ length: n }, (_, i) => BigInt(i));
}

/** A000040: the primes, by trial division (n is small enough here). */
export function primes(n: number): bigint[] {
  const out: bigint[] = [];
  for (let c = 2; out.length < n; c++) {
    let isPrime = true;
    for (let d = 2; d * d <= c; d++) if (c % d === 0) { isPrime = false; break; }
    if (isPrime) out.push(BigInt(c));
  }
  return out;
}

/** A005132: Recamán - step back by n if that lands somewhere new and positive. */
export function recaman(n: number): bigint[] {
  const seen = new Set<number>([0]);
  const out = [0];
  for (let i = 1; out.length < n; i++) {
    const prev = out[out.length - 1]!;
    const back = prev - i;
    const next = back > 0 && !seen.has(back) ? back : prev + i;
    seen.add(next);
    out.push(next);
  }
  return out.map(BigInt);
}

/**
 * A010060: Thue-Morse. a(n) = parity of the number of 1 bits in n.
 * Overlap-free and strongly self-similar - a good second "real" case,
 * structurally different from Kolakoski but two-valued in the same way.
 */
export function thueMorse(n: number): bigint[] {
  const out: bigint[] = [];
  for (let i = 0; i < n; i++) {
    let bits = 0;
    for (let v = i; v > 0; v >>= 1) bits ^= v & 1;
    out.push(BigInt(bits));
  }
  return out;
}

/** A001511: the ruler sequence - 1 + the 2-adic valuation of n, from n = 1. */
export function ruler(n: number): bigint[] {
  const out: bigint[] = [];
  for (let i = 1; i <= n; i++) {
    let v = 0, x = i;
    while (x % 2 === 0) { x /= 2; v++; }
    out.push(BigInt(v + 1));
  }
  return out;
}

/** A004718: Per Nørgård's "infinity series". a(2n) = -a(n), a(2n+1) = a(n)+1. */
export function norgard(n: number): bigint[] {
  const out: bigint[] = [0n];
  for (let i = 1; i < n; i++) {
    out.push(i % 2 === 0 ? -out[i / 2]! : out[(i - 1) / 2]! + 1n);
  }
  return out;
}

export function oeisSeq(aNumber: string, name: string, terms: bigint[]): Sequence {
  return { terms, aNumber, name, offset: 0, source: 'oeis' };
}

/**
 * A000464: expansion of e.g.f. sin(x)/cos(2x).
 *
 * Fifteen terms, which is what the OEIS entry itself lists and therefore what
 * clicking through to the engine loads. That matters here more than usual:
 * the figure this sequence draws is a short-run picture and looks materially
 * different with more terms, so bundling a longer list would make the
 * thumbnail a promise the engine does not keep.
 */
export const A000464_TERMS: bigint[] = [
  1n,
  11n,
  361n,
  24611n,
  2873041n,
  512343611n,
  129570724921n,
  44110959165011n,
  19450718635716001n,
  10784052561125704811n,
  7342627959965776406281n,
  6023130568334172003579011n,
  5858598896811701995459355761n,
  6667317162352419006959182803611n,
  8776621742176931117228228227924441n,
];
