# Task 5 report: colour by index, and the depth fade

## Fix round 1 (post-review)

### Finding
`parseCssColor` in `src/viz3d/colors.ts` (code the brief gave verbatim) claimed `hsl(h, s%, l%)` was the only form `strokeColorAt` returns. It is not: `blackLine: true` returns `'#000000'`, and `colorMode: 'none'` returns `canvasTheme().muted`, a hex string (`'#9aa0aa'` for the default dark palette — see `src/viz/style.ts` lines 107-120 and `src/viz/theme.ts`). The old regex `/[\d.]+/g` pulled `["000000"]` out of `#000000` and `["9","0"]` out of `#9aa0aa` — fewer than three groups either way — so both silently fell through to the `[255, 255, 255]` fallback: a style bug would render as an invisible white vertex.

### Fix
Rewrote `parseCssColor` in `src/viz3d/colors.ts` to:
- match `hsl(h, s%, l%)` explicitly via an anchored regex with three capture groups (as before, just no longer just scraping loose digits);
- match `#rrggbb` and the short `#rgb` form and convert directly;
- **throw** `Error('parseCssColor: unrecognised colour string from strokeColorAt: ' + css)` for anything else, rather than returning a fallback colour — deliberate, since a dev tool silently drawing white is worse than a stack trace.

Rewrote the doc comment above it to state the three forms it actually accepts and why unrecognised input throws, replacing the false "only form" claim.

### Test coverage decision
Per the instruction to drive the regression tests through the real `strokeColorAt` "where you can": I checked `src/viz/theme.ts` — `canvasTheme()` is pure module state (a `let current: CanvasPalette` variable with a getter/setter), with no `window`/`document` access anywhere in the file. So no jsdom is needed; the existing `tests/viz3d/colors.test.ts` already runs under this repo's default `environment: 'node'` (`vite.config.ts`), and both new tests call the real `strokeColorAt`/`canvasTheme()` directly in that same file rather than needing a separate `// @vitest-environment jsdom` file.

Added two tests to `tests/viz3d/colors.test.ts`:
- `'blackLine forces pure black for every vertex'` — calls `colorsFor(geometry, 3, { ...DEFAULT_STYLE, blackLine: true })` and asserts every byte is `0`.
- `"colorMode 'none' gives the theme's muted grey for every vertex, not white"` — calls `colorsFor(geometry, 3, { ...DEFAULT_STYLE, colorMode: 'none' })`, and checks every vertex's RGB equals `canvasTheme().muted` decoded by a small `hexToRgb` helper written independently in the test file (not reusing `parseCssColor`), plus an explicit `not.toEqual([255, 255, 255])` assertion.

### Before-fix failure (evidence the tests are real)
Ran `npx vitest run tests/viz3d/colors.test.ts` with the two new tests added but *before* touching `parseCssColor`:

```
 ❯ tests/viz3d/colors.test.ts (5 tests | 2 failed) 9ms
     × blackLine forces pure black for every vertex 4ms
     × colorMode 'none' gives the theme's muted grey for every vertex, not white 1ms

 FAIL  tests/viz3d/colors.test.ts > colorsFor > blackLine forces pure black for every vertex
AssertionError: expected 255 to be +0 // Object.is equality
- Expected: 0
+ Received: 255
 ❯ tests/viz3d/colors.test.ts:47:25

 FAIL  tests/viz3d/colors.test.ts > colorsFor > colorMode 'none' gives the theme's muted grey for every vertex, not white
AssertionError: expected 255 to be 154 // Object.is equality
- Expected: 154
+ Received: 255
 ❯ tests/viz3d/colors.test.ts:57:29

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
```

Both failures are exactly the white-fallback bug the finding named (154 is the red byte of `#9aa0aa`; 0 is pure black). Confirms the tests pin the real bug rather than passing vacuously.

### After-fix verification
- `npx vitest run tests/viz3d/colors.test.ts` → `Test Files 1 passed (1)`, `Tests 5 passed (5)`.
- `npm test` → `Test Files 55 passed (55)`, `Tests 715 passed (715)` (up from 713; the jsdom `getContext` warnings are the same pre-existing, benign `devIsolation.test.ts` noise as in the original task-5 run).
- `npm run build` → `tsc --noEmit && vite build` succeeded, same output artifacts as before (`dist/index.html`, `ensembleWorker-*.js`, `index-*.css`, `index-*.js`), `✓ built in 328ms`.

### Files touched this round
- `src/viz3d/colors.ts` — `parseCssColor` rewritten (hsl/hex6/hex3 explicit parsing, throw on anything else) and its doc comment corrected.
- `tests/viz3d/colors.test.ts` — added two regression tests plus a `hexToRgb` reference helper and top-level imports of `DEFAULT_STYLE` (`../../src/viz/style`) and `canvasTheme` (`../../src/viz/theme`).

### Commit
`e10fe170b22affa8546cacb88f7556127ca86a49` on branch `3d-view`, message `fix(3d): parseCssColor handles hex forms instead of silently returning white`. Not pushed. `npm run dev` was not started.

---


## Status: complete, all tests and build green. Committed, not pushed.

## Files created
- `src/viz3d/colors.ts` — `colorsFor(g, terms, style = DEFAULT_STYLE)`, transcribed verbatim from the brief's Step 3. Per-vertex RGB via `strokeColorAt`, cached per term, `parseCssColor` HSL->RGB helper.
- `tests/viz3d/colors.test.ts` — transcribed verbatim from the brief's Step 1, with two corrections:
  1. The brief-flagged one: the third test is `it('...', async () => { ... })` so the `await import(...)` is legal.
  2. Not flagged by the brief, forced by this repo's `tsconfig.json` (`noUncheckedIndexedAccess: true`): `expected.match(/[\d.]+/g)!.map(Number)` returns `number[]`, not a 3-tuple, so destructuring `[h, s, l]` and passing them to `hslToRgb(h, s / 100, l / 100)` failed `tsc --noEmit` with TS2345/TS18048 ("possibly undefined"). Fixed with `as [number, number, number]` on that one line — same non-null-assertion idiom the rest of the codebase already uses (e.g. `g.termOf[i]!`), not a behavior change.

## Files modified
- `src/viz3d/dev/scene.ts`:
  - `Scene3D.setGeometry` widened to `setGeometry(g: Geometry3D, colors?: Uint8Array): void`.
  - Inside `setGeometry`, after setting the `position` attribute: if `colors` is supplied, `geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true))` (the `true` normalises bytes 0-255 to 0-1 in the shader, kept as instructed).
  - Material construction switched to `vertexColors: Boolean(colors)`, `color: colors ? 0xffffff : 0x7fd4ff` (white tint so vertex colours show true; falls back to the original cyan-ish flat colour when no colours are given), keeping `depthTest: false, transparent: true, opacity: 0.9` unchanged.
  - Everything else in the file — the module-level `material` variable disposed both at the top of `setGeometry` (before building the new geometry/material) and in `dispose()`, and the `halfExtent`-driven frustum recompute in `resize()` — was left untouched; I only inserted the colour attribute and expanded the material config in place, without touching the disposal or resize logic.
- `src/viz3d/dev/route.ts`:
  - Added `import { colorsFor } from '../colors';`.
  - Changed the one call site inside `createRebuilder`'s returned `rebuild` function: `if (geometry) scene.setGeometry(geometry, colorsFor(geometry, seq.length));` (used `seq.length`, the actual sliced-term count on the `SequenceView`, rather than a variable named `seq.length` in the brief's stale snippet, which is the same thing but confirmed against `src/sequence/sequence.ts`'s `SequenceView.get length()`).
  - The WebGL `try { scene = createScene(canvas) } catch { ... }` guard remains the first thing that runs after canvas creation, unchanged and untouched.
  - The request-generation token (`let generation = 0`, `const mine = ++generation`, `if (mine !== generation) return`) is unchanged; colours are computed only after that staleness check passes, inside the same `if (geometry)` branch that used to call `setGeometry` with one argument.

## Order followed
1. Wrote `tests/viz3d/colors.test.ts` (with the async correction).
2. Ran `npx vitest run tests/viz3d/colors.test.ts` — failed as expected: `Cannot find module '../../src/viz3d/colors'`.
3. Wrote `src/viz3d/colors.ts` verbatim from the brief.
4. Ran the test again — 3/3 passed.
5. Wired colours through `scene.ts` and `route.ts` as described above.
6. Ran `npm test` — 55 files / 713 tests passed (jsdom prints benign `Not implemented: HTMLCanvasElement's getContext()` warnings from the pre-existing `devIsolation.test.ts`, not failures).
7. Ran `npm run build` — first attempt failed `tsc --noEmit` on the test file's tuple destructuring (see correction #2 above); fixed with an `as [number, number, number]` cast; re-ran — `tsc --noEmit && vite build` both succeeded.
8. Re-ran the colors test and full suite once more post-fix to confirm nothing regressed: still 3/3 and 713/713.
9. Committed exactly `src/viz3d/colors.ts src/viz3d/dev tests/viz3d/colors.test.ts` with the brief's exact commit message plus the required attribution trailer.

## Commit
`6a9377849a5a94bfa41df7cb108054b4ea3776fd` on branch `3d-view`, message `feat(3d): colour by index, from the 2D hue ramp`. Not pushed.

## Skipped step
Step 6 (the `npm run dev` / `?3d` hand-check) was explicitly skipped per instructions — that interactive verification is the controller's job later.

## Decisions the brief didn't specify
- Material `color` tint when vertex colours are present: used `0xffffff` (as the brief's Step 5 snippet literally showed) so `vertexColors` renders the true per-vertex hue without a tint multiplying it.
- The one genuine TS strictness fix (`as [number, number, number]`) described above — necessary for `npm run build` to pass under this repo's `noUncheckedIndexedAccess: true`, which the brief's snippet (written before being run through this repo's `tsc`) didn't account for. This only affects the test file's local destructuring; `colorsFor`'s own `parseCssColor` was unaffected because its `[h, s, l]` comes from an inline 3-element array literal, which TypeScript already infers as a tuple in that position.
- Used `seq.length` (the `SequenceView` accessor) rather than any raw array, confirmed against `src/sequence/sequence.ts`.

## Commands run and exact output (summarized)
- `npx vitest run tests/viz3d/colors.test.ts` (before colors.ts existed): `FAIL ... Cannot find module '../../src/viz3d/colors'`.
- `npx vitest run tests/viz3d/colors.test.ts` (after colors.ts): `Test Files 1 passed (1)` / `Tests 3 passed (3)`.
- `npm test`: `Test Files 55 passed (55)` / `Tests 713 passed (713)`.
- `npm run build`: first run — `tsc --noEmit` errors TS2345/TS18048 at the test's tuple destructuring line; second run after the cast fix — `tsc --noEmit && vite build` succeeded, emitted `dist/index.html`, `dist/assets/ensembleWorker-*.js`, `dist/assets/index-*.css`, `dist/assets/index-*.js`, `✓ built in 309ms`.
