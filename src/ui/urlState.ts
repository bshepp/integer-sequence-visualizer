import type { Params, ParamValue } from '../viz/types';
import type { ComparisonMode } from './comparison';
import type { SurrogateType } from '../nullmodel/surrogates';
import { DEFAULT_STYLE, styleFromParams, type RenderStyle } from '../viz/style';
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
  /** Present only when the null model has its own zoom and pan. */
  nullViewport?: Viewport;
  /** True when the first and last terms are marked. */
  markEnds?: boolean;
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
  'zoom', 'pan', 'unlink', 'retread', 'nolabels', 'black', 'canvas', 'splitview', 'ends',
]);

/** Style keys for either panel; the null's are namespaced with a prefix. */
const STYLE_KEYS = ['line', 'join', 'cap', 'colour', 'hue', 'retread', 'nolabels', 'black', 'canvas'] as const;
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
  // Named for the non-default state, so the common case emits no key at all.
  if (st.showLabels !== DEFAULT_STYLE.showLabels) p.set(`${prefix}nolabels`, '1');
  if (st.blackLine !== DEFAULT_STYLE.blackLine) p.set(`${prefix}black`, '1');
  if (st.canvas !== DEFAULT_STYLE.canvas) p.set(`${prefix}canvas`, st.canvas);
}

function decodeStyle(p: URLSearchParams, prefix = ''): RenderStyle | undefined {
  const has = STYLE_KEYS.some((k) => p.has(`${prefix}${k}`));
  if (!has) return undefined;
  const hue = p.get(`${prefix}hue`);
  const [hueStart, hueEnd] = hue ? hue.split('-').map(Number) : [undefined, undefined];
  // Handed to styleFromParams rather than cast into shape here. These values
  // come from an address a stranger can type, and the casts this replaced were
  // assertions rather than checks: "#viz=turtle&join=banana" produced a style
  // whose lineJoin was the string "banana", and an unknown canvas fell through
  // to black. The params bridge already validates every field against its
  // allowed set and clamps the numbers, so decoding through it means the
  // address gets exactly the same treatment as a style from anywhere else,
  // with one implementation to keep honest instead of two.
  return styleFromParams({
    styleLineWidth: num(p.get(`${prefix}line`)) ?? DEFAULT_STYLE.lineWidth,
    styleLineJoin: p.get(`${prefix}join`) ?? DEFAULT_STYLE.lineJoin,
    styleLineCap: p.get(`${prefix}cap`) ?? DEFAULT_STYLE.lineCap,
    styleColorMode: p.get(`${prefix}colour`) ?? DEFAULT_STYLE.colorMode,
    styleHueStart: Number.isFinite(hueStart) ? hueStart! : DEFAULT_STYLE.hueStart,
    styleHueEnd: Number.isFinite(hueEnd) ? hueEnd! : DEFAULT_STYLE.hueEnd,
    styleShowOverlap: p.has(`${prefix}retread`),
    styleShowLabels: !p.has(`${prefix}nolabels`),
    styleBlackLine: p.has(`${prefix}black`),
    styleCanvas: p.get(`${prefix}canvas`) ?? DEFAULT_STYLE.canvas,
  });
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

  const putViewport = (v: Viewport | undefined, prefix: string): void => {
    if (!v) return;
    if (v.zoom !== IDENTITY_VIEWPORT.zoom) p.set(`${prefix}zoom`, String(Math.round(v.zoom * 1000) / 1000));
    if (v.panX !== 0 || v.panY !== 0) p.set(`${prefix}pan`, `${Math.round(v.panX)},${Math.round(v.panY)}`);
  };
  if (s.markEnds) p.set('ends', '1');
  putViewport(s.viewport, '');
  if (s.nullViewport) {
    // Carried separately for the same reason unlink= is: splitting the view
    // while both are still at 100% emits no null.* keys, and without the flag
    // that state would decode as linked.
    p.set('splitview', '1');
    putViewport(s.nullViewport, NULL_PREFIX);
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
  // reserved page word like "examples" is rejected here rather than being
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

  const readViewport = (prefix: string): Viewport | undefined => {
    const pan = p.get(`${prefix}pan`);
    if (!p.has(`${prefix}zoom`) && !pan) return undefined;
    const [panX, panY] = pan ? pan.split(',').map(Number) : [undefined, undefined];
    return {
      zoom: num(p.get(`${prefix}zoom`)) ?? 1,
      panX: Number.isFinite(panX) ? panX! : 0,
      panY: Number.isFinite(panY) ? panY! : 0,
    };
  };
  if (p.has('ends')) state.markEnds = true;
  const vp = readViewport('');
  if (vp) state.viewport = vp;
  if (p.has('splitview')) state.nullViewport = readViewport(NULL_PREFIX) ?? { ...IDENTITY_VIEWPORT };

  return state;
}
