import type { GalleryEntry } from './types';
import { kolakoski, fibonacci, naturals, primes, recaman, thueMorse, ruler, norgard, oeisSeq } from './sequences';

const N = 600;

// Every caption that claims something about structure is backed by a
// measurement in `evidence`, recomputed in tests/gallery/verdicts.test.ts.
// Entries we have not measured carry verdict 'open' and say so - an honest
// and rather more interesting thing for this particular landing page to
// admit than a guess would be.
export const GALLERY: GalleryEntry[] = [
  {
    id: 'kolakoski-spiral',
    title: 'Structure that survives the null',
    sequence: oeisSeq('A000002', 'Kolakoski sequence', kolakoski(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'turtle', params: { angle: 90, k: 4 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'real',
    caption: 'Same terms in both panels. Only the order differs, and the walk on the right falls apart.',
    body: 'Both pictures are drawn from exactly the same 600 numbers; the right-hand one has simply had them shuffled. A turtle walk turns by each term in turn, so it is cumulative and every term displaces everything drawn after it. The real sequence keeps folding back on itself and stays compact; the shuffle drifts away. The Kolakoski sequence contains only 1s and 2s and is its own run-length encoding, so its runs can never exceed 2. That forces an alternation far more regular than chance. Measured against 200 permutation surrogates, 66.4% of adjacent pairs differ against a null band of 45.7% to 54.1%, and no surrogate reached even 56.1%.',
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
    title: 'Structure that means nothing',
    // 2500 terms (a ~50x50 spiral): the beat between the hue period and the
    // winding radius only becomes legible once the spiral has wound enough
    // times for successive arms to line up.
    sequence: oeisSeq('A001477', 'The non-negative integers', naturals(2500)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A001477' },
      vizId: 'ulam', params: { colorBy: 'mod', modulus: 12 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'artifact',
    caption: 'Striking structure from the most trivial sequence there is, and the null model endorses it.',
    body: 'This is a(n) = n. Nothing could be less interesting, yet the picture is full of structure, because the hue advances one step per cell while the spiral winds at a steadily growing radius and the two periodicities beat against each other. Now the uncomfortable part: shuffle the terms and the structure does vanish, so a permutation null reports that the ordering matters. It is right, and it is useless. Every sequence that climbs by a constant draws this same picture, so it distinguishes nothing. A null model tells you whether a pattern survives a specific scrambling. It cannot tell you whether the pattern is worth anything. That is still your job, and this entry is the reminder.',
  },
  {
    id: 'primes-spiral',
    title: "Ulam's own discovery",
    sequence: oeisSeq('A000040', 'The prime numbers', primes(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000040' },
      vizId: 'modgrid', params: { modulus: 6, columns: 30 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Both panels use only two colours, and this null model cannot tell them apart.',
    body: 'Every prime above 3 is either 1 or 5 more than a multiple of 6, so colouring the primes by their remainder mod 6 uses just two colours (plus 2 and 3 themselves). That is a real and non-obvious fact. But look at the null: it is the same two colours in the same proportions, because a permutation surrogate keeps the exact multiset of terms and only reorders them. This view shows a property of the values, so the one null model that holds values fixed is structurally blind to it. Knowing which questions a null cannot answer matters as much as knowing which it can.',
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
    caption: 'Subtract if you can, otherwise add. Never repeat yourself.',
    body: 'Recamán steps back by n if that lands on a positive number it has not visited, and forward by n otherwise. The result is famously jagged. It is compared here against a difference surrogate, which keeps the same step sizes but reorders them, so the question posed is whether the arrangement of the steps matters or only their sizes.',
  },
  {
    id: 'fibonacci-ratios',
    title: 'A real result you can read off the screen',
    // Only 40 terms: the ratio converges within about 20, so the full 600
    // would render as a flat line with the interesting part squashed into
    // the first 3% of the width.
    sequence: oeisSeq('A000045', 'Fibonacci numbers', fibonacci(40)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000045' },
      vizId: 'differences', params: { mode: 'ratios' },
      mode: 'off', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Successive Fibonacci ratios converging on the golden ratio.',
    body: 'The ratio a(n+1)/a(n) converges to phi = 1.6180339887... This is computed in log space rather than by dividing floats, which is why it stays correct past term 79. Divide the raw values instead and both sides saturate at the same clamped maximum, so the ratio reads exactly 1.0 forever after. Hover the line to read the exact terms.',
  },
  {
    id: 'kolakoski-turtle',
    title: 'The same sequence, a different technique',
    sequence: oeisSeq('A000002', 'Kolakoski sequence', kolakoski(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'ulam', params: { colorBy: 'mod', modulus: 2 },
      mode: 'flip', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'The same sequence on a spiral, where the difference is far harder to see.',
    body: 'This is the hero sequence again, drawn as an Ulam spiral instead of a walk. The grid places each term by index rather than accumulating, so a shuffle moves colours around without changing the overall texture much. The difference is real, but nothing like as visible. Use the flip button to swap between the real sequence and its shuffle, and click a cell first so the marker follows that same term across the flip. Worth comparing against the hero: the technique you choose decides how much a null model can show you.',
  },
  {
    id: 'thue-morse',
    title: 'A different sequence, the same verdict',
    sequence: oeisSeq('A010060', 'Thue-Morse sequence', thueMorse(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A010060' },
      vizId: 'turtle', params: { angle: 90, k: 4 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'real',
    caption: 'Built by a completely different rule than Kolakoski, and just as far outside the null.',
    body: 'Thue-Morse takes the parity of the number of 1 bits in n. It is overlap-free and strongly self-similar, and like Kolakoski it uses only two values, but it is built by an entirely unrelated construction. Measured the same way, 66.8% of its adjacent pairs differ against a null band of 46.4% to 53.9%. Two sequences with nothing in common mechanically land in the same place, which is a hint that what the test detects is regular alternation itself rather than anything specific to either rule.',
    evidence: {
      statistic: 'switchRate',
      measured: 0.667779632721202,
      bandLo: 0.46410684474123537,
      bandHi: 0.5392320534223706,
      surrogate: 'permutation', n: 200, seed: 1,
    },
  },
  {
    id: 'ruler',
    title: 'A sequence you can hear',
    sequence: oeisSeq('A001511', 'The ruler sequence', ruler(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A001511' },
      vizId: 'modgrid', params: { modulus: 8, columns: 32 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'The markings on a ruler, written out as numbers.',
    body: 'a(n) counts how many times 2 divides n, plus one. That is exactly the height of the tick marks on an imperial ruler. Laid out in a grid whose width is a power of two, the doubling structure lines up into columns. Try changing the column count to something that is not a power of two and watch the pattern break: that is the layout and the sequence interacting, and telling them apart is the whole exercise.',
  },
  {
    id: 'norgard',
    title: 'A sequence written as music',
    sequence: oeisSeq('A004718', "Per Norgard's infinity series", norgard(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A004718' },
      vizId: 'scatter', params: { scale: 'linear' },
      mode: 'over', surrogate: 'difference', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Composed before it was catalogued: the infinity series Per Norgard built symphonies from.',
    body: "Defined by a(2n) = -a(n) and a(2n+1) = a(n) + 1, this is the Danish composer Per Norgard's infinity series, which he used as a compositional structure from the 1960s onward. His Symphony No. 2 is built on it. It is self-similar at every scale of two. Shown superimposed over a difference surrogate, which keeps the same step sizes but reorders them, so the question is whether the arrangement of its intervals matters or only their sizes.",
  },
];

export function heroEntry(): GalleryEntry {
  return GALLERY[0]!;
}
