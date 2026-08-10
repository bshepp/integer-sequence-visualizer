import { describe, it, expect } from 'vitest';
import { edgeUses, edgeReuse } from '../../src/viz/overlap';
import { turtlePath } from '../../src/viz/turtle';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { kolakoski } from '../../src/gallery/sequences';
import { permutationSurrogate } from '../../src/nullmodel/surrogates';

const asSeq = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 's', offset: 0, source: 'paste' } as Sequence);

describe('edgeUses', () => {
  it('reports every edge once for a path that never doubles back', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    expect(edgeUses(pts).map((u) => u.total)).toEqual([1, 1, 1]);
    expect(edgeUses(pts).map((u) => u.rank)).toEqual([1, 1, 1]);
  });

  it('counts an edge walked back along as the same ink', () => {
    // Out and back: one edge, twice. Direction must not make it two edges -
    // the two strokes land on exactly the same pixels either way.
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
    expect(edgeUses(pts)).toEqual([{ total: 2, rank: 1 }, { total: 2, rank: 2 }]);
  });

  it('ranks repeat traversals in path order', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }];
    expect(edgeUses(pts).map((u) => u.rank)).toEqual([1, 2, 3]);
    expect(edgeUses(pts).every((u) => u.total === 3)).toBe(true);
  });

  it('survives the floating-point drift a real walk accumulates', () => {
    // The reason this needs quantising at all: a turtle at 90 degrees returns
    // to the origin arithmetically, but cos/sin of multiples of pi/2 leave a
    // residue of ~1e-16 per step. Exact comparison finds no repeats.
    const pts = turtlePath(asSeq([1n, 1n, 1n, 1n]), 90, 4);
    const closed = Math.hypot(pts[4]!.x - pts[0]!.x, pts[4]!.y - pts[0]!.y);
    expect(closed, 'fixture should close on itself').toBeLessThan(1e-9);
    expect(closed, 'and not do so exactly, or this test proves nothing')
      .toBeGreaterThan(0);
    // Walking the same square twice: every edge used exactly twice.
    const twice = turtlePath(asSeq([1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n]), 90, 4);
    expect(edgeUses(twice).every((u) => u.total === 2)).toBe(true);
  });

  it('finds nothing to report on a path that cannot retrace', () => {
    // 73 degrees never revisits an edge, so the feature stays silent rather
    // than inventing bands.
    const pts = turtlePath(asSeq(Array.from({ length: 200 }, (_, i) => BigInt(i))), 73, 4);
    expect(edgeUses(pts).every((u) => u.total === 1)).toBe(true);
    expect(edgeReuse(pts)).toBe(0);
  });

  it('handles degenerate paths without throwing', () => {
    expect(edgeUses([])).toEqual([]);
    expect(edgeUses([{ x: 0, y: 0 }])).toEqual([]);
    expect(edgeReuse([])).toBe(0);
  });
});

describe('edgeReuse as a measurement', () => {
  const terms = kolakoski(600);
  const reuseAt = (angle: number, t = terms) => edgeReuse(turtlePath(asSeq(t), angle, 4));
  const nullsAt = (angle: number) => Array.from({ length: 20 }, (_, i) =>
    reuseAt(angle, permutationSurrogate(terms, i + 1)));

  it('does NOT separate at 90 degrees, because most of the retreading is forced', () => {
    // Recorded as a negative because it is the obvious angle to try. Kolakoski
    // is 1s and 2s, so mod 4 at 90 degrees the turns are a quarter and a half
    // turn - and a half turn re-walks the edge just walked. There are 301 twos
    // in 600 terms, and a permutation preserves that count exactly, so about
    // half the reuse is identical in every surrogate by construction. Measured
    // 0.822 for the real walk against surrogates reaching 0.830: inside the
    // null, and mostly measuring the multiset rather than the arrangement.
    const real = reuseAt(90);
    const nulls = nullsAt(90);
    expect(real).toBeLessThan(Math.max(...nulls));
    expect(real).toBeGreaterThan(Math.min(...nulls));
  });

  it('separates sharply at 120 degrees, opposite to the intuition', () => {
    // At 120 degrees there is no half turn, so nothing is forced, and the
    // statistic measures arrangement alone. The result inverts the guess that
    // a compact walk must re-tread more: the real sequence re-treads 6% of its
    // edges while every shuffle re-treads at least 40%. Kolakoski's regular
    // alternation keeps the walk moving into fresh ground; a shuffle collides
    // with itself constantly. Compactness and self-avoidance are not the same
    // property, and this view measures the second one.
    const real = reuseAt(120);
    const nulls = nullsAt(120);
    expect(real).toBeLessThan(0.2);
    expect(Math.min(...nulls)).toBeGreaterThan(0.35);
    expect(real).toBeLessThan(Math.min(...nulls));
  });

  it('is bounded and deterministic', () => {
    const r = reuseAt(120);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(r).toBe(reuseAt(120));
  });
});
