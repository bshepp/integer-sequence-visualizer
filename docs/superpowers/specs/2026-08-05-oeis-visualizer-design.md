# OEIS Sequence Visualizer — Design

**Date:** 2026-08-05
**Status:** Approved by user (brainstorming session)

## Motivation

Inspired by the SeqFan thread on George Whale's NCurve tool
(`docs/seqfan-ncurve-thread.md`), which left an open question: *do sequence
visualizations tell us anything useful about the structure of the underlying
sequences, or is the apparent structure an artifact of the rendering
technique?* Existing tools (Numberscope, NCurve) render sequences but provide
no way to test that question.

This project is a live webpage that renders OEIS sequences with multiple
visualization techniques **and** makes null-model comparison a first-class
feature: every rendering can be compared against matched surrogate sequences,
so the eye (or a statistic) can judge which visual structure is real.

## Goals

- Live, publicly hosted static webpage; arbitrary OEIS sequence lookup.
- Four visualization families: grid/spiral, trajectory/turtle (including an
  NCurve-style polyarc curve), statistical views, line/scatter basics.
- Null-model layer available across all visualizers: surrogate generation,
  side-by-side and flip comparison, ensemble confidence bands.
- Parameter-sweep small-multiples view (the thread's "no parameters iterated"
  gap).
- Shareable URLs encoding sequence + visualizer + parameters.

## Non-goals (v1)

- B-file fetching (thousands of terms). Long sequences come from formula or
  paste input. The OEIS client is structured so b-file support can be added
  later without touching visualizers.
- Feature-vector extraction / clustering of sequences (future research
  direction; the `statistics()` interface is a stepping stone).
- Server-side rendering, accounts, or persistence beyond URL state.
- Screenshot/image-diff testing.

## Architecture

Static frontend (Vite + TypeScript, **no UI framework**) rendering to
**Canvas 2D**, plus a ~30-line **Cloudflare Worker** that proxies
`oeis.org` under `/api/*` on the same domain, adding CORS-free access and a
24-hour response cache. Local development uses Vite's dev-server proxy, so
`npm run dev` works with no deployed infrastructure.

Rationale: rendering is entirely client-side (Canvas 2D handles hundreds of
thousands of points; JS BigInt handles OEIS-scale integers; Web Workers keep
ensembles off the main thread). The only thing a static site cannot do is
call oeis.org directly (no CORS headers) — hence the Worker.

### Modules

```
src/
  sequence/   Sequence model, OEIS client, paste parser, formula evaluator, SequenceView
  viz/        Visualizer interface, registry, one module per visualizer
  nullmodel/  Surrogate generators, ensemble runner (Web Worker)
  ui/         Layout, auto-generated param controls, sequence picker, presets
workers/      Cloudflare Worker proxy (deployed separately via wrangler)
```

### Data flow

Input (A-number / search pick / paste / formula) → `Sequence` object →
active visualizer renders to main canvas → if a comparison mode is on, the
null-model engine generates surrogate(s) and drives *the same visualizer*
into the comparison pane. The sweep view is a second consumer of the same
composition: fixed sequence, one parameter varied, thumbnail grid.

## Data layer (`src/sequence/`)

- **`Sequence`**: terms as `bigint[]` (OEIS values overflow float64 within
  ~15 digits), plus metadata: A-number, name, offset, source (oeis | paste |
  formula).
- **`SequenceView`**: the accessor wrapper visualizers consume, so BigInt
  handling lives in one place: clamped `toNumber(i)`, `logMagnitude(i)`,
  `mod(i, n)`, `digits(i)`, `sign(i)`, `length`.
- **OEIS client** (via proxy): lookup by A-number
  (`/api/search?q=id:A000045&fmt=json`), keyword search returning a results
  list. Responses parsed defensively; parse failures surface as user-visible
  errors, never silent empties.
- **Paste parser**: comma/whitespace-separated integers, tolerant of
  brackets and OEIS copy-paste formats.
- **Formula evaluator**: safe expression parser (no `eval`) over `n` with
  integer arithmetic (`+ - * / % ^`), parentheses, and a few functions
  (`abs`, `min`, `max`, `gcd`); user chooses n-range. Live validation with
  inline errors.
- **Presets shelf**: the SeqFan thread's named finds — A000376 (French
  curve), A000464 (pie crust), A000828 (propeller), A001051 (tire), A001553
  (saw blade), A001571, A001603, A019488 (Sloane's), A039188 (record disc),
  A039685 (zipper), A039970 (Slinky) — plus classics (A000045 Fibonacci,
  A000040 primes, A005132 Recamán).

OEIS main-entry lookups yield ~30–60 terms; that suffices for statistical
views and small grids. Formula/paste are the long-sequence path.

## Visualizers (`src/viz/`)

Each visualizer is one self-contained module implementing:

```ts
interface Visualizer {
  id: string; name: string;
  family: 'grid' | 'trajectory' | 'stats' | 'basic';
  params: ParamSpec[];        // declarative; UI controls auto-generated
  minTerms: number;           // UI warns when the sequence is shorter
  render(seq: SequenceView, params: Params,
         ctx: CanvasRenderingContext2D, size: Size): void;
  statistics?(seq: SequenceView, params: Params): Record<string, number[]>;
}
```

`render` is **pure**: no internal state, seeded randomness only. Purity is
what makes side-by-side, flip, ensemble, and sweep all "call it again with
different inputs."

`ParamSpec` covers: number (range slider), integer, select, boolean, color
scheme. Each has id, label, default, and (for numbers) min/max/step —
enough for the sweep view to pick a parameter and a range automatically.

### Initial roster (9)

| Family | Visualizer | Notes |
|---|---|---|
| trajectory | **Polyarc curve** | NCurve-style joined arcs; curvature and arc length from terms; params: angle step, scale, mod. Lineage: Dekking–Mendès France (1981), Deshouillers (1985). |
| trajectory | Turtle walk | Turn angle from terms mod k; params: angle, step length. |
| trajectory | 2D digit walk | Direction from digits in base b; param: base. |
| grid | Ulam-style spiral | Square spiral colored by value / parity / divisibility / membership. |
| grid | Mod-N grid fill | Row-major grid of terms mod N; params: N, columns. |
| stats | Histogram | Selectable target: terms, gaps, digits, leading digit. Exports `statistics`. |
| stats | Autocorrelation | Lag correlation of (clamped/log) terms. Exports `statistics`. |
| basic | Term-vs-index scatter | Linear/log toggle. Exports `statistics` (the values themselves). |
| basic | Differences & ratios | First differences and successive ratios. Exports `statistics`. |

## Null-model engine (`src/nullmodel/`)

Three surrogate generators, all seeded (reproducible; seed shown in UI and
encoded in the share URL):

1. **Permutation surrogate** — shuffle the sequence's own terms. Preserves
   the exact value multiset; destroys order. Tests: "is the *order* doing
   the work?"
2. **Difference surrogate** — shuffle first differences, re-accumulate from
   the first term. Preserves increment multiset and overall growth; destroys
   increment ordering. The right null for trajectory visualizers.
3. **Matched-random** — fit a growth envelope (linear vs. exponential chosen
   by regression fit on log scale), sample fresh terms within it. The
   "generic sequence with these gross statistics" baseline.

### Comparison modes

- **Side-by-side** (any visualizer): real | surrogate, same params, split
  canvas.
- **Flip toggle** (any visualizer): swap surrogate data in place; the eye is
  the detector.
- **Ensemble bands** (visualizers exporting `statistics`): a Web Worker
  generates N surrogates (default 200, max 1000), computes each statistic,
  renders 5th–95th percentile bands under the real curve. Progress
  indicator + cancel.

## Sweep view

For the current sequence + visualizer, pick one numeric parameter and a
range; render a clickable grid of thumbnails (each a pure `render` call at
reduced size). Clicking a thumbnail adopts its parameter value in the main
view.

## UI

Single-page workbench, dark theme.

- **Left sidebar**: input tabs (A-number / OEIS search / paste + formula),
  presets shelf, loaded-sequence info card (name, A-number linked to
  oeis.org, term count, source).
- **Top bar**: visualizer picker grouped by family; auto-generated param
  controls for the active visualizer.
- **Main area**: canvas; comparison control (Off / Side-by-side / Flip /
  Ensemble) with surrogate-type selector and seed; Sweep button opening the
  thumbnail grid.
- **URL hash** encodes sequence reference, visualizer id, params, comparison
  mode, surrogate type, seed → shareable/bookmarkable views.

## Error handling

- Proxy/network failure → visible message + retry button; never a blank
  canvas.
- Unknown A-number / empty search → plain message.
- Formula errors → live inline validation; invalid formulas cannot be
  applied.
- Sequence shorter than `minTerms` → render what's possible + notice.
- Values beyond float64 → visualizers use `SequenceView` log/mod accessors;
  no silent precision corruption.
- Ensemble runs → cancellable, progress shown, main thread never blocked.

## Testing

Vitest, focused on logic that fails subtly:

- OEIS response parsing against recorded JSON fixtures.
- Formula evaluator: precedence, integer semantics, error cases.
- Paste parser: OEIS copy-paste formats, brackets, negatives.
- Surrogate generators — invariants: permutation preserves exact multiset;
  difference surrogate preserves first term and increment multiset;
  matched-random respects envelope; identical seeds → identical output.
- Visualizer smoke tests: each renders to an offscreen canvas without
  throwing on edge cases (negative terms, huge BigInts, length-2
  sequences).

Visual quality judged by eye in the dev server; no screenshot testing.

## Deployment

- Static assets: Cloudflare Pages, auto-build from git.
- Proxy: Cloudflare Worker at `/api/*` on the same domain (no cross-origin),
  caching OEIS responses 24h via the Cache API.
- One repo; `wrangler deploy` for the Worker.
- Local dev: `npm run dev` only (Vite proxy stands in for the Worker).

## Future directions (recorded, not scoped)

- B-file deep fetch for long OEIS sequences.
- Feature vectors from `statistics()` → clustering → emergent "names"
  (thread open-question #3).
- Favorites gallery (à la George Whale's).
- Per-visualizer anomaly tinting vs. ensemble (Approach B ideas), e.g.
  spiral cells colored by deviation from null.
