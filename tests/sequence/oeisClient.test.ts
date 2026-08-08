import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeANumber,
  lookupById,
  search,
  clearSearchIndexCache,
  type FetchLike,
} from '../../src/sequence/oeisClient';

interface Route { ok?: boolean; status?: number; json?: unknown; text?: string; }

function fakeFetch(routes: Record<string, Route>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const route = routes[url];
    if (!route) {
      return { ok: false, status: 404, json: async () => { throw new Error('no fixture'); }, text: async () => '' };
    }
    const ok = route.ok ?? true;
    const status = route.status ?? (ok ? 200 : 500);
    return { ok, status, json: async () => route.json, text: async () => route.text ?? '' };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
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
  const shard000 = {
    A000045: {
      n: 'Fibonacci numbers: F(n) = F(n-1) + F(n-2) with F(0) = 0 and F(1) = 1.',
      d: '0,1,1,2,3,5,8',
    },
  };

  it('fetches the shard file and builds a Sequence, with offset 0', async () => {
    const f = fakeFetch({ '/data/seq/000.json': { json: shard000 } });
    const seq = await lookupById('A000045', f);
    expect(f.calls).toEqual(['/data/seq/000.json']);
    expect(seq.aNumber).toBe('A000045');
    expect(seq.name).toMatch(/Fibonacci/);
    expect(seq.offset).toBe(0);
    expect(seq.terms).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 8n]);
    expect(seq.source).toBe('oeis');
  });

  it('throws naming the id when the shard exists but lacks the key', async () => {
    const f = fakeFetch({ '/data/seq/999.json': { json: { A999998: { n: 'x', d: '1' } } } });
    await expect(lookupById('A999999', f)).rejects.toThrow(/A999999/);
  });

  it('throws naming the id when the shard file itself is missing', async () => {
    const f = fakeFetch({}); // every URL 404s
    await expect(lookupById('A999999', f)).rejects.toThrow(/A999999/);
  });

  it('distinguishes a broken /data/* origin (5xx) from a genuinely unknown id (404)', async () => {
    const f = fakeFetch({ '/data/seq/000.json': { ok: false, status: 503 } });
    await expect(lookupById('A000045', f)).rejects.toThrow(/503/);
    // Must not read as a routine "not found" - a broken origin means every
    // lookup is failing, not that this specific sequence doesn't exist.
    await expect(lookupById('A000045', f)).rejects.not.toThrow(/No OEIS sequence found/);
  });

  it.each([
    ['A000045', '000'],
    ['A019488', '019'],
    ['A398432', '398'],
  ])('derives the shard for %s as %s', async (aNumber, shard) => {
    const f = fakeFetch({ [`/data/seq/${shard}.json`]: { json: { [aNumber]: { n: 'x', d: '1' } } } });
    await lookupById(aNumber, f);
    expect(f.calls).toEqual([`/data/seq/${shard}.json`]);
  });
});

describe('search', () => {
  const indexText = [
    'A000045\tFibonacci numbers: F(n) = F(n-1) + F(n-2) with F(0) = 0 and F(1) = 1.',
    'A000040\tThe prime numbers.',
    'A000032\tLucas numbers beginning at 2.',
  ].join('\n') + '\n';

  beforeEach(() => {
    clearSearchIndexCache();
  });

  it('matches by case-insensitive substring on the name', async () => {
    const f = fakeFetch({ '/data/search-index.txt': { text: indexText } });
    const hits = await search('FIBO', f);
    expect(hits).toEqual([
      { aNumber: 'A000045', name: 'Fibonacci numbers: F(n) = F(n-1) + F(n-2) with F(0) = 0 and F(1) = 1.' },
    ]);
  });

  it('matches by exact A-number', async () => {
    const f = fakeFetch({ '/data/search-index.txt': { text: indexText } });
    const hits = await search('A000040', f);
    expect(hits).toEqual([{ aNumber: 'A000040', name: 'The prime numbers.' }]);
  });

  it('matches a bare number as its normalized A-number', async () => {
    const f = fakeFetch({ '/data/search-index.txt': { text: indexText } });
    const hits = await search('40', f);
    expect(hits).toEqual([{ aNumber: 'A000040', name: 'The prime numbers.' }]);
  });

  it('caps results at 50 hits', async () => {
    const lines: string[] = [];
    for (let i = 1; i <= 120; i++) lines.push(`A${String(i).padStart(6, '0')}\tnumbers galore ${i}`);
    const f = fakeFetch({ '/data/search-index.txt': { text: lines.join('\n') + '\n' } });
    const hits = await search('numbers', f);
    expect(hits.length).toBe(50);
  });

  it('returns [] for no matches', async () => {
    const f = fakeFetch({ '/data/search-index.txt': { text: indexText } });
    expect(await search('zzzznomatch', f)).toEqual([]);
  });

  it('fetches the index only once across multiple searches', async () => {
    const f = fakeFetch({ '/data/search-index.txt': { text: indexText } });
    await search('fibonacci', f);
    await search('prime', f);
    await search('lucas', f);
    expect(f.calls.filter((u) => u === '/data/search-index.txt').length).toBe(1);
  });

  it('rejects with a message on a load failure, and allows a retry afterwards', async () => {
    const failing = fakeFetch({ '/data/search-index.txt': { ok: false, status: 500, text: '' } });
    await expect(search('fibonacci', failing)).rejects.toThrow(/500/);

    const recovered = fakeFetch({ '/data/search-index.txt': { text: indexText } });
    const hits = await search('fibonacci', recovered);
    expect(hits).toEqual([
      { aNumber: 'A000045', name: 'Fibonacci numbers: F(n) = F(n-1) + F(n-2) with F(0) = 0 and F(1) = 1.' },
    ]);
  });
});
