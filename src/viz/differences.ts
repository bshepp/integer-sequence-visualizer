import type { SequenceView } from '../sequence/sequence';
import { signedLogMagnitude } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { shouldUseLogScale, overrideFromParams } from './histogram';
import { minMax } from './mathUtils';

const MARGIN = 28;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampBig = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

function derived(seq: SequenceView, params: Params): number[] {
  const mode = String(params.mode);
  const out: number[] = [];
  if (mode === 'ratios') {
    // toNumber(i+1)/toNumber(i) clamps each side independently past
    // float64-safe range, so Fibonacci-style ratios go φ… up to the clamp
    // point, then exactly 1 forever (numerator and denominator saturate to
    // the same MAX_SAFE_INTEGER) — measured, and it is the single most
    // likely thing a user checks. term(i+1)/term(i) = 10^(logMag(i+1) -
    // logMag(i)) is exact to ~15 significant digits regardless of magnitude
    // and never saturates, so use that unconditionally (no shouldUseLogScale
    // branch, hence no ensemble cross-draw sync concern either — every draw
    // computes the identical formula).
    for (let i = 0; i + 1 < seq.length; i++) {
      const denom = seq.term(i);
      const numer = seq.term(i + 1);
      if (denom === 0n || numer === 0n) { out.push(0); continue; }
      const sign = (seq.sign(i + 1) as number) * (seq.sign(i) as number);
      out.push(sign * 10 ** (seq.logMagnitude(i + 1) - seq.logMagnitude(i)));
    }
  } else {
    // 'differences': already an exact BigInt subtraction; only the
    // clampBig() conversion to a plotted number was lossy. Measured:
    // Fibonacci(2001) differences collapse to a constant
    // 9007199254740991 from index 80 onward — one distinct value across
    // 1900 entries. Swap in the same sign-preserving log-magnitude fallback
    // 'gaps' uses in histogram.ts, gated the same way (shared
    // logScaleOverride so ensemble draws agree — see histogram.ts's doc).
    const useLog = overrideFromParams(params) ?? shouldUseLogScale(seq);
    for (let i = 0; i + 1 < seq.length; i++) {
      const d = seq.term(i + 1) - seq.term(i);
      out.push(useLog ? signedLogMagnitude(d) : clampBig(d));
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
    return { value: derived(seq, params) };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const vals = derived(seq, params);
    const { lo: rawLo, hi: rawHi } = minMax(vals);
    const lo = Math.min(rawLo, 0);
    const hi = Math.max(rawHi, 1);
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
