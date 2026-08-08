import { describe, it, expect } from 'vitest';
import { runLineShapeExperiment } from '../../src/experiments/lineShape';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { kolakoski } from '../../src/gallery/sequences';

const view = new SequenceView({
  terms: kolakoski(400), aNumber: 'A000002', name: 'Kolakoski', offset: 0, source: 'oeis',
} as Sequence);

const OPTS = { width: 4, n: 40, seed: 1, size: { width: 600, height: 600 } };

describe('line-shape experiment', () => {
  it('measures all three joins', () => {
    const v = runLineShapeExperiment(view, OPTS);
    expect(v.shapes.map((s) => s.join).sort()).toEqual(['bevel', 'miter', 'round']);
    for (const s of v.shapes) expect(s.area).toBeGreaterThan(0);
  });

  it('is deterministic under a fixed seed', () => {
    expect(runLineShapeExperiment(view, OPTS)).toEqual(runLineShapeExperiment(view, OPTS));
  });

  it('reports both spreads and their ratio', () => {
    const v = runLineShapeExperiment(view, OPTS);
    expect(v.shapeSpread).toBeGreaterThanOrEqual(0);
    expect(v.nullSpread).toBeGreaterThan(0);
    expect(v.ratio).toBeCloseTo(v.shapeSpread / v.nullSpread, 9);
  });

  it('sets shapeMatters only when shape moves the measure more than the null does', () => {
    const v = runLineShapeExperiment(view, OPTS);
    expect(v.shapeMatters).toBe(v.ratio > 1);
  });

  it('widening the stroke increases how much shape matters', () => {
    // Joins are a fixed-radius effect: their contribution grows as w^2 while
    // the body of the stroke grows as w, so a fatter line makes shape count
    // for relatively more. If this ever inverts, the model is wrong.
    const thin = runLineShapeExperiment(view, { ...OPTS, width: 1 });
    const fat = runLineShapeExperiment(view, { ...OPTS, width: 10 });
    expect(fat.ratio).toBeGreaterThan(thin.ratio);
  });
});
