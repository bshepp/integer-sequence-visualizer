import type { SequenceView } from '../sequence/sequence';
import { signedLogMagnitude } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { shouldUseLogScale, overrideFromParams } from './histogram';

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

// Beyond float64-safe range, toNumber() clamps — and once 2+ terms share that
// clamp, the series has a flat plateau that autocorrelates as smooth (fake)
// decay instead of reflecting the real sequence (measured: Fibonacci(2001)
// gives r[1] = 0.992 clamped vs 0.616 on the unclamped 50-term prefix — the
// clamping artifact, not the sequence, is what gets plotted). Falling back to
// the exact sign-preserving log-magnitude series avoids the plateau; it
// changes what's being correlated (magnitude-trend rather than raw value),
// which is why the caller labels the panel when this path is taken.
function seqValues(seq: SequenceView, useLog: boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < seq.length; i++) {
    out.push(useLog ? signedLogMagnitude(seq.term(i)) : seq.toNumber(i));
  }
  return out;
}

const LOG_SUFFIX = ' (log-magnitude scale — terms exceed float64-safe range)';

export const autocorrViz: Visualizer = {
  id: 'autocorr',
  name: 'Autocorrelation',
  family: 'stats',
  minTerms: 8,
  explain: {
    short: 'How strongly the sequence resembles itself shifted by k places.',
    long: 'For each lag k, correlates the sequence against a copy of itself displaced by k. Peaks indicate periodicity or near-periodicity at that spacing. This is a pure ordering statistic, so a permutation null destroys it completely -- a real sequence whose autocorrelation stays outside the null band at some lag has genuine repeating structure at that spacing.',
  },
  params: [
    { kind: 'number', id: 'maxLag', label: 'Max lag', default: 32, min: 4, max: 200, step: 1 },
  ],
  statistics(seq: SequenceView, params: Params) {
    const maxLag = Math.min(Number(params.maxLag), seq.length - 2);
    // See histogram.ts's logScaleOverride doc: ensemble mode calls
    // statistics() once per surrogate draw, so this per-sequence decision
    // must come from the single value app.ts computed once from the real
    // sequence (when provided) rather than being re-derived per draw —
    // otherwise draws could disagree on scale the same way C1 did for
    // histogram, and percentileBands would blend incompatible units.
    const useLog = overrideFromParams(params) ?? shouldUseLogScale(seq);
    const key = useLog ? `r${LOG_SUFFIX}` : 'r';
    return { [key]: autocorrelation(seqValues(seq, useLog), maxLag) };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const maxLag = Math.min(Number(params.maxLag), seq.length - 2);
    const useLog = overrideFromParams(params) ?? shouldUseLogScale(seq);
    const r = autocorrelation(seqValues(seq, useLog), maxLag);
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

    if (useLog) {
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '11px system-ui';
      ctx.fillText('r' + LOG_SUFFIX, MARGIN, MARGIN - 8);
    }
  },
};
