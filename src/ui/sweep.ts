import { SequenceView, type Sequence } from '../sequence/sequence';
import type { Params, Visualizer } from '../viz/types';

// `count` values spread uniformly across [min, max]. The endpoints (`min`, `max`)
// are always included exactly. Interior values are snapped to the step grid
// (relative to `min`) and clamped strictly inside (min, max) — this keeps the
// two ends exact even when `step` doesn't evenly divide the span. Deduplicated,
// ascending. `count` >= 2.
export function sweepValues(spec: { min: number; max: number; step: number }, count: number): number[] {
  const interior: number[] = [];
  for (let i = 1; i < count - 1; i++) {
    const raw = spec.min + ((spec.max - spec.min) * i) / (count - 1);
    const snapped = spec.min + Math.round((raw - spec.min) / spec.step) * spec.step;
    const clamped = Math.min(spec.max, Math.max(spec.min, snapped));
    if (clamped > spec.min && clamped < spec.max) interior.push(clamped);
  }
  return [...new Set([spec.min, ...interior, spec.max])];
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
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Parameter sweep over ${opts.paramId}`);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); opts.onClose(); }
  });

  const close = document.createElement('button');
  close.className = 'sweep-close';
  close.type = 'button';
  close.textContent = '× close';
  close.addEventListener('click', opts.onClose);
  overlay.appendChild(close);

  const grid = document.createElement('div');
  grid.className = 'sweep-grid';
  overlay.appendChild(grid);

  const view = new SequenceView(opts.seq);
  for (const value of sweepValues(spec, opts.count)) {
    // A <button>, not a <figure> with a click handler: the cells are the
    // entire point of this view and were unreachable by keyboard.
    const cell = document.createElement('button');
    cell.className = 'sweep-cell';
    cell.type = 'button';
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 140;
    // Decorative here — the caption below carries the meaning, and without
    // this each cell announces an extra unlabelled graphic.
    canvas.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span');
    caption.className = 'sweep-caption';
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
