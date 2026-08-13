import { describe, it, expect, beforeAll } from 'vitest';
import { EXAMPLES, heroEntry, workedEntries, threadEntries } from '../../src/examples/entries';
import { encodeState, decodeState } from '../../src/ui/urlState';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, clearRegistry } from '../../src/viz/registry';

beforeAll(() => { clearRegistry(); registerAll(); });

describe('worked examples', () => {
  it('has a hero and at least five more', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(6);
    expect(heroEntry()).toBe(EXAMPLES[0]);
  });

  it('every id is unique', () => {
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
  });

  it('every state round-trips through encode/decode', () => {
    for (const e of EXAMPLES) {
      const back = decodeState('#' + encodeState(e.state));
      expect(back, e.id).not.toBeNull();
      expect(back!.vizId, e.id).toBe(e.state.vizId);
      expect(back!.params, e.id).toEqual(e.state.params);
    }
  });

  it('every vizId exists in the registry', () => {
    const ids = new Set(allVisualizers().map((v) => v.id));
    for (const e of EXAMPLES) expect(ids.has(e.state.vizId), `${e.id}: ${e.state.vizId}`).toBe(true);
  });

  it('the bundled sequence agrees with the state seqRef', () => {
    // A mismatch would render one sequence on the landing and open a
    // different one in the engine - quiet, plausible, and very confusing.
    for (const e of EXAMPLES) {
      if (e.state.seqRef?.kind === 'oeis') {
        expect(e.sequence.aNumber, e.id).toBe(e.state.seqRef.aNumber);
      }
    }
  });

  it('bundles enough terms for its visualizer minimum', () => {
    for (const e of EXAMPLES) {
      const viz = allVisualizers().find((v) => v.id === e.state.vizId)!;
      expect(e.sequence.terms.length, e.id).toBeGreaterThanOrEqual(viz.minTerms);
    }
  });

  it('every entry has a caption and a body', () => {
    for (const e of EXAMPLES) {
      expect(e.caption.trim().length, e.id).toBeGreaterThan(0);
      expect(e.body.length, e.id).toBeGreaterThan(60);
    }
  });

  it('every "real" or "split" verdict carries reproducible evidence', () => {
    for (const e of EXAMPLES) {
      if (e.verdict === 'real' || e.verdict === 'split') {
        expect(e.evidence, `${e.id} claims 'real' without evidence`).toBeDefined();
      }
    }
  });

  it('OEIS-sourced entries keep their A-number for attribution', () => {
    for (const e of EXAMPLES) {
      if (e.sequence.source === 'oeis') expect(e.sequence.aNumber, e.id).toMatch(/^A\d{6}$/);
    }
  });

  it('the Kolakoski generator really is its own run-length encoding', () => {
    const k = EXAMPLES.find((e) => e.id === 'kolakoski-spiral')!.sequence.terms.map(Number);
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

  it('the two shelves partition the examples, hero on the worked one', () => {
    expect(workedEntries().length + threadEntries().length).toBe(EXAMPLES.length);
    expect(workedEntries()[0]).toBe(heroEntry());
    expect(threadEntries().length).toBeGreaterThanOrEqual(5);
  });

  it('nothing from the thread shelf claims anything', () => {
    // The shelf is headed "named, drawn, and never tested". An entry there
    // with a verdict or a measurement would make that heading a lie, and it
    // is exactly the edit a later contributor would make in good faith after
    // measuring one of them - at which point it belongs on the other shelf.
    for (const e of threadEntries()) {
      expect(e.verdict, `${e.id} is on the untested shelf`).toBe('open');
      expect(e.evidence, `${e.id} carries evidence`).toBeUndefined();
    }
  });

  it('the thread shelf really is drawn by the rule the page says it is', () => {
    // The note under the heading tells the reader these use NCurve's own rule,
    // arc = (a(n) mod 360) - 180, which is the polyarc view at angle 1.
    for (const e of threadEntries()) {
      expect(e.state.vizId, e.id).toBe('polyarc');
      expect(e.state.params, e.id).toEqual({ angle: 1, modulus: 360, offset: -180 });
    }
  });

  it('every thread entry opens with the comparison already on', () => {
    // Also promised in the note: "each one opens with the comparison already
    // switched on, so you can be the first". An entry defaulting to mode 'off'
    // would land the reader on a single picture and no way to see the point.
    for (const e of threadEntries()) {
      expect(e.state.mode, e.id).not.toBe('off');
    }
  });

  it('only ever contains the values 1 and 2', () => {
    const k = EXAMPLES.find((e) => e.id === 'kolakoski-spiral')!.sequence.terms;
    expect(new Set(k.map(String))).toEqual(new Set(['1', '2']));
  });
});
