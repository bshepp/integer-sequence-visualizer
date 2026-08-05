import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;

function values(seq: SequenceView, scale: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < seq.length; i++) {
    out.push(scale === 'log' ? seq.logMagnitude(i) * (seq.sign(i) < 0 ? -1 : 1) : seq.toNumber(i));
  }
  return out;
}

export const scatterViz: Visualizer = {
  id: 'scatter',
  name: 'Term vs index',
  family: 'basic',
  minTerms: 2,
  params: [
    { kind: 'select', id: 'scale', label: 'Scale', default: 'linear', options: ['linear', 'log'] },
  ],
  statistics(seq: SequenceView, params: Params) {
    // NOTE: statistics uses plain log-magnitude (no sign fold) so bands stay simple
    const out: number[] = [];
    for (let i = 0; i < seq.length; i++) {
      out.push(params.scale === 'log' ? seq.logMagnitude(i) : seq.toNumber(i));
    }
    return { value: out };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const vals = values(seq, String(params.scale));
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, 1);
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const x = (i: number) => MARGIN + (i / Math.max(1, vals.length - 1)) * w;
    const y = (v: number) => MARGIN + h - ((v - lo) / (hi - lo || 1)) * h;

    // zero axis
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y(0));
    ctx.lineTo(MARGIN + w, y(0));
    ctx.stroke();

    ctx.fillStyle = '#7aa2f7';
    const r = vals.length > 400 ? 1.5 : 3;
    for (let i = 0; i < vals.length; i++) {
      ctx.beginPath();
      ctx.arc(x(i), y(vals[i]!), r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
