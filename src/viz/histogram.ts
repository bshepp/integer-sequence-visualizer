import type { SequenceView } from '../sequence/sequence';
import { signedLogMagnitude } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { minMax } from './mathUtils';
import { strokeColorAt, styleFromParams } from './style';
import { canvasTheme } from './theme';

const MARGIN = 28;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampBig = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

export function computeHistogram(
  values: number[],
  binCount: number,
  domain?: { lo: number; hi: number },
): { edges: number[]; counts: number[] } {
  // `domain`, when supplied, pins the bin edges instead of deriving them from
  // whichever values this particular call happens to receive. This matters
  // for ensemble mode: percentileBands stacks column i across many
  // independent statistics() calls (one per surrogate draw) as though bin i
  // means the same value interval in every draw. Without a shared domain
  // each draw computes its own lo/hi from its own values, so bin i is a
  // *different* interval per draw - the stacked "band" is comparing
  // incommensurate bins and can report the real sequence as wildly outside
  // the null envelope when it is not (see task FR, C1: measured band 2..13
  // vs a fixed-domain band of 3..107 for the same real count of 46). The
  // caller (src/ui/app.ts) computes the domain once from the real sequence
  // and threads it into both the real-line statistics() call and every
  // EnsembleJob.params, the same way logScaleOverride already is. When
  // absent, direct/unit-test callers keep today's per-call auto-derived
  // behavior. Values outside the supplied domain are clamped into the
  // first/last bin rather than dropped - dropping would silently change the
  // total count, its own silent wrongness.
  const { lo, hi } = domain ?? minMax(values);
  const span = hi - lo || 1;
  const edges = Array.from({ length: binCount + 1 }, (_, i) => lo + (span * i) / binCount);
  const counts = new Array<number>(binCount).fill(0);
  for (const v of values) {
    const raw = Math.floor(((v - lo) / span) * binCount);
    const bin = Math.min(binCount - 1, Math.max(0, raw));
    counts[bin]!++;
  }
  return { edges, counts };
}

// A single term beyond float64-safe range is harmless in a value histogram -
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

// `logScaleOverride`, when provided, pins the terms-target linear/log
// decision instead of letting each call re-derive it from whatever sequence
// it happens to receive. This matters for ensemble mode: the real line calls
// statistics() once on the real sequence, while runEnsemble calls it once per
// surrogate draw. shouldUseLogScale(seq) is exact per-sequence, but nothing
// guarantees two different sequences agree on it - 'permutation' surrogates
// preserve the value multiset so they always agree by construction, but
// 'difference' and 'matched' surrogates do not, so a given draw can pick a
// different scale than the real line. Mixing scales across draws (or against
// the real line) means the bin edges each draw computes are not on
// comparable units - the exact "silently wrong, not a crash" failure mode
// BV-2's adaptive fallback exists to eliminate, just reintroduced across
// draws instead of within one sequence. The caller (src/ui/app.ts) computes
// the decision once from the real sequence and threads it into both the
// real-line statistics() call and every EnsembleJob.params dispatched to a
// surrogate draw, so every draw agrees. When absent, callers (including
// direct/unit-test use) keep today's per-sequence auto-detect behavior.
export function targetValues(seq: SequenceView, target: string, logScaleOverride?: boolean): number[] {
  const out: number[] = [];
  if (target === 'gaps') {
    // The gap itself is computed as an exact BigInt subtraction (never
    // clamped) regardless of scale. BV-2 fixed the 'terms' target's
    // clamp-collapse but left 'gaps' on clampBig alone: for a monotone
    // fast-growing sequence (e.g. Fibonacci) consecutive gaps overflow
    // float64-safe range too, and clamping piles them all into the same
    // MAX_SAFE_INTEGER value - measured: Fibonacci(300) gaps put 220 of 299
    // values in histogram's last bin. Reuse the same overflow decision
    // (shouldUseLogScale / logScaleOverride) 'terms' already uses, and when
    // it fires, use a *signed* log-magnitude transform - unlike terms (mostly
    // non-negative for real OEIS sequences), gaps routinely go negative for
    // non-monotone sequences, and an unsigned transform would relabel a
    // decrease as an increase of the same size.
    const useLog = logScaleOverride ?? shouldUseLogScale(seq);
    for (let i = 0; i + 1 < seq.length; i++) {
      const gap = seq.term(i + 1) - seq.term(i);
      out.push(useLog ? signedLogMagnitude(gap) : clampBig(gap));
    }
  } else if (target === 'digits') {
    for (let i = 0; i < seq.length; i++) out.push(...seq.digits(i));
  } else if (target === 'leading') {
    for (let i = 0; i < seq.length; i++) out.push(seq.digits(i)[0]!);
  } else if (target === 'logmagnitude') {
    for (let i = 0; i < seq.length; i++) out.push(seq.logMagnitude(i));
  } else {
    // target === 'terms': adaptively fall back to log-magnitude so the chart
    // never silently piles every overflowing term into one misleading bin.
    const useLog = logScaleOverride ?? shouldUseLogScale(seq);
    if (useLog) {
      for (let i = 0; i < seq.length; i++) out.push(seq.logMagnitude(i));
    } else {
      for (let i = 0; i < seq.length; i++) out.push(seq.toNumber(i));
    }
  }
  return out.length > 0 ? out : [0];
}

// Exported: differences.ts and autocorrelation.ts make the same kind of
// per-sequence log/linear decision (for their own overflow-prone
// computations) and need the same ensemble cross-draw sync story
// logScaleOverride documents above - one shared params key/reader so every
// site agrees on how the override is spelled, rather than three
// near-identical readers drifting apart.
export function overrideFromParams(params: Params): boolean | undefined {
  return typeof params.logScaleOverride === 'boolean' ? params.logScaleOverride : undefined;
}

// See computeHistogram's `domain` param doc above for why this exists.
// Encoded as two numbers (not one {lo,hi} object) because ParamValue is
// `number | string | boolean` - Params has no object variant.
function domainFromParams(params: Params): { lo: number; hi: number } | undefined {
  const lo = params.histogramDomainLo;
  const hi = params.histogramDomainHi;
  return typeof lo === 'number' && typeof hi === 'number' ? { lo, hi } : undefined;
}

export const histogramViz: Visualizer = {
  id: 'histogram',
  name: 'Histogram',
  family: 'stats',
  minTerms: 4,
  explain: {
    short: 'How often each value, gap, or digit occurs across the sequence.',
    long: 'Bins the chosen quantity and counts occurrences, discarding order entirely. Because order is discarded, a permutation null produces exactly the same histogram as the real sequence -- which is itself informative: it proves the histogram can only ever tell you about the value distribution, never about arrangement. Difference and matched-random nulls do move it.',
  },
  params: [
    { kind: 'select', id: 'target', label: 'Of', default: 'terms', options: ['terms', 'logmagnitude', 'gaps', 'digits', 'leading'] },
    { kind: 'number', id: 'bins', label: 'Bins', default: 20, min: 4, max: 60, step: 1 },
  ],
  statistics(seq: SequenceView, params: Params) {
    const { counts } = computeHistogram(
      targetValues(seq, String(params.target), overrideFromParams(params)),
      Number(params.bins),
      domainFromParams(params),
    );
    return { count: counts };
  },
  // No position(): a bin has no single term, so there is no screen point that
  // means "term i" in this view. Omitting it is the honest answer.
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const { edges, counts } = computeHistogram(
      targetValues(seq, String(params.target), overrideFromParams(params)),
      Number(params.bins),
      domainFromParams(params),
    );
    const w = size.width - 2 * MARGIN, h = size.height - 2 * MARGIN;
    if (x < MARGIN || x > MARGIN + w || y < MARGIN || y > MARGIN + h) return null;
    const binIndex = Math.min(counts.length - 1, Math.floor(((x - MARGIN) / w) * counts.length));
    if (binIndex < 0) return null;
    return {
      kind: 'bin' as const,
      binIndex,
      lo: edges[binIndex]!,
      hi: edges[binIndex + 1]!,
      count: counts[binIndex]!,
    };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const { counts } = computeHistogram(
      targetValues(seq, String(params.target), overrideFromParams(params)),
      Number(params.bins),
      domainFromParams(params),
    );
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const maxC = Math.max(minMax(counts).hi, 1);
    const bw = w / counts.length;
    ctx.fillStyle = strokeColorAt(styleFromParams(params), 0.5);
    for (let i = 0; i < counts.length; i++) {
      const bh = (counts[i]! / maxC) * h;
      ctx.fillRect(MARGIN + i * bw + 1, MARGIN + h - bh, Math.max(1, bw - 2), bh);
    }
    ctx.strokeStyle = canvasTheme().axis;
    ctx.strokeRect(MARGIN, MARGIN, w, h);
  },
};
