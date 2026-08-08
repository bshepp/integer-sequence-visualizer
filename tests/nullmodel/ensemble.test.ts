import { describe, it, expect, vi, afterEach } from 'vitest';
import { runEnsemble, startEnsembleWorker, type EnsembleJob } from '../../src/nullmodel/ensemble';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { shouldUseLogScale, computeHistogram } from '../../src/viz/histogram';
import { bandAt, type Bands } from '../../src/nullmodel/bands';

// The 90% level is exactly the old flat 5-95 band, so these regression
// assertions keep the precise meaning they were written with.
const L90 = (b: Bands) => bandAt(b, 90)!;

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
    expect(L90(a.stats.value!).lo.length).toBe(8);
  });

  it('permutation bands stay within the value range', () => {
    const { stats } = runEnsemble(job());
    for (const v of L90(stats.value!).hi) expect(v).toBeLessThanOrEqual(13);
    for (const v of L90(stats.value!).lo) expect(v).toBeGreaterThanOrEqual(0);
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
  // surrogate seed (2) confirmed to disagree - shouldUseLogScale is FALSE
  // for that specific draw even though the real sequence's is TRUE.
  // ('permutation' surrogates are exactly value-multiset invariant and so
  // can never disagree; 'difference' and 'matched' are not.)
  //
  // count:1 pins the ensemble to exactly that one known-disagreeing draw -
  // percentileBands over a single array returns that array unchanged - so
  // this stays a deterministic, exact regression pin while still driving the
  // real runEnsemble pipeline (makeSurrogate + statistics() + percentileBands),
  // not just the shouldUseLogScale predicate in isolation. (A larger N was
  // tried and rejected: it also pulls in draws that are legitimately
  // clustered in value for reasons unrelated to this bug - e.g. several
  // surrogate terms landing close together after the huge gap lands early -
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
    expect(Math.max(...L90(stats.count!).hi)).toBeGreaterThanOrEqual(6);
  });

  it('with the override threaded through the draw, it no longer collapses', () => {
    const { stats } = runEnsemble(ensembleJob({ target: 'terms', bins: 10, logScaleOverride: override }));
    expect(Math.max(...L90(stats.count!).hi)).toBeLessThanOrEqual(4);
  });
});

describe('runEnsemble: histogram bin edges must be domain-synced across surrogate draws (task FR, C1)', () => {
  // A non-monotone (Recamán-like) sequence: computeHistogram derives lo/hi
  // from whichever values it's handed, and 'difference' surrogates do not
  // preserve the real sequence's value range the way 'permutation' does, so
  // each of the 300 draws bins into its own range - bin 0 does not mean the
  // same interval in every draw, and percentileBands stacks them as if it
  // did. Measured (this exact construction): 296/300 draws had a value
  // range differing >10% from the real sequence's; real bin-0 count is 46;
  // the per-draw-edges band for bin 0 is 2..13 (excludes 46 - reported as
  // "far outside the null envelope", the opposite of the truth), while the
  // fixed-domain band is 3..107 (comfortably contains 46).
  function recaman(n: number): bigint[] {
    const out: bigint[] = [0n];
    const seen = new Set<string>(['0']);
    for (let i = 1; i < n; i++) {
      const prev = out[i - 1]!;
      const back = prev - BigInt(i);
      if (back > 0n && !seen.has(back.toString())) out.push(back);
      else out.push(prev + BigInt(i));
      seen.add(out[i]!.toString());
    }
    return out;
  }

  const REAL = recaman(120);
  const view = new SequenceView({ terms: REAL, name: 'r', offset: 0, source: 'paste' } as Sequence);
  const realValues = Array.from({ length: view.length }, (_, i) => view.toNumber(i));
  const realLo = Math.min(...realValues), realHi = Math.max(...realValues);
  const realBin0 = computeHistogram(realValues, 10).counts[0]!;

  const terms = REAL.map(String);
  const jobFor = (params: EnsembleJob['params']): EnsembleJob => ({
    terms, surrogate: 'difference', count: 300, seed: 0, vizId: 'histogram', params,
  });

  it('sanity: the real sequence has 46 values in what would be bin 0 of a 10-bin histogram over its own range', () => {
    expect(realBin0).toBe(46);
  });

  it('without a domain override, the band for bin 0 excludes the true count (a false "far outside the null envelope")', () => {
    const { stats } = runEnsemble(jobFor({ target: 'terms', bins: 10 }));
    expect(L90(stats.count!).hi[0]!).toBeLessThan(realBin0); // 13 < 46, per-draw-edges band
  });

  it('with an explicit domain override (histogramDomainLo/Hi), the band for bin 0 correctly contains the true count', () => {
    const { stats } = runEnsemble(jobFor({ target: 'terms', bins: 10, histogramDomainLo: realLo, histogramDomainHi: realHi }));
    expect(L90(stats.count!).lo[0]!).toBeLessThanOrEqual(realBin0);
    expect(L90(stats.count!).hi[0]!).toBeGreaterThanOrEqual(realBin0); // 107 >= 46, fixed-domain band
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
