import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

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
    const cols = Number(params.columns);
    const rows = Math.ceil(seq.length / cols);
    const cell = Math.max(1, Math.floor(Math.min(size.width / cols, size.height / rows)));
    const ox = (size.width - cols * cell) / 2;
    const oy = (size.height - rows * cell) / 2;
    for (let i = 0; i < seq.length; i++) {
      const r = seq.mod(i, m);
      ctx.fillStyle = `hsl(${(r / m) * 360}, 65%, ${25 + (r / m) * 45}%)`;
      ctx.fillRect(ox + (i % cols) * cell, oy + Math.floor(i / cols) * cell, cell, cell);
    }
  },
};
