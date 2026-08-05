import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;

export function autocorrelation(values: number[], maxLag: number): number[] {
  const n = values.length;
  const mu = values.reduce((s, v) => s + v, 0) / n;
  const dev = values.map((v) => v - mu);
  const denom = dev.reduce((s, d) => s + d * d, 0);
  const out: number[] = [];
  for (let k = 0; k <= maxLag; k++) {
    if (denom === 0) { out.push(0); continue; }
    let num = 0;
    for (let i = 0; i + k < n; i++) num += dev[i]! * dev[i + k]!;
    out.push(num / denom);
  }
  return out;
}

function seqValues(seq: SequenceView): number[] {
  const out: number[] = [];
  for (let i = 0; i < seq.length; i++) out.push(seq.toNumber(i));
  return out;
}

export const autocorrViz: Visualizer = {
  id: 'autocorr',
  name: 'Autocorrelation',
  family: 'stats',
  minTerms: 8,
  params: [
    { kind: 'number', id: 'maxLag', label: 'Max lag', default: 32, min: 4, max: 200, step: 1 },
  ],
  statistics(seq: SequenceView, params: Params) {
    const maxLag = Math.min(Number(params.maxLag), seq.length - 2);
    return { r: autocorrelation(seqValues(seq), maxLag) };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const maxLag = Math.min(Number(params.maxLag), seq.length - 2);
    const r = autocorrelation(seqValues(seq), maxLag);
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const x = (k: number) => MARGIN + (k / Math.max(1, r.length - 1)) * w;
    const y = (v: number) => MARGIN + h / 2 - v * (h / 2);

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(MARGIN, y(0));
    ctx.lineTo(MARGIN + w, y(0));
    ctx.stroke();

    ctx.strokeStyle = '#7aa2f7';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < r.length; k++) {
      ctx.beginPath();
      ctx.moveTo(x(k), y(0));
      ctx.lineTo(x(k), y(r[k]!));
      ctx.stroke();
    }
  },
};
