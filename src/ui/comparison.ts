import type { Sequence } from '../sequence/sequence';
import { withTerms } from '../sequence/oeisClient';
import { makeSurrogate, type SurrogateType } from '../nullmodel/surrogates';
import type { Bands } from '../nullmodel/bands';
import type { Size } from '../viz/types';

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

export function isDegenerateBand(band: Bands, epsilon = 1e-9): boolean {
  return band.lo.every((lo, i) => (band.hi[i]! - lo) < epsilon);
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
    const all = [...band.lo, ...band.hi, ...realVals];
    const lo = Math.min(...all), hi = Math.max(...all);
    const n = band.median.length;
    const x = (i: number) => MARGIN + (i / Math.max(1, n - 1)) * w;
    const y = (v: number) => top + MARGIN + h - ((v - lo) / (hi - lo || 1)) * h;

    // band fill
    ctx.fillStyle = 'rgba(122,162,247,0.18)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(band.hi[i]!));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(band.lo[i]!));
    ctx.closePath();
    ctx.fill();

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

    if (isDegenerateBand(band)) {
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '11px system-ui';
      ctx.fillText('band has zero width — this surrogate cannot change this statistic', MARGIN, top + 30);
    }
  });
}

export function buildComparisonBar(
  state: ComparisonState,
  onChange: () => void,
): { el: HTMLElement; update(vizHasStats: boolean): void } {
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
  };
}
