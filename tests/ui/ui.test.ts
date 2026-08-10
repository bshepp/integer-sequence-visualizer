// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { buildParamControls } from '../../src/ui/paramControls';
import { buildSequencePanel } from '../../src/ui/sequencePanel';
import { mountApp } from '../../src/ui/app';
import { PRESETS } from '../../src/sequence/presets';
import { encodeState, decodeState, type UrlState } from '../../src/ui/urlState';
import { clearSearchIndexCache } from '../../src/sequence/oeisClient';
import type { ParamSpec } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

// mountApp adds a window-level 'hashchange' listener and (correctly, for a
// real page that mounts once) never removes it. jsdom shares a single
// `window`/`location` across every test in this file, so every past
// mountApp() call's listener is still live: dispatching 'hashchange' below
// would otherwise also re-run every earlier test's app instance, whose own
// redraw() -> syncUrl() can rewrite the shared location.hash mid-dispatch
// and contaminate the test under test. Track every such listener so the
// hash-navigation tests can strip them and observe only their own instance.
const trackedHashchangeListeners: EventListenerOrEventListenerObject[] = [];
const realWindowAddEventListener = window.addEventListener.bind(window);
window.addEventListener = ((type: string, listener: any, options?: any) => {
  if (type === 'hashchange' && listener) trackedHashchangeListeners.push(listener);
  return realWindowAddEventListener(type, listener, options);
}) as typeof window.addEventListener;

describe('PRESETS', () => {
  it('includes the SeqFan finds and classics', () => {
    const ids = PRESETS.map((p) => p.aNumber);
    for (const a of ['A000376', 'A000464', 'A000828', 'A001051', 'A001553',
                     'A001571', 'A001603', 'A019488', 'A039188', 'A039685',
                     'A039970', 'A000045', 'A000040', 'A005132']) {
      expect(ids).toContain(a);
    }
  });
});

describe('buildParamControls', () => {
  const specs: ParamSpec[] = [
    { kind: 'number', id: 'k', label: 'K', default: 4, min: 2, max: 12, step: 1 },
    { kind: 'select', id: 'mode', label: 'Mode', default: 'a', options: ['a', 'b'] },
    { kind: 'boolean', id: 'log', label: 'Log', default: false },
  ];

  it('renders one control per spec', () => {
    const el = buildParamControls([...specs], { k: 4, mode: 'a', log: false }, () => {});
    expect(el.querySelectorAll('input[type="range"]').length).toBe(1);
    expect(el.querySelectorAll('select').length).toBe(1);
    expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(1);
  });

  it('emits coerced values on change', () => {
    const onChange = vi.fn();
    const el = buildParamControls([...specs], { k: 4, mode: 'a', log: false }, onChange);
    const range = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    range.value = '7';
    range.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('k', 7);
  });
});

describe('buildSequencePanel', () => {
  it('has three tabs and a presets shelf', () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    expect(el.querySelectorAll('.tab-button').length).toBe(3);
    expect(el.querySelectorAll('.preset-button').length).toBe(PRESETS.length);
  });

  it('setInfo shows the name, and enables the b-file fetch only for OEIS sequences', () => {
    // The b-file control is a permanent part of the "Load a sequence" section
    // rather than something that appears and vanishes with the info card, so
    // the contract is enabled/disabled rather than present/absent.
    const panel = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    const btn = () => panel.el.querySelector<HTMLButtonElement>('.bfile-button')!;

    expect(btn(), 'b-file control should exist before anything is loaded').not.toBeNull();
    expect(btn().disabled).toBe(true);

    panel.setInfo({ terms: [1n], aNumber: 'A000045', name: 'Fibonacci numbers', offset: 0, source: 'oeis' });
    expect(panel.el.textContent).toContain('Fibonacci');
    expect(btn().disabled).toBe(false);

    panel.setInfo({ terms: [1n], name: 'n*n', offset: 0, source: 'formula' });
    expect(btn().disabled).toBe(true);
    expect(btn().title).toMatch(/OEIS/i);
  });

  it('the OEIS A-number link opens with rel="noopener noreferrer" (task FR, M10)', () => {
    const panel = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    panel.setInfo({ terms: [1n], aNumber: 'A000045', name: 'Fibonacci numbers', offset: 0, source: 'oeis' });
    const link = panel.el.querySelector<HTMLAnchorElement>('.info-meta a')!;
    expect(link.target).toBe('_blank');
    expect(link.rel.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer']);
  });

  it('exactly one tab-pane is visible at a time, and it changes on tab click', () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    const panes = Array.from(el.querySelectorAll<HTMLElement>('.tab-pane'));
    const visibleBefore = panes.filter((p) => p.hidden === false);
    expect(visibleBefore.length).toBe(1);

    const buttons = el.querySelectorAll<HTMLButtonElement>('.tab-button');
    buttons[1]!.click(); // Search tab
    const visibleAfter = panes.filter((p) => p.hidden === false);
    expect(visibleAfter.length).toBe(1);
    expect(visibleAfter[0]).not.toBe(visibleBefore[0]);
  });

  it('groups the sidebar into labeled sections without disturbing existing structure', () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    const labels = Array.from(el.querySelectorAll('.section-label')).map((n) => n.textContent);
    // "Loaded" sits directly under what loaded it, rather than below a shelf
    // of two dozen presets that pushes it off a short screen.
    expect(labels).toEqual(['Load a sequence', 'Loaded', 'Presets']);
    // Regression guard: section labels must not have displaced the elements
    // existing tests and app.ts rely on.
    expect(el.querySelectorAll('.tab-button').length).toBe(3);
    expect(el.querySelectorAll('.preset-button').length).toBe(PRESETS.length);
  });
});

describe('buildSequencePanel - search index loading UX', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function openSearchPane(el: HTMLElement) {
    el.querySelectorAll<HTMLButtonElement>('.tab-button')[1]!.click(); // Search tab
    const pane = Array.from(el.querySelectorAll<HTMLElement>('.tab-pane')).find((p) => !p.hidden)!;
    return {
      input: pane.querySelector<HTMLInputElement>('input')!,
      btn: pane.querySelector<HTMLButtonElement>('button')!,
      status: pane.querySelector<HTMLElement>('.search-status')!,
    };
  }

  it('disables Search and shows a loading status while the index fetch is in flight, restoring on failure via onError', async () => {
    clearSearchIndexCache();
    const onError = vi.fn();
    const { el } = buildSequencePanel({ onSequence: () => {}, onError });
    const { input, btn, status } = openSearchPane(el);

    input.value = 'fibonacci';
    btn.click(); // synchronous: loading state is set before the (real, rejecting) fetch settles

    expect(btn.disabled).toBe(true);
    expect(status.textContent).toMatch(/loading/i);

    await new Promise((r) => setTimeout(r, 20)); // let the doomed relative-URL fetch reject

    expect(btn.disabled).toBe(false);
    expect(status.textContent).toBe('');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(typeof onError.mock.calls[0]![0]).toBe('string');
  });

  it('shows the loading status only for the first search, never once the index is cached', async () => {
    clearSearchIndexCache();
    const indexText = 'A000045\tFibonacci numbers.\n';
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({}), text: async () => indexText,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    const { input, btn, status } = openSearchPane(el);

    input.value = 'fibonacci';
    btn.click();
    expect(btn.disabled).toBe(true);
    expect(status.textContent).toMatch(/loading/i);
    await new Promise((r) => setTimeout(r, 20));
    expect(btn.disabled).toBe(false);
    // The loading placeholder is replaced by the result count, which the
    // status element announces as a live region - see tests/ui/a11y.test.ts.
    expect(status.textContent).not.toMatch(/loading/i);
    expect(status.textContent).toMatch(/1 match/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    input.value = 'fibonacci';
    btn.click(); // second search: index already cached - no loading phase this time
    expect(btn.disabled).toBe(false);
    expect(status.textContent).not.toMatch(/loading/i);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1); // still just the one index fetch
  });
});

describe('mountApp', () => {
  it('mounts sidebar, picker with all visualizers, and a canvas', () => {
    const root = document.createElement('div');
    mountApp(root);
    expect(root.querySelector('.sidebar')).not.toBeNull();
    expect(root.querySelector('canvas')).not.toBeNull();
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    expect(picker.options.length).toBe(9);
  });

  it('keeps the shared seqRef in the hash even when the startup OEIS lookup fails', async () => {
    // In this environment lookupById's relative-URL fetch('/api/…') rejects,
    // exercising the offline/API-down path: the ref must survive both the
    // initial redraw's syncUrl and the failed lookup, so a reload can retry.
    const shared: UrlState = {
      seqRef: { kind: 'oeis', aNumber: 'A000045' },
      vizId: 'polyarc',
      params: { angle: 30, modulus: 7, centered: true },
      mode: 'side',
      surrogate: 'permutation',
      seed: 1,
    };
    location.hash = '#' + encodeState(shared);
    const root = document.createElement('div');
    mountApp(root);
    expect(decodeState(location.hash)!.seqRef).toEqual({ kind: 'oeis', aNumber: 'A000045' });
    await new Promise((r) => setTimeout(r, 20)); // let the doomed lookup reject
    expect(decodeState(location.hash)!.seqRef).toEqual({ kind: 'oeis', aNumber: 'A000045' });
    history.replaceState(null, '', location.pathname); // reset URL for other tests
  });

  it('renders a header bar with the product title and premise', () => {
    const root = document.createElement('div');
    mountApp(root);
    const header = root.querySelector('.app-header');
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain('Ulam');
    expect(header!.textContent).toMatch(/null model/i);
  });

  it('renders a persistent attribution footer crediting OEIS under CC BY-SA 4.0', () => {
    const root = document.createElement('div');
    mountApp(root);
    const footer = root.querySelector('.attribution');
    expect(footer).not.toBeNull();
    expect(footer!.textContent).toContain('On-Line Encyclopedia of Integer Sequences');
    const links = Array.from(footer!.querySelectorAll('a'));
    const oeisLink = links.find((a) => a.href === 'https://oeis.org/');
    expect(oeisLink).toBeDefined();
    const ccLink = links.find((a) => a.href === 'https://creativecommons.org/licenses/by-sa/4.0/');
    expect(ccLink).toBeDefined();
  });
});

describe('mountApp - same-document hash navigation', () => {
  function clearTrackedHashchangeListeners(): void {
    for (const l of trackedHashchangeListeners.splice(0)) window.removeEventListener('hashchange', l as EventListener);
  }

  // Strip listeners left by any earlier test (see tracking shim above) so a
  // dispatched hashchange only reaches the instance this test just mounted.
  beforeEach(() => {
    clearTrackedHashchangeListeners();
  });
  afterEach(() => {
    clearTrackedHashchangeListeners();
    history.replaceState(null, '', location.pathname);
  });

  it('re-applies decoded state when location.hash changes without a reload (share URL navigation)', () => {
    const root = document.createElement('div');
    mountApp(root);
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    const modeSelect = root.querySelector<HTMLSelectElement>('.mode-select')!;
    const surrSelect = root.querySelector<HTMLSelectElement>('.surrogate-select')!;
    const seedInput = root.querySelector<HTMLInputElement>('.seed-input')!;

    // Sanity: starting state is the default, not the target we're about to share.
    expect(picker.value).not.toBe('polyarc');

    const target: UrlState = {
      seqRef: null,
      vizId: 'polyarc',
      params: { angle: 45, modulus: 9, centered: false },
      mode: 'side',
      surrogate: 'difference',
      seed: 42,
    };
    location.hash = '#' + encodeState(target);
    window.dispatchEvent(new Event('hashchange'));

    expect(picker.value).toBe('polyarc');
    expect(modeSelect.value).toBe('side');
    expect(surrSelect.value).toBe('difference');
    expect(seedInput.value).toBe('42');
  });

  it('does not loop when a redraw-triggered syncUrl write is echoed back as hashchange', () => {
    const root = document.createElement('div');
    mountApp(root);
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    const replaceStateSpy = vi.spyOn(history, 'replaceState');

    const target: UrlState = {
      seqRef: null,
      vizId: 'polyarc',
      params: { angle: 45, modulus: 9, centered: false },
      mode: 'side',
      surrogate: 'difference',
      seed: 42,
    };
    location.hash = '#' + encodeState(target);
    replaceStateSpy.mockClear();
    window.dispatchEvent(new Event('hashchange')); // real navigation: applies once, redraws, syncUrl writes

    expect(picker.value).toBe('polyarc');
    const callsAfterRealApply = replaceStateSpy.mock.calls.length;
    expect(callsAfterRealApply).toBeGreaterThan(0); // the apply's own redraw did write the hash back

    // location.hash now equals exactly what the app's own syncUrl just wrote.
    // Some browsers fire hashchange even for a same-value/programmatic write;
    // simulate that echo without changing location.hash at all.
    window.dispatchEvent(new Event('hashchange'));

    expect(replaceStateSpy.mock.calls.length).toBe(callsAfterRealApply); // no re-apply, no extra redraw/syncUrl
    expect(picker.value).toBe('polyarc'); // state untouched by the echo

    replaceStateSpy.mockRestore();
  });

  it('ignores a garbage hash on hashchange without crashing, leaving current state intact', () => {
    const root = document.createElement('div');
    mountApp(root);
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    const modeSelect = root.querySelector<HTMLSelectElement>('.mode-select')!;
    const beforeViz = picker.value;
    const beforeMode = modeSelect.value;

    location.hash = '#not-!!-valid-base64-or-json';

    expect(() => window.dispatchEvent(new Event('hashchange'))).not.toThrow();
    expect(picker.value).toBe(beforeViz);
    expect(modeSelect.value).toBe(beforeMode);
  });
});

function loadPastedSequence(root: HTMLElement, text: string): void {
  const tabButtons = root.querySelectorAll<HTMLButtonElement>('.tab-button');
  tabButtons[2]!.click(); // 'Custom' tab
  const textarea = root.querySelector<HTMLTextAreaElement>('textarea')!;
  textarea.value = text;
  const loadBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Load pasted')!;
  loadBtn.click();
}

describe('mountApp - sweep button Cancel handling (task FR, M9)', () => {
  // Picking 'turtle' writes it into location.hash via redraw()'s syncUrl()
  // (mountApp's own hashchange listener is never removed - see this file's
  // top-of-file comment - and neither is that hash write). Left in place, a
  // later test's fresh mountApp() would decode it on mount and start on
  // 'turtle' instead of its own default, exactly the kind of cross-test
  // pollution the "same-document hash navigation" describe block below
  // already guards against for its own tests.
  afterEach(() => {
    vi.restoreAllMocks();
    history.replaceState(null, '', location.pathname);
  });

  // The original M9 regression was: window.prompt returns null on Cancel, and
  // `?? default` treated that the same as an empty OK, silently sweeping the
  // first numeric parameter instead of aborting. That failure mode is now
  // structurally impossible -- there is no prompt and no cancel step, because
  // the parameter is chosen from a select inside the dialog. These two tests
  // pin the replacement behaviour so the prompt cannot quietly return.
  it('opens the sweep directly, with no window.prompt at all', () => {
    const root = document.createElement('div');
    mountApp(root);
    loadPastedSequence(root, '1,2,3,4,5,6,7,8');
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    picker.value = 'turtle'; // two numeric params (angle, k) -- used to prompt
    picker.dispatchEvent(new Event('change'));

    const promptSpy = vi.spyOn(window, 'prompt');
    const sweepBtn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Sweep…')!;
    sweepBtn.click();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(root.querySelector('.sweep-overlay')).not.toBeNull();
    promptSpy.mockRestore();
  });

  it('lets the parameter be chosen inside the dialog, without reopening it', () => {
    const root = document.createElement('div');
    mountApp(root);
    loadPastedSequence(root, '1,2,3,4,5,6,7,8');
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    picker.value = 'turtle';
    picker.dispatchEvent(new Event('change'));

    Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Sweep…')!.click();
    const overlay = root.querySelector('.sweep-overlay')!;
    const paramSelect = overlay.querySelector<HTMLSelectElement>('.sweep-param')!;
    expect([...paramSelect.options].map((o) => o.value).sort()).toEqual(['angle', 'k']);

    paramSelect.value = 'k';
    paramSelect.dispatchEvent(new Event('change'));
    expect(overlay.querySelector('.sweep-cell')!.textContent).toMatch(/k = /);
  });
});

describe('mountApp - ensemble failure does not stay permanently stuck on "Computing…" (task FR, I3)', () => {
  class FakeWorker {
    static instances: FakeWorker[] = [];
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: { message?: string }) => void) | null = null;
    terminated = false;
    constructor(public url: URL, public opts?: WorkerOptions) { FakeWorker.instances.push(this); }
    postMessage(_msg: unknown): void {}
    terminate(): void { this.terminated = true; }
  }

  beforeEach(() => {
    // Defensive: this test needs to mount starting on 'scatter' (the
    // default), not whatever vizId a stale location.hash from an earlier
    // test happens to encode.
    history.replaceState(null, '', location.pathname);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    history.replaceState(null, '', location.pathname);
    FakeWorker.instances = [];
  });

  it('retries on the next redraw instead of being wedged on the failed job forever', () => {
    vi.stubGlobal('Worker', FakeWorker);
    // jsdom has no real canvas 2D context in this project (no `canvas` npm
    // package installed - see the "Not implemented" warnings elsewhere in
    // this suite), so drawScene()'s `if (!ctx) return;` would otherwise skip
    // the ensemble-dispatch code entirely before this test ever reached it.
    // Patch getContext() to hand back fakeCtx's no-op-but-callable context
    // so the real ensemble branch actually runs.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => fakeCtx().ctx as unknown as RenderingContext,
    );
    const root = document.createElement('div');
    mountApp(root);
    // Default visualizer (scatter) has statistics(), so ensemble mode is
    // available without changing the picker.
    loadPastedSequence(root, '1,2,3,4,5,6,7,8');
    const modeSelect = root.querySelector<HTMLSelectElement>('.mode-select')!;
    modeSelect.value = 'ensemble';
    modeSelect.dispatchEvent(new Event('change')); // dispatches the first ensemble job

    expect(FakeWorker.instances.length).toBe(1);
    FakeWorker.instances[0]!.onerror!({ message: 'boom' }); // the job fails

    // Before the fix: ensembleKey stayed pointed at the failed job, so this
    // next redraw (same params - nothing the user did actually changed the
    // job) would take the "already dispatched" branch and just keep
    // re-painting "Computing…" forever, without ever trying again.
    modeSelect.dispatchEvent(new Event('change')); // a redraw, not a job change

    expect(FakeWorker.instances.length).toBe(2); // it retried
    expect(FakeWorker.instances[1]!.terminated).toBe(false);
  });
});

describe('accessibility of the app chrome', () => {
  it('the engine chrome carries exactly one h1', () => {
    // Scoped to the engine header: the landing overlay is a separate screen
    // with its own h1, and while it is up the engine behind it is inert.
    const root = document.createElement('div');
    mountApp(root);
    expect(root.querySelectorAll('.app-header h1')).toHaveLength(1);
  });

  it('marks the engine inert while the landing covers it', () => {
    const root = document.createElement('div');
    mountApp(root);
    // Bare hash -> landing is mounted, so the engine must be unreachable.
    expect(root.querySelector('.landing')).not.toBeNull();
    expect(root.querySelector('.layout')!.hasAttribute('inert')).toBe(true);

    root.querySelector<HTMLButtonElement>('.landing-open')!.click();
    expect(root.querySelector('.landing')).toBeNull();
    expect(root.querySelector('.layout')!.hasAttribute('inert')).toBe(false);
  });

  it('every comparison-bar control has an accessible name', () => {
    const root = document.createElement('div');
    mountApp(root);
    const controls = root.querySelectorAll<HTMLElement>('.comparison-bar select, .comparison-bar input');
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const labelled =
        control.getAttribute('aria-label') ||
        (control.id && root.querySelector(`label[for="${control.id}"]`)) ||
        control.closest('label');
      expect(labelled, `${control.className} has no accessible name`).toBeTruthy();
    }
  });

  it('the canvas is exposed as an image', () => {
    const root = document.createElement('div');
    mountApp(root);
    expect(root.querySelector('canvas')!.getAttribute('role')).toBe('img');
  });

  it('the visualizer picker has an accessible name', () => {
    const root = document.createElement('div');
    mountApp(root);
    expect(root.querySelector<HTMLSelectElement>('.viz-picker')!.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('the b-file term slider', () => {
  const mk = () => buildSequencePanel({ onSequence: () => {}, onError: () => {} });
  const oeis = { terms: [1n], aNumber: 'A000045', name: 'Fibonacci numbers', offset: 0, source: 'oeis' as const };
  const parts = (p: ReturnType<typeof mk>) => ({
    slider: p.el.querySelector<HTMLInputElement>('.bfile-slider')!,
    box: p.el.querySelector<HTMLInputElement>('.bfile-cap')!,
    pending: p.el.querySelector<HTMLElement>('.bfile-pending')!,
  });
  const drag = (slider: HTMLInputElement, v: number) => {
    slider.value = String(v);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('is disabled until an OEIS sequence is loaded, like the box it mirrors', () => {
    const p = mk();
    const { slider, box } = parts(p);
    expect(slider, 'no term slider').not.toBeNull();
    expect(slider.disabled).toBe(true);
    p.setInfo(oeis);
    expect(slider.disabled).toBe(false);
    expect(box.disabled).toBe(false);
  });

  it('is log-scaled, so the small counts that matter are not crushed', () => {
    // On a linear slider everything under 1000 would live in the first 1% of
    // travel, yet the difference between 200 and 2000 terms changes these
    // pictures far more than 90,000 versus 100,000 does.
    const p = mk(); p.setInfo(oeis);
    const { slider, box } = parts(p);
    drag(slider, 0);
    expect(Number(box.value)).toBe(50);
    drag(slider, 1000);
    expect(Number(box.value)).toBe(100000);
    drag(slider, 500);
    const mid = Number(box.value);
    expect(mid).toBeGreaterThan(1000);
    expect(mid, 'midpoint should be nowhere near the linear midpoint').toBeLessThan(10000);
  });

  it('rounds to figures a person would have typed', () => {
    const p = mk(); p.setInfo(oeis);
    const { slider, box } = parts(p);
    for (const v of [100, 300, 600, 900]) {
      drag(slider, v);
      const n = Number(box.value);
      const step = n < 1000 ? 10 : n < 10000 ? 100 : 1000;
      expect(n % step, `${n} is not a round figure`).toBe(0);
    }
  });

  it('tracks the box both ways', () => {
    const p = mk(); p.setInfo(oeis);
    const { slider, box } = parts(p);
    const before = slider.value;
    box.value = '2500';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(slider.value).not.toBe(before);
    // Typing must not have its own value rewritten underneath it.
    expect(box.value).toBe('2500');
  });

  it('asks for a Load only once something has actually been changed', () => {
    const p = mk(); p.setInfo(oeis);
    const { slider, pending } = parts(p);
    expect(pending.hidden, 'a message that is always on says nothing').toBe(true);
    expect(pending.getAttribute('role')).toBe('status');
    drag(slider, 700);
    expect(pending.hidden).toBe(false);
    expect(pending.textContent).toMatch(/Load all terms/i);
    expect(pending.textContent).toMatch(/\d/);
  });
});
