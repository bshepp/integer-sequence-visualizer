import { describe, it, expect, beforeAll } from 'vitest';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, clearRegistry } from '../../src/viz/registry';
import { SURROGATE_EXPLAIN } from '../../src/nullmodel/surrogates';

beforeAll(() => { clearRegistry(); registerAll(); });

describe('visualizer explanations', () => {
  it('registers all nine visualizers', () => {
    expect(allVisualizers()).toHaveLength(9);
  });

  for (const key of ['short', 'long'] as const) {
    it(`every visualizer has a non-empty explain.${key}`, () => {
      for (const v of allVisualizers()) {
        const text = v.explain[key];
        expect(typeof text, `${v.id}.explain.${key}`).toBe('string');
        expect(text.trim().length, `${v.id}.explain.${key} is empty`).toBeGreaterThan(0);
      }
    });
  }

  it('long explanations are substantive and mention the null model', () => {
    for (const v of allVisualizers()) {
      expect(v.explain.long.length, `${v.id}.explain.long too short`).toBeGreaterThan(80);
      expect(/null|surrogate|shuffl/i.test(v.explain.long), `${v.id}.explain.long never mentions the null`).toBe(true);
    }
  });

  it('short explanations stay on one line', () => {
    for (const v of allVisualizers()) {
      expect(v.explain.short).not.toContain('\n');
      expect(v.explain.short.length, `${v.id}.explain.short too long`).toBeLessThanOrEqual(120);
    }
  });
});

describe('surrogate explanations', () => {
  it('documents all three surrogate types', () => {
    for (const type of ['permutation', 'difference', 'matched'] as const) {
      expect(SURROGATE_EXPLAIN[type].short.trim().length).toBeGreaterThan(0);
      expect(SURROGATE_EXPLAIN[type].long.length).toBeGreaterThan(80);
    }
  });

  it('says which surrogates preserve the value multiset', () => {
    expect(/multiset|same values|same terms/i.test(SURROGATE_EXPLAIN.permutation.long)).toBe(true);
  });
});
