# 3D view — design

**Date:** 2026-09-19
**Branch:** `3d-view`
**Status:** approved in conversation, pending written review
**Issue:** #1 (3D views: spectral test, extra turtle degrees of freedom, index-lift)

## Motivation

The engine draws nine ways and every one of them is flat. A path that crosses
itself loses the fact of crossing: two visits to the same place are one mark on
the canvas, and how far apart in time they were is gone. Issue #1 records three
ways a third dimension could help; this design builds the safest of them — an
index-lift — as an interactive object the author can rotate.

It is built **for the author's own use**, as a development tool, not as a
feature of the public site. That decision shapes almost everything below, and
the reasons it was taken are in *Decisions*.

## Goals

- Turn the three path views — turtle walk, polyarc curve, digit walk — into a
  rotatable 3D object, in a route that exists only in dev builds.
- Preserve a **canonical zero**: viewed straight down the z axis with lift at
  zero, the object reproduces the existing 2D drawing exactly, not approximately.
- Handle the real data sizes: b-files up to 100,000 terms, and a digit walk that
  turns 2,001 terms into 418,487 points. The ceiling is whatever the GPU takes,
  **measured**, and written down with the machine it was measured on.
- Keep the interesting part — how a sequence becomes geometry — as plain,
  testable functions, with the graphics library confined to one corner.
- Cost the shipped site nothing: no bytes, no dependencies, no behaviour change.

## Non-goals

- **Shipping to the public site.** Not now. If it earns it later, that is a
  build-configuration change plus the public obligations listed in *Deferred*.
- **Precomputed geometry on S3.** Dropped: geometry depends on every parameter,
  so a cache would only ever hit for the eleven presets at their recorded
  settings. The parameter space defeats it.
- **The other two ideas in issue #1.** The spectral test (triples in a cube) and
  the 3D turtle (two angular degrees of freedom) stay open; neither is built here.
- **The grid and statistics views.** Deferred until the path views teach us
  something; see *Staging*.
- **Verdicts from 3D.** No worked example gains a verdict from a 3D view until
  that view has a statistic that does not move when the camera does.

## Decisions, including the ones we reversed

Recorded because the reasoning is the part that gets lost.

| Decision | Why |
|---|---|
| **Index-lift first**, not the spectral test or the 3D turtle | It is the only one of the three with a canonical zero, so the camera becomes a dial from today's picture to the time-resolved one rather than an arbitrary vantage point. Issue #1 reaches the same conclusion. |
| **Local-only, dev route** | The tool is for the author. Locally there is no bundle budget, no accessibility obligation for a control nobody else will press, and no risk that a stranger mistakes a camera angle for evidence. |
| **three.js**, reversing an earlier choice of raw WebGL | Raw WebGL was chosen when this was going to ship, to avoid ~150KB on an 88KB bundle. Dev-only removes that constraint, and the performance argument does not separate them: both draw one static buffer in one call. three.js supplies orbit controls, resize, buffer management and picking, so the work goes into geometry instead. Drop to a custom `ShaderMaterial`, or to raw GL, only if something specific demands it. |
| **No precompute** | As above. Reconsider only if a fixed set of large drawings turns out to be looked at repeatedly. |
| **Orthographic camera** | No vanishing point to invent convergence; parallel stays parallel; looking down z is exactly the 2D picture. A perspective camera has no canonical zero. |
| **Depth test off** | Occlusion is the sharpest objection in issue #1: near geometry hiding far geometry could read as a difference between the real and null panels. Monotonic z means back-to-front is just index order, so nothing is ever hidden — only blended. Depth fade is an optional legibility aid, never the default that cannot be switched off. |
| **One camera for both panels** | Comparing two objects from two angles is not a comparison. Locked by default, unlinkable, as the existing pan/zoom link already works. |

## Architecture

Four layers. Exactly one knows that a GPU exists.

```
src/viz3d/types.ts     Geometry3D, DrawMode              pure, tested
src/viz3d/lift.ts      liftPath()                        pure, tested
src/viz3d/geometry.ts  geometryFor(vizId, seq, params)   pure, tested
src/viz3d/dev/…        three.js scene, controls, bench   dev-only, smoke-tested
src/main.ts            import.meta.env.DEV guard         existing pattern
```

### `src/viz3d/types.ts`

```ts
export type DrawMode = 'lines' | 'points';

export interface Geometry3D {
  /** xyz triples, in the same units as the 2D path. */
  positions: Float32Array;
  mode: DrawMode;
  /** Which term each vertex belongs to, for picking and the readout. */
  termOf: Uint32Array;
  bounds: { min: [number, number, number]; max: [number, number, number] };
}
```

**Colour by index is wanted, and is deferred in order rather than in
principle.** It needs no change to this interface: the 2D side already turns a
position along the walk into a colour with `strokeColorAt(style, t)`, where `t`
runs 0 to 1, so the renderer can build a per-vertex colour attribute from
`termOf[i] / (terms - 1)` and the visitor's existing style settings. That is a
change inside `dev/scene.ts` and nowhere else, and it keeps the 3D object's
colours identical to the 2D drawing's, which matters for the canonical zero:
top-down should match the flat picture in colour as well as in shape. Stage 1
ships a single colour so that the first thing on screen is geometry rather than
a palette; the attribute lands in stage 3 alongside depth fade, which is the
other thing that changes how a vertex looks.

### `src/viz3d/lift.ts`

```ts
export interface LiftOptions {
  /** Total z rise across the whole drawing, as a fraction of the xy bounding
   *  box's diagonal. 0 gives a flat object identical to the 2D path; 1 makes
   *  the object as tall as its own diagonal. Per-vertex advance is therefore
   *  step x diagonal / (n - 1), constant, which is what keeps z monotonic. */
  step: number;
}

export function liftPath(
  path: ReadonlyArray<{ x: number; y: number }>,
  termOf: (vertexIndex: number) => number,
  opts: LiftOptions,
): Geometry3D;
```

The x and y of every vertex are **copied unchanged** from the 2D path. That is
the canonical zero, and it is a test rather than a promise. z is
`i * step * diagonal / (n - 1)` for vertex `i` of `n`, monotonic in vertex index
by construction, so
two visits to the same xy can never collide in z and the strand count stays
readable. Normalising against the drawing's own diagonal is what stops a
2,001-term digit walk becoming an unviewably tall thread.

### `src/viz3d/geometry.ts`

```ts
export function geometryFor(
  vizId: string, seq: SequenceView, params: Params, lift: LiftOptions,
): Geometry3D | null;
```

Dispatches to the existing path functions — `turtlePath(seq, angle, k)`,
`polyarcPath(seq, opts)`, `digitWalkPath(seq, base)` — and lifts the result.
Returns `null` for a view with no 3D meaning, which is how the mode knows to
disable itself. Each supported view supplies its own `termOf`: one vertex per
term for the turtle, `segments` per term for the polyarc, one per digit for the
digit walk, which `digitWalkOwners` already computes.

### `src/viz3d/dev/`

- **`route.ts`** — mounts on `?3d` in dev builds only, reusing the og-card
  pattern in `main.ts`. Loads a sequence the same way the engine does, builds
  geometry, hands it to the scene, and renders the controls: lift slider, view
  picker, term-count input, surrogate toggle, reset-to-flat.
- **`scene.ts`** — the only file importing `three`. Orthographic camera,
  `OrbitControls`, a single `BufferGeometry` per panel, `LineSegments` or
  `Points` by draw mode, `depthTest: false`, back-to-front index order, optional
  depth fade. Geometry uploads once; a drag updates the camera and nothing else.
  Picking lives here too: a cursor position becomes a vertex index by way of
  three.js's raycaster against a decimated proxy, and `termOf` turns that into a
  term, which the route shows as a readout. A raycast against millions of
  vertices is too slow to do per move, so it runs on click, not on hover.
- **`panels.ts`** — real and surrogate side by side, sharing one camera, with the
  surrogate built by the existing `makeSurrogate` so the null models are the
  site's own, not a 3D reimplementation.
- **`bench.ts`** — the benchmark: rising vertex counts against frame time, with
  the GPU string from `WEBGL_debug_renderer_info`, writing the table this design
  promises in *Testing*.

**Data flow:** sequence + params → `geometryFor` → typed arrays → one buffer
upload → drag mutates the camera only. For counts above the measured ceiling the
route warns before building, reusing the shape of `renderCost.ts` rather than its
numbers, which are 2D canvas costs and do not transfer.

## Error handling

- **No WebGL context:** the route says so and stops. The engine is untouched; the
  public site never mounts this code.
- **Geometry too large:** above the measured ceiling the route warns and requires
  a confirm before building, so a 100,000-term digit walk cannot freeze the tab
  by accident.
- **Unsupported view:** `geometryFor` returns `null` and the route disables the
  object with the reason, rather than drawing an empty scene.
- **Sequence load failure:** the existing error path; the route shows the message
  and keeps the last object on screen.

## Testing

**Unit (vitest, jsdom, no GPU):**

- `liftPath` copies xy exactly — asserted against `turtlePath`, `polyarcPath`
  and `digitWalkPath` output, vertex for vertex, so the canonical zero is
  pinned.
- z is strictly increasing; `step: 0` gives all-zero z; the step normalises
  against the diagonal, so two drawings of very different extent lift
  proportionally.
- `termOf` maps every vertex to a term in range, and the first vertex of term
  `i` follows the last of term `i-1`.
- `geometryFor` returns `null` for the six unsupported views and geometry for the
  three supported ones.
- **Isolation guard:** no file outside `src/viz3d/dev/` imports `three`, and the
  only reference to the dev route is inside an `import.meta.env.DEV` branch. A
  static grep test, because this is exactly what regresses silently.

**Browser smoke (real Chrome, via the existing automation):** the dev route
loads, the canvas is not blank, orbiting changes the pixels, picking returns the
term under the cursor, and the top-down view matches a 2D render of the same
sequence.

**Benchmark:** vertices against frame time on this machine, written to
`docs/3d-measurements.md` with the GPU named, in the style of the existing
render-cost table. That measured number is the ceiling the route warns against.

**Guard on the shipped build:** `scripts/deploy.sh` greps `dist/` for `three`
and refuses to deploy if it appears.

## Staging

1. Dev route, three.js scene, turtle walk lifted, orbit working, canonical-zero
   test green.
2. Polyarc and digit walk through the same lift.
3. Depth test off, back-to-front order, colour by index from the visitor's own
   style settings, optional depth fade; real and surrogate panels under one
   camera.
4. Benchmark, measured ceiling, warning in the route.
5. Write up what the object shows that the flat picture does not — then decide
   about the grid views, and separately about whether any of this ships.

## Deferred, with what it would cost

- **Shipping publicly:** keyboard orbit, a disabled-state reason, `prefers-reduced-motion`,
  an accessible description carrying the angle, the SVG export question (a GPU
  draw has no canvas calls for `svgSurface.ts` to record), and the exploratory
  labelling so no visitor reads a camera angle as evidence.
- **A camera-independent statistic**, which is what would let a 3D view carry a
  verdict. Issue #1 names the candidate for the lift: edge reuse rate, real
  against null.
- **The spectral test and the 3D turtle**, both still open in issue #1.
- **Continuous parameters.** Every numeric `ParamSpec` declares `step: 1`, so
  fractional angles remain unreachable. The lift slider avoids this by being a
  dev-route control rather than a `ParamSpec`, but a shipped version would meet
  the same blocker.
