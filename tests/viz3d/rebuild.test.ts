// tests/viz3d/rebuild.test.ts
import { describe, it, expect } from 'vitest';
import { registerAll } from '../../src/viz/all';
import { createRebuilder, type SequenceLoader, type BFileLoader, type LoadReport } from '../../src/viz3d/dev/route';
import type { ControlState } from '../../src/viz3d/dev/controls';
import type { Sequence } from '../../src/sequence/sequence';
import type { Geometry3D } from '../../src/viz3d/types';
import type { BFileResult } from '../../src/sequence/oeisClient';

registerAll();

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function sequenceOf(n: number): Sequence {
  return { terms: Array.from({ length: n }, (_, i) => BigInt(i + 1)), name: 't', offset: 0, source: 'oeis' };
}

function bfileTermsOf(n: number): bigint[] {
  return Array.from({ length: n }, (_, i) => BigInt(i + 1));
}

/** Polls a predicate on the microtask queue rather than counting `await`
 *  ticks, which is an implementation detail of how the engine schedules
 *  promise continuations - not something a test should have to guess. */
async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 1000 && !predicate(); i++) await Promise.resolve();
  if (!predicate()) throw new Error('condition never became true');
}

const baseState: ControlState = { vizId: 'turtle', aNumber: 'A_FIRST', terms: 3, step: 0, nullOn: true };

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
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
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

  it('fetches the b-file when the requested term count exceeds the inline data, and draws the larger count', async () => {
    // The inline (lookupById) data stands in for the site's 80-term-capped
    // shard entry: far fewer terms than requested.
    const loader: SequenceLoader = () => Promise.resolve(sequenceOf(3));
    const bfileCalls: Array<{ aNumber: string; cap: number }> = [];
    const bfileLoader: BFileLoader = (aNumber, cap) => {
      bfileCalls.push({ aNumber, cap });
      return Promise.resolve<BFileResult>({ terms: bfileTermsOf(cap), truncated: false });
    };

    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    const reports: LoadReport[] = [];
    const rebuild = createRebuilder(scene, loader, undefined, undefined, (r) => reports.push(r), bfileLoader);

    const state: ControlState = { ...baseState, terms: 50 };
    await rebuild(state);

    expect(bfileCalls).toEqual([{ aNumber: 'A_FIRST', cap: 50 }]);
    expect(calls).toHaveLength(1);
    // One vertex per term plus the origin - 50 b-file terms, not the 3 the
    // inline data offered.
    expect(calls[0]!.positions).toHaveLength((50 + 1) * 3);
    expect(reports).toEqual([{ requested: 50, loaded: 50, source: 'bfile', truncated: false }]);
  });

  it('falls back to the inline terms and reports it when the b-file fetch rejects, without failing the draw', async () => {
    const loader: SequenceLoader = () => Promise.resolve(sequenceOf(3));
    const bfileLoader: BFileLoader = () => Promise.reject(new Error('B-file request failed (HTTP 500).'));

    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    const reports: LoadReport[] = [];
    const rebuild = createRebuilder(scene, loader, undefined, undefined, (r) => reports.push(r), bfileLoader);

    const state: ControlState = { ...baseState, terms: 50 };
    await rebuild(state);

    // The drawing still happens - degraded, not dead - from the 3 inline terms.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.positions).toHaveLength((3 + 1) * 3);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      requested: 50,
      loaded: 3,
      source: 'inline',
      error: 'B-file request failed (HTTP 500).',
    });
  });

  it('holds the staleness guard across the b-file fetch too - a second await the generation token must also cover', async () => {
    // Both requests must clear the FIRST staleness check (after the inline
    // load) before either one is superseded, so the only thing that can tell
    // them apart is the SECOND check, after the b-file fetch. That means the
    // first request's inline load has to resolve, and its b-file fetch has to
    // be issued, before the second request is even started.
    const firstBfile = deferred<BFileResult>();
    const secondBfile = deferred<BFileResult>();
    const bfileCalls: string[] = [];
    const loader: SequenceLoader = () => Promise.resolve(sequenceOf(3));
    const bfileLoader: BFileLoader = (aNumber) => {
      bfileCalls.push(aNumber);
      return aNumber === 'A_FIRST' ? firstBfile.promise : secondBfile.promise;
    };

    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    const rebuild = createRebuilder(scene, loader, undefined, undefined, undefined, bfileLoader);

    const firstState: ControlState = { ...baseState, terms: 50 };
    const firstDone = rebuild(firstState);
    await until(() => bfileCalls.includes('A_FIRST'));

    const secondState: ControlState = { ...baseState, aNumber: 'A_SECOND', terms: 70 };
    const secondDone = rebuild(secondState);
    await until(() => bfileCalls.includes('A_SECOND'));

    // Resolve out of start order: the superseding (second) request's b-file
    // fetch settles first, then the superseded (first) request's settles
    // last - the ordering that lets a stale request win without a guard on
    // THIS await, specifically.
    secondBfile.resolve({ terms: bfileTermsOf(70), truncated: false });
    await secondDone;
    firstBfile.resolve({ terms: bfileTermsOf(50), truncated: false });
    await firstDone;

    expect(calls).toHaveLength(1);
    expect(calls[0]!.positions).toHaveLength((70 + 1) * 3);
  });
});
