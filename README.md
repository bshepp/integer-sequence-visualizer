# Integer Sequence Visualizer

A live webpage that renders [OEIS](https://oeis.org) sequences with multiple
visualization techniques and a first-class **null-model comparison layer** —
so you can test whether the structure you see is a property of the sequence
or an artifact of the rendering technique.

Inspired by a [SeqFan thread](docs/seqfan-ncurve-thread.md) on George Whale's
NCurve tool, which left an open question: *do sequence visualizations tell us
anything useful about the underlying sequences?* This project is the
experimental apparatus for answering it.

## Planned features

- **Nine visualizers** across four families: polyarc curves (NCurve-style),
  turtle walks, digit walks, Ulam-style spirals, mod-N grids, histograms,
  autocorrelation, scatter, differences/ratios.
- **Null models everywhere**: permutation, difference, and matched-random
  surrogates; side-by-side and flip comparison for any visualizer; ensemble
  confidence bands (Web Worker, up to 1000 surrogates) for statistical views.
- **Parameter sweeps**: small-multiples grids across a parameter range.
- **Live OEIS data**: A-number lookup, keyword search, b-file deep fetch —
  plus paste and formula input for non-OEIS sequences.
- **Shareable URLs** encoding sequence, visualizer, parameters, and seed.

## Status

🚧 Under construction — currently executing the implementation plan.

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
composed by the null-model layer and the sweep view. A Cloudflare Pages
Function proxies `oeis.org` under `/api/*` (24h edge cache); Vite's dev proxy
substitutes for it locally. Sequence terms are `bigint` throughout.
