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

  it('eight samples draw a shape several times too large', () => {
    // The bug, pinned so it cannot come back quietly. Not a rough version of
    // the curve: a star polygon, wider than the curve can possibly be.
    for (const term of [7, 11]) {
      expect(termExtent(8, term, WILD)).toBeGreaterThan(2 * trueDiameter(term, WILD));
    }
  });

  it('converges on the true size as the sampling gets finer', () => {
    for (const term of [3, 7, 11]) {
      const truth = trueDiameter(term, WILD);
      let previous = Infinity;
      for (const s of [16, 64, 256]) {
        const err = Math.abs(termExtent(s, term, WILD) - truth) / truth;
        expect(err, `term ${term} at ${s} samples got worse`).toBeLessThanOrEqual(previous);
        previous = err;
      }
      expect(Math.abs(termExtent(256, term, WILD) - truth) / truth).toBeLessThan(0.02);
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

  it('spends its point budget on the walks where the detail is visible', () => {
    // 300 terms can afford fine sampling and the coils are big enough to see.
    const short = view(Array.from({ length: 300 }, (_, i) => (i * 7919) % 199));
    expect(segmentsFor(short, WILD)).toBeGreaterThan(8);
    expect(segmentsFor(short, WILD) * short.length).toBeLessThanOrEqual(120_000);

    // 20,000 terms cannot, and does not need to: each term's feature is then
    // a thousandth of the drawing, under a pixel either way. The floor holds
    // at the eight samples this view always used, so a long walk is never
    // drawn worse than it was before any of this.
    const long = view(Array.from({ length: 20000 }, (_, i) => (i * 7919) % 199));
    expect(segmentsFor(long, WILD)).toBe(8);
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
