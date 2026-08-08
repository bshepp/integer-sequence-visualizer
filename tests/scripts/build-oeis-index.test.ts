import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { readLinesFromStream, countReplacementChars, countNonAsciiLines } from '../../scripts/build-oeis-index.mjs';

// Readable.from(arrayOfBuffers) is used (not a PassThrough fed via write())
// because Node's internal stream buffering can silently coalesce
// back-to-back synchronous writes() into a single delivered chunk, which
// would reassemble a deliberately split multi-byte character before it
// ever reaches the consumer and mask exactly the bug under test.
// Readable.from guarantees each array element surfaces as its own distinct
// chunk, giving a fully deterministic chunk boundary to test against.
function streamOf(chunks: Buffer[]): Readable {
  return Readable.from(chunks);
}

describe('readLinesFromStream', () => {
  it('decodes a multi-byte UTF-8 character split exactly across a chunk boundary', async () => {
    // "é" is 0xC3 0xA9 in UTF-8. A naive per-chunk Buffer#toString('utf8')
    // decode (each chunk decoded in isolation) turns each half into a lone
    // U+FFFD replacement character instead of one "é" - this constructs
    // that split deterministically rather than hoping a real gzip stream
    // happens to break there.
    const eAcute = Buffer.from('é', 'utf8');
    expect(eAcute.length).toBe(2);

    const stream = streamOf([
      Buffer.concat([Buffer.from('A027941 M', 'utf8'), eAcute.subarray(0, 1)]),
      Buffer.concat([eAcute.subarray(1, 2), Buffer.from('nage numbers\n', 'utf8')]),
    ]);

    const lines: string[] = [];
    await readLinesFromStream(stream, (l) => lines.push(l));

    expect(lines).toEqual(['A027941 Ménage numbers']);
    expect(lines[0]).not.toContain('�');
  });

  it('splits on newlines correctly under byte-by-byte chunking, with no dropped/duplicated characters', async () => {
    const text = 'A000001 Number of groups of order n.\nA000002 Kolakoski sequence.\n';
    const bytes = Buffer.from(text, 'utf8');
    const chunks: Buffer[] = [];
    for (let i = 0; i < bytes.length; i += 3) chunks.push(bytes.subarray(i, i + 3));
    const stream = streamOf(chunks);

    const lines: string[] = [];
    await readLinesFromStream(stream, (l) => lines.push(l));

    expect(lines).toEqual(['A000001 Number of groups of order n.', 'A000002 Kolakoski sequence.']);
  });
});

describe('countReplacementChars', () => {
  it('is zero for clean UTF-8 text', () => {
    expect(countReplacementChars('A000045\tMénage numbers\nA000032\tLucas numbers\n')).toBe(0);
  });
  it('counts U+FFFD occurrences', () => {
    expect(countReplacementChars('A000045\tRecama�n numbers\n')).toBe(1);
    expect(countReplacementChars('��')).toBe(2);
  });
});

describe('countNonAsciiLines', () => {
  it('counts lines containing at least one non-ASCII character', () => {
    const text = 'A000045\tFibonacci numbers\nA027941\tMénage numbers\nA000032\tLucas numbers\n';
    expect(countNonAsciiLines(text)).toBe(1);
  });
});
