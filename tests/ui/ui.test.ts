// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildParamControls } from '../../src/ui/paramControls';
import { buildSequencePanel } from '../../src/ui/sequencePanel';
import { mountApp } from '../../src/ui/app';
import { PRESETS } from '../../src/sequence/presets';
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
});
