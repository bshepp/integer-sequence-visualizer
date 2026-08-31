import { describe, it, expect } from 'vitest';
import { polyarcPath, segmentsFor, segmentTurns } from '../../src/viz/polyarc';
import { chordArc, pathTransform, toScreen } from '../../src/viz/pathTransform';
import { makeSurrogate, type SurrogateType } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

/**
 * The two panels of a comparison are drawn under exactly the same rules.
 *
 * This file replaces one that checked a tolerance. The renderer used to draw a
 * bend as a straight line whenever its widest stand-off from its chord came to
 * under 0.35 device pixels, and because each panel is fitted to its own
 * bounding box, the two panels were fitted at different scales and so hit that
 * threshold at different rates: 46.6% of the real hero's segments were
 * straightened against 67.2% of its permutation null's.
 *
 * It was measured and it was harmless - worst error 0.344px, 97% of affected
 * pixels moved by under 32/255, total ink differing by 0.2%. It was removed
 * anyway. The whole claim of a side-by-side is that the difference between the
 * panels came from the numbers, and that claim is worth more than the 20% of
 * render time the shortcut saved.
 *
 * So the assertion is no longer "the error is small". It is that there is no
 * error: every segment either is an arc or is one of the three shapes an arc
 * cannot describe.
 */
const HERO = { angle: 64, modulus: 187, offset: -90 };
const SIZE = { width: 670, height: 650 };

const primes = (n: number): bigint[] => {
  const out: bigint[] = [];
  for (let k = 2; out.length < n; k++) {
    let p = true;
    for (let d = 2; d * d <= k; d++) if (k % d === 0) { p = false; break; }
    if (p) out.push(BigInt(k));
  }
  return out;
};
const view = (terms: bigint[]) =>
  new SequenceView({ terms, name: 'x', offset: 0, source: 'paste' } as Sequence);

function audit(terms: bigint[]): { arcs: number; chords: number; total: number } {
  const v = view(terms);
  const segments = segmentsFor(v, HERO);
  const pts = polyarcPath(v, { ...HERO, segments });
  const t = pathTransform(pts, SIZE);
  const turnAt = segmentTurns(v, { ...HERO, segments });
  let arcs = 0, chords = 0;
  for (let i = 1; i < pts.length; i++) {
    if (chordArc(toScreen(t, pts[i - 1]!), toScreen(t, pts[i]!), turnAt(i))) arcs++;
    else chords++;
  }
  return { arcs, chords, total: pts.length - 1 };
}

const real = primes(58);
const panels: Array<[string, bigint[]]> = [
  ['real', real],
  ...(['permutation', 'difference', 'matched'] as SurrogateType[])
    .map((k) => [`${k} null`, makeSurrogate(real, k, 1)] as [string, bigint[]]),
];

describe('a comparison is drawn under one set of rules', () => {
  for (const [name, terms] of panels) {
    it(`draws every curved segment of the ${name} panel as a real arc`, () => {
      const { arcs, chords, total } = audit(terms);
      expect(total, 'nothing drawn, so this proves nothing').toBeGreaterThan(1000);
      expect(chords, `${chords} of ${total} segments fell back to a straight line`).toBe(0);
      expect(arcs).toBe(total);
    });
  }

  it('gives every panel the same treatment, which is the point', () => {
    // The old failure mode stated directly: if one panel is ever drawn with a
    // different proportion of arcs than another, the difference a reader sees
    // between them is partly the renderer's and not the sequence's.
    const rates = panels.map(([, t]) => { const a = audit(t); return a.arcs / a.total; });
    for (const r of rates) expect(r).toBe(1);
    expect(new Set(rates).size, 'panels drawn under different rules').toBe(1);
  });

  it('sampling density still differs between panels, and still cannot move the curve', () => {
    // segmentsFor reads the sharpest turn, and the difference and matched
    // surrogates hold different values from the real sequence, so the panels
    // are sampled at different densities. Harmless only because polyarcPath
    // integrates each term as an arc: samples land on the true curve, so
    // density is a rendering choice rather than a geometric one. Without that,
    // removing the cull would have fixed one asymmetry and left a worse one.
    const densities = panels.map(([, t]) => segmentsFor(view(t), HERO));
    expect(new Set(densities).size, 'panels sampled identically - premise gone').toBeGreaterThan(1);

    const coarse = polyarcPath(view(real), { ...HERO, segments: 20 });
    const fine = polyarcPath(view(real), { ...HERO, segments: 100 });
    for (let i = 0; i < coarse.length; i++) {
      expect(coarse[i]!.x).toBeCloseTo(fine[i * 5]!.x, 9);
      expect(coarse[i]!.y).toBeCloseTo(fine[i * 5]!.y, 9);
    }
  });
});
