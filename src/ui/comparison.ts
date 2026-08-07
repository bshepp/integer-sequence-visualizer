import type { Sequence } from '../sequence/sequence';
import { withTerms } from '../sequence/oeisClient';
import { makeSurrogate, type SurrogateType } from '../nullmodel/surrogates';
import type { Bands } from '../nullmodel/bands';
import type { Size } from '../viz/types';
import { minMax } from '../viz/mathUtils';

export type ComparisonMode = 'off' | 'side' | 'flip' | 'ensemble';

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
// compare false against epsilon and so read as "not degenerate" — intentional
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
// which — the single most important graphic in the app was unlabelled.
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
    // Loop-based min/max, not a spread — see turtle.ts's strokePath — since
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
      ctx.fillText('band has zero width — this surrogate cannot change this statistic', MARGIN, top + MARGIN - 4);
    }
  });
}

export function buildComparisonBar(
  state: ComparisonState,
  onChange: () => void,
): { el: HTMLElement; update(vizHasStats: boolean): void; refresh(): void } {
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

  const modeSel = mkSelect('mode-select', ['off', 'side', 'flip', 'ensemble'], state.mode,
    (v) => { state.mode = v as ComparisonMode; flipBtn.hidden = v !== 'flip'; });
  const surrSel = mkSelect('surrogate-select', ['permutation', 'difference', 'matched'], state.surrogate,
    (v) => { state.surrogate = v as SurrogateType; });
  const seedInput = mkNumber('seed-input', state.seed, 0, 2 ** 31, (v) => { state.seed = v; });
  const nInput = mkNumber('n-input', state.ensembleN, 1, 1000, (v) => { state.ensembleN = v; });

  const flipBtn = document.createElement('button');
  flipBtn.className = 'flip-button';
  flipBtn.textContent = 'Flip real / surrogate';
  flipBtn.hidden = state.mode !== 'flip';
  flipBtn.addEventListener('click', () => { state.showSurrogate = !state.showSurrogate; onChange(); });

  const label = (t: string) => {
    const s = document.createElement('span');
    s.className = 'bar-label';
    s.textContent = t;
    return s;
  };
  el.append(label('Compare:'), modeSel, label('null:'), surrSel, label('seed'), seedInput, label('N'), nInput, flipBtn);

  return {
    el,
    update(vizHasStats: boolean) {
      const opt = modeSel.querySelector<HTMLOptionElement>('option[value="ensemble"]')!;
      opt.disabled = !vizHasStats;
      if (!vizHasStats && state.mode === 'ensemble') { state.mode = 'off'; modeSel.value = 'off'; }
    },
    // Reflects `state` (mutated externally, e.g. by decoding a shared URL)
    // back onto the controls. Needed because the selects/inputs only push
    // changes into `state` on user interaction — they don't observe it.
    refresh() {
      modeSel.value = state.mode;
      surrSel.value = state.surrogate;
      seedInput.value = String(state.seed);
      nInput.value = String(state.ensembleN);
      flipBtn.hidden = state.mode !== 'flip';
    },
  };
}
