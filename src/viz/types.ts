import type { SequenceView } from '../sequence/sequence';
import type { Hit } from './hit';

export interface Size { width: number; height: number; }
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;
export type ParamSpec =
  | { kind: 'number'; id: string; label: string; default: number; min: number; max: number; step: number }
  | { kind: 'select'; id: string; label: string; default: string; options: string[] }
  | { kind: 'boolean'; id: string; label: string; default: boolean };
export type VizFamily = 'grid' | 'trajectory' | 'stats' | 'basic';

export interface Explain {
  /** One line, shown under the picker. No newlines, <= 120 chars. */
  short: string;
  /** What it draws, and what a null model looks like in this view. */
  long: string;
}

export interface Visualizer {
  id: string;
  name: string;
  family: VizFamily;
  params: ParamSpec[];
  minTerms: number;
  /**
   * Required, deliberately. Optional would make coverage depend on
   * discipline; required means tsc refuses to compile until every visualizer
   * documents itself. The `long` text is also what the canvas reports as its
   * accessible description, so this doubles as the 508 text alternative.
   */
  explain: Explain;
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size): void;
  statistics?(seq: SequenceView, params: Params): Record<string, number[]>;
  /**
   * What is under the screen coordinate (x, y), or null.
   *
   * Optional: a view with no term-level answer (histogram, autocorrelation)
   * returns a non-term Hit kind, and a view with no answer at all may omit
   * this entirely.
   */
  locate?(seq: SequenceView, params: Params, size: Size, x: number, y: number): Hit | null;
  /** Inverse of locate for a term index - where that term is drawn. */
  position?(seq: SequenceView, params: Params, size: Size, index: number): { x: number; y: number } | null;
  /**
   * Where the drawing physically starts, for views that have a starting point
   * no term owns.
   *
   * A cumulative walk begins at an origin and then applies term 0, so
   * position(0) is the far end of the first segment, not the tip of the line.
   * Marking position(0) as "the start" therefore lands one step in from the
   * free end, which is visibly wrong on a walk and was reported as such.
   * docs/start-mark-off-by-one.png is the screenshot that caught it.
   *
   * Views whose first term IS their first mark - a scatter, a spiral, a
   * histogram - leave this undefined and position(0) is correct for them.
   */
  origin?(seq: SequenceView, params: Params, size: Size): { x: number; y: number } | null;
}

export function defaultParams(specs: ParamSpec[]): Params {
  const out: Params = {};
  for (const s of specs) out[s.id] = s.default;
  return out;
}
