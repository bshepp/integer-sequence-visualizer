// tests/viz3d/panels.test.ts
import { describe, it, expect } from 'vitest';
import { surrogateView } from '../../src/viz3d/dev/panels';
import { geometryFor } from '../../src/viz3d/geometry';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const seq = new SequenceView({
  terms: [3n, 17n, 250n, 91n, 7n, 12n, 44n, 5n, 9n, 31n],
  name: 't', offset: 0, source: 'paste',
} as Sequence);

describe('surrogateView', () => {
  it('keeps the multiset of terms and the length', () => {
    const s = surrogateView(seq, 'permutation', 1);
    expect(s.length).toBe(seq.length);
    const sorted = (v: SequenceView) =>
      Array.from({ length: v.length }, (_, i) => v.term(i)).sort((a, b) => Number(a - b));
    expect(sorted(s)).toEqual(sorted(seq));
  });

  it('is deterministic in the seed', () => {
    const a = surrogateView(seq, 'permutation', 7);
    const b = surrogateView(seq, 'permutation', 7);
    expect(Array.from({ length: a.length }, (_, i) => a.term(i)))
      .toEqual(Array.from({ length: b.length }, (_, i) => b.term(i)));
  });

  it('gives a geometry of the same size but a different shape', () => {
    const lift = { step: 1 };
    const real = geometryFor('turtle', seq, { angle: 90, k: 4 }, lift)!;
    const null3d = geometryFor('turtle', surrogateView(seq, 'permutation', 3), { angle: 90, k: 4 }, lift)!;
    expect(null3d.positions).toHaveLength(real.positions.length);
    expect(Array.from(null3d.positions)).not.toEqual(Array.from(real.positions));
  });
});
