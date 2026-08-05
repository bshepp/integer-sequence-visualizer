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

export function mountApp(root: HTMLElement): void {
  registerAll();

  const state: { seq: Sequence | null; vizId: string; params: Params } = {
    seq: null,
    vizId: allVisualizers()[0]!.id,
    params: defaultParams(allVisualizers()[0]!.params),
  };

  const comparison = defaultComparison();
  let ensembleCancel: { cancel(): void } | null = null;
  let ensembleBands: Record<string, Bands> | null = null;
  let ensembleKey = '';
  let ensembleStatus: 'idle' | 'running' = 'idle';

  root.replaceChildren();
  const layout = document.createElement('div');
  layout.className = 'layout';
  root.appendChild(layout);

  const messages = document.createElement('div');
  messages.className = 'messages';
  root.appendChild(messages);
  initMessages(messages);

  // sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  const panel = buildSequencePanel({
    onSequence(seq) {
      state.seq = seq;
      panel.setInfo(seq);
      bar.update(Boolean(getVisualizer(state.vizId).statistics));
      redraw();
    },
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

  function redraw(): void {
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
}
