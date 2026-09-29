# Task 7 report: picking on click

## Files created
- `src/viz3d/pick.ts` — `decimate(g, maxVertices)`, transcribed verbatim from the brief's Step 3.
- `tests/viz3d/pick.test.ts` — transcribed verbatim from the brief's Step 1 (3 tests).

## Files modified
- `src/viz3d/dev/scene.ts`
- `src/viz3d/dev/route.ts`

## Commands and output

`npx vitest run tests/viz3d/pick.test.ts` before writing `pick.ts`:
```
FAIL  tests/viz3d/pick.test.ts [ tests/viz3d/pick.test.ts ]
Error: Cannot find module '../../src/viz3d/pick' imported from .../tests/viz3d/pick.test.ts
```
Confirmed failing for the right reason (missing module), not a logic error.

`npx vitest run tests/viz3d/pick.test.ts` after writing `pick.ts`:
```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

`npm test` (whole suite) after wiring `scene.ts`/`route.ts`:
```
Test Files  57 passed (57)
     Tests  722 passed (722)
```
(jsdom prints repeated "Not implemented: HTMLCanvasElement's getContext()" warnings during the run — pre-existing jsdom noise from canvas-touching tests elsewhere, not failures; exit was green.)

`npm run build`:
```
tsc --noEmit && vite build
✓ 61 modules transformed.
dist/assets/index-BFHzFX5b.js  226.46 kB │ gzip: 88.03 kB
✓ built in 334ms
```
Typecheck clean, and the bundle size/module count shows `three` still isn't reaching the shipped build (`tests/viz3d/devIsolation.test.ts` also re-run alone and passed, confirming `pick.ts` has no `three` import and only `scene.ts` does).

## Commit
`ae0e7f6` — `feat(3d): pick a term by clicking a strand` (plus the required attribution lines). Files staged: `src/viz3d/pick.ts`, `src/viz3d/dev/` (route.ts, scene.ts), `tests/viz3d/pick.test.ts`. Not pushed.

## Design decisions

**Pick-reporting shape: optional callback argument.** `createScene(canvas, onPick?: (term: number) => void)`. Chosen over a settable property because it's exactly what the brief's Step 5 sketch already shows (`createScene(canvas, onPick)`), it needs no extra mutation API on `Scene3D`, and making it the second positional parameter (rather than adding it to the `Scene3D` interface) means the interface itself — and every existing/future caller that only wants to draw — is untouched. It's optional so `createScene(canvas)` alone still type-checks (no existing call site or test constructs `Scene3D` any other way; grepped the whole repo, only `route.ts` calls `createScene`).

**Proxy construction/disposal.** In `setGeometry`, before building the new `THREE.Line`, any existing proxy is disposed (`proxy.geometry.dispose()` **and** `proxyMaterial?.dispose()`) and removed from the scene, mirroring exactly the real object's own dispose-then-replace block immediately above it — this is the pattern the brief points at ("the kind of leak an earlier review already caught in this file": commit `92888bf` originally disposed only the line's geometry and leaked its `LineBasicMaterial`). A fresh proxy is then built via `decimate(g, 20_000)`, wrapped in `THREE.BufferGeometry` + `THREE.PointsMaterial`, set `visible = false`, and added to the scene (added, not left detached, so `updateMatrixWorld` keeps its world matrix current for raycasting — verified against `node_modules/three/src/core/Raycaster.js` that `intersect()` does not itself check `object.visible`, so an invisible object is still raycastable; the flag only suppresses rendering, which is exactly the behavior wanted). `dispose()` on the whole scene also disposes `proxy.geometry` and `proxyMaterial` alongside `object`/`material` and `nullObject`/`nullMaterial`.

**Only the real object is pickable.** No proxy is ever built for `nullObject`/`setNullGeometry`; the click handler raycasts only against the single `proxy` tied to the real object. A click over the null-model panel simply produces no `hit` (different `THREE.Points` object, generally offset in x from the real one) and is silently ignored, per the brief's "otherwise ignore clicks on it."

**No hover listener.** `scene.ts` registers exactly one DOM listener, `canvas.addEventListener('click', ...)`, added once at `createScene` time (not per `setGeometry`). Grepped the diff and the file for `pointermove`/`mousemove`/`mouseover`: none exist. Nothing is recomputed on cursor motion; the raycast and its `Points.threshold` computation happen only inside the click handler.

**WebGL guard and generation token.** Both untouched in meaning. `route.ts`'s `try { scene = createScene(canvas, onPick) } catch { ... }` keeps the exact original sentence ("This browser has no WebGL context, so the 3D tool cannot run. The engine is unaffected.") and structure — only the `createScene` argument list grew. `createRebuilder`'s generation-token staleness check (`if (mine !== generation) return;`) is unchanged and now also guards the new `onSequence?.(seq)` call (added right after that check, alongside the existing `setGeometry`/`setNullGeometry` calls), so a stale rebuild's fetch resolving late still cannot touch `seqRef` any more than it can touch the scene.

**Readout wiring (not fully specified by the brief — my call).** The brief's Step 5 prose left `seqRef` undefined and only sketched the callback body as a comment. To resolve a picked term index to its printed value without duplicating the fetch/generation logic, I added a third, optional parameter to `createRebuilder`: `onSequence?: (seq: SequenceView) => void`, invoked with the real `SequenceView` right after it's constructed (and after the staleness check), once per winning rebuild. `mount3dRoute` keeps a local `let seqRef: SequenceView | undefined` set by this hook, and the `createScene` pick callback reads it: `` `term ${term} = ${seqRef.term(term)}` `` (falling back to `` `term ${term}` `` before the first sequence has loaded). This is additive — `createRebuilder(scene, loader)` two-argument calls (used by `tests/viz3d/rebuild.test.ts`) are unaffected since the new parameter is optional and trailing. The readout `<div class="readout3d">` is created before `createScene` (so the callback can close over it) but only `appendChild`'d to `root` after the WebGL guard passes and alongside the controls, at `position:fixed;right:12px;bottom:12px`, i.e. the opposite corner from the controls (`left:12px;top:12px`), so it never overlaps them.

## Skipped interactive step
Step 6 ("`npm run dev`, `?3d`, click on a strand...") was **not** run, per the task instructions — no dev server was started and no browser was opened. That hands-on check is left to the controller.

## Concerns / things worth a second look
- `PointsMaterial` is constructed with no options (default size); it doesn't matter visually since the proxy is invisible, but if a future task ever needs to debug-render the proxy, its default point size may need setting explicitly.
- The readout's fallback text (`term ${term}` with no value) only shows before the very first `rebuild()` resolves, which given `mount3dRoute` awaits `rebuild(state)` at startup and `onPick` can't fire before the scene/proxy exist, should in practice never be visible — kept as a defensive fallback rather than a non-null assertion.
