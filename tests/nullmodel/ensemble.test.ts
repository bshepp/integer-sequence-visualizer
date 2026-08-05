import { describe, it, expect, vi, afterEach } from 'vitest';
import { runEnsemble, startEnsembleWorker, type EnsembleJob } from '../../src/nullmodel/ensemble';

const job = (over: Partial<EnsembleJob> = {}): EnsembleJob => ({
  terms: ['0', '1', '1', '2', '3', '5', '8', '13'],
  surrogate: 'permutation',
  count: 8,
  seed: 1,
  vizId: 'scatter',
  params: { scale: 'linear' },
  ...over,
});

describe('runEnsemble', () => {
  it('produces per-index bands matching the statistic length, deterministically', () => {
    const a = runEnsemble(job());
    const b = runEnsemble(job());
    expect(a).toEqual(b);
    expect(a.stats.value!.median.length).toBe(8);
    expect(a.stats.value!.lo.length).toBe(8);
  });

  it('permutation bands stay within the value range', () => {
    const { stats } = runEnsemble(job());
    for (const v of stats.value!.hi) expect(v).toBeLessThanOrEqual(13);
    for (const v of stats.value!.lo) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('reports progress and clamps count', () => {
    const seen: number[] = [];
    runEnsemble(job({ count: 5000 }), (done, total) => { seen.push(done); expect(total).toBe(1000); });
    expect(seen.length).toBe(1000);
  });

  it('throws for unknown viz or one without statistics', () => {
    expect(() => runEnsemble(job({ vizId: 'nope' }))).toThrow(/nope/);
    expect(() => runEnsemble(job({ vizId: 'turtle' }))).toThrow(/statistics/i);
  });
});

describe('startEnsembleWorker', () => {
  class FakeWorker {
    static last: FakeWorker | null = null;
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: { message?: string }) => void) | null = null;
    terminated = false;
    constructor(public url: URL, public opts?: WorkerOptions) { FakeWorker.last = this; }
    postMessage(_msg: unknown): void {}
    terminate(): void { this.terminated = true; }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.last = null;
  });

  it('reports worker load failures through onError and terminates', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    startEnsembleWorker(job(), { onProgress: () => {}, onResult: () => {}, onError });
    const w = FakeWorker.last!;
    expect(w.onerror).toBeTypeOf('function');
    w.onerror!({ message: 'boom' });
    expect(onError).toHaveBeenCalledWith('boom');
    expect(w.terminated).toBe(true);
  });

  it('falls back to a generic message when the error event has none', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    startEnsembleWorker(job(), { onProgress: () => {}, onResult: () => {}, onError });
    FakeWorker.last!.onerror!({});
    expect(onError).toHaveBeenCalledWith('Ensemble worker failed to load.');
  });
});
