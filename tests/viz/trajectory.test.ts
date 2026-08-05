import { describe, it, expect } from 'vitest';
import { turtlePath, turtleViz } from '../../src/viz/turtle';
import { digitWalkPath, digitWalkViz } from '../../src/viz/digitWalk';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('turtlePath', () => {
  it('zero turns walk straight along +x', () => {
    const path = turtlePath(mk([0n, 4n, 8n]), 90, 4); // all ≡ 0 mod 4
    expect(path.length).toBe(4);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[3]!.x).toBeCloseTo(3, 10);
    expect(path[3]!.y).toBeCloseTo(0, 10);
  });
  it('constant 90° turns trace a unit square', () => {
    const path = turtlePath(mk([1n, 1n, 1n, 1n]), 90, 4);
    expect(path[1]!.x).toBeCloseTo(0, 10); // first turn: heading +y
    expect(path[1]!.y).toBeCloseTo(1, 10);
    expect(path[4]!.x).toBeCloseTo(0, 10); // returns to origin
    expect(path[4]!.y).toBeCloseTo(0, 10);
  });
});

describe('digitWalkPath', () => {
  it('digit 0 steps +x, digit base/2 steps -x', () => {
    const path = digitWalkPath(mk([0n, 2n]), 4); // digits: [0], [2]
    expect(path.length).toBe(3);
    expect(path[1]!.x).toBeCloseTo(1, 10);
    expect(path[1]!.y).toBeCloseTo(0, 10);
    expect(path[2]!.x).toBeCloseTo(0, 10); // 2/4 → angle π → back to x=0
    expect(path[2]!.y).toBeCloseTo(0, 10);
  });
  it('pools multi-digit terms', () => {
    expect(digitWalkPath(mk([123n]), 10).length).toBe(4); // 3 digits + origin
  });
});

describe('trajectory render smoke tests', () => {
  const edgeSeqs = [
    mk([1n, 2n, 3n, 4n]),
    mk([-5n, 0n, 5n, -5n]),
    mk([10n ** 40n, 1n, 10n ** 40n, 2n]),
  ];
  for (const viz of [turtleViz, digitWalkViz]) {
    it(`${viz.id} renders edge cases without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, { width: 400, height: 400 })).not.toThrow();
      }
    });
  }
});
