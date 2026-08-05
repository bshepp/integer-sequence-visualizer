import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, type UrlState } from '../../src/ui/urlState';

const state: UrlState = {
  seqRef: { kind: 'formula', src: 'n*n + n + 41', count: 200 },
  vizId: 'polyarc',
  params: { angle: 30, modulus: 7, centered: true },
  mode: 'side',
  surrogate: 'difference',
  seed: 7,
};

describe('urlState', () => {
  it('round-trips through encode/decode', () => {
    expect(decodeState(encodeState(state))).toEqual(state);
    expect(decodeState('#' + encodeState(state))).toEqual(state);
  });

  it('round-trips oeis and paste refs', () => {
    const oeis = { ...state, seqRef: { kind: 'oeis' as const, aNumber: 'A019488' } };
    expect(decodeState(encodeState(oeis))).toEqual(oeis);
    const paste = { ...state, seqRef: { kind: 'paste' as const, terms: ['1', '2', '3'] } };
    expect(decodeState(encodeState(paste))).toEqual(paste);
  });

  it('caps paste terms at 500 on encode', () => {
    const big = { ...state, seqRef: { kind: 'paste' as const, terms: Array.from({ length: 800 }, (_, i) => String(i)) } };
    const back = decodeState(encodeState(big))!;
    expect((back.seqRef as { terms: string[] }).terms.length).toBe(500);
  });

  it('is URL-hash-safe and rejects garbage', () => {
    expect(encodeState(state)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeState('not-base64!!!')).toBeNull();
    expect(decodeState('')).toBeNull();
  });
});
