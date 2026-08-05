import { describe, it, expect } from 'vitest';
import { normalizeANumber, lookupById, search, type FetchLike } from '../../src/sequence/oeisClient';
import fib from '../fixtures/oeis-fib.json';
import empty from '../fixtures/oeis-empty.json';

function fakeFetch(body: unknown, ok = true, status = 200): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return Object.assign(fn, { calls });
}

describe('normalizeANumber', () => {
  it('normalizes common forms', () => {
    expect(normalizeANumber('A000045')).toBe('A000045');
    expect(normalizeANumber('a45')).toBe('A000045');
    expect(normalizeANumber('45')).toBe('A000045');
    expect(normalizeANumber(' A019488 ')).toBe('A019488');
  });
  it('rejects garbage', () => {
    expect(() => normalizeANumber('banana')).toThrow();
    expect(() => normalizeANumber('')).toThrow();
  });
});

describe('lookupById', () => {
  it('fetches via /api and builds a Sequence', async () => {
    const f = fakeFetch(fib);
    const seq = await lookupById('A000045', f);
    expect(f.calls[0]).toBe('/api/search?q=id%3AA000045&fmt=json');
    expect(seq.aNumber).toBe('A000045');
    expect(seq.name).toMatch(/Fibonacci/);
    expect(seq.offset).toBe(0);
    expect(seq.terms.slice(0, 7)).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 8n]);
    expect(seq.source).toBe('oeis');
  });

  it('throws a clear error when the id is unknown', async () => {
    await expect(lookupById('A999999', fakeFetch(empty))).rejects.toThrow(/A999999/);
  });

  it('accepts the modern bare-array response shape', async () => {
    const seq = await lookupById('A000045', fakeFetch(fib.results));
    expect(seq.aNumber).toBe('A000045');
    expect(seq.terms.slice(0, 4)).toEqual([0n, 1n, 1n, 2n]);
  });

  it('accepts the modern null response for no matches', async () => {
    await expect(lookupById('A999999', fakeFetch(null))).rejects.toThrow(/A999999/);
  });

  it('throws on HTTP failure', async () => {
    await expect(lookupById('A000045', fakeFetch({}, false, 502))).rejects.toThrow(/502/);
  });
});

describe('search', () => {
  it('returns hits with normalized A-numbers', async () => {
    const hits = await search('fibonacci', fakeFetch(fib));
    expect(hits).toEqual([{ aNumber: 'A000045', name: fib.results[0]!.name }]);
  });

  it('returns [] for no matches', async () => {
    expect(await search('zzzz', fakeFetch(empty))).toEqual([]);
  });

  it('handles modern bare-array and null shapes', async () => {
    const hits = await search('fibonacci', fakeFetch(fib.results));
    expect(hits).toEqual([{ aNumber: 'A000045', name: fib.results[0]!.name }]);
    expect(await search('zzzz', fakeFetch(null))).toEqual([]);
  });
});
