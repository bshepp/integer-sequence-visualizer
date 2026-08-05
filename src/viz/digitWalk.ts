import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokePath } from './turtle';

export function digitWalkPath(seq: SequenceView, base: number): Array<{ x: number; y: number }> {
  const pts = [{ x: 0, y: 0 }];
  let x = 0, y = 0;
  for (let i = 0; i < seq.length; i++) {
    for (const d of seq.digits(i, base)) {
      const a = (2 * Math.PI * d) / base;
      x += Math.cos(a);
      y += Math.sin(a);
      pts.push({ x, y });
    }
  }
  return pts;
}

export const digitWalkViz: Visualizer = {
  id: 'digitwalk',
  name: '2D digit walk',
  family: 'trajectory',
  minTerms: 2,
  params: [
    { kind: 'number', id: 'base', label: 'Base', default: 10, min: 2, max: 16, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    strokePath(digitWalkPath(seq, Number(params.base)), ctx, size);
  },
};
