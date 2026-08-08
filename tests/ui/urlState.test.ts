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

  it('round-trips ensembleN (task FR, M8: previously absent, so shared ensemble links did not reproduce the band width)', () => {
    const withN = { ...state, ensembleN: 350 };
    expect(decodeState(encodeState(withN))).toEqual(withN);
  });

  it('decodes a hash encoded before ensembleN existed without throwing (backward compatibility)', () => {
    // `state` itself has no ensembleN key, so encoding it already simulates
    // a pre-M8 link - decoding must not throw or otherwise choke on the
    // missing key.
    const decoded = decodeState(encodeState(state));
    expect(decoded).not.toBeNull();
    expect(decoded!.ensembleN).toBeUndefined();
    expect(decoded!.vizId).toBe(state.vizId); // the rest of the state still decodes correctly
  });
});
