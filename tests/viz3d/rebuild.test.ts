// tests/viz3d/rebuild.test.ts
import { describe, it, expect } from 'vitest';
import { registerAll } from '../../src/viz/all';
import {
  createRebuilder,
  type SequenceLoader,
  type BFileLoader,
  type LoadReport,
  type OverBudgetInfo,
} from '../../src/viz3d/dev/route';
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

  it('drops a superseded rebuild\'s b-file REJECTION, not just its resolution', async () => {
    // Same ordering as the test above, but the superseded (first) request's
    // b-file fetch REJECTS instead of resolving. Before the fix, the catch
    // branch had no staleness check, so it ran onLoadReport/onSequence/
    // setGeometry unconditionally with A_FIRST's stale data - clobbering
    // whatever A_SECOND had already drawn.
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
    const reports: LoadReport[] = [];
    const rebuild = createRebuilder(scene, loader, undefined, undefined, (r) => reports.push(r), bfileLoader);

    const firstState: ControlState = { ...baseState, terms: 50 };
    const firstDone = rebuild(firstState);
    await until(() => bfileCalls.includes('A_FIRST'));

    const secondState: ControlState = { ...baseState, aNumber: 'A_SECOND', terms: 70 };
    const secondDone = rebuild(secondState);
    await until(() => bfileCalls.includes('A_SECOND'));

    // The superseding (second) request succeeds first and draws.
    secondBfile.resolve({ terms: bfileTermsOf(70), truncated: false });
    await secondDone;
    expect(calls).toHaveLength(1);
    expect(calls[0]!.positions).toHaveLength((70 + 1) * 3);
    expect(reports).toHaveLength(1);

    // Then the superseded (first) request's b-file fetch rejects, after the
    // fact. Nothing from it may reach the scene or the reader.
    firstBfile.reject(new Error('B-file request failed (HTTP 500).'));
    await firstDone;

    expect(calls).toHaveLength(1); // still only the second request's geometry
    expect(reports).toHaveLength(1); // no stale report from the first request
  });

  it('reports a load failure (e.g. a typo\'d A-number) instead of an unhandled rejection', async () => {
    const loader: SequenceLoader = () => Promise.reject(new Error('"A1x" is not an OEIS A-number.'));
    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    const errors: string[] = [];
    const rebuild = createRebuilder(scene, loader, undefined, undefined, undefined, undefined, (m) => errors.push(m));

    // If createRebuilder ever stops catching this, `void rebuild(...)`'s
    // caller (route.ts) would produce an unhandled rejection - awaiting it
    // directly here is what would surface that as a failed test instead.
    await rebuild(baseState);

    expect(errors).toEqual(['"A1x" is not an OEIS A-number.']);
    expect(calls).toHaveLength(0); // the last object on screen is left alone
  });

  it('stays silent when a SUPERSEDED request\'s load fails', async () => {
    const first = deferred<Sequence>();
    const loader: SequenceLoader = (aNumber) => (aNumber === 'A_FIRST' ? first.promise : Promise.resolve(sequenceOf(3)));
    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    const errors: string[] = [];
    const rebuild = createRebuilder(scene, loader, undefined, undefined, undefined, undefined, (m) => errors.push(m));

    const firstDone = rebuild(baseState); // A_FIRST, still pending
    const secondState: ControlState = { ...baseState, aNumber: 'A_SECOND' };
    const secondDone = rebuild(secondState); // supersedes it immediately
    await secondDone;

    first.reject(new Error('boom'));
    await firstDone;

    expect(errors).toHaveLength(0); // the superseded failure says nothing
    expect(calls).toHaveLength(1); // the second request drew normally
  });

  it('counts BOTH objects toward the ceiling when the null model is on, and gates the build', async () => {
    // 600,000 terms is 600,001 vertices for one turtle object - under the
    // 1,000,000 ceiling alone, but the null model doubles it to 1,200,002,
    // which is over. This is the case the doubling fix exists for: without
    // it, this exact request would sail through ungated.
    const loader: SequenceLoader = () => Promise.resolve(sequenceOf(600_000));
    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    const overBudgetCalls: OverBudgetInfo[] = [];
    const rebuild = createRebuilder(scene, loader, undefined, (info) => { overBudgetCalls.push(info); });

    const state: ControlState = { ...baseState, terms: 600_000, nullOn: true };
    await rebuild(state);

    expect(calls).toHaveLength(0); // gated before geometryFor ever ran
    expect(overBudgetCalls).toHaveLength(1);
    expect(overBudgetCalls[0]!.vertices).toBe(2 * 600_001);
  });

  it('does not gate the same term count with the null model off', async () => {
    const loader: SequenceLoader = () => Promise.resolve(sequenceOf(600_000));
    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    const overBudgetCalls: OverBudgetInfo[] = [];
    const rebuild = createRebuilder(scene, loader, undefined, (info) => { overBudgetCalls.push(info); });

    const state: ControlState = { ...baseState, terms: 600_000, nullOn: false };
    await rebuild(state);

    expect(overBudgetCalls).toHaveLength(0);
    expect(calls).toHaveLength(1);
  });

  it('builds anyway when the offered confirm callback is invoked', async () => {
    const loader: SequenceLoader = () => Promise.resolve(sequenceOf(600_000));
    const calls: Geometry3D[] = [];
    const scene = {
      setGeometry: (g: Geometry3D) => { calls.push(g); },
      setNullGeometry: () => {},
    };
    let buildAnyway: (() => void) | undefined;
    const rebuild = createRebuilder(scene, loader, undefined, (_info, confirm) => { buildAnyway = confirm; });

    const state: ControlState = { ...baseState, terms: 600_000, nullOn: true };
    await rebuild(state);
    expect(calls).toHaveLength(0);

    buildAnyway!();
    await until(() => calls.length > 0);
    expect(calls).toHaveLength(1);
  });
});
