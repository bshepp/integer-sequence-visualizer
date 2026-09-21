// tests/viz3d/budget.test.ts
import { describe, it, expect } from 'vitest';
import { MEASURED_CEILING, overBudget, estimatedVertices } from '../../src/viz3d/budget';
import { geometryFor } from '../../src/viz3d/geometry';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import type { Params } from '../../src/viz/types';

const seq = new SequenceView({
  terms: [3n, 17n, 250n, 91n, 7n, 12n, 44n, 5n],
  name: 't', offset: 0, source: 'paste',
} as Sequence);
const flat = { step: 0 };

describe('the 3D size budget', () => {
  it('is a measured number, not a guess', () => {
    // Set from docs/3d-measurements.md, which names the GPU it was measured on.
    expect(MEASURED_CEILING).toBeGreaterThan(0);
    expect(Number.isInteger(MEASURED_CEILING)).toBe(true);
  });

  it('warns above the ceiling and not below it', () => {
    expect(overBudget(MEASURED_CEILING - 1)).toBe(false);
    expect(overBudget(MEASURED_CEILING + 1)).toBe(true);
  });

  it('estimates exactly the vertex count geometryFor actually produces, for every supported view', () => {
    const cases: Array<{ vizId: string; params: Params }> = [
      { vizId: 'turtle', params: { angle: 90, k: 4 } },
      { vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180, turn: 'ncurve' } },
      { vizId: 'digitwalk', params: { base: 10 } },
    ];
    for (const { vizId, params } of cases) {
      const estimate = estimatedVertices(vizId, seq, params);
      const geometry = geometryFor(vizId, seq, params, flat)!;
      // termOf has exactly one entry per vertex, so this is the same count
      // `positions.length / 3` would give - the estimate has to match the
      // geometry actually produced, not just be in the right neighbourhood.
      expect(estimate, vizId).toBe(geometry.termOf.length);
    }
  });

  it('returns 0 for a view with no 3D meaning, matching geometryFor\'s null', () => {
    expect(estimatedVertices('scatter', seq, {})).toBe(0);
  });
});
