import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { spiralCoord } from './gridUtils';

function cellColor(seq: SequenceView, i: number, colorBy: string, modulus: number, maxLog: number): string {
  if (colorBy === 'parity') return seq.mod(i, 2) === 0 ? '#1d2026' : '#7aa2f7';
  if (colorBy === 'magnitude') {
    const l = maxLog > 0 ? (seq.logMagnitude(i) / maxLog) * 60 + 15 : 40;
    return `hsl(220, 60%, ${l}%)`;
  }
  return `hsl(${(seq.mod(i, modulus) / modulus) * 360}, 65%, 60%)`;
}

export const ulamViz: Visualizer = {
  id: 'ulam',
  name: 'Ulam-style spiral',
  family: 'grid',
  minTerms: 4,
  params: [
    { kind: 'select', id: 'colorBy', label: 'Color by', default: 'mod', options: ['mod', 'parity', 'magnitude'] },
    { kind: 'number', id: 'modulus', label: 'Modulus', default: 6, min: 2, max: 32, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const n = seq.length;
    const coords = Array.from({ length: n }, (_, i) => spiralCoord(i));
    const xs = coords.map((c) => c.x), ys = coords.map((c) => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const cols = maxX - minX + 1, rows = maxY - minY + 1;
    const cell = Math.max(1, Math.floor(Math.min(size.width / cols, size.height / rows)));
    const ox = (size.width - cols * cell) / 2;
    const oy = (size.height - rows * cell) / 2;
    let maxLog = 0;
    for (let i = 0; i < n; i++) maxLog = Math.max(maxLog, seq.logMagnitude(i));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cellColor(seq, i, String(params.colorBy), Number(params.modulus), maxLog);
      const c = coords[i]!;
      // canvas y grows downward; flip so the spiral matches math orientation
      ctx.fillRect(ox + (c.x - minX) * cell, oy + (maxY - c.y) * cell, cell, cell);
    }
  },
};
