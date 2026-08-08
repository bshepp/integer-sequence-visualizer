# Integer Sequence Visualizer

A live webpage that renders [OEIS](https://oeis.org) sequences with multiple
visualization techniques and a first-class **null-model comparison layer** —
so you can test whether the structure you see is a property of the sequence
or an artifact of the rendering technique.

Inspired by a [SeqFan thread](docs/seqfan-ncurve-thread.md) on George Whale's
NCurve tool, which left an open question: *do sequence visualizations tell us
anything useful about the underlying sequences?* This project is the
experimental apparatus for answering it.

## What it does

- **Nine visualizers** across four families: basic (term-vs-index scatter,
  differences/ratios), stats (histogram, autocorrelation), grid (Ulam-style
  spiral, mod-N grid), and trajectory (turtle walk, 2D digit walk, polyarc
  curve — NCurve-style).
- **Null models everywhere**: permutation, difference, and matched-random
  surrogates, comparable against the real sequence in side-by-side or flip
  mode for any visualizer, plus ensemble confidence bands (Web Worker, up to
  1000 surrogates) for the statistics-backed views.
- **Parameter sweeps**: small-multiples grids across a parameter range, so
  you can see how a visualization's apparent structure depends on its knobs.
- **OEIS data**: A-number lookup and keyword search served from a
  self-hosted static index (see [Data pipeline](#data-pipeline) below), plus
  a live b-file deep fetch for the full term list, and paste/formula input
  for non-OEIS sequences.
- **Shareable URLs** encoding the sequence, visualizer, parameters,
  comparison mode, and random seed in the hash, so a specific view can be
  linked and reproduced exactly.
- **A landing gallery**: curated real-vs-null comparisons that render on first
  paint with no network round-trip, each one a saved engine state you can click
  straight into. Every verdict shown is recomputed in CI against its recorded
  null band — the gallery cannot claim a structure is real unless the code
  still measures it that way.
- **Explanations everywhere**: every visualizer and every surrogate documents
  itself (enforced at compile time), surfaced by an (i) button and reused as
  the canvas's accessible description.
- **Cursor readout**: hover to identify the term, digit, bin, or lag under the
  pointer; click a term to mark its counterpart in the null model.
- **Render controls**: line width, join, cap, and a colour mode including
  `none`, which removes hue entirely so any structure still visible cannot be
  a palette artifact. Style is part of the shared URL.
- **Superimpose**: draw the real sequence over its own null in one frame,
  offered only where position carries information (grids place term *n* by
  index, so an overlay would simply overwrite).
- **Export**: PNG with the OEIS credit drawn into the bitmap, plus CSV and
  JSON carrying it in a header — attribution has to survive leaving the page.
  Terms export at full BigInt precision.
- **The numbers behind the picture**: a data table of index and exact term,
  which doubles as the textual equivalent of the canvas for screen-reader
  users.

## Develop

    npm install
    npm run build:data   # generates public/data/ (see Data pipeline) — optional
    npm run dev          # Vite dev server; /api/* proxies to oeis.org
    npm test             # Vitest suite

`npm run build:data` is optional for most development: the app, its build,
and its test suite all work without `public/data/` present. Skipping it just
means A-number lookup and search fail at runtime with a visible error
banner (nothing crashes) until you run it once.

## Data pipeline

A-number lookup and keyword search are served from **static files we
generate ourselves**, not from OEIS's own `/search` endpoint. OEIS sits
behind Cloudflare, which serves an HTTP 403 bot challenge to `/search`
requests from datacenter IP ranges — every cloud host (AWS/GCP/Azure)
included. That makes a server-side proxy to `/search` useless in
production, even though it works fine from a residential IP in local dev.
OEIS's static per-sequence pages (used for the b-file deep fetch) are
Cloudflare-cached and unaffected, so that fetch still proxies live through
`/api/*`.

The fix: OEIS publishes daily bulk snapshots for exactly this purpose (the
documented path for bulk consumers, linked from the OEIS EULA) —
[`names.gz`](https://oeis.org/names.gz) (`A000045 <name>` per line) and
[`stripped.gz`](https://oeis.org/stripped.gz) (`A000045 ,0,1,1,2,...,` per
line). `npm run build:data` (`scripts/build-oeis-index.mjs`) downloads both
(caching them locally so repeat runs don't hit OEIS unnecessarily — see
`--force`/`--from-cache` in the script), joins them by A-number, and emits
into `public/data/` (gitignored, regenerate locally or in CI before
deploying):

- `seq/<shard>.json` — one file per zero-padded thousands bucket of the
  A-number (`A019488` → `seq/019.json`), mapping A-number → `{ n: name,
  d: terms }`.
- `search-index.txt` — one `A-number<TAB>name` line per sequence, lazily
  fetched by the client on the first search and cached for the rest of the
  session.
- `meta.json` — generation date, sequence count, source, and license.

Two limitations follow directly from this approach, both by design:

- **Data is a daily snapshot**, not live — it reflects whatever `names.gz`/
  `stripped.gz` looked like the last time `build:data` ran, not the current
  instant on oeis.org. New/edited OEIS sequences appear after the next
  regeneration.
- **`offset` is always `0`** for OEIS-sourced sequences. There is no bulk
  `offsets.gz` file (it 404s), so the real per-sequence offset metadata
  isn't available this way. No visualizer reads `offset` — it's
  display-only — so this has no effect on rendering.
- If the emitted `public/data/` would exceed roughly 120 MB uncompressed,
  the script caps stored terms at the first 80 per sequence (noted in its
  own output when it happens); the b-file deep fetch still covers anyone
  who needs the full term list beyond that.

## Design docs

- Spec: [`docs/superpowers/specs/2026-08-05-oeis-visualizer-design.md`](docs/superpowers/specs/2026-08-05-oeis-visualizer-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-08-05-oeis-visualizer.md`](docs/superpowers/plans/2026-08-05-oeis-visualizer.md)
- Origin thread: [`docs/seqfan-ncurve-thread.md`](docs/seqfan-ncurve-thread.md)
- Does line shape matter? [`docs/line-shape-answer.md`](docs/line-shape-answer.md)
  — measured: no, by two to three orders of magnitude.

## Architecture (one paragraph)

Vite + TypeScript static frontend, no UI framework, all rendering client-side
on Canvas 2D. Visualizers are pure `render(seq, params, ctx, size)` modules
composed by the null-model layer and the sweep view. A-number lookup and
search are served from statically generated `/data/*` files (see
[Data pipeline](#data-pipeline)); the b-file deep fetch is the one remaining
live call, proxied through `/api/*` to `oeis.org` — CloudFront in
production, Vite's dev proxy locally (`npm run dev`). Sequence terms are
`bigint` throughout.

## Attribution and licensing

This repository's own source code is licensed **MIT** (see
[`LICENSE`](LICENSE)).

Sequence data retrieved from OEIS and displayed by the app remains the
property of, and is licensed by, the OEIS Foundation:

> Sequence data from [The On-Line Encyclopedia of Integer Sequences](https://oeis.org/)®,
> © OEIS Foundation Inc., used under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
> (Creative Commons Attribution-ShareAlike 4.0).

The app itself carries this attribution in a persistent footer, and every
loaded sequence links back to its OEIS entry. See the OEIS End-User License
Agreement for the terms in full:
<https://oeis.org/wiki/The_OEIS_End-User_License_Agreement>.

The `public/data/` files generated by `npm run build:data` (see
[Data pipeline](#data-pipeline)) are themselves derived directly from
OEIS's `names.gz`/`stripped.gz` bulk downloads and are hosted and
redistributed under that same **CC BY-SA 4.0** license, same as any other
OEIS sequence data this app displays.

## Accessibility

The interface targets **WCAG 2.1 AA / Section 508**.

- Every control has a programmatic label; `placeholder` is never used as an
  accessible name.
- The sequence-panel tabs implement the WAI-ARIA tab pattern with roving
  tabindex and Left/Right/Home/End navigation.
- Errors and notices are delivered through persistent live regions -- an
  assertive one for errors, a polite one for notices -- created at startup
  rather than when the first message arrives, since a live region inserted
  already populated is frequently never announced.
- The landing overlay and the sweep dialog mark everything behind them
  `inert`, removing it from both the tab order and the accessibility tree;
  focus moves in on open and returns to the opener on close.
- A skip link bypasses the sidebar, which otherwise puts the load panel plus
  ~20 preset buttons ahead of the visualization.
- Canvases carry `role="img"` and a description drawn from the visualizer's
  own `explain.long` text; decorative thumbnails are `aria-hidden`.
- `prefers-reduced-motion` is honoured; nothing auto-animates.
- Colour contrast was measured across every foreground/background pair in the
  theme. The lowest is 5.75:1 against a 4.5:1 AA threshold for normal text,
  so the palette needed no changes.

`tests/ui/a11y.test.ts` enforces the structural half of this: accessible
names on every control, no positive `tabindex`, click targets that are real
buttons or links, exactly one live region of each urgency, and that nothing
outside a modal layer stays reachable while it is open.

**Known gap:** the canvas renderings convey information visually that has no
full textual equivalent. The cursor readout names whatever is under the
pointer and `explain.long` describes what the view draws, but there is no
tabular view of the underlying terms. That is the obvious next step.

## Deploy

### Social preview card

`public/og-card.png` is a **stored** 1200x630 image, while the landing hero is
a live canvas render — so the two drift apart whenever the hero gallery entry
changes. Regenerate it by running `npm run dev` and opening `/?ogcard`, which
renders the current hero through the real render path and downloads the PNG;
save it over `public/og-card.png`. `scripts/deploy.sh` warns if the file is
missing but cannot detect staleness.

Static hosting means one card for every share link: a link to Recamán and a
link to Kolakoski preview identically. Per-state cards would need SSR or
Lambda@Edge.

Static assets build to `dist/` (`npm run build`) and are served from an S3
bucket behind CloudFront (mirroring the owner's existing
`ansatz.briansheppard.com` / `mercator.briansheppard.com` fleet). A
CloudFront behaviour + viewer-request function proxies `/api/*` to
`oeis.org` for the b-file deep fetch only, standing in for the Vite dev
proxy used locally. `npm run build` alone produces a fully static site with
no build-time dependency on this infrastructure — but `npm run build:data`
must be run at least once beforehand (and re-run periodically to refresh
the daily snapshot) so `public/data/` exists and gets copied into `dist/`;
without it, lookup and search fail gracefully with a visible error banner
rather than working.
