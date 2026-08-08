import { SequenceView, type Sequence } from '../../src/sequence/sequence';

// Shared across C2/C3/I1 covering tests (task FR): a sequence large enough
// to both exceed float64-safe range partway through (BV-2/C2's clamping
// bugs) AND, via digitWalk's per-digit point expansion, exceed V8's ~250k
// spread-argument limit (C3's crash). Fibonacci is exact to compute in
// BigInt and its offset-0 convention (a(0) = 0) also exercises the
// leading-zero edge case real OEIS b-files have (see I1).
export function fibonacciTerms(n: number): bigint[] {
  const out: bigint[] = [0n, 1n];
  while (out.length < n) out.push(out[out.length - 1]! + out[out.length - 2]!);
  return out.slice(0, n);
}

export const FIB_2000: bigint[] = fibonacciTerms(2000);

export function fib2000View(): SequenceView {
  return new SequenceView({ terms: FIB_2000, name: 'fib2000', offset: 0, source: 'paste' } as Sequence);
}

// Exact (BigInt-precision) base-10 log magnitude, re-derived independently
// of src/sequence/sequence.ts's bigMagnitude - deliberately a *separate*
// implementation (not an import) so these covering tests check the
// production code against independent math, not against itself.
export function independentLogMagnitude(t: bigint): number {
  if (t === 0n) return 0;
  const s = (t < 0n ? -t : t).toString();
  const lead = Number(s.slice(0, 15)) / 10 ** (Math.min(s.length, 15) - 1);
  return s.length - 1 + Math.log10(lead);
}
