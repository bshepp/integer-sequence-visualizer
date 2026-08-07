// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  defaultComparison, surrogateSequence, drawEnsembleChart, buildComparisonBar, isDegenerateBand,
} from '../../src/ui/comparison';
import type { Bands } from '../../src/nullmodel/bands';
import { fakeCtx } from '../helpers/fakeCtx';

// Builds the nested-level shape from a single flat lo/median/hi triple, so
// these tests keep expressing one band the way they always did.
const flat = (lo: number[], median: number[], hi: number[]): Bands =>
  ({ median, levels: [{ pct: 90, lo, hi }] });

const seq = { terms: [1n, 2n, 3n, 4n, 5n], name: 'Test', offset: 0, source: 'paste' as const };

describe('surrogateSequence', () => {
  it('replaces terms with a same-multiset surrogate and renames', () => {
    const s = surrogateSequence(seq, 'permutation', 7);
    expect(s.terms.length).toBe(5);
    expect([...s.terms].sort()).toEqual([1n, 2n, 3n, 4n, 5n]);
    expect(s.name).toContain('surrogate');
    expect(seq.terms).toEqual([1n, 2n, 3n, 4n, 5n]); // original untouched
  });
});

describe('drawEnsembleChart', () => {
  it('draws without throwing for two stat keys', () => {
    const { ctx } = fakeCtx();
    const bands = flat([0, 0], [1, 1], [2, 2]);
    expect(() =>
      drawEnsembleChart(ctx, { width: 400, height: 300 },
        { a: [1.5, 0.5], b: [0, 1] }, { a: bands, b: bands }),
    ).not.toThrow();
  });
});

describe('isDegenerateBand', () => {
  it('is true when lo/median/hi are all equal arrays', () => {
    const band = flat([1, 2, 3], [1, 2, 3], [1, 2, 3]);
    expect(isDegenerateBand(band)).toBe(true);
  });
  it('is false when hi exceeds lo at any index', () => {
    const band = flat([1, 2, 3], [1, 2, 3], [1, 2, 5]);
    expect(isDegenerateBand(band)).toBe(false);
  });
});

describe('drawEnsembleChart degenerate band caption', () => {
  it('records a fillText call explaining the zero-width band', () => {
    const { ctx, callLog } = fakeCtx();
    const band = flat([1, 1], [1, 1], [1, 1]);
    drawEnsembleChart(ctx, { width: 400, height: 300 }, { a: [1, 1] }, { a: band });
    const texts = callLog.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
    expect(texts.some((t) => t.toLowerCase().includes('zero width'))).toBe(true);
  });

  it('does not add the caption for a normal (non-degenerate) band', () => {
    const { ctx, callLog } = fakeCtx();
    const band = flat([0, 0], [1, 1], [2, 2]);
    drawEnsembleChart(ctx, { width: 400, height: 300 }, { a: [1.5, 0.5] }, { a: band });
    const texts = callLog.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
    expect(texts.some((t) => t.toLowerCase().includes('zero width'))).toBe(false);
  });
});

describe('buildComparisonBar', () => {
  it('exposes mode/surrogate/seed controls and mutates state', () => {
    const state = defaultComparison();
    const onChange = vi.fn();
    const { el } = buildComparisonBar(state, onChange);
    const mode = el.querySelector<HTMLSelectElement>('.mode-select')!;
    mode.value = 'flip';
    mode.dispatchEvent(new Event('change'));
    expect(state.mode).toBe('flip');
    expect(onChange).toHaveBeenCalled();
    const seed = el.querySelector<HTMLInputElement>('.seed-input')!;
    seed.value = '42';
    seed.dispatchEvent(new Event('change'));
    expect(state.seed).toBe(42);
  });

  it('update(false) disables the ensemble option', () => {
    const { el, update } = buildComparisonBar(defaultComparison(), () => {});
    update(false);
    const opt = el.querySelector<HTMLOptionElement>('.mode-select option[value="ensemble"]')!;
    expect(opt.disabled).toBe(true);
    update(true);
    expect(opt.disabled).toBe(false);
  });
});
