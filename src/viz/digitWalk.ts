import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokePath } from './turtle';
import { styleFromParams } from './style';
import { pathTransform, toScreen, nearestIndex } from './pathTransform';

/**
 * For each path point after the origin, which term and which digit made it.
 * digitWalkPath pushes exactly one point per digit, so this is its index map.
 */
export function digitWalkOwners(seq: SequenceView, base: number): Array<{ index: number; digitPos: number }> {
  const owners: Array<{ index: number; digitPos: number }> = [];
  for (let i = 0; i < seq.length; i++) {
    const ds = seq.digits(i, base);
    for (let d = 0; d < ds.length; d++) owners.push({ index: i, digitPos: d });
  }
  return owners;
}

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
    strokePath(digitWalkPath(seq, Number(params.base)), ctx, size, styleFromParams(params));
  },
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const base = Number(params.base);
    const owners = digitWalkOwners(seq, base);
    const at = owners.findIndex((o) => o.index === index);
    if (at === -1) return null;
    const pts = digitWalkPath(seq, base);
    return toScreen(pathTransform(pts, size), pts[at + 1]!);
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const base = Number(params.base);
    const pts = digitWalkPath(seq, base);
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null || p === 0) return null;
    const owner = digitWalkOwners(seq, base)[p - 1];
    return owner ? { kind: 'digit' as const, index: owner.index, digitPos: owner.digitPos } : null;
  },
};
