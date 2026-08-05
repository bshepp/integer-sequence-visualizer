import { describe, it, expect, vi, afterEach } from 'vitest';
import { runEnsemble, startEnsembleWorker, type EnsembleJob } from '../../src/nullmodel/ensemble';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { shouldUseLogScale } from '../../src/viz/histogram';

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

describe('runEnsemble: histogram log-scale must be synchronized across surrogate draws', () => {
  // Same construction as tests/viz/stats.test.ts: a real sequence whose own
  // auto-detected scale is log (two ~2e16 terms), and a 'difference'
  // surrogate seed (2) confirmed to disagree — shouldUseLogScale is FALSE
  // for that specific draw even though the real sequence's is TRUE.
  // ('permutation' surrogates are exactly value-multiset invariant and so
  // can never disagree; 'difference' and 'matched' are not.)
  //
  // count:1 pins the ensemble to exactly that one known-disagreeing draw —
  // percentileBands over a single array returns that array unchanged — so
  // this stays a deterministic, exact regression pin while still driving the
  // real runEnsemble pipeline (makeSurrogate + statistics() + percentileBands),
  // not just the shouldUseLogScale predicate in isolation. (A larger N was
  // tried and rejected: it also pulls in draws that are legitimately
  // clustered in value for reasons unrelated to this bug — e.g. several
  // surrogate terms landing close together after the huge gap lands early —
  // which independently produce a concentrated bin and would make the
  // "hi" band assertion no longer isolate the scale-sync defect.)
  const REAL = [
    0n, 10_000_000_000_000n, 20_000_000_000_000n, 30_000_000_000_000n, 40_000_000_000_000n,
    20_000_000_000_000_000n, 20_000_000_000_050_000n,
  ];
  const terms = REAL.map(String);
  const realView = new SequenceView({ terms: REAL, name: 'r', offset: 0, source: 'paste' } as Sequence);
  const override = shouldUseLogScale(realView);

  const ensembleJob = (params: EnsembleJob['params']): EnsembleJob => ({
    terms, surrogate: 'difference', count: 1, seed: 2, vizId: 'histogram', params,
  });

  it('real sequence auto-detects log scale', () => {
    expect(override).toBe(true);
  });

  it('without the override, the disagreeing draw collapses into one bin', () => {
    const { stats } = runEnsemble(ensembleJob({ target: 'terms', bins: 10 }));
    expect(Math.max(...stats.count!.hi)).toBeGreaterThanOrEqual(6);
  });

  it('with the override threaded through the draw, it no longer collapses', () => {
    const { stats } = runEnsemble(ensembleJob({ target: 'terms', bins: 10, logScaleOverride: override }));
    expect(Math.max(...stats.count!.hi)).toBeLessThanOrEqual(4);
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
