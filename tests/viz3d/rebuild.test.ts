// tests/viz3d/rebuild.test.ts
import { describe, it, expect } from 'vitest';
import { registerAll } from '../../src/viz/all';
import { createRebuilder, type SequenceLoader } from '../../src/viz3d/dev/route';
import type { ControlState } from '../../src/viz3d/dev/controls';
import type { Sequence } from '../../src/sequence/sequence';
import type { Geometry3D } from '../../src/viz3d/types';

registerAll();

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function sequenceOf(n: number): Sequence {
  return { terms: Array.from({ length: n }, (_, i) => BigInt(i + 1)), name: 't', offset: 0, source: 'oeis' };
}

const baseState: ControlState = { vizId: 'turtle', aNumber: 'A_FIRST', terms: 3, step: 0 };

describe('createRebuilder', () => {
  it('keeps only the last-started request\'s geometry, even when an earlier request\'s fetch resolves after it', async () => {
    // Two requests: the first one is superseded by a second one (the current
    // control state) before its fetch resolves. Their fetches settle in
    // reverse of start order - the earlier request's fetch is the one that
    // resolves LAST - which is exactly the ordering that lets the stale
    // request win without the generation guard.
    const first = deferred<Sequence>();
    const second = deferred<Sequence>();
    const loader: SequenceLoader = (aNumber) => {
      if (aNumber === 'A_FIRST') return first.promise;
      if (aNumber === 'A_SECOND') return second.promise;
      throw new Error(`unexpected aNumber ${aNumber}`);
    };

    const calls: Geometry3D[] = [];
    const scene = { setGeometry: (g: Geometry3D) => { calls.push(g); } };
    const rebuild = createRebuilder(scene, loader);

    // Start the first request (3 terms), then - before it resolves - start
    // the second, superseding request (5 terms). This mirrors the reported
    // bug: type an A-number, then quickly change it again.
    const firstDone = rebuild(baseState);
    const secondState: ControlState = { ...baseState, aNumber: 'A_SECOND', terms: 5 };
    const secondDone = rebuild(secondState);

    // Resolve out of start order: the superseding (second) request's fetch
    // settles first, then the superseded (first) request's fetch settles
    // last - the ordering the bug report calls out.
    second.resolve(sequenceOf(10));
    await secondDone;
    first.resolve(sequenceOf(10));
    await firstDone;

    // Exactly one geometry may ever reach the scene: the second request's.
    // A turtle path has one vertex per term plus the origin, so 5 sliced
    // terms and 3 sliced terms are distinguishable by vertex count alone.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.positions).toHaveLength((5 + 1) * 3);
  });
});
