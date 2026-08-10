import type { Sequence } from '../sequence/sequence';
import { sequenceRows } from './exportData';

const MAX_ROWS = 500;

/**
 * The textual equivalent of the canvas.
 *
 * A rendering conveys its information visually, and the cursor readout only
 * describes one point at a time, so without this there is no way to read the
 * actual numbers behind a picture - the accessibility gap recorded at the end
 * of round 2. Shares sequenceRows with the CSV/JSON export: this and a
 * download are the same data in different shapes.
 *
 * Shows a comma-separated run by default rather than an n / a(n) table. The
 * table gave every term its own row, so five hundred terms became five hundred
 * rows scrolling off the screen, and what you actually want from "show me the
 * numbers" is to read the sequence - which is how a sequence is written
 * everywhere else, the OEIS included. The table is still one click away,
 * because index-to-term is a real question and a run of commas answers it
 * badly.
 */
export function buildDataTable(): {
  el: HTMLElement; setSequence(seq: Sequence | null): void; toggle(): void; isOpen(): boolean;
} {
  const el = document.createElement('div');
  el.className = 'data-table';
  el.hidden = true;

  let view: 'list' | 'table' = 'list';
  let current: Sequence | null = null;

  const head = document.createElement('div');
  head.className = 'data-head';
  const caption = document.createElement('span');
  caption.className = 'data-caption';
  caption.textContent = 'No sequence loaded.';
  const viewToggle = document.createElement('button');
  viewToggle.className = 'data-view-toggle';
  viewToggle.type = 'button';
  head.append(caption, viewToggle);

  const body = document.createElement('div');
  body.className = 'data-body';
  el.append(head, body);

  viewToggle.addEventListener('click', () => {
    view = view === 'list' ? 'table' : 'list';
    render();
  });

  function render(): void {
    viewToggle.textContent = view === 'list' ? 'Show as a table' : 'Show as a list';
    body.replaceChildren();
    if (!current) {
      caption.textContent = 'No sequence loaded.';
      return;
    }
    const total = current.terms.length;
    const rows = sequenceRows(current, MAX_ROWS);
    const offset = current.offset ?? 0;
    caption.textContent = total > MAX_ROWS
      ? `${current.name} - first ${MAX_ROWS} of ${total} terms`
      : `${current.name} - ${total} terms`;

    if (view === 'list') {
      const p = document.createElement('p');
      p.className = 'data-list';
      // Plain selectable text, so it can be copied straight into a comment or
      // a search box. The index of the first term is stated rather than
      // implied: a list of values alone loses the offset, and not every OEIS
      // sequence starts at n = 0.
      p.textContent = rows.map((r) => r.term).join(', ');
      const note = document.createElement('p');
      note.className = 'data-list-note';
      note.textContent = `Starting at n = ${offset}.`;
      body.append(p, note);
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headRow = document.createElement('tr');
    for (const label of ['n', 'a(n)']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    for (const r of rows) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = String(r.n);
      const td = document.createElement('td');
      td.textContent = r.term;
      tr.append(th, td);
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    body.appendChild(table);
  }

  render();

  return {
    el,
    setSequence(seq) { current = seq; render(); },
    toggle() { el.hidden = !el.hidden; },
    isOpen: () => !el.hidden,
  };
}
