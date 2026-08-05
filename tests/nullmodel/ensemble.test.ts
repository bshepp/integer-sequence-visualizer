import { describe, it, expect } from 'vitest';
import { runEnsemble, type EnsembleJob } from '../../src/nullmodel/ensemble';

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
