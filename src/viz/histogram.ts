import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampBig = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

export function computeHistogram(values: number[], binCount: number): { edges: number[]; counts: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const edges = Array.from({ length: binCount + 1 }, (_, i) => lo + (span * i) / binCount);
  const counts = new Array<number>(binCount).fill(0);
  for (const v of values) {
    const bin = Math.min(binCount - 1, Math.floor(((v - lo) / span) * binCount));
    counts[bin]!++;
  }
  return { edges, counts };
}

// A single term beyond float64-safe range is harmless in a value histogram —
// it's only when 2+ distinct terms collapse onto the same clamped value that
// the chart becomes misleading (they all pile into one bin).
const LOG_SAFE_THRESHOLD = 15.9; // log10(2^53) ≈ 15.95

export function shouldUseLogScale(seq: SequenceView): boolean {
  let overflowCount = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq.logMagnitude(i) > LOG_SAFE_THRESHOLD) {
      overflowCount++;
      if (overflowCount > 1) return true;
    }
  }
  return false;
}

function targetValues(seq: SequenceView, target: string): number[] {
  const out: number[] = [];
  if (target === 'gaps') {
    for (let i = 0; i + 1 < seq.length; i++) out.push(clampBig(seq.term(i + 1) - seq.term(i)));
  } else if (target === 'digits') {
    for (let i = 0; i < seq.length; i++) out.push(...seq.digits(i));
  } else if (target === 'leading') {
    for (let i = 0; i < seq.length; i++) out.push(seq.digits(i)[0]!);
  } else if (target === 'logmagnitude') {
    for (let i = 0; i < seq.length; i++) out.push(seq.logMagnitude(i));
  } else {
    // target === 'terms': adaptively fall back to log-magnitude so the chart
    // never silently piles every overflowing term into one misleading bin.
    if (shouldUseLogScale(seq)) {
      for (let i = 0; i < seq.length; i++) out.push(seq.logMagnitude(i));
    } else {
      for (let i = 0; i < seq.length; i++) out.push(seq.toNumber(i));
    }
  }
  return out.length > 0 ? out : [0];
}

export const histogramViz: Visualizer = {
  id: 'histogram',
  name: 'Histogram',
  family: 'stats',
  minTerms: 4,
  params: [
    { kind: 'select', id: 'target', label: 'Of', default: 'terms', options: ['terms', 'logmagnitude', 'gaps', 'digits', 'leading'] },
    { kind: 'number', id: 'bins', label: 'Bins', default: 20, min: 4, max: 60, step: 1 },
  ],
  statistics(seq: SequenceView, params: Params) {
    const { counts } = computeHistogram(targetValues(seq, String(params.target)), Number(params.bins));
    return { count: counts };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const { counts } = computeHistogram(targetValues(seq, String(params.target)), Number(params.bins));
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const maxC = Math.max(...counts, 1);
    const bw = w / counts.length;
    ctx.fillStyle = '#7aa2f7';
    for (let i = 0; i < counts.length; i++) {
      const bh = (counts[i]! / maxC) * h;
      ctx.fillRect(MARGIN + i * bw + 1, MARGIN + h - bh, Math.max(1, bw - 2), bh);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(MARGIN, MARGIN, w, h);
  },
};
