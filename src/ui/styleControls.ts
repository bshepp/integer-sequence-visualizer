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
  // One control rather than two toggles: the backgrounds are mutually
  // exclusive, so checkboxes would have an illegal fourth state to police.
  // 'theme' is the default and means the page theme still drives everything,
  // so nobody who is not deliberately making a figure has to learn this.
  const canvas = mkSelect('style-canvas', ['theme', 'white', 'black']);
  canvas.title =
    'What this panel draws on. "theme" follows the page. "white" and "black" '
    + 'pin it, and switch the ink to match, for figures leaving the site.';

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

  const labels = document.createElement('input');
  labels.type = 'checkbox';
  labels.className = 'style-labels';
  labels.title = 'Show the sequence and term count drawn on each panel.';

  // Black on the dark canvas is very nearly invisible. Auto-switching the
  // theme was rejected: a control that silently changes a *different* control
  // is worse than one that explains itself, which is the same call already
  // made on the null-model select. So it stays honest and says so instead.
  const blackHint = document.createElement('span');
  blackHint.className = 'style-hint';
  blackHint.hidden = true;
  blackHint.textContent = 'set Canvas to white to see these';

  const black = document.createElement('input');
  black.type = 'checkbox';
  black.className = 'style-black';
  black.title =
    'Force pure black, for print and for figures going into a paper. Overrides '
    + 'the colour settings, and needs the light theme to be visible at all.';

  function refresh(): void {
    width.value = String(style.lineWidth);
    join.value = style.lineJoin;
    cap.value = style.lineCap;
    mode.value = style.colorMode;
    hueStart.value = String(style.hueStart);
    hueEnd.value = String(style.hueEnd);
    overlap.checked = style.showOverlap;
    labels.checked = style.showLabels;
    black.checked = style.blackLine;
    canvas.value = style.canvas;
    // Black overrides every colour setting, so leaving those live would put
    // three controls on screen that cannot change anything - the same defect
    // already fixed on the hue sliders and the null-model select.
    mode.disabled = style.blackLine;
    mode.title = style.blackLine ? 'Turn off black lines to choose a colour' : '';
    // Only a problem when the panel actually ends up dark: pinning the canvas
    // to white makes black lines work whatever the page theme is, which is the
    // real fix rather than the caveat this used to be.
    const panelIsDark = style.canvas === 'black' || (style.canvas === 'theme'
      && document.documentElement.getAttribute('data-theme') === 'dark');
    blackHint.hidden = !(style.blackLine && panelIsDark);
    // The hue sliders do nothing in 'none' mode, and the end hue does nothing
    // in 'flat' mode. A live-looking control that cannot affect anything reads
    // as broken - the same defect fixed on the null-model select in round 1.
    hueStart.disabled = style.blackLine || style.colorMode === 'none';
    hueEnd.disabled = style.blackLine || style.colorMode !== 'spectrum';
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
  labels.addEventListener('change', () => { style.showLabels = labels.checked; onChange(); });
  canvas.addEventListener('change', () => {
    style.canvas = canvas.value as RenderStyle['canvas'];
    refresh();
    onChange();
  });
  black.addEventListener('change', () => {
    style.blackLine = black.checked;
    refresh();
    onChange();
  });

  el.append(
    labelledControl('Line width', width, { visible: true }),
    labelledControl('Line shape', join, { visible: true }),
    labelledControl('Line ends', cap, { visible: true }),
    labelledControl('Colour', mode, { visible: true }),
    labelledControl('Hue from', hueStart, { visible: true }),
    labelledControl('Hue to', hueEnd, { visible: true }),
    labelledControl('Show retreads', overlap, { visible: true }),
    labelledControl('Labels', labels, { visible: true }),
    labelledControl('Canvas', canvas, { visible: true }),
    labelledControl('Black lines', black, { visible: true }),
    blackHint,
  );
  refresh();
  return { el, refresh };
}
