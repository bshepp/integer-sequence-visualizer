export interface Preset { aNumber: string; label: string; }

export const PRESETS: Preset[] = [
  // SeqFan thread finds (Bill McEachen's names)
  { aNumber: 'A000376', label: 'French curve' },
  { aNumber: 'A000464', label: 'Pie crust' },
  { aNumber: 'A000828', label: 'Propeller' },
  { aNumber: 'A001051', label: 'Tire' },
  { aNumber: 'A001553', label: 'Saw blade' },
  { aNumber: 'A001571', label: 'A001571' },
  { aNumber: 'A001603', label: 'A001603' },
  { aNumber: 'A019488', label: "Sloane's find" },
  { aNumber: 'A039188', label: 'Record disc' },
  { aNumber: 'A039685', label: 'Zipper' },
  { aNumber: 'A039970', label: 'Slinky' },
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
