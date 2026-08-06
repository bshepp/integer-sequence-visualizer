import type { Sequence } from '../sequence/sequence';
import { SequenceView } from '../sequence/sequence';
import { registerAll } from '../viz/all';
import { allVisualizers, getVisualizer } from '../viz/registry';
import { defaultParams, type Params } from '../viz/types';
import { shouldUseLogScale, targetValues } from '../viz/histogram';
import { minMax } from '../viz/mathUtils';
import { buildParamControls } from './paramControls';
import { buildSequencePanel } from './sequencePanel';
import { initMessages, showError, showNotice } from './messages';
import { defaultComparison, surrogateSequence, drawEnsembleChart, buildComparisonBar } from './comparison';
import { startEnsembleWorker, type EnsembleJob } from '../nullmodel/ensemble';
import type { Bands } from '../nullmodel/bands';
import { buildSweepView } from './sweep';
import { encodeState, decodeState, type SeqRef } from './urlState';
import { lookupById } from '../sequence/oeisClient';
import { sequenceFromFormula } from '../sequence/formula';

const MODES = ['off', 'side', 'flip', 'ensemble'];
const SURROGATES = ['permutation', 'difference', 'matched'];

export function mountApp(root: HTMLElement): void {
  registerAll();

  const state: { seq: Sequence | null; vizId: string; params: Params } = {
    seq: null,
    vizId: allVisualizers()[0]!.id,
    params: defaultParams(allVisualizers()[0]!.params),
  };

  const comparison = defaultComparison();
  let currentRef: SeqRef | null = null;

  let ensembleCancel: { cancel(): void } | null = null;
  let ensembleBands: Record<string, Bands> | null = null;
  let ensembleKey = '';
  // Set when the most recent ensemble job for `ensembleKey` failed, so
  // drawScene can paint a distinct "failed" placeholder instead of
  // re-showing "Computing…" forever (see onError below).
  let ensembleFailed = false;

  root.replaceChildren();

  const header = document.createElement('header');
  header.className = 'app-header';
  const wordmark = document.createElement('div');
  wordmark.className = 'app-wordmark';
  const title = document.createElement('span');
  title.className = 'app-title';
  title.textContent = 'Ulam';
  const subtitle = document.createElement('span');
  subtitle.className = 'app-subtitle';
  subtitle.textContent = 'OEIS sequence visualizer';
  wordmark.append(title, subtitle);
  const tagline = document.createElement('p');
  tagline.className = 'app-tagline';
  tagline.textContent = 'Render an integer sequence, then test whether the structure you see survives a null model.';
  header.append(wordmark, tagline);
  root.appendChild(header);

  const layout = document.createElement('div');
  layout.className = 'layout';
  root.appendChild(layout);

  const messages = document.createElement('div');
  messages.className = 'messages';
  root.appendChild(messages);
  initMessages(messages);

  const footer = document.createElement('footer');
  footer.className = 'attribution';
  footer.append('Sequence data from ');
  const oeisLink = document.createElement('a');
  oeisLink.href = 'https://oeis.org/';
  oeisLink.target = '_blank';
  oeisLink.rel = 'noopener noreferrer';
  oeisLink.textContent = 'The On-Line Encyclopedia of Integer Sequences';
  footer.appendChild(oeisLink);
  footer.append('®, © OEIS Foundation Inc., used under ');
  const ccLink = document.createElement('a');
  ccLink.href = 'https://creativecommons.org/licenses/by-sa/4.0/';
  ccLink.target = '_blank';
  ccLink.rel = 'noopener noreferrer';
  ccLink.textContent = 'CC BY-SA 4.0';
  footer.appendChild(ccLink);
  footer.append('.');
  root.appendChild(footer);

  // sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  // Derive the shareable ref from the sequence itself: this keeps a b-file
  // upgrade (same source/aNumber, more terms) pointing at the same OEIS ref.
  function refFor(seq: Sequence): SeqRef | null {
    if (seq.source === 'oeis' && seq.aNumber) return { kind: 'oeis', aNumber: seq.aNumber };
    if (seq.source === 'formula') return { kind: 'formula', src: seq.name, count: seq.terms.length };
    if (seq.source === 'paste') return { kind: 'paste', terms: seq.terms.map(String) };
    return null;
  }

  function applySeq(seq: Sequence): void {
    state.seq = seq;
    currentRef = refFor(seq);
    panel.setInfo(seq);
    bar.update(Boolean(getVisualizer(state.vizId).statistics));
    redraw();
  }

  const panel = buildSequencePanel({
    onSequence: applySeq,
    onError: showError,
  });
  sidebar.appendChild(panel.el);
  layout.appendChild(sidebar);

  // main column
  const main = document.createElement('main');
  main.className = 'main';
  layout.appendChild(main);

  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  main.appendChild(topbar);

  const picker = document.createElement('select');
  picker.className = 'viz-picker';
  for (const v of allVisualizers()) {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = `${v.family} · ${v.name}`;
    picker.appendChild(o);
  }
  picker.value = state.vizId;
  picker.addEventListener('change', () => {
    state.vizId = picker.value;
    state.params = defaultParams(getVisualizer(state.vizId).params);
    rebuildParams();
    bar.update(Boolean(getVisualizer(state.vizId).statistics));
    redraw();
  });
  topbar.appendChild(picker);

  const paramsHost = document.createElement('div');
  topbar.appendChild(paramsHost);
  function rebuildParams(): void {
    paramsHost.replaceChildren(
      buildParamControls(getVisualizer(state.vizId).params, state.params, (id, value) => {
        state.params[id] = value;
        redraw();
      }),
    );
  }
  rebuildParams();

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  main.appendChild(canvasWrap);
  const canvas = document.createElement('canvas');
  canvasWrap.appendChild(canvas);

  const bar = buildComparisonBar(comparison, redraw);
  main.insertBefore(bar.el, canvasWrap);
  bar.update(Boolean(getVisualizer(state.vizId).statistics));

  const sweepBtn = document.createElement('button');
  sweepBtn.textContent = 'Sweep…';
  sweepBtn.addEventListener('click', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    const numeric = getVisualizer(state.vizId).params.filter((p) => p.kind === 'number');
    if (numeric.length === 0) { showNotice('This visualizer has no numeric parameters to sweep.'); return; }
    let paramId: string;
    if (numeric.length === 1) {
      paramId = numeric[0]!.id;
    } else {
      const answer = window.prompt(`Sweep which parameter? (${numeric.map((p) => p.id).join(', ')})`, numeric[0]!.id);
      // window.prompt returns null on Cancel specifically (as opposed to ""
      // for an OK'd-but-emptied field) — `?? default` treated both the same,
      // so Cancel silently ran the sweep on the first parameter instead of
      // aborting. Only a real cancellation returns early here.
      if (answer === null) return;
      paramId = answer;
    }
    if (!numeric.some((p) => p.id === paramId)) { showError(`Unknown parameter "${paramId}".`); return; }
    const overlay = buildSweepView({
      seq: state.seq, viz: getVisualizer(state.vizId), baseParams: { ...state.params },
      paramId, count: 12,
      onPick(value) { state.params[paramId] = value; rebuildParams(); redraw(); },
      onClose() { overlay.remove(); },
    });
    root.appendChild(overlay);
  });
  bar.el.appendChild(sweepBtn);

  // The hash the app itself last wrote via syncUrl. The hashchange handler
  // compares against this to ignore its own writes: replaceState shouldn't
  // fire hashchange per spec, but browsers vary, and a redraw -> syncUrl ->
  // hashchange -> re-apply -> redraw loop would be far worse than a stale view.
  let lastHashWritten = '';

  function syncUrl(): void {
    try {
      const hash = '#' + encodeState({
        seqRef: currentRef, vizId: state.vizId, params: state.params,
        mode: comparison.mode, surrogate: comparison.surrogate, seed: comparison.seed,
        ensembleN: comparison.ensembleN,
      });
      lastHashWritten = hash;
      history.replaceState(null, '', hash);
    } catch {
      // history may be unavailable or restricted (e.g. sandboxed test envs)
    }
  }

  // drawScene has early returns (no 2d context, no sequence yet); wrapping it
  // keeps syncUrl at the end of every redraw regardless of which path ran.
  function redraw(): void {
    drawScene();
    syncUrl();
  }

  function drawScene(): void {
    const rect = canvasWrap.getBoundingClientRect();
    const width = Math.max(200, rect.width);
    const height = Math.max(200, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(0, 0, width, height);
    if (!state.seq) {
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '16px system-ui';
      ctx.fillText('Load a sequence to begin — try a preset on the left.', 24, 40);
      return;
    }
    const viz = getVisualizer(state.vizId);
    const view = new SequenceView(state.seq);
    if (view.length < viz.minTerms) {
      showNotice(`${viz.name} works best with at least ${viz.minTerms} terms (loaded: ${view.length}).`);
    }
    const draw = (seq: typeof state.seq, w: number, h: number, ox: number, label: string) => {
      ctx.save();
      ctx.translate(ox, 0);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      try {
        viz.render(new SequenceView(seq!), state.params, ctx, { width: w, height: h });
      } catch (e) {
        showError(`Render failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '12px system-ui';
      ctx.fillText(label, 10, h - 10);
      ctx.restore();
    };

    if (comparison.mode === 'side') {
      const surr = surrogateSequence(state.seq, comparison.surrogate, comparison.seed);
      draw(state.seq, width / 2 - 1, height, 0, 'real');
      ctx.strokeStyle = '#333';
      ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
      draw(surr, width / 2 - 1, height, width / 2 + 1, `${comparison.surrogate} surrogate`);
    } else if (comparison.mode === 'flip') {
      const shown = comparison.showSurrogate
        ? surrogateSequence(state.seq, comparison.surrogate, comparison.seed)
        : state.seq;
      draw(shown, width, height, 0, comparison.showSurrogate ? `${comparison.surrogate} surrogate` : 'real');
    } else if (comparison.mode === 'ensemble' && viz.statistics) {
      // The adaptive log/linear scale decision (histogram's 'terms' target,
      // see shouldUseLogScale in viz/histogram.ts) must be made ONCE from the
      // real sequence and shared by the real line AND every surrogate draw.
      // runEnsemble calls statistics() once per surrogate draw, independently
      // of this real-line call; for 'permutation' surrogates the value
      // multiset is invariant so the decision always agrees regardless, but
      // 'difference' and 'matched' surrogates do not preserve that, so a
      // given draw could otherwise pick a different scale than the real line
      // (or than other draws), and percentileBands would then blend
      // incompatible units into one meaningless band. logScaleOverride is
      // ignored by every other target/visualizer, so it's harmless to always
      // include it here.
      const paramsWithScale: Params = { ...state.params, logScaleOverride: shouldUseLogScale(view) };
      if (state.vizId === 'histogram') {
        // Same cross-draw-sync story as logScaleOverride above, for the bin
        // *domain* rather than the scale: computeHistogram derives lo/hi
        // from whichever values it's handed, so left alone, every surrogate
        // draw bins into its own value range and percentileBands stacks
        // bin i across draws as though it meant the same interval in each —
        // it doesn't (task FR, C1: measured band 2..13 vs a fixed-domain
        // band of 3..107 for the same real bin-0 count of 46, a false "far
        // outside the null envelope" on the one claim this product exists
        // to make). Computed once here from the real sequence's own target
        // values and passed through unconditionally, the same way
        // logScaleOverride is; histogramDomainLo/Hi are ignored by every
        // other target/visualizer.
        const vals = targetValues(view, String(state.params.target), paramsWithScale.logScaleOverride as boolean);
        const { lo, hi } = minMax(vals);
        paramsWithScale.histogramDomainLo = lo;
        paramsWithScale.histogramDomainHi = hi;
      }
      const job: EnsembleJob = {
        terms: state.seq.terms.map(String),
        surrogate: comparison.surrogate,
        count: comparison.ensembleN,
        seed: comparison.seed,
        vizId: state.vizId,
        params: paramsWithScale,
      };
      const key = JSON.stringify(job);
      if (key !== ensembleKey) {
        ensembleKey = key;
        ensembleBands = null;
        ensembleFailed = false;
        ensembleCancel?.cancel();
        ensembleCancel = startEnsembleWorker(job, {
          onProgress: () => {},
          onResult: (stats) => { ensembleBands = stats; redraw(); },
          onError: (m) => {
            // Leaving ensembleKey pointed at this failed job's key would
            // make every later redraw take the "already dispatched" branch
            // above and keep repainting "Computing…" forever, even though
            // nothing is actually running anymore — the error banner
            // auto-dismisses after 6s, but that false "computing" text
            // would not. Clearing it lets the next redraw (from any
            // trigger — a param tweak, a resize, …) attempt the job again
            // instead of being silently wedged.
            ensembleKey = '';
            ensembleFailed = true;
            showError(`Ensemble failed: ${m}`);
          },
        });
      }
      if (ensembleBands) {
        drawEnsembleChart(ctx, { width, height }, viz.statistics(view, paramsWithScale), ensembleBands);
      } else if (ensembleFailed) {
        ctx.fillStyle = '#f7768e';
        ctx.font = '14px system-ui';
        ctx.fillText('Ensemble computation failed — change a parameter to retry.', 24, 40);
      } else {
        ctx.fillStyle = '#9aa0aa';
        ctx.font = '14px system-ui';
        ctx.fillText(`Computing ${comparison.ensembleN}-surrogate ensemble…`, 24, 40);
      }
    } else {
      draw(state.seq, width, height, 0, '');
    }
  }

  // Apply a decoded UrlState: shared by the startup call below AND the
  // hashchange handler, so a share URL applies identically whether it's a
  // cold load or a same-document navigation (pushing/replacing the hash
  // doesn't reload the page, so startup-only decoding would miss it). A
  // garbage-but-decodable hash must not break anything: vizId is checked
  // against the registry, params are merged over defaults, mode/surrogate
  // fall back if unrecognized, and decodeState itself returns null for
  // anything that isn't valid encoded JSON (leaving current state untouched).
  function applyHash(hash: string): void {
    const decoded = decodeState(hash);
    if (decoded) {
      // Seed currentRef immediately: the redraw() below runs syncUrl before
      // an async OEIS lookup resolves, and a failed lookup must not strip the
      // shared ref (reload/re-share should still be able to retry it).
      // applySeq re-derives an equal ref once the sequence actually loads.
      currentRef = decoded.seqRef ?? null;
      if (allVisualizers().some((v) => v.id === decoded.vizId)) {
        state.vizId = decoded.vizId;
        state.params = { ...defaultParams(getVisualizer(decoded.vizId).params), ...decoded.params };
        picker.value = state.vizId;
        rebuildParams();
      }
      if (MODES.includes(decoded.mode)) comparison.mode = decoded.mode;
      if (SURROGATES.includes(decoded.surrogate)) comparison.surrogate = decoded.surrogate;
      if (typeof decoded.seed === 'number') comparison.seed = decoded.seed;
      // Absent on links encoded before this field existed (or any other
      // malformed hash) — keep whatever ensembleN already is rather than
      // clobbering it with undefined/NaN.
      if (typeof decoded.ensembleN === 'number' && Number.isFinite(decoded.ensembleN)) {
        comparison.ensembleN = decoded.ensembleN;
      }
      bar.refresh();
      bar.update(Boolean(getVisualizer(state.vizId).statistics));
    }
    redraw();

    // Restore the shared sequence, if this hash carried one.
    const ref = decoded?.seqRef;
    if (ref?.kind === 'oeis') {
      lookupById(ref.aNumber).then(applySeq).catch((e) => showError(e instanceof Error ? e.message : String(e)));
    } else if (ref?.kind === 'formula') {
      try { applySeq(sequenceFromFormula(ref.src, ref.count)); }
      catch (e) { showError(e instanceof Error ? e.message : String(e)); }
    } else if (ref?.kind === 'paste') {
      try { applySeq({ terms: ref.terms.map(BigInt), name: 'Pasted sequence', offset: 0, source: 'paste' }); }
      catch (e) { showError(e instanceof Error ? e.message : String(e)); }
    }
  }

  window.addEventListener('resize', redraw);
  window.addEventListener('hashchange', () => {
    // Ignore echoes of our own syncUrl writes. Per spec, history.replaceState
    // shouldn't fire hashchange at all, but that's not guaranteed across
    // browsers — without this guard a self-inflicted event here would
    // re-apply state, redraw, call syncUrl, and potentially repeat.
    if (location.hash === lastHashWritten) return;
    applyHash(location.hash);
  });
  applyHash(location.hash);
}
