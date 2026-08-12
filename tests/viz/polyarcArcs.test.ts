import { describe, it, expect } from 'vitest';
import { chordArc, pathTransform, toScreen, type Pt } from '../../src/viz/pathTransform';
import { polyarcPath, polyarcViz, segmentTurns, arcDegrees } from '../../src/viz/polyarc';
import { turtleViz, strokePath } from '../../src/viz/turtle';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const view = (terms: number[]) =>
  new SequenceView({ terms: terms.map(BigInt), name: 't', offset: 1, source: 'paste' } as Sequence);

const SIZE = { width: 600, height: 400 };
const seq = view([1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 2, 2, 1, 1, 2, 1]);
/** The defaults: each term bends 30 or 60 degrees, far too little to see. */
const OPTS = { angle: 30, modulus: 7, offset: -90 };
/** A whole loop inside one term, which is where the octagon used to show. */
const BENDY = { angle: 120, modulus: 7, offset: 120 };

/** Centre of the circle through three points, found without chordArc's maths. */
function circumcentre(a: Pt, b: Pt, c: Pt): Pt {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const sa = a.x * a.x + a.y * a.y, sb = b.x * b.x + b.y * b.y, sc = c.x * c.x + c.y * c.y;
  return {
    x: (sa * (b.y - c.y) + sb * (c.y - a.y) + sc * (a.y - b.y)) / d,
    y: (sa * (c.x - b.x) + sb * (a.x - c.x) + sc * (b.x - a.x)) / d,
  };
}

describe('chordArc', () => {
  it('passes through both of the points it joins', () => {
    const a = { x: 10, y: 20 }, b = { x: 90, y: 55 };
    for (const turn of [0.4, -0.4, 1.9, -1.9, 3.0, -3.0, 6.0]) {
      const arc = chordArc(a, b, turn)!;
      expect(arc, `turn ${turn} produced no arc`).toBeTruthy();
      expect(Math.hypot(a.x - arc.cx, a.y - arc.cy)).toBeCloseTo(arc.r, 6);
      expect(Math.hypot(b.x - arc.cx, b.y - arc.cy)).toBeCloseTo(arc.r, 6);
      // The end angle must land on b, not merely somewhere on the circle.
      expect(arc.cx + arc.r * Math.cos(arc.end)).toBeCloseTo(b.x, 6);
      expect(arc.cy + arc.r * Math.sin(arc.end)).toBeCloseTo(b.y, 6);
    }
  });

  it('finds the same circle the drawn samples already lie on', () => {
    // The independent check: three consecutive samples of one term determine a
    // circle by circumcentre, with no reference to the turn. chordArc sees only
    // two of them plus the turn. A sign error in the flip, or a centre put on
    // the wrong side of the chord, separates these immediately.
    const pts = polyarcPath(seq, BENDY);
    const t = pathTransform(pts, SIZE);
    const turnAt = segmentTurns(seq, BENDY);
    for (const i of [2, 3, 5, 11, 20]) {
      const a = toScreen(t, pts[i - 1]!), b = toScreen(t, pts[i]!), c = toScreen(t, pts[i + 1]!);
      const arc = chordArc(a, b, turnAt(i))!;
      const truth = circumcentre(a, b, c);
      expect(arc.cx, `segment ${i} centre x`).toBeCloseTo(truth.x, 4);
      expect(arc.cy, `segment ${i} centre y`).toBeCloseTo(truth.y, 4);
    }
  });

  it('bulges to the side the path actually turns', () => {
    // Sign check with a fixed case rather than through a render: a left turn
    // in sequence space must still look like a left turn once y is flipped.
    // Travelling left to right across the screen. The centre of a left turn
    // sits left of the traveller, which is above the chord, which is negative
    // y once y grows downward. Checked against the tangents by hand: they run
    // down-right at the start and up-right at the end, so the heading really
    // does rotate to the left along the arc.
    const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
    const left = chordArc(a, b, 1.0)!;
    const right = chordArc(a, b, -1.0)!;
    expect(left.cy).toBeLessThan(0);
    expect(right.cy).toBeGreaterThan(0);
    expect(left.ccw).toBe(true);
    expect(right.ccw).toBe(false);
  });

  it('declines the cases an arc cannot describe', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
    expect(chordArc(a, b, 0)).toBeNull();              // straight
    expect(chordArc(a, b, 1e-7)).toBeNull();           // straight enough
    expect(chordArc(a, a, 1)).toBeNull();              // no chord at all
    expect(chordArc(a, b, 2 * Math.PI)).toBeNull();    // a full turn or more
    expect(chordArc(a, b, 20)).toBeNull();
    expect(chordArc(a, b, NaN)).toBeNull();
  });

  it('declines a bend nobody could see, and takes one they could', () => {
    // The sagitta of a 100px chord grows with the turn. Half a pixel of stand-
    // off is the whole difference between the two answers, so the boundary is
    // pinned from both sides rather than asserted once.
    const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
    const sagitta = (turn: number) => {
      const arc = chordArc(a, b, turn);
      return arc ? arc.r * (1 - Math.cos(turn / 2)) : 0;
    };
    expect(chordArc(a, b, 0.02)).toBeNull();
    expect(sagitta(0.02)).toBe(0);
    const drawn = chordArc(a, b, 0.06);
    expect(drawn).not.toBeNull();
    expect(sagitta(0.06)).toBeGreaterThan(0.35);
    // And it is still the right circle, not merely some circle.
    expect(Math.hypot(b.x - drawn!.cx, b.y - drawn!.cy)).toBeCloseTo(drawn!.r, 6);
  });
});

describe('polyarc draws arcs, and only polyarc', () => {
  it('draws every segment as an arc once the bend is visible', () => {
    const { ctx, callLog } = fakeCtx();
    strokePath(polyarcPath(seq, BENDY), ctx, SIZE, undefined, segmentTurns(seq, BENDY));
    const arcs = callLog.filter((c) => c.name === 'arc');
    expect(arcs.length).toBe(polyarcPath(seq, BENDY).length - 1);
    expect(callLog.filter((c) => c.name === 'lineTo').length).toBe(0);
    expect(arcs.every((c) => c.args.every((n) => typeof n === 'boolean' || Number.isFinite(n)))).toBe(true);
  });

  it('keeps the straight line at the defaults, where no eye could tell', () => {
    // At the default 30 degrees per term the arc stands off its chord by four
    // hundredths of a pixel, and the circle it would need has its centre
    // thousands of pixels off screen. Costs nothing either way - arcs and
    // chords render in the same time - so this is about not asking the
    // rasteriser to express a straight line as a fragment of a vast circle.
    const { ctx, callLog } = fakeCtx();
    polyarcViz.render(seq, defaultParams(polyarcViz.params), ctx, SIZE);
    expect(callLog.some((c) => c.name === 'lineTo')).toBe(true);
    expect(callLog.some((c) => c.name === 'arc')).toBe(false);
  });

  it('starts each segment at the sample it is drawn from', () => {
    const { ctx, callLog } = fakeCtx();
    strokePath(polyarcPath(seq, BENDY), ctx, SIZE, undefined, segmentTurns(seq, BENDY));
    const pts = polyarcPath(seq, BENDY);
    const t = pathTransform(pts, SIZE);
    const first = toScreen(t, pts[0]!);
    const move = callLog.find((c) => c.name === 'moveTo')!;
    expect(move.args[0]).toBeCloseTo(first.x, 6);
    expect(move.args[1]).toBeCloseTo(first.y, 6);
  });

  it('keeps the chord where a segment turns a full circle', () => {
    // Reachable at a high angle against a large modulus: one term spinning
    // several times over is not an arc between two samples, and guessing one
    // would be worse than the straight line. Left as it was.
    const spun = { angle: 120, modulus: 360, offset: 0 };
    const big = view([100, 200, 300, 50, 250]);
    expect(Math.abs(arcDegrees(300, 120, 0))).toBeGreaterThan(2880);
    const { ctx, callLog } = fakeCtx();
    strokePath(polyarcPath(big, spun), ctx, SIZE, undefined, segmentTurns(big, spun));
    expect(callLog.some((c) => c.name === 'lineTo')).toBe(true);
    for (const c of callLog) {
      expect(c.args.every((n) => typeof n !== 'number' || Number.isFinite(n)), `${c.name} got a non-finite argument`).toBe(true);
    }
  });

  it('leaves the turtle walk drawing straight lines', () => {
    const { ctx, callLog } = fakeCtx();
    turtleViz.render(seq, defaultParams(turtleViz.params), ctx, SIZE);
    expect(callLog.some((c) => c.name === 'lineTo')).toBe(true);
    expect(callLog.some((c) => c.name === 'arc')).toBe(false);
  });
});

describe('the samples did not move', () => {
  it('hit-testing and the drawing still agree on where the path is', () => {
    // The whole point of reconstructing the circle from the samples rather
    // than from the model: position() and locate() measure against these, and
    // an arc that missed them would report the cursor off the line.
    const params = defaultParams(polyarcViz.params);
    const pts = polyarcPath(seq, OPTS);
    const t = pathTransform(pts, SIZE);
    for (const index of [0, 3, 9, seq.length - 1]) {
      const p = polyarcViz.position!(seq, params, SIZE, index)!;
      const expected = toScreen(t, pts[Math.min(pts.length - 1, (index + 1) * 8)]!);
      expect(p.x).toBeCloseTo(expected.x, 6);
      expect(p.y).toBeCloseTo(expected.y, 6);
    }
  });
});
