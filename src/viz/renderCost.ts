import type { Params } from './types';
import { segmentsForParams } from './polyarc';

/**
 * What a redraw will cost, so a warning about it can be true.
 *
 * The b-file controls used to warn on term count alone, with copy that named
 * "the curve views" whichever view was loaded. On the autocorrelation view that
 * is a false alarm by a factor of a hundred - 20,000 terms costs 7ms there -
 * and a warning that cries wolf on the cheap views is worse than no warning,
 * because it teaches the reader to ignore the one that matters.
 *
 * The coefficients are measured, not guessed. One panel, 1200x700, default
 * parameters, min of three runs after a warm-up, drawing the real render():
 *
 *     view          20,000 terms      us/term
 *     histogram            5ms          0.25
 *     autocorr             7ms          0.35
 *     differences         23ms          1.15
 *     modgrid             23ms          1.15
 *     scatter             28ms          1.40
 *     ulam                28ms          1.40
 *     turtle              53ms          2.65
 *     digitwalk          337ms         16.90
 *     polyarc            532ms         26.60   (8 samples/term at its defaults)
 *
 * Only polyarc gets a computed model rather than a constant, because it is the
 * only view whose cost moves by an order of magnitude with its own parameters:
 * the same 20,000 terms is 532ms at the default modulus of 7 and 1,425ms at the
 * hero's 187, because a sharply bending term needs 36 samples where a gentle one
 * needs 8.
 *
 * Accuracy: about +/-50%, and deliberately not better. Per-segment cost is not
 * constant - a sub-pixel arc covers almost no pixels and rasterises nearly free,
 * so cost per segment falls as term counts rise and features shrink. Modelling
 * that properly would be a research project to choose between three words. The
 * estimate only has to land in the right band.
 */

/** Microseconds per term, one panel, at default parameters. */
const US_PER_TERM: Record<string, number> = {
  histogram: 0.25,
  autocorr: 0.35,
  differences: 1.15,
  modgrid: 1.15,
  scatter: 1.4,
  ulam: 1.4,
  turtle: 2.65,
  digitwalk: 16.9,
};

/**
 * Microseconds per drawn segment for the polyarc.
 *
 * Back-calculated from both ends of the measured range - 532ms over 160,000
 * segments at the defaults, 1,425ms over 720,000 at the hero's settings - which
 * give 3.3 and 2.0 respectively. The spread is the sub-pixel effect above. 3.0
 * sits near the expensive end so the estimate errs towards warning.
 */
const US_PER_SEGMENT = 3.0;

/** A view nobody has measured. Priced at the median rather than at zero. */
const US_PER_TERM_UNKNOWN = 1.4;

export type CostBand = 'ok' | 'caution' | 'hot';

/**
 * Thresholds in milliseconds for a whole frame, both panels included.
 *
 * 200ms is roughly where a redraw stops feeling immediate; 800ms is where it
 * stops feeling like a redraw at all and starts feeling like the page has
 * stopped. Stated for the frame rather than per panel because a side-by-side
 * comparison draws twice and that is the common case.
 */
const CAUTION_MS = 200, HOT_MS = 800;

/** Estimated milliseconds to draw one panel of `terms` terms. */
export function estimateRenderMs(vizId: string, params: Params, terms: number): number {
  if (terms <= 0) return 0;
  if (vizId === 'polyarc') {
    const opts = {
      angle: Number(params.angle) || 1,
      modulus: Number(params.modulus) || 2,
      offset: Number(params.offset) || 0,
    };
    return (segmentsForParams(terms, opts) * terms * US_PER_SEGMENT) / 1000;
  }
  return ((US_PER_TERM[vizId] ?? US_PER_TERM_UNKNOWN) * terms) / 1000;
}

/** Estimated milliseconds for a whole frame: one panel, or two in a comparison. */
export function estimateFrameMs(
  vizId: string, params: Params, terms: number, panels = 2,
): number {
  return estimateRenderMs(vizId, params, terms) * panels;
}

export function bandFor(frameMs: number): CostBand {
  return frameMs >= HOT_MS ? 'hot' : frameMs >= CAUTION_MS ? 'caution' : 'ok';
}

/** Rounded the way it would be said aloud, since it is an estimate either way. */
function saySeconds(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} seconds` : `${Math.round(ms / 50) * 50} ms`;
}

/**
 * The warning, naming the view it is about.
 *
 * Returns null when there is nothing worth saying, which for the stats views is
 * every term count this app can reach.
 */
export function costMessage(
  vizName: string, vizId: string, params: Params, terms: number,
): string | null {
  const ms = estimateFrameMs(vizId, params, terms);
  const band = bandFor(ms);
  if (band === 'ok') return null;
  const cost = `about ${saySeconds(ms)}`;
  if (band === 'hot') {
    return `At ${terms.toLocaleString()} terms the ${vizName} view takes ${cost} to redraw, `
      + 'and the page stops responding while it draws. Every change redraws it.';
  }
  return `At ${terms.toLocaleString()} terms the ${vizName} view takes ${cost} to redraw, `
    + 'and every change redraws it.';
}
