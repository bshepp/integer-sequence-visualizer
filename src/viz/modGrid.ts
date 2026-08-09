import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokeColorAt, styleFromParams } from './style';
import { canvasTheme } from './theme';

/** The one layout render(), position() and locate() all agree on. */
function layout(n: number, params: Params, size: Size) {
  const cols = Number(params.columns);
  const rows = Math.ceil(n / cols);
  const cell = Math.max(1, Math.floor(Math.min(size.width / cols, size.height / rows)));
  return {
    cols, rows, cell,
    ox: (size.width - cols * cell) / 2,
    oy: (size.height - rows * cell) / 2,
  };
}

export const modGridViz: Visualizer = {
  id: 'modgrid',
  name: 'Mod-N grid',
  family: 'grid',
  minTerms: 4,
  explain: {
    short: 'Terms in reading order, coloured by their remainder mod N.',
    long: 'A simple row-major grid, each cell coloured by the term remainder modulo N. Vertical stripes appear when the sequence has period dividing the column count, diagonal stripes when the period and column count are close but unequal. Because the layout is index-driven, a permutation null occupies the same cells with different colours -- so any surviving stripe is a real periodicity, not a grid artifact.',
  },
  params: [
    { kind: 'number', id: 'modulus', label: 'Modulus', default: 10, min: 2, max: 64, step: 1 },
    { kind: 'number', id: 'columns', label: 'Columns', default: 20, min: 4, max: 100, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const m = Number(params.modulus);
    const style = styleFromParams(params);
    const L = layout(seq.length, params, size);
    for (let i = 0; i < seq.length; i++) {
      const r = seq.mod(i, m);
      ctx.fillStyle = style.colorMode === 'none'
        ? (r % 2 === 0 ? canvasTheme().grid : canvasTheme().muted)
        : strokeColorAt(style, r / m);
      ctx.fillRect(L.ox + (i % L.cols) * L.cell, L.oy + Math.floor(i / L.cols) * L.cell, L.cell, L.cell);
    }
  },
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const L = layout(seq.length, params, size);
    return {
      x: L.ox + (index % L.cols) * L.cell + L.cell / 2,
      y: L.oy + Math.floor(index / L.cols) * L.cell + L.cell / 2,
    };
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const L = layout(seq.length, params, size);
    const col = Math.floor((x - L.ox) / L.cell);
    const row = Math.floor((y - L.oy) / L.cell);
    if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) return null;
    const index = row * L.cols + col;
    return index < seq.length ? { kind: 'term' as const, index } : null;
  },
};
