import type { Sequence } from '../sequence/sequence';
import { sequenceRows } from './exportData';

const MAX_ROWS = 500;

/**
 * The textual equivalent of the canvas.
 *
 * A rendering conveys its information visually, and the cursor readout only
 * describes one point at a time, so without this there is no way to read the
 * actual numbers behind a picture - the accessibility gap recorded at the end
 * of round 2. Shares sequenceRows with the CSV/JSON export: a table and a
 * download are the same data in different shapes.
 */
export function buildDataTable(): {
  el: HTMLElement; setSequence(seq: Sequence | null): void; toggle(): void; isOpen(): boolean;
} {
  const el = document.createElement('div');
  el.className = 'data-table';
  el.hidden = true;

  const table = document.createElement('table');
  const caption = document.createElement('caption');
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
  table.append(caption, thead, tbody);
  el.appendChild(table);

  caption.textContent = 'No sequence loaded.';

  return {
    el,
    setSequence(seq) {
      tbody.replaceChildren();
      if (!seq) { caption.textContent = 'No sequence loaded.'; return; }
      const total = seq.terms.length;
      const rows = sequenceRows(seq, MAX_ROWS);
      caption.textContent = total > MAX_ROWS
        ? `${seq.name} - first ${MAX_ROWS} of ${total} terms`
        : `${seq.name} - ${total} terms`;
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
    },
    toggle() { el.hidden = !el.hidden; },
    isOpen: () => !el.hidden,
  };
}
