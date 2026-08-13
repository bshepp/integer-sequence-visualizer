import type { ExampleEntry } from './types';
import {
  kolakoski, fibonacci, naturals, primes, recaman, thueMorse, ruler, norgard, oeisSeq,
  A000464_TERMS,
  A000376_TERMS, A000828_TERMS, A001553_TERMS, A019488_TERMS, A039685_TERMS, A039970_TERMS,
} from './sequences';

const N = 600;

// Every caption that claims something about structure is backed by a
// measurement in `evidence`, recomputed in tests/examples/verdicts.test.ts.
// Entries we have not measured carry verdict 'open' and say so - an honest
// and rather more interesting thing for this particular landing page to
// admit than a guess would be.
export const EXAMPLES: ExampleEntry[] = [
  {
    id: 'primes-polyarc',
    title: 'The prettiest picture here, and what it is made of',
    // 58 terms, which is what the OEIS publishes inline for A000040 and what
    // the engine loads when you open this entry. More primes do not improve
    // it: the drawing is two spirals and a sweep, and a few hundred terms
    // fills that in until it is a disc.
    sequence: oeisSeq('A000040', 'The prime numbers', primes(58)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000040' },
      vizId: 'polyarc', params: { angle: 64, modulus: 187, offset: -90 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'untestable',
    caption: 'Two spirals and a sweep from the primes. Shuffle them and it scatters - which proves nothing at all.',
    body: 'This is 58 primes, each bending the path by 64 x (p mod 187) - 90 degrees, and it is the best-looking thing on this site. The panel beside it is the same primes shuffled, and it falls apart completely, which is exactly the sort of comparison that should make you suspicious rather than convinced. The primes increase, so a shuffle of them was never going to look the same, and the rejection carries no more information than "the primes increase" does. Here is what is actually going on. Consecutive primes below 300 differ by about 6, and 6 out of 187 is a small turn, so each arc is nearly the arc before it and the path curves smoothly. Measured, the residue moves 5.0% of the way round the dial per term; shuffled, it moves 49%. That is the whole difference between the two panels. Now the part that decides it: keep the exact multiset of gaps between the primes and merely reorder them, and the figure comes back at 5.0% every single time, to seventeen decimal places, across all 200 surrogates. The smoothness belongs to the size of prime gaps, not to the order they arrive in - and no null that preserves those gaps can test it. That is not a disappointing answer. Small prime gaps are the interesting thing about primes, and this drawing is a picture of them.',
    evidence: {
      statistic: 'residueStep',
      measured: 0.05047377802795759,
      n: 200, seed: 1,
      rungs: [
        { surrogate: 'permutation', bandLo: 0.4172999343277981, bandHi: 0.5563373674828783, median: 0.4906651655877662 },
        { surrogate: 'matched', bandLo: 0.07130124777183601, bandHi: 0.09907120743034056, median: 0.08443568815085843 },
        { surrogate: 'difference', bandLo: 0.05047377802795759, bandHi: 0.05047377802795759, median: 0.05047377802795759 },
      ],
    },
  },
  {
    id: 'kolakoski-spiral',
    title: 'Structure that survives the null',
    sequence: oeisSeq('A000002', 'Kolakoski sequence', kolakoski(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'turtle', params: { angle: 90, k: 4 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'survives-steps',
    caption: 'No run of identical terms is longer than 2. Nothing we can scramble it with reproduces that.',
    body: 'Both pictures come from exactly the same 600 numbers; the right-hand one has had them shuffled. The Kolakoski sequence is its own run-length encoding and contains only 1s and 2s, so no run can exceed 2 - and that is the claim, because it is checkable by eye and it survives every null on the ladder. Shuffle the terms and the longest run reaches 7 to 15. Shuffle only the steps between terms, which keeps the trend and the step sizes and merely reorders them, and it still reaches 5 to 9. The real sequence never gets past 2. Worth knowing what this entry used to claim: that 66.4% of adjacent pairs differ against a null band of 45.7% to 54.1%. True, and untestable by the strictest null - the switch rate counts non-zero steps, the step-preserving null keeps every step, so all 200 of its surrogates return 66.4% exactly. A null that cannot come out any other way is not evidence. The run length can, and does.',
    evidence: {
      statistic: 'longestRun',
      measured: 2,
      n: 200, seed: 1,
      rungs: [
        { surrogate: 'permutation', bandLo: 7, bandHi: 15, median: 9 },
        { surrogate: 'matched', bandLo: 7, bandHi: 15, median: 10 },
        { surrogate: 'difference', bandLo: 5, bandHi: 9, median: 6 },
      ],
    },
  },
  {
    id: 'a000464-pentagram',
    title: 'A star with two authors',
    sequence: oeisSeq('A000464', 'Expansion of e.g.f. sin(x)/cos(2*x)', A000464_TERMS),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000464' },
      vizId: 'turtle', params: { angle: 73, k: 4 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'untestable',
    caption: 'Every step is even, so the residues alternate. No shuffle was ever going to show you that.',
    body: 'A000464 at 73 degrees draws a clean pentagram, and this entry is the one that changed most when the ladder replaced the single shuffle. Its terms are 1, 3, 1, 3 mod 4 without a single exception, so every pair of terms turns by the same amount and the path is one rotation repeated. Measured at -0.933 alternation against a shuffle band of -0.540 to 0.406, which sounds decisive and is worth almost nothing: the sequence increases, so a shuffle of it was never going to look the same, and rejection there says only that it increases. Ask the strictest null instead - keep the exact multiset of steps and reorder them - and all 200 surrogates return -0.933 too, to the digit. The reason is better than the original claim. Every step of A000464 is even, so the residues mod 4 cannot help alternating whatever order the steps arrive in. The alternation is arithmetic, not arrangement, and no null that preserves the steps can test it. Then the five-pointedness: that belongs to the protractor. A pair of terms turns 4 x 73 = 292 degrees, near 288, which is four fifths of a turn; hand the same alternation 100 degrees and it draws nine points. 73 does not close exactly either, so the star creeps 20 degrees a circuit and the full b-file fills in a rosette - the one figure here that looks better with fewer terms.',
    evidence: {
      statistic: 'residueAlternation',
      measured: -0.9333333333333332,
      n: 200, seed: 1,
      rungs: [
        { surrogate: 'permutation', bandLo: -0.5404761904761906, bandHi: 0.40595238095238106, median: -0.12976190476190474 },
        { surrogate: 'matched', bandLo: -0.08674242424242425, bandHi: 0.7333333333333333, median: 0.38888888888888884 },
        { surrogate: 'difference', bandLo: -0.9333333333333332, bandHi: -0.9333333333333332, median: -0.9333333333333332 },
      ],
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
    verdict: 'foregone',
    caption: 'The plainest sequence there is, drawing striking structure, and the shuffle test endorses it.',
    body: 'This is a(n) = n. Nothing could be less interesting, yet the picture is full of structure, because the hue advances one step per cell while the spiral winds at a steadily growing radius and the two periodicities beat against each other. Shuffle the terms and the structure vanishes, so a permutation null reports that the ordering matters. It is right, it is useless, and it could not have said anything else: a(n) = n is monotone, shuffling destroys sortedness, and the rejection carries exactly the information that the sequence increases. That is what this verdict means, and nine of the sixteen sequences on this site are monotone, so it is not a rare trap. It is why the ladder exists. Even at the top of it, though, something is missing: every sequence that climbs by a constant draws this same picture, so a finding here would distinguish nothing. Surviving a null and being worth knowing are different questions, and only the first one is measured here.',
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
    verdict: 'survives-steps',
    caption: 'Built by a completely different rule than Kolakoski, and outside every null in the same way.',
    body: 'Thue-Morse takes the parity of the number of 1 bits in n. It is overlap-free and strongly self-similar, and like Kolakoski it uses only two values, but it is built by an entirely unrelated construction. Its residue alternation measures -0.335. Shuffling the terms puts the null at -0.088 to 0.068; holding the trend and spread fixed puts it at -0.080 to 0.071; and keeping the exact multiset of steps and merely reordering them puts it at 0.119 to 0.257 - on the far side of zero from the real sequence, which is the strongest of the three separations rather than the weakest. Two sequences with nothing in common mechanically land outside every null the same way, which is a hint that what the test detects is regular alternation itself rather than anything specific to either rule. Do not read the shared verdict as a shared cause.',
    evidence: {
      statistic: 'residueAlternation',
      measured: -0.335,
      n: 200, seed: 1,
      rungs: [
        { surrogate: 'permutation', bandLo: -0.08833333333333333, bandHi: 0.06833333333333333, median: -0.005 },
        { surrogate: 'matched', bandLo: -0.08006410256410218, bandHi: 0.0714568515884306, median: 0.0013888117069556147 },
        { surrogate: 'difference', bandLo: 0.11925750473721021, bandHi: 0.25739177223202725, median: 0.19205609176829902 },
      ],
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

  // ---------------------------------------------------------------------
  // From the SeqFan thread. Drawn, not worked.
  //
  // NCurve's own rule in every one: arc = 1 x (a(n) mod 360) - 180, which is
  // what the polyarc view does at angle 1. Bill McEachen said he iterated no
  // parameters, so these are close to the settings the pictures in the thread
  // were made at, and deliberately so - the point of the shelf is that these
  // are the thread's images, now with a null model one click away.
  //
  // Every one carries verdict 'open' and says in its own words that nothing
  // has been measured. Naming a sequence is not the same as knowing anything
  // about it, and the gap between those two is what the site is for.
  // ---------------------------------------------------------------------
  {
    id: 'thread-french-curve',
    title: 'French curve',
    sequence: oeisSeq('A000376', 'Topswops', A000376_TERMS),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000376' },
      vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    group: 'thread',
    caption: "Bill McEachen's name for A000376, at NCurve's own settings.",
    body: 'Topswops: shuffle n cards labelled 1 to n, and while the top card reads m, reverse the top m of them. a(n) is the longest a deck can hold out before 1 reaches the top and the deck comes out sorted. Twenty terms is the whole sequence as far as anyone knows it - even its b-file stops there, because each further term is a search over another factorial. Named in the SeqFan thread by Bill McEachen, who said he iterated no parameters - so this is roughly the picture he named, and nobody has yet asked it the only question this site asks.',
  },
  {
    id: 'thread-propeller',
    title: 'Propeller',
    sequence: oeisSeq('A000828', 'E.g.f. cos(x)/(cos(x) - sin(x))', A000828_TERMS),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000828' },
      vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    group: 'thread',
    caption: "Named for its shape by Bill McEachen. Twenty terms, growing fast.",
    body: 'The exponential generating function cos(x)/(cos(x) - sin(x)) expanded as a series. Its terms climb past seven quintillion by the twentieth, so under a modulus of 360 the residues jump about freely and successive arcs have little to do with one another. Worth watching what the permutation surrogate does here in particular: when the residues are already scattered, shuffling them may change remarkably little, and a null that cannot tell the difference is telling you something.',
  },
  {
    id: 'thread-saw-blade',
    title: 'Saw blade',
    sequence: oeisSeq('A001553', 'a(n) = 1^n + 2^n + ... + 6^n', A001553_TERMS),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A001553' },
      vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    group: 'thread',
    caption: "Bill McEachen's saw blade: the sum of the first six nth powers.",
    body: 'a(n) = 1^n + 2^n + ... + 6^n, so it is dominated by 6^n almost immediately and grows without any subtlety at all. That makes it a good test of a suspicion worth having about this whole class of picture: a sequence that grows smoothly and fast has residues mod 360 that are nearly a fixed multiplication each step, and fixed multiplications draw regular figures. Whether the regularity here belongs to the sequence or to that arithmetic is exactly the open question.',
  },
  {
    id: 'thread-sloane',
    title: "Sloane's",
    sequence: oeisSeq('A019488', 'Expansion of 1/((1-4*x)*(1-6*x)*(1-11*x))', A019488_TERMS),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A019488' },
      vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    group: 'thread',
    caption: 'The one that started the collecting: Bill picked it out first.',
    body: 'A019488 is the expansion of 1/((1-4x)(1-6x)(1-11x)), and its OEIS author line reads N. J. A. Sloane. It was the first NCurve drawing anyone in the thread singled out - Bill McEachen called it his favourite, George Whale built a gallery partly to hold it, and the collecting of named curves followed from there. Drawn here from the first hundred-odd terms of its b-file. Nothing about the picture has been measured.',
  },
  {
    id: 'thread-zipper',
    title: 'Zipper',
    sequence: oeisSeq('A039685', 'Numbers m such that m^2 ends in 444', A039685_TERMS),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A039685' },
      vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    group: 'thread',
    caption: "Bill McEachen's zipper. The squares of these all end in 444.",
    body: 'Every one of these numbers, squared, ends in the digits 444 - and they arrive in a strict pattern, four to every block of a thousand, at offsets 38, 462, 538 and 962. A sequence whose terms are that predictable modulo 1000 is not going to be very surprising modulo 360 either, which makes this a useful case for the difference surrogate rather than the permutation one: the steps repeat, so the interesting question is whether their order matters at all.',
  },
  {
    id: 'thread-slinky',
    title: 'Slinky',
    sequence: oeisSeq('A039970', 'A d-perfect sequence', A039970_TERMS),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A039970' },
      vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    group: 'thread',
    caption: 'Every other term is zero, and the rest are Catalan numbers mod 3.',
    body: 'a(2n) is always 0 and a(2n+1) is the nth Catalan number mod 3, so the sequence only ever takes the values 0, 1 and 2, and more than half of it is zeros. Under NCurve\'s rule that means most terms bend by very nearly half a turn, which is what coils the drawing up - Bill McEachen called it the Slinky. This is the one on the shelf where the drawing method is most visibly doing the work, and the null model has an easy job to do.',
  },
];

export function heroEntry(): ExampleEntry {
  return EXAMPLES[0]!;
}

/** The measured shelf, hero first. */
export function workedEntries(): ExampleEntry[] {
  return EXAMPLES.filter((e) => e.group !== 'thread');
}

/** Drawn but untested, straight from the SeqFan discussion. */
export function threadEntries(): ExampleEntry[] {
  return EXAMPLES.filter((e) => e.group === 'thread');
}
