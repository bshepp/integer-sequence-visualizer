import type { SequenceView } from '../sequence/sequence';

export interface Size { width: number; height: number; }
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;
export type ParamSpec =
  | { kind: 'number'; id: string; label: string; default: number; min: number; max: number; step: number }
  | { kind: 'select'; id: string; label: string; default: string; options: string[] }
  | { kind: 'boolean'; id: string; label: string; default: boolean };
export type VizFamily = 'grid' | 'trajectory' | 'stats' | 'basic';
export interface Visualizer {
  id: string;
  name: string;
  family: VizFamily;
  params: ParamSpec[];
  minTerms: number;
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size): void;
  statistics?(seq: SequenceView, params: Params): Record<string, number[]>;
}

export function defaultParams(specs: ParamSpec[]): Params {
  const out: Params = {};
  for (const s of specs) out[s.id] = s.default;
  return out;
}
