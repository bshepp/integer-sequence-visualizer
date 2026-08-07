import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokePath } from './turtle';

export function polyarcPath(
  seq: SequenceView,
  opts: { angle: number; modulus: number; centered: boolean; segments?: number },
): Array<{ x: number; y: number }> {
  const segments = opts.segments ?? 8;
  const pts = [{ x: 0, y: 0 }];
  let heading = 0;
  let x = 0, y = 0;
  for (let i = 0; i < seq.length; i++) {
    const residue = seq.mod(i, opts.modulus);
    const signed = opts.centered ? residue - (opts.modulus - 1) / 2 : residue;
    const deltaRad = (opts.angle * signed * Math.PI) / 180;
    for (let s = 0; s < segments; s++) {
      heading += deltaRad / segments;
      x += Math.cos(heading) / segments;
      y += Math.sin(heading) / segments;
      pts.push({ x, y });
    }
  }
  return pts;
}

export const polyarcViz: Visualizer = {
  id: 'polyarc',
  name: 'Polyarc curve',
  family: 'trajectory',
  minTerms: 4,
  explain: {
    short: 'An NCurve-style smooth curve, bending by each term mod N.',
    long: 'The technique from the SeqFan thread that prompted this project: each term bends the path by an angle set by its residue mod N, drawn as a smooth arc rather than a hard corner, optionally centring residues so they bend both ways. It produces strikingly organic shapes. Whether those shapes mean anything is exactly the open question here -- compare against a null and see which features survive.',
  },
  params: [
    { kind: 'number', id: 'angle', label: 'Angle °', default: 30, min: 1, max: 120, step: 1 },
    { kind: 'number', id: 'modulus', label: 'Modulus', default: 7, min: 2, max: 32, step: 1 },
    { kind: 'boolean', id: 'centered', label: 'Center residues', default: true },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    strokePath(
      polyarcPath(seq, {
        angle: Number(params.angle),
        modulus: Number(params.modulus),
        centered: Boolean(params.centered),
      }),
      ctx,
      size,
    );
  },
};
