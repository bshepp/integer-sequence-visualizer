import type { Params } from '../viz/types';

/**
 * The view a preset opens in, for presets that are pictures rather than
 * sequences. Bill McEachen named his eleven for what they looked like in
 * NCurve, and a name like "Zipper" only describes the sequence under that
 * drawing: loaded into a scatter plot, or into the curve view at any other
 * settings, it is just a list of numbers with a misleading label.
 */
export interface PresetView {
  vizId: string;
  params: Params;
  /** How many b-file terms the picture was drawn from. */
  terms: number;
}

export interface Preset { aNumber: string; label: string; view?: PresetView; }

/** NCurve at its own settings: arc = a(n) mod 360 - 180, drawn NCurve's way round. */
const ncurve = (terms: number): PresetView => ({
  vizId: 'polyarc', params: { angle: 1, modulus: 360, offset: -180, turn: 'ncurve' }, terms,
});

export const PRESETS: Preset[] = [
  // SeqFan thread finds (Bill McEachen's names). The settings and term counts
  // are the ones NCurve printed on Bill's own images: his message of 4 August
  // 2026 for ten of them, and of 3 August for A019488, which he took from a
  // drawing Neil Sloane had added and which is the one not at NCurve's
  // defaults. "Iterated no parameters" held for the rest - every one is
  // mod 360 - 180, each at or near the length of its b-file.
  { aNumber: 'A000376', label: 'French curve', view: ncurve(20) },
  { aNumber: 'A000464', label: 'Pie crust', view: ncurve(216) },
  { aNumber: 'A000828', label: 'Propeller', view: ncurve(201) },
  { aNumber: 'A001051', label: 'Tire', view: ncurve(1000) },
  { aNumber: 'A001553', label: 'Saw blade', view: ncurve(201) },
  { aNumber: 'A001571', label: 'A001571', view: ncurve(201) },
  { aNumber: 'A001603', label: 'A001603', view: ncurve(1188) },
  {
    aNumber: 'A019488', label: "Sloane's find",
    view: { vizId: 'polyarc', params: { angle: 1, modulus: 220, offset: 320, turn: 'ncurve' }, terms: 201 },
  },
  { aNumber: 'A039188', label: 'Record disc', view: ncurve(70) },
  { aNumber: 'A039685', label: 'Zipper', view: ncurve(1000) },
  { aNumber: 'A039970', label: 'Slinky', view: ncurve(1000) },
  // Classics
  { aNumber: 'A000045', label: 'Fibonacci' },
  { aNumber: 'A000040', label: 'Primes' },
  { aNumber: 'A005132', label: 'Recamán' },
  // Self-referential and combinatorial sequences that render well: each has
  // strong internal ordering structure, which is what the null model can
  // actually see. Chosen over fast-growing sequences, whose pictures are
  // dominated by their growth rate rather than their arrangement.
  { aNumber: 'A000002', label: 'Kolakoski' },
  { aNumber: 'A001511', label: 'Ruler' },
  { aNumber: 'A005811', label: 'Binary runs' },
  { aNumber: 'A000120', label: 'Binary weight' },
  { aNumber: 'A010060', label: 'Thue–Morse' },
  { aNumber: 'A003849', label: 'Fibonacci word' },
  { aNumber: 'A006337', label: 'Beatty/√2' },
  { aNumber: 'A004718', label: "Per Nørgård's" },
  { aNumber: 'A002487', label: 'Stern' },
  { aNumber: 'A000041', label: 'Partitions' },
  { aNumber: 'A000108', label: 'Catalan' },
  { aNumber: 'A007318', label: "Pascal's" },
];
