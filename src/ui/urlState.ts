import type { Params } from '../viz/types';
import type { ComparisonMode } from './comparison';
import type { SurrogateType } from '../nullmodel/surrogates';

export type SeqRef =
  | { kind: 'oeis'; aNumber: string }
  | { kind: 'formula'; src: string; count: number }
  | { kind: 'paste'; terms: string[] };

export interface UrlState {
  seqRef: SeqRef | null;
  vizId: string;
  params: Params;
  mode: ComparisonMode;
  surrogate: SurrogateType;
  seed: number;
}

function b64urlEncode(s: string): string {
  const utf8 = String.fromCharCode(...new TextEncoder().encode(s));
  return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(s: UrlState): string {
  const ref = s.seqRef?.kind === 'paste'
    ? { ...s.seqRef, terms: s.seqRef.terms.slice(0, 500) }
    : s.seqRef;
  return b64urlEncode(JSON.stringify({ ...s, seqRef: ref }));
}

export function decodeState(hash: string): UrlState | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    const obj = JSON.parse(b64urlDecode(raw)) as UrlState;
    if (typeof obj !== 'object' || obj === null || typeof obj.vizId !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}
