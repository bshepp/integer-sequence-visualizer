// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { sweepValues, buildSweepView } from '../../src/ui/sweep';
import { turtleViz } from '../../src/viz/turtle';
import { defaultParams } from '../../src/viz/types';

describe('sweepValues', () => {
  it('spans min..max snapped to step, deduped', () => {
    expect(sweepValues({ min: 2, max: 12, step: 1 }, 6)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(sweepValues({ min: 1, max: 3, step: 1 }, 12)).toEqual([1, 2, 3]);
  });

  it('always includes exact endpoints even when step misaligns with the span', () => {
    for (const [spec, count] of [
      [{ min: 0, max: 10, step: 3 }, 5],
      [{ min: 0, max: 10, step: 4 }, 4],
    ] as const) {
      const out = sweepValues(spec, count);
      expect(out[0]).toBe(spec.min);
      expect(out[out.length - 1]).toBe(spec.max);
      for (let i = 1; i < out.length; i++) expect(out[i]!).toBeGreaterThan(out[i - 1]!);
      for (const v of out.slice(1, -1)) expect((v - spec.min) % spec.step).toBe(0);
    }
  });
});

describe('buildSweepView', () => {
  const seq = { terms: [1n, 2n, 3n, 4n, 5n, 6n], name: 't', offset: 0, source: 'paste' as const };

  it('renders a cell per value and picks on click', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const el = buildSweepView({
      seq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
      paramId: 'angle', count: 6, onPick, onClose,
    });
    const cells = el.querySelectorAll('.sweep-cell');
    expect(cells.length).toBeGreaterThanOrEqual(2);
    (cells[0] as HTMLElement).click();
    expect(onPick).toHaveBeenCalledWith('angle', 1); // angle spec min is 1
    expect(onClose).toHaveBeenCalled();
  });

  it('close button closes without picking', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const el = buildSweepView({
      seq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
      paramId: 'angle', count: 4, onPick, onClose,
    });
    el.querySelector<HTMLButtonElement>('.sweep-close')!.click();
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });
});

import type { Sequence } from '../../src/sequence/sequence';

const sweepSeq: Sequence = {
  terms: Array.from({ length: 40 }, (_, i) => BigInt(i % 5)),
  name: 't', offset: 0, source: 'paste',
};

const mkSweep = (onPick: (id: string, v: number) => void = () => {}, onClose: () => void = () => {}) =>
  buildSweepView({
    seq: sweepSeq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
    paramId: 'k', count: 6, onPick, onClose,
  });

describe('sweep overlay accessibility', () => {
  it('is a labelled modal dialog', () => {
    const el = mkSweep();
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.getAttribute('aria-label')).toMatch(/sweep/i);
  });

  it('every cell is a button named for its value', () => {
    const el = mkSweep();
    const cells = el.querySelectorAll<HTMLButtonElement>('.sweep-cell');
    expect(cells.length).toBeGreaterThan(1);
    for (const c of cells) {
      expect(c.tagName).toBe('BUTTON');
      expect((c.textContent ?? '').trim()).toMatch(/k = \d+/);
    }
  });

  it('picking a cell reports its value and closes', () => {
    const picked: number[] = [];
    let closed = 0;
    const el = mkSweep((_id, v) => picked.push(v), () => { closed++; });
    el.querySelector<HTMLButtonElement>('.sweep-cell')!.click();
    expect(picked).toHaveLength(1);
    expect(closed).toBe(1);
  });

  it('Escape closes the dialog', () => {
    let closed = 0;
    const el = mkSweep(() => {}, () => { closed++; });
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(1);
  });

  it('hides the decorative thumbnails from assistive technology', () => {
    // The button's own text carries the meaning; otherwise every cell
    // announces an extra unlabelled graphic.
    const el = mkSweep();
    const canvases = el.querySelectorAll('canvas');
    expect(canvases.length).toBeGreaterThan(0);
    for (const c of canvases) expect(c.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('sweep parameter selection lives in the dialog', () => {
  it('offers every numeric parameter and never calls window.prompt', () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    const el = mkSweep();
    const picker = el.querySelector<HTMLSelectElement>('.sweep-param')!;
    // turtle has two numeric params: angle and k.
    expect([...picker.options].map((o) => o.value).sort()).toEqual(['angle', 'k']);
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('the parameter select is labelled', () => {
    const el = mkSweep();
    const picker = el.querySelector<HTMLSelectElement>('.sweep-param')!;
    const label = el.querySelector<HTMLLabelElement>(`label[for="${picker.id}"]`);
    expect(label, 'sweep parameter select has no label').not.toBeNull();
    expect(label!.textContent).toMatch(/parameter/i);
  });

  it('switching parameter re-renders the grid and reports the new id on pick', () => {
    const picks: Array<[string, number]> = [];
    const el = mkSweep((id, v) => picks.push([id, v]));
    const picker = el.querySelector<HTMLSelectElement>('.sweep-param')!;
    picker.value = 'angle';
    picker.dispatchEvent(new Event('change'));
    expect(el.querySelector('.sweep-cell')!.textContent).toMatch(/angle = /);
    el.querySelector<HTMLButtonElement>('.sweep-cell')!.click();
    expect(picks[0]![0]).toBe('angle');
  });
});
