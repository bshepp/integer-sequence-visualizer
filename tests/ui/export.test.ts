// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildStyleControls } from '../../src/ui/styleControls';
import { DEFAULT_STYLE, type RenderStyle } from '../../src/viz/style';

describe('style controls', () => {
  it('exposes a labelled control for every style property', () => {
    const { el } = buildStyleControls({ ...DEFAULT_STYLE }, () => {});
    document.body.appendChild(el);
    const controls = el.querySelectorAll<HTMLElement>('input, select');
    expect(controls.length).toBeGreaterThanOrEqual(6);
    for (const c of controls) {
      const labelled = c.getAttribute('aria-label')
        || (c.id && el.querySelector(`label[for="${c.id}"]`))
        || c.closest('label');
      expect(labelled, `${c.className} unlabelled`).toBeTruthy();
    }
  });

  it('mutates the style object and notifies on change', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const onChange = vi.fn();
    const { el } = buildStyleControls(style, onChange);
    const join = el.querySelector<HTMLSelectElement>('.style-join')!;
    join.value = 'round';
    join.dispatchEvent(new Event('change'));
    expect(style.lineJoin).toBe('round');
    expect(onChange).toHaveBeenCalled();
  });

  it('offers "none" as a colour mode', () => {
    const { el } = buildStyleControls({ ...DEFAULT_STYLE }, () => {});
    const mode = el.querySelector<HTMLSelectElement>('.style-colormode')!;
    expect([...mode.options].map((o) => o.value)).toContain('none');
  });

  it('disables the hue sliders where they cannot affect anything', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const { el } = buildStyleControls(style, () => {});
    const mode = el.querySelector<HTMLSelectElement>('.style-colormode')!;
    const start = el.querySelector<HTMLInputElement>('.style-hue-start')!;
    const end = el.querySelector<HTMLInputElement>('.style-hue-end')!;

    expect(start.disabled).toBe(false);
    expect(end.disabled).toBe(false);

    mode.value = 'flat';
    mode.dispatchEvent(new Event('change'));
    expect(start.disabled).toBe(false); // flat still uses hueStart
    expect(end.disabled).toBe(true);

    mode.value = 'none';
    mode.dispatchEvent(new Event('change'));
    expect(start.disabled).toBe(true);
    expect(end.disabled).toBe(true);
  });

  it('refresh() pushes external mutations back onto the controls', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const { el, refresh } = buildStyleControls(style, () => {});
    style.lineWidth = 7;
    refresh();
    expect(el.querySelector<HTMLInputElement>('.style-width')!.value).toBe('7');
  });
});
