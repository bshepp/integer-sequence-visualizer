// @vitest-environment jsdom
// tests/viz3d/controls.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildControls, type ControlState } from '../../src/viz3d/dev/controls';

const initial: ControlState = { vizId: 'turtle', aNumber: 'A000002', terms: 500, step: 0.5 };

describe('buildControls', () => {
  it('offers exactly the views that support 3D', () => {
    const el = buildControls(initial, () => {});
    const options = [...el.querySelectorAll<HTMLOptionElement>('select.viz option')].map((o) => o.value);
    expect(options.sort()).toEqual(['digitwalk', 'polyarc', 'turtle']);
  });

  it('reports a new lift step without losing the rest of the state', () => {
    const onChange = vi.fn();
    const el = buildControls(initial, onChange);
    const slider = el.querySelector<HTMLInputElement>('input.step')!;
    slider.value = '1.5';
    slider.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith({ ...initial, step: 1.5 });
  });

  it('reports a view change', () => {
    const onChange = vi.fn();
    const el = buildControls(initial, onChange);
    const select = el.querySelector<HTMLSelectElement>('select.viz')!;
    select.value = 'digitwalk';
    select.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith({ ...initial, vizId: 'digitwalk' });
  });

  it('has a flat button that returns the step to zero', () => {
    const onChange = vi.fn();
    const el = buildControls(initial, onChange);
    el.querySelector<HTMLButtonElement>('button.flat')!.click();
    expect(onChange).toHaveBeenCalledWith({ ...initial, step: 0 });
  });
});
