# 3D smoke check

jsdom has no WebGL, so `tests/viz3d/**` can verify geometry math, load
sequencing, and the generation guard, but it cannot verify that a GPU draws
the right pixels, that a drag rotates the object, or that a click resolves to
a term. This document is the procedure for the part the suite structurally
cannot see. Run it by hand, in a real browser, after any change under
`src/viz3d/`.

Everything under "Checks verified by hand" below has been run at least once
and passed, on the machine and GPU in `docs/3d-measurements.md`
(`ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 SUPER ..., D3D11)`, 2026-09-20).
"Checks automation could not settle" is the opposite: things this project
tried to get a machine to confirm and could not, with the reason why, and the
by-hand step that settles each one in seconds.

## Setup

`npm run dev` defaults to port 5173, which is already in use by another
project on this machine. Use an explicit port instead:

```
npx vite --port 5179 --strictPort
```

`--strictPort` fails loudly if 5179 is also taken, instead of silently
picking a different port and leaving you looking at the wrong tab. Open:

```
http://localhost:5179/?3d
```

This is the dev-only route (`src/viz3d/dev/route.ts`, mounted from
`src/main.ts` only under `import.meta.env.DEV`, behind the `?3d` query
param). It replaces the whole page with the 3D tool's own canvas and
controls — it does not coexist with the normal engine UI in the same tab.

## Checks verified by hand

### 1. It draws

Open `http://localhost:5179/?3d`. A ribbon appears against the dark
background; the canvas is not blank. Default state is `turtle` /
`A000002` / 500 terms / lift (the "step" slider) at 0.5, with the null
model on.

### 2. Canonical zero

At lift 0, with the null model off, the object is the 2D engine's own
drawing of the same sequence, view and settings — not a resemblance, the
same picture, because `geometryFor` in `src/viz3d/geometry.ts` calls the
exact 2D path function (`turtlePath`, `polyarcPath`, `digitWalkPath`) and
`liftPath` at `step: 0` only adds a `z = 0` coordinate to it.

Verified against `#seq=A000002&viz=turtle&angle=90&k=4`.

To put the two side by side:

1. Open a second tab (or a window positioned next to the first) at
   `http://localhost:5179/#seq=A000002&viz=turtle&angle=90&k=4`. This is
   the normal engine, not the 3D tool — do not add `?3d` to this URL. Angle
   90 and mod-k 4 are turtle's own defaults, so this URL and the plain
   `#seq=A000002&viz=turtle` are the same picture; the params are written
   out for precision.
2. In the `?3d` tab, set the sequence field to `A000002`, the view to
   `turtle`, and terms to `80`. A000002's inline shard
   (`public/data/seq/000.json`) has exactly 80 terms, and the 2D engine's
   `#seq=` load path (`lookupById` with no `terms` override) always draws
   the full inline set — asking the 3D route for more than 80 would fetch
   the b-file and diverge from what the 2D tab is showing.
3. Uncheck "null".
4. Drag the lift ("step") slider to 0, or press Flat.
5. Compare the two tabs. Same path shape, same extent, same colour.

### 3. Both objects framed

With the null model on (the default), both the real object and its
scrambled twin are on screen at once, without orbiting to find the second
one.

This is the check most worth keeping: it failed once, during development.
The camera framed only the real object's bounds and the null object — which
`scene.ts` places offset along x by 1.2x the null geometry's own width —
sat entirely outside the frustum, invisible until you rotated far enough by
hand to stumble onto it. The fix (`framingFor` in `src/viz3d/frame.ts`,
wired through `reframe()` in `src/viz3d/dev/scene.ts`) frames the union of
the real and null bounds instead of only the real one, and re-frames
whenever the null model is toggled or the geometry changes. There is no
automated check for "is the thing on screen actually inside the view
frustum" — that is a camera-and-viewport fact, not a data fact — so this is
the one to repeat after touching `scene.ts`, `frame.ts`, or the null-model
wiring in `route.ts`.

Steps: load the default state (`turtle`, `A000002`, null on). Both a
blue-ish real strand and an orange-ish null strand are visible without
touching the camera. Switch the view (turtle / polyarc / digitwalk) and
confirm both stay framed each time.

### 4. b-file loading

Asking for more terms than the OEIS entry lists inline fetches the b-file
(the readout names the source — see `describeLoad` in
`src/viz3d/dev/route.ts`):

1. Set the sequence to `A000002`, terms to `3000`. The readout reports
   "loaded 3,000 terms from the b-file." The drawing is visibly denser than
   the 80-term inline version from check 2.
2. Set the sequence to `A000045`, terms to `4000`. The readout reports
   "loaded 2,001 of 4,000 requested terms - the b-file itself only has
   2,001." — the b-file for A000045 (Fibonacci) has 2,001 terms total, so
   the shortfall is the source running out, not the route capping it.

### 5. Orbit and zoom

Drag on the canvas: the view orbits (both the real and null objects
together, one camera — `OrbitControls` in `scene.ts` never runs two
cameras). Scroll the wheel: the view zooms in and out. Both respond
smoothly with no console errors.

### 6. The bundle

`three` and `OrbitControls` must not reach the production bundle — the 3D
tool is dev-only, gated by `import.meta.env.DEV` in `src/main.ts`.

```
npm run build && grep -rl "OrbitControls\|three/build" dist/ || echo "clean: three is not in dist"
```

Prints `clean: three is not in dist`.

## Checks automation could not settle

Each of these was attempted from an automated/headless tab before falling
back to a by-hand check. Recorded here so the next person doesn't spend time
re-discovering the same dead end.

### Steady-state frame rate

Not settled by automation, and not settled here either — this is a pointer,
not a result. An automated tab reports `document.hidden === true`, and
`requestAnimationFrame` never fires in a hidden tab, so a harness that waits
on it hangs. `src/viz3d/dev/bench.ts` falls back to a plain timer
(`setTimeout`) purely so the benchmark sweep terminates rather than hanging
forever — that fallback path is explicitly not a frame-rate measurement
(`BenchRow.framePacing` is `'timer'`, `msPerFrame` is `null` on that path,
per `docs/3d-measurements.md`).

Getting a real number needs a visible, focused tab — see
`docs/3d-measurements.md`'s "Getting a real frame-rate number later"
section for the exact steps (`npm run dev`, open `?3d&bench` in a tab that
is never backgrounded, read `console.table`'s `framePacing` column before
trusting `msPerFrame`). That has not been done as part of this smoke check;
`docs/3d-measurements.md` states build+upload cost as the measured fact and
frame rate as unmeasured, and this document does not add a frame-rate claim
that file doesn't make.

### Click-picking

Could not be confirmed by automation, for two independent reasons: real
mouse/click input may not reach a hidden or unfocused tab the way it reaches
a visible one, and even if a click event were dispatched synthetically,
identifying which strand was hit by reading pixels back from a WebGL canvas
is unreliable — a `readPixels` call on this canvas often comes back as
background colour rather than the drawn strand, for the same class of
reason the drawing-buffer read is unreliable for screenshot capture below.
There is no automated evidence behind click-picking at all; this check is
the one thing in the tool resting entirely on the by-hand run below.

By hand: with a strand on screen, click directly on it. The readout
(bottom-right) changes to `term N = value` for some term N and its actual
value in the loaded sequence. Move the mouse without clicking: the readout
does not change and nothing recomputes (picking is wired to `click`, not
`pointermove`, in `scene.ts` — a raycast against tens of thousands of
points is too slow to run on every mouse move). Click on empty background:
nothing happens (no proxy hit). Click on the null-model strand: nothing
happens — the picking proxy is built only for the real object
(`setGeometry`, not `setNullGeometry`, in `scene.ts`), so only the real
object is clickable, and that asymmetry is expected, not a bug.

### Screenshot capture of large drawings

Capturing a screenshot of a large drawing (tried against the 2,001-term
Fibonacci digit walk — `A000045`, `digitwalk`, all 2,001 b-file terms,
roughly 418,000 vertices) times out through automation. Sampling individual
pixels from the canvas, rather than capturing the whole thing, confirms the
drawing is actually there — so a timed-out or blank-looking capture at this
scale is a capture-tooling limit, not evidence that the canvas is blank.
Treat "the screenshot is blank" from an automated run as inconclusive at
this vertex count, not as a failure to chase.

## A known limit, not a defect

The over-budget warning (`overBudget` / `MEASURED_CEILING` in
`src/viz3d/budget.ts`, wired into `src/viz3d/dev/route.ts`'s rebuild) cannot
currently be triggered by hand through this route. The route draws every
view at its default parameters, and at those defaults the polyarc view —
the densest of the three supported views — samples 8 points per term
(`MIN_SEGMENTS` in `src/viz/polyarc.ts`). Reaching the measured ceiling of 1,000,000 vertices at 8 points/term needs
a 125,000-term b-file. A000045's b-file tops out at 2,001 terms (check 4
above), nowhere close; no sequence this check has loaded has had a b-file
anywhere near 125,000 terms either, and OEIS b-files that long are rare in
general. So the warning path is exercised by `tests/viz3d/budget.test.ts`
with a synthetic vertex count, but not by anything a person has actually
loaded through `?3d`.

What would change this: exposing the view's own parameters (polyarc's
angle/modulus/offset, which `segmentsFor` uses to decide samples-per-term)
in the route's controls, the way `controls.ts` already exposes term count
and lift. A tighter modulus or wider angle can push `segmentsFor` well past
8, and at a high enough setting a b-file within reach could plausibly cross
the ceiling. Until that control exists, the over-budget readout is verified
only by the unit test, not by hand.
