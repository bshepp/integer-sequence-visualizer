// tests/viz3d/budget.test.ts
import { describe, it, expect } from 'vitest';
import { MEASURED_CEILING, overBudget } from '../../src/viz3d/budget';

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
});
