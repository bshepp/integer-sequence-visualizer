import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { minMax } from './mathUtils';

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
  explain: {
    short: 'Each term plotted against its position in the sequence.',
    long: 'The plainest possible view: term value on the vertical axis, index along the horizontal. Growth rate, sign changes, and outliers are all visible here before any other technique is applied. Under a permutation null the same values reappear in scrambled order, so anything that survives the shuffle is a property of the value distribution rather than of the ordering.',
  },
  params: [
    { kind: 'select', id: 'scale', label: 'Scale', default: 'linear', options: ['linear', 'log'] },
  ],
  statistics(seq: SequenceView, params: Params) {
    // Must match render()'s values() exactly: render folds sign into log
    // magnitude (so a negative term plots below zero on the log axis, same
    // side as it does on linear); statistics used to skip that fold, so
    // switching a signed sequence from 'off' to 'ensemble' silently swapped
    // a monotone curve (render) for a V-shaped one (the old unsigned
    // statistics) — comparing the real line against a null band computed on
    // a different-shaped quantity than what's drawn. Reuse values() itself
    // rather than re-deriving the same formula a second time.
    return { value: values(seq, String(params.scale)) };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const vals = values(seq, String(params.scale));
    const { lo: rawLo, hi: rawHi } = minMax(vals);
    const lo = Math.min(rawLo, 0);
    const hi = Math.max(rawHi, 1);
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
