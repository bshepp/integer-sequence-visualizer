# Landing Gallery & Explanations - Design

**Date:** 2026-08-06
**Status:** Approved by user (brainstorming session)
**Round:** 1 of 3 (see [Deferred scope](#deferred-scope))

## Motivation

The engine works. The front door does not exist.

A cold visitor currently sees a near-black canvas with grey 16px text reading
*"Load a sequence to begin - try a preset on the left."* (`src/ui/app.ts:238`).
That is the entire pitch. It asks the visitor to do work before showing them
anything, and it says nothing about the one capability that distinguishes this
project from Numberscope and NCurve - the null-model layer.

The site will be shared deliberately at first, to readers who know what an
integer sequence is but not what a permutation surrogate does. Two things
follow:

1. **The first screen must show the comparison, not just a picture.** A pretty
   render alone positions this as a weaker Numberscope. The null model is the
   differentiator, so it belongs in the first second, not behind a dropdown.
2. **Anything on screen must be explainable on demand.** A visitor who wonders
   what a turtle walk is should be able to click and find out.

## Goals

- A landing screen that renders a real-vs-null comparison on first paint, with
  zero network round-trips before that paint.
- A curated gallery of engine states, each one clickable straight into the
  engine at exactly that view.
- A prominent path from the landing into the full engine.
- An explanation corpus covering every visualizer and every surrogate,
  surfaced in-app.
- A social preview card, so a deliberately shared link previews as something
  other than a bare URL.
- Fix the two controls that are currently inert.
- A legend for the ensemble chart, which currently has none, and nested
  percentile levels in place of the single flat band.
- A cursor readout identifying what is under the pointer, with linked markers
  across the real/null comparison.
- All **new** markup written to 508 standard as authored.

## Non-goals (this round)

- A 508 conformance audit of the *existing* engine markup - round 2.
- PNG export, data download, feedback channel, render controls, superimpose
  mode - round 3.
- Per-state social preview images (requires SSR or Lambda@Edge; see
  [Social preview](#5-social-preview-card)).
- Any change to the OEIS data pipeline, `lookupById`, or the deployment
  topology.

## Architecture

### 1. The landing is a state of the existing SPA

The engine is not modified structurally. The landing mounts as an overlay
above the existing app shell and dismisses to reveal it.

Routing rules, all resolved in `applyHash` (`src/ui/app.ts:365`), which already
exists as the single entry point for hash-driven state:

| URL | Behavior |
| --- | --- |
| `/` (no hash) | Landing overlay renders |
| `#gallery` (reserved literal) | Landing overlay renders - linkable |
| Any decodable state hash | Landing skipped entirely; engine opens at that view |
| Undecodable hash | Landing renders (treated as no hash) |

`#gallery` is checked as a literal string *before* `decodeState` is consulted,
so it can never collide with an encoded state.

Dismissal is by the prominent **"Open the full engine →"** button or by
clicking any gallery image. Once dismissed, the landing does not re-mount for
the remainder of the session - re-showing it after a param tweak would read as
a bug. A fresh visit to `/` shows it again.

**Why an overlay rather than a real route:** the CloudFront distribution has
`CustomErrorResponses: { Quantity: 0 }` with S3 behind Origin Access Control,
so a request for a path that is not a real S3 object returns 403 with no
rewrite to `index.html`. A second route therefore requires a CloudFront
configuration change plus an invalidation. The overlay requires no
infrastructure change at all. See [Decisions to revisit](#decisions-to-revisit).

### 2. Gallery entries are saved engine states

New module: `src/gallery/entries.ts`.

```ts
export interface GalleryEntry {
  id: string;             // stable slug; used in tests and for the strip
  title: string;          // "A structure that survives"
  state: UrlState;        // the exact engine view - existing type, reused
  sequence: Sequence;     // bundled terms, so the landing needs no network
  verdict: 'real' | 'artifact' | 'open';
  caption: string;        // one line, under the image
  body: string;           // 2–4 sentences: what it is and why it matters
  evidence?: Evidence;    // required when verdict === 'real'; see §4
}

export interface Evidence {
  statistic: string;      // e.g. 'angularVariance'
  measured: number;
  bandLo: number;
  bandHi: number;
  surrogate: SurrogateType;
  n: number;              // ensemble size
  seed: number;           // so the band reproduces exactly
}
```

`entry.sequence.aNumber` and `entry.state.seqRef` must refer to the same
sequence; a test asserts this, because a mismatch would render one sequence on
the landing and open a different one in the engine.

**The hero and the thumbnails are live canvas renders, not stored images.**
They execute the same visualizer code the engine does, so they cannot drift out
of sync with it - a stored screenshot would eventually assert something the
code no longer produces, which is the same failure mode §4 exists to prevent.
The hero paints first; the strip renders after, at thumbnail size.

Opening an entry is `applyHash('#' + encodeState(entry.state))` - the existing
share-link path, reused verbatim. No new routing, no second render path, no
duplicated state machine.

`entries[0]` is the hero. The remainder populate the examples strip.

**Cold-start:** the hero cannot wait on `/data/seq/000.json`. It also cannot
inline its terms as a `paste` ref, because that discards the A-number and
breaks the OEIS attribution link the project is required to carry. Instead each
entry ships a bundled `Sequence` - terms *and* `aNumber` *and* `name` - which
the landing renders from **directly, without calling `lookupById`**. First
paint costs zero network, attribution survives intact, and `lookupById` keeps
its current behavior unchanged for every other caller. The normal lookup runs
when the visitor enters the engine.

### 3. Explanations live on the visualizer, enforced by the compiler

Add a **required** field to the `Visualizer` interface (`src/viz/types.ts`):

```ts
explain: {
  short: string;   // one line, shown under the picker
  long: string;    // what it draws, and what a null model looks like here
};
```

Because the field is required, `tsc` fails until all nine visualizers supply
one. Coverage is guaranteed by the type system rather than by discipline.

The same shape is added for the three surrogate generators in
`src/nullmodel/surrogates.ts`, so "what is a permutation null" is answerable
in-app.

Surfaced by an **(i)** button beside the visualizer picker, opening a small
dismissible panel. In round 2 the same `long` string becomes the canvas's
`aria-label` - which is why the explanation corpus and the accessibility work
were merged into one project rather than sequenced apart.

### 4. Verdict claims must be computed, not asserted

Every gallery caption that makes a claim about structure must be backed by a
measurement produced by this codebase.

Two claims are already established:

- **A000002 (Kolakoski), Ulam spiral.** Angular variance 0.000332 against a
  200-surrogate permutation band of 0.000506–0.001288 - outside the band on the
  low side, i.e. *excess* regularity. Supporting: switch rate 0.6665 vs ≈0.50
  for surrogates; longest run 2 vs 11–18. Verdict `real`.
- **The rainbow concentric rings.** Established by construction rather than by
  ensemble test: A000002 takes only the values 1 and 2, so it can produce
  exactly two hues at any modulus (hue separation 360/N). The multi-hue rings
  therefore cannot be Kolakoski; they are what a near-linear sequence produces
  when hue advances a fixed step per cell along a winding path. Verdict
  `artifact`, and the caption must say *by construction*, not cite a band.

Every other entry requires a measurement before it ships a `real` or `artifact`
caption. Entries that cannot be measured in this round get verdict `'open'`
with a caption saying so - an honest and genuinely interesting thing for this
particular landing page to admit.

**Enforcement:** a test recomputes the statistic for every entry carrying
`evidence`, using its recorded surrogate type, N, and seed, and fails if the
measured value or the band bounds disagree with what the caption claims. The
gallery verifies itself in CI. This is the specific failure mode the project
exists to expose; committing it on the landing page would be self-refuting.

`evidence` is required for verdict `real` and optional for `artifact`, because
an artifact may be established by construction (as the rings are) rather than
by a band. An `artifact` caption without `evidence` must state its reasoning in
`body` - the test cannot check prose, so the requirement is that the claim be
*shown*, not merely asserted.

### 5. Social preview card

Static `og:title`, `og:description`, `og:image`, and
`twitter:card=summary_large_image` in `index.html`, plus a pre-rendered PNG of
the hero comparison committed to `public/`.

**Limitation, stated deliberately:** static hosting means one card for every
share link. A link to Recamán and a link to Kolakoski preview identically.
Per-state cards need SSR or Lambda@Edge, which is disproportionate for
deliberate sharing.

Because the card is a stored PNG while the hero is a live render (§2), the two
can drift. The card is therefore regenerated whenever the hero entry changes,
and that regeneration step is recorded in the deploy notes rather than left to
memory.

`<title>` also changes from the Vite-stub generic to match the "Ulam"
wordmark.

### 6. The inert controls

- **`null:` surrogate dropdown** (`src/ui/comparison.ts:141`) is fully inert
  while `Compare:` is `off`, which is the default. It becomes `disabled` in
  that state with a hint explaining why. *Considered and rejected:* auto
  -switching the mode to `side` when the surrogate is changed - a control that
  silently changes a *different* control is worse than one that is honestly
  unavailable.
- **`Compare: flip`** (`src/ui/app.ts:269`) renders the real sequence, visually
  identical to `off`, until the separate "Flip real / surrogate" button is
  found and clicked - so selecting it appears to do nothing. Fix: the flip
  button becomes prominent and receives focus when the mode is selected, and
  the canvas states which side is currently shown. Selecting the mode changes
  something immediately.

### 7. Accessibility of new markup

Scoped to markup authored in this round. The existing engine's audit is round 2.

- `.app-title` becomes a real `<h1>` (fixing an existing gap - it is currently
  a `<span>`); landing sections use `<h2>`.
- Gallery thumbnails are `<button>` elements with accessible names, not
  clickable `<div>`s.
- Visible `:focus-visible` styling on every interactive element. The stylesheet
  currently has exactly one such rule, on the footer link.
- Focus moves into the engine (the visualizer picker) when the landing is
  dismissed.
- The landing's hero canvas carries `role="img"` and an `aria-label` derived
  from the entry caption.
- `prefers-reduced-motion` is honored; nothing on the landing auto-animates.
- Text contrast ≥ 4.5:1.

### 8. Band legend and nested percentile levels

`drawEnsembleChart` (`src/ui/comparison.ts:64`) currently paints a translucent
blue fill, a dashed grey median, and a pink real line, and writes only the
statistic's name. **There is no legend.** Add one.

Additionally, replace the single 5–95% band with **nested levels at 50 / 90 /
99%**. This is close to free: `percentileBands` (`src/nullmodel/bands.ts:18`)
sorts each index's column across the ensemble, and that sort is the entire
cost. Additional quantiles off an already-sorted array are O(1) apiece, so the
overhead is a few array reads per index against an O(N log N) sort already
being paid. No extra work in the worker, and no network cost at all - the
ensemble runs client-side over terms already in memory.

The payoff is that an outlier becomes *graded* rather than binary. Kolakoski's
0.000332 currently reads as "outside the band"; against nested levels it reads
as "outside the 99% contour", which is a stronger and more honest claim and is
legible without reading the numbers.

**Type change:** `Bands` becomes
`{ median: number[]; levels: Array<{ pct: number; lo: number[]; hi: number[] }> }`,
touching `bands.ts`, `ensemble.ts`, `comparison.ts`, and `app.ts`.

### 9. Cursor readout and linked markers

Add two **optional** methods to the `Visualizer` contract, inverse to each
other:

```ts
locate?(seq: SequenceView, params: Params, size: Size, x: number, y: number): Hit | null;
position?(seq: SequenceView, params: Params, size: Size, index: number): { x: number; y: number } | null;
```

Both derive from the mapping each visualizer already computes internally and
then discards - `strokePath` (`src/viz/turtle.ts:30`) calculates the exact
sequence-space→screen affine transform (`scale`, `ox`, `oy`) to draw with, and
throws it away. Retaining it makes a screen coordinate invert in three
arithmetic operations.

Optional is deliberate: not every view has a term under the cursor. A histogram
bar identifies a *set*, autocorrelation identifies a *lag*. Forcing a uniform
return would make those two answer falsely.

| View | `Hit` reports |
| --- | --- |
| scatter, mod grid, Ulam spiral | exact index - `n=42, a(42)=1` |
| turtle, polyarc | nearest path point → index (polyarc: 8 segments per term, `⌊ptIdx/8⌋`) |
| 2D digit walk | term *and* digit position |
| histogram | a bin - "47 terms in [12, 18)" |
| autocorrelation | a lag - "lag 7" |

**Rejected alternative:** a color-picking buffer (offscreen render with each
term colored by index, `getImageData` on click). Uniform and exact, but it
requires every visualizer to support a picking palette regardless, doubles
render cost, and cannot be tested without a canvas. `locate`/`position` are
assertable in pure JS - which matters here, given that 141 green tests once
missed three Critical defects because nothing executed the code at realistic
scale.

**Performance:** a click is trivial. Hover is an O(n) nearest-point scan,
acceptable to roughly 50k points on rAF-throttled `mousemove`. The 2D digit
walk's measured 418,487-point case gets a uniform bucket grid built once per
render *only if* it actually feels sluggish - not preemptively.

#### Linked markers across the comparison

Clicking a point on the real sequence marks the corresponding point in the
null. "Corresponding" is surrogate-dependent, and the asymmetry is pedagogical
rather than incidental:

- **Permutation** - same multiset, shuffled. Two honest correspondences: same
  *index*, or same *value*. Value-tracing is the valuable one: it shows the
  term survived intact and only its **position** changed, which is what was
  carrying the structure. Requires `makeSurrogate` to also return the
  permutation array (deterministic from the existing seed; one extra array).
- **Difference** - differences shuffled and re-integrated, so values do not
  survive. Index-to-index only.
- **Matched-random** - no term-level relationship. Index-to-index only.

That value-tracing works for exactly one of the three is worth surfacing in the
UI, not hiding: discovering you can follow a term through a permutation but not
through a matched-random teaches the difference between those null models by
interaction rather than by prose.

Per comparison mode:

- **`side`** - paired markers, one per panel.
- **`flip`** - the marker persists across the flip, anchoring the eye on one
  term while the substrate swaps beneath it.
- **`ensemble`** - no single surrogate exists, so clicking the real line
  highlights that index's **column of the null distribution** instead, reading
  out the nested levels at that index against the real value.

Design note: in grid and spiral views the layout is index-driven, so index *i*
occupies the same cell in both panels and only the colour differs. In
trajectory views the path is cumulative, so index *i* lands somewhere entirely
different in the null. The feature is most valuable precisely where the view is
cumulative - which is also where "is this structure real?" is hardest to judge
by eye.

## Data flow

```
page load
  └─ applyHash(location.hash)
       ├─ hash is "" or "gallery" or undecodable
       │    └─ mountLanding(entries)
       │         ├─ hero: render entry.sequence directly (no network)
       │         └─ strip: <button> per entry
       │              └─ click → applyHash('#' + encodeState(entry.state))
       │                   └─ dismiss landing → engine at that view
       └─ hash decodes to a UrlState
            └─ existing engine path, unchanged
```

## Error handling

- A gallery entry whose `state.vizId` is not in the registry is skipped at
  mount with a console warning rather than crashing the landing; the test suite
  catches this at build time so it should never reach production.
- Hero render failures fall back to the examples strip plus the engine link -
  the landing degrades to a menu rather than a blank screen.
- The landing never blocks on network, so there is no loading or timeout state
  to handle on first paint.

## Testing

- Every gallery entry round-trips through `encodeState`/`decodeState` and
  yields a `vizId` present in the registry.
- Every entry's `sequence.aNumber` agrees with its `state.seqRef`.
- Every visualizer and every surrogate has non-empty `explain.short` and
  `explain.long`.
- The landing renders with **zero network calls** (asserted by a failing
  `fetch` stub).
- Verdict verification: every entry carrying `evidence` has its statistic
  recomputed from the recorded surrogate/N/seed; the test fails on
  disagreement. Every entry with verdict `real` carries `evidence`.
- `Compare: off` leaves the surrogate dropdown disabled; selecting `flip`
  exposes and focuses the flip button.
- `percentileBands` returns nested levels whose bounds are monotonically
  ordered (99% band contains 90% contains 50%) for a known fixture.
- For every visualizer implementing them, `locate` and `position` round-trip:
  `locate(position(i)) === i` for a sample of indices at a realistic sequence
  length, not a toy one.
- Visualizers without a term-level answer (histogram, autocorrelation) either
  omit `locate` or return a non-index `Hit` kind - asserted, so a future
  contributor cannot quietly make them lie.
- Permutation surrogates expose an index map for which
  `surrogate[map[i]] === real[i]` holds across the sequence.
- The existing 182 tests remain green.

## Decisions to revisit

**The landing overlay vs. a real route.** Tracked at the user's request. The
overlay was chosen because a second path costs a CloudFront
`CustomErrorResponses` change (see §1). The trade-off accepted is that the
gallery is reachable at `#gallery` rather than at a clean path like `/gallery`.

Revisit if any of these become true:

- The gallery grows past roughly a dozen entries and wants its own browsable
  page with per-entry deep links.
- Search-engine indexing of individual gallery entries becomes desirable -
  a hash fragment is not indexable as a distinct URL.
- Per-state social preview cards are wanted, since that work requires
  edge compute anyway and would absorb the routing change at no extra cost.
- The landing accumulates enough content that it competes with the engine for
  the same DOM and the overlay starts to feel like a workaround.

## Deferred scope

**Round 2 - accessibility audit of the existing engine:** keyboard navigation,
contrast pass, ARIA and labelling across the sequence panel and comparison bar,
canvas text alternatives wired to the `explain` corpus built in this round.

**Round 3 - export, controls, and superimpose:** PNG image download, sequence
data download, feedback/issue channel (blocked on a decision about the private
repository), coloring choices including none, line width, gradient start/stop,
line shape, and a superimpose comparison mode. The line-shape question the user
raised - *would line shape make a difference?* - is itself a null-model
experiment and should be answered with the app's own machinery rather than
settled by preference.
