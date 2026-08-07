import type { GalleryEntry } from './types';
import { kolakoski, fibonacci, naturals, primes, recaman, oeisSeq } from './sequences';

const N = 600;

// Every caption that claims something about structure is backed by a
// measurement in `evidence`, recomputed in tests/gallery/verdicts.test.ts.
// Entries we have not measured carry verdict 'open' and say so — an honest
// and rather more interesting thing for this particular landing page to
// admit than a guess would be.
export const GALLERY: GalleryEntry[] = [
  {
    id: 'kolakoski-spiral',
    title: 'Structure that survives the null',
    sequence: oeisSeq('A000002', 'Kolakoski sequence', kolakoski(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'ulam', params: { colorBy: 'mod', modulus: 2 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'real',
    caption: 'The texture on the left is real: these terms alternate far more than chance allows.',
    body: 'The Kolakoski sequence contains only 1s and 2s, and it is its own run-length encoding — so its runs can never be longer than 2. That forces an alternation far more regular than chance, and it is what makes the spiral legible at all. Measured against 200 permutation surrogates, which hold the exact same terms and only reorder them, 66.4% of adjacent pairs differ against a null band of 45.7% to 54.1%. No surrogate reached even 56.1%. The pattern is a property of the arrangement, not of the two values.',
    evidence: {
      statistic: 'switchRate',
      measured: 0.664440734557596,
      bandLo: 0.4574290484140234,
      bandHi: 0.5409015025041736,
      surrogate: 'permutation', n: 200, seed: 1,
    },
  },
  {
    id: 'rainbow-rings',
    title: 'Structure that is not there',
    sequence: oeisSeq('A001477', 'The non-negative integers', naturals(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A001477' },
      vizId: 'ulam', params: { colorBy: 'mod', modulus: 12 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'artifact',
    caption: 'Beautiful concentric rings, drawn entirely by the spiral — not by the sequence.',
    body: 'This is a(n) = n, the simplest sequence there is. Because the hue advances a fixed step per cell while the spiral winds at a steadily increasing radius, the two periodicities beat against each other and produce rings. Nothing here is a property of the numbers: any sequence increasing by a constant produces the same picture, and changing the modulus just changes the ring spacing. This is the exact failure mode the whole site exists to catch, which is why it sits second.',
  },
  {
    id: 'primes-spiral',
    title: "Ulam's own discovery",
    sequence: oeisSeq('A000040', 'The prime numbers', primes(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000040' },
      vizId: 'ulam', params: { colorBy: 'parity', modulus: 6 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'The diagonals Ulam noticed in 1963 — shown here without a verdict.',
    body: 'Stanislaw Ulam noticed while doodling at a conference that primes plotted on a square spiral fall along diagonal lines, corresponding to prime-rich quadratic polynomials. Note that this view plots the primes themselves rather than marking primes among the integers, so it is not the classical picture, and we have not measured it. Marked open rather than guessed at.',
  },
  {
    id: 'recaman-walk',
    title: 'A sequence that doubles back',
    sequence: oeisSeq('A005132', "Recamán's sequence", recaman(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A005132' },
      vizId: 'scatter', params: { scale: 'linear' },
      mode: 'side', surrogate: 'difference', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Subtract if you can, otherwise add — and never repeat yourself.',
    body: 'Recamán steps back by n if that lands on a positive number it has not visited, and forward by n otherwise. The result is famously jagged. It is compared here against a difference surrogate, which keeps the same step sizes but reorders them, so the question posed is whether the arrangement of the steps matters or only their sizes.',
  },
  {
    id: 'fibonacci-ratios',
    title: 'A real result you can read off the screen',
    sequence: oeisSeq('A000045', 'Fibonacci numbers', fibonacci(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000045' },
      vizId: 'differences', params: { mode: 'ratios' },
      mode: 'off', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Successive Fibonacci ratios converging on the golden ratio.',
    body: 'The ratio a(n+1)/a(n) converges to phi = 1.6180339887... This is computed in log space rather than by dividing floats, which is why it stays correct past term 79 — divide the raw values and both sides saturate at the same clamped maximum, so the ratio reads exactly 1.0 forever after. Hover the line to read the exact terms.',
  },
  {
    id: 'kolakoski-turtle',
    title: 'The same sequence, a different technique',
    sequence: oeisSeq('A000002', 'Kolakoski sequence', kolakoski(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'turtle', params: { angle: 90, k: 4 },
      mode: 'flip', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Flip between the real sequence and its shuffle, and watch the path change.',
    body: 'A turtle walk is cumulative: every term displaces everything drawn after it, so this view is far more sensitive to ordering than a grid is. Use the flip button to swap between the real sequence and a permutation of it. Click any point first and the marker will follow that same term across the flip.',
  },
];

export function heroEntry(): GalleryEntry {
  return GALLERY[0]!;
}
