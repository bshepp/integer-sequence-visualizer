import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, type UrlState } from '../../src/ui/urlState';
import { DEFAULT_STYLE } from '../../src/viz/style';

const state: UrlState = {
  seqRef: { kind: 'formula', src: 'n*n + n + 41', count: 200 },
  vizId: 'polyarc',
  params: { angle: 30, modulus: 7, centered: true },
  mode: 'side',
  surrogate: 'difference',
  seed: 7,
  ensembleN: 200,
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
    const big = {
      ...state,
      seqRef: { kind: 'paste' as const, terms: Array.from({ length: 800 }, (_, i) => String(i)) },
    };
    const back = decodeState(encodeState(big))!;
    expect((back.seqRef as { terms: string[] }).terms.length).toBe(500);
  });

  it('rejects garbage and anything without a visualizer', () => {
    expect(decodeState('')).toBeNull();
    // Reserved page words must not decode as state, or routeFor would send
    // "#gallery" to the engine instead of the landing.
    expect(decodeState('gallery')).toBeNull();
    expect(decodeState('about')).toBeNull();
    expect(decodeState('seq=A000045')).toBeNull(); // no viz, so no view
  });

  it('round-trips a non-default ensembleN', () => {
    const withN = { ...state, ensembleN: 350 };
    expect(decodeState(encodeState(withN))).toEqual(withN);
  });
});

describe('the address is meant to be read', () => {
  it('spells out the sequence, the view and its parameters', () => {
    const url = encodeState({
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'turtle',
      params: { angle: 90, k: 4 },
      mode: 'side',
      surrogate: 'permutation',
      seed: 1,
    });
    expect(url).toContain('seq=A000002');
    expect(url).toContain('viz=turtle');
    expect(url).toContain('angle=90');
    expect(url).toContain('k=4');
    expect(url).toContain('null=side');
  });

  it('omits everything sitting at its default, so a plain view is short', () => {
    const url = encodeState({
      seqRef: { kind: 'oeis', aNumber: 'A000045' },
      vizId: 'scatter',
      params: { scale: 'linear' },
      mode: 'off',
      surrogate: 'permutation',
      seed: 1,
      style: { ...DEFAULT_STYLE },
      viewport: { zoom: 1, panX: 0, panY: 0 },
    });
    expect(url).toBe('seq=A000045&viz=scatter&scale=linear');
  });

  it('names style and zoom only once they differ from the default', () => {
    const url = encodeState({
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'turtle', params: {}, mode: 'off', surrogate: 'permutation', seed: 1,
      style: { ...DEFAULT_STYLE, lineWidth: 3, lineJoin: 'round', colorMode: 'none' },
      viewport: { zoom: 4, panX: -120, panY: 44 },
    });
    expect(url).toContain('line=3');
    expect(url).toContain('join=round');
    expect(url).toContain('colour=none');
    expect(url).toContain('zoom=4');
    expect(url).toContain('pan=-120,44');
    expect(url).not.toContain('cap=');   // still default
    expect(url).not.toContain('hue=');   // still default
  });

  it('recovers parameter types rather than handing back strings', () => {
    const back = decodeState('seq=A000002&viz=polyarc&angle=30&modulus=7&centered=true')!;
    expect(back.params.angle).toBe(30);
    expect(back.params.modulus).toBe(7);
    expect(back.params.centered).toBe(true);
    expect(back.params.angle).not.toBe('30');
  });

  it('keeps derived render state out of the address', () => {
    // logScaleOverride and the histogram domain are computed per render and
    // threaded through params. They are not user choices and sharing them
    // would pin someone else's window size into the link.
    const url = encodeState({
      seqRef: null, vizId: 'histogram',
      params: { bins: 20, logScaleOverride: true, histogramDomainLo: 0, histogramDomainHi: 99, styleLineWidth: 3 },
      mode: 'off', surrogate: 'permutation', seed: 1,
    });
    expect(url).not.toContain('logScaleOverride');
    expect(url).not.toContain('histogramDomain');
    expect(url).not.toContain('styleLineWidth');
    expect(url).toContain('bins=20');
  });

  it('survives a formula containing operators and spaces', () => {
    const withFormula: UrlState = {
      ...state, seqRef: { kind: 'formula', src: 'n*n + n + 41', count: 200 },
    };
    const back = decodeState(encodeState(withFormula))!;
    expect(back.seqRef).toEqual({ kind: 'formula', src: 'n*n + n + 41', count: 200 });
  });

  it('is dramatically shorter than the base64 it replaced', () => {
    // The old encoding of this exact view was 232 characters of base64.
    const url = encodeState({
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'turtle', params: { angle: 90, k: 4 },
      mode: 'side', surrogate: 'permutation', seed: 1,
    });
    expect(url.length).toBeLessThan(60);
  });
});
