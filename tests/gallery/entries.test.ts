import { describe, it, expect, beforeAll } from 'vitest';
import { GALLERY, heroEntry } from '../../src/gallery/entries';
import { encodeState, decodeState } from '../../src/ui/urlState';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, clearRegistry } from '../../src/viz/registry';

beforeAll(() => { clearRegistry(); registerAll(); });

describe('gallery entries', () => {
  it('has a hero and at least five more', () => {
    expect(GALLERY.length).toBeGreaterThanOrEqual(6);
    expect(heroEntry()).toBe(GALLERY[0]);
  });

  it('every id is unique', () => {
    expect(new Set(GALLERY.map((e) => e.id)).size).toBe(GALLERY.length);
  });

  it('every state round-trips through encode/decode', () => {
    for (const e of GALLERY) {
      const back = decodeState('#' + encodeState(e.state));
      expect(back, e.id).not.toBeNull();
      expect(back!.vizId, e.id).toBe(e.state.vizId);
      expect(back!.params, e.id).toEqual(e.state.params);
    }
  });

  it('every vizId exists in the registry', () => {
    const ids = new Set(allVisualizers().map((v) => v.id));
    for (const e of GALLERY) expect(ids.has(e.state.vizId), `${e.id}: ${e.state.vizId}`).toBe(true);
  });

  it('the bundled sequence agrees with the state seqRef', () => {
    // A mismatch would render one sequence on the landing and open a
    // different one in the engine — quiet, plausible, and very confusing.
    for (const e of GALLERY) {
      if (e.state.seqRef?.kind === 'oeis') {
        expect(e.sequence.aNumber, e.id).toBe(e.state.seqRef.aNumber);
      }
    }
  });

  it('bundles enough terms for its visualizer minimum', () => {
    for (const e of GALLERY) {
      const viz = allVisualizers().find((v) => v.id === e.state.vizId)!;
      expect(e.sequence.terms.length, e.id).toBeGreaterThanOrEqual(viz.minTerms);
    }
  });

  it('every entry has a caption and a body', () => {
    for (const e of GALLERY) {
      expect(e.caption.trim().length, e.id).toBeGreaterThan(0);
      expect(e.body.length, e.id).toBeGreaterThan(60);
    }
  });

  it('every "real" verdict carries reproducible evidence', () => {
    for (const e of GALLERY) {
      if (e.verdict === 'real') {
        expect(e.evidence, `${e.id} claims 'real' without evidence`).toBeDefined();
      }
    }
  });

  it('OEIS-sourced entries keep their A-number for attribution', () => {
    for (const e of GALLERY) {
      if (e.sequence.source === 'oeis') expect(e.sequence.aNumber, e.id).toMatch(/^A\d{6}$/);
    }
  });

  it('the Kolakoski generator really is its own run-length encoding', () => {
    const k = GALLERY.find((e) => e.id === 'kolakoski-spiral')!.sequence.terms.map(Number);
    // Run lengths of the sequence should reproduce the sequence itself.
    const runs: number[] = [];
    for (let i = 0; i < k.length;) {
      let j = i;
      while (j < k.length && k[j] === k[i]) j++;
      runs.push(j - i);
      i = j;
    }
    // Compare over the safely-generated prefix (the final run may be clipped).
    for (let i = 0; i < runs.length - 1; i++) expect(runs[i]).toBe(k[i]);
  });

  it('only ever contains the values 1 and 2', () => {
    const k = GALLERY.find((e) => e.id === 'kolakoski-spiral')!.sequence.terms;
    expect(new Set(k.map(String))).toEqual(new Set(['1', '2']));
  });
});
