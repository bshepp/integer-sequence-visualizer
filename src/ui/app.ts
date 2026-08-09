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
import { defaultComparison, surrogateSequence, drawEnsembleChart, buildComparisonBar, supportsSuperimpose } from './comparison';
import { startEnsembleWorker, type EnsembleJob } from '../nullmodel/ensemble';
import type { Bands } from '../nullmodel/bands';
import { buildSweepView } from './sweep';
import { encodeState, decodeState, type SeqRef } from './urlState';
import { lookupById } from '../sequence/oeisClient';
import { sequenceFromFormula } from '../sequence/formula';
import { buildExplainPanel } from './explainPanel';
import { SURROGATE_EXPLAIN } from '../nullmodel/surrogates';
import { buildReadout, describeHit, drawMarker, correspondingIndex } from './readout';
import { hitIndex, type Hit } from '../viz/hit';
import { canvasTheme } from '../viz/theme';
import { initialTheme, applyTheme, buildThemeToggle } from './themeToggle';
import {
  IDENTITY_VIEWPORT, applyViewport, screenToWorld, worldToScreen, zoomAt, clampViewport,
  type Viewport,
} from './viewport';
import type { Size } from '../viz/types';
import { buildLanding, shouldShowLanding, routeFor, GALLERY_HASH, ABOUT_HASH } from './landing';
import { buildAbout } from './about';
import { buildStyleControls } from './styleControls';
import { sequenceRows, toCSV, toJSON, downloadBlob } from './exportData';
import { exportCanvasPng } from './exportImage';
import { buildDataTable } from './dataTable';
import { citationFor } from './citation';
import { DEFAULT_STYLE, styleToParams, styleFromParams, type RenderStyle } from '../viz/style';
import { heroEntry } from '../gallery/entries';
import type { GalleryEntry } from '../gallery/types';

const MODES = ['off', 'side', 'over', 'flip', 'ensemble'];
const SURROGATES = ['permutation', 'difference', 'matched'];

// Each mounted app gets a distinct id prefix. Only one exists in the running
// page, but hardcoded ids collide the moment two coexist in a document -- and
// duplicate ids break aria-controls and skip-link resolution, which is exactly
// the wiring these ids exist for. Same fix as buildSequencePanel's.
let appSeq = 0;

export function mountApp(root: HTMLElement): void {
  registerAll();
  const uid = `app${++appSeq}`;
  // Before anything draws, so the first paint is already in the right theme.
  applyTheme(initialTheme());

  const state: { seq: Sequence | null; vizId: string; params: Params } = {
    seq: null,
    vizId: allVisualizers()[0]!.id,
    params: defaultParams(allVisualizers()[0]!.params),
  };

  const comparison = defaultComparison();
  const style: RenderStyle = { ...DEFAULT_STYLE };
  let currentRef: SeqRef | null = null;

  let ensembleCancel: { cancel(): void } | null = null;
  let ensembleBands: Record<string, Bands> | null = null;
  let ensembleKey = '';
  // Set when the most recent ensemble job for `ensembleKey` failed, so
  // drawScene can paint a distinct "failed" placeholder instead of
  // re-showing "Computing…" forever (see onError below).
  let ensembleFailed = false;

  root.replaceChildren();

  // First in the DOM so it is the first Tab stop: the sidebar otherwise puts
  // the load panel plus ~20 preset buttons ahead of the visualization.
  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = `#${uid}-main`;
  skip.textContent = 'Skip to the visualization';
  root.appendChild(skip);

  const header = document.createElement('header');
  header.className = 'app-header';
  const wordmark = document.createElement('div');
  wordmark.className = 'app-wordmark';
  // A real heading, not a styled span: the page had no h1 at all, so
  // assistive technology had nothing to anchor the document outline to.
  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = 'Ulam';
  const subtitle = document.createElement('span');
  subtitle.className = 'app-subtitle';
  subtitle.textContent = 'OEIS sequence visualizer';
  wordmark.append(title, subtitle);
  const tagline = document.createElement('p');
  tagline.className = 'app-tagline';
  tagline.textContent = 'Render an integer sequence, then test whether the structure you see survives a null model.';
  const headerNav = document.createElement('nav');
  headerNav.className = 'header-nav';
  headerNav.setAttribute('aria-label', 'Pages');
  const themeUi = buildThemeToggle(() => redraw());
  headerNav.appendChild(themeUi.el);

  const navGallery = document.createElement('button');
  navGallery.className = 'header-nav-button';
  navGallery.type = 'button';
  navGallery.textContent = 'Gallery';
  navGallery.addEventListener('click', () => goTo(GALLERY_HASH));
  const navAbout = document.createElement('button');
  navAbout.className = 'header-nav-button';
  navAbout.type = 'button';
  navAbout.textContent = 'About';
  navAbout.addEventListener('click', () => goTo(ABOUT_HASH));
  headerNav.append(navGallery, navAbout);

  header.append(wordmark, tagline, headerNav);
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

  // The sentence lives in its own element because the footer is a flex row:
  // loose text nodes would each become an anonymous flex item and the gap
  // would break the licence text into fragments.
  const attributionText = document.createElement('span');
  attributionText.className = 'attribution-text';
  attributionText.append('Sequence data from ');
  const oeisLink = document.createElement('a');
  oeisLink.href = 'https://oeis.org/';
  oeisLink.target = '_blank';
  oeisLink.rel = 'noopener noreferrer';
  oeisLink.textContent = 'The On-Line Encyclopedia of Integer Sequences';
  attributionText.appendChild(oeisLink);
  attributionText.append('®, © OEIS Foundation Inc., used under ');
  const ccLink = document.createElement('a');
  ccLink.href = 'https://creativecommons.org/licenses/by-sa/4.0/';
  ccLink.target = '_blank';
  ccLink.rel = 'noopener noreferrer';
  ccLink.textContent = 'CC BY-SA 4.0';
  attributionText.appendChild(ccLink);
  attributionText.append('.');
  footer.appendChild(attributionText);

  // Assembled at runtime rather than written into the HTML. The address is
  // already public in the SeqFan archive, so this is not hiding it -- it just
  // means the trivial scrapers that regex mailto: out of served markup come up
  // empty, which is most of them.
  const contact = document.createElement('a');
  contact.className = 'contact-link';
  const user = 'bshepp';
  const host = ['gmail', 'com'].join('.');
  contact.href = `mailto:${user}@${host}`;
  contact.textContent = `Contact: ${user}@${host}`;
  footer.appendChild(contact);

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
    dataTable.setSequence(seq);
    bar.update(Boolean(getVisualizer(state.vizId).statistics), supportsSuperimpose(getVisualizer(state.vizId)));
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
  main.id = `${uid}-main`;
  // -1 rather than 0: reachable as a skip target without adding a Tab stop.
  main.tabIndex = -1;
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
    hintPending = true;
    state.vizId = picker.value;
    state.params = defaultParams(getVisualizer(state.vizId).params);
    rebuildParams();
    bar.update(Boolean(getVisualizer(state.vizId).statistics), supportsSuperimpose(getVisualizer(state.vizId)));
    redraw();
  });
  picker.setAttribute('aria-label', 'Visualization technique');
  topbar.appendChild(picker);

  // Style is set-once-and-forget for most sessions, and six always-visible
  // controls cost a whole wrapped row of the topbar -- measured at 151px of
  // chrome, leaving the canvas only 61% of the viewport on a short screen.
  // Behind a disclosure it costs one button.
  const styleUi = buildStyleControls(style, userChanged);
  styleUi.el.hidden = true;
  styleUi.el.id = `${uid}-style`;

  const styleToggle = document.createElement('button');
  styleToggle.className = 'style-toggle';
  styleToggle.type = 'button';
  styleToggle.textContent = 'Style';
  styleToggle.setAttribute('aria-expanded', 'false');
  styleToggle.setAttribute('aria-controls', styleUi.el.id);
  styleToggle.addEventListener('click', () => {
    styleUi.el.hidden = !styleUi.el.hidden;
    styleToggle.setAttribute('aria-expanded', String(!styleUi.el.hidden));
    styleToggle.classList.toggle('style-toggle--open', !styleUi.el.hidden);
    redraw();
  });

  const explain = buildExplainPanel();
  const explainBtn = document.createElement('button');
  explainBtn.className = 'explain-button';
  explainBtn.type = 'button';
  explainBtn.textContent = 'i';
  explainBtn.addEventListener('click', () => {
    const viz = getVisualizer(state.vizId);
    explain.show(
      viz.name,
      `${viz.explain.long}\n\nNull model - ${comparison.surrogate}: ${SURROGATE_EXPLAIN[comparison.surrogate].long}`,
    );
  });
  topbar.appendChild(explainBtn);
  // Style sits between the (i) button and the visualizer's own parameters:
  // it opens a second row of controls, so it reads as a peer of the knobs
  // rather than as a trailing afterthought.
  topbar.appendChild(styleToggle);

  // Parameters sit on the picker row, immediately after the (i) button, so the
  // knobs you actually turn are next to the thing they belong to.
  const paramsHost = document.createElement('div');
  topbar.appendChild(paramsHost);

  const vizShort = document.createElement('p');
  vizShort.className = 'viz-short';
  topbar.appendChild(vizShort);

  // Last child deliberately: .style-controls is flex-basis:100%, so wherever
  // it sits it claims a full row. Appended earlier it was splitting the
  // picker from the (i) button and the parameter sliders.
  topbar.appendChild(styleUi.el);
  function rebuildParams(): void {
    const current = getVisualizer(state.vizId);
    vizShort.textContent = current.explain.short;
    explainBtn.setAttribute('aria-label', `What is the ${current.name} view?`);
    paramsHost.replaceChildren(
      buildParamControls(getVisualizer(state.vizId).params, state.params, (id, value) => {
        state.params[id] = value;
        userChanged();
      }),
    );
  }
  rebuildParams();



  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  main.appendChild(canvasWrap);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvasWrap.appendChild(canvas);
  main.appendChild(explain.el);

  const readout = buildReadout();
  canvasWrap.appendChild(readout.el);

  // The term the user pinned by clicking, or null. Survives redraws (a flip
  // included) so the marker anchors the eye while the substrate changes.
  let pinnedIndex: number | null = null;
  let viewport: Viewport = { ...IDENTITY_VIEWPORT };

  // Panel geometry for hit-testing: in side-by-side the left half is the real
  // sequence, and the pointer must not report real-sequence indices for
  // surrogate pixels.
  function hitGeometry(): { size: Size; panelW: number } {
    const rect = canvasWrap.getBoundingClientRect();
    const size = { width: Math.max(200, rect.width), height: Math.max(200, rect.height) };
    return { size, panelW: comparison.mode === 'side' ? size.width / 2 - 1 : size.width };
  }

  // Pointer position in CSS pixels relative to the canvas - the coordinate
  // space every visualizer's locate() works in, since drawScene sets the 2D
  // transform to dpr.
  function canvasPoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * What is under the pointer, and which panel it belongs to.
   *
   * In side-by-side the right half draws a *different* sequence, so it gets
   * hit-tested against that surrogate rather than being ignored (which is what
   * it used to do) or - much worse - reported using real-sequence indices.
   */
  function hitAt(pt: { x: number; y: number }): { hit: Hit; seq: Sequence; panel: 'real' | 'null' } | null {
    const viz = getVisualizer(state.vizId);
    if (!state.seq || !viz.locate) return null;
    const { size, panelW } = hitGeometry();

    let x = pt.x;
    let seq: Sequence = state.seq;
    let panel: 'real' | 'null' = 'real';
    if (comparison.mode === 'side' && pt.x > size.width / 2) {
      x = pt.x - (size.width / 2 + 1);
      seq = surrogateSequence(state.seq, comparison.surrogate, comparison.seed);
      panel = 'null';
    }

    // Into the visualizer's own coordinate space, which knows nothing of zoom.
    const w = screenToWorld(viewport, x, pt.y);
    const hit = viz.locate(new SequenceView(seq), state.params, { width: panelW, height: size.height }, w.x, w.y);
    return hit ? { hit, seq, panel } : null;
  }

  let hoverPending = false;
  canvas.addEventListener('pointermove', (e) => {
    if (dragFrom) {
      setViewport({
        zoom: viewport.zoom,
        panX: dragFrom.panX + (e.clientX - dragFrom.x),
        panY: dragFrom.panY + (e.clientY - dragFrom.y),
      });
      readout.set(null);
      return;
    }
    // Throttle to one hit-test per animation frame: locate() is an O(n) scan
    // for path visualizers and pointermove fires far faster than 60Hz.
    if (hoverPending) return;
    hoverPending = true;
    const pt = canvasPoint(e);
    requestAnimationFrame(() => {
      hoverPending = false;
      if (!state.seq) { readout.set(null); return; }
      const found = hitAt(pt);
      readout.set(found
        ? `${found.panel === 'null' ? `${comparison.surrogate} null · ` : ''}${describeHit(found.hit, new SequenceView(found.seq))}`
        : null);
    });
  });
  canvas.addEventListener('pointerleave', () => readout.set(null));

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    setViewport(zoomAt(viewport, e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top));
  }, { passive: false });

  // Drag to pan. `downAt` also lets the click handler tell a pan from a click,
  // so ending a drag over a line does not also pin that term.
  let dragFrom: { x: number; y: number; panX: number; panY: number } | null = null;
  let downAt: { x: number; y: number } | null = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    downAt = { x: e.clientX, y: e.clientY };
    dragFrom = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
    canvas.setPointerCapture(e.pointerId);
  });

  const endDrag = (e: PointerEvent) => {
    dragFrom = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('click', (e) => {
    if (!state.seq) return;
    // The end of a pan is not a click on a term.
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
    const found = hitAt(canvasPoint(e));
    // Pin only from the real panel: a surrogate index moves when the seed
    // changes, so pinning one would silently point somewhere else later.
    const idx = found && found.panel === 'real' ? hitIndex(found.hit) : null;
    // Clicking the same term again clears the pin.
    pinnedIndex = idx !== null && idx === pinnedIndex ? null : idx;
    redraw();
  });

  const exportBar = document.createElement('div');
  exportBar.className = 'export-bar';

  const mkExport = (cls: string, label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    exportBar.appendChild(b);
    return b;
  };

  const slug = () => (state.seq?.aNumber ?? state.seq?.name ?? 'sequence').replace(/[^\w.-]+/g, '-');

  mkExport('export-png', 'PNG', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    exportCanvasPng(canvas, state.seq, `${slug()}-${state.vizId}.png`);
  });
  mkExport('export-csv', 'CSV', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    downloadBlob(`${slug()}.csv`, 'text/csv;charset=utf-8', toCSV(state.seq, sequenceRows(state.seq)));
  });
  mkExport('export-json', 'JSON', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    downloadBlob(`${slug()}.json`, 'application/json', toJSON(state.seq, sequenceRows(state.seq)));
  });

  mkExport('copy-citation', 'Copy citation', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    const text = citationFor({
      seq: state.seq,
      vizName: getVisualizer(state.vizId).name,
      url: location.href,
      accessed: new Date().toISOString().slice(0, 10),
    });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showNotice('Citation copied.'))
        .catch(() => showError('Could not copy the citation.'));
    } else {
      showNotice(text);
    }
  });

  const dataTable = buildDataTable();
  dataTable.el.id = `${uid}-data-table`;
  const tableToggle = mkExport('table-toggle', 'Show the numbers', () => {
    dataTable.toggle();
    tableToggle.setAttribute('aria-expanded', String(dataTable.isOpen()));
    tableToggle.textContent = dataTable.isOpen() ? 'Hide the numbers' : 'Show the numbers';
    // drawScene pins the canvas to an explicit pixel width and height, so it
    // does not follow its flex container on its own. Revealing the table
    // shrinks the wrapper but left the canvas at its old size, overhanging
    // the first rows of the table. Redrawing re-measures and re-sizes it.
    redraw();
  });
  tableToggle.setAttribute('aria-expanded', 'false');
  tableToggle.setAttribute('aria-controls', dataTable.el.id);

  mkExport('copy-link', 'Copy link', () => {
    // The URL encodes the whole view as base64, so selecting it out of the
    // address bar is genuinely awkward -- which is the thing people do most.
    const url = location.href;
    const done = () => showNotice('Link copied - it reproduces this exact view.');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => showError('Could not copy the link.'));
    } else {
      showNotice(url);
    }
  });

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'zoom-level';
  zoomLabel.setAttribute('role', 'status');

  function setViewport(v: Viewport): void {
    viewport = clampViewport(v);
    zoomLabel.textContent = `${Math.round(viewport.zoom * 100)}%`;
    redraw();
  }

  const canvasCentre = () => {
    const r = canvasWrap.getBoundingClientRect();
    return { x: Math.max(200, r.width) / 2, y: Math.max(200, r.height) / 2 };
  };

  const mkZoom = (cls: string, label: string, aria: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    exportBar.appendChild(b);
    return b;
  };

  mkZoom('zoom-out', '−', 'Zoom out', () => {
    const c = canvasCentre();
    setViewport(zoomAt(viewport, 1 / 1.4, c.x, c.y));
  });
  exportBar.appendChild(zoomLabel);
  mkZoom('zoom-in', '+', 'Zoom in', () => {
    const c = canvasCentre();
    setViewport(zoomAt(viewport, 1.4, c.x, c.y));
  });
  mkZoom('zoom-reset', 'Reset', 'Reset zoom and pan', () => setViewport({ ...IDENTITY_VIEWPORT }));
  zoomLabel.textContent = '100%';

  const feedback = document.createElement('a');
  feedback.className = 'feedback-link';
  feedback.href = 'https://github.com/bshepp/integer-sequence-visualizer/issues/new';
  feedback.target = '_blank';
  feedback.rel = 'noopener noreferrer';
  feedback.textContent = 'Report a problem';
  exportBar.appendChild(feedback);

  main.appendChild(exportBar);
  main.appendChild(dataTable.el);

  const bar = buildComparisonBar(comparison, userChanged);
  main.insertBefore(bar.el, canvasWrap);
  bar.update(Boolean(getVisualizer(state.vizId).statistics), supportsSuperimpose(getVisualizer(state.vizId)));

  const sweepBtn = document.createElement('button');
  sweepBtn.className = 'sweep-button';
  sweepBtn.type = 'button';
  sweepBtn.textContent = 'Sweep…';
  sweepBtn.addEventListener('click', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    const numeric = getVisualizer(state.vizId).params.filter((p) => p.kind === 'number');
    if (numeric.length === 0) { showNotice('This visualizer has no numeric parameters to sweep.'); return; }
    // Which parameter to sweep is chosen inside the dialog now. It used to be
    // a window.prompt() fired before opening, which blocks the renderer, has
    // no accessible context, and made switching parameters a close-and-reopen.
    const opener = document.activeElement as HTMLElement | null;
    const overlay = buildSweepView({
      seq: state.seq, viz: getVisualizer(state.vizId), baseParams: { ...state.params },
      paramId: numeric[0]!.id, count: 12,
      onPick(id, value) { state.params[id] = value; rebuildParams(); redraw(); },
      onClose() {
        overlay.remove();
        setEngineInert(false);
        opener?.focus();
      },
    });
    root.appendChild(overlay);
    // The same trick the landing uses: everything behind the dialog leaves
    // the tab order and the accessibility tree, which is a focus trap without
    // hand-rolling one.
    setEngineInert(true);
    overlay.querySelector<HTMLButtonElement>('.sweep-close')?.focus();
  });
  bar.el.appendChild(sweepBtn);

  // The hash the app itself last wrote via syncUrl. The hashchange handler
  // compares against this to ignore its own writes: replaceState shouldn't
  // fire hashchange per spec, but browsers vary, and a redraw -> syncUrl ->
  // hashchange -> re-apply -> redraw loop would be far worse than a stale view.
  let lastHashWritten = '';

  // Shown once, ever. The URL encodes the whole view, but it is a base64 blob,
  // so nothing about looking at it suggests that. A label cannot teach this
  // and a "Bookmark" button cannot do it (no browser has exposed an API for
  // that in years). What does teach it is saying so at the exact moment it
  // first becomes true -- when the address changes because the reader changed
  // the picture.
  const SHARE_HINT_KEY = 'ulam-share-hint';
  let hintPending = false;
  function noteAddressIsShareable(): void {
    if (!hintPending) return;
    hintPending = false;
    try {
      if (localStorage.getItem(SHARE_HINT_KEY)) return;
      localStorage.setItem(SHARE_HINT_KEY, '1');
    } catch { return; } // private mode: skip rather than nag every reload
    showNotice('The address bar now points at this exact view. Bookmark it to come back, or use Copy link.');
  }

  /** A change the reader made, as opposed to one the app made for them. */
  function userChanged(): void {
    hintPending = true;
    redraw();
  }

  function syncUrl(): void {
    // While an overlay is up the URL must stay on its reserved hash. Without
    // this, the redraw that paints the engine underneath immediately
    // replaceState()s a default engine hash over "/" or "#about", and a reload
    // would then decode that hash and skip the page forever.
    if (overlayEl) return;
    try {
      const hash = '#' + encodeState({
        seqRef: currentRef, vizId: state.vizId, params: state.params,
        mode: comparison.mode, surrogate: comparison.surrogate, seed: comparison.seed,
        ensembleN: comparison.ensembleN, style, viewport,
      });
      const changed = lastHashWritten !== '' && lastHashWritten !== hash;
      lastHashWritten = hash;
      history.replaceState(null, '', hash);
      if (changed) noteAddressIsShareable();
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

  /**
   * Identity line for a rendered panel: which sequence, and how many terms of
   * it are actually drawn. The term count matters as much as the A-number -
   * the same sequence at 80 terms and at 2,001 terms produces very different
   * pictures, and without this the two are indistinguishable in a screenshot.
   */
  function seqLabel(seq: Sequence): string {
    const who = seq.aNumber ?? seq.name;
    return `${who} · ${seq.terms.length.toLocaleString()} terms`;
  }

  function panelLabel(role: string, seq: Sequence): string {
    return role ? `${role} - ${seqLabel(seq)}` : seqLabel(seq);
  }

  function drawScene(): void {
    // The canvas is the product; without this it is an unlabelled graphic to
    // any assistive technology. Set before the 2D-context check below, since
    // the description comes from state rather than from rendering and must
    // survive a context that is unavailable.
    if (state.seq) {
      const described = getVisualizer(state.vizId);
      canvas.setAttribute(
        'aria-label',
        `${described.name} of ${seqLabel(state.seq)}. ${described.explain.long}`,
      );
    }

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
    ctx.fillStyle = canvasTheme().bg;
    ctx.fillRect(0, 0, width, height);
    if (!state.seq) {
      ctx.fillStyle = canvasTheme().muted;
      ctx.font = '16px system-ui';
      ctx.fillText('Load a sequence to begin - try a preset on the left.', 24, 40);
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
      ctx.save();
      applyViewport(ctx, viewport);
      try {
        // Stroke width is divided by the zoom so a line keeps its on-screen
        // thickness: zooming in should reveal finer structure, not fatten
        // every line until the drawing fills in.
        viz.render(new SequenceView(seq!), {
          ...state.params, ...styleToParams(style),
          styleLineWidth: style.lineWidth / viewport.zoom,
        }, ctx, { width: w, height: h });
      } catch (e) {
        showError(`Render failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      ctx.restore();
      // Drawn after restoring, so labels keep their size at any zoom.
      ctx.fillStyle = canvasTheme().muted;
      ctx.font = '12px system-ui';
      // Top of the panel: the cursor readout owns the bottom-left corner.
      ctx.fillText(label, 10, 16);
      ctx.restore();
    };

    if (comparison.mode === 'side') {
      const surr = surrogateSequence(state.seq, comparison.surrogate, comparison.seed);
      draw(state.seq, width / 2 - 1, height, 0, panelLabel('real', state.seq));
      ctx.strokeStyle = canvasTheme().grid;
      ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
      draw(surr, width / 2 - 1, height, width / 2 + 1, panelLabel(`${comparison.surrogate} null`, surr));

      if (pinnedIndex !== null && viz.position) {
        const panel = { width: width / 2 - 1, height };
        const real = viz.position(view, state.params, panel, pinnedIndex);
        if (real) drawMarker(ctx, worldToScreen(viewport, real.x, real.y), canvasTheme().real);
        const corr = correspondingIndex(pinnedIndex, comparison.surrogate, state.seq.terms, comparison.seed);
        const sp = viz.position(new SequenceView(surr), state.params, panel, corr.index);
        // Pink when the same term was genuinely followed; grey when this null
        // has no such term and we are only lining up indices.
        if (sp) {
          const m = worldToScreen(viewport, sp.x, sp.y);
          drawMarker(ctx, { x: m.x + width / 2 + 1, y: m.y }, corr.traced ? canvasTheme().real : canvasTheme().muted);
        }
        ctx.fillStyle = canvasTheme().muted;
        ctx.font = '11px system-ui';
        ctx.fillText(
          corr.traced
            ? `same term, moved to n = ${corr.index}`
            : 'index-for-index (this null does not preserve terms)',
          width / 2 + 11, height - 26,
        );
      }
    } else if (comparison.mode === 'over') {
      const surr = surrogateSequence(state.seq, comparison.surrogate, comparison.seed);
      // Null underneath in flat grey, real on top in full colour: the eye
      // should read the real sequence as figure and the null as ground.
      const nullStyle = { ...style, colorMode: 'none' as const };
      ctx.save();
      ctx.globalAlpha = 0.5;
      viz.render(new SequenceView(surr), { ...state.params, ...styleToParams(nullStyle) }, ctx, { width, height });
      ctx.restore();
      viz.render(view, { ...state.params, ...styleToParams(style) }, ctx, { width, height });
      ctx.fillStyle = canvasTheme().muted;
      ctx.font = '12px system-ui';
      ctx.fillText(`${seqLabel(state.seq)} - real (colour) over ${comparison.surrogate} null (grey)`, 10, 16);
      if (pinnedIndex !== null && viz.position) {
        const p = viz.position(view, state.params, { width, height }, pinnedIndex);
        if (p) drawMarker(ctx, worldToScreen(viewport, p.x, p.y), canvasTheme().real);
      }
    } else if (comparison.mode === 'flip') {
      const shown = comparison.showSurrogate
        ? surrogateSequence(state.seq, comparison.surrogate, comparison.seed)
        : state.seq;
      draw(shown, width, height, 0, panelLabel(comparison.showSurrogate ? `${comparison.surrogate} null` : 'real', shown));

      // The marker persists across the flip, anchoring the eye on one term
      // while the substrate swaps underneath it.
      if (pinnedIndex !== null && viz.position) {
        const idx = comparison.showSurrogate
          ? correspondingIndex(pinnedIndex, comparison.surrogate, state.seq.terms, comparison.seed).index
          : pinnedIndex;
        const p = viz.position(new SequenceView(shown), state.params, { width, height }, idx);
        if (p) drawMarker(ctx, worldToScreen(viewport, p.x, p.y), canvasTheme().real);
      }
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
      const paramsWithScale: Params = {
        ...state.params, ...styleToParams(style),
        logScaleOverride: shouldUseLogScale(view),
      };
      if (state.vizId === 'histogram') {
        // Same cross-draw-sync story as logScaleOverride above, for the bin
        // *domain* rather than the scale: computeHistogram derives lo/hi
        // from whichever values it's handed, so left alone, every surrogate
        // draw bins into its own value range and percentileBands stacks
        // bin i across draws as though it meant the same interval in each -
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
            // nothing is actually running anymore - the error banner
            // auto-dismisses after 6s, but that false "computing" text
            // would not. Clearing it lets the next redraw (from any
            // trigger - a param tweak, a resize, …) attempt the job again
            // instead of being silently wedged.
            ensembleKey = '';
            ensembleFailed = true;
            showError(`Ensemble failed: ${m}`);
          },
        });
      }
      if (ensembleBands) {
        drawEnsembleChart(ctx, { width, height }, viz.statistics(view, paramsWithScale), ensembleBands);
        // No single surrogate exists here, so there is nothing to mark. The
        // meaningful answer for a pinned index is that index's slice of the
        // null distribution, which is what the band is made of.
        if (pinnedIndex !== null) {
          const key = Object.keys(ensembleBands)[0];
          const band = key ? ensembleBands[key] : undefined;
          const widest = band?.levels[0];
          if (band && widest && pinnedIndex < band.median.length) {
            readout.set(
              `n = ${pinnedIndex}: null ${widest.pct}% spans ` +
              `${widest.lo[pinnedIndex]!.toPrecision(4)} to ${widest.hi[pinnedIndex]!.toPrecision(4)}`,
            );
          }
        }
      } else if (ensembleFailed) {
        ctx.fillStyle = canvasTheme().real;
        ctx.font = '14px system-ui';
        // "the next redraw retries" is literal - a window resize retries
        // too, not just a parameter change - so this says "will retry"
        // rather than naming one specific trigger.
        ctx.fillText('Ensemble computation failed - will retry automatically.', 24, 40);
      } else {
        ctx.fillStyle = canvasTheme().muted;
        ctx.font = '14px system-ui';
        ctx.fillText(`Computing ${comparison.ensembleN}-surrogate ensemble…`, 24, 40);
      }
    } else {
      draw(state.seq, width, height, 0, panelLabel('', state.seq));
      if (pinnedIndex !== null && viz.position) {
        const p = viz.position(view, state.params, { width, height }, pinnedIndex);
        if (p) drawMarker(ctx, worldToScreen(viewport, p.x, p.y), canvasTheme().real);
      }
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
  // `presetSeq` short-circuits the sequence restore at the end: a gallery
  // entry already carries its own bundled terms, and the bulk data file caps
  // stored terms per sequence - so letting the normal lookup run would swap
  // the 600-term walk the visitor just clicked for an 80-term one. Same
  // A-number, same attribution, just the fuller term list they were shown.
  function applyHash(hash: string, presetSeq?: Sequence): void {
    const route = routeFor(hash);
    if (route === 'about') { showAbout(); return; }
    if (route === 'landing') {
      // Explicitly navigating to #gallery is a deliberate request to see it,
      // so it overrides the session's "already dismissed" flag. That flag
      // exists to stop the landing re-mounting after an incidental redraw --
      // a parameter tweak or a resize -- not to make the link a dead end.
      landingDismissed = false;
      overlayEl?.remove();
      overlayEl = null;
      showLanding();
      return;
    }
    dismissOverlay(false);
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
      // malformed hash) - keep whatever ensembleN already is rather than
      // clobbering it with undefined/NaN.
      if (typeof decoded.ensembleN === 'number' && Number.isFinite(decoded.ensembleN)) {
        comparison.ensembleN = decoded.ensembleN;
      }
      if (decoded.style) {
        // Round-tripped through params deliberately: that re-validates and
        // clamps a style arriving from an untrusted URL.
        Object.assign(style, styleFromParams(styleToParams(decoded.style)));
        styleUi.refresh();
      }
      if (decoded.viewport) viewport = clampViewport(decoded.viewport);
      bar.refresh();
      bar.update(Boolean(getVisualizer(state.vizId).statistics), supportsSuperimpose(getVisualizer(state.vizId)));
    }
    redraw();

    if (presetSeq) { applySeq(presetSeq); return; }

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

  // One overlay slot for both non-engine pages: they are mutually exclusive
  // screens over the same engine, so tracking two would only create states
  // where both or neither is right.
  let overlayEl: HTMLElement | null = null;
  // Once dismissed, stays dismissed for the session: re-mounting the landing
  // after a parameter tweak would read as a bug, not a feature. Explicit
  // navigation clears it - see applyHash.
  let landingDismissed = false;

  /** Navigate to a reserved page. Goes through the hash so it is linkable. */
  function goTo(hash: string): void {
    location.hash = `#${hash}`;
    // replaceState-driven navigation does not always fire hashchange, and the
    // handler ignores our own writes, so apply directly.
    applyHash(location.hash);
  }

  // While the landing covers the viewport the engine behind it must not be
  // reachable by Tab and must not be announced - otherwise a keyboard user
  // tabs straight off the landing into controls they cannot see. `inert`
  // handles focus and the accessibility tree together.
  function setEngineInert(inert: boolean): void {
    // The skip link is a direct child of root rather than of the chrome, so
    // it has to be listed explicitly - otherwise Tab escapes a modal onto a
    // link whose target is itself inert, stranding focus.
    for (const el of [skip, header, layout, footer]) el.toggleAttribute('inert', inert);
  }

  function dismissOverlay(focusEngine = true): void {
    landingDismissed = true;
    overlayEl?.remove();
    overlayEl = null;
    setEngineInert(false);
    if (focusEngine) picker.focus();
  }

  function openEntry(entry: GalleryEntry): void {
    dismissOverlay(false);
    const hash = '#' + encodeState(entry.state);
    lastHashWritten = hash;
    try { history.replaceState(null, '', hash); } catch { /* sandboxed */ }
    applyHash(hash, entry.sequence);
  }

  function showLanding(): void {
    if (landingDismissed || overlayEl) return;
    overlayEl = buildLanding({
      onAbout: () => goTo(ABOUT_HASH),
      // "Open the full engine" lands on the hero's own view rather than an
      // empty canvas telling the visitor to load a sequence - which is the
      // cold open this whole screen exists to replace.
      onOpen: () => { openEntry(heroEntry()); picker.focus(); },
      onPick: openEntry,
    });
    setEngineInert(true);
    root.appendChild(overlayEl);
  }

  function showAbout(): void {
    overlayEl?.remove();
    overlayEl = buildAbout({
      onGallery: () => goTo(GALLERY_HASH),
      onEngine: () => { dismissOverlay(false); openEntry(heroEntry()); picker.focus(); },
    });
    setEngineInert(true);
    root.appendChild(overlayEl);
    overlayEl.querySelector<HTMLButtonElement>('.page-nav-button')?.focus();
  }

  // Redraw is synchronous and can take a noticeable moment on a long sequence
  // (a 2001-term b-file's digit walk is 418,487 points), so a drag-resize
  // otherwise looks frozen. Show the indicator immediately, then coalesce the
  // actual redraws to one per frame-ish.
  const busy = document.createElement('div');
  busy.className = 'busy';
  busy.hidden = true;
  busy.setAttribute('role', 'status');
  busy.textContent = 'Rendering…';
  canvasWrap.appendChild(busy);

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    busy.hidden = false;
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      redraw();
      busy.hidden = true;
    }, 120);
  });
  window.addEventListener('hashchange', () => {
    // Ignore echoes of our own syncUrl writes. Per spec, history.replaceState
    // shouldn't fire hashchange at all, but that's not guaranteed across
    // browsers - without this guard a self-inflicted event here would
    // re-apply state, redraw, call syncUrl, and potentially repeat.
    if (location.hash === lastHashWritten) return;
    applyHash(location.hash);
  });
  if (routeFor(location.hash) !== 'engine') {
    // Mount the landing BEFORE the first redraw: syncUrl is suppressed only
    // while landingEl is set, and a redraw ahead of it would replaceState a
    // default engine hash over the bare "/" - after which a reload decodes
    // that hash and the landing never appears again.
    showLanding();
    redraw();
  } else {
    applyHash(location.hash);
  }
}
