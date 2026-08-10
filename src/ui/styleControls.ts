import type { RenderStyle, ColorMode } from '../viz/style';
import { labelledControl } from './a11y';

export function buildStyleControls(
  style: RenderStyle,
  onChange: () => void,
): { el: HTMLElement; refresh(): void } {
  const el = document.createElement('div');
  el.className = 'style-controls';

  const width = document.createElement('input');
  width.type = 'range';
  width.className = 'style-width';
  width.min = '0.5'; width.max = '12'; width.step = '0.25';

  const mkSelect = (cls: string, options: string[]): HTMLSelectElement => {
    const sel = document.createElement('select');
    sel.className = cls;
    for (const v of options) {
      const o = document.createElement('option');
      o.value = o.textContent = v;
      sel.appendChild(o);
    }
    return sel;
  };

  const join = mkSelect('style-join', ['miter', 'round', 'bevel']);
  const cap = mkSelect('style-cap', ['butt', 'round', 'square']);
  const mode = mkSelect('style-colormode', ['spectrum', 'flat', 'none']);

  const hueStart = document.createElement('input');
  hueStart.type = 'range';
  hueStart.className = 'style-hue-start';
  hueStart.min = '0'; hueStart.max = '360'; hueStart.step = '1';

  const hueEnd = document.createElement('input');
  hueEnd.type = 'range';
  hueEnd.className = 'style-hue-end';
  hueEnd.min = '0'; hueEnd.max = '360'; hueEnd.step = '1';

  const overlap = document.createElement('input');
  overlap.type = 'checkbox';
  overlap.className = 'style-overlap';
  overlap.title =
    'Widen edges the path walks more than once. A cumulative walk can retrace '
    + 'its own steps, and stacked strokes otherwise look identical to a single one.';

  function refresh(): void {
    width.value = String(style.lineWidth);
    join.value = style.lineJoin;
    cap.value = style.lineCap;
    mode.value = style.colorMode;
    hueStart.value = String(style.hueStart);
    hueEnd.value = String(style.hueEnd);
    overlap.checked = style.showOverlap;
    // The hue sliders do nothing in 'none' mode, and the end hue does nothing
    // in 'flat' mode. A live-looking control that cannot affect anything reads
    // as broken - the same defect fixed on the null-model select in round 1.
    hueStart.disabled = style.colorMode === 'none';
    hueEnd.disabled = style.colorMode !== 'spectrum';
  }

  width.addEventListener('input', () => { style.lineWidth = Number(width.value); onChange(); });
  join.addEventListener('change', () => { style.lineJoin = join.value as CanvasLineJoin; onChange(); });
  cap.addEventListener('change', () => { style.lineCap = cap.value as CanvasLineCap; onChange(); });
  mode.addEventListener('change', () => {
    style.colorMode = mode.value as ColorMode;
    refresh();
    onChange();
  });
  hueStart.addEventListener('input', () => { style.hueStart = Number(hueStart.value); onChange(); });
  hueEnd.addEventListener('input', () => { style.hueEnd = Number(hueEnd.value); onChange(); });
  overlap.addEventListener('change', () => { style.showOverlap = overlap.checked; onChange(); });

  el.append(
    labelledControl('Line width', width, { visible: true }),
    labelledControl('Line shape', join, { visible: true }),
    labelledControl('Line ends', cap, { visible: true }),
    labelledControl('Colour', mode, { visible: true }),
    labelledControl('Hue from', hueStart, { visible: true }),
    labelledControl('Hue to', hueEnd, { visible: true }),
    labelledControl('Show retreads', overlap, { visible: true }),
  );
  refresh();
  return { el, refresh };
}
