# Task 9 report

## Scope

Documentation only: created `docs/3d-smoke-check.md`. No source changed. Did
not start a dev server or open a browser, per instructions — everything in
the doc is transcribed from the controller's dispatch (facts already
established by hand) plus source-verified detail I confirmed by reading code
and static data, not by running anything live.

## What the doc covers

- **Setup**: `npx vite --port 5179 --strictPort` and
  `http://localhost:5179/?3d`, with the reason (`npm run dev`'s default port
  5173 is occupied by another project) and a note that `?3d` replaces the
  whole page rather than coexisting with the normal engine UI.
- **Checks verified by hand** (six numbered checks, written as steps a reader
  repeats):
  1. It draws (baseline sanity).
  2. Canonical zero — includes exact side-by-side instructions: a second tab
     at `#seq=A000002&viz=turtle&angle=90&k=4` (2D engine, no `?3d`), and the
     3D tab set to terms=80 specifically, because A000002's inline shard
     (`public/data/seq/000.json`) has exactly 80 terms and the 2D engine's
     `#seq=` path always draws the full inline set — asking the 3D route for
     more would silently fetch the b-file and the two pictures would no
     longer match.
  3. Both objects framed — flagged as "the check most worth keeping," with
     the specific historical failure (camera framed only the real object,
     null sat outside the frustum) and why no automated check can catch this
     class of bug (it's a camera/frustum fact, not a data fact).
  4. b-file loading — both exact readout strings from the dispatch,
     reproduced as verifiable steps (3,000 of A000002; 4,000 of A000045).
  5. Orbit and zoom.
  6. The bundle check (`grep -rl "OrbitControls\|three/build" dist/`).
- **Checks automation could not settle**, each with the specific mechanical
  reason and the by-hand step that resolves it: steady-state frame rate
  (`document.hidden` blocks rAF; cross-referenced to
  `docs/3d-measurements.md`'s own "Getting a real frame-rate number later"
  section rather than duplicating it), click-picking (no input-reaches-hidden-
  tab guarantee, plus WebGL `readPixels` unreliability; also noted that
  clicking the null strand is expected to do nothing, since the picking
  proxy is built only for the real object), and screenshot capture timing out
  on the ~418,000-vertex Fibonacci digit walk while pixel sampling confirms
  the drawing exists.
- **A known limit, not a defect**: the over-budget warning
  (`MEASURED_CEILING` / `overBudget` in `src/viz3d/budget.ts`) can't be
  triggered by hand at the route's current default-parameters-only behavior,
  because polyarc's default 8-points-per-term (`MIN_SEGMENTS` in
  `src/viz/polyarc.ts`) would need a ~125,000-term b-file to cross 1,000,000
  vertices, and no b-file this tool reaches is that long (A000045's is
  2,001). States plainly what would change it: exposing the view's own
  parameters (angle/modulus/offset) in the route's controls.

## Judgment calls (not explicitly specified in the dispatch)

1. **Terms=80 for the canonical-zero check.** The dispatch said to verify
   against `#seq=A000002&viz=turtle&angle=90&k=4` but didn't say what term
   count makes the two panels match. I traced `createRebuilder` in
   `src/viz3d/dev/route.ts`: if the 3D route's `terms` control exceeds the
   inline shard's length, it fetches the b-file instead of matching the 2D
   engine's inline-only default. I confirmed A000002's inline shard has
   exactly 80 terms by reading `public/data/seq/000.json` directly, and wrote
   that into the doc as the specific value to set, with the reasoning, rather
   than leaving "match term counts" vague.
2. **Documented that clicking the null strand does nothing.** Not asked for,
   but I read `scene.ts` and found the picking proxy (`decimate`) is built
   only in `setGeometry` (the real object), never `setNullGeometry`. Since
   this is exactly the kind of asymmetry a hand-tester might mistake for a
   bug, I recorded it as expected behavior in the click-picking section.
3. **Cross-referenced rather than restated `docs/3d-measurements.md`'s
   frame-rate reproduction steps.** The dispatch said to cross-reference that
   file; I pointed to its specific section name instead of duplicating the
   steps, to avoid two documents drifting out of sync on the same procedure.
4. **Softened an initial draft claim** that no sequence's b-file was
   "anywhere near six figures" — I don't have hard evidence for b-file
   lengths beyond A000045 (2,001, given) and A000002 (only know it's ≥3,000
   from the dispatch, not its actual ceiling), so I revised the "known limit"
   section to say only what's actually known, per the house style's
   insistence on not dressing an estimate as a fact.
5. **Did not independently re-derive `segmentsFor`'s full budget logic.**
   Confirmed `MIN_SEGMENTS = 8` in `src/viz/polyarc.ts` and that it's a floor
   the function can't go below, and took the dispatch's "8 points per term at
   defaults" claim as given (established by the controller running the
   thing) rather than hand-tracing every branch of `segmentsFor`.

## Verification run

`npm test`:
```
 Test Files  59 passed (59)
      Tests  730 passed (730)
   Start at  01:53:29
   Duration  8.50s
```
(Same 59/730 baseline as Task 8's final state; "Not implemented:
HTMLCanvasElement's getContext()" lines are pre-existing jsdom noise,
unrelated to a docs-only change.)

`npm run build`:
```
> integer-sequence-visualizer@1.0.0 build
> tsc --noEmit && vite build

✓ 61 modules transformed.
dist/index.html                           2.20 kB │ gzip:  0.83 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB │ gzip:  5.04 kB
dist/assets/index-BFHzFX5b.js           226.46 kB │ gzip: 88.03 kB
✓ built in 320ms
```
No TypeScript errors; build clean.

Bundle check:
```
$ npm run build && grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
clean: three is not in dist
```

## Commit

SHA `caf8f7e63f0addb89915454882769a6d17397779`
Message: `docs(3d): the smoke check the test suite cannot do` (brief's Step 3
message, with an expanded body describing what changed from the brief's
stale checklist; full attribution trailer in git log). Not pushed.

Files in commit: `docs/3d-smoke-check.md` (new). Nothing else touched.

---

# Task 9, fix round 1 report

## Findings addressed

**Finding 1 (Important).** `docs/3d-smoke-check.md`'s "known limit" passage
claimed OEIS b-files past 125,000 terms "are rare in general" - an unhedged
generalisation about OEIS as a whole that nothing in this project measured.
This was a regression from my own deliberate softening earlier in the same
task (I'd already cut a similar overreach once and this clause slipped
through anyway).

**Finding 2 (Important).** The "Steady-state frame rate" section cited
`docs/3d-measurements.md`'s "Getting a real frame-rate number later" steps,
which read `npm run dev` / `http://localhost:5173/?3d&bench` - the exact
command and port the smoke check's own Setup section says is broken on this
machine (port 5173 held by another project). Citing it verbatim
re-introduced the confusion Setup exists to prevent.

## Fixes

### `docs/3d-smoke-check.md`
1. Replaced "and OEIS b-files that long are rare in general" with "and this
   project has not looked for one that is" - scoped to what was actually
   checked, nothing claimed about OEIS as a whole.
2. In the frame-rate section's citation of `docs/3d-measurements.md`, added
   an explicit note to use this document's own Setup command
   (`npx vite --port 5179 --strictPort`, `http://localhost:5179/?3d&bench`)
   rather than whatever port the cited section names, and said this is "the
   same substitution made throughout this document, not a different port
   per document" - so the note stays accurate regardless of what the cited
   file says.
3. Rewrapped the "Reaching the measured ceiling of 1,000,000 vertices at 8
   points/term needs a 125,000-term b-file." line, which had drifted to
   ~115 characters, back to the document's ~78-80 column width (minor, as
   flagged).

### `docs/3d-measurements.md`
Checked the whole file for `npm run dev` and `5173` - both occurrences were
in the same two lines (the "Getting a real frame-rate number later" list).
Corrected them:
- `1. Run `npm run dev`.` -> `1. Run `npx vite --port 5179 --strictPort`.`,
  with a parenthetical explaining why (port 5173 is taken by another
  project on this machine, `--strictPort` fails loudly instead of silently
  landing elsewhere).
- `http://localhost:5173/?3d&bench` -> `http://localhost:5179/?3d&bench`.

No other content in either file was touched - the reviewer's note that
every command, A-number, readout string and code claim it checked was
correct (including the 80-term canonical-zero requirement and the
null-object click note) was taken as confirmation to leave those alone.

## Verification run

`npm test`:
```
 Test Files  59 passed (59)
      Tests  730 passed (730)
   Start at  02:00:30
   Duration  8.61s
```

`npm run build`:
```
> integer-sequence-visualizer@1.0.0 build
> tsc --noEmit && vite build

✓ 61 modules transformed.
dist/index.html                           2.20 kB │ gzip:  0.83 kB
dist/assets/ensembleWorker-DW-EWiua.js   25.94 kB
dist/assets/index-46GTM9bw.css           25.52 kB │ gzip:  5.04 kB
dist/assets/index-BFHzFX5b.js           226.46 kB │ gzip: 88.03 kB
✓ built in 314ms
```

Bundle check:
```
$ grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
clean: three is not in dist
```

## Commit

SHA `1e0bd50721580f5ba5f44559cbf7be194e91189d`
Message: `fix(3d): drop an unmeasured OEIS generalisation, fix a stale port`
Files: `docs/3d-smoke-check.md`, `docs/3d-measurements.md` (both modified).
Not pushed.
