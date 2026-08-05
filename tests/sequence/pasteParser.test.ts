import { describe, it, expect } from 'vitest';
import { parsePasted, sequenceFromPaste } from '../../src/sequence/pasteParser';

describe('parsePasted', () => {
  it('parses comma-separated integers', () => {
    expect(parsePasted('0, 1, 1, 2, 3, 5')).toEqual([0n, 1n, 1n, 2n, 3n, 5n]);
  });

  it('parses whitespace/newline separated and bracketed input', () => {
    expect(parsePasted('[8\n 13  21]')).toEqual([8n, 13n, 21n]);
    expect(parsePasted('{1, 2, 3}')).toEqual([1n, 2n, 3n]);
  });

  it('handles negatives and huge values', () => {
    expect(parsePasted('-5, 1234567890123456789012345')).toEqual([
      -5n,
      1234567890123456789012345n,
    ]);
  });

  it('rejects non-integer tokens with a useful message', () => {
    expect(() => parsePasted('1, banana, 3')).toThrow(/banana/);
    expect(() => parsePasted('1.5, 2')).toThrow(/1\.5/);
  });

  it('rejects empty input', () => {
    expect(() => parsePasted('  ')).toThrow(/no numbers/i);
  });

  it('sequenceFromPaste wraps into a Sequence', () => {
    const s = sequenceFromPaste('4, 5');
    expect(s.terms).toEqual([4n, 5n]);
    expect(s.source).toBe('paste');
    expect(s.offset).toBe(0);
  });
});
