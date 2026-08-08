import { describe, it, expect } from 'vitest';
import { pathTransform, toScreen, nearestIndex } from '../../src/viz/pathTransform';
import { spiralCoord, spiralCoords } from '../../src/viz/gridUtils';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { ulamViz } from '../../src/viz/ulamSpiral';
import { modGridViz } from '../../src/viz/modGrid';
import { scatterViz } from '../../src/viz/scatter';
import { differencesViz } from '../../src/viz/differences';
import { turtleViz } from '../../src/viz/turtle';
import { polyarcViz } from '../../src/viz/polyarc';
import { digitWalkViz } from '../../src/viz/digitWalk';
import { histogramViz } from '../../src/viz/histogram';
import { autocorrViz } from '../../src/viz/autocorrelation';
import { kolakoski } from '../../src/gallery/sequences';
import type { Params, Visualizer } from '../../src/viz/types';

const SIZE = { width: 400, height: 300 };

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('pathTransform', () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

  it('maps every point inside the canvas', () => {
    const t = pathTransform(pts, SIZE);
    for (const p of pts) {
      const s = toScreen(t, p);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(SIZE.width);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(SIZE.height);
    }
  });

  it('round-trips: the nearest point to a projected point is that point', () => {
    const t = pathTransform(pts, SIZE);
    pts.forEach((p, i) => {
      const s = toScreen(t, p);
      expect(nearestIndex(pts, t, s.x, s.y)).toBe(i);
    });
  });

  it('returns null when the cursor is far from every point', () => {
    const t = pathTransform(pts, SIZE);
    expect(nearestIndex(pts, t, -500, -500, 10)).toBeNull();
  });

  it('survives a degenerate single-point path without dividing by zero', () => {
    const t = pathTransform([{ x: 5, y: 5 }], SIZE);
    const s = toScreen(t, { x: 5, y: 5 });
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Number.isFinite(s.y)).toBe(true);
  });
});

describe('spiralCoords', () => {
  it('matches spiralCoord element for element', () => {
    const all = spiralCoords(50);
    for (let i = 0; i < 50; i++) expect(all[i]).toEqual(spiralCoord(i));
  });
});

describe('grid family locate/position round-trip', () => {
  // 300 terms, not a toy length: the transform depends on the bounding box,
  // which only becomes interesting once the spiral has wound several times.
  const seq = mk(Array.from({ length: 300 }, (_, i) => BigInt(i)));

  for (const viz of [ulamViz, modGridViz]) {
    it(`${viz.id}: locate(position(i)) === i`, () => {
      const params = defaultParams(viz.params);
      for (const i of [0, 1, 7, 42, 150, 299]) {
        const p = viz.position!(seq, params, SIZE, i);
        expect(p, `position(${i}) returned null`).not.toBeNull();
        expect(viz.locate!(seq, params, SIZE, p!.x, p!.y)).toEqual({ kind: 'term', index: i });
      }
    });

    it(`${viz.id}: returns null outside the drawn area`, () => {
      const params = defaultParams(viz.params);
      expect(viz.locate!(seq, params, SIZE, -50, -50)).toBeNull();
      expect(viz.locate!(seq, params, SIZE, 10_000, 10_000)).toBeNull();
    });

    it(`${viz.id}: position is null for an out-of-range index`, () => {
      expect(viz.position!(seq, defaultParams(viz.params), SIZE, 5000)).toBeNull();
    });
  }
});

describe('basic family locate/position round-trip', () => {
  const seq = mk(Array.from({ length: 300 }, (_, i) => BigInt(i * i)));

  for (const viz of [scatterViz, differencesViz]) {
    it(`${viz.id}: locate(position(i)) === i`, () => {
      const params = defaultParams(viz.params);
      for (const i of [0, 5, 120, 250]) {
        const p = viz.position!(seq, params, SIZE, i);
        expect(p).not.toBeNull();
        expect(viz.locate!(seq, params, SIZE, p!.x, p!.y)).toEqual({ kind: 'term', index: i });
      }
    });

    it(`${viz.id}: returns null left of the plot margin`, () => {
      expect(viz.locate!(seq, defaultParams(viz.params), SIZE, 0, 150)).toBeNull();
    });
  }

  it('differences reports the earlier index of the pair it plots', () => {
    // differences plots n-1 points for n terms: point i is a(i+1) - a(i).
    const params = defaultParams(differencesViz.params);
    const last = differencesViz.locate!(seq, params, SIZE, SIZE.width - 28, 150);
    expect(last?.kind).toBe('term');
    expect((last as { index: number }).index).toBeLessThan(seq.length - 1);
  });
});

describe('trajectory family locate/position round-trip', () => {
  // A fixture whose walk does not retrace itself. The previous one
  // (i*7+3 at the default angle and mod) collapsed 201 path points onto just
  // 5 distinct screen positions -- the walk goes round the same square fifty
  // times -- so locate(position(i)) is ambiguous there by construction, and
  // an identity assertion passes or fails on tie-breaking order rather than
  // on correctness. Kolakoski at 73 degrees mod 7 visits 201 distinct points.
  const seq = mk(kolakoski(200));
  const CASES: Array<[Visualizer, Params]> = [
    [turtleViz, { angle: 73, k: 7 }],
    [polyarcViz, { angle: 37, modulus: 7, centered: true }],
  ];

  for (const [viz, params] of CASES) {
    it(`${viz.id}: locate(position(i)) === i`, () => {
      for (const i of [0, 10, 99, 199]) {
        const p = viz.position!(seq, params, SIZE, i);
        expect(p, `position(${i}) null`).not.toBeNull();
        expect(viz.locate!(seq, params, SIZE, p!.x, p!.y)).toEqual({ kind: 'term', index: i });
      }
    });
  }

  it('on a self-retracing path, reports a term that really is at that point', () => {
    // Where the walk revisits a position, several terms legitimately share a
    // pixel. The honest contract is that locate names one of them, not that
    // it names the one you happened to ask for.
    const looping = mk(Array.from({ length: 200 }, (_, i) => BigInt(i * 7 + 3)));
    const params = defaultParams(turtleViz.params);
    const target = turtleViz.position!(looping, params, SIZE, 10)!;
    const hit = turtleViz.locate!(looping, params, SIZE, target.x, target.y);
    expect(hit?.kind).toBe('term');
    const found = turtleViz.position!(looping, params, SIZE, (hit as { index: number }).index)!;
    expect(Math.hypot(found.x - target.x, found.y - target.y)).toBeLessThan(0.5);
  });

  it('digitwalk reports the term and the digit position', () => {
    const params = defaultParams(digitWalkViz.params);
    const p = digitWalkViz.position!(seq, params, SIZE, 50);
    expect(p).not.toBeNull();
    const hit = digitWalkViz.locate!(seq, params, SIZE, p!.x, p!.y);
    expect(hit?.kind).toBe('digit');
    expect((hit as { digitPos: number }).digitPos).toBeGreaterThanOrEqual(0);
  });
});

describe('stats family reports non-term hits', () => {
  const seq = mk(Array.from({ length: 200 }, (_, i) => BigInt(i % 17)));

  it('histogram reports a bin with its range and count', () => {
    const params = defaultParams(histogramViz.params);
    const hit = histogramViz.locate!(seq, params, SIZE, SIZE.width / 2, SIZE.height / 2);
    expect(hit?.kind).toBe('bin');
    const bin = hit as { binIndex: number; lo: number; hi: number; count: number };
    expect(bin.hi).toBeGreaterThan(bin.lo);
    expect(bin.count).toBeGreaterThanOrEqual(0);
  });

  it('autocorrelation reports a lag, never a term', () => {
    const params = defaultParams(autocorrViz.params);
    const hit = autocorrViz.locate!(seq, params, SIZE, SIZE.width / 2, SIZE.height / 2);
    expect(hit?.kind).toBe('lag');
  });

  it('neither stats view offers position()', () => {
    // There is no single screen point meaning "term i" in either view, so
    // offering one would force a false answer.
    expect(histogramViz.position).toBeUndefined();
    expect(autocorrViz.position).toBeUndefined();
  });
});

describe('hit-testing follows the line, not its corners', () => {
  const SIZE2 = { width: 400, height: 300 };

  it('hits the middle of a long segment, not just its endpoints', () => {
    // A two-point path scaled across the canvas puts its midpoint far from
    // either vertex. Measuring to vertices would miss it entirely.
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const t = pathTransform(pts, SIZE2);
    const a = toScreen(t, pts[0]!), b = toScreen(t, pts[1]!);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    expect(Math.hypot(mid.x - a.x, mid.y - a.y)).toBeGreaterThan(100); // genuinely far
    expect(nearestIndex(pts, t, mid.x, mid.y)).not.toBeNull();
  });

  it('still rejects a cursor well off the line', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const t = pathTransform(pts, SIZE2);
    const a = toScreen(t, pts[0]!);
    expect(nearestIndex(pts, t, a.x, a.y + 90)).toBeNull();
  });

  it('does not depend on how compact the sequence is', () => {
    // The defect: a compact path is scaled up, spreading its vertices past
    // the hit radius, so it responded less often than a sprawling one.
    const compact = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const sprawling = [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }, { x: 0, y: 9 }];
    for (const pts of [compact, sprawling]) {
      const t = pathTransform(pts, SIZE2);
      const a = toScreen(t, pts[0]!), b = toScreen(t, pts[1]!);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      expect(nearestIndex(pts, t, mid.x, mid.y), 'midpoint of a segment must hit at any scale').not.toBeNull();
    }
  });

  it('reports the nearer endpoint of the segment it hit', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const t = pathTransform(pts, SIZE2);
    const a = toScreen(t, pts[0]!), b = toScreen(t, pts[1]!);
    const nearA = { x: a.x + (b.x - a.x) * 0.1, y: a.y };
    const nearB = { x: a.x + (b.x - a.x) * 0.9, y: a.y };
    expect(nearestIndex(pts, t, nearA.x, nearA.y)).toBe(0);
    expect(nearestIndex(pts, t, nearB.x, nearB.y)).toBe(1);
  });
});
