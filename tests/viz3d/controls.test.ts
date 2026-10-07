// @vitest-environment jsdom
// tests/viz3d/controls.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildControls, stateFromQuery, type ControlState } from '../../src/viz3d/dev/controls';

const initial: ControlState = { vizId: 'turtle', aNumber: 'A000002', terms: 500, step: 0.5, nullOn: true };

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

  it('clamps the term count to the input\'s own max, matching the low-end clamp', () => {
    const onChange = vi.fn();
    const el = buildControls(initial, onChange);
    const termsInput = el.querySelector<HTMLInputElement>('input.terms')!;
    termsInput.value = '5000000'; // a typo away from a frozen tab - see finding 7
    termsInput.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith({ ...initial, terms: 100000 });
  });

  it('reports the null-model toggle', () => {
    const onChange = vi.fn();
    const el = buildControls(initial, onChange);
    const checkbox = el.querySelector<HTMLInputElement>('input.nulltoggle')!;
    expect(checkbox.checked).toBe(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith({ ...initial, nullOn: false });
  });
});

describe('stateFromQuery', () => {
  it('returns the base state untouched when the address names nothing', () => {
    expect(stateFromQuery('?3d', initial)).toEqual(initial);
  });

  it('reads the sequence, view, term count, lift and null toggle', () => {
    expect(stateFromQuery('?3d&viz=polyarc&seq=A000217&terms=2160&step=1.5&null=0', initial)).toEqual({
      vizId: 'polyarc', aNumber: 'A000217', terms: 2160, step: 1.5, nullOn: false,
    });
  });

  it("collects view parameters as overrides, so NCurve's settings are reachable", () => {
    const state = stateFromQuery('?3d&viz=polyarc&angle=1&modulus=360&offset=-180', initial);
    expect(state.params).toEqual({ angle: 1, modulus: 360, offset: -180 });
  });

  it('ignores a view it cannot lift and numbers that are not numbers', () => {
    const state = stateFromQuery('?3d&viz=scatter&terms=lots&modulus=abc', initial);
    expect(state.vizId).toBe('turtle');
    expect(state.terms).toBe(500);
    expect(state.params).toBeUndefined();
  });

  it('clamps the term count to what the control allows', () => {
    expect(stateFromQuery('?3d&terms=9999999', initial).terms).toBe(100000);
    expect(stateFromQuery('?3d&terms=0', initial).terms).toBe(2);
  });
});

describe('buildControls with parameter overrides', () => {
  const withParams: ControlState = { ...initial, vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180 } };

  it('keeps the overrides when another control changes', () => {
    const onChange = vi.fn();
    const el = buildControls(withParams, onChange);
    const slider = el.querySelector<HTMLInputElement>('input.step')!;
    slider.value = '2';
    slider.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith({ ...withParams, step: 2 });
  });

  it('drops the overrides when the view changes, since they were written for the old one', () => {
    const onChange = vi.fn();
    const el = buildControls(withParams, onChange);
    const select = el.querySelector<HTMLSelectElement>('select.viz')!;
    select.value = 'turtle';
    select.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledWith({ ...withParams, vizId: 'turtle', params: undefined });
  });
});
