import type { Sequence } from '../sequence/sequence';
import { withTerms } from '../sequence/oeisClient';
import { makeSurrogate, type SurrogateType } from '../nullmodel/surrogates';
import type { Bands } from '../nullmodel/bands';
import type { Size, Visualizer } from '../viz/types';
import { minMax } from '../viz/mathUtils';

export type ComparisonMode = 'off' | 'side' | 'over' | 'flip' | 'ensemble';

/**
 * Superimposing only means something where position carries information.
 * Grid and spiral layouts place term i at a position fixed by i alone, so
 * drawing the null on top overwrites the real cells rather than overlaying
 * them - it would look like a comparison while showing only the surrogate.
 */
export function supportsSuperimpose(viz: Visualizer): boolean {
  return viz.family === 'trajectory' || viz.family === 'basic';
}

export interface ComparisonState {
  mode: ComparisonMode;
  surrogate: SurrogateType;
  seed: number;
  showSurrogate: boolean;
  ensembleN: number;
}

export function defaultComparison(): ComparisonState {
  return { mode: 'off', surrogate: 'permutation', seed: 1, showSurrogate: false, ensembleN: 200 };
}

export function surrogateSequence(seq: Sequence, type: SurrogateType, seed: number): Sequence {
  const s = withTerms(seq, makeSurrogate(seq.terms, type, seed));
  return { ...s, name: `${seq.name} (${type} surrogate)` };
}

// Degenerate = the *widest* level has no width, i.e. no surrogate draw moved
// this statistic at all. NaN widths (e.g. malformed/empty upstream data)
// compare false against epsilon and so read as "not degenerate" - intentional
// fail-safe: drawing the (possibly odd-looking) band is preferable to
// asserting a specific "zero width" explanation we can't actually confirm. An
// empty level is vacuously degenerate (every() on []); harmless since
// drawEnsembleChart has nothing to plot for a zero-length band regardless.
export function isDegenerateBand(band: Bands, epsilon = 1e-9): boolean {
  const widest = band.levels[0];
  if (!widest) return true;
  return widest.lo.every((lo, i) => (widest.hi[i]! - lo) < epsilon);
}

// Drawn once per statistic panel. Without this the chart is a blue smear, a
// dashed grey line and a pink line with nothing on screen saying which is
// which - the single most important graphic in the app was unlabelled.
function drawLegend(ctx: CanvasRenderingContext2D, band: Bands, left: number, top: number): void {
  const items: Array<{ swatch: string; dashed?: boolean; label: string }> = [
    { swatch: '#f7768e', label: 'real sequence' },
    { swatch: '#9aa0aa', dashed: true, label: 'null median' },
    ...band.levels.map((l, i) => ({
      swatch: `rgba(122,162,247,${0.10 + i * 0.07})`,
      label: `${l.pct}% of nulls`,
    })),
  ];
  ctx.font = '11px system-ui';
  ctx.textBaseline = 'middle';
  let y = top;
  for (const item of items) {
    if (item.dashed) {
      ctx.strokeStyle = item.swatch;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + 14, y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = item.swatch;
      ctx.fillRect(left, y - 4, 14, 8);
    }
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText(item.label, left + 20, y);
    y += 14;
  }
  ctx.textBaseline = 'alphabetic';
}

export function drawEnsembleChart(
  ctx: CanvasRenderingContext2D,
  size: Size,
  real: Record<string, number[]>,
  bands: Record<string, Bands>,
): void {
  const keys = Object.keys(bands);
  if (keys.length === 0) return;
  const panelH = size.height / keys.length;
  const MARGIN = 30;

  keys.forEach((key, p) => {
    const band = bands[key]!;
    const realVals = real[key] ?? [];
    const top = p * panelH;
    const w = size.width - 2 * MARGIN;
    const h = panelH - 2 * MARGIN;
    const all = [...band.levels.flatMap((l) => [...l.lo, ...l.hi]), ...realVals];
    // Loop-based min/max, not a spread - see turtle.ts's strokePath - since
    // `all` scales with the sequence length for per-index statistics (e.g.
    // scatter's 'value').
    const { lo, hi } = minMax(all);
    const n = band.median.length;
    const x = (i: number) => MARGIN + (i / Math.max(1, n - 1)) * w;
    const y = (v: number) => top + MARGIN + h - ((v - lo) / (hi - lo || 1)) * h;

    // Band fill, wide-to-narrow with increasing opacity: the innermost level
    // reads darkest, so how deep inside (or how far outside) the real line
    // sits is legible without reading any numbers.
    band.levels.forEach((level, li) => {
      ctx.fillStyle = `rgba(122,162,247,${0.10 + li * 0.07})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(level.hi[i]!));
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(level.lo[i]!));
      ctx.closePath();
      ctx.fill();
    });

    // median (dashed)
    ctx.strokeStyle = '#9aa0aa';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(band.median[i]!));
    ctx.stroke();
    ctx.setLineDash([]);

    // real line
    ctx.strokeStyle = '#f7768e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < Math.min(n, realVals.length); i++) {
      (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(realVals[i]!));
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = '#e6e6e6';
    ctx.font = '12px system-ui';
    ctx.fillText(key, MARGIN, top + 16);

    drawLegend(ctx, band, size.width - MARGIN - 110, top + MARGIN);

    if (isDegenerateBand(band)) {
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '11px system-ui';
      // A couple of px shy of top + MARGIN (where the plot area/band fill
      // begins) so the caption can't crowd the plot when several stat panels
      // share the canvas height.
      ctx.fillText('band has zero width - this surrogate cannot change this statistic', MARGIN, top + MARGIN - 4);
    }
  });
}

export function buildComparisonBar(
  state: ComparisonState,
  onChange: () => void,
): { el: HTMLElement; update(vizHasStats: boolean, vizSupportsOver?: boolean): void; refresh(): void } {
  const el = document.createElement('div');
  el.className = 'comparison-bar';

  const mkSelect = (cls: string, options: string[], value: string, set: (v: string) => void) => {
    const sel = document.createElement('select');
    sel.className = cls;
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = o;
      sel.appendChild(opt);
    }
    sel.value = value;
    sel.addEventListener('change', () => { set(sel.value); onChange(); });
    return sel;
  };
  const mkNumber = (cls: string, value: number, min: number, max: number, set: (v: number) => void) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = cls;
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener('change', () => {
      const v = Math.max(min, Math.min(max, Number(input.value) || min));
      input.value = String(v);
      set(v);
      onChange();
    });
    return input;
  };

  // The surrogate select and the seed both feed the null model, and N feeds
  // the ensemble - none of which is consulted while mode is 'off'. Leaving
  // them live meant a user could cycle the null dropdown indefinitely with
  // nothing redrawing, which reads as a broken control rather than an unused
  // one. Considered and rejected: auto-switching mode to 'side' when the
  // surrogate changes - a control that silently changes a *different* control
  // is worse than one that is honestly unavailable.
  //
  // Declared as a hoisted function so the change handlers below can call it
  // even though surrSel/seedInput/nInput/flipBtn are declared after modeSel;
  // it is only ever *invoked* after all of them exist.
  function syncMode(): void {
    const off = state.mode === 'off';
    surrSel.disabled = off;
    seedInput.disabled = off;
    nInput.disabled = state.mode !== 'ensemble';
    surrSel.title = off ? 'Choose a comparison mode to use a null model' : '';
    flipBtn.hidden = state.mode !== 'flip';
    // 'flip' renders the real sequence first, so without this the mode looks
    // identical to 'off' until the button is found. Emphasising and focusing
    // it makes selecting the mode visibly do something.
    flipBtn.classList.toggle('flip-button--active', state.mode === 'flip');
  }

  const modeSel = mkSelect('mode-select', ['off', 'side', 'over', 'flip', 'ensemble'], state.mode,
    (v) => {
      state.mode = v as ComparisonMode;
      syncMode();
      if (state.mode === 'flip') flipBtn.focus();
    });
  const surrSel = mkSelect('surrogate-select', ['permutation', 'difference', 'matched'], state.surrogate,
    (v) => { state.surrogate = v as SurrogateType; });
  const seedInput = mkNumber('seed-input', state.seed, 0, 2 ** 31, (v) => { state.seed = v; });
  const nInput = mkNumber('n-input', state.ensembleN, 1, 1000, (v) => { state.ensembleN = v; });

  const flipBtn = document.createElement('button');
  flipBtn.className = 'flip-button';
  flipBtn.textContent = 'Flip real / surrogate';
  flipBtn.hidden = state.mode !== 'flip';
  flipBtn.addEventListener('click', () => { state.showSurrogate = !state.showSurrogate; onChange(); });

  // Real <label for> elements, not sibling <span>s: the bar previously
  // presented four unlabelled comboboxes to a screen reader.
  let uid = 0;
  const field = (text: string, control: HTMLElement): HTMLElement => {
    const wrap = document.createElement('label');
    wrap.className = 'bar-field';
    const id = `cmp-${++uid}`;
    control.id = id;
    wrap.htmlFor = id;
    const span = document.createElement('span');
    span.className = 'bar-label';
    span.textContent = text;
    wrap.append(span, control);
    return wrap;
  };

  el.append(
    field('Compare:', modeSel),
    field('null:', surrSel),
    field('seed', seedInput),
    field('N', nInput),
    flipBtn,
  );

  syncMode();

  return {
    el,
    update(vizHasStats: boolean, vizSupportsOver = true) {
      const ensembleOpt = modeSel.querySelector<HTMLOptionElement>('option[value="ensemble"]')!;
      ensembleOpt.disabled = !vizHasStats;
      const overOpt = modeSel.querySelector<HTMLOptionElement>('option[value="over"]')!;
      overOpt.disabled = !vizSupportsOver;
      if ((!vizHasStats && state.mode === 'ensemble') || (!vizSupportsOver && state.mode === 'over')) {
        // Forced back to 'off', so the null-model controls must go inert too.
        state.mode = 'off';
        modeSel.value = 'off';
        syncMode();
      }
    },
    // Reflects `state` (mutated externally, e.g. by decoding a shared URL)
    // back onto the controls. Needed because the selects/inputs only push
    // changes into `state` on user interaction - they don't observe it.
    refresh() {
      modeSel.value = state.mode;
      surrSel.value = state.surrogate;
      seedInput.value = String(state.seed);
      nInput.value = String(state.ensembleN);
      syncMode();
    },
  };
}
