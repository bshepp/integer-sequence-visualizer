import type { Sequence } from './sequence';

export function parsePasted(text: string): bigint[] {
  const cleaned = text.replace(/[\[\]{}()]/g, ' ');
  const tokens = cleaned.split(/[\s,;]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) throw new Error('No numbers found in input.');
  return tokens.map((tok) => {
    if (!/^[+-]?\d+$/.test(tok)) {
      throw new Error(`"${tok}" is not an integer.`);
    }
    return BigInt(tok);
  });
}

export function sequenceFromPaste(text: string): Sequence {
  return {
    terms: parsePasted(text),
    name: 'Pasted sequence',
    offset: 0,
    source: 'paste',
  };
}
