import { describe, it, expect } from 'vitest';
import { polyarcPath, polyarcViz, segmentsFor, arcDegrees, segmentTurns } from '../../src/viz/polyarc';
import { chordArc, pathTransform, toScreen } from '../../src/viz/pathTransform';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';

const view = (t: number[]) =>
  new SequenceView({ terms: t.map(BigInt), name: 't', offset: 1, source: 'paste' } as Sequence);

const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193,
];
const seq = view(PRIMES);
const SIZE = { width: 1300, height: 700 };
/** Terms here turn up to twelve full circles: the aliased regime. */
const WILD = { angle: 120, modulus: 200, offset: 0 };
const DEFAULTS = { angle: 30, modulus: 7, offset: -90 };

/** Widest span of the samples belonging to one term. */
function termExtent(segments: number, term: number, opts: typeof WILD): number {
  const pts = polyarcPath(seq, { ...opts, segments });
  const own = pts.slice(term * segments + 1, (term + 1) * segments + 1);
  let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
  for (const p of own) {
    if (p.x < loX) loX = p.x; if (p.x > hiX) hiX = p.x;
    if (p.y < loY) loY = p.y; if (p.y > hiY) hiY = p.y;
  }
  return Math.max(hiX - loX, hiY - loY);
}

describe('sampling a term that turns more than a full circle', () => {
  // A circular arc of length 1 turning `deg` has radius 1/|deg in radians|,
  // so nothing it draws can be wider than a diameter. Computed from the model,
  // independently of any sampling.
  const trueDiameter = (term: number, opts: typeof WILD) =>
    2 / Math.abs((arcDegrees(seq.mod(term, opts.modulus), opts.angle, opts.offset) * Math.PI) / 180);

  it('never draws a term wider than the curve can possibly be', () => {
    // The old bug pinned from the other side. Chord-stepping put the samples
    // on a circle *larger* than the arc's, so eight samples of a term turning
    // twelve circles spanned five times the true diameter - a star polygon.
    // Integrating the arc puts every sample on the curve itself, so this holds
    // at any sampling, including the coarsest.
    for (const s of [4, 8, 36, 256]) {
      for (const term of [3, 7, 11]) {
        expect(termExtent(s, term, WILD), `term ${term} at ${s} samples`)
          .toBeLessThanOrEqual(trueDiameter(term, WILD) * 1.0001);
      }
    }
  });

  it('draws the same curve however finely it is sampled', () => {
    // The property that makes adaptive sampling safe. Without it, changing the
    // sample count moves the drawing, so sampling cannot be adapted to the
    // sequence, the zoom, or a point budget without the picture shifting.
    const coarse = polyarcPath(seq, { ...WILD, segments: 20 });
    const fine = polyarcPath(seq, { ...WILD, segments: 100 });
    expect(fine.length).toBe((coarse.length - 1) * 5 + 1);
    for (let i = 0; i < coarse.length; i++) {
      expect(coarse[i]!.x, `sample ${i} x`).toBeCloseTo(fine[i * 5]!.x, 9);
      expect(coarse[i]!.y, `sample ${i} y`).toBeCloseTo(fine[i * 5]!.y, 9);
    }
  });

  it('gives every term the same length of ink, whatever it does with it', () => {
    // What the view has always claimed and did not previously do: a term is an
    // arc of length 1. Under chord steps a sharply bending term came out
    // slightly longer than a gentle one.
    // Measured along the samples, which are chords and so always undercut the
    // arc slightly - by sin(t/2)/(t/2) for a per-segment turn t. 2000 samples
    // puts that under a millionth for the sharpest term here, so the tolerance
    // measures the code rather than the discretisation.
    const S = 2000;
    const pts = polyarcPath(seq, { ...WILD, segments: S });
    const lengthOf = (term: number) => {
      let len = 0;
      for (let i = term * S + 1; i <= (term + 1) * S; i++) {
        len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
      }
      return len;
    };
    for (const term of [0, 3, 7, 11]) {
      const turn = Math.abs(arcDegrees(seq.mod(term, WILD.modulus), WILD.angle, WILD.offset))
        * Math.PI / 180;
      // S equal chords of an arc of length 1 measure sin(t/2)/(t/2) of it,
      // where t is the per-segment turn. Asserting that exactly, rather than
      // "close to 1 at some decimal place", tests the arc length and the only
      // reason it can read short in the same breath.
      const t = turn / S;
      const expected = t === 0 ? 1 : Math.sin(t / 2) / (t / 2);
      expect(lengthOf(term), `term ${term}`).toBeCloseTo(expected, 9);
    }
  });

  it('picks a sample count that lands within a percent of the truth', () => {
    const s = segmentsFor(seq, WILD);
    expect(s).toBeGreaterThan(8);
    for (const term of [3, 7, 11]) {
      const truth = trueDiameter(term, WILD);
      expect(Math.abs(termExtent(s, term, WILD) - truth) / truth, `term ${term}`).toBeLessThan(0.01);
    }
  });

  it('leaves a gently bending path at the eight samples it always used', () => {
    // The default view must not move. Its terms turn 30 or 60 degrees, which
    // eight samples already resolve.
    expect(segmentsFor(seq, DEFAULTS)).toBe(8);
    expect(segmentsFor(view([1, 2, 2, 1, 1, 2]), { angle: 1, modulus: 360, offset: -180 }))
      .toBeGreaterThanOrEqual(8);
  });

  it('never lets the point budget sample coarsely enough to alias', () => {
    // The regression this file exists for, and the one the budget caused: at
    // 10,000 terms it allowed 12 samples for a term turning 32 circles, which
    // is 985 degrees between consecutive samples. chordArc cannot name a
    // circle from a pair that far apart, so the renderer fell back to chords
    // and drew star polygons - reported from a screenshot of the prime b-file.
    const maxTurn = (s: SequenceView) => {
      let m = 0;
      for (let i = 0; i < s.length; i++) {
        m = Math.max(m, Math.abs(arcDegrees(s.mod(i, WILD.modulus), WILD.angle, WILD.offset)));
      }
      return m;
    };
    for (const n of [58, 300, 2000, 10000, 20000]) {
      const walk = view(Array.from({ length: n }, (_, i) => (i * 7919) % 199));
      const perSegment = maxTurn(walk) / segmentsFor(walk, WILD);
      expect(perSegment, `${n} terms: ${perSegment.toFixed(0)} degrees between samples`)
        .toBeLessThan(360);
    }
  });

  it('costs less than it used to, now that samples only have to name an arc', () => {
    // Sampling stopped buying smoothness when the geometry stopped depending
    // on it - the arc between two samples is exact - so the density needed
    // fell by roughly eight times for the sequence on the front page.
    const hero = view(PRIMES);
    expect(segmentsFor(hero, { angle: 64, modulus: 187, offset: -90 })).toBeLessThan(200);
  });
});

describe('the fix reaches the renderer, not just the maths', () => {
  it('almost every segment is now drawable as a real arc', () => {
    // Before this, 85.7% of segments at these settings turned a full circle or
    // more and fell back to a straight chord. Fine sampling is what makes the
    // arc renderer able to do its job.
    const opts = { ...WILD, segments: segmentsFor(seq, WILD) };
    const pts = polyarcPath(seq, opts);
    const t = pathTransform(pts, SIZE);
    const turnAt = segmentTurns(seq, opts);
    let fellBackOverAFullTurn = 0;
    for (let i = 1; i < pts.length; i++) {
      const turn = turnAt(i);
      if (!chordArc(toScreen(t, pts[i - 1]!), toScreen(t, pts[i]!), turn)
          && Math.abs(turn) >= 2 * Math.PI) fellBackOverAFullTurn++;
    }
    expect(fellBackOverAFullTurn).toBe(0);
  });

  it('hit-testing still addresses the path that was drawn', () => {
    // position() and locate() multiply and divide by the sample count. If any
    // of the four entry points disagreed about it, the cursor would report a
    // term the line is nowhere near - silently, and only at high angles.
    const params = { ...defaultParams(polyarcViz.params), angle: 120, modulus: 200, offset: 0 };
    for (const index of [0, 5, 17, seq.length - 1]) {
      const p = polyarcViz.position!(seq, params, SIZE, index)!;
      expect(p, `no position for ${index}`).toBeTruthy();
      const hit = polyarcViz.locate!(seq, params, SIZE, p.x, p.y);
      expect(hit, `no hit at term ${index}`).not.toBeNull();
      expect(Math.abs((hit as { index: number }).index - index), `term ${index}`).toBeLessThanOrEqual(1);
    }
  });
});
