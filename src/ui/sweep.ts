import { SequenceView, type Sequence } from '../sequence/sequence';
import type { Params, Visualizer } from '../viz/types';

export function sweepValues(spec: { min: number; max: number; step: number }, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const raw = spec.min + ((spec.max - spec.min) * i) / (count - 1);
    const snapped = spec.min + Math.round((raw - spec.min) / spec.step) * spec.step;
    out.push(Math.min(spec.max, snapped));
  }
  return [...new Set(out)];
}

export function buildSweepView(opts: {
  seq: Sequence;
  viz: Visualizer;
  baseParams: Params;
  paramId: string;
  count: number;
  onPick(value: number): void;
  onClose(): void;
}): HTMLElement {
  const spec = opts.viz.params.find((p) => p.id === opts.paramId);
  if (!spec || spec.kind !== 'number') throw new Error(`"${opts.paramId}" is not a numeric parameter.`);

  const overlay = document.createElement('div');
  overlay.className = 'sweep-overlay';

  const close = document.createElement('button');
  close.className = 'sweep-close';
  close.textContent = '× close';
  close.addEventListener('click', opts.onClose);
  overlay.appendChild(close);

  const grid = document.createElement('div');
  grid.className = 'sweep-grid';
  overlay.appendChild(grid);

  const view = new SequenceView(opts.seq);
  for (const value of sweepValues(spec, opts.count)) {
    const cell = document.createElement('figure');
    cell.className = 'sweep-cell';
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 140;
    const caption = document.createElement('figcaption');
    caption.textContent = `${opts.paramId} = ${value}`;
    cell.append(canvas, caption);
    cell.addEventListener('click', () => { opts.onPick(value); opts.onClose(); });
    grid.appendChild(cell);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#14161a';
      ctx.fillRect(0, 0, 180, 140);
      try {
        opts.viz.render(view, { ...opts.baseParams, [opts.paramId]: value }, ctx, { width: 180, height: 140 });
      } catch { /* a thumbnail failing must not break the grid */ }
    }
  }
  return overlay;
}
