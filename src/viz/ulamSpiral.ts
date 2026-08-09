import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { spiralLayout } from './gridUtils';
import { strokeColorAt, styleFromParams, type RenderStyle } from './style';
import { canvasTheme } from './theme';

function cellColor(
  seq: SequenceView, i: number, colorBy: string, modulus: number, maxLog: number, style: RenderStyle,
): string {
  // 'none' removes colour as a variable entirely, so any structure still
  // visible cannot be an artifact of the palette - which is the whole reason
  // the mode exists. It overrides colorBy, since every colorBy is a palette.
  if (style.colorMode === 'none') {
    const shade = maxLog > 0 ? (seq.logMagnitude(i) / maxLog) * 45 + 25 : 45;
    return colorBy === 'magnitude' ? `rgb(${shade * 2.4}, ${shade * 2.4}, ${shade * 2.4})`
      : seq.mod(i, 2) === 0 ? canvasTheme().grid : canvasTheme().muted;
  }
  if (colorBy === 'parity') return seq.mod(i, 2) === 0 ? canvasTheme().panel : canvasTheme().accent;
  if (colorBy === 'magnitude') {
    const l = maxLog > 0 ? (seq.logMagnitude(i) / maxLog) * 60 + 15 : 40;
    return `hsl(220, 60%, ${l}%)`;
  }
  return strokeColorAt(style, seq.mod(i, modulus) / modulus);
}

export const ulamViz: Visualizer = {
  id: 'ulam',
  name: 'Ulam-style spiral',
  family: 'grid',
  minTerms: 4,
  explain: {
    short: 'Terms laid out along a square spiral, coloured by value.',
    long: 'Walks outward in a square spiral, one cell per term, colouring each cell from the term value. Ulam discovered that primes plotted this way fall on visible diagonals. Be careful here: the spiral path itself imposes strong geometry, so smooth or near-linear sequences produce beautiful rings and diagonals that say nothing about the sequence. Comparing against a permutation null is the check -- if the pattern survives shuffling, the layout drew it, not the numbers.',
  },
  params: [
    { kind: 'select', id: 'colorBy', label: 'Color by', default: 'mod', options: ['mod', 'parity', 'magnitude'] },
    { kind: 'number', id: 'modulus', label: 'Modulus', default: 6, min: 2, max: 32, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const n = seq.length;
    const style = styleFromParams(params);
    const L = spiralLayout(n, size);
    let maxLog = 0;
    for (let i = 0; i < n; i++) maxLog = Math.max(maxLog, seq.logMagnitude(i));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cellColor(seq, i, String(params.colorBy), Number(params.modulus), maxLog, style);
      const c = L.coords[i]!;
      // canvas y grows downward; flip so the spiral matches math orientation
      ctx.fillRect(L.ox + (c.x - L.minX) * L.cell, L.oy + (L.maxY - c.y) * L.cell, L.cell, L.cell);
    }
  },
  position(seq: SequenceView, _params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const L = spiralLayout(seq.length, size);
    const c = L.coords[index]!;
    // Centre of the cell, so locate() maps it back unambiguously.
    return {
      x: L.ox + (c.x - L.minX) * L.cell + L.cell / 2,
      y: L.oy + (L.maxY - c.y) * L.cell + L.cell / 2,
    };
  },
  locate(seq: SequenceView, _params: Params, size: Size, x: number, y: number) {
    const L = spiralLayout(seq.length, size);
    const col = Math.floor((x - L.ox) / L.cell);
    const row = Math.floor((y - L.oy) / L.cell);
    if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) return null;
    const cx = col + L.minX, cy = L.maxY - row;
    // Linear scan rather than a Map: building a Map costs O(n) allocations on
    // every pointer move, and n here is the term count (never the digit-walk
    // blow-up), so the scan allocates nothing and is cheaper in practice.
    for (let i = 0; i < L.coords.length; i++) {
      const c = L.coords[i]!;
      if (c.x === cx && c.y === cy) return { kind: 'term' as const, index: i };
    }
    return null;
  },
};
