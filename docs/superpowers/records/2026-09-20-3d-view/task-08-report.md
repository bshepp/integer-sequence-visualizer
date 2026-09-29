# Task 8, Stage A report

## Scope
Stage A only: `src/viz3d/dev/bench.ts` (new) and the `?3d&bench` branch in
`src/viz3d/dev/route.ts`. Nothing from `budget.ts`, `overBudget`, the budget
test, `docs/3d-measurements.md`, or the route's over-budget warning was
created — those are a later dispatch, per instructions.

## Files created
- `src/viz3d/dev/bench.ts` — `runBench(canvas): Promise<BenchRow[]>`,
  `interface BenchRow { vertices: number; msPerFrame: number }`, and
  `gpuName(canvas): string`. Body matches the brief's Step 3 (same vertex
  sweep `[10_000, 50_000, 100_000, 500_000, 1_000_000, 2_000_000, 5_000_000]`,
  same `liftPath` path generator, 30 frames per row) with one deliberate
  deviation from the brief's literal snippet: the loop and `scene.dispose()`
  are wrapped in `try { ... } finally { scene.dispose(); }` rather than a bare
  trailing call. The brief's own Step-3 code only disposes on the success
  path; the dispatch instructions explicitly required disposal "including on
  the failure path," so I added the `finally`. This is the only place I
  departed from the brief's exact code.

## Files modified
- `src/viz3d/dev/route.ts`:
  - Added `import { runBench, gpuName } from './bench';`
  - Added the bench branch immediately after the WebGL guard's `try/catch`
    (i.e. after the guard's early `return` on no-WebGL, before
    `scene.resize()` and before the normal-mode `window.addEventListener`,
    `buildControls`, etc.):
    ```ts
    if (new URLSearchParams(location.search).has('bench')) {
      scene.dispose();
      const rows = await runBench(canvas);
      console.table(rows);
      console.log('GPU:', gpuName(canvas));
      return;
    }
    ```
  - **Deviation from the brief's literal Step 4 snippet:** I added
    `scene.dispose();` as the first line of the branch, which the brief's
    snippet does not have. Reasoning: the WebGL guard above already calls
    `createScene(canvas, onPick)` and assigns it to `scene` purely to prove a
    WebGL context exists (for the no-WebGL early-return). If the bench branch
    ran without disposing that scene first, two live `THREE.WebGLRenderer` /
    `OrbitControls` instances (with their event listeners) would exist
    against the same canvas — the guard's, abandoned forever since the
    function returns right after, and `runBench`'s own internal one. The
    dispatch instructions flagged that "the suite has already caught two GPU
    leaks in this file; do not add a third" — leaving the guard's scene
    undisposed on the bench path would be exactly that third leak, so I
    disposed it before calling `runBench`.

## Placement relative to the WebGL guard
The bench check is the very next statement after the guard's `try { scene =
createScene(...) } catch { ...; return; }` block, before any other route
setup (`scene.resize()`, the resize listener, `buildControls`, `rebuild`).
A machine with no WebGL context throws inside `createScene`, hits the
`catch`, prints the guard sentence, and returns — never reaching the bench
branch or `runBench`.

## Disposal on both paths
- `runBench` creates its own scene via `createScene(canvas)` and wraps the
  entire sweep in `try { ... } finally { scene.dispose(); }`, so the scene is
  disposed whether the loop completes normally or a call inside it throws
  (e.g. `liftPath`, `scene.setGeometry`, or an awaited `requestAnimationFrame`
  rejecting).
- The route's own guard-created `scene` is disposed at the top of the bench
  branch, before `runBench` is invoked, so it never lingers as a second live
  renderer.

## Things the brief didn't specify (my calls)
1. The `finally`-wrapped disposal inside `runBench` (failure-path disposal;
   see above) — required by the dispatch, absent from the brief's literal
   code.
2. Disposing the guard's outer `scene` before calling `runBench` — not
   mentioned in the brief at all; done to avoid the "third leak" the dispatch
   warned against, and to avoid two renderers fighting over one canvas.
3. No test was written for `bench.ts`/the bench route branch — per dispatch
   instructions, `runBench` needs a real GPU and jsdom has none. **The
   benchmark is unverified by automated tests; it must be verified by the
   controller running `?3d&bench` in a real browser**, which was explicitly
   out of scope for me (I did not run `npm run dev` or open a browser).

## Verification run

`npm test`:
```
 Test Files  57 passed (57)
      Tests  722 passed (722)
   Start at  01:15:13
   Duration  8.38s (transform 6.65s, setup 0ms, import 11.35s, tests 11.62s, environment 31.01s)
```
(Numerous "Not implemented: HTMLCanvasElement's getContext() method: without
installing the canvas npm package" lines are pre-existing jsdom console noise
from other WebGL-guard-related tests, not new failures.)

`npm run build`:
```
> integer-sequence-visualizer@1.0.0 build
> tsc --noEmit && vite build

vite v8.2.0 building client environment for production...
✓ 61 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                           2.20 kB │ gzip:  0.83 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB │ gzip:  5.04 kB
dist/assets/index-BFHzFX5b.js           226.46 kB │ gzip: 88.03 kB

✓ built in 328ms
```
No TypeScript errors; build clean.

Bundle check:
```
$ grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
clean: three is not in dist
```

## Commit
SHA `013eb11cd7037c8b55cd693f5fbff376addf9e63`
Message: `feat(3d): benchmark harness for the measured ceiling` (full body in
git log; not pushed).

Files in commit: `src/viz3d/dev/bench.ts` (new), `src/viz3d/dev/route.ts`
(modified). Nothing else touched.

---

# Task 8, Stage B report

## Scope
Fixed the hang in `bench.ts` the controller found on real hardware, widened
`BenchRow`, wrote `docs/3d-measurements.md` from the controller's measured
table, added `src/viz3d/budget.ts` + its test, and wired an over-budget
warning into the route. Worked entirely from the numbers the controller gave
me; did not run `npm run dev` or open a browser.

## Files created
- `src/viz3d/budget.ts` — `MEASURED_CEILING = 1_000_000`, `overBudget(vertices:
  number): boolean`. Comment cites `docs/3d-measurements.md`, names the GPU,
  and states it's a fact about one machine.
- `tests/viz3d/budget.test.ts` — exactly the brief's Step 1 test, verbatim.
- `docs/3d-measurements.md` — the measured table, the exact GPU string, date
  2026-09-20, and (this is the part the brief called out) an explicit
  "What was NOT measured" section: steady-state frame rate was not captured,
  because an automated tab's `document.hidden` is `true` and
  `requestAnimationFrame` never fires there (confirmed by the controller:
  `rafFired: false`, `visibilityState: 'hidden'`); a `gl.finish()`-bracketed
  attempt outside the harness read 0.03ms for 5M vertices (impossible), and a
  `readPixels` approach is dominated by pixel transfer. The doc gives the
  exact steps to get a real frame-rate number later: `npm run dev`, open
  `?3d&bench` in a genuinely visible/focused tab (not headless, not
  backgrounded, not driven by automation that never foregrounds it), read
  `console.table`'s `msPerFrame` column, and treat it as meaningless if the
  tab lost visibility mid-run.

## Files modified

### `src/viz3d/dev/bench.ts`
Two defects fixed, per the dispatch:

1. **The hang.** `await new Promise((r) => requestAnimationFrame(r))` never
   resolves when `document.hidden` is true. Added a `nextFrame()` helper:
   ```ts
   function nextFrame(): Promise<void> {
     if (document.hidden) return new Promise((resolve) => setTimeout(resolve, 0));
     return new Promise((resolve) => requestAnimationFrame(() => resolve()));
   }
   ```
   `runBench`'s frame loop awaits this instead of a bare rAF promise, so the
   harness terminates in an automated tab (timer path) and still paces on
   real frames in a visible one (rAF path). The doc is explicit that the
   timer-path number is not a frame rate — it only exists to end the loop.

2. **Dishonest/missing timings.** The old harness only ever produced
   `msPerFrame` from a frame loop that didn't force GPU completion, and never
   captured build or upload cost at all — the two numbers that turned out to
   matter. Rewrote the per-vertex-count body to time three phases:
   - `buildMs` — wall time for the `Array.from` path generation + `liftPath`
     call (JS only, no GPU involved).
   - `uploadMs` — wall time for `scene.setGeometry(geometry)` followed by
     `gl.finish()`, so the timer waits for the GPU to actually finish the
     upload rather than for the JS call that only queued it.
   - `msPerFrame` — unchanged in spirit (30 frames, `scene.resize()` each
     iteration) but now brackets each frame with `gl.finish()` before
     awaiting `nextFrame()`, again so a queued-but-not-executed frame can't
     read as near-zero.
   `gl` is obtained the same way `gpuName` already does in this file —
   `canvas.getContext('webgl2') ?? canvas.getContext('webgl')` — which is
   safe to call after `createScene` has already claimed the context, per the
   HTML canvas spec (a second `getContext` call for the same type returns the
   existing context rather than creating a new one); `gpuName` already relied
   on this same fact.

   **`BenchRow`'s new shape:**
   ```ts
   export interface BenchRow {
     vertices: number;
     buildMs: number;
     uploadMs: number;
     totalMs: number;   // buildMs + uploadMs
     msPerFrame: number;
   }
   ```
   `totalMs` is a stored field (not a getter) so `console.table` prints it
   directly, matching the "total ms" column in the measured table.

   Disposal is unchanged from Stage A: `runBench` still wraps the whole sweep
   in `try { ... } finally { scene.dispose(); }`, on both the success and
   failure paths.

### `src/viz3d/dev/route.ts`
- Imported `overBudget` and `MEASURED_CEILING` from `../budget`.
- `createRebuilder` gained a fourth, optional parameter,
  `onOverBudget?: (vertices: number) => void`, appended after the existing
  `onSequence` parameter so no existing call site (including
  `tests/viz3d/rebuild.test.ts`, which calls `createRebuilder(scene, loader)`
  with two arguments) needs to change.
- Inside `rebuild()`, right before the real object's `scene.setGeometry`
  call — i.e. gated by the same staleness check, using the geometry that has
  already survived it and is the one actually about to be drawn — added:
  ```ts
  if (geometry) {
    if (overBudget(geometry.termOf.length)) onOverBudget?.(geometry.termOf.length);
    scene.setGeometry(geometry, colorsFor(geometry, seq.length));
  }
  ```
  `geometry.termOf.length` is the vertex count (one entry per vertex, per
  `Geometry3D`'s own doc comment), matching the brief's Step 7. The build is
  never blocked — `scene.setGeometry` runs unconditionally when `geometry` is
  non-null, whether or not the budget callback fired.
- In `mount3dRoute`, wired the callback to the existing `readout` element:
  ```ts
  const rebuild = createRebuilder(scene, undefined, (seq) => { seqRef = seq; }, (vertices) => {
    readout.textContent =
      `${vertices.toLocaleString()} vertices is past the measured ceiling ` +
      `(${MEASURED_CEILING.toLocaleString()}) - this may drop frames.`;
  });
  ```
  This is the same `readout` div the WebGL-guard/pick callback already writes
  to (`readout.textContent = seqRef ? ...`); the two writers don't conflict
  because they fire on different events (a pick click vs. a rebuild that
  happens to be over budget), matching the pattern already in the file.

## Interfaces left undisturbed
- WebGL guard: untouched, still the first thing `mount3dRoute` does, exact
  sentence unchanged.
- Request-generation staleness check: untouched; the budget check sits
  strictly after `if (mine !== generation) return`, so a stale rebuild never
  fires `onOverBudget` either.
- `onSequence` hook: signature and call site unchanged, still fires
  unconditionally for the winning rebuild before the budget check.
- `scene.ts` disposal (real object, null object, picking proxy): not
  touched at all.
- `parseCssColor`: not touched.
- `three` import isolation: only `src/viz3d/dev/*` imports `three`;
  `src/viz3d/budget.ts` imports nothing. Confirmed by
  `tests/viz3d/devIsolation.test.ts` passing and the bundle check below.

## Decisions not specified by the brief
1. **Timer fallback uses `setTimeout(resolve, 0)`**, not
   `requestIdleCallback` or a fixed 16ms delay. The requirement was only that
   the harness terminate in a hidden tab; a bare macrotask tick is the
   simplest thing that satisfies that, and `docs/3d-measurements.md` is
   explicit that this path's timing is not a frame rate, so there was no
   reason to dress it up as one (e.g. by delaying 16ms to *look* like 60fps).
2. **`totalMs` is computed and stored, not derived at read time**, so a
   consumer of `BenchRow` (console.table, or a future test) sees it directly
   without recomputing `buildMs + uploadMs`.
3. **`onOverBudget` as a new optional 4th parameter** rather than restructuring
   `createRebuilder` to take an options object, or threading `readout`
   itself into `createRebuilder`. Chose the additive-parameter shape
   specifically because the dispatch listed the generation guard and
   `onSequence` hook as interfaces not to disturb, and an options-object
   refactor would have changed the call shape for every existing caller
   (including the test file) even though behavior would be identical.
4. **`docs/3d-measurements.md` structure** follows `docs/measurement-log.md`'s
   entry style (an "Asked as" framing, a method/machine statement, then
   results) rather than the brief's Step-4 template verbatim, per the
   dispatch's explicit instruction to follow the log's style. It keeps the
   template's substance (table, GPU string, date, ceiling) but adds the
   "what was NOT measured" section and the reproduction steps, which the
   dispatch required and the brief's own template didn't include (the brief
   predates the hang being discovered).
5. **Did not add a unit test for `bench.ts` itself** (same reasoning as
   Stage A: no real GPU/canvas in jsdom, and the dispatch's scope was fixing
   the hang and recording measurements, not testing the harness).

## Verification run

`npx vitest run tests/viz3d/budget.test.ts`:
```
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

`npm test`:
```
 Test Files  58 passed (58)
      Tests  724 passed (724)
   Start at  01:27:17
   Duration  8.95s (transform 7.66s, setup 0ms, import 12.82s, tests 12.33s, environment 31.90s)
```
(58 files / 724 tests, up from Stage A's 57/722 — the two new budget tests.
"Not implemented: HTMLCanvasElement's getContext()" lines are the same
pre-existing jsdom noise noted in Stage A, unrelated to this change.)

`npm run build`:
```
> integer-sequence-visualizer@1.0.0 build
> tsc --noEmit && vite build

vite v8.2.0 building client environment for production...
✓ 61 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                           2.20 kB │ gzip:  0.83 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB │ gzip:  5.04 kB
dist/assets/index-BFHzFX5b.js           226.46 kB │ gzip: 88.03 kB

✓ built in 341ms
```
No TypeScript errors; build clean.

Bundle check:
```
$ grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
clean: three is not in dist
```

## Commit
SHA `983e6af577cebe6308441bc59abd676b7e3f2d5d`
Message: `feat(3d): measured ceiling, and a warning that cites the machine`
(brief's Step 9 message; full attribution trailer in git log; not pushed).

Files in commit: `docs/3d-measurements.md` (new), `src/viz3d/budget.ts`
(new), `src/viz3d/dev/bench.ts` (modified), `src/viz3d/dev/route.ts`
(modified), `tests/viz3d/budget.test.ts` (new).

---

# Task 8, fix round 1 report

## Finding addressed
Review (Important): `BenchRow.msPerFrame` carried no structural record of
which pacing produced it. A timer-paced number printed in `console.table`
indistinguishable from a real frame time; the type-comment warning was prose,
not enforcement, and could be dropped by anyone pasting the table into docs.

Note: before this round, `src/viz3d/dev/route.ts` had changed under me (a
b-file loader and `LoadReport`/`describeLoad` machinery, plus two new
optional `createRebuilder` params, landed by other work). I read the current
file before touching anything; this fix touches only `bench.ts` and the
docs, so none of that route.ts surface needed to change.

## Fix

### `src/viz3d/dev/bench.ts`
1. Added `export type FramePacing = 'raf' | 'timer';` and widened `BenchRow`:
   ```ts
   export interface BenchRow {
     vertices: number;
     buildMs: number;
     uploadMs: number;
     totalMs: number;
     msPerFrame: number | null;
     framePacing: FramePacing;
   }
   ```
2. `nextFrame()` now resolves with which path it took (`'raf'` from the real
   `requestAnimationFrame` branch, `'timer'` from the `document.hidden`
   fallback) instead of a bare `void`, so the pacing is observed at the same
   place it's decided rather than inferred afterward.
3. The per-row frame loop tracks `framePacing` across all 30 frames,
   starting from `'raf'` and flipping to `'timer'` (sticky - never flips
   back) the moment any single frame in that row falls back:
   ```ts
   let framePacing: FramePacing = 'raf';
   for (let f = 0; f < FRAMES; f++) {
     scene.resize();
     gl?.finish();
     const pacing = await nextFrame();
     if (pacing === 'timer') framePacing = 'timer';
   }
   const msPerFrame = framePacing === 'raf' ? (performance.now() - frameStart) / FRAMES : null;
   ```
   This satisfies "checked frame by frame, not read once at the start" - a
   tab that goes hidden partway through a row's 30-frame sweep still taints
   that row's result, because one timer-paced frame inside an otherwise-rAF
   average would understate real cost just as easily as an all-timer row
   would.
4. **Chose `null` over "keep the number, make the flag impossible to drop."**
   Matches the coordinator's stated preference: a value that can't be
   trusted is better absent than present-with-an-asterisk. It also means a
   consumer (`console.table`, a future test, someone eyeballing the object)
   cannot get a `msPerFrame` reading without `framePacing` being `'raf'` -
   there is no code path that produces a number under `'timer'` for the
   caller to accidentally keep.

### Route output (requirement 3)
No code change was needed in `route.ts`. Its `?3d&bench` branch already does
`console.table(rows)` on the exact `BenchRow[]` `runBench` returns, without
filtering or reshaping fields - so once `BenchRow` carries `framePacing`,
that column appears in the printed table for free. Confirmed by inspection
(`route.ts` lines ~201-207 are unchanged from before this round); the branch
still sits immediately after the WebGL guard, disposes the guard's scene,
and returns without mounting the UI, exactly as before.

### `docs/3d-measurements.md`
Rewrote the paragraph explaining the hidden-tab fallback (previously "treat
`msPerFrame` as meaningful only from a run in a visible tab") to describe the
`framePacing`/`null` mechanism instead of only warning about it, and to state
plainly that this run's rows all came back `framePacing: 'timer'`,
`msPerFrame: null`. Updated the "Getting a real frame-rate number later"
steps to say "check `framePacing` before trusting `msPerFrame`" rather than
"read `msPerFrame` and hope the tab stayed visible."

## Kept intact
- `runBench` still wraps the sweep in `try { ... } finally { scene.dispose(); }`
  - untouched by this round.
- The `?3d&bench` branch in `route.ts` is unchanged: still after the WebGL
  guard, still disposes the guard's scene, still returns without mounting
  controls.
- `MEASURED_CEILING` is still `1_000_000`; `src/viz3d/budget.ts` is untouched
  and still cites `docs/3d-measurements.md` and names the GPU.
- No existing code constructs a `BenchRow` object other than `runBench`
  itself (confirmed by grep across the repo), so widening the interface
  broke nothing else.

## Verification run

`npm test`:
```
 Test Files  59 passed (59)
      Tests  730 passed (730)
   Start at  01:46:17
   Duration  8.73s (transform 7.69s, setup 0ms, import 12.99s, tests 12.18s, environment 31.42s)
```
(59 files / 730 tests - up from this task's earlier 58/724 because of the
unrelated b-file/LoadReport work that landed in `route.ts` between rounds,
not this fix. "Not implemented: HTMLCanvasElement's getContext()" lines are
the same pre-existing jsdom noise noted earlier in this report.)

`npm run build`:
```
> integer-sequence-visualizer@1.0.0 build
> tsc --noEmit && vite build

vite v8.2.0 building client environment for production...
✓ 61 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                           2.20 kB │ gzip:  0.83 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB │ gzip:  5.04 kB
dist/assets/index-BFHzFX5b.js           226.46 kB │ gzip: 88.03 kB

✓ built in 351ms
```
No TypeScript errors; build clean.

Bundle check:
```
$ npm run build && grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
clean: three is not in dist
```

## New `BenchRow` shape
```ts
export type FramePacing = 'raf' | 'timer';

export interface BenchRow {
  vertices: number;
  buildMs: number;
  uploadMs: number;
  totalMs: number;
  msPerFrame: number | null;
  framePacing: FramePacing;
}
```

## Commit
SHA `a19d287650c8e93093ef7d640065208cde6b021f`
Message: `fix(3d): flag timer-paced bench rows in data, not just a comment`
(full body + attribution trailer in git log; not pushed).

Files in commit: `docs/3d-measurements.md` (modified), `src/viz3d/dev/bench.ts`
(modified). `route.ts` and `budget.ts` were read but not touched - the fix
did not require changing them.
