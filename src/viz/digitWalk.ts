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
  explain: {
    short: 'A path stepping once per digit, in the direction that digit names.',
    long: 'Expands every term into its digits in the chosen base and steps one unit per digit, in the compass direction that digit indexes. Sequences with biased or structured digit distributions drift; uniform ones random-walk. Note this view has many more points than terms. Against a permutation null the digit multiset is unchanged but its arrangement is not, so persistent drift that survives shuffling comes from the digit distribution itself.',
  },
  params: [
    { kind: 'number', id: 'base', label: 'Base', default: 10, min: 2, max: 16, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    strokePath(digitWalkPath(seq, Number(params.base)), ctx, size);
  },
};
