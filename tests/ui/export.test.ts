// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildStyleControls } from '../../src/ui/styleControls';
import { DEFAULT_STYLE, type RenderStyle } from '../../src/viz/style';

describe('style controls', () => {
  it('exposes a labelled control for every style property', () => {
    const { el } = buildStyleControls({ ...DEFAULT_STYLE }, () => {});
    document.body.appendChild(el);
    const controls = el.querySelectorAll<HTMLElement>('input, select');
    expect(controls.length).toBeGreaterThanOrEqual(6);
    for (const c of controls) {
      const labelled = c.getAttribute('aria-label')
        || (c.id && el.querySelector(`label[for="${c.id}"]`))
        || c.closest('label');
      expect(labelled, `${c.className} unlabelled`).toBeTruthy();
    }
  });

  it('mutates the style object and notifies on change', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const onChange = vi.fn();
    const { el } = buildStyleControls(style, onChange);
    const join = el.querySelector<HTMLSelectElement>('.style-join')!;
    join.value = 'round';
    join.dispatchEvent(new Event('change'));
    expect(style.lineJoin).toBe('round');
    expect(onChange).toHaveBeenCalled();
  });

  it('offers "none" as a colour mode', () => {
    const { el } = buildStyleControls({ ...DEFAULT_STYLE }, () => {});
    const mode = el.querySelector<HTMLSelectElement>('.style-colormode')!;
    expect([...mode.options].map((o) => o.value)).toContain('none');
  });

  it('disables the hue sliders where they cannot affect anything', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const { el } = buildStyleControls(style, () => {});
    const mode = el.querySelector<HTMLSelectElement>('.style-colormode')!;
    const start = el.querySelector<HTMLInputElement>('.style-hue-start')!;
    const end = el.querySelector<HTMLInputElement>('.style-hue-end')!;

    expect(start.disabled).toBe(false);
    expect(end.disabled).toBe(false);

    mode.value = 'flat';
    mode.dispatchEvent(new Event('change'));
    expect(start.disabled).toBe(false); // flat still uses hueStart
    expect(end.disabled).toBe(true);

    mode.value = 'none';
    mode.dispatchEvent(new Event('change'));
    expect(start.disabled).toBe(true);
    expect(end.disabled).toBe(true);
  });

  it('refresh() pushes external mutations back onto the controls', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const { el, refresh } = buildStyleControls(style, () => {});
    style.lineWidth = 7;
    refresh();
    expect(el.querySelector<HTMLInputElement>('.style-width')!.value).toBe('7');
  });
});

import { sequenceRows, toCSV, toJSON, attributionLine } from '../../src/ui/exportData';
import { buildDataTable } from '../../src/ui/dataTable';
import { drawAttribution } from '../../src/ui/exportImage';
import { fakeCtx } from '../helpers/fakeCtx';
import type { Sequence } from '../../src/sequence/sequence';

const fib: Sequence = {
  terms: [0n, 1n, 1n, 2n, 3n, 5n, 8n], aNumber: 'A000045',
  name: 'Fibonacci numbers', offset: 0, source: 'oeis',
};
const huge: Sequence = { terms: [10n ** 40n], name: 'big', offset: 0, source: 'paste' };

describe('sequenceRows', () => {
  it('emits one row per term with the index and exact value', () => {
    const rows = sequenceRows(fib);
    expect(rows).toHaveLength(7);
    expect(rows[5]).toMatchObject({ n: 5, term: '5' });
  });

  it('keeps full BigInt precision', () => {
    expect(sequenceRows(huge)[0]!.term).toBe('1'.padEnd(41, '0'));
  });

  it('honours a row limit', () => {
    expect(sequenceRows(fib, 3)).toHaveLength(3);
  });

  it('offsets the index by the sequence offset', () => {
    expect(sequenceRows({ ...fib, offset: 1 })[0]!.n).toBe(1);
  });
});

describe('export formats carry attribution', () => {
  it('CSV leads with a commented attribution line naming the A-number', () => {
    const csv = toCSV(fib, sequenceRows(fib));
    expect(csv.split('\n')[0]).toMatch(/^#/);
    expect(csv).toContain('A000045');
    expect(csv).toContain('CC BY-SA 4.0');
    expect(csv).toContain('oeis.org');
  });

  it('CSV has a header row and one line per term', () => {
    const lines = toCSV(fib, sequenceRows(fib)).trim().split('\n');
    expect(lines[1]).toBe('n,term');
    expect(lines).toHaveLength(2 + 7);
  });

  it('JSON carries attribution as a field, not a comment', () => {
    const parsed = JSON.parse(toJSON(fib, sequenceRows(fib)));
    expect(parsed.attribution).toContain('CC BY-SA 4.0');
    expect(parsed.aNumber).toBe('A000045');
    expect(parsed.rows).toHaveLength(7);
    expect(parsed.rows[6].term).toBe('8');
  });

  it('a non-OEIS sequence gets attribution without a bogus A-number link', () => {
    expect(attributionLine(huge)).not.toContain('oeis.org/undefined');
    expect(attributionLine(huge)).toContain('oeis.org');
  });

  it('quotes fields containing a comma so the CSV stays parseable', () => {
    const commas: Sequence = { ...fib, terms: [1n], name: 'x' };
    const rows = sequenceRows(commas).map((r) => ({ ...r, note: 'a,b' }));
    const line = toCSV(commas, rows).trim().split('\n')[2]!;
    expect(line).toContain('"a,b"');
  });
});

describe('data table', () => {
  it('renders a real table with a caption and header cells', () => {
    const t = buildDataTable();
    t.setSequence(fib);
    document.body.appendChild(t.el);
    expect(t.el.querySelector('table')).not.toBeNull();
    expect(t.el.querySelector('caption')).not.toBeNull();
    expect(t.el.querySelectorAll('th').length).toBeGreaterThanOrEqual(2);
    expect(t.el.querySelectorAll('tbody tr')).toHaveLength(7);
  });

  it('scopes its header cells so a screen reader can associate them', () => {
    const t = buildDataTable();
    t.setSequence(fib);
    expect(t.el.querySelector('thead th')!.getAttribute('scope')).toBe('col');
    expect(t.el.querySelector('tbody th')!.getAttribute('scope')).toBe('row');
  });

  it('starts closed and toggles', () => {
    const t = buildDataTable();
    expect(t.isOpen()).toBe(false);
    t.toggle();
    expect(t.isOpen()).toBe(true);
  });

  it('caps the rows it renders and says so', () => {
    const long: Sequence = {
      terms: Array.from({ length: 5000 }, (_, i) => BigInt(i)),
      name: 'long', offset: 0, source: 'paste',
    };
    const t = buildDataTable();
    t.setSequence(long);
    expect(t.el.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(500);
    expect(t.el.querySelector('caption')!.textContent).toMatch(/first 500 of 5000/);
  });
});

describe('PNG attribution', () => {
  it('draws the credit into the image itself', () => {
    const { ctx, callLog } = fakeCtx();
    drawAttribution(ctx, 'Sequence data from OEIS, CC BY-SA 4.0', 800, 600);
    const texts = callLog.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
    expect(texts.join(' ')).toContain('CC BY-SA 4.0');
  });

  it('paints a backing band so the text stays legible over any render', () => {
    const { ctx, callLog } = fakeCtx();
    drawAttribution(ctx, 'credit', 800, 600);
    expect(callLog.some((c) => c.name === 'fillRect')).toBe(true);
  });
});
