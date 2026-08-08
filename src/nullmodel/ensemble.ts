import { SequenceView, type Sequence } from '../sequence/sequence';
import { makeSurrogate, type SurrogateType } from './surrogates';
import { percentileBands, type Bands } from './bands';
import { getVisualizer } from '../viz/registry';
import { registerAll } from '../viz/all';
import type { Params } from '../viz/types';

registerAll();

export interface EnsembleJob {
  terms: string[];
  surrogate: SurrogateType;
  count: number;
  seed: number;
  vizId: string;
  params: Params;
  levels?: number[];
}

export interface EnsembleResult { stats: Record<string, Bands>; }

export function runEnsemble(
  job: EnsembleJob,
  onProgress?: (done: number, total: number) => void,
): EnsembleResult {
  const viz = getVisualizer(job.vizId);
  if (!viz.statistics) throw new Error(`Visualizer "${job.vizId}" has no statistics() - ensemble mode unavailable.`);
  const terms = job.terms.map((t) => BigInt(t));
  const total = Math.max(1, Math.min(1000, Math.floor(job.count)));

  const collected: Record<string, number[][]> = {};
  for (let j = 0; j < total; j++) {
    const surrTerms = makeSurrogate(terms, job.surrogate, job.seed + j);
    const seq: Sequence = { terms: surrTerms, name: 'surrogate', offset: 0, source: 'paste' };
    const stats = viz.statistics(new SequenceView(seq), job.params);
    for (const [key, arr] of Object.entries(stats)) {
      (collected[key] ??= []).push(arr);
    }
    onProgress?.(j + 1, total);
  }

  const stats: Record<string, Bands> = {};
  for (const [key, arrays] of Object.entries(collected)) {
    stats[key] = percentileBands(arrays, job.levels ?? undefined);
  }
  return { stats };
}

export type EnsembleMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; stats: Record<string, Bands> }
  | { type: 'error'; message: string };

export function startEnsembleWorker(
  job: EnsembleJob,
  handlers: {
    onProgress(done: number, total: number): void;
    onResult(stats: Record<string, Bands>): void;
    onError(message: string): void;
  },
): { cancel(): void } {
  const worker = new Worker(new URL('./ensembleWorker.ts', import.meta.url), { type: 'module' });
  worker.onerror = (e) => {
    handlers.onError(e.message || 'Ensemble worker failed to load.');
    worker.terminate();
  };
  worker.onmessage = (e: MessageEvent<EnsembleMessage>) => {
    const msg = e.data;
    if (msg.type === 'progress') handlers.onProgress(msg.done, msg.total);
    else if (msg.type === 'result') { handlers.onResult(msg.stats); worker.terminate(); }
    else { handlers.onError(msg.message); worker.terminate(); }
  };
  worker.postMessage(job);
  return { cancel: () => worker.terminate() };
}
