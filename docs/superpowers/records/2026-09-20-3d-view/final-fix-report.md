# Final whole-branch review — fix wave report

Branch `3d-view`. All 14 findings addressed in one wave.

## 1. `route.ts` b-file catch had no staleness check

Added `if (mine !== generation) return;` as the first statement in the
b-file `catch` block (`src/viz3d/dev/route.ts`), matching the existing guard
in the success branch right above it.

Test: `tests/viz3d/rebuild.test.ts` — new test `"drops a superseded
rebuild's b-file REJECTION, not just its resolution"`. Two requests, second
supersedes first; second's b-file resolves and draws; then the first's
b-file *rejects*. Asserts `calls` and `reports` still have length 1 (nothing
from the first request reached the scene or the reader). Confirmed this
fails without the guard by re-deriving the bug by hand: pre-fix, the catch
built a report unconditionally and fell through to
`onLoadReport`/`onSequence`/`setGeometry` regardless of generation.

## 2. `lookupById` rejection was unhandled

Wrapped the whole `rebuild` body in `try { … } catch (e) { if (mine !==
generation) return; onLoadError?.(...); }`. Added a 7th optional parameter
`onLoadError?: (message: string) => void` to `createRebuilder`. Wired in
`mount3dRoute` to write `couldn't load ${state.aNumber}: ${message}` into
the readout without touching the scene — the last object stays on screen,
per the spec's *Error handling* section.

Tests: `"reports a load failure (e.g. a typo'd A-number) instead of an
unhandled rejection"` and `"stays silent when a SUPERSEDED request's load
fails"` in `tests/viz3d/rebuild.test.ts`.

## 3. `devIsolation.test.ts` tripwire too narrow, and one-directional

- Widened `THREE_IMPORT` regex to also catch: `from 'three/src/…'` /
  `from 'three/examples/…'` (subpaths, either quote style), `import("three")`
  (double quotes), `require('three')`, and bare `import 'three'`.
- Added `importsDevDir()` + a new test: **no file outside
  `src/viz3d/dev/` may import from it**, except `src/main.ts`'s own
  DEV-guarded dynamic import (the existing "main.ts reaches the route only
  inside a DEV guard" test already pins that main.ts's one reference is
  guarded and unique; the new test pins that it's also the *only* file
  reaching in at all).

**Proof both new assertions can fail** (in the file itself, as tests, not
just asserted in this report):
- `"the widened three-import pattern catches forms the old narrower one
  missed"` — feeds 5 scratch strings (`from 'three/src/Three.js'`,
  `from "three/examples/…"`, `import("three")`, `require('three')`,
  `import 'three'`) through `THREE_IMPORT` and asserts each matches. Every
  one of these fails to match the OLD pattern
  (`/from 'three'|from "three"|import\('three'\)/`) — verified by hand by
  testing the old regex against the same 5 strings in a scratch node REPL:
  0/5 matched.
- `"importsDevDir flags a scratch file that reaches into dev/, and clears
  one that does not"` — a fabricated `src/ui/fake.ts` importing
  `'../viz3d/dev/scene'` is flagged `true`; the same file importing
  `'../viz3d/geometry'` is `false`. Pure path arithmetic, no real file
  needed.
- Also added `"does not flag an unrelated package whose name merely starts
  with 'three'"` (`threejs-utils`, `three-utils`) so the widened pattern
  isn't a false-positive machine either.

## 4. `deploy.sh` bundle guard only grepped `OrbitControls`

Changed to `grep -rlE "OrbitControls|THREE\." dist/`. Verified against the
real production bundle: `npm run build && grep -rlE "OrbitControls|THREE\."
dist/` → `clean: three is not in dist` (no false positive). Nothing else in
the script changed; no `--delete` added anywhere.

## 5. Ceiling warned after building, never confirmed, counted only one object

- New pure function `estimatedVertices(vizId, seq, params)` in
  `src/viz3d/budget.ts`: turtle `seq.length + 1`, polyarc
  `seq.length * segmentsFor(seq, opts) + 1`, digit walk
  `digitWalkOwners(seq, base).length + 1`, `0` for unsupported views.
  Test in `tests/viz3d/budget.test.ts` asserts it equals
  `geometryFor(...).termOf.length` exactly, for all three views, plus a
  case for the "no 3D meaning" return.
- `route.ts`'s `rebuild` now computes `perObject = estimatedVertices(...)`
  **before** calling `geometryFor`, doubles it when `state.nullOn` is true
  (`totalVertices = perObject * (state.nullOn ? 2 : 1)`), and when
  `overBudget(totalVertices) && !force`, returns without building —
  `onOverBudget?.({ vertices, state }, buildAnyway)` fires instead, where
  `buildAnyway` is a closure that calls `rebuild(state, true)`.
- `mount3dRoute` renders that as text (view/A-number/terms/±null model,
  vertex count, ceiling) plus a real `<button>` labelled "Build anyway" in
  the readout — **no `window.confirm`/`alert`/modal**.
- Generation token: the estimate runs synchronously right after the first
  staleness check with no intervening `await`, so it's covered by the same
  guard as everything else; `force=true` re-runs the whole rebuild (new
  generation) rather than mutating in place.
- Tests in `rebuild.test.ts`: `"counts BOTH objects toward the ceiling when
  the null model is on, and gates the build"` (600,000 terms: 600,001
  vertices alone is under the 1M ceiling, ×2 for the null model is over —
  proves the doubling fix specifically, since without it this case would
  slip through), `"does not gate the same term count with the null model
  off"`, and `"builds anyway when the offered confirm callback is invoked"`.

## 6. `geometry.test.ts` didn't pin xy for all three views

All three `it()` blocks (turtle, polyarc, digit walk) now assert both
`positions[i*3]` (x) and `positions[i*3+1]` (y) against `turtlePath` /
`polyarcPath` / `digitWalkPath` respectively, vertex for vertex. Digit walk
previously checked neither coordinate — now checks both.

## 7. `controls.ts` term count had no upper clamp

`emit({ terms: Math.min(100000, Math.max(2, Number(terms.value) || 2)) })`,
matching the input's `max="100000"`. Test added in `controls.test.ts`:
entering `5000000` clamps to `100000`.

## 8. `scene.ts` `dispose()` leaked the click listener and objects

`handleClick` is now a named function (was inline) so `dispose()` can
`canvas.removeEventListener('click', handleClick)`. `dispose()` now also
`scene.remove(...)`s each of `object`, `nullObject`, `proxy` before
disposing their geometry/material, and nulls every reference (`object`,
`material`, `nullObject`, `nullMaterial`, `proxy`, `proxyMaterial`,
`proxySource`, `currentTermOf`). No dedicated unit test — `scene.ts` has no
GPU in the test environment (per the existing repo convention: it is
smoke-tested by hand, not unit-tested) — verified by reading the resulting
code and by `npm test`/`npm run build` passing with no regressions to
`runBench`'s dispose-on-success/failure behavior.

## 9. `bench.ts` called `scene.resize()` in the frame loop

Added `render(): void` to the `Scene3D` interface (`scene.ts`), implemented
as a plain `frame()` call with no canvas-size reassignment. `bench.ts`'s
30-frame loop now calls `scene.render()` instead of `scene.resize()`.

## 10. `frame.ts`/`scene.ts` clipped the pair on narrow windows

New `frustumFor(halfExtent, aspect, margin = 1.1)` in `src/viz3d/frame.ts`:
scales the horizontal half-extent by `max(aspect, 1)` and the vertical by
`max(1/aspect, 1)`, so a wide window widens horizontally (as before) and a
narrow one widens vertically instead of shrinking the horizontal extent
below `halfExtent`. `scene.ts`'s `applyFraming()` and `resize()` both now
call this instead of the old `±halfExtent * aspect` one-sided formula.

Tests added in `frame.test.ts`: wide (aspect 2) widens horizontally with
vertical fixed at `halfExtent`; narrow (aspect 0.5) widens vertically with
horizontal fixed at `halfExtent` (and asserts neither axis ever drops below
`halfExtent`, which is exactly the old bug); square (aspect 1) is symmetric.

## 11. `scene.ts` never read `g.mode`

Extracted `buildDrawable(g, colors, plainColor)` inside `createScene`,
shared by `setGeometry` and `setNullGeometry`: builds `THREE.Points` +
`THREE.PointsMaterial` when `g.mode === 'points'`, `THREE.Line` +
`THREE.LineBasicMaterial` otherwise (unchanged behavior for `'lines'`,
which is all any current view produces). `object`/`material` and
`nullObject`/`nullMaterial` are now typed as the `Line | Points` /
`LineBasicMaterial | PointsMaterial` unions. `DrawMode` in `types.ts` is
untouched (`'lines' | 'points'` already present, for the deferred spectral
test). No GPU in the test env to unit-test the branch directly; `lift.test.ts`'s
existing `expect(g.mode).toBe('lines')` is now actually meaningful to a
consumer, since `scene.ts` reads it.

## 12. `docs/3d-measurements.md` mislabeled `setGeometry`

Rewrote the "What was measured" intro: it now says `setGeometry` uploads
the real object's buffers, decimates and uploads a second 20k-vertex
picking-proxy buffer (`decimate`/`MAX_PICK_VERTICES`), recomputes the camera
framing (`reframe`/`framingFor`), and renders one frame — not just "GPU
upload".

## 13. `docs/3d-smoke-check.md` claimed manual verification

Heading changed "Checks verified by hand" → "Checks verified on screen".
Intro paragraph reworded: these runs were driven through Chrome automation
in a hidden tab with synthetic pointer capture neutralised, confirmed by
reading back pixels/console/DOM, not a person at the keyboard. Check 5
("Orbit and zoom") reworded to say exactly how (synthetic pointerdown/move/up
+ wheel dispatch, camera-state and pixel readback, console check) instead of
"both respond smoothly with no console errors". The "Checks automation could
not settle" section is untouched, verbatim.

## 14. Spec doc missing depth fade from Deferred

Added a "Depth fade" bullet to *Deferred, with what it would cost* in
`docs/superpowers/specs/2026-09-19-3d-view-design.md`: named in
*Architecture*/staged for stage 3, not built, and not worth building blind
without a visible tab to judge whether it reads as depth rather than just
dimming.

## Commands run

```
$ npm test
Test Files  59 passed (59)
     Tests  746 passed (746)

$ npm run build
[tsc --noEmit: no errors]
✓ built in 318ms

$ npm run build && grep -rlE "OrbitControls|THREE\." dist/ || echo "clean: three is not in dist"
clean: three is not in dist
```

## Judgment calls

- `createRebuilder`'s new parameters (`onLoadError` as a 7th positional arg,
  `rebuild`'s new optional `force` second parameter, `onOverBudget`'s
  signature change from `(vertices) => void` to
  `(info: OverBudgetInfo, buildAnyway: () => void) => void`) are breaking
  changes to that function's shape. No caller outside `route.ts` and
  `rebuild.test.ts` exists, so this was judged safe rather than adding a
  parallel API.
- "Build anyway" re-runs the *entire* rebuild (re-fetches the sequence and
  b-file if needed) rather than caching and resuming from the already-loaded
  data. Simpler, and correctly generation-safe by construction (it's just
  another call to `rebuild`), at the cost of a redundant network fetch in
  the confirm path — judged an acceptable trade for a dev-only tool.
- Left `docs/3d-smoke-check.md`'s "A known limit, not a defect" section
  unedited even though the ceiling behavior it describes changed from
  "warns after" to "gates before" — its actual claims (can't be triggered by
  hand at default params, exercised only by unit test) remain true, and it
  wasn't in the numbered findings.
- Did not add a dedicated automated test for `scene.ts`'s dispose/mode
  changes (findings 8, 11) beyond code review + the full suite passing —
  `scene.ts` has no GPU in the test environment, consistent with this
  repo's existing convention that it's smoke-tested by hand, not unit-tested.

## Commit(s)

`2221313` — "fix(3d): close six review gaps and fix six more in the same
wave" — one commit covering all 14 findings plus tests and docs
(16 files changed, 685 insertions, 123 deletions). Not pushed.
