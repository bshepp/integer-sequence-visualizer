// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildParamControls } from '../../src/ui/paramControls';
import { buildSequencePanel } from '../../src/ui/sequencePanel';
import { mountApp } from '../../src/ui/app';
import { PRESETS } from '../../src/sequence/presets';
import { encodeState, decodeState, type UrlState } from '../../src/ui/urlState';
import type { ParamSpec } from '../../src/viz/types';

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

  it('setInfo shows name and b-file button for OEIS sequences', () => {
    const panel = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    panel.setInfo({ terms: [1n], aNumber: 'A000045', name: 'Fibonacci numbers', offset: 0, source: 'oeis' });
    expect(panel.el.textContent).toContain('Fibonacci');
    expect(panel.el.querySelector('.bfile-button')).not.toBeNull();
    panel.setInfo({ terms: [1n], name: 'n*n', offset: 0, source: 'formula' });
    expect(panel.el.querySelector('.bfile-button')).toBeNull();
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
    expect(labels).toEqual(['Load a sequence', 'Gallery', 'Loaded']);
    // Regression guard: section labels must not have displaced the elements
    // existing tests and app.ts rely on.
    expect(el.querySelectorAll('.tab-button').length).toBe(3);
    expect(el.querySelectorAll('.preset-button').length).toBe(PRESETS.length);
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
