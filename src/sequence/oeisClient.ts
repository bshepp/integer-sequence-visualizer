import type { Sequence } from './sequence';

export type FetchLike = (url: string) => Promise<{
  ok: boolean; status: number;
  json(): Promise<unknown>; text(): Promise<string>;
}>;

const defaultFetch: FetchLike = (url) => fetch(url);

export function normalizeANumber(input: string): string {
  const m = input.trim().match(/^[Aa]?(\d{1,6})$/);
  if (!m) throw new Error(`"${input}" is not an OEIS A-number.`);
  return 'A' + m[1]!.padStart(6, '0');
}

export interface OeisSearchHit { aNumber: string; name: string; }

// Static data hosted at /data/, built by scripts/build-oeis-index.mjs from
// OEIS's own daily bulk downloads (names.gz + stripped.gz). OEIS's /search
// endpoint 403s for datacenter IPs behind Cloudflare's bot challenge, so the
// deployed app cannot proxy it; these static files are the documented path
// for bulk consumers instead. See the task-19b brief for the full story.
interface ShardEntry { n: string; d: string; }
type ShardFile = Record<string, ShardEntry>;

function shardFor(aNumber: string): string {
  const n = Number(aNumber.slice(1));
  return String(Math.floor(n / 1000)).padStart(3, '0');
}

function parseTerms(termsCsv: string): bigint[] {
  if (!termsCsv) return [];
  return termsCsv.split(',').map((t) => BigInt(t));
}

export async function lookupById(aNumber: string, fetchFn: FetchLike = defaultFetch): Promise<Sequence> {
  const id = normalizeANumber(aNumber);
  const notFound = () => new Error(`No OEIS sequence found for ${id}.`);
  const res = await fetchFn(`/data/seq/${shardFor(id)}.json`);
  if (!res.ok) {
    // A 5xx means the /data/* origin itself is broken (bad deploy, outage),
    // which would otherwise look identical to "every sequence is missing" —
    // surface that distinctly rather than folding it into the not-found
    // message. A missing shard normally 404s (unknown/out-of-range id) and
    // is treated the same as a present-shard-but-missing-key below.
    if (res.status >= 500) throw new Error(`OEIS data request failed (HTTP ${res.status}).`);
    throw notFound();
  }
  const shard = (await res.json()) as ShardFile;
  const entry = shard[id];
  if (!entry) throw notFound();
  return { terms: parseTerms(entry.d), aNumber: id, name: entry.n, offset: 0, source: 'oeis' };
}

// The search index (/data/search-index.txt, one "A000045\tname" line per
// sequence) is tens of MB uncompressed. It is fetched at most once per page
// load and cached in this module-level promise; every search() call reuses
// it. clearSearchIndexCache() exists solely so tests can reset that cache
// between cases — production code never needs to call it.
let searchIndexPromise: Promise<OeisSearchHit[]> | null = null;

export function clearSearchIndexCache(): void {
  searchIndexPromise = null;
}

// V8 can implement String#slice() as a SlicedString view into its parent
// string's backing buffer rather than a fresh copy, once the slice is long
// enough (short slices like most A-numbers are copied outright, but OEIS
// names routinely aren't). Left alone, the ~400k `name` slices below would
// each keep the entire ~30+ MB search-index text pinned in memory for the
// rest of the page's life, even though only the small hit objects were
// meant to be retained. Concatenating onto a fresh string and re-slicing
// that (uniquely-owned, not-the-parent) result forces a real, small copy.
function copyStr(s: string): string {
  return (' ' + s).slice(1);
}

function loadSearchIndex(fetchFn: FetchLike): Promise<OeisSearchHit[]> {
  if (!searchIndexPromise) {
    searchIndexPromise = (async () => {
      const res = await fetchFn('/data/search-index.txt');
      if (!res.ok) throw new Error(`Failed to load the OEIS search index (HTTP ${res.status}).`);
      const text = await res.text();
      const hits: OeisSearchHit[] = [];
      for (const line of text.split('\n')) {
        if (!line) continue;
        const tab = line.indexOf('\t');
        if (tab < 0) continue;
        hits.push({ aNumber: copyStr(line.slice(0, tab)), name: copyStr(line.slice(tab + 1)) });
      }
      return hits;
    })().catch((err: unknown) => {
      searchIndexPromise = null; // allow a retry on the next search
      throw err;
    });
  }
  return searchIndexPromise;
}

export async function search(query: string, fetchFn: FetchLike = defaultFetch): Promise<OeisSearchHit[]> {
  const index = await loadSearchIndex(fetchFn);
  const q = query.trim();
  if (!q) return [];
  const qLower = q.toLowerCase();
  let idQuery: string | null = null;
  try { idQuery = normalizeANumber(q); } catch { idQuery = null; }

  const hits: OeisSearchHit[] = [];
  for (const hit of index) {
    const matches = hit.name.toLowerCase().includes(qLower) ||
      (idQuery !== null && hit.aNumber.startsWith(idQuery));
    if (matches) {
      hits.push(hit);
      if (hits.length >= 50) break;
    }
  }
  return hits;
}

export function parseBFile(text: string, cap: number): bigint[] {
  const terms: bigint[] = [];
  let expectedIndex: bigint | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const m = line.match(/^(-?\d+)\s+(-?\d+)$/);
    if (!m) continue; // tolerate stray non-data lines
    const idx = BigInt(m[1]!);
    if (expectedIndex !== null && idx !== expectedIndex) break; // discontinuity
    terms.push(BigInt(m[2]!));
    expectedIndex = idx + 1n;
    if (terms.length >= cap) break;
  }
  if (terms.length === 0) throw new Error('B-file contained no terms.');
  return terms;
}

export async function fetchBFile(
  aNumber: string,
  cap = 10000,
  fetchFn: FetchLike = defaultFetch,
): Promise<bigint[]> {
  const id = normalizeANumber(aNumber);
  const res = await fetchFn(`/api/${id}/b${id.slice(1)}.txt`);
  if (!res.ok) throw new Error(`B-file request failed (HTTP ${res.status}).`);
  return parseBFile(await res.text(), cap);
}

export function withTerms(seq: Sequence, terms: bigint[]): Sequence {
  return { ...seq, terms };
}
