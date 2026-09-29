# Task 3 Report: dev route, three.js, and the bundle guards

Branch: `3d-view`
Commit: `b5f94bce355e484b3052a2d6262891f6b2ddb280`

## Files created

- `src/viz3d/dev/scene.ts` — transcribed verbatim from the brief's Step 4.
- `src/viz3d/dev/route.ts` — transcribed from the brief's Step 5, **plus** the
  WebGL try/catch soft-failure guard specified in the task instructions
  (not present in the brief's own code block — see "Decisions not specified
  by the brief" below).
- `tests/viz3d/devIsolation.test.ts` — transcribed verbatim from the brief's
  Step 2.

## Files modified

- `src/main.ts` — added the dev-only 3D block directly below the existing
  `?ogcard` block, verbatim from the brief's Step 6.
- `package.json` / `package-lock.json` — `three` and `@types/three` added to
  `devDependencies` only (confirmed below).
- `scripts/deploy.sh` — added the exact guard from the brief's Step 9,
  immediately before the `aws s3 sync` line. No other line in the file was
  touched; `--delete` was not added anywhere.

## Order of work and exact command output

### Step 1 — install three as a devDependency

```
npm install --save-dev three @types/three
```
Output: `added 8 packages, and audited 95 packages in 2s` (plus an unrelated
npm audit notice: 3 vulnerabilities, 2 moderate/1 high, pre-existing in the
dependency tree, not investigated — out of scope for this task).

Verification://
```
node -e "const p=require('./package.json');console.log('deps',p.dependencies,'dev',Object.keys(p.devDependencies))"
```
```
deps undefined dev [
  '@types/node', '@types/three',
  'jsdom',       'three',
  'typescript',  'vite',
  'vitest'
]
```
Confirmed: `dependencies` is undefined (there never was one), `three` and
`@types/three` landed only in `devDependencies`.

### Step 2/3 — write the isolation test, confirm it fails for the right reason

```
npx vitest run tests/viz3d/devIsolation.test.ts
```
Result before `main.ts` was wired: 1 passed / 1 failed, with the failure:
```
AssertionError: main.ts does not reference the 3D route: expected undefined to be truthy
```
This is exactly the expected failure from the brief's Step 3. The first test
("only files under src/viz3d/dev/ import three") already passed at this
point since no source file imported `three` yet.

### Step 4/5/6 — scene.ts, route.ts, main.ts wiring

Written as described above.

### Step 7 — isolation test + full suite, after wiring

```
npx vitest run tests/viz3d/devIsolation.test.ts
```
```
Test Files  1 passed (1)
     Tests  2 passed (2)
```

```
npm test
```
```
Test Files  52 passed (52)
     Tests  704 passed (704)
```
Console noise during the run ("Not implemented: HTMLCanvasElement's
getContext() method: without installing the canvas npm package") is
pre-existing jsdom behavior from `src/ui/app.ts`, `exportImage.ts`,
`landing.ts`, `ogCard.ts`, `sweep.ts` and `tests/ui/ui.test.ts` — confirmed
by grep, unrelated to `viz3d/dev/`, and present before this task's changes.

### Step 8 — build + bundle check

```
npm run build
```
```
tsc --noEmit  (passed, no output)
vite v8.2.0 building client environment for production...
✓ 61 modules transformed.
dist/index.html                           2.20 kB │ gzip:  0.83 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB │ gzip:  5.04 kB
dist/assets/index-BFHzFX5b.js           226.46 kB │ gzip: 88.03 kB
✓ built in 315ms
```

```
npm run build && grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
```
```
clean: three is not in dist
```
Matches the brief's expected output exactly.

### Step 9 — deploy guard

Diff of `scripts/deploy.sh` (only change in the file):
```diff
+if grep -rq "OrbitControls" dist/; then
+  echo "refusing to deploy: three.js reached dist/ (the 3D tool is dev-only)" >&2
+  exit 1
+fi
 aws s3 sync dist/ "s3://$BUCKET/" --exclude "$INDEX_KEY" --only-show-errors
```
No `--delete` added anywhere; nothing else in the file touched.

### Step 10 — interactive check

**Skipped by instruction.** Was told not to run `npm run dev` or open a
browser (port collision with another project; the controller will do the
interactive check later with browser tooling). Note: the brief's Step 10
text says to open `http://localhost:5179/?3d`, but nothing in this repo's
`package.json`/`vite.config` pins the dev server to port 5179 — Vite's
default is 5173. Flagging this as a discrepancy in the brief for the
controller to check when it does the interactive step; not corrected here
since Step 10 was explicitly out of scope for this run.

### Step 11 — commit

```
git add package.json package-lock.json src/main.ts src/viz3d/dev tests/viz3d/devIsolation.test.ts scripts/deploy.sh
git commit -m "feat(3d): dev-only route with a three.js scene, fenced off from the bundle" (+ attribution trailers per session instructions)
```
Result:
```
[3d-view b5f94bc] feat(3d): dev-only route with a three.js scene, fenced off from the bundle
 7 files changed, 236 insertions(+), 1 deletion(-)
 create mode 100644 src/viz3d/dev/route.ts
 create mode 100644 src/viz3d/dev/scene.ts
 create mode 100644 tests/viz3d/devIsolation.test.ts
```
Full SHA: `b5f94bce355e484b3052a2d6262891f6b2ddb280`
Not pushed.

## Anything questionable in the brief

- Step 10's port number (5179) does not match this repo's apparent Vite
  default (5173); likely a brief inconsistency or leftover from a different
  project's config. Not corrected, since Step 10 was explicitly skipped.
- The brief's `route.ts` code block (Step 5) does not itself include the
  WebGL try/catch that the plan's self-review calls out as required — it had
  to be added on top of the brief's verbatim code, per this task's explicit
  instructions. Everything else in `route.ts` matches the brief exactly.
- Everything else in the brief was internally consistent and matched the
  committed Task 1/2 interfaces (`Geometry3D`, `liftPath`, `geometryFor`,
  `SUPPORTED_3D`) without needing any adjustment.

## Decisions not specified by the brief

- The WebGL failure guard: wrapped only the synchronous `createScene(canvas)`
  call in try/catch (three.js's `WebGLRenderer` constructor throws
  synchronously when it cannot acquire a WebGL context). On catch, `root`'s
  children are replaced with a single `<p>` containing exactly: "This browser
  has no WebGL context, so the 3D tool cannot run. The engine is unaffected."
  and the function returns before touching `scene.resize()`, the resize
  listener, or fetching the sequence — since none of that is needed or safe
  to run without a working scene.
- Left the `let scene;` variable without an explicit type annotation in
  `route.ts` since TypeScript infers it correctly from `createScene`'s return
  type (`Scene3D`); `tsc --noEmit` confirmed no type errors.

## Final verification snapshot

- `npx vitest run tests/viz3d/devIsolation.test.ts` — 2/2 passed.
- `npm test` — 704/704 passed across 52 files.
- `npm run build` — succeeds (`tsc --noEmit` clean, Vite build clean).
- Bundle check — prints `clean: three is not in dist`.
- `git status` after commit — clean, nothing left uncommitted from this task.

## Fix round 1 (post-review)

Commit: `92888bf3208eb177e416205908d2162deaea2bcf`

Review found three Important findings, all in code the brief specified
verbatim (transcription was correct; the brief's own code was wrong). Files
covering each fix:

- `src/viz3d/dev/scene.ts` — Findings 1 and 2.
- `tests/viz3d/devIsolation.test.ts` — Finding 3.

### Finding 1 — resize() didn't recompute the orthographic frustum

`resize()` previously called only `renderer.setSize(...)`, leaving
`camera.left/right/top/bottom` at whatever aspect `fit()` last computed, so
the picture stretched non-uniformly on window resize.

Fix: added a module-level `let halfExtent = 1;`, set inside `fit()` (`halfExtent = half;`)
right after `half` is computed. `resize()` now recomputes the frustum from
the current canvas aspect and the remembered `halfExtent`, using the same
`1.1` padding factor `fit()` uses, then calls `camera.updateProjectionMatrix()`:

```ts
resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  camera.left = -halfExtent * aspect * 1.1;
  camera.right = halfExtent * aspect * 1.1;
  camera.top = halfExtent * 1.1;
  camera.bottom = -halfExtent * 1.1;
  camera.updateProjectionMatrix();
  frame();
},
```

`resize()` does not call `fit()` and does not touch `camera.position` or
`controls.target`, per the instruction — so a viewer's chosen orbit angle
survives a resize.

### Finding 2 — LineBasicMaterial was never disposed

`setGeometry` created a fresh `THREE.LineBasicMaterial` on every call (local
`const material`, not kept anywhere), and neither `setGeometry` nor
`dispose()` disposed it, leaking GPU resources on repeated calls and on
teardown.

Fix: promoted `material` to a module-level `let material: THREE.LineBasicMaterial | null = null;`
alongside `object`. `setGeometry` now disposes the previous material next to
disposing the previous geometry, before creating the new one:

```ts
if (object) {
  object.geometry.dispose();
  material?.dispose();
  scene.remove(object);
}
...
material = new THREE.LineBasicMaterial({ ... });
object = new THREE.Line(geometry, material);
```

and `dispose()` disposes the last material as well as the last geometry:

```ts
dispose() {
  controls.dispose();
  object?.geometry.dispose();
  material?.dispose();
  renderer.dispose();
},
```

### Finding 3 — the DEV-guard test didn't actually guard

The old assertion sliced `main.ts` up to the first occurrence of
`viz3d/dev/route` and checked that `import.meta.env.DEV` appeared anywhere
in that prefix. The pre-existing `?ogcard` block (lines 6-11 of `main.ts`)
already contains `import.meta.env.DEV`, so the test passed regardless of
whether the 3D import was actually inside its own guard — an unconditional
`void import('./viz3d/dev/route')...` placed anywhere after line 11 would
still have passed.

Fix: replaced the slice-and-suffix-match with a single regex that requires
the dynamic import to appear textually inside an `if (import.meta.env.DEV ...) { ... }`
block:

```ts
expect(main).toMatch(/if \(import\.meta\.env\.DEV[\s\S]{0,200}?\{[\s\S]{0,400}?import\('\.\/viz3d\/dev\/route'\)/);
```

Verified the tripwire actually trips, with a scratch Node check (not
committed) rather than mutating `main.ts` itself:

```js
const good = `if (import.meta.env.DEV && new URLSearchParams(location.search).has('3d')) {
  void import('./viz3d/dev/route').then((m) => m.mount3dRoute(document.querySelector('#app')));
}`;
const bad = `void import('./viz3d/dev/route').then((m) => m.mount3dRoute(document.querySelector('#app')));
if (import.meta.env.DEV) { console.log('unrelated'); }`;
const re = /if \(import\.meta\.env\.DEV[\s\S]{0,200}?\{[\s\S]{0,400}?import\('\.\/viz3d\/dev\/route'\)/;
re.test(good) // -> true
re.test(bad)  // -> false
```

`good` matched (true), `bad` — the import unconditional, with an unrelated
DEV guard elsewhere in the file — did not match (false). The tripwire trips.
The first test in the file (three-import isolation) was left unchanged, as
instructed.

### Commands run after the fixes, and their output

```
npx vitest run tests/viz3d/devIsolation.test.ts
```
```
Test Files  1 passed (1)
     Tests  2 passed (2)
```

```
npm test
```
```
Test Files  52 passed (52)
     Tests  704 passed (704)
```
(Same pre-existing jsdom `getContext()` console noise as before, unrelated
to `viz3d/dev/`.)

```
npm run build
```
```
tsc --noEmit  (clean)
vite v8.2.0 building client environment for production...
✓ 61 modules transformed.
✓ built in 313ms
```

```
npm run build && grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
```
```
clean: three is not in dist
```

### Commit

```
git add src/viz3d/dev/scene.ts tests/viz3d/devIsolation.test.ts
git commit -m "fix(3d): resize the ortho frustum, dispose the line material, tighten the DEV-guard test" (+ body + attribution trailers)
```
```
[3d-view 92888bf] fix(3d): resize the ortho frustum, dispose the line material, tighten the DEV-guard test
 2 files changed, 19 insertions(+), 3 deletions(-)
```
Full SHA: `92888bf3208eb177e416205908d2162deaea2bcf`
Not pushed. `git status` after commit: clean.

## Fix round 2 (finding 3 was still open after round 1)

Commit: `75503645e9c2ec82cae65bef997e098ea701d8d7`

Re-review ran the round-1 regex
(`/if \(import\.meta\.env\.DEV[\s\S]{0,200}?\{[\s\S]{0,400}?import\('\.\/viz3d\/dev\/route'\)/`)
against constructed variants of `src/main.ts` and found it still passes on
the exact regression it exists to catch: with the pre-existing `?ogcard`
guard block above, `[\s\S]{0,400}?` can cross that block's closing `}` and
match an unguarded `import('./viz3d/dev/route')` sitting ~218 characters
later, outside any guard. A wildcard-with-distance-cap cannot express
"inside this specific block"; only brace matching can.

Fix, in `tests/viz3d/devIsolation.test.ts`:

- Added a `devGuardedBlocks(source)` helper that finds every
  `if (import.meta.env.DEV ...` occurrence and brace-matches forward from
  its `{` to the matching `}`, returning each block's body text.
- The `main.ts` test now asserts two things instead of the old regex:
  1. `devGuardedBlocks(main).some((b) => b.includes("import('./viz3d/dev/route')"))` is `true`
     — the import textually appears inside a brace-matched DEV block body.
  2. `main.split('viz3d/dev/route').length - 1 === 1` — the reference to the
     route module appears exactly once in the file, so a second, unguarded
     copy elsewhere can't slip past check 1.
- Added a third test, `'the guard check itself trips when the import escapes its block'`,
  that runs `devGuardedBlocks` against the fixture
  `"if (import.meta.env.DEV && a) { void import('./ui/ogCard'); }\nvoid import('./viz3d/dev/route');\n"`
  and asserts the helper does **not** find `viz3d/dev/route` inside any
  block body — proving the check can fail before trusting that it passes
  (per the repo's "a test that passes before the fix is worth nothing"
  standard).
- The first test (`'only files under src/viz3d/dev/ import three'`) was left
  untouched, as instructed — confirmed unchanged in the diff.

Before committing, sanity-checked `devGuardedBlocks` with a scratch Node
script (not committed) against a string reproducing the exact regression
the re-reviewer described — the real `?ogcard` block followed by an
unguarded `viz3d/dev/route` import further down:

```
blocks: [ "\n  void import('./ui/ogCard').then((m) => m.exportOgCard());\n" ]
caught escape (should be false/failing): false
unique-occurrence count: 1
```

The route import is absent from every returned block body, so
`blocks.some(...)` is `false` for that input — the new assertion would fail
on the regression, as required, whereas the round-1 regex passed it.

### Commands run after the fix, and their output

```
npx vitest run tests/viz3d/devIsolation.test.ts
```
```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

```
npm test
```
```
Test Files  52 passed (52)
     Tests  705 passed (705)
```
(705, up from 704 in round 1 — the new tripwire test. Same pre-existing
jsdom `getContext()` console noise as before, unrelated to `viz3d/dev/`.)

```
npm run build
```
```
tsc --noEmit  (clean)
vite v8.2.0 building client environment for production...
✓ 61 modules transformed.
✓ built in 311ms
```

### Commit

```
git add tests/viz3d/devIsolation.test.ts
git commit -m "fix(3d): replace the DEV-guard regex with a brace-matched structural check" (+ body + attribution trailers)
```
```
[3d-view 7550364] fix(3d): replace the DEV-guard regex with a brace-matched structural check
 1 file changed, 33 insertions(+), 4 deletions(-)
```
Full SHA: `75503645e9c2ec82cae65bef997e098ea701d8d7`
Not pushed. `git status` after commit: clean. Only
`tests/viz3d/devIsolation.test.ts` changed in this round; `src/main.ts` and
`src/viz3d/dev/scene.ts` were untouched.
