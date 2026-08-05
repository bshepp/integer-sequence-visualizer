import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampBig = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

function derived(seq: SequenceView, mode: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < seq.length; i++) {
    if (mode === 'ratios') {
      const d = seq.toNumber(i);
      out.push(d === 0 ? 0 : seq.toNumber(i + 1) / d);
    } else {
      out.push(clampBig(seq.term(i + 1) - seq.term(i)));
    }
  }
  return out;
}

export const differencesViz: Visualizer = {
  id: 'differences',
  name: 'Differences & ratios',
  family: 'basic',
  minTerms: 3,
  params: [
    { kind: 'select', id: 'mode', label: 'Mode', default: 'differences', options: ['differences', 'ratios'] },
  ],
  statistics(seq: SequenceView, params: Params) {
    return { value: derived(seq, String(params.mode)) };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const vals = derived(seq, String(params.mode));
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, 1);
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const x = (i: number) => MARGIN + (i / Math.max(1, vals.length - 1)) * w;
    const y = (v: number) => MARGIN + h - ((v - lo) / (hi - lo || 1)) * h;

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y(0));
    ctx.lineTo(MARGIN + w, y(0));
    ctx.stroke();

    ctx.strokeStyle = '#7aa2f7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < vals.length; i++) {
      if (i === 0) ctx.moveTo(x(i), y(vals[i]!));
      else ctx.lineTo(x(i), y(vals[i]!));
    }
    ctx.stroke();
  },
};
