import { SequenceView, type Sequence } from '../sequence/sequence';
import { turtlePath } from '../viz/turtle';
import { pathTransform, toScreen, type Pt } from '../viz/pathTransform';
import { sweptArea } from '../viz/sweptArea';
import { makeSurrogate } from '../nullmodel/surrogates';
import type { Size } from '../viz/types';

export interface ShapeResult { join: CanvasLineJoin; area: number; }

export interface LineShapeVerdict {
  /** Range of swept area across the three joins, on the real sequence. */
  shapeSpread: number;
  /** Range of swept area across permutation surrogates, at a fixed join. */
  nullSpread: number;
  /** shapeSpread / nullSpread. Above 1 means shape moves it more than chance does. */
  ratio: number;
  shapeMatters: boolean;
  shapes: ShapeResult[];
}

const JOINS: CanvasLineJoin[] = ['miter', 'round', 'bevel'];
const ANGLE = 90, MOD_K = 4;

function screenPath(seq: SequenceView, size: Size): Pt[] {
  const pts = turtlePath(seq, ANGLE, MOD_K);
  const t = pathTransform(pts, size);
  return pts.map((p) => toScreen(t, p));
}

const range = (xs: number[]): number => {
  let lo = xs[0]!, hi = xs[0]!;
  for (const x of xs) { if (x < lo) lo = x; if (x > hi) hi = x; }
  return hi - lo;
};

/**
 * Does the line shape change what you would conclude?
 *
 * The honest way to ask is the way this project asks everything else: put the
 * effect next to a null model. The "effect" here is how much the swept area of
 * the drawn path moves when *only the join changes*, and the yardstick is how
 * much it moves when the sequence itself is replaced by a permutation of its
 * own terms. If shuffling the sequence moves the measure more than restyling
 * it does, shape is cosmetic - anything visible that survives a reshuffle
 * cannot be something the join produced.
 *
 * Deterministic: seeded surrogates, no canvas, no pixels.
 */
export function runLineShapeExperiment(
  seq: SequenceView,
  opts: { width: number; n: number; seed: number; size: Size },
): LineShapeVerdict {
  const real = screenPath(seq, opts.size);
  const shapes: ShapeResult[] = JOINS.map((join) => ({
    join,
    area: sweptArea(real, opts.width, join, 'butt'),
  }));
  const shapeSpread = range(shapes.map((s) => s.area));

  // Null arm: hold the join fixed and vary the sequence instead.
  const nullAreas: number[] = [];
  for (let j = 0; j < opts.n; j++) {
    const terms = makeSurrogate(seq.seq.terms, 'permutation', opts.seed + j);
    const surrogate: Sequence = { terms, name: 's', offset: 0, source: 'paste' };
    nullAreas.push(
      sweptArea(screenPath(new SequenceView(surrogate), opts.size), opts.width, 'miter', 'butt'),
    );
  }
  const nullSpread = range(nullAreas);

  const ratio = nullSpread === 0 ? Infinity : shapeSpread / nullSpread;
  return { shapeSpread, nullSpread, ratio, shapeMatters: ratio > 1, shapes };
}
