import { describe, it, expect } from 'vitest';
import { PRESETS } from '../../src/sequence/presets';

/**
 * The settings and term counts NCurve printed on Bill McEachen's own images,
 * read off the attachments to his SeqFan messages of 3 August 2026 (A019488)
 * and 4 August 2026 (the other ten). Pinned here as a table, separately from
 * presets.ts, so that an edit there cannot drift from the record without a
 * test saying so.
 *
 * Every one is NCurve's rule at angle 1. All but A019488 are at its defaults,
 * which is what Bill meant by "I iterated no parameters"; A019488 he took from
 * a drawing Neil Sloane had added.
 */
const BILLS_IMAGES: ReadonlyArray<readonly [aNumber: string, modulus: number, offset: number, terms: number]> = [
  ['A000376', 360, -180, 20],
  ['A000464', 360, -180, 216],
  ['A000828', 360, -180, 201],
  ['A001051', 360, -180, 1000],
  ['A001553', 360, -180, 201],
  ['A001571', 360, -180, 201],
  ['A001603', 360, -180, 1188],
  ['A019488', 220, 320, 201],
  ['A039188', 360, -180, 70],
  ['A039685', 360, -180, 1000],
  ['A039970', 360, -180, 1000],
];

describe("Bill McEachen's presets", () => {
  it('open at the settings printed on his images, drawn the way NCurve drew them', () => {
    for (const [a, modulus, offset, terms] of BILLS_IMAGES) {
      const view = PRESETS.find((p) => p.aNumber === a)?.view;
      expect(view, `${a} has no view`).toBeDefined();
      expect(view!.vizId, a).toBe('polyarc');
      expect(view!.params, a).toEqual({ angle: 1, modulus, offset, turn: 'ncurve' });
      expect(view!.terms, a).toBe(terms);
    }
  });

  it('are the only presets that bring a view with them', () => {
    // The classics are sequences, not pictures: they load into whatever view
    // is open, which is the point of having them.
    const withView = PRESETS.filter((p) => p.view).map((p) => p.aNumber).sort();
    expect(withView).toEqual(BILLS_IMAGES.map(([a]) => a).sort());
  });
});
