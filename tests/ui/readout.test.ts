// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { describeHit, correspondingIndex, buildReadout } from '../../src/ui/readout';
import { permutationWithMap } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const seq = new SequenceView({
  terms: [0n, 1n, 1n, 2n, 3n, 5n, 8n], name: 'Fibonacci', offset: 0, source: 'oeis', aNumber: 'A000045',
} as Sequence);

describe('describeHit', () => {
  it('names the index and the exact term for a term hit', () => {
    const text = describeHit({ kind: 'term', index: 5 }, seq);
    expect(text).toContain('n = 5');
    expect(text).toContain('a(n) = 5');
  });

  it('reports full BigInt precision, never a clamped float', () => {
    const big = new SequenceView({
      terms: [10n ** 40n], name: 'big', offset: 0, source: 'paste',
    } as Sequence);
    expect(describeHit({ kind: 'term', index: 0 }, big)).toContain('1'.padEnd(41, '0'));
  });

  it('names the digit position for a digit hit', () => {
    expect(describeHit({ kind: 'digit', index: 6, digitPos: 0 }, seq)).toMatch(/digit/i);
  });

  it('describes a bin as a range and a count', () => {
    const text = describeHit({ kind: 'bin', binIndex: 2, lo: 12, hi: 18, count: 47 }, seq);
    expect(text).toContain('47');
    expect(text).toContain('12');
    expect(text).toContain('18');
  });

  it('describes a lag', () => {
    expect(describeHit({ kind: 'lag', lag: 7 }, seq)).toMatch(/lag 7/i);
  });
});

const terms = Array.from({ length: 200 }, (_, i) => BigInt(i));

describe('correspondingIndex', () => {
  it('traces a term by value through a permutation', () => {
    const r = correspondingIndex(42, 'permutation', terms, 5);
    expect(r.traced).toBe(true);
    // The traced slot really does hold the same value in the surrogate.
    const { terms: shuffled } = permutationWithMap(terms, 5);
    expect(shuffled[r.index]).toBe(terms[42]);
  });

  it('falls back to index-for-index on difference surrogates', () => {
    expect(correspondingIndex(42, 'difference', terms, 5)).toEqual({ index: 42, traced: false });
  });

  it('falls back to index-for-index on matched surrogates', () => {
    expect(correspondingIndex(42, 'matched', terms, 5)).toEqual({ index: 42, traced: false });
  });

  it('is stable under the same seed', () => {
    expect(correspondingIndex(42, 'permutation', terms, 5))
      .toEqual(correspondingIndex(42, 'permutation', terms, 5));
  });

  it('does not claim a trace for an out-of-range index', () => {
    expect(correspondingIndex(9999, 'permutation', terms, 5).traced).toBe(false);
  });
});

describe('buildReadout', () => {
  it('is a polite live region and hides itself when empty', () => {
    const r = buildReadout();
    expect(r.el.getAttribute('aria-live')).toBe('polite');
    expect(r.el.classList.contains('readout--empty')).toBe(true);
    r.set('n = 1');
    expect(r.el.classList.contains('readout--empty')).toBe(false);
    r.set(null);
    expect(r.el.textContent).toBe('');
    expect(r.el.classList.contains('readout--empty')).toBe(true);
  });
});

import { drawCanvasLabel } from '../../src/ui/readout';
import { fakeCtx } from '../helpers/fakeCtx';

describe('drawCanvasLabel', () => {
  it('paints a backing before the text, so the drawing underneath cannot swallow it', () => {
    const { ctx, callLog } = fakeCtx();
    drawCanvasLabel(ctx, 'real - A000002 - 600 terms', 10, 16);
    const names = callLog.map((c) => c.name);
    const rectAt = names.indexOf('fillRect');
    const textAt = names.indexOf('fillText');
    expect(rectAt, 'no backing drawn').toBeGreaterThanOrEqual(0);
    expect(textAt, 'no text drawn').toBeGreaterThanOrEqual(0);
    expect(rectAt).toBeLessThan(textAt);
  });

  it('sizes the backing from the measured text rather than a guess', () => {
    const { ctx, callLog } = fakeCtx();
    drawCanvasLabel(ctx, 'anything', 10, 16);
    expect(callLog.some((c) => c.name === 'measureText')).toBe(true);
  });

  it('draws nothing at all for an empty label', () => {
    const { ctx, callLog } = fakeCtx();
    drawCanvasLabel(ctx, '', 10, 16);
    expect(callLog.filter((c) => c.name === 'fillRect' || c.name === 'fillText')).toHaveLength(0);
  });

  it('restores the context so the backing alpha does not leak into the next draw', () => {
    const { ctx, callLog } = fakeCtx();
    drawCanvasLabel(ctx, 'x', 10, 16);
    const names = callLog.map((c) => c.name);
    expect(names[0]).toBe('save');
    expect(names[names.length - 1]).toBe('restore');
  });
});
