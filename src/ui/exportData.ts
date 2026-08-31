import type { Sequence } from '../sequence/sequence';
// Type-only, so this adds no runtime edge from the export layer to the
// visualizers - the same arrangement surrogates.ts uses for Explain.
import type { Params } from '../viz/types';

/**
 * The view a data export was taken from.
 *
 * The terms do not depend on the visualizer, so it is fair to ask why they
 * travel together. Because the README calls these files "the numbers behind the
 * picture", and a file that does not say which picture is a weaker artifact
 * than it claims to be: someone holding the CSV and wanting the figure back has
 * no way to get there. The URL carries style and zoom too, so the fields spelled
 * out here are the ones worth reading without decoding a hash.
 *
 * The surrogate and seed matter more than they look. Only the real sequence is
 * ever exported, never the null - but the null is a deterministic function of
 * those two plus the terms, so recording them is what makes the other half of a
 * comparison reconstructible rather than lost.
 */
export interface ViewMeta {
  vizId: string;
  vizName: string;
  params: Params;
  /** Comparison mode: 'off', 'side', 'over', 'flip', 'ensemble'. */
  mode: string;
  surrogate: string;
  seed: number;
  /** Reproduces the exact view, style and zoom included. */
  url: string;
}

/** Style keys ride in `params` at render time; they are noise in a data file. */
const paramText = (params: Params): string =>
  Object.entries(params)
    .filter(([k]) => !k.startsWith('style'))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ') || 'none';

/** Human-readable lines describing a view, shared by both export formats. */
export function viewLines(view: ViewMeta): string[] {
  return [
    `View: ${view.vizName} (${view.vizId})`,
    `Parameters: ${paramText(view.params)}`,
    view.mode === 'off'
      ? 'Null model: off'
      : `Null model: ${view.surrogate} surrogate, seed ${view.seed}, shown ${view.mode}`,
    `Reproduce this view: ${view.url}`,
  ];
}

export interface DataRow { n: number; term: string; [key: string]: string | number; }

/** Terms as exact decimal strings - never toNumber, which clamps past 2^53. */
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

export function toCSV(seq: Sequence, rows: DataRow[], view?: ViewMeta): string {
  const keys = Object.keys(rows[0] ?? { n: 0, term: '' });
  // Comment lines are not part of the CSV standard, but this file already
  // carried one for the attribution, and anything that tolerated that tolerates
  // these. They lead rather than trail so provenance is read first, and every
  // newline is flattened so a stray one cannot end a comment early and turn
  // prose into a data row.
  const comments = [...(view ? viewLines(view) : []), attributionLine(seq)]
    .map((line) => `# ${line}`.replace(/[\r\n]+/g, ' '));
  return [
    ...comments,
    keys.join(','),
    ...rows.map((r) => keys.map((k) => csvField(r[k]!)).join(',')),
  ].join('\n') + '\n';
}

export function toJSON(seq: Sequence, rows: DataRow[], view?: ViewMeta): string {
  return JSON.stringify({
    attribution: attributionLine(seq),
    aNumber: seq.aNumber ?? null,
    name: seq.name,
    offset: seq.offset,
    source: seq.source,
    count: rows.length,
    // Structured rather than the CSV's prose, since a JSON consumer can act on
    // it. Omitted entirely when unknown rather than written as nulls, so its
    // absence means "not recorded" and not "recorded as nothing".
    ...(view ? {
      view: {
        visualizer: view.vizId,
        visualizerName: view.vizName,
        params: view.params,
        comparison: view.mode === 'off'
          ? { mode: 'off' }
          : { mode: view.mode, surrogate: view.surrogate, seed: view.seed },
        url: view.url,
      },
    } : {}),
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
