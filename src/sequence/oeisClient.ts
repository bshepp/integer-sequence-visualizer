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

interface OeisResult { number: number; name: string; data: string; offset: string; }
interface OeisResponse { count: number; results: OeisResult[] | null; }

async function fetchJson(url: string, fetchFn: FetchLike): Promise<OeisResponse> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`OEIS request failed (HTTP ${res.status}).`);
  const body = (await res.json()) as OeisResponse;
  if (typeof body !== 'object' || body === null || !('results' in body)) {
    throw new Error('Unexpected response from OEIS.');
  }
  return body;
}

function resultToSequence(r: OeisResult): Sequence {
  const aNumber = 'A' + String(r.number).padStart(6, '0');
  const terms = r.data.split(',').map((t) => BigInt(t.trim()));
  const offset = parseInt(r.offset.split(',')[0] ?? '0', 10);
  return { terms, aNumber, name: r.name, offset, source: 'oeis' };
}

export async function lookupById(aNumber: string, fetchFn: FetchLike = defaultFetch): Promise<Sequence> {
  const id = normalizeANumber(aNumber);
  const body = await fetchJson(`/api/search?q=${encodeURIComponent('id:' + id)}&fmt=json`, fetchFn);
  const first = body.results?.[0];
  if (!first) throw new Error(`No OEIS sequence found for ${id}.`);
  return resultToSequence(first);
}

export async function search(query: string, fetchFn: FetchLike = defaultFetch): Promise<OeisSearchHit[]> {
  const body = await fetchJson(`/api/search?q=${encodeURIComponent(query)}&fmt=json`, fetchFn);
  return (body.results ?? []).map((r) => ({
    aNumber: 'A' + String(r.number).padStart(6, '0'),
    name: r.name,
  }));
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
