import type { Sequence } from '../sequence/sequence';

export interface DataRow { n: number; term: string; [key: string]: string | number; }

/** Terms as exact decimal strings — never toNumber, which clamps past 2^53. */
export function sequenceRows(seq: Sequence, limit?: number): DataRow[] {
  const n = limit === undefined ? seq.terms.length : Math.min(limit, seq.terms.length);
  const rows: DataRow[] = [];
  for (let i = 0; i < n; i++) rows.push({ n: i + seq.offset, term: seq.terms[i]!.toString() });
  return rows;
}

/**
 * Exports leave the site, so they carry the OEIS credit with them rather than
 * relying on a page footer the user is no longer looking at.
 */
export function attributionLine(seq: Sequence): string {
  const base = 'Sequence data from The On-Line Encyclopedia of Integer Sequences (OEIS), '
    + '(c) OEIS Foundation Inc., CC BY-SA 4.0';
  return seq.aNumber ? `${base} - https://oeis.org/${seq.aNumber}` : `${base} - https://oeis.org/`;
}

const csvField = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(seq: Sequence, rows: DataRow[]): string {
  const keys = Object.keys(rows[0] ?? { n: 0, term: '' });
  const head = `# ${attributionLine(seq)}`.replace(/\n/g, ' ');
  return [
    head,
    keys.join(','),
    ...rows.map((r) => keys.map((k) => csvField(r[k]!)).join(',')),
  ].join('\n') + '\n';
}

export function toJSON(seq: Sequence, rows: DataRow[]): string {
  return JSON.stringify({
    attribution: attributionLine(seq),
    aNumber: seq.aNumber ?? null,
    name: seq.name,
    offset: seq.offset,
    source: seq.source,
    count: rows.length,
    rows,
  }, null, 2);
}

export function downloadBlob(name: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
