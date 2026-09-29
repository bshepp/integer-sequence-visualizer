# Task 4 Report: Controls — view, sequence, term count, lift

## Files created
- `src/viz3d/dev/controls.ts` — transcribed verbatim from the brief's Step 3.
- `tests/viz3d/controls.test.ts` — transcribed verbatim from the brief's Step 1, including the `// @vitest-environment jsdom` pragma as the first line (confirmed against the pattern in `tests/ui/a11y.test.ts`; project default vitest environment is `node` per `vite.config.ts`).

## Files modified
- `src/viz3d/dev/route.ts` — added imports (`getVisualizer` from `../../viz/registry`, `defaultParams` from `../../viz/types`, `buildControls`/`ControlState` from `./controls`, and `Scene3D` type from `./scene`), and replaced the body after `scene.resize(); window.addEventListener('resize', ...)` with the brief's Step 5 `state`/`rebuild`/`buildControls` wiring, adapted per the integration note: term count is applied by slicing `loaded.terms.slice(0, state.terms)` before constructing `SequenceView`.

## Preserving the WebGL guard
Read the current `route.ts` before editing. The existing `try { scene = createScene(canvas); } catch { ... return; }` block (which shows "This browser has no WebGL context, so the 3D tool cannot run. The engine is unaffected." and returns early) was left completely untouched, positioned before all new code. The brief's Step 5 snippet was only used for what comes *after* `scene.resize()`/the resize listener — i.e., the controls/rebuild wiring is appended, not substituted in place of the guard. Since the guard's `catch` branch returns, the new controls code (and the async `rebuild`) only ever executes on the success path, so a browser without WebGL never sees controls appended and stops at the sentence exactly as before.

## Unspecified decision
The brief's Step 5 snippet used `let scene;` (as the original file did), but once `scene` is referenced inside the nested `rebuild` closure, `tsc --noEmit` raised TS7034/TS7005 (implicit `any`, since control-flow narrowing from the try/catch doesn't cross the closure boundary). This was not a pre-existing failure — verified via `git stash` that `npm run build` was clean before this change. Fixed by importing `type Scene3D` from `./scene` (already exported by Task 3) and declaring `let scene: Scene3D;`. No other deviations from the brief.

## Test/build output

`npx vitest run tests/viz3d/controls.test.ts` before writing `controls.ts`:
```
FAIL  tests/viz3d/controls.test.ts [ tests/viz3d/controls.test.ts ]
Error: Failed to resolve import "../../src/viz3d/dev/controls" from "tests/viz3d/controls.test.ts". Does the file exist?
```
Correct failure reason (module doesn't exist yet).

`npx vitest run tests/viz3d/controls.test.ts` after writing `controls.ts`:
```
Test Files  1 passed (1)
     Tests  4 passed (4)
```

`npm test` (full suite, after route.ts wiring + Scene3D type fix):
```
Test Files  53 passed (53)
     Tests  709 passed (709)
```
(The repeated "Not implemented: HTMLCanvasElement's getContext()" lines are pre-existing jsdom console noise from `tests/viz3d/devIsolation.test.ts`'s WebGL-guard test, not failures.)

`npm run build`:
```
tsc --noEmit && vite build
✓ built in 311ms
```

## Commit
SHA: `f75e039`
Message: `feat(3d): view, sequence, term-count and lift controls` (plus attribution trailers per session instructions).
Files: `src/viz3d/dev/controls.ts` (new), `src/viz3d/dev/route.ts` (modified), `tests/viz3d/controls.test.ts` (new). Not pushed.

## Skipped
Step 6 ("Check it by hand" via `npm run dev` / browser) was explicitly skipped per instructions — deferred to the controller.

---

# Fix round 1: out-of-order fetch resolution in `rebuild()`

## Finding
The brief's own Step 5 snippet (transcribed faithfully above) had no guard against overlapping `rebuild()` calls: every `onChange` fired `void rebuild()` independently, each with its own in-flight `lookupById`, and whichever resolved LAST called `scene.setGeometry` — even when it was the stale one (e.g. type A000002, then A000045, then back to A000002 quickly; if the A000045 fetch resolves last, the screen shows A000045 while the controls say A000002).

## Fix
Added a request-generation token, exactly the shape the coordinator specified: `generation` increments on every call, each call captures its own `mine = ++generation`, and after the only `await` in the function, `if (mine !== generation) return;` drops the result if a newer call has since started. No cancellation or debouncing was added.

## Chosen seam (why not "loader param on `mount3dRoute`")
`mount3dRoute` itself cannot be unit-tested at all in jsdom: `createScene` throws (no WebGL), so the function always returns early at the guard, before ever reaching `rebuild`. Parameterizing `mount3dRoute` with a loader would not make the race testable without *also* injecting a fake scene/canvas seam — more surface than needed, and it would mean touching the guard region.

Instead, the race-prone logic was extracted into a new exported function in `src/viz3d/dev/route.ts`:

```ts
export type SequenceLoader = (aNumber: string) => Promise<Sequence>;

export function createRebuilder(
  scene: Pick<Scene3D, 'setGeometry'>,
  loader: SequenceLoader = lookupById,
): (state: ControlState) => Promise<void> {
  let generation = 0;
  return async function rebuild(state: ControlState): Promise<void> {
    const mine = ++generation;
    const loaded = await loader(state.aNumber);
    if (mine !== generation) return; // a newer rebuild started while this was in flight
    const seq = new SequenceView({ ...loaded, terms: loaded.terms.slice(0, state.terms) });
    const defaults = defaultParams(getVisualizer(state.vizId).params);
    const geometry = geometryFor(state.vizId, seq, defaults, { step: state.step });
    if (geometry) scene.setGeometry(geometry);
  };
}
```

`mount3dRoute` now reads:

```ts
  let state: ControlState = { vizId: 'turtle', aNumber: 'A000002', terms: 500, step: 0.5 };
  const rebuild = createRebuilder(scene);

  root.appendChild(buildControls(state, (next) => {
    state = next;
    void rebuild(state);
  }));
  await rebuild(state);
```

This needs `scene` (a real `Scene3D` in production) and a `loader` (defaults to the real `lookupById`), both of which a test can substitute with fakes — `createRebuilder` itself touches no DOM/WebGL/three.js. The WebGL try/catch guard is completely unchanged; `createRebuilder` is only ever invoked after it succeeds, exactly as before.

## Covering test
New file: `tests/viz3d/rebuild.test.ts`. It calls `createRebuilder` directly with a fake `scene` (`{ setGeometry }` capturing every call) and a fake `loader` returning two independently-controlled deferred promises for two different `aNumber`s. It starts a first request (`aNumber: 'A_FIRST'`, `terms: 3`), then — before that resolves — starts a second, superseding request (`aNumber: 'A_SECOND'`, `terms: 5`), then resolves them in reverse of start order (the superseding request's fetch settles first; the superseded request's fetch settles last — the exact ordering that lets a stale request win without the guard). It asserts exactly one `setGeometry` call ever happens, with the vertex count belonging to the 5-term (second, current) request, distinguishing the two by vertex count since a turtle path has one vertex per term plus the origin.

`registerAll()` is called at module load (mirrors what `route.ts` does) so `getVisualizer('turtle')` resolves inside `createRebuilder`; no DOM/jsdom is needed for this test, since `createRebuilder`'s only dependencies (`SequenceView`, `getVisualizer`, `defaultParams`, `geometryFor`) are plain TypeScript.

### Before-fix run (guard temporarily removed)
Command: `npx vitest run tests/viz3d/rebuild.test.ts` with the `mine !== generation` check and `generation` variable removed from `createRebuilder` (a scratch edit, reverted immediately after capturing this output — never committed):
```
 ❯ tests/viz3d/rebuild.test.ts (1 test | 1 failed) 7ms
     × keeps only the last-started request's geometry, even when an earlier request's fetch resolves after it 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/viz3d/rebuild.test.ts > createRebuilder > keeps only the last-started request's geometry, even when an earlier request's fetch resolves after it
AssertionError: expected [ { …(4) }, { …(4) } ] to have a length of 1 but got 2

- Expected
+ Received

- 1
+ 2

 ❯ tests/viz3d/rebuild.test.ts:60:19
     58|     // A turtle path has one vertex per term plus the origin, so 5 sli…
     59|     // terms and 3 sliced terms are distinguishable by vertex count al…
     60|     expect(calls).toHaveLength(1);

 Test Files  1 failed (1)
      Tests  1 failed (1)
```
Both the stale (A_FIRST) and current (A_SECOND) requests called `setGeometry` — confirming the test fails for the reported reason (two commits instead of one) rather than an unrelated setup error.

### After-fix run (guard restored)
Command: `npx vitest run tests/viz3d/rebuild.test.ts`:
```
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

### Full suite and build after the fix
`npm test`:
```
Test Files  54 passed (54)
     Tests  710 passed (710)
```
(same pre-existing "Not implemented: HTMLCanvasElement's getContext()" jsdom console noise as before, from `devIsolation.test.ts`'s WebGL-guard path — not failures.)

`npm run build`:
```
tsc --noEmit && vite build
✓ built in 326ms
```

## Commit
SHA: `93558ad`
Message: `fix(3d): guard rebuild against out-of-order fetch resolution` (plus attribution trailers).
Files: `src/viz3d/dev/route.ts` (modified — adds `SequenceLoader` type and `createRebuilder`, `mount3dRoute` now delegates to it), `tests/viz3d/rebuild.test.ts` (new). Not pushed. `npm run dev` / a browser were not started, per instructions.
