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
- **Live OEIS data**: A-number lookup, keyword search, and b-file deep fetch
  for the full term list — plus paste and formula input for non-OEIS
  sequences.
- **Shareable URLs** encoding the sequence, visualizer, parameters,
  comparison mode, and random seed in the hash, so a specific view can be
  linked and reproduced exactly.

## Develop

    npm install
    npm run dev      # Vite dev server; /api/* proxies to oeis.org
    npm test         # Vitest suite

## Design docs

- Spec: [`docs/superpowers/specs/2026-08-05-oeis-visualizer-design.md`](docs/superpowers/specs/2026-08-05-oeis-visualizer-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-08-05-oeis-visualizer.md`](docs/superpowers/plans/2026-08-05-oeis-visualizer.md)
- Origin thread: [`docs/seqfan-ncurve-thread.md`](docs/seqfan-ncurve-thread.md)

## Architecture (one paragraph)

Vite + TypeScript static frontend, no UI framework, all rendering client-side
on Canvas 2D. Visualizers are pure `render(seq, params, ctx, size)` modules
composed by the null-model layer and the sweep view. In production, static
assets are served from S3 behind CloudFront, with a CloudFront behaviour
proxying `/api/*` to `oeis.org`; Vite's dev proxy substitutes for it locally
(`npm run dev`). Sequence terms are `bigint` throughout.

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

## Deploy

Static assets build to `dist/` (`npm run build`) and are served from an S3
bucket behind CloudFront (mirroring the owner's existing
`ansatz.briansheppard.com` / `mercator.briansheppard.com` fleet). A
CloudFront behaviour + viewer-request function proxies `/api/*` to
`oeis.org`, standing in for the Vite dev proxy used locally. There is no
build-time dependency on this infrastructure — `npm run build` alone
produces a fully static site.
