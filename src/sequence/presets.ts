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
];
