import type { Sequence } from '../sequence/sequence';

/**
 * Kolakoski (A000002): the sequence is its own run-length encoding.
 *
 * Generated rather than pasted so it is exactly right at any length, and
 * still labelled with its A-number so the OEIS attribution and entry link
 * survive — the reason gallery entries bundle a full Sequence rather than a
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

/** A005132: Recamán — step back by n if that lands somewhere new and positive. */
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

export function oeisSeq(aNumber: string, name: string, terms: bigint[]): Sequence {
  return { terms, aNumber, name, offset: 0, source: 'oeis' };
}
