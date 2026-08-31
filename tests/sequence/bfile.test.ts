import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBFile, fetchBFile, withTerms, type FetchLike } from '../../src/sequence/oeisClient';

const good = readFileSync(join(__dirname, '../fixtures/bfile-good.txt'), 'utf8');
const gap = readFileSync(join(__dirname, '../fixtures/bfile-gap.txt'), 'utf8');

describe('parseBFile', () => {
  it('parses values, skipping comments', () => {
    expect(parseBFile(good, 10000)).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 8n]);
  });

  it('stops at the first index discontinuity', () => {
    expect(parseBFile(gap, 10000)).toEqual([10n, 20n]);
  });

  it('respects the cap', () => {
    expect(parseBFile(good, 3)).toEqual([0n, 1n, 1n]);
  });

  it('throws when there are no data lines', () => {
    expect(() => parseBFile('# nothing\n\n', 10)).toThrow(/no terms/i);
  });

  it('rejects cap < 1 instead of silently returning a truncated (or one-term) sequence (task FR, M7)', () => {
    // Number('') === 0 for a cleared UI field, and cap: 0 used to parse
    // exactly one term (terms.length >= cap is true, 1 >= 0, on the very
    // first data line) with no visible error.
    expect(() => parseBFile(good, 0)).toThrow(/cap/i);
    expect(() => parseBFile(good, -5)).toThrow(/cap/i);
    expect(() => parseBFile(good, NaN)).toThrow(/cap/i);
  });

  it('still accepts cap: 1 as the smallest legal value', () => {
    expect(parseBFile(good, 1)).toEqual([0n]);
  });
});

describe('fetchBFile', () => {
  it('requests the right URL and parses', async () => {
    const calls: string[] = [];
    const f: FetchLike = async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({}), text: async () => good };
    };
    const { terms, truncated } = await fetchBFile('45', 10000, f);
    expect(calls[0]).toBe('/api/A000045/b000045.txt');
    expect(terms.length).toBe(7);
    expect(truncated).toBe(false);
  });

  it('reports truncation when the cap cut the file short', async () => {
    const f: FetchLike = async () => ({
      ok: true, status: 200, json: async () => ({}), text: async () => good,
    });
    const { terms, truncated } = await fetchBFile('45', 3, f);
    expect(terms).toEqual([0n, 1n, 1n]);
    expect(truncated).toBe(true);
  });

  it('does not call a file that ends exactly on the cap truncated', async () => {
    // The case the UI cannot guess and the one most likely to be seen here:
    // A000040's b-file stops at the 10,000th prime, so asking for 10,000 gets
    // 10,000 and there is nothing further. Reporting that as capped would tell
    // a reader to raise a cap that cannot buy them a single extra term.
    const f: FetchLike = async () => ({
      ok: true, status: 200, json: async () => ({}), text: async () => good,
    });
    const { terms, truncated } = await fetchBFile('45', 7, f);
    expect(terms.length).toBe(7);
    expect(truncated).toBe(false);
  });

  it('throws on HTTP failure', async () => {
    const f: FetchLike = async () => ({
      ok: false, status: 404, json: async () => ({}), text: async () => '',
    });
    await expect(fetchBFile('A000045', 10000, f)).rejects.toThrow(/404/);
  });
});

describe('withTerms', () => {
  it('replaces terms, keeps metadata', () => {
    const seq = { terms: [1n], aNumber: 'A000045', name: 'Fib', offset: 0, source: 'oeis' as const };
    const up = withTerms(seq, [1n, 2n, 3n]);
    expect(up.terms).toEqual([1n, 2n, 3n]);
    expect(up.aNumber).toBe('A000045');
    expect(up.name).toBe('Fib');
  });
});
