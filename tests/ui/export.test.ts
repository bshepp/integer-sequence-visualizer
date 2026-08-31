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

import { sequenceRows, toCSV, toJSON, attributionLine, type ViewMeta } from '../../src/ui/exportData';
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
    // Found rather than indexed: the header is comment lines plus a column row,
    // and that count changes whenever the export learns to record something new.
    const line = toCSV(commas, rows).trim().split('\n')
      .find((l) => !l.startsWith('#') && !l.startsWith('n,'))!;
    expect(line).toContain('"a,b"');
  });
});

describe('data exports record the view they came from', () => {
  // The terms do not depend on the visualizer, so these files could reasonably
  // omit it - except that the README calls them "the numbers behind the
  // picture", and a file that cannot say which picture does not live up to
  // that. Someone holding the CSV should be able to get the figure back.
  const view: ViewMeta = {
    vizId: 'polyarc',
    vizName: 'Polyarc curve',
    params: { angle: 64, modulus: 187, offset: -90, styleLineWidth: 2 },
    mode: 'side',
    surrogate: 'permutation',
    seed: 7,
    url: 'https://ulam.briansheppard.com/#seq=A000040&viz=polyarc',
  };

  it('puts the view in the CSV header, above the data', () => {
    const lines = toCSV(fib, sequenceRows(fib), view).split('\n');
    const comments = lines.filter((l) => l.startsWith('#')).join(' ');
    expect(comments).toContain('Polyarc curve (polyarc)');
    expect(comments).toContain('angle=64');
    expect(comments).toContain('permutation surrogate, seed 7');
    expect(comments).toContain('https://ulam.briansheppard.com/');
    // Attribution survives alongside it rather than being displaced by it.
    expect(comments).toContain('OEIS Foundation');
    // Provenance leads, and the column row still directly precedes the data.
    expect(lines.indexOf('n,term')).toBe(lines.filter((l) => l.startsWith('#')).length);
  });

  it('leaves style keys out, since they are not data', () => {
    expect(toCSV(fib, sequenceRows(fib), view)).not.toContain('styleLineWidth');
  });

  it('records the view as structure in JSON, and the seed with it', () => {
    const parsed = JSON.parse(toJSON(fib, sequenceRows(fib), view));
    expect(parsed.view.visualizer).toBe('polyarc');
    expect(parsed.view.params.modulus).toBe(187);
    // Only the real sequence is ever exported, so the surrogate and the seed
    // are what make the other half of a comparison reconstructible.
    expect(parsed.view.comparison).toEqual({ mode: 'side', surrogate: 'permutation', seed: 7 });
    expect(parsed.rows).toHaveLength(7);
  });

  it('says the null is off rather than naming a surrogate that was not used', () => {
    const off = { ...view, mode: 'off' };
    expect(JSON.parse(toJSON(fib, sequenceRows(fib), off)).view.comparison).toEqual({ mode: 'off' });
    expect(toCSV(fib, sequenceRows(fib), off)).toContain('Null model: off');
  });

  it('omits the view entirely when there is none, rather than writing nulls', () => {
    // Absence should mean "not recorded", never "recorded as nothing".
    expect('view' in JSON.parse(toJSON(fib, sequenceRows(fib)))).toBe(false);
    expect(toCSV(fib, sequenceRows(fib)).split('\n').filter((l) => l.startsWith('#')))
      .toHaveLength(1);
  });
});

describe('the numbers panel', () => {
  const asTable = (t: ReturnType<typeof buildDataTable>) =>
    t.el.querySelector<HTMLButtonElement>('.data-view-toggle')!.click();

  it('shows the sequence as a comma-separated run by default', () => {
    // "Show me the numbers" wants the sequence read the way a sequence is
    // written everywhere else, the OEIS included. A row per term turned 500
    // terms into 500 rows scrolling off the screen.
    const t = buildDataTable();
    t.setSequence(fib);
    expect(t.el.querySelector('table'), 'should not start as a table').toBeNull();
    const list = t.el.querySelector('.data-list')!;
    expect(list.textContent).toBe('0, 1, 1, 2, 3, 5, 8');
  });

  it('states the starting index, which a bare list of values loses', () => {
    const t = buildDataTable();
    t.setSequence({ ...fib, offset: 1 });
    expect(t.el.querySelector('.data-list-note')!.textContent).toMatch(/n = 1/);
  });

  it('still offers the table, with its header cells scoped', () => {
    // Index-to-term is a real question that a run of commas answers badly, so
    // the table stays one click away rather than being removed.
    const t = buildDataTable();
    t.setSequence(fib);
    asTable(t);
    expect(t.el.querySelector('table')).not.toBeNull();
    expect(t.el.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(t.el.querySelector('thead th')!.getAttribute('scope')).toBe('col');
    expect(t.el.querySelector('tbody th')!.getAttribute('scope')).toBe('row');
  });

  it('keeps the chosen view when the sequence changes', () => {
    const t = buildDataTable();
    t.setSequence(fib);
    asTable(t);
    t.setSequence({ ...fib, name: 'another' });
    expect(t.el.querySelector('table'), 'switching sequence reset the view').not.toBeNull();
  });

  it('starts closed and toggles', () => {
    const t = buildDataTable();
    expect(t.isOpen()).toBe(false);
    t.toggle();
    expect(t.isOpen()).toBe(true);
  });

  it('caps what it renders and says so, in either view', () => {
    const long: Sequence = {
      terms: Array.from({ length: 5000 }, (_, i) => BigInt(i)),
      name: 'long', offset: 0, source: 'paste',
    };
    const t = buildDataTable();
    t.setSequence(long);
    expect(t.el.querySelector('.data-caption')!.textContent).toMatch(/first 500 of 5000/);
    expect(t.el.querySelector('.data-list')!.textContent!.split(',')).toHaveLength(500);
    asTable(t);
    expect(t.el.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(500);
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


describe('panel identity line', () => {
  it('reads "<who> · <count> terms", with the count grouped for legibility', () => {
    // Reproduces the exact composition app.ts uses, so the format is pinned
    // even though the real one is drawn to a canvas jsdom cannot render.
    const label = (seq: Sequence) =>
      `${seq.aNumber ?? seq.name} · ${seq.terms.length.toLocaleString()} terms`;

    expect(label(fib)).toBe('A000045 · 7 terms');
    expect(label({ ...fib, aNumber: undefined, name: 'Pasted sequence' }))
      .toBe('Pasted sequence · 7 terms');

    const long: Sequence = { terms: Array.from({ length: 2001 }, () => 1n), name: 'x', offset: 0, source: 'paste' };
    expect(label(long)).toMatch(/2[,.\s]?001 terms/);
  });
});
