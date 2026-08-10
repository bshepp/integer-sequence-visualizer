import type { Params, ParamValue } from '../viz/types';
import type { ComparisonMode } from './comparison';
import type { SurrogateType } from '../nullmodel/surrogates';
import { DEFAULT_STYLE, type RenderStyle } from '../viz/style';
import { IDENTITY_VIEWPORT, type Viewport } from './viewport';

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
  ensembleN?: number;
  style?: RenderStyle;
  viewport?: Viewport;
  /** Present only when the null model is drawn with its own style. */
  nullStyle?: RenderStyle;
}

/**
 * The URL is written to be read.
 *
 * It used to be base64-encoded JSON, which round-tripped perfectly and told a
 * reader nothing: an address that looks like line noise gives no reason to
 * believe it captures the view, so nobody thinks to keep one. Readable keys
 * make the address self-describing -
 *
 *   #seq=A000002&viz=turtle&angle=90&k=4&null=side
 *
 * - which is also the difference between a link someone pastes into a paper
 * and one they do not.
 *
 * Anything at its default is omitted, so an ordinary view produces a short
 * address and every key present is a key that matters. No backwards
 * compatibility with the old format: nothing outside this repository has ever
 * bookmarked one.
 */

const DEFAULT_ENSEMBLE_N = 200;

// Keys the frame owns. A visualizer parameter sharing one of these names would
// be silently overwritten, so the encoder checks rather than trusting.
const RESERVED = new Set([
  'seq', 'formula', 'terms', 'paste', 'viz',
  'null', 'surrogate', 'seed', 'ensemble',
  'line', 'join', 'cap', 'colour', 'hue',
  'zoom', 'pan', 'unlink', 'retread',
]);

/** Style keys for either panel; the null's are namespaced with a prefix. */
const STYLE_KEYS = ['line', 'join', 'cap', 'colour', 'hue', 'retread'] as const;
const NULL_PREFIX = 'null.';

function encodeStyle(p: URLSearchParams, st: RenderStyle, prefix = ''): void {
  if (st.lineWidth !== DEFAULT_STYLE.lineWidth) p.set(`${prefix}line`, String(st.lineWidth));
  if (st.lineJoin !== DEFAULT_STYLE.lineJoin) p.set(`${prefix}join`, st.lineJoin);
  if (st.lineCap !== DEFAULT_STYLE.lineCap) p.set(`${prefix}cap`, st.lineCap);
  if (st.colorMode !== DEFAULT_STYLE.colorMode) p.set(`${prefix}colour`, st.colorMode);
  if (st.hueStart !== DEFAULT_STYLE.hueStart || st.hueEnd !== DEFAULT_STYLE.hueEnd) {
    p.set(`${prefix}hue`, `${st.hueStart}-${st.hueEnd}`);
  }
  if (st.showOverlap !== DEFAULT_STYLE.showOverlap) p.set(`${prefix}retread`, '1');
}

function decodeStyle(p: URLSearchParams, prefix = ''): RenderStyle | undefined {
  const has = STYLE_KEYS.some((k) => p.has(`${prefix}${k}`));
  if (!has) return undefined;
  const hue = p.get(`${prefix}hue`);
  const [hueStart, hueEnd] = hue ? hue.split('-').map(Number) : [undefined, undefined];
  return {
    ...DEFAULT_STYLE,
    lineWidth: num(p.get(`${prefix}line`)) ?? DEFAULT_STYLE.lineWidth,
    lineJoin: (p.get(`${prefix}join`) ?? DEFAULT_STYLE.lineJoin) as CanvasLineJoin,
    lineCap: (p.get(`${prefix}cap`) ?? DEFAULT_STYLE.lineCap) as CanvasLineCap,
    colorMode: (p.get(`${prefix}colour`) ?? DEFAULT_STYLE.colorMode) as RenderStyle['colorMode'],
    hueStart: Number.isFinite(hueStart) ? hueStart! : DEFAULT_STYLE.hueStart,
    hueEnd: Number.isFinite(hueEnd) ? hueEnd! : DEFAULT_STYLE.hueEnd,
    showOverlap: p.has(`${prefix}retread`),
  };
}

const num = (v: string | null): number | undefined => {
  if (v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function encodeSeqRef(p: URLSearchParams, ref: SeqRef | null): void {
  if (!ref) return;
  if (ref.kind === 'oeis') { p.set('seq', ref.aNumber); return; }
  if (ref.kind === 'formula') {
    p.set('formula', ref.src);
    p.set('terms', String(ref.count));
    return;
  }
  // Pasted sequences have no external identity, so the terms themselves are
  // the reference. Capped: past a few hundred the address stops being a URL
  // and the b-file path is the right tool anyway.
  p.set('paste', ref.terms.slice(0, 500).join(','));
}

function decodeSeqRef(p: URLSearchParams): SeqRef | null {
  const seq = p.get('seq');
  if (seq) return { kind: 'oeis', aNumber: seq };
  const formula = p.get('formula');
  if (formula) return { kind: 'formula', src: formula, count: num(p.get('terms')) ?? 200 };
  const paste = p.get('paste');
  if (paste) return { kind: 'paste', terms: paste.split(',').filter(Boolean) };
  return null;
}

export function encodeState(s: UrlState): string {
  const p = new URLSearchParams();
  encodeSeqRef(p, s.seqRef);
  p.set('viz', s.vizId);

  for (const [k, v] of Object.entries(s.params)) {
    // logScaleOverride and histogramDomainLo/Hi are computed per render and
    // threaded through params; they are derived state, not user choices, and
    // do not belong in a shared address.
    if (k.startsWith('style') || k.startsWith('histogramDomain') || k === 'logScaleOverride') continue;
    if (RESERVED.has(k)) continue;
    p.set(k, String(v));
  }

  if (s.mode !== 'off') p.set('null', s.mode);
  if (s.surrogate !== 'permutation') p.set('surrogate', s.surrogate);
  if (s.seed !== 1) p.set('seed', String(s.seed));
  if (s.ensembleN !== undefined && s.ensembleN !== DEFAULT_ENSEMBLE_N) {
    p.set('ensemble', String(s.ensembleN));
  }

  if (s.style) encodeStyle(p, s.style);
  if (s.nullStyle) {
    // The flag is carried separately: unlinking with every setting still at
    // its default emits no null.* keys at all, and without it that state
    // would decode as linked.
    p.set('unlink', '1');
    encodeStyle(p, s.nullStyle, NULL_PREFIX);
  }

  const v = s.viewport;
  if (v && (v.zoom !== IDENTITY_VIEWPORT.zoom || v.panX !== 0 || v.panY !== 0)) {
    if (v.zoom !== IDENTITY_VIEWPORT.zoom) p.set('zoom', String(Math.round(v.zoom * 1000) / 1000));
    if (v.panX !== 0 || v.panY !== 0) p.set('pan', `${Math.round(v.panX)},${Math.round(v.panY)}`);
  }

  // URLSearchParams percent-encodes far more than a hash fragment requires.
  // Putting these back keeps the address legible without changing what it
  // parses back to: all four are legal in a fragment.
  return p.toString().replace(/%2C/g, ',').replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/\+/g, '+');
}

export function decodeState(hash: string): UrlState | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  const p = new URLSearchParams(raw);
  const vizId = p.get('viz');
  // Without a visualizer there is no view to restore, which is also how a
  // reserved page word like "gallery" is rejected here rather than being
  // mistaken for a state.
  if (!vizId) return null;

  const params: Params = {};
  for (const [k, v] of p.entries()) {
    if (RESERVED.has(k) || k.startsWith(NULL_PREFIX)) continue;
    // Params are number | string | boolean. Recover the original type so a
    // slider reads a number rather than the string "90".
    if (v === 'true' || v === 'false') params[k] = v === 'true';
    else {
      const n = Number(v);
      params[k] = v !== '' && Number.isFinite(n) ? n : (v as ParamValue);
    }
  }

  const state: UrlState = {
    seqRef: decodeSeqRef(p),
    vizId,
    params,
    mode: (p.get('null') ?? 'off') as ComparisonMode,
    surrogate: (p.get('surrogate') ?? 'permutation') as SurrogateType,
    seed: num(p.get('seed')) ?? 1,
    ensembleN: num(p.get('ensemble')) ?? DEFAULT_ENSEMBLE_N,
  };

  const style = decodeStyle(p);
  if (style) state.style = style;
  if (p.has('unlink')) state.nullStyle = decodeStyle(p, NULL_PREFIX) ?? { ...DEFAULT_STYLE };

  const pan = p.get('pan');
  const [panX, panY] = pan ? pan.split(',').map(Number) : [undefined, undefined];
  if (p.has('zoom') || pan) {
    state.viewport = {
      zoom: num(p.get('zoom')) ?? 1,
      panX: Number.isFinite(panX) ? panX! : 0,
      panY: Number.isFinite(panY) ? panY! : 0,
    };
  }

  return state;
}
