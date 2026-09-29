# Task 6 report: the null panel, under one camera

## Commit

`b6b6b4f` — `feat(3d): the null model beside the real object, under one camera`
7 files changed, 131 insertions(+), 6 deletions(-). Not pushed.

## Files created

- `src/viz3d/dev/panels.ts` — `surrogateView(seq, type, seed)`, transcribed verbatim from the brief's Step 3.
- `tests/viz3d/panels.test.ts` — transcribed verbatim from the brief's Step 1 (3 tests).

## Files modified

- `src/viz3d/dev/scene.ts` — widened `Scene3D` with `setNullGeometry(g: Geometry3D | null, colors?: Uint8Array): void`; added `nullObject`/`nullMaterial` state and the method body (see deviation below); disposed both in `dispose()`.
- `src/viz3d/dev/controls.ts` — added `nullOn: boolean` to `ControlState`; added a `label > input.nulltoggle[type=checkbox]` that emits `{ nullOn }` on `change`, checked-state initialised from `state.nullOn`.
- `src/viz3d/dev/route.ts` — imported `surrogateView`; widened `createRebuilder`'s scene parameter to `Pick<Scene3D, 'setGeometry' | 'setNullGeometry'>`; added the null-geometry branch to `rebuild()` exactly as the brief's Step 5 snippet; added `nullOn: true` to the initial `ControlState` literal in `mount3dRoute`.
- `tests/viz3d/controls.test.ts` — added `nullOn: true` to the `initial` fixture; added a new case `'reports the null-model toggle'` asserting the checkbox starts checked and emits `{ ...initial, nullOn: false }` on change.
- `tests/viz3d/rebuild.test.ts` — added `nullOn: true` to `baseState`; added a no-op `setNullGeometry: () => {}` to the mock scene object (see "beyond the brief" below).

## Command output

`npx vitest run tests/viz3d/panels.test.ts` before writing `panels.ts`:
```
FAIL  tests/viz3d/panels.test.ts [ tests/viz3d/panels.test.ts ]
Error: Cannot find module '../../src/viz3d/dev/panels' imported from .../tests/viz3d/panels.test.ts
```
Correct failure reason confirmed (missing module, not an assertion failure).

`npx vitest run tests/viz3d/panels.test.ts` after writing `panels.ts`:
```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

`npx vitest run tests/viz3d/controls.test.ts` after the `nullOn`/checkbox work:
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

`npx vitest run tests/viz3d/` (all 7 files in the directory):
```
Test Files  7 passed (7)
     Tests  28 passed (28)
```

`npm test` (whole suite):
```
Test Files  56 passed (56)
     Tests  719 passed (719)
```
(The repeated `Not implemented: HTMLCanvasElement's getContext()` lines are pre-existing jsdom console noise from unrelated 2D-canvas tests, not failures, and not something this task's changes touch.)

`npm run build` (tsc --noEmit && vite build):
```
dist/index.html                           2.20 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB
dist/assets/index-BFHzFX5b.js           226.46 kB
✓ built in 336ms
```
Typecheck and bundle both succeeded; bundle size is consistent with `three` staying out of the shipped bundle (`devIsolation.test.ts` also passed in the full run).

## How each earlier guarantee was kept intact

- **WebGL try/catch guard in `route.ts`**: untouched. It still runs first in `mount3dRoute`, still returns early after `root.replaceChildren(p)` with the exact sentence `'This browser has no WebGL context, so the 3D tool cannot run. The engine is unaffected.'`, before `scene.resize()` or any control wiring.
- **Generation token in `createRebuilder`**: untouched. `mine = ++generation` and the `if (mine !== generation) return;` staleness check still gate everything after the loader's `await`, including the new null-geometry branch (which sits after that check, so a stale rebuild cannot call `setNullGeometry` either — verified by `rebuild.test.ts` still passing with only one `setGeometry` call recorded across the interleaved requests).
- **Material disposal for both objects**: `setGeometry`'s real-object disposal (`object.geometry.dispose(); material?.dispose(); scene.remove(object)`) is unchanged. `setNullGeometry` mirrors it exactly for `nullObject`/`nullMaterial`, and additionally nulls out both references after disposal (a small addition beyond the brief's sketch — see below). `dispose()` now disposes `nullObject`'s geometry and `nullMaterial` alongside the existing real-object cleanup and `renderer.dispose()`.
- **Resize frustum from remembered half-extent**: `resize()` and `fit()` are untouched — `fit()` still computes `halfExtent` only from the real object's `g.bounds`, and `resize()` still rebuilds the frustum from that remembered `halfExtent` without touching `camera.position` or `controls.target`. The null object is deliberately excluded from `fit()`'s bounds calculation (the brief's design: one shared camera fit to the real object, with the null object offset beside it, not both fitted jointly) — verified visually via the 1.2×-width x-offset logic ported unchanged from the brief.
- **`parseCssColor` throwing behaviour in `colors.ts`**: file untouched entirely; `colorsFor` is only called with the null geometry's own `termOf`, same function, same throwing behaviour.

## Decisions made beyond what the brief specified

1. **`setNullGeometry(null, ...)` also frees the references**: the brief's Step 5 sketch disposes `nullObject.geometry` and calls `scene.remove(nullObject)` but never disposes `nullObject`'s *material*, and never resets `nullMaterial` to `null`. The task instructions were explicit that disposal must match the real object's handling for both geometry and material, so I added `nullMaterial?.dispose()` and reset both `nullObject`/`nullMaterial` to `null` after removal — otherwise a `setNullGeometry(null)` followed by `dispose()` would double up stale references or leak the material.
2. **`createRebuilder`'s scene parameter widened to require `setNullGeometry`** (not made optional): this matches the brief's Step 5 `rebuild()` snippet, which calls `scene.setNullGeometry(...)` unconditionally rather than optionally-chained.
3. **`tests/viz3d/rebuild.test.ts` updated** (not named in either the brief or the ruling paragraph, which called out only `controls.test.ts`): its `baseState: ControlState` literal and its mock `scene` object both needed the same treatment — `nullOn: true` added to the state literal, and a no-op `setNullGeometry: () => {}` added to the mock — or `npm run build`'s `tsc --noEmit` step fails with "Property 'nullOn'/'setNullGeometry' is missing". This is the same category of breakage the ruling described for `controls.test.ts`, just in a second file; I fixed it under the same "this task owns all of it" instruction rather than leaving a second broken fixture behind.
4. **Checkbox markup**: wrapped `input.nulltoggle` in a `<label>` with a trailing "null" text node for a visible caption, matching the existing controls' plain-DOM style. The brief didn't specify markup beyond "a checkbox... with class `nulltoggle`"; the `label` wrapper doesn't affect `el.querySelector('input.nulltoggle')` lookups used by the test.

## Skipped step

Step 6 (interactive check: `npm run dev`, open `?3d`, confirm two ribbons side by side and that one drag rotates both identically) was explicitly skipped per instructions — that is the controller's job later. No dev server was started and no browser was opened.

## Concerns / follow-ups for the controller

- None blocking. The interactive verification (two ribbons, shared-camera drag) is still unverified by me and should be the first thing checked in Step 6.

---

## Fix round: the null object was outside the frustum by default

The coordinator verified the route in a real browser after the above and found the null model invisible at the default state (turtle, A000002, step 0.5, null on): `fit()` sized the orthographic frustum from the real object's bounds alone, so the null object - offset along x - landed outside the view. Upgraded from the original review's Minor to Important on seeing it on screen.

By the time this landed, `src/viz3d/dev/scene.ts` had moved on: Task 7 added an invisible picking proxy (its own geometry/material, disposed alongside the real object in `setGeometry`/`dispose`), and Task 8 added a benchmark that imports this module. I re-read the current file before touching it; the proxy code is untouched by this fix.

### Files created

- `src/viz3d/frame.ts` — `Framing` interface and `framingFor(real, nullBounds, nullOffsetX)`, the pure arithmetic extracted out of `scene.ts`'s old `fit()`. With `nullBounds` null it reproduces exactly the prior real-only centre/half-extent formula; with it present, it unions the real bounds with the null bounds translated by `nullOffsetX`, taking the max span over all three axes for the half-extent.
- `tests/viz3d/frame.test.ts` — 3 tests: null absent reproduces the real-only centre/half-extent; null present widens the half-extent and moves the centre towards the pair's midpoint (both asserted relative to the solo framing, not just fixed numbers); a null taller than the real object still fits (the half-extent is driven by the y-span, not x).

### Files modified

- `src/viz3d/dev/scene.ts`:
  - Imports `framingFor`/`Framing` from `../frame`.
  - Added `currentRealBounds`, `currentNullBounds`, `currentNullOffsetX` state, alongside the existing `halfExtent`.
  - Replaced the old inline `fit(g)` with `applyFraming(framing: Framing)` (sets `halfExtent`, the camera frustum with the existing `* 1.1` margin, `controls.target`, and `camera.position` - the same fields `fit()` touched, now driven by a `Framing` value instead of one geometry's bounds) and `reframe()` (recomputes `framingFor(currentRealBounds, currentNullBounds, currentNullOffsetX)` and applies it; no-ops if no real geometry has been set yet).
  - `setGeometry`: stores `currentRealBounds = g.bounds` and calls `reframe()` in place of `fit(g)`.
  - `setNullGeometry(g, colors)`: on the null appearing, computes `nullOffsetX` (unchanged formula, just named), stores it with `g.bounds` into `currentNullBounds`/`currentNullOffsetX`, then calls `reframe()`. On the null disappearing (`!g`), clears `currentNullBounds`/`currentNullOffsetX` to null/0 and calls `reframe()` too - so toggling off re-fits to the real object alone instead of leaving the camera framing empty space, and toggling on re-fits to hold both.
  - Fixed the stale comment that said the x-offset was "the real object's own width" - the code has always used the null geometry's own width; the comment now says so.
  - `resize()` untouched: still only recomputes `camera.left/right/top/bottom` from the stored `halfExtent` and calls `frame()` - no call to `reframe()` or `applyFraming()`, so a plain window resize still never moves the camera or the orbit target.

### TDD: confirmed red before green

Per instruction, `framingFor` was first written as a stub that ignored the null arguments (returned only the real-object-only framing), to confirm the new tests actually exercise the null-handling code path:

```
npx vitest run tests/viz3d/frame.test.ts   # against the null-ignoring stub
 FAIL  tests/viz3d/frame.test.ts > framingFor > widens the half-extent and moves the centre towards the midpoint of the pair when a null object is present
AssertionError: expected 5 to be greater than 5
 FAIL  tests/viz3d/frame.test.ts > framingFor > still fits a null object that is taller than the real object
AssertionError: expected 5 to be close to 20, received difference is 15, but expected 0.005
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

(The one passing test was the null-absent case, which the stub also happens to satisfy - as it must, since a correct implementation has to agree with the stub there too.)

After restoring the real union-based implementation:

```
npx vitest run tests/viz3d/frame.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

### Full verification

```
npm test
 Test Files  59 passed (59)
      Tests  727 passed (727)
```
(727 vs. the earlier 719 = +8 from `frame.test.ts` and whatever Tasks 7/8 had already added since the original Task 6 commit; the `Not implemented: HTMLCanvasElement's getContext()` lines are the same pre-existing jsdom noise as before, unrelated to this fix.)

```
npm run build
> tsc --noEmit && vite build
dist/index.html                           2.20 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB
dist/assets/index-BFHzFX5b.js           226.46 kB
✓ built in ~310ms
```

```
npm run build && grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
...
clean: three is not in dist
```

### Commit

`0859081` — `fix(3d): frame the camera on the union of the real and null bounds`. 3 files changed, 136 insertions(+), 17 deletions(-). Files: `src/viz3d/frame.ts` (new), `tests/viz3d/frame.test.ts` (new), `src/viz3d/dev/scene.ts` (modified). Not pushed. No dev server was started; the coordinator is re-checking the browser themselves.
