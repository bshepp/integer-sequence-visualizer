import type { Sequence } from '../sequence/sequence';
import { SequenceView } from '../sequence/sequence';
import { registerAll } from '../viz/all';
import { allVisualizers, getVisualizer } from '../viz/registry';
import { defaultParams, type Params } from '../viz/types';
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

  // Apply URL hash state BEFORE building controls so picker, param controls,
  // and the comparison bar all show the shared values. A garbage-but-decodable
  // hash must not break mount: vizId is checked against the registry, params
  // are merged over defaults, mode/surrogate fall back if unrecognized.
  const initial = decodeState(location.hash);
  if (initial) {
    // Seed currentRef immediately: the initial redraw's syncUrl rewrites the
    // hash before the async OEIS lookup resolves, and a failed lookup must not
    // strip the shared ref (reload should be able to retry). applySeq
    // re-derives an equal ref on successful load.
    currentRef = initial.seqRef ?? null;
    if (allVisualizers().some((v) => v.id === initial.vizId)) {
      state.vizId = initial.vizId;
      state.params = { ...defaultParams(getVisualizer(initial.vizId).params), ...initial.params };
    }
    if (MODES.includes(initial.mode)) comparison.mode = initial.mode;
    if (SURROGATES.includes(initial.surrogate)) comparison.surrogate = initial.surrogate;
    if (typeof initial.seed === 'number') comparison.seed = initial.seed;
  }
  let ensembleCancel: { cancel(): void } | null = null;
  let ensembleBands: Record<string, Bands> | null = null;
  let ensembleKey = '';
  let ensembleStatus: 'idle' | 'running' = 'idle';

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
    const paramId = numeric.length === 1
      ? numeric[0]!.id
      : window.prompt(`Sweep which parameter? (${numeric.map((p) => p.id).join(', ')})`, numeric[0]!.id) ?? numeric[0]!.id;
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

  function syncUrl(): void {
    try {
      history.replaceState(null, '', '#' + encodeState({
        seqRef: currentRef, vizId: state.vizId, params: state.params,
        mode: comparison.mode, surrogate: comparison.surrogate, seed: comparison.seed,
      }));
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
      const job: EnsembleJob = {
        terms: state.seq.terms.map(String),
        surrogate: comparison.surrogate,
        count: comparison.ensembleN,
        seed: comparison.seed,
        vizId: state.vizId,
        params: { ...state.params },
      };
      const key = JSON.stringify(job);
      if (key !== ensembleKey) {
        ensembleKey = key;
        ensembleBands = null;
        ensembleCancel?.cancel();
        ensembleStatus = 'running';
        ensembleCancel = startEnsembleWorker(job, {
          onProgress: () => {},
          onResult: (stats) => { ensembleBands = stats; ensembleStatus = 'idle'; redraw(); },
          onError: (m) => { ensembleStatus = 'idle'; showError(`Ensemble failed: ${m}`); },
        });
      }
      if (ensembleBands) {
        drawEnsembleChart(ctx, { width, height }, viz.statistics(view, state.params), ensembleBands);
      } else {
        ctx.fillStyle = '#9aa0aa';
        ctx.font = '14px system-ui';
        ctx.fillText(`Computing ${comparison.ensembleN}-surrogate ensemble…`, 24, 40);
      }
    } else {
      draw(state.seq, width, height, 0, '');
    }
  }

  window.addEventListener('resize', redraw);
  redraw();

  // Restore the shared sequence, if the URL carried one. currentRef was
  // already seeded from the hash above; applySeq re-derives it on success.
  const ref = initial?.seqRef;
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
