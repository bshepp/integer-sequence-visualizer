# Landing Gallery & Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site a front door - a landing screen that renders a real-vs-null comparison on first paint - plus the explanation corpus, band legend, and cursor readout that make every view legible on its own.

**Architecture:** The landing is an overlay state of the existing SPA, resolved in `applyHash` alongside the existing share-link path; a gallery entry is a saved `UrlState` plus prose plus a bundled `Sequence`, so clicking an image reuses the share-link path verbatim. Explanations become a required field on the `Visualizer` interface so `tsc` enforces coverage. Cursor identification adds an optional inverse pair (`locate`/`position`) built from the sequence-space→screen transforms the visualizers already compute and currently discard.

**Tech Stack:** Vite + TypeScript, Canvas 2D, Vitest, no runtime npm dependencies.

## Global Constraints

- **No runtime npm dependencies.** Nothing may be added to `dependencies` in `package.json`.
- **No `Math.random()` anywhere in `src/`.** All randomness goes through `mulberry32` (`src/nullmodel/rng.ts`) with an explicit seed.
- **Sequence terms are `bigint` throughout.** `SequenceView` is the sole float64 boundary.
- **No `Math.min(...array)` / `Math.max(...array)` spreads** over anything that scales with sequence length - use `minMax` from `src/viz/mathUtils.ts`. A 2001-term b-file's digit walk produces 418,487 points, past V8's ~250k argument limit.
- **OEIS attribution must survive.** Any sequence displayed with an A-number keeps that A-number and links to `https://oeis.org/<aNumber>`.
- **Every verdict claim in the gallery must be computed, not asserted.** See Task 14.
- Run `npm test` (Vitest) and `npm run build` (`tsc --noEmit && vite build`) before every commit.
- The existing 182 tests must stay green throughout.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/viz/hit.ts` | The `Hit` union - what `locate` returns. No logic. |
| `src/viz/pathTransform.ts` | Sequence-space→screen transform for path visualizers, extracted from `strokePath`; plus `nearestIndex`. |
| `src/gallery/entries.ts` | The curated `GalleryEntry[]`, with bundled sequences and evidence. |
| `src/gallery/types.ts` | `GalleryEntry`, `Evidence` types. |
| `src/gallery/sequences.ts` | Bundled term arrays for gallery sequences (data only). |
| `src/ui/landing.ts` | The landing overlay: hero, examples strip, engine link. |
| `src/ui/readout.ts` | Cursor tracking, `locate` dispatch, readout rendering, marker state. |
| `src/ui/explainPanel.ts` | The (i) panel showing `explain.long`. |
| `tests/viz/locate.test.ts` | `locate`/`position` round-trip across visualizers. |
| `tests/viz/explain.test.ts` | Every visualizer and surrogate documents itself. |
| `tests/gallery/entries.test.ts` | Entry integrity: round-trip, seqRef agreement, registry membership. |
| `tests/gallery/verdicts.test.ts` | Recomputes every `evidence` claim. |
| `tests/ui/landing.test.ts` | Routing, zero-network first paint, dismissal. |

**Modified:**

| File | Change |
| --- | --- |
| `src/nullmodel/bands.ts` | `Bands` becomes nested levels. |
| `src/nullmodel/ensemble.ts` | Pass levels through `EnsembleJob`. |
| `src/nullmodel/surrogates.ts` | Add `permutationWithMap`, add `SURROGATE_EXPLAIN`. |
| `src/viz/types.ts` | Add required `explain`, optional `locate`/`position`. |
| `src/viz/*.ts` (all nine) | Add `explain`; add `locate`/`position` where meaningful. |
| `src/viz/gridUtils.ts` | Add O(n) `spiralCoords(n)` and `spiralIndexMap`. |
| `src/viz/turtle.ts` | `strokePath` delegates to `pathTransform`. |
| `src/ui/comparison.ts` | Legend, nested band rendering, disable inert surrogate select. |
| `src/ui/app.ts` | Landing routing, readout wiring, `<h1>`, flip prominence. |
| `src/style.css` | Landing, legend, readout, focus-visible styles. |
| `index.html` | OG/Twitter meta, `<title>`, `lang` already present. |

---

## Task 1: Nested percentile bands

**Files:**
- Modify: `src/nullmodel/bands.ts`
- Modify: `src/nullmodel/ensemble.ts:17-19,45`
- Test: `tests/nullmodel/bands.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface BandLevel { pct: number; lo: number[]; hi: number[] }`, `interface Bands { median: number[]; levels: BandLevel[] }`, `const DEFAULT_LEVELS: number[]`, `percentileBands(arrays: number[][], levels?: number[]): Bands`, `bandAt(bands: Bands, pct: number): BandLevel | undefined`.

- [ ] **Step 1: Write the failing test**

Append to `tests/nullmodel/bands.test.ts`:

```ts
import { percentileBands, DEFAULT_LEVELS, bandAt } from '../../src/nullmodel/bands';

describe('nested percentile levels', () => {
  // 101 rows, column i = row index, so quantiles are exactly predictable.
  const arrays = Array.from({ length: 101 }, (_, r) => [r, r * 2]);

  it('produces one level per requested percentage, widest first', () => {
    const b = percentileBands(arrays, [50, 90, 99]);
    expect(b.levels.map((l) => l.pct)).toEqual([99, 90, 50]);
  });

  it('nests: each level is contained by the next wider one', () => {
    const b = percentileBands(arrays, DEFAULT_LEVELS);
    for (let i = 0; i + 1 < b.levels.length; i++) {
      const wide = b.levels[i]!, narrow = b.levels[i + 1]!;
      for (let j = 0; j < wide.lo.length; j++) {
        expect(wide.lo[j]!).toBeLessThanOrEqual(narrow.lo[j]!);
        expect(wide.hi[j]!).toBeGreaterThanOrEqual(narrow.hi[j]!);
      }
    }
  });

  it('the 90% level reproduces the old 5-95 band exactly', () => {
    const b = percentileBands(arrays, [90]);
    expect(b.levels[0]!.lo[0]).toBeCloseTo(5, 10);
    expect(b.levels[0]!.hi[0]).toBeCloseTo(95, 10);
  });

  it('median is unchanged by the level set', () => {
    expect(percentileBands(arrays, [50]).median[0]).toBeCloseTo(50, 10);
    expect(percentileBands(arrays, [99]).median[0]).toBeCloseTo(50, 10);
  });

  it('bandAt finds a level by percentage', () => {
    const b = percentileBands(arrays, [50, 90]);
    expect(bandAt(b, 90)?.pct).toBe(90);
    expect(bandAt(b, 75)).toBeUndefined();
  });

  it('still rejects ragged input', () => {
    expect(() => percentileBands([[1, 2], [3]])).toThrow(/ragged/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nullmodel/bands.test.ts`
Expected: FAIL - `DEFAULT_LEVELS` and `bandAt` are not exported; `b.levels` is undefined.

- [ ] **Step 3: Write the implementation**

Delete the existing `export interface Bands { lo: number[]; median: number[]; hi: number[]; }` on line 1 - the private `percentile` helper below it stays exactly as it is - and replace everything from the old `percentileBands` onward with:

```ts
export interface BandLevel { pct: number; lo: number[]; hi: number[]; }
export interface Bands { median: number[]; levels: BandLevel[]; }

// Widest first, so drawing them in array order paints wide-to-narrow and the
// narrower (more significant) levels land on top rather than being buried.
export const DEFAULT_LEVELS = [99, 90, 50];

export function bandAt(bands: Bands, pct: number): BandLevel | undefined {
  return bands.levels.find((l) => l.pct === pct);
}

// Extra quantiles are near-free: the per-index sort below is the entire cost
// of this function, and every additional level is O(1) lookups against an
// array that is already sorted. Going from one flat band to three nested ones
// therefore adds no meaningful work to the ensemble worker, while turning an
// outlier from a binary in/out read into a graded one.
export function percentileBands(arrays: number[][], levels: number[] = DEFAULT_LEVELS): Bands {
  if (arrays.length === 0) throw new Error('percentileBands: no arrays');
  const len = arrays[0]!.length;
  if (arrays.some((a) => a.length !== len)) throw new Error('percentileBands: ragged input');

  const sorted = [...levels].sort((a, b) => b - a); // widest first
  const median: number[] = [];
  const out: BandLevel[] = sorted.map((pct) => ({ pct, lo: [], hi: [] }));

  for (let i = 0; i < len; i++) {
    const col = arrays.map((a) => a[i]!).sort((x, y) => x - y);
    median.push(percentile(col, 50));
    for (let k = 0; k < sorted.length; k++) {
      const tail = (100 - sorted[k]!) / 2;
      out[k]!.lo.push(percentile(col, tail));
      out[k]!.hi.push(percentile(col, 100 - tail));
    }
  }
  return { median, levels: out };
}
```

- [ ] **Step 4: Update `ensemble.ts` to pass levels through**

In `src/nullmodel/ensemble.ts`, replace `loPct?: number; hiPct?: number;` in `EnsembleJob` with:

```ts
  levels?: number[];
```

and replace line 45 with:

```ts
    stats[key] = percentileBands(arrays, job.levels ?? undefined);
```

- [ ] **Step 5: Fix the two existing consumers so the suite compiles**

In `src/ui/comparison.ts`, `isDegenerateBand` reads `band.lo`/`band.hi`. Replace it with:

```ts
// Degenerate = the *widest* level has no width, i.e. no surrogate draw moved
// this statistic at all. NaN widths compare false against epsilon and so read
// as "not degenerate" - intentional fail-safe: drawing a possibly odd-looking
// band beats asserting a "zero width" explanation we cannot confirm. An empty
// level is vacuously degenerate (every() on []); harmless, since
// drawEnsembleChart has nothing to plot for a zero-length band regardless.
export function isDegenerateBand(band: Bands, epsilon = 1e-9): boolean {
  const widest = band.levels[0];
  if (!widest) return true;
  return widest.lo.every((lo, i) => (widest.hi[i]! - lo) < epsilon);
}
```

In `drawEnsembleChart`, two replacements by content (line numbers shift as you edit). Replace the line beginning `const all = [...band.lo, ...band.hi, ...realVals];` with:

```ts
    const all = [...band.levels.flatMap((l) => [...l.lo, ...l.hi]), ...realVals];
```

and replace the whole `// band fill` block (from `ctx.fillStyle = 'rgba(122,162,247,0.18)';` through its `ctx.fill();`) with:

```ts
    // Wide-to-narrow, increasing opacity: the innermost level reads darkest,
    // so how deep inside (or how far outside) the real line sits is legible
    // without reading any numbers.
    band.levels.forEach((level, li) => {
      ctx.fillStyle = `rgba(122,162,247,${0.10 + li * 0.07})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(level.hi[i]!));
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(level.lo[i]!));
      ctx.closePath();
      ctx.fill();
    });
```

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run build`
Expected: PASS. Fix any remaining `band.lo`/`band.hi` references the compiler flags.

- [ ] **Step 7: Commit**

```bash
git add src/nullmodel/bands.ts src/nullmodel/ensemble.ts src/ui/comparison.ts tests/nullmodel/bands.test.ts
git commit -m "feat: nested percentile levels replace the single flat null band"
```

---

## Task 2: Ensemble chart legend

**Files:**
- Modify: `src/ui/comparison.ts` (`drawEnsembleChart`)
- Test: `tests/ui/comparison.test.ts`

**Interfaces:**
- Consumes: `Bands` with `levels` (Task 1).
- Produces: no new exports; `drawEnsembleChart` gains a legend.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/comparison.test.ts`:

```ts
import { drawEnsembleChart } from '../../src/ui/comparison';
import { percentileBands } from '../../src/nullmodel/bands';
import { fakeCtx } from '../helpers/fakeCtx';

describe('ensemble chart legend', () => {
  it('labels the real line, the median, and every band level', () => {
    const bands = { r: percentileBands(Array.from({ length: 50 }, (_, k) => [k, k + 1])) };
    const { ctx, callLog } = fakeCtx();
    drawEnsembleChart(ctx, { width: 600, height: 400 }, { r: [1, 2] }, bands);

    const texts = callLog.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
    expect(texts.some((t) => /real sequence/i.test(t))).toBe(true);
    expect(texts.some((t) => /median/i.test(t))).toBe(true);
    expect(texts.some((t) => /99%/.test(t))).toBe(true);
    expect(texts.some((t) => /50%/.test(t))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/comparison.test.ts -t legend`
Expected: FAIL - no legend text is drawn.

- [ ] **Step 3: Implement the legend**

In `src/ui/comparison.ts`, add above `drawEnsembleChart`:

```ts
// Drawn once per statistic panel. Without this the chart is a blue smear, a
// dashed grey line and a pink line with nothing saying which is which - the
// single most important thing on screen was unlabelled.
function drawLegend(ctx: CanvasRenderingContext2D, band: Bands, left: number, top: number): void {
  const items: Array<{ swatch: string; dashed?: boolean; label: string }> = [
    { swatch: '#f7768e', label: 'real sequence' },
    { swatch: '#9aa0aa', dashed: true, label: 'null median' },
    ...band.levels.map((l, i) => ({
      swatch: `rgba(122,162,247,${0.10 + i * 0.07})`,
      label: `${l.pct}% of nulls`,
    })),
  ];
  ctx.font = '11px system-ui';
  ctx.textBaseline = 'middle';
  let y = top;
  for (const item of items) {
    if (item.dashed) {
      ctx.strokeStyle = item.swatch;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + 14, y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = item.swatch;
      ctx.fillRect(left, y - 4, 14, 8);
    }
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText(item.label, left + 20, y);
    y += 14;
  }
  ctx.textBaseline = 'alphabetic';
}
```

Then, inside the `keys.forEach` body of `drawEnsembleChart`, after the real line is stroked and the `key` label is drawn, add:

```ts
    drawLegend(ctx, band, size.width - MARGIN - 110, top + MARGIN);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/comparison.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/comparison.ts tests/ui/comparison.test.ts
git commit -m "feat: legend for the ensemble chart, which previously had none"
```

---

## Task 3: `explain` on every visualizer

**Files:**
- Modify: `src/viz/types.ts:11-19`
- Modify: all nine of `src/viz/{scatter,differences,histogram,autocorrelation,ulamSpiral,modGrid,turtle,digitWalk,polyarc}.ts`
- Test: `tests/viz/explain.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `interface Explain { short: string; long: string }` on `Visualizer.explain` (required).

- [ ] **Step 1: Write the failing test**

Create `tests/viz/explain.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, clearRegistry } from '../../src/viz/registry';

beforeAll(() => { clearRegistry(); registerAll(); });

describe('visualizer explanations', () => {
  it('registers all nine visualizers', () => {
    expect(allVisualizers()).toHaveLength(9);
  });

  for (const key of ['short', 'long'] as const) {
    it(`every visualizer has a non-empty explain.${key}`, () => {
      for (const v of allVisualizers()) {
        const text = v.explain[key];
        expect(typeof text, `${v.id}.explain.${key}`).toBe('string');
        expect(text.trim().length, `${v.id}.explain.${key} is empty`).toBeGreaterThan(0);
      }
    });
  }

  it('long explanations are substantive and mention the null model', () => {
    for (const v of allVisualizers()) {
      expect(v.explain.long.length, `${v.id}.explain.long too short`).toBeGreaterThan(80);
      expect(/null|surrogate|shuffl/i.test(v.explain.long), `${v.id}.explain.long never mentions the null`).toBe(true);
    }
  });

  it('short explanations stay on one line', () => {
    for (const v of allVisualizers()) {
      expect(v.explain.short).not.toContain('\n');
      expect(v.explain.short.length, `${v.id}.explain.short too long`).toBeLessThanOrEqual(120);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/explain.test.ts`
Expected: FAIL - `v.explain` is undefined.

- [ ] **Step 3: Add the required field to the interface**

In `src/viz/types.ts`, add above `Visualizer`:

```ts
export interface Explain {
  /** One line, shown under the picker. No newlines, <= 120 chars. */
  short: string;
  /** What it draws, and what a null model looks like in this view. */
  long: string;
}
```

and add to the `Visualizer` interface, after `minTerms: number;`:

```ts
  /**
   * Required, deliberately. Making this optional would mean coverage depends
   * on discipline; making it required means `tsc` refuses to compile until
   * every visualizer documents itself. The `long` text is also what the
   * canvas reports as its accessible description.
   */
  explain: Explain;
```

- [ ] **Step 4: Add `explain` to all nine visualizers**

Insert into each visualizer object literal, immediately after `minTerms`:

`src/viz/scatter.ts`:
```ts
  explain: {
    short: 'Each term plotted against its position in the sequence.',
    long: 'The plainest possible view: term value on the vertical axis, index along the horizontal. Growth rate, sign changes, and outliers are all visible here before any other technique is applied. Under a permutation null the same values reappear in scrambled order, so anything that survives the shuffle is a property of the value distribution rather than of the ordering.',
  },
```

`src/viz/differences.ts`:
```ts
  explain: {
    short: 'Successive differences a(n+1) - a(n), or successive ratios.',
    long: 'Differences expose additive structure and ratios expose multiplicative structure - a linear sequence has constant differences, a geometric one has constant ratios. Ratios are computed in log space, so Fibonacci converges visibly on the golden ratio instead of saturating. A difference surrogate reshuffles exactly this quantity, so comparing against it asks whether the *order* of the steps matters or only their multiset.',
  },
```

`src/viz/histogram.ts`:
```ts
  explain: {
    short: 'How often each value, gap, or digit occurs across the sequence.',
    long: 'Bins the chosen quantity and counts occurrences, discarding order entirely. Because order is discarded, a permutation null produces exactly the same histogram as the real sequence - which is itself informative: it proves the histogram can only ever tell you about the value distribution, never about arrangement. Difference and matched-random nulls do move it.',
  },
```

`src/viz/autocorrelation.ts`:
```ts
  explain: {
    short: 'How strongly the sequence resembles itself shifted by k places.',
    long: 'For each lag k, correlates the sequence against a copy of itself displaced by k. Peaks indicate periodicity or near-periodicity at that spacing. This is a pure ordering statistic, so a permutation null destroys it completely - a real sequence whose autocorrelation stays outside the null band at some lag has genuine repeating structure at that spacing.',
  },
```

`src/viz/ulamSpiral.ts`:
```ts
  explain: {
    short: 'Terms laid out along a square spiral, coloured by value.',
    long: 'Walks outward in a square spiral, one cell per term, colouring each cell from the term value. Ulam discovered that primes plotted this way fall on visible diagonals. Be careful here: the spiral path itself imposes strong geometry, so smooth or near-linear sequences produce beautiful rings and diagonals that say nothing about the sequence. Comparing against a permutation null is the check - if the pattern survives shuffling, the layout drew it, not the numbers.',
  },
```

`src/viz/modGrid.ts`:
```ts
  explain: {
    short: 'Terms in reading order, coloured by their remainder mod N.',
    long: 'A simple row-major grid, each cell coloured by the term remainder modulo N. Vertical stripes appear when the sequence has period dividing the column count, diagonal stripes when the period and column count are close but unequal. Because the layout is index-driven, a permutation null occupies the same cells with different colours - so any surviving stripe is a real periodicity, not a grid artifact.',
  },
```

`src/viz/turtle.ts`:
```ts
  explain: {
    short: 'A path that turns by an angle set by each term, mod k.',
    long: 'Starts at the origin and, for each term, turns by (angle x term mod k) degrees and steps forward one unit. The path is cumulative, so every term displaces everything drawn after it - which makes this view extremely sensitive to ordering and a good place to see a null model bite hard. A permutation surrogate of the same sequence typically wanders somewhere completely different.',
  },
```

`src/viz/digitWalk.ts`:
```ts
  explain: {
    short: 'A path stepping once per digit, in the direction that digit names.',
    long: 'Expands every term into its digits in the chosen base and steps one unit per digit, in the compass direction that digit indexes. Sequences with biased or structured digit distributions drift; uniform ones random-walk. Note this view has many more points than terms. Against a permutation null the digit multiset is unchanged but its arrangement is not, so persistent drift that survives shuffling comes from the digit distribution itself.',
  },
```

`src/viz/polyarc.ts`:
```ts
  explain: {
    short: 'An NCurve-style smooth curve, bending by each term mod N.',
    long: 'The technique from the SeqFan thread that prompted this project: each term bends the path by an angle set by its residue mod N, drawn as a smooth arc rather than a hard corner, optionally centring residues so they bend both ways. It produces strikingly organic shapes. Whether those shapes mean anything is exactly the open question here - compare against a null and see which features survive.',
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/viz/explain.test.ts && npm run build`
Expected: PASS, and `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add src/viz tests/viz/explain.test.ts
git commit -m "feat: require explain{short,long} on every visualizer, enforced by tsc"
```

---

## Task 4: Surrogate explanations and the (i) panel

**Files:**
- Modify: `src/nullmodel/surrogates.ts`
- Create: `src/ui/explainPanel.ts`
- Modify: `src/ui/app.ts` (mount the button beside the picker)
- Modify: `src/style.css`
- Test: `tests/viz/explain.test.ts`

**Interfaces:**
- Consumes: `Explain` (Task 3).
- Produces: `SURROGATE_EXPLAIN: Record<SurrogateType, Explain>`, `buildExplainPanel(): { el: HTMLElement; show(title: string, body: string): void; hide(): void }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/viz/explain.test.ts`:

```ts
import { SURROGATE_EXPLAIN } from '../../src/nullmodel/surrogates';

describe('surrogate explanations', () => {
  it('documents all three surrogate types', () => {
    for (const type of ['permutation', 'difference', 'matched'] as const) {
      expect(SURROGATE_EXPLAIN[type].short.trim().length).toBeGreaterThan(0);
      expect(SURROGATE_EXPLAIN[type].long.length).toBeGreaterThan(80);
    }
  });

  it('says which surrogates preserve the value multiset', () => {
    expect(/multiset|same values|same terms/i.test(SURROGATE_EXPLAIN.permutation.long)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/explain.test.ts -t surrogate`
Expected: FAIL - `SURROGATE_EXPLAIN` is not exported.

- [ ] **Step 3: Add the surrogate corpus**

Append to `src/nullmodel/surrogates.ts`:

```ts
import type { Explain } from '../viz/types';

export const SURROGATE_EXPLAIN: Record<SurrogateType, Explain> = {
  permutation: {
    short: 'The same terms in a random order.',
    long: 'Keeps the exact multiset of terms and shuffles their positions. Anything the real sequence shows that this null does not must come from the *ordering*, because nothing else differs. Conversely, any feature this null reproduces is a property of the values alone. This is the only surrogate in which an individual term can be traced from the real sequence to its new position, because it is the only one where the same terms are still present.',
  },
  difference: {
    short: 'The same steps between terms, taken in a random order.',
    long: 'Takes the successive differences, shuffles them, and re-integrates from the same starting term. Growth rate and step-size distribution survive; the arrangement of steps does not. Use this when the raw values are less interesting than how the sequence moves - it is a much tighter null than a permutation for anything monotone, because it will not destroy the overall trend.',
  },
  matched: {
    short: 'Fresh random numbers fitted to the same trend and spread.',
    long: 'Fits a linear or exponential trend to the sequence and generates new terms from that fit plus Gaussian noise scaled to the residual spread. The terms are entirely new, so nothing arithmetic about the original survives - only its scale and growth. This is the loosest null of the three and the strongest test to pass: structure that survives it is not explained by trend alone.',
  },
};
```

- [ ] **Step 4: Build the panel**

Create `src/ui/explainPanel.ts`:

```ts
export interface ExplainPanel {
  el: HTMLElement;
  show(title: string, body: string): void;
  hide(): void;
  isOpen(): boolean;
}

export function buildExplainPanel(): ExplainPanel {
  const el = document.createElement('div');
  el.className = 'explain-panel';
  el.hidden = true;
  // Announced by screen readers when it opens, and reachable by keyboard.
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');

  const heading = document.createElement('h2');
  heading.className = 'explain-title';
  const body = document.createElement('p');
  body.className = 'explain-body';

  const close = document.createElement('button');
  close.className = 'explain-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close explanation');
  close.textContent = '×';
  close.addEventListener('click', () => hide());

  el.append(close, heading, body);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  function hide(): void { el.hidden = true; }

  return {
    el,
    show(title, text) {
      heading.textContent = title;
      body.textContent = text;
      el.hidden = false;
      close.focus();
    },
    hide,
    isOpen: () => !el.hidden,
  };
}
```

- [ ] **Step 5: Mount it in `app.ts`**

In `src/ui/app.ts`, after `topbar.appendChild(picker);` add:

```ts
  const explain = buildExplainPanel();
  const explainBtn = document.createElement('button');
  explainBtn.className = 'explain-button';
  explainBtn.type = 'button';
  explainBtn.textContent = 'i';
  explainBtn.addEventListener('click', () => {
    const viz = getVisualizer(state.vizId);
    explain.show(viz.name, `${viz.explain.long}\n\nNull model - ${comparison.surrogate}: ${SURROGATE_EXPLAIN[comparison.surrogate].long}`);
  });
  topbar.appendChild(explainBtn);
  main.appendChild(explain.el);

  const vizShort = document.createElement('p');
  vizShort.className = 'viz-short';
  topbar.appendChild(vizShort);
```

Set `explainBtn`'s accessible name and keep `vizShort` current. Add to the top of `rebuildParams()`:

```ts
    const viz = getVisualizer(state.vizId);
    vizShort.textContent = viz.explain.short;
    explainBtn.setAttribute('aria-label', `What is the ${viz.name} view?`);
```

Add the imports at the top of `app.ts`:

```ts
import { buildExplainPanel } from './explainPanel';
import { SURROGATE_EXPLAIN } from '../nullmodel/surrogates';
```

- [ ] **Step 6: Style it**

Append to `src/style.css`:

```css
.explain-button {
  width: 24px; height: 24px; border-radius: 50%;
  background: #24262c; color: var(--accent);
  border: 1px solid #3a3d44; cursor: pointer;
  font: 600 13px/1 system-ui;
}
.viz-short { margin: 0; color: var(--muted); font-size: 12px; flex-basis: 100%; }
.explain-panel {
  position: absolute; z-index: 5; top: 12px; right: 12px; max-width: 380px;
  background: var(--panel); border: 1px solid #3a3d44; border-radius: 8px;
  padding: 14px 16px; box-shadow: 0 8px 28px rgba(0,0,0,0.5);
}
.explain-panel[hidden] { display: none; }
.explain-title { margin: 0 0 6px; font-size: 15px; }
.explain-body { margin: 0; color: var(--muted); font-size: 13px; white-space: pre-wrap; }
.explain-close {
  position: absolute; top: 6px; right: 8px; background: none; border: none;
  color: var(--muted); font-size: 18px; cursor: pointer; line-height: 1;
}
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 7: Run the suite**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/nullmodel/surrogates.ts src/ui/explainPanel.ts src/ui/app.ts src/style.css tests/viz/explain.test.ts
git commit -m "feat: surrogate explanation corpus and in-app (i) panel"
```

---

## Task 5: Fix the two inert controls

**Files:**
- Modify: `src/ui/comparison.ts:139-158,170-176`
- Modify: `src/style.css`
- Test: `tests/ui/comparison.test.ts`

**Interfaces:**
- Consumes: `buildComparisonBar` as it exists.
- Produces: same signature; the returned `refresh()` now also syncs disabled state.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/comparison.test.ts`:

```ts
import { buildComparisonBar, defaultComparison } from '../../src/ui/comparison';

describe('inert control fixes', () => {
  it('disables the surrogate select while comparison is off', () => {
    const state = defaultComparison();
    const bar = buildComparisonBar(state, () => {});
    const surr = bar.el.querySelector<HTMLSelectElement>('.surrogate-select')!;
    expect(state.mode).toBe('off');
    expect(surr.disabled).toBe(true);
    expect(surr.title).toMatch(/comparison/i);
  });

  it('enables the surrogate select once a comparison mode is chosen', () => {
    const state = defaultComparison();
    const bar = buildComparisonBar(state, () => {});
    const mode = bar.el.querySelector<HTMLSelectElement>('.mode-select')!;
    mode.value = 'side';
    mode.dispatchEvent(new Event('change'));
    expect(bar.el.querySelector<HTMLSelectElement>('.surrogate-select')!.disabled).toBe(false);
  });

  it('reveals and emphasises the flip button when flip is selected', () => {
    const state = defaultComparison();
    const bar = buildComparisonBar(state, () => {});
    const mode = bar.el.querySelector<HTMLSelectElement>('.mode-select')!;
    mode.value = 'flip';
    mode.dispatchEvent(new Event('change'));
    const flip = bar.el.querySelector<HTMLButtonElement>('.flip-button')!;
    expect(flip.hidden).toBe(false);
    expect(flip.classList.contains('flip-button--active')).toBe(true);
  });

  it('refresh() re-syncs disabled state from external mutation', () => {
    const state = defaultComparison();
    const bar = buildComparisonBar(state, () => {});
    state.mode = 'ensemble';
    bar.refresh();
    expect(bar.el.querySelector<HTMLSelectElement>('.surrogate-select')!.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/comparison.test.ts -t inert`
Expected: FAIL - the select is never disabled.

- [ ] **Step 3: Implement**

In `src/ui/comparison.ts`, replace the `modeSel` declaration and add a sync helper. The `flipBtn` and `surrSel` consts are declared after `modeSel`, so `syncMode` must be defined as a function declaration (hoisted) and only *called* from the change handler, never at construction time:

```ts
  // The surrogate select, the seed, and N all feed the null model - none of
  // which is consulted while mode is 'off'. Leaving them live meant a user
  // could cycle the null dropdown indefinitely with nothing redrawing, which
  // reads as a broken control rather than an unused one. Considered and
  // rejected: auto-switching mode to 'side' when the surrogate changes - a
  // control that silently changes a *different* control is worse than one
  // that is honestly unavailable.
  function syncMode(): void {
    const off = state.mode === 'off';
    surrSel.disabled = off;
    seedInput.disabled = off;
    nInput.disabled = state.mode !== 'ensemble';
    surrSel.title = off ? 'Choose a comparison mode to use a null model' : '';
    flipBtn.hidden = state.mode !== 'flip';
    // 'flip' renders the real sequence first, so without this the mode looks
    // identical to 'off' until the button is found. Emphasising it (and
    // focusing it) makes selecting the mode visibly do something.
    flipBtn.classList.toggle('flip-button--active', state.mode === 'flip');
  }

  const modeSel = mkSelect('mode-select', ['off', 'side', 'flip', 'ensemble'], state.mode,
    (v) => {
      state.mode = v as ComparisonMode;
      syncMode();
      if (state.mode === 'flip') flipBtn.focus();
    });
```

At the end of `buildComparisonBar`, before the `return`, call it once:

```ts
  syncMode();
```

and inside the returned `refresh()`, replace `flipBtn.hidden = state.mode !== 'flip';` with:

```ts
      syncMode();
```

- [ ] **Step 4: Style the active flip button**

Append to `src/style.css`:

```css
.flip-button--active {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
.comparison-bar select:disabled, .comparison-bar input:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ui/comparison.test.ts && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/comparison.ts src/style.css tests/ui/comparison.test.ts
git commit -m "fix: the null-model select and flip mode no longer look like dead controls"
```

---

## Task 6: The `Hit` type and the path transform

**Files:**
- Create: `src/viz/hit.ts`
- Create: `src/viz/pathTransform.ts`
- Modify: `src/viz/turtle.ts:18-45` (`strokePath` delegates)
- Modify: `src/viz/types.ts` (add optional `locate`/`position`)
- Test: `tests/viz/locate.test.ts` (create)

**Interfaces:**
- Consumes: `Size` from `./types`.
- Produces:
  - `type Hit = { kind: 'term'; index: number } | { kind: 'digit'; index: number; digitPos: number } | { kind: 'bin'; binIndex: number; lo: number; hi: number; count: number } | { kind: 'lag'; lag: number }`
  - `interface PathTransform { scale: number; ox: number; oy: number; height: number }`
  - `pathTransform(pts: Pt[], size: Size): PathTransform`
  - `toScreen(t: PathTransform, p: Pt): Pt`
  - `nearestIndex(pts: Pt[], t: PathTransform, x: number, y: number, maxDist?: number): number | null`
  - `Visualizer.locate?` and `Visualizer.position?`

- [ ] **Step 1: Write the failing test**

Create `tests/viz/locate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pathTransform, toScreen, nearestIndex } from '../../src/viz/pathTransform';

const SIZE = { width: 400, height: 300 };

describe('pathTransform', () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

  it('maps every point inside the canvas', () => {
    const t = pathTransform(pts, SIZE);
    for (const p of pts) {
      const s = toScreen(t, p);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(SIZE.width);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(SIZE.height);
    }
  });

  it('round-trips: the nearest point to a projected point is that point', () => {
    const t = pathTransform(pts, SIZE);
    pts.forEach((p, i) => {
      const s = toScreen(t, p);
      expect(nearestIndex(pts, t, s.x, s.y)).toBe(i);
    });
  });

  it('returns null when the cursor is far from every point', () => {
    const t = pathTransform(pts, SIZE);
    expect(nearestIndex(pts, t, -500, -500, 10)).toBeNull();
  });

  it('survives a degenerate single-point path without dividing by zero', () => {
    const t = pathTransform([{ x: 5, y: 5 }], SIZE);
    const s = toScreen(t, { x: 5, y: 5 });
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Number.isFinite(s.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/locate.test.ts`
Expected: FAIL - module `src/viz/pathTransform` not found.

- [ ] **Step 3: Create `src/viz/hit.ts`**

```ts
/**
 * What sits under the cursor. Deliberately a union rather than a bare index:
 * not every view has a term under the pointer. A histogram bar identifies a
 * *set* of terms and an autocorrelation bar identifies a *lag*, so forcing
 * them to return an index would make them answer falsely.
 */
export type Hit =
  | { kind: 'term'; index: number }
  | { kind: 'digit'; index: number; digitPos: number }
  | { kind: 'bin'; binIndex: number; lo: number; hi: number; count: number }
  | { kind: 'lag'; lag: number };

/** The term index a hit refers to, when it refers to one at all. */
export function hitIndex(hit: Hit | null): number | null {
  if (!hit) return null;
  return hit.kind === 'term' || hit.kind === 'digit' ? hit.index : null;
}
```

- [ ] **Step 4: Create `src/viz/pathTransform.ts`**

```ts
import type { Size } from './types';
import { minMax } from './mathUtils';

export interface Pt { x: number; y: number; }

export interface PathTransform {
  scale: number;
  ox: number;
  oy: number;
  height: number;
}

const PAD = 0.1;

/**
 * The sequence-space -> screen mapping that strokePath used to compute inline
 * and then discard. Extracted so a click can be inverted through the exact
 * same numbers the drawing used - anything else would put the marker
 * somewhere the line is not.
 */
export function pathTransform(pts: Pt[], size: Size): PathTransform {
  // Loop-based min/max, never a spread: a 2001-term b-file's digit walk
  // produces 418,487 points, well past V8's ~250k argument limit.
  const { lo: minX, hi: maxX } = minMax(pts.map((p) => p.x));
  const { lo: minY, hi: maxY } = minMax(pts.map((p) => p.y));
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const scale = Math.min((size.width * (1 - 2 * PAD)) / spanX, (size.height * (1 - 2 * PAD)) / spanY);
  return {
    scale,
    ox: (size.width - spanX * scale) / 2 - minX * scale,
    oy: (size.height - spanY * scale) / 2 - minY * scale,
    height: size.height,
  };
}

export function toScreen(t: PathTransform, p: Pt): Pt {
  // Canvas y grows downward; the drawing flips so the path matches maths
  // orientation, and this must flip identically.
  return { x: p.x * t.scale + t.ox, y: t.height - (p.y * t.scale + t.oy) };
}

/**
 * Nearest point to a screen coordinate, or null if nothing is within
 * maxDist pixels. O(n) - fine for a click, and fine for rAF-throttled hover
 * up to roughly 50k points. Bucket only if a specific view measurably drags.
 */
export function nearestIndex(
  pts: Pt[], t: PathTransform, x: number, y: number, maxDist = 24,
): number | null {
  let best = -1, bestD2 = maxDist * maxDist;
  for (let i = 0; i < pts.length; i++) {
    const s = toScreen(t, pts[i]!);
    const dx = s.x - x, dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) { bestD2 = d2; best = i; }
  }
  return best === -1 ? null : best;
}
```

- [ ] **Step 5: Make `strokePath` delegate**

Replace `src/viz/turtle.ts` lines 18-45 with:

```ts
export function strokePath(
  pts: Array<{ x: number; y: number }>,
  ctx: CanvasRenderingContext2D,
  size: Size,
): void {
  const t = pathTransform(pts, size);
  ctx.lineWidth = 1.25;
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = `hsl(${(i / pts.length) * 300}, 70%, 60%)`;
    const a = toScreen(t, pts[i - 1]!), b = toScreen(t, pts[i]!);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
```

and replace the `minMax` import with:

```ts
import { pathTransform, toScreen } from './pathTransform';
```

- [ ] **Step 6: Extend the `Visualizer` interface**

In `src/viz/types.ts`, add to `Visualizer` after `statistics?`:

```ts
  /**
   * What is under the screen coordinate (x, y), or null. Optional: a view
   * with no term-level answer (histogram, autocorrelation) may return a
   * non-term Hit kind, and a view with no answer at all may omit this.
   */
  locate?(seq: SequenceView, params: Params, size: Size, x: number, y: number): Hit | null;
  /** Inverse of locate for a term index - where that term is drawn. */
  position?(seq: SequenceView, params: Params, size: Size, index: number): { x: number; y: number } | null;
```

and add the import:

```ts
import type { Hit } from './hit';
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/viz && npm run build`
Expected: PASS, including the existing trajectory tests (`strokePath` behaviour is unchanged).

- [ ] **Step 8: Commit**

```bash
git add src/viz/hit.ts src/viz/pathTransform.ts src/viz/turtle.ts src/viz/types.ts tests/viz/locate.test.ts
git commit -m "feat: extract the path transform strokePath was discarding, add Hit type"
```

---

## Task 7: `locate`/`position` for the grid family

**Files:**
- Modify: `src/viz/gridUtils.ts`
- Modify: `src/viz/ulamSpiral.ts`
- Modify: `src/viz/modGrid.ts`
- Test: `tests/viz/locate.test.ts`

**Interfaces:**
- Consumes: `Hit` (Task 6).
- Produces: `spiralCoords(n: number): Pt[]` (O(n)), `spiralLayout(n, size): { coords, cell, ox, oy, minX, maxY }`.

- [ ] **Step 1: Write the failing test**

Append to `tests/viz/locate.test.ts`:

```ts
import { spiralCoord, spiralCoords } from '../../src/viz/gridUtils';
import { ulamViz } from '../../src/viz/ulamSpiral';
import { modGridViz } from '../../src/viz/modGrid';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';

const mk = (terms: bigint[]) =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('spiralCoords', () => {
  it('matches spiralCoord element for element', () => {
    const all = spiralCoords(50);
    for (let i = 0; i < 50; i++) expect(all[i]).toEqual(spiralCoord(i));
  });
});

describe('grid locate/position round-trip', () => {
  // 300 terms, not a toy length: the transform depends on the bounding box,
  // which only becomes interesting once the spiral has wound several times.
  const seq = mk(Array.from({ length: 300 }, (_, i) => BigInt(i)));

  for (const viz of [ulamViz, modGridViz]) {
    it(`${viz.id}: locate(position(i)) === i`, () => {
      const params = defaultParams(viz.params);
      for (const i of [0, 1, 7, 42, 150, 299]) {
        const p = viz.position!(seq, params, SIZE, i);
        expect(p, `position(${i}) returned null`).not.toBeNull();
        expect(viz.locate!(seq, params, SIZE, p!.x, p!.y)).toEqual({ kind: 'term', index: i });
      }
    });

    it(`${viz.id}: returns null outside the drawn area`, () => {
      const params = defaultParams(viz.params);
      expect(viz.locate!(seq, params, SIZE, -50, -50)).toBeNull();
      expect(viz.locate!(seq, params, SIZE, 10_000, 10_000)).toBeNull();
    });

    it(`${viz.id}: position is null for an out-of-range index`, () => {
      expect(viz.position!(seq, defaultParams(viz.params), SIZE, 5000)).toBeNull();
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/locate.test.ts -t grid`
Expected: FAIL - `spiralCoords` is not exported and `viz.position` is undefined.

- [ ] **Step 3: Add O(n) spiral coords and a shared layout**

Append to `src/viz/gridUtils.ts`:

```ts
import type { Size } from './types';
import { minMax } from './mathUtils';

/**
 * All spiral coordinates up to n in a single O(n) walk. spiralCoord(i)
 * restarts the walk each call, so building the whole list from it is O(n^2);
 * render already paid that, and locate would have paid it again on every
 * pointer move.
 */
export function spiralCoords(n: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  let x = 0, y = 0, dir = 0, run = 1, stepsInRun = 0, runsAtThisLength = 0;
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
  for (let i = 0; i < n; i++) {
    out.push({ x, y });
    x += dx[dir]!;
    y += dy[dir]!;
    stepsInRun++;
    if (stepsInRun === run) {
      stepsInRun = 0;
      dir = (dir + 1) % 4;
      runsAtThisLength++;
      if (runsAtThisLength === 2) { runsAtThisLength = 0; run++; }
    }
  }
  return out;
}

export interface SpiralLayout {
  coords: Array<{ x: number; y: number }>;
  cell: number; ox: number; oy: number; minX: number; maxY: number;
  cols: number; rows: number;
}

/** The exact layout render() uses, so locate inverts the same numbers. */
export function spiralLayout(n: number, size: Size): SpiralLayout {
  const coords = spiralCoords(n);
  const { lo: minX, hi: maxX } = minMax(coords.map((c) => c.x));
  const { lo: minY, hi: maxY } = minMax(coords.map((c) => c.y));
  const cols = maxX - minX + 1, rows = maxY - minY + 1;
  const cell = Math.max(1, Math.floor(Math.min(size.width / cols, size.height / rows)));
  return {
    coords, cell, cols, rows, minX, maxY,
    ox: (size.width - cols * cell) / 2,
    oy: (size.height - rows * cell) / 2,
  };
}
```

- [ ] **Step 4: Wire up `ulamSpiral.ts`**

Replace the body of `render` in `src/viz/ulamSpiral.ts` with the shared layout, and add the two new methods:

```ts
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const n = seq.length;
    const L = spiralLayout(n, size);
    let maxLog = 0;
    for (let i = 0; i < n; i++) maxLog = Math.max(maxLog, seq.logMagnitude(i));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cellColor(seq, i, String(params.colorBy), Number(params.modulus), maxLog);
      const c = L.coords[i]!;
      // canvas y grows downward; flip so the spiral matches math orientation
      ctx.fillRect(L.ox + (c.x - L.minX) * L.cell, L.oy + (L.maxY - c.y) * L.cell, L.cell, L.cell);
    }
  },
  position(seq: SequenceView, _params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const L = spiralLayout(seq.length, size);
    const c = L.coords[index]!;
    // Centre of the cell, so locate() maps it back unambiguously.
    return {
      x: L.ox + (c.x - L.minX) * L.cell + L.cell / 2,
      y: L.oy + (L.maxY - c.y) * L.cell + L.cell / 2,
    };
  },
  locate(seq: SequenceView, _params: Params, size: Size, x: number, y: number) {
    const L = spiralLayout(seq.length, size);
    const col = Math.floor((x - L.ox) / L.cell);
    const row = Math.floor((y - L.oy) / L.cell);
    if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) return null;
    const cx = col + L.minX, cy = L.maxY - row;
    // Linear scan rather than a Map: building a Map costs O(n) allocations on
    // every pointer move, and n here is the term count (never the digit-walk
    // blow-up), so the scan is cheaper in practice and allocates nothing.
    for (let i = 0; i < L.coords.length; i++) {
      const c = L.coords[i]!;
      if (c.x === cx && c.y === cy) return { kind: 'term' as const, index: i };
    }
    return null;
  },
```

Replace the imports at the top with:

```ts
import { spiralLayout } from './gridUtils';
```

(`spiralCoord` and `minMax` are no longer used here.)

- [ ] **Step 5: Wire up `modGrid.ts`**

Add a shared layout helper and the two methods to `src/viz/modGrid.ts`:

```ts
function layout(n: number, params: Params, size: Size) {
  const cols = Number(params.columns);
  const rows = Math.ceil(n / cols);
  const cell = Math.max(1, Math.floor(Math.min(size.width / cols, size.height / rows)));
  return {
    cols, rows, cell,
    ox: (size.width - cols * cell) / 2,
    oy: (size.height - rows * cell) / 2,
  };
}
```

Replace `render`'s first five lines with `const L = layout(seq.length, params, size);` (using `L.cell`, `L.ox`, `L.oy`, `L.cols` below), and add:

```ts
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const L = layout(seq.length, params, size);
    return {
      x: L.ox + (index % L.cols) * L.cell + L.cell / 2,
      y: L.oy + Math.floor(index / L.cols) * L.cell + L.cell / 2,
    };
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const L = layout(seq.length, params, size);
    const col = Math.floor((x - L.ox) / L.cell);
    const row = Math.floor((y - L.oy) / L.cell);
    if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) return null;
    const index = row * L.cols + col;
    return index < seq.length ? { kind: 'term' as const, index } : null;
  },
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/viz && npm run build`
Expected: PASS, including the existing `tests/viz/grid.test.ts` spiral test.

- [ ] **Step 7: Commit**

```bash
git add src/viz/gridUtils.ts src/viz/ulamSpiral.ts src/viz/modGrid.ts tests/viz/locate.test.ts
git commit -m "feat: locate/position for the grid family, plus an O(n) spiral walk"
```

---

## Task 8: `locate`/`position` for the basic family

**Files:**
- Modify: `src/viz/scatter.ts`
- Modify: `src/viz/differences.ts`
- Test: `tests/viz/locate.test.ts`

**Interfaces:**
- Consumes: `Hit`.
- Produces: `locate`/`position` on `scatterViz` and `differencesViz`.

- [ ] **Step 1: Write the failing test**

Append to `tests/viz/locate.test.ts`:

```ts
import { scatterViz } from '../../src/viz/scatter';
import { differencesViz } from '../../src/viz/differences';

describe('basic family locate/position round-trip', () => {
  const seq = mk(Array.from({ length: 300 }, (_, i) => BigInt(i * i)));

  for (const viz of [scatterViz, differencesViz]) {
    it(`${viz.id}: locate(position(i)) === i`, () => {
      const params = defaultParams(viz.params);
      for (const i of [0, 5, 120, 250]) {
        const p = viz.position!(seq, params, SIZE, i);
        expect(p).not.toBeNull();
        expect(viz.locate!(seq, params, SIZE, p!.x, p!.y)).toEqual({ kind: 'term', index: i });
      }
    });

    it(`${viz.id}: returns null left of the plot margin`, () => {
      expect(viz.locate!(seq, defaultParams(viz.params), SIZE, 0, 150)).toBeNull();
    });
  }

  it('differences reports the earlier index of the pair it plots', () => {
    // differences plots n-1 points for n terms: point i is a(i+1) - a(i).
    const params = defaultParams(differencesViz.params);
    const last = differencesViz.locate!(seq, params, SIZE, SIZE.width - 28, 150);
    expect(last?.kind).toBe('term');
    expect((last as { index: number }).index).toBeLessThan(seq.length - 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/locate.test.ts -t basic`
Expected: FAIL - `viz.position` is undefined.

- [ ] **Step 3: Implement for `scatter.ts`**

Both files use the identical `x(i)` mapping, so each gets its own small inverse next to the mapping it inverts. In `src/viz/scatter.ts`, add to `scatterViz`:

```ts
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    const vals = values(seq, String(params.scale));
    if (index < 0 || index >= vals.length) return null;
    const { lo: rawLo, hi: rawHi } = minMax(vals);
    const lo = Math.min(rawLo, 0), hi = Math.max(rawHi, 1);
    const w = size.width - 2 * MARGIN, h = size.height - 2 * MARGIN;
    return {
      x: MARGIN + (index / Math.max(1, vals.length - 1)) * w,
      y: MARGIN + h - ((vals[index]! - lo) / (hi - lo || 1)) * h,
    };
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, _y: number) {
    // Index is a pure function of x here, so vertical position is ignored -
    // the user is pointing at a column of the plot, not hunting a dot.
    const n = values(seq, String(params.scale)).length;
    const w = size.width - 2 * MARGIN;
    if (x < MARGIN || x > MARGIN + w || n === 0) return null;
    const index = Math.round(((x - MARGIN) / w) * Math.max(1, n - 1));
    return index >= 0 && index < n ? { kind: 'term' as const, index } : null;
  },
```

- [ ] **Step 4: Implement for `differences.ts`**

Add to `differencesViz`:

```ts
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    const vals = derived(seq, params);
    if (index < 0 || index >= vals.length) return null;
    const { lo: rawLo, hi: rawHi } = minMax(vals);
    const lo = Math.min(rawLo, 0), hi = Math.max(rawHi, 1);
    const w = size.width - 2 * MARGIN, h = size.height - 2 * MARGIN;
    return {
      x: MARGIN + (index / Math.max(1, vals.length - 1)) * w,
      y: MARGIN + h - ((vals[index]! - lo) / (hi - lo || 1)) * h,
    };
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, _y: number) {
    // Plots n-1 points for n terms: point i is the step from a(i) to a(i+1),
    // so the reported index is the earlier term of the pair.
    const n = derived(seq, params).length;
    const w = size.width - 2 * MARGIN;
    if (x < MARGIN || x > MARGIN + w || n === 0) return null;
    const index = Math.round(((x - MARGIN) / w) * Math.max(1, n - 1));
    return index >= 0 && index < n ? { kind: 'term' as const, index } : null;
  },
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/viz/locate.test.ts && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/viz/scatter.ts src/viz/differences.ts tests/viz/locate.test.ts
git commit -m "feat: locate/position for scatter and differences"
```

---

## Task 9: `locate`/`position` for trajectory and stats

**Files:**
- Modify: `src/viz/turtle.ts`, `src/viz/polyarc.ts`, `src/viz/digitWalk.ts`
- Modify: `src/viz/histogram.ts`, `src/viz/autocorrelation.ts`
- Test: `tests/viz/locate.test.ts`

**Interfaces:**
- Consumes: `pathTransform`, `toScreen`, `nearestIndex` (Task 6).
- Produces: `locate`/`position` on all five.

- [ ] **Step 1: Write the failing test**

Append to `tests/viz/locate.test.ts`:

```ts
import { turtleViz } from '../../src/viz/turtle';
import { polyarcViz } from '../../src/viz/polyarc';
import { digitWalkViz } from '../../src/viz/digitWalk';
import { histogramViz } from '../../src/viz/histogram';
import { autocorrViz } from '../../src/viz/autocorrelation';

describe('trajectory family locate/position round-trip', () => {
  const seq = mk(Array.from({ length: 200 }, (_, i) => BigInt(i * 7 + 3)));

  for (const viz of [turtleViz, polyarcViz]) {
    it(`${viz.id}: locate(position(i)) === i`, () => {
      const params = defaultParams(viz.params);
      for (const i of [0, 10, 99, 199]) {
        const p = viz.position!(seq, params, SIZE, i);
        expect(p, `position(${i}) null`).not.toBeNull();
        expect(viz.locate!(seq, params, SIZE, p!.x, p!.y)).toEqual({ kind: 'term', index: i });
      }
    });
  }

  it('digitwalk reports the term and the digit position', () => {
    const params = defaultParams(digitWalkViz.params);
    const p = digitWalkViz.position!(seq, params, SIZE, 50);
    const hit = digitWalkViz.locate!(seq, params, SIZE, p!.x, p!.y);
    expect(hit?.kind).toBe('digit');
    expect((hit as { index: number }).index).toBe(50);
    expect((hit as { digitPos: number }).digitPos).toBeGreaterThanOrEqual(0);
  });
});

describe('stats family reports non-term hits', () => {
  const seq = mk(Array.from({ length: 200 }, (_, i) => BigInt(i % 17)));

  it('histogram reports a bin with its range and count', () => {
    const params = defaultParams(histogramViz.params);
    const hit = histogramViz.locate!(seq, params, SIZE, SIZE.width / 2, SIZE.height / 2);
    expect(hit?.kind).toBe('bin');
    const bin = hit as { binIndex: number; lo: number; hi: number; count: number };
    expect(bin.hi).toBeGreaterThan(bin.lo);
    expect(bin.count).toBeGreaterThanOrEqual(0);
  });

  it('autocorrelation reports a lag, never a term', () => {
    const params = defaultParams(autocorrViz.params);
    const hit = autocorrViz.locate!(seq, params, SIZE, SIZE.width / 2, SIZE.height / 2);
    expect(hit?.kind).toBe('lag');
  });

  it('neither stats view offers position()', () => {
    // There is no single screen point for "term i" in either view.
    expect(histogramViz.position).toBeUndefined();
    expect(autocorrViz.position).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/locate.test.ts -t trajectory`
Expected: FAIL - methods undefined.

- [ ] **Step 3: Implement turtle**

Add to `turtleViz` in `src/viz/turtle.ts` (`turtlePath` pushes the origin first, so path point `i+1` corresponds to term `i`):

```ts
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const pts = turtlePath(seq, Number(params.angle), Number(params.k));
    return toScreen(pathTransform(pts, size), pts[index + 1]!);
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const pts = turtlePath(seq, Number(params.angle), Number(params.k));
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null) return null;
    // pts[0] is the origin, before any term has been applied.
    const index = Math.max(0, p - 1);
    return index < seq.length ? { kind: 'term' as const, index } : null;
  },
```

Extend the import to `import { pathTransform, toScreen, nearestIndex } from './pathTransform';`

- [ ] **Step 4: Implement polyarc**

Add to `polyarcViz` in `src/viz/polyarc.ts` (8 segments per term, plus the origin point):

```ts
const SEGMENTS = 8;

// ... inside polyarcViz:
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const pts = polyarcPath(seq, {
      angle: Number(params.angle), modulus: Number(params.modulus),
      centered: Boolean(params.centered),
    });
    // Last segment of term `index`, i.e. where that term finished bending.
    return toScreen(pathTransform(pts, size), pts[Math.min(pts.length - 1, (index + 1) * SEGMENTS)]!);
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const pts = polyarcPath(seq, {
      angle: Number(params.angle), modulus: Number(params.modulus),
      centered: Boolean(params.centered),
    });
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null) return null;
    const index = Math.min(seq.length - 1, Math.max(0, Math.floor((p - 1) / SEGMENTS)));
    return { kind: 'term' as const, index };
  },
```

Replace `opts.segments ?? 8` in `polyarcPath` with `opts.segments ?? SEGMENTS` and import `pathTransform, toScreen, nearestIndex` from `./pathTransform`.

- [ ] **Step 5: Implement digitWalk**

`digitWalkPath` pushes one point per digit. Build the index map alongside so a point maps back to (term, digit). Add to `src/viz/digitWalk.ts`:

```ts
/** For each path point after the origin, which term and which digit made it. */
export function digitWalkOwners(seq: SequenceView, base: number): Array<{ index: number; digitPos: number }> {
  const owners: Array<{ index: number; digitPos: number }> = [];
  for (let i = 0; i < seq.length; i++) {
    const ds = seq.digits(i, base);
    for (let d = 0; d < ds.length; d++) owners.push({ index: i, digitPos: d });
  }
  return owners;
}
```

and to `digitWalkViz`:

```ts
  position(seq: SequenceView, params: Params, size: Size, index: number) {
    if (index < 0 || index >= seq.length) return null;
    const base = Number(params.base);
    const owners = digitWalkOwners(seq, base);
    const at = owners.findIndex((o) => o.index === index);
    if (at === -1) return null;
    const pts = digitWalkPath(seq, base);
    return toScreen(pathTransform(pts, size), pts[at + 1]!);
  },
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const base = Number(params.base);
    const pts = digitWalkPath(seq, base);
    const p = nearestIndex(pts, pathTransform(pts, size), x, y);
    if (p === null || p === 0) return null;
    const owner = digitWalkOwners(seq, base)[p - 1];
    return owner ? { kind: 'digit' as const, index: owner.index, digitPos: owner.digitPos } : null;
  },
```

Import `pathTransform, toScreen, nearestIndex` from `./pathTransform`.

- [ ] **Step 6: Implement the stats views**

Add to `histogramViz` in `src/viz/histogram.ts` - no `position`, because a bin has no single term:

```ts
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const { edges, counts } = computeHistogram(
      targetValues(seq, String(params.target), overrideFromParams(params)),
      Number(params.bins),
      domainFromParams(params),
    );
    const w = size.width - 2 * MARGIN, h = size.height - 2 * MARGIN;
    if (x < MARGIN || x > MARGIN + w || y < MARGIN || y > MARGIN + h) return null;
    const binIndex = Math.min(counts.length - 1, Math.floor(((x - MARGIN) / w) * counts.length));
    if (binIndex < 0) return null;
    return {
      kind: 'bin' as const,
      binIndex,
      lo: edges[binIndex]!,
      hi: edges[binIndex + 1]!,
      count: counts[binIndex]!,
    };
  },
```

Add to `autocorrViz` in `src/viz/autocorrelation.ts`:

```ts
  locate(seq: SequenceView, params: Params, size: Size, x: number, y: number) {
    const maxLag = Math.min(Number(params.maxLag), seq.length - 2);
    const w = size.width - 2 * MARGIN, h = size.height - 2 * MARGIN;
    if (x < MARGIN || x > MARGIN + w || y < MARGIN || y > MARGIN + h) return null;
    const lag = Math.round(((x - MARGIN) / w) * maxLag);
    return lag >= 0 && lag <= maxLag ? { kind: 'lag' as const, lag } : null;
  },
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/viz && npm run build`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/viz tests/viz/locate.test.ts
git commit -m "feat: locate for trajectory and stats families, with honest non-term hit kinds"
```

---

## Task 10: Permutation index map

**Files:**
- Modify: `src/nullmodel/surrogates.ts`
- Test: `tests/nullmodel/surrogates.test.ts`

**Interfaces:**
- Consumes: `mulberry32`, `shuffleInPlace`.
- Produces: `permutationWithMap(terms: bigint[], seed: number): { terms: bigint[]; map: number[] }` where `result.terms[result.map[i]] === terms[i]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/nullmodel/surrogates.test.ts`:

```ts
import { permutationWithMap, permutationSurrogate } from '../../src/nullmodel/surrogates';

describe('permutationWithMap', () => {
  const terms = Array.from({ length: 200 }, (_, i) => BigInt(i));

  it('map sends each real index to where that term landed', () => {
    const { terms: shuffled, map } = permutationWithMap(terms, 7);
    for (let i = 0; i < terms.length; i++) {
      expect(shuffled[map[i]!]).toBe(terms[i]);
    }
  });

  it('map is a genuine permutation of the indices', () => {
    const { map } = permutationWithMap(terms, 7);
    expect([...map].sort((a, b) => a - b)).toEqual(terms.map((_, i) => i));
  });

  it('produces the same terms as permutationSurrogate for the same seed', () => {
    expect(permutationWithMap(terms, 3).terms).toEqual(permutationSurrogate(terms, 3));
  });

  it('handles an empty sequence', () => {
    expect(permutationWithMap([], 1)).toEqual({ terms: [], map: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nullmodel/surrogates.test.ts -t permutationWithMap`
Expected: FAIL - not exported.

- [ ] **Step 3: Implement**

Append to `src/nullmodel/surrogates.ts`:

```ts
/**
 * A permutation surrogate that also reports where every term went.
 *
 * Needed because permutation is the only surrogate under which an individual
 * term still exists in the null - the multiset is preserved - so it is the
 * only one where "follow this term into the null model" is a meaningful
 * request. Difference and matched-random surrogates contain entirely new
 * values, so only index-to-index correspondence is honest there.
 *
 * Shuffles an index array with the identical seeded stream permutationSurrogate
 * uses, so `terms` here is byte-for-byte what that function returns.
 */
export function permutationWithMap(terms: bigint[], seed: number): { terms: bigint[]; map: number[] } {
  const order = terms.map((_, i) => i);
  shuffleInPlace(order, mulberry32(seed));
  const out = order.map((src) => terms[src]!);
  // order[j] = which real index supplies slot j; invert to get map[i] = slot.
  const map = new Array<number>(terms.length);
  for (let j = 0; j < order.length; j++) map[order[j]!] = j;
  return { terms: out, map };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nullmodel/surrogates.test.ts`
Expected: PASS. If `permutationWithMap(terms, s).terms` differs from `permutationSurrogate(terms, s)`, the two are consuming the RNG stream differently - make `permutationSurrogate` delegate to `permutationWithMap(...).terms` so there is exactly one shuffle implementation.

- [ ] **Step 5: Commit**

```bash
git add src/nullmodel/surrogates.ts tests/nullmodel/surrogates.test.ts
git commit -m "feat: permutation surrogate reports where each term landed"
```

---

## Task 11: Cursor readout

**Files:**
- Create: `src/ui/readout.ts`
- Modify: `src/ui/app.ts`
- Modify: `src/style.css`
- Test: `tests/ui/readout.test.ts` (create)

**Interfaces:**
- Consumes: `Hit`, `hitIndex`, `Visualizer.locate`.
- Produces: `describeHit(hit: Hit, seq: SequenceView, aNumber?: string): string`, `buildReadout(): { el: HTMLElement; set(text: string | null): void }`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/readout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { describeHit } from '../../src/ui/readout';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const seq = new SequenceView({
  terms: [0n, 1n, 1n, 2n, 3n, 5n, 8n], name: 'Fibonacci', offset: 0, source: 'oeis', aNumber: 'A000045',
} as Sequence);

describe('describeHit', () => {
  it('names the index and the exact term for a term hit', () => {
    expect(describeHit({ kind: 'term', index: 5 }, seq)).toContain('n = 5');
    expect(describeHit({ kind: 'term', index: 5 }, seq)).toContain('5');
  });

  it('reports full BigInt precision, never a clamped float', () => {
    const big = new SequenceView({
      terms: [10n ** 40n], name: 'big', offset: 0, source: 'paste',
    } as Sequence);
    expect(describeHit({ kind: 'term', index: 0 }, big)).toContain('1'.padEnd(41, '0'));
  });

  it('names the digit position for a digit hit', () => {
    expect(describeHit({ kind: 'digit', index: 6, digitPos: 0 }, seq)).toMatch(/digit/i);
  });

  it('describes a bin as a range and a count', () => {
    const text = describeHit({ kind: 'bin', binIndex: 2, lo: 12, hi: 18, count: 47 }, seq);
    expect(text).toContain('47');
    expect(text).toContain('12');
    expect(text).toContain('18');
  });

  it('describes a lag', () => {
    expect(describeHit({ kind: 'lag', lag: 7 }, seq)).toMatch(/lag 7/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/readout.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/readout.ts`**

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Hit } from '../viz/hit';

/**
 * Human-readable description of what is under the cursor.
 *
 * Terms print via BigInt toString, never toNumber: a term past float64-safe
 * range would otherwise read as a clamped MAX_SAFE_INTEGER, which is exactly
 * the class of silent wrongness this project keeps having to design out.
 */
export function describeHit(hit: Hit, seq: SequenceView): string {
  switch (hit.kind) {
    case 'term':
      return `n = ${hit.index}   a(n) = ${seq.term(hit.index).toString()}`;
    case 'digit': {
      const digits = seq.digits(hit.index);
      const d = digits[hit.digitPos];
      return `n = ${hit.index}   a(n) = ${seq.term(hit.index).toString()}   digit ${hit.digitPos + 1} of ${digits.length}${d === undefined ? '' : ` = ${d}`}`;
    }
    case 'bin': {
      const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toPrecision(4));
      return `${hit.count} value${hit.count === 1 ? '' : 's'} in [${fmt(hit.lo)}, ${fmt(hit.hi)})`;
    }
    case 'lag':
      return `lag ${hit.lag}`;
  }
}

export interface Readout { el: HTMLElement; set(text: string | null): void; }

export function buildReadout(): Readout {
  const el = document.createElement('div');
  el.className = 'readout';
  // Polite, not assertive: this updates on every pointer move and must never
  // interrupt a screen reader mid-sentence.
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('role', 'status');
  return {
    el,
    set(text) {
      el.textContent = text ?? '';
      el.classList.toggle('readout--empty', !text);
    },
  };
}
```

- [ ] **Step 4: Wire it into `app.ts`**

After `canvasWrap.appendChild(canvas);` add:

```ts
  const readout = buildReadout();
  canvasWrap.appendChild(readout.el);

  // The canvas is the product; without a name and description it is an
  // unlabelled graphic to any assistive technology.
  canvas.setAttribute('role', 'img');

  // Pointer position in CSS pixels relative to the canvas, matching the
  // coordinate space every visualizer's locate() works in (drawScene sets the
  // 2D transform to dpr, so CSS pixels are the right units).
  function canvasPoint(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  let hoverPending = false;
  canvas.addEventListener('pointermove', (e) => {
    // Throttle to one hit-test per animation frame: locate() is an O(n) scan
    // for path visualizers and pointermove fires far faster than 60Hz.
    if (hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      updateHover(canvasPoint(e));
    });
  });
  canvas.addEventListener('pointerleave', () => readout.set(null));

  function updateHover(pt: { x: number; y: number }): void {
    const viz = getVisualizer(state.vizId);
    if (!state.seq || !viz.locate) { readout.set(null); return; }
    const rect = canvasWrap.getBoundingClientRect();
    const size = { width: Math.max(200, rect.width), height: Math.max(200, rect.height) };
    // In side-by-side the left half is the real sequence; ignore the right
    // half rather than reporting real-sequence indices for surrogate pixels.
    if (comparison.mode === 'side' && pt.x > size.width / 2) { readout.set(null); return; }
    const w = comparison.mode === 'side' ? size.width / 2 - 1 : size.width;
    const hit = viz.locate(new SequenceView(state.seq), state.params, { width: w, height: size.height }, pt.x, pt.y);
    readout.set(hit ? describeHit(hit, new SequenceView(state.seq)) : null);
  }
```

Add imports:

```ts
import { buildReadout, describeHit } from './readout';
```

In `drawScene`, after the sequence is known, set the accessible description:

```ts
    canvas.setAttribute('aria-label', `${viz.name} of ${state.seq.name}. ${viz.explain.long}`);
```

- [ ] **Step 5: Style it**

Append to `src/style.css`:

```css
.readout {
  position: absolute; left: 10px; bottom: 10px; z-index: 3;
  background: rgba(20,22,26,0.85); color: var(--text);
  border: 1px solid #3a3d44; border-radius: 4px;
  padding: 4px 8px; font: 12px/1.4 ui-monospace, monospace;
  pointer-events: none; max-width: calc(100% - 20px);
  overflow-wrap: anywhere;
}
.readout--empty { display: none; }
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/readout.ts src/ui/app.ts src/style.css tests/ui/readout.test.ts
git commit -m "feat: cursor readout naming the term, digit, bin, or lag under the pointer"
```

---

## Task 12: Linked markers across the comparison

**Files:**
- Modify: `src/ui/readout.ts` (marker drawing)
- Modify: `src/ui/app.ts` (click handling, marker redraw)
- Test: `tests/ui/readout.test.ts`

**Interfaces:**
- Consumes: `position`, `permutationWithMap` (Task 10), `Hit`.
- Produces: `correspondingIndex(realIndex: number, surrogate: SurrogateType, terms: bigint[], seed: number): { index: number; traced: boolean }`, `drawMarker(ctx, pt, color, label?)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/readout.test.ts`:

```ts
import { correspondingIndex } from '../../src/ui/readout';

const terms = Array.from({ length: 200 }, (_, i) => BigInt(i));

describe('correspondingIndex', () => {
  it('traces a term by value through a permutation', () => {
    const r = correspondingIndex(42, 'permutation', terms, 5);
    expect(r.traced).toBe(true);
    // The traced slot must actually hold the same value in the surrogate.
    // (Verified against permutationWithMap in surrogates.test.ts.)
    expect(r.index).toBeGreaterThanOrEqual(0);
    expect(r.index).toBeLessThan(terms.length);
  });

  it('falls back to index-for-index on difference surrogates', () => {
    const r = correspondingIndex(42, 'difference', terms, 5);
    expect(r).toEqual({ index: 42, traced: false });
  });

  it('falls back to index-for-index on matched surrogates', () => {
    expect(correspondingIndex(42, 'matched', terms, 5)).toEqual({ index: 42, traced: false });
  });

  it('is stable under the same seed', () => {
    expect(correspondingIndex(42, 'permutation', terms, 5))
      .toEqual(correspondingIndex(42, 'permutation', terms, 5));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/readout.test.ts -t corresponding`
Expected: FAIL - not exported.

- [ ] **Step 3: Implement in `src/ui/readout.ts`**

```ts
import { permutationWithMap, type SurrogateType } from '../nullmodel/surrogates';

/**
 * Where the term at `realIndex` corresponds to in the surrogate.
 *
 * `traced: true` means the *same term* is at that position - only possible
 * for permutation surrogates, which preserve the value multiset. Difference
 * and matched-random surrogates contain entirely new values, so the only
 * honest correspondence is index-for-index, and the UI must not imply
 * otherwise.
 */
export function correspondingIndex(
  realIndex: number, surrogate: SurrogateType, terms: bigint[], seed: number,
): { index: number; traced: boolean } {
  if (surrogate !== 'permutation') return { index: realIndex, traced: false };
  const { map } = permutationWithMap(terms, seed);
  const index = map[realIndex];
  return index === undefined ? { index: realIndex, traced: false } : { index, traced: true };
}

export function drawMarker(
  ctx: CanvasRenderingContext2D, pt: { x: number; y: number }, color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pt.x - 12, pt.y); ctx.lineTo(pt.x - 4, pt.y);
  ctx.moveTo(pt.x + 4, pt.y); ctx.lineTo(pt.x + 12, pt.y);
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 4: Wire clicking and marker drawing into `app.ts`**

Add near the other mutable state:

```ts
  // The term the user pinned by clicking, or null. Survives redraws (including
  // a flip) so the marker anchors the eye while the substrate changes.
  let pinnedIndex: number | null = null;
```

Add the click handler beside the pointermove handler:

```ts
  canvas.addEventListener('click', (e) => {
    const viz = getVisualizer(state.vizId);
    if (!state.seq || !viz.locate) return;
    const rect = canvasWrap.getBoundingClientRect();
    const size = { width: Math.max(200, rect.width), height: Math.max(200, rect.height) };
    const r = canvas.getBoundingClientRect();
    const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
    const w = comparison.mode === 'side' ? size.width / 2 - 1 : size.width;
    if (comparison.mode === 'side' && pt.x > size.width / 2) return;
    const hit = viz.locate(new SequenceView(state.seq), state.params, { width: w, height: size.height }, pt.x, pt.y);
    const idx = hitIndex(hit);
    pinnedIndex = idx !== null && idx === pinnedIndex ? null : idx; // click again to clear
    redraw();
  });
```

In `drawScene`, after the `side` branch draws both panels, add the marker pass:

```ts
    if (pinnedIndex !== null && viz.position) {
      const real = viz.position(view, state.params, { width: width / 2 - 1, height }, pinnedIndex);
      if (real) drawMarker(ctx, real, '#f7768e');
      const corr = correspondingIndex(pinnedIndex, comparison.surrogate, state.seq.terms, comparison.seed);
      const surrView = new SequenceView(surr);
      const sp = viz.position(surrView, state.params, { width: width / 2 - 1, height }, corr.index);
      if (sp) drawMarker(ctx, { x: sp.x + width / 2 + 1, y: sp.y }, corr.traced ? '#f7768e' : '#9aa0aa');
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '11px system-ui';
      ctx.fillText(
        corr.traced
          ? `same term, moved to n = ${corr.index}`
          : 'index-for-index (this null does not preserve terms)',
        width / 2 + 11, height - 26,
      );
    }
```

In the `flip` branch, after `draw(shown, ...)`:

```ts
    if (pinnedIndex !== null && viz.position) {
      const shownView = new SequenceView(shown);
      const idx = comparison.showSurrogate
        ? correspondingIndex(pinnedIndex, comparison.surrogate, state.seq.terms, comparison.seed).index
        : pinnedIndex;
      const p = viz.position(shownView, state.params, { width, height }, idx);
      if (p) drawMarker(ctx, p, '#f7768e');
    }
```

In the plain (`else`) branch, after `draw(state.seq, width, height, 0, '')`:

```ts
    if (pinnedIndex !== null && viz.position) {
      const p = viz.position(view, state.params, { width, height }, pinnedIndex);
      if (p) drawMarker(ctx, p, '#f7768e');
    }
```

In the `ensemble` branch, after `drawEnsembleChart(...)`, report the pinned index's null column instead of a marker:

```ts
      if (pinnedIndex !== null && ensembleBands) {
        const key = Object.keys(ensembleBands)[0];
        const band = key ? ensembleBands[key] : undefined;
        const widest = band?.levels[0];
        if (band && widest && pinnedIndex < band.median.length) {
          readout.set(
            `n = ${pinnedIndex}: null ${widest.pct}% spans ` +
            `${widest.lo[pinnedIndex]!.toPrecision(4)} to ${widest.hi[pinnedIndex]!.toPrecision(4)}`,
          );
        }
      }
```

Add imports:

```ts
import { drawMarker, correspondingIndex } from './readout';
import { hitIndex } from '../viz/hit';
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Manual check**

Run `npm run dev`, load A000045, pick Turtle walk, set Compare to `side`, click a point on the left panel. Confirm both markers appear and the caption reads "same term, moved to n = …". Switch the null to `matched` and confirm the caption changes to the index-for-index wording.

- [ ] **Step 7: Commit**

```bash
git add src/ui/readout.ts src/ui/app.ts tests/ui/readout.test.ts
git commit -m "feat: click a term to mark its counterpart in the null model"
```

---

## Task 13: Gallery data model

**Files:**
- Create: `src/gallery/types.ts`
- Create: `src/gallery/sequences.ts`
- Create: `src/gallery/entries.ts`
- Test: `tests/gallery/entries.test.ts` (create)

**Interfaces:**
- Consumes: `UrlState`, `Sequence`, `SurrogateType`.
- Produces: `GalleryEntry`, `Evidence`, `GALLERY: GalleryEntry[]`, `heroEntry(): GalleryEntry`.

- [ ] **Step 1: Write the failing test**

Create `tests/gallery/entries.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { GALLERY, heroEntry } from '../../src/gallery/entries';
import { encodeState, decodeState } from '../../src/ui/urlState';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, clearRegistry } from '../../src/viz/registry';

beforeAll(() => { clearRegistry(); registerAll(); });

describe('gallery entries', () => {
  it('has a hero and at least five more', () => {
    expect(GALLERY.length).toBeGreaterThanOrEqual(6);
    expect(heroEntry()).toBe(GALLERY[0]);
  });

  it('every id is unique', () => {
    expect(new Set(GALLERY.map((e) => e.id)).size).toBe(GALLERY.length);
  });

  it('every state round-trips through encode/decode', () => {
    for (const e of GALLERY) {
      const back = decodeState('#' + encodeState(e.state));
      expect(back, e.id).not.toBeNull();
      expect(back!.vizId, e.id).toBe(e.state.vizId);
      expect(back!.params, e.id).toEqual(e.state.params);
    }
  });

  it('every vizId exists in the registry', () => {
    const ids = new Set(allVisualizers().map((v) => v.id));
    for (const e of GALLERY) expect(ids.has(e.state.vizId), `${e.id}: ${e.state.vizId}`).toBe(true);
  });

  it('the bundled sequence agrees with the state seqRef', () => {
    // A mismatch would render one sequence on the landing and open a
    // different one in the engine - quiet, plausible, and very confusing.
    for (const e of GALLERY) {
      if (e.state.seqRef?.kind === 'oeis') {
        expect(e.sequence.aNumber, e.id).toBe(e.state.seqRef.aNumber);
      }
    }
  });

  it('bundles enough terms for its visualizer minimum', () => {
    for (const e of GALLERY) {
      const viz = allVisualizers().find((v) => v.id === e.state.vizId)!;
      expect(e.sequence.terms.length, e.id).toBeGreaterThanOrEqual(viz.minTerms);
    }
  });

  it('every entry has a caption and a body', () => {
    for (const e of GALLERY) {
      expect(e.caption.trim().length, e.id).toBeGreaterThan(0);
      expect(e.body.length, e.id).toBeGreaterThan(60);
    }
  });

  it('every "real" verdict carries reproducible evidence', () => {
    for (const e of GALLERY) {
      if (e.verdict === 'real') {
        expect(e.evidence, `${e.id} claims 'real' without evidence`).toBeDefined();
      }
    }
  });

  it('OEIS-sourced entries keep their A-number for attribution', () => {
    for (const e of GALLERY) {
      if (e.sequence.source === 'oeis') expect(e.sequence.aNumber, e.id).toMatch(/^A\d{6}$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gallery/entries.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Create `src/gallery/types.ts`**

```ts
import type { Sequence } from '../sequence/sequence';
import type { UrlState } from '../ui/urlState';
import type { SurrogateType } from '../nullmodel/surrogates';

/**
 * A recorded measurement backing a verdict. Everything needed to reproduce
 * the claim deterministically, so tests/gallery/verdicts.test.ts can recompute
 * it rather than trusting the caption.
 */
export interface Evidence {
  statistic: string;
  measured: number;
  bandLo: number;
  bandHi: number;
  surrogate: SurrogateType;
  n: number;
  seed: number;
}

export type Verdict =
  /** Survives the null: structure is a property of the sequence. */
  | 'real'
  /** Reproduced by the null, or produced by the layout itself. */
  | 'artifact'
  /** Not measured. Say so; do not guess. */
  | 'open';

export interface GalleryEntry {
  id: string;
  title: string;
  state: UrlState;
  /** Bundled so the landing renders with zero network. */
  sequence: Sequence;
  verdict: Verdict;
  caption: string;
  body: string;
  /** Required when verdict === 'real'. */
  evidence?: Evidence;
}
```

- [ ] **Step 4: Create `src/gallery/sequences.ts`**

Bundle the terms. Kolakoski is generated (it is self-describing, so a generator is shorter and exactly correct); the rest are literal prefixes.

```ts
import type { Sequence } from '../sequence/sequence';

/**
 * Kolakoski (A000002): the sequence is its own run-length encoding. Generated
 * rather than pasted so it is exactly right at any length; still labelled
 * with its A-number so OEIS attribution and the entry link survive.
 */
export function kolakoski(n: number): bigint[] {
  const out: number[] = [1, 2, 2];
  let i = 2;
  while (out.length < n) {
    const run = out[i]!;
    const next = out[out.length - 1] === 1 ? 2 : 1;
    for (let k = 0; k < run && out.length < n; k++) out.push(next);
    i++;
  }
  return out.slice(0, n).map(BigInt);
}

export function fibonacci(n: number): bigint[] {
  const out: bigint[] = [0n, 1n];
  while (out.length < n) out.push(out[out.length - 1]! + out[out.length - 2]!);
  return out.slice(0, n);
}

export function naturals(n: number): bigint[] {
  return Array.from({ length: n }, (_, i) => BigInt(i));
}

/** First 300 primes (A000040), computed by sieve to keep the file short. */
export function primes(n: number): bigint[] {
  const out: bigint[] = [];
  for (let c = 2; out.length < n; c++) {
    let isPrime = true;
    for (let d = 2; d * d <= c; d++) if (c % d === 0) { isPrime = false; break; }
    if (isPrime) out.push(BigInt(c));
  }
  return out;
}

/** Recamán (A005132). */
export function recaman(n: number): bigint[] {
  const seen = new Set<number>([0]);
  const out = [0];
  for (let i = 1; out.length < n; i++) {
    const prev = out[out.length - 1]!;
    const back = prev - i;
    const next = back > 0 && !seen.has(back) ? back : prev + i;
    seen.add(next);
    out.push(next);
  }
  return out.map(BigInt);
}

export function oeisSeq(aNumber: string, name: string, terms: bigint[]): Sequence {
  return { terms, aNumber, name, offset: 0, source: 'oeis' };
}
```

- [ ] **Step 5: Create `src/gallery/entries.ts`**

Evidence values are placeholders **only until Task 14 measures them**; Task 14 is what makes them true, and its test fails until they are.

```ts
import type { GalleryEntry } from './types';
import { kolakoski, fibonacci, naturals, primes, recaman, oeisSeq } from './sequences';

const N = 600;

export const GALLERY: GalleryEntry[] = [
  {
    id: 'kolakoski-spiral',
    title: 'Structure that survives the null',
    sequence: oeisSeq('A000002', 'Kolakoski sequence', kolakoski(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'ulam', params: { colorBy: 'mod', modulus: 2 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'real',
    caption: 'The texture on the left is real. Shuffle the same terms and it vanishes.',
    body: 'The Kolakoski sequence contains only 1s and 2s, and it is its own run-length encoding. Its alternation is far more regular than chance allows, which is what makes the spiral legible. Measured against 200 permutation surrogates, its angular variance falls outside the null band on the low side - excess regularity, not excess disorder.',
    evidence: {
      statistic: 'angularVariance', measured: 0.000332,
      bandLo: 0.000506, bandHi: 0.001288,
      surrogate: 'permutation', n: 200, seed: 1,
    },
  },
  {
    id: 'rainbow-rings',
    title: 'Structure that is not there',
    sequence: oeisSeq('A001477', 'The non-negative integers', naturals(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A001477' },
      vizId: 'ulam', params: { colorBy: 'mod', modulus: 12 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'artifact',
    caption: 'Beautiful concentric rings, drawn entirely by the spiral - not by the sequence.',
    body: 'This is a(n) = n, the simplest sequence there is. Because the hue advances a fixed step per cell and the spiral winds at a steadily increasing radius, the two periodicities beat against each other and produce rings. Nothing here is a property of the numbers: any sequence that increases by a constant produces the same picture. This is the failure mode the whole site exists to catch.',
  },
  {
    id: 'primes-spiral',
    title: "Ulam's own discovery",
    sequence: oeisSeq('A000040', 'The prime numbers', primes(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000040' },
      vizId: 'ulam', params: { colorBy: 'parity', modulus: 6 },
      mode: 'side', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'The diagonals Ulam noticed in 1963 - shown here without a verdict.',
    body: 'Stanislaw Ulam noticed while doodling at a conference that primes plotted on a square spiral fall along diagonal lines, which correspond to prime-rich quadratic polynomials. This view plots the primes themselves rather than marking primes among the integers, so it is not the classical picture and we have not measured it. Marked open rather than guessed at.',
  },
  {
    id: 'recaman-walk',
    title: 'A sequence that doubles back',
    sequence: oeisSeq('A005132', "Recamán's sequence", recaman(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A005132' },
      vizId: 'scatter', params: { scale: 'linear' },
      mode: 'side', surrogate: 'difference', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Subtract if you can, otherwise add - and never repeat yourself.',
    body: 'Recamán steps back by n if that lands on a positive number it has not visited, and forward by n otherwise. The result is famously jagged. Compared here against a difference surrogate, which keeps the same step sizes but reorders them, so the question becomes whether the arrangement of steps matters or only their sizes.',
  },
  {
    id: 'fibonacci-ratios',
    title: 'A real result you can read off the screen',
    sequence: oeisSeq('A000045', 'Fibonacci numbers', fibonacci(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000045' },
      vizId: 'differences', params: { mode: 'ratios' },
      mode: 'off', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Successive Fibonacci ratios converging on the golden ratio.',
    body: 'The ratio a(n+1)/a(n) converges to phi = 1.6180339887... This is computed in log space rather than by dividing floats, which is why it stays correct past term 79 - divide the raw values and both sides saturate at the same clamped maximum and the ratio reads exactly 1.0 forever. Hover the line to read the exact terms.',
  },
  {
    id: 'kolakoski-turtle',
    title: 'The same sequence, a different technique',
    sequence: oeisSeq('A000002', 'Kolakoski sequence', kolakoski(N)),
    state: {
      seqRef: { kind: 'oeis', aNumber: 'A000002' },
      vizId: 'turtle', params: { angle: 90, k: 4 },
      mode: 'flip', surrogate: 'permutation', seed: 1, ensembleN: 200,
    },
    verdict: 'open',
    caption: 'Flip between the real sequence and its shuffle, and watch the path change.',
    body: 'A turtle walk is cumulative: every term displaces everything drawn after it, so this view is far more sensitive to ordering than a grid is. Use the flip button to swap between the real sequence and a permutation of it. Click any point first and the marker will follow that term across the flip.',
  },
];

export function heroEntry(): GalleryEntry {
  return GALLERY[0]!;
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/gallery/entries.test.ts && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/gallery tests/gallery
git commit -m "feat: gallery entries as saved engine states with bundled sequences"
```

---

## Task 14: Verdict verification

**Files:**
- Create: `tests/gallery/verdicts.test.ts`
- Modify: `src/gallery/entries.ts` (correct any evidence the test disproves)
- Create: `src/gallery/angularVariance.ts`

**Interfaces:**
- Consumes: `GALLERY`, `makeSurrogate`, `spiralCoords`.
- Produces: `angularVariance(seq: SequenceView, modulus: number): number`.

- [ ] **Step 1: Write the failing test**

Create `tests/gallery/verdicts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GALLERY } from '../../src/gallery/entries';
import { angularVariance } from '../../src/gallery/angularVariance';
import { makeSurrogate } from '../../src/nullmodel/surrogates';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const STATISTICS: Record<string, (seq: SequenceView, params: Record<string, unknown>) => number> = {
  angularVariance: (seq, params) => angularVariance(seq, Number(params.modulus ?? 2)),
};

describe('gallery verdicts are computed, not asserted', () => {
  const claimed = GALLERY.filter((e) => e.evidence);

  it('has at least one measured claim', () => {
    expect(claimed.length).toBeGreaterThan(0);
  });

  for (const entry of claimed) {
    it(`${entry.id}: the recorded measurement reproduces`, () => {
      const ev = entry.evidence!;
      const stat = STATISTICS[ev.statistic];
      expect(stat, `no implementation for statistic "${ev.statistic}"`).toBeDefined();

      const view = new SequenceView(entry.sequence);
      const measured = stat!(view, entry.state.params);
      expect(measured).toBeCloseTo(ev.measured, 6);
    });

    it(`${entry.id}: the recorded null band reproduces`, () => {
      const ev = entry.evidence!;
      const stat = STATISTICS[ev.statistic]!;
      const vals: number[] = [];
      for (let j = 0; j < ev.n; j++) {
        const terms = makeSurrogate(entry.sequence.terms, ev.surrogate, ev.seed + j);
        const surr: Sequence = { terms, name: 's', offset: 0, source: 'paste' };
        vals.push(stat(new SequenceView(surr), entry.state.params));
      }
      vals.sort((a, b) => a - b);
      const at = (p: number) => vals[Math.min(vals.length - 1, Math.floor((vals.length - 1) * p))]!;
      expect(at(0.025)).toBeCloseTo(ev.bandLo, 6);
      expect(at(0.975)).toBeCloseTo(ev.bandHi, 6);
    });

    it(`${entry.id}: verdict 'real' means the measurement is outside the band`, () => {
      const ev = entry.evidence!;
      if (entry.verdict === 'real') {
        expect(ev.measured < ev.bandLo || ev.measured > ev.bandHi).toBe(true);
      }
    });
  }

  it("every 'artifact' without evidence explains itself in prose", () => {
    for (const e of GALLERY) {
      if (e.verdict === 'artifact' && !e.evidence) {
        expect(e.body.length, `${e.id}`).toBeGreaterThan(150);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/gallery/verdicts.test.ts`
Expected: FAIL - `src/gallery/angularVariance` not found.

- [ ] **Step 3: Implement the statistic**

Create `src/gallery/angularVariance.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import { spiralCoords } from '../viz/gridUtils';

/**
 * Variance of the mean colour-class direction on the Ulam spiral.
 *
 * Groups cells by term residue mod `modulus`, and for each class computes the
 * mean unit vector from the spiral centre to its cells. A class whose cells
 * are spread evenly in all directions has a near-zero resultant; a class
 * clumped into one sector has a long one. The statistic is the variance of
 * those resultant lengths across classes - low means every class is spread
 * evenly (unusual regularity), high means classes clump into sectors.
 *
 * Deterministic and pure: no RNG, so the same sequence always measures the
 * same value and the recorded evidence in the gallery reproduces exactly.
 */
export function angularVariance(seq: SequenceView, modulus: number): number {
  const coords = spiralCoords(seq.length);
  const sumX = new Array<number>(modulus).fill(0);
  const sumY = new Array<number>(modulus).fill(0);
  const count = new Array<number>(modulus).fill(0);

  for (let i = 0; i < seq.length; i++) {
    const c = coords[i]!;
    const r = Math.hypot(c.x, c.y);
    if (r === 0) continue; // the centre cell has no direction
    const k = seq.mod(i, modulus);
    sumX[k]! += c.x / r;
    sumY[k]! += c.y / r;
    count[k]!++;
  }

  const resultants: number[] = [];
  for (let k = 0; k < modulus; k++) {
    if (count[k] === 0) continue;
    resultants.push(Math.hypot(sumX[k]!, sumY[k]!) / count[k]!);
  }
  if (resultants.length === 0) return 0;
  const mean = resultants.reduce((s, v) => s + v, 0) / resultants.length;
  return resultants.reduce((s, v) => s + (v - mean) ** 2, 0) / resultants.length;
}
```

- [ ] **Step 4: Run the test and record the ACTUAL numbers**

Run: `npx vitest run tests/gallery/verdicts.test.ts`

Expected: the measurement/band assertions FAIL, printing the real values.

**This is the point of the task.** Copy the actual measured value and the actual 2.5/97.5 percentile band from the failure output into `evidence` in `src/gallery/entries.ts`. Do **not** adjust the test to match the placeholder numbers.

Then check the verdict:
- If `measured` falls **outside** the band → keep `verdict: 'real'` and update `caption`/`body` to quote the true numbers.
- If it falls **inside** → change `verdict` to `'artifact'`, rewrite the caption and body to say the structure is reproduced by the null, and **swap this entry out of the hero slot** in favour of one that does show a real effect. The landing page must not open with a claim the code disproves.

- [ ] **Step 5: Re-run until green**

Run: `npx vitest run tests/gallery && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/gallery tests/gallery
git commit -m "test: recompute every gallery verdict against its recorded null band"
```

---

## Task 15: Landing overlay and routing

**Files:**
- Create: `src/ui/landing.ts`
- Modify: `src/ui/app.ts` (`applyHash`)
- Modify: `src/style.css`
- Test: `tests/ui/landing.test.ts` (create)

**Interfaces:**
- Consumes: `GALLERY`, `heroEntry`, `encodeState`.
- Produces: `GALLERY_HASH = 'gallery'`, `shouldShowLanding(hash: string): boolean`, `buildLanding(opts): HTMLElement`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/landing.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { shouldShowLanding, buildLanding, GALLERY_HASH } from '../../src/ui/landing';
import { encodeState } from '../../src/ui/urlState';
import { GALLERY } from '../../src/gallery/entries';
import { registerAll } from '../../src/viz/all';
import { clearRegistry } from '../../src/viz/registry';

beforeAll(() => { clearRegistry(); registerAll(); });

describe('landing routing', () => {
  it('shows for a bare URL', () => {
    expect(shouldShowLanding('')).toBe(true);
    expect(shouldShowLanding('#')).toBe(true);
  });

  it('shows for the reserved gallery hash', () => {
    expect(shouldShowLanding('#' + GALLERY_HASH)).toBe(true);
  });

  it('skips for a decodable engine state', () => {
    expect(shouldShowLanding('#' + encodeState(GALLERY[0]!.state))).toBe(false);
  });

  it('shows for an undecodable hash rather than opening a broken engine', () => {
    expect(shouldShowLanding('#not-valid-base64-json!!')).toBe(true);
  });
});

describe('landing content', () => {
  it('renders one button per entry plus the engine link', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {} });
    const thumbs = el.querySelectorAll('.gallery-thumb');
    expect(thumbs).toHaveLength(GALLERY.length - 1); // hero is not in the strip
    expect(el.querySelector('.landing-open')).not.toBeNull();
  });

  it('every thumbnail is a real button with an accessible name', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {} });
    for (const t of el.querySelectorAll('.gallery-thumb')) {
      expect(t.tagName).toBe('BUTTON');
      expect((t.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('calls onPick with the entry when a thumbnail is clicked', () => {
    const onPick = vi.fn();
    const el = buildLanding({ onOpen: () => {}, onPick });
    el.querySelector<HTMLButtonElement>('.gallery-thumb')!.click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(GALLERY).toContain(onPick.mock.calls[0]![0]);
  });

  it('makes no network requests', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    buildLanding({ onOpen: () => {}, onPick: () => {} });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('has exactly one h1 and links OEIS attribution', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {} });
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('a[href*="oeis.org"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/landing.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/landing.ts`**

```ts
import { GALLERY, heroEntry } from '../gallery/entries';
import type { GalleryEntry } from '../gallery/types';
import { decodeState } from './urlState';
import { SequenceView, type Sequence } from '../sequence/sequence';
import { getVisualizer } from '../viz/registry';
import { surrogateSequence } from './comparison';

/** Reserved literal hash, checked before decodeState so it can never collide. */
export const GALLERY_HASH = 'gallery';

export function shouldShowLanding(hash: string): boolean {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '' || raw === GALLERY_HASH) return true;
  // An undecodable hash shows the landing rather than dropping the visitor
  // into an engine with no sequence and no explanation of why.
  return decodeState(raw) === null;
}

const VERDICT_LABEL: Record<GalleryEntry['verdict'], string> = {
  real: 'Survives the null',
  artifact: 'Rendering artifact',
  open: 'Not yet measured',
};

/**
 * Renders an entry into a canvas at the given size. Live, not a stored image:
 * a screenshot would eventually assert something the code no longer produces,
 * which is precisely the drift the verdict tests exist to prevent.
 */
function paintEntry(entry: GalleryEntry, canvas: HTMLCanvasElement, w: number, h: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // jsdom
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, 0, w, h);

  const viz = getVisualizer(entry.state.vizId);
  const paint = (seq: Sequence, x: number, panelW: number) => {
    ctx.save();
    ctx.translate(x, 0);
    ctx.beginPath();
    ctx.rect(0, 0, panelW, h);
    ctx.clip();
    try {
      viz.render(new SequenceView(seq), entry.state.params, ctx, { width: panelW, height: h });
    } catch {
      // A single bad entry degrades to an empty panel, never a blank landing.
    }
    ctx.restore();
  };

  if (entry.state.mode === 'side') {
    const half = w / 2 - 1;
    paint(entry.sequence, 0, half);
    ctx.strokeStyle = '#333';
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    paint(surrogateSequence(entry.sequence, entry.state.surrogate, entry.state.seed), w / 2 + 1, half);
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '11px system-ui';
    ctx.fillText('real', 8, h - 8);
    ctx.fillText(`${entry.state.surrogate} null`, w / 2 + 9, h - 8);
  } else {
    paint(entry.sequence, 0, w);
  }
}

export interface LandingOptions {
  onOpen(): void;
  onPick(entry: GalleryEntry): void;
}

export function buildLanding(opts: LandingOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'landing';

  const hero = heroEntry();

  const h1 = document.createElement('h1');
  h1.className = 'landing-title';
  h1.textContent = 'Is that pattern real?';
  const lede = document.createElement('p');
  lede.className = 'landing-lede';
  lede.textContent =
    'Integer sequences make beautiful pictures. Some of that beauty is in the numbers, and some of it is drawn by the technique. This tool shows you both at once - the sequence, and a null model built from it - so you can tell which is which.';

  const heroFigure = document.createElement('figure');
  heroFigure.className = 'landing-hero';
  const heroCanvas = document.createElement('canvas');
  heroCanvas.setAttribute('role', 'img');
  heroCanvas.setAttribute('aria-label', `${hero.title}. ${hero.caption}`);
  const heroCaption = document.createElement('figcaption');
  heroCaption.className = 'landing-hero-caption';
  const verdictTag = document.createElement('span');
  verdictTag.className = `verdict verdict--${hero.verdict}`;
  verdictTag.textContent = VERDICT_LABEL[hero.verdict];
  const heroText = document.createElement('span');
  heroText.textContent = ` ${hero.caption}`;
  heroCaption.append(verdictTag, heroText);
  heroFigure.append(heroCanvas, heroCaption);

  const open = document.createElement('button');
  open.className = 'landing-open';
  open.type = 'button';
  open.textContent = 'Open the full engine →';
  open.addEventListener('click', () => opts.onOpen());

  const stripLabel = document.createElement('h2');
  stripLabel.className = 'landing-strip-label';
  stripLabel.textContent = 'More examples - click any to open it in the engine';

  const strip = document.createElement('div');
  strip.className = 'gallery-strip';
  for (const entry of GALLERY.slice(1)) {
    const btn = document.createElement('button');
    btn.className = 'gallery-thumb';
    btn.type = 'button';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'gallery-thumb-label';
    const tag = document.createElement('span');
    tag.className = `verdict verdict--${entry.verdict}`;
    tag.textContent = VERDICT_LABEL[entry.verdict];
    label.append(tag, document.createTextNode(` ${entry.title}`));
    btn.append(canvas, label);
    btn.addEventListener('click', () => opts.onPick(entry));
    strip.appendChild(btn);
    // Painted after layout so the canvas has real dimensions.
    requestAnimationFrame(() => paintEntry(entry, canvas, 220, 130));
  }

  const attribution = document.createElement('p');
  attribution.className = 'landing-attribution';
  attribution.append('Sequence data from ');
  const link = document.createElement('a');
  link.href = 'https://oeis.org/';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'The On-Line Encyclopedia of Integer Sequences';
  attribution.append(link, '®, © OEIS Foundation Inc., used under CC BY-SA 4.0.');

  el.append(h1, lede, heroFigure, open, stripLabel, strip, attribution);
  requestAnimationFrame(() => paintEntry(hero, heroCanvas, 760, 340));
  return el;
}
```

- [ ] **Step 4: Route it in `app.ts`**

Add near the top of `mountApp`:

```ts
  let landingEl: HTMLElement | null = null;
  // Once dismissed, stays dismissed for the session: re-mounting the landing
  // after a parameter tweak would read as a bug, not a feature.
  let landingDismissed = false;

  function dismissLanding(focusEngine = true): void {
    landingDismissed = true;
    landingEl?.remove();
    landingEl = null;
    if (focusEngine) picker.focus();
  }

  function showLanding(): void {
    if (landingDismissed || landingEl) return;
    landingEl = buildLanding({
      onOpen: () => dismissLanding(),
      onPick: (entry) => {
        dismissLanding(false);
        location.hash = '#' + encodeState(entry.state);
        applyHash(location.hash);
      },
    });
    root.appendChild(landingEl);
  }
```

Replace the final `applyHash(location.hash);` at the bottom of `mountApp` with:

```ts
  if (shouldShowLanding(location.hash)) showLanding();
  else applyHash(location.hash);
```

and add at the start of `applyHash`:

```ts
    if (!shouldShowLanding(hash)) dismissLanding(false);
```

Add imports:

```ts
import { buildLanding, shouldShowLanding } from './landing';
```

- [ ] **Step 5: Style it**

Append to `src/style.css`:

```css
.landing {
  position: fixed; inset: 0; z-index: 20; overflow-y: auto;
  background: var(--bg); padding: 32px 24px 48px;
  display: flex; flex-direction: column; align-items: center; gap: 14px;
}
.landing-title { margin: 0; font-size: clamp(24px, 4vw, 38px); text-align: center; }
.landing-lede { margin: 0; max-width: 60ch; text-align: center; color: var(--muted); font-size: 15px; }
.landing-hero { margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; align-items: center; max-width: 100%; }
.landing-hero canvas { max-width: 100%; border: 1px solid #3a3d44; border-radius: 6px; }
.landing-hero-caption { color: var(--text); font-size: 14px; text-align: center; max-width: 60ch; }
.landing-open {
  background: var(--accent); color: #14161a; border: none; border-radius: 6px;
  padding: 10px 22px; font: 600 15px system-ui; cursor: pointer;
}
.landing-strip-label { margin: 20px 0 0; font-size: 13px; font-weight: 400; color: var(--muted); }
.gallery-strip {
  display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; max-width: 1100px;
}
.gallery-thumb {
  background: var(--panel); border: 1px solid #3a3d44; border-radius: 6px;
  padding: 8px; cursor: pointer; color: var(--text);
  display: flex; flex-direction: column; gap: 6px; width: 238px; text-align: left;
}
.gallery-thumb:hover { border-color: var(--accent); }
.gallery-thumb canvas { border-radius: 4px; }
.gallery-thumb-label { font-size: 12px; line-height: 1.4; }
.verdict { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 5px; border-radius: 3px; }
.verdict--real { background: #1f3b2b; color: #7ee0a8; }
.verdict--artifact { background: #3b2430; color: #f7a1b4; }
.verdict--open { background: #2a2d35; color: var(--muted); }
.landing-attribution { margin: 18px 0 0; font-size: 12px; color: var(--muted); text-align: center; }
.landing-attribution a { color: var(--muted); }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 7: Manual check**

`npm run dev`, open `/`. Confirm the hero renders immediately with no network request for `/data/*` (check the Network tab). Click a thumbnail and confirm the engine opens on that exact view. Reload with `#gallery` and confirm the landing returns.

- [ ] **Step 8: Commit**

```bash
git add src/ui/landing.ts src/ui/app.ts src/style.css tests/ui/landing.test.ts
git commit -m "feat: landing overlay with live hero comparison and gallery strip"
```

---

## Task 16: Social preview card and document head

**Files:**
- Modify: `index.html`
- Create: `public/og-card.png` (exported from the browser)
- Create: `src/ui/ogCard.ts` (dev-only)
- Modify: `src/ui/landing.ts` (export `paintEntry`), `src/main.ts`
- Modify: `scripts/deploy.sh` (note the regeneration step)
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: a static 1200x630 card.

- [ ] **Step 1: Add the meta tags**

Replace the `<head>` of `index.html` with:

```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ulam - is that pattern real?</title>
    <meta name="description" content="Render OEIS integer sequences, then test whether the structure you see survives a null model." />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Ulam" />
    <meta property="og:title" content="Ulam - is that pattern real?" />
    <meta property="og:description" content="Integer sequences make beautiful pictures. Some of that beauty is in the numbers, and some is drawn by the technique. See both at once." />
    <meta property="og:url" content="https://ulam.briansheppard.com/" />
    <meta property="og:image" content="https://ulam.briansheppard.com/og-card.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="A sequence rendered as a spiral beside the same sequence shuffled, showing the pattern disappear." />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Ulam - is that pattern real?" />
    <meta name="twitter:description" content="Render OEIS sequences, then test whether the structure survives a null model." />
    <meta name="twitter:image" content="https://ulam.briansheppard.com/og-card.png" />
  </head>
```

- [ ] **Step 2: Add a dev-only card exporter**

Generating the PNG in Node would need a canvas polyfill dependency, and a
hand-drawn card would be free to disagree with the actual hero. Instead export
it from the browser using the same `paintEntry` the landing uses, so the card
is by construction a picture of the real hero.

First, export the painter. In `src/ui/landing.ts` change `function paintEntry(`
to `export function paintEntry(`.

Then create `src/ui/ogCard.ts`:

```ts
import { heroEntry } from '../gallery/entries';
import { paintEntry } from './landing';

const W = 1200, H = 630;

/**
 * Dev-only. Renders the hero entry at OG-card dimensions and downloads it as
 * a PNG, so public/og-card.png is always a picture of the actual hero rather
 * than a hand-drawn approximation that can quietly go out of date.
 *
 * Usage: npm run dev, then open http://localhost:5173/?ogcard
 * Save the download to public/og-card.png and commit it.
 */
export function exportOgCard(): void {
  const entry = heroEntry();
  const canvas = document.createElement('canvas');
  // paintEntry multiplies by devicePixelRatio; force 1 so the exported file is
  // exactly 1200x630 regardless of the machine that produced it.
  const realDpr = window.devicePixelRatio;
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  paintEntry(entry, canvas, W, H);
  Object.defineProperty(window, 'devicePixelRatio', { value: realDpr, configurable: true });

  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Wordmark and URL over the comparison, so the card reads as a product
    // shot rather than an unattributed graph.
    ctx.fillStyle = 'rgba(20,22,26,0.82)';
    ctx.fillRect(0, H - 96, W, 96);
    ctx.fillStyle = '#e6e6e6';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('Is that pattern real?', 40, H - 52);
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('ulam.briansheppard.com', 40, H - 22);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'og-card.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}
```

Wire it in `src/main.ts`, guarded so it never ships to production:

```ts
if (import.meta.env.DEV && new URLSearchParams(location.search).has('ogcard')) {
  void import('./ui/ogCard').then((m) => m.exportOgCard());
}
```

- [ ] **Step 2b: Produce the file**

Run `npm run dev`, open `http://localhost:5173/?ogcard`, save the downloaded
PNG to `public/og-card.png`, and confirm it is 1200x630.

- [ ] **Step 3: Record the regeneration step in the deploy script**

Add to `scripts/deploy.sh` immediately after `echo "==> building"`:

```bash
# The OG card is a stored PNG while the landing hero is a live render, so the
# two drift whenever the hero entry changes. Regenerating needs a browser (it
# reuses the real render path), so it cannot happen here - this is the reminder.
if [ ! -f public/og-card.png ]; then
  echo "WARNING: public/og-card.png is missing; social previews will 404." >&2
  echo "         Regenerate: npm run dev, then open /?ogcard" >&2
fi
```

- [ ] **Step 4: Document it in the README**

Add a subsection under Deploy in `README.md`:

```markdown
### Social preview card

`public/og-card.png` is a **stored** 1200x630 image, while the landing hero is
a live canvas render - so the two drift apart whenever the hero gallery entry
changes. Regenerate it by running `npm run dev` and opening `/?ogcard`, which
renders the current hero through the real render path and downloads the PNG;
save it over `public/og-card.png`. `scripts/deploy.sh` warns if the file is
missing but cannot detect staleness.

Static hosting means one card for every share link: a link to Recamán and a
link to Kolakoski preview identically. Per-state cards would need SSR or
Lambda@Edge.
```

- [ ] **Step 5: Verify and commit**

Run: `npm run build`
Expected: build succeeds; `dist/og-card.png` exists if the card was generated.

```bash
git add index.html scripts/make-og-card.mjs scripts/deploy.sh README.md public/og-card.png
git commit -m "feat: social preview card and document head metadata"
```

---

## Task 17: Accessibility of the new and touched markup

**Files:**
- Modify: `src/ui/app.ts` (heading, labels)
- Modify: `src/ui/comparison.ts` (real `<label>` elements)
- Modify: `src/style.css`
- Test: `tests/ui/ui.test.ts`

**Interfaces:**
- Consumes: existing DOM builders.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/ui.test.ts`:

```ts
describe('accessibility of the app chrome', () => {
  it('has exactly one h1 in the engine', () => {
    const root = document.createElement('div');
    mountApp(root);
    expect(root.querySelectorAll('h1')).toHaveLength(1);
  });

  it('every comparison-bar control has an accessible name', () => {
    const root = document.createElement('div');
    mountApp(root);
    for (const control of root.querySelectorAll<HTMLElement>('.comparison-bar select, .comparison-bar input')) {
      const labelled =
        control.getAttribute('aria-label') ||
        (control.id && root.querySelector(`label[for="${control.id}"]`)) ||
        control.closest('label');
      expect(labelled, `${control.className} has no accessible name`).toBeTruthy();
    }
  });

  it('the canvas is exposed as an image with a description', () => {
    const root = document.createElement('div');
    mountApp(root);
    const canvas = root.querySelector('canvas')!;
    expect(canvas.getAttribute('role')).toBe('img');
  });

  it('the visualizer picker has an accessible name', () => {
    const root = document.createElement('div');
    mountApp(root);
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    expect(picker.getAttribute('aria-label')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/ui.test.ts -t accessibility`
Expected: FAIL - the title is a `<span>` and the bar labels are `<span>`s.

- [ ] **Step 3: Promote the title to a heading**

In `src/ui/app.ts`, replace:

```ts
  const title = document.createElement('span');
  title.className = 'app-title';
```

with:

```ts
  // A real heading, not a styled span: the page had no h1 at all, so assistive
  // technology had nothing to anchor the document outline to.
  const title = document.createElement('h1');
  title.className = 'app-title';
```

Add after `picker.className = 'viz-picker';`:

```ts
  picker.setAttribute('aria-label', 'Visualization technique');
```

- [ ] **Step 4: Give the comparison-bar controls real labels**

In `src/ui/comparison.ts`, replace the `label()` helper and the final `el.append(...)` with genuine `<label>` wrapping. Change `mkSelect` and `mkNumber` to accept a label string and return a wrapped field:

```ts
  let uid = 0;
  const field = (text: string, control: HTMLElement): HTMLElement => {
    const wrap = document.createElement('label');
    wrap.className = 'bar-field';
    const id = `cmp-${++uid}`;
    control.id = id;
    wrap.htmlFor = id;
    const span = document.createElement('span');
    span.className = 'bar-label';
    span.textContent = text;
    wrap.append(span, control);
    return wrap;
  };
```

then replace the `el.append(...)` line with:

```ts
  el.append(
    field('Compare:', modeSel),
    field('null:', surrSel),
    field('seed', seedInput),
    field('N', nInput),
    flipBtn,
  );
```

Delete the now-unused `label()` helper.

- [ ] **Step 5: Add the style for the wrapper**

Append to `src/style.css`:

```css
.bar-field { display: inline-flex; align-items: center; gap: 6px; }
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test && npm run build`
Expected: PASS. The existing `tests/ui/comparison.test.ts` queries by class (`.mode-select`, `.surrogate-select`), which still works through the wrapper.

- [ ] **Step 7: Commit**

```bash
git add src/ui/app.ts src/ui/comparison.ts src/style.css tests/ui/ui.test.ts
git commit -m "fix: real headings and labels for the app chrome"
```

---

## Task 18: Final integration pass

**Files:**
- Modify: `README.md`
- Verify: everything

- [ ] **Step 1: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests pass, `tsc --noEmit` clean.

- [ ] **Step 2: Confirm no visualizer was missed**

Run: `npx vitest run tests/viz/explain.test.ts tests/viz/locate.test.ts`
Expected: PASS - nine visualizers documented, every `locate`/`position` pair round-trips.

- [ ] **Step 3: Manual pass in the browser**

Run `npm run dev` and verify, in order:

1. `/` shows the landing with the hero already rendered; no `/data/*` request fires before first paint.
2. "Open the full engine" dismisses the landing and focus lands on the visualizer picker.
3. Every thumbnail opens the engine at its own view.
4. `#gallery` returns to the landing on reload.
5. The (i) button explains the current visualizer and the current null model.
6. With Compare `off`, the null dropdown is visibly disabled and explains why on hover.
7. Selecting `flip` immediately highlights and focuses the flip button.
8. Hovering the canvas shows the readout; clicking pins a marker; clicking again clears it.
9. In `side` mode with a permutation null, both markers appear and the caption names the traced index; switching to `matched` changes the caption.
10. In `ensemble` mode the legend names the real line, the median, and all three levels.
11. Tab through the whole page and confirm every interactive element shows a visible focus ring.

- [ ] **Step 4: Update the README**

Add to the "What it does" list:

```markdown
- **A landing gallery**: curated real-vs-null comparisons that render on first
  paint with no network round-trip, each one a saved engine state you can click
  straight into. Every verdict shown is recomputed in CI against its recorded
  null band - the gallery cannot claim a structure is real unless the code
  still measures it that way.
- **Explanations everywhere**: every visualizer and every surrogate documents
  itself, enforced at compile time, surfaced by an (i) button and reused as the
  canvas's accessible description.
- **Cursor readout**: hover to identify the term, digit, bin, or lag under the
  pointer; click a term to mark its counterpart in the null model.
```

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "docs: describe the landing gallery, explanations, and readout"
git push origin master
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Task |
| --- | --- |
| §1 Landing is a state of the SPA | 15 |
| §2 Gallery entries are saved engine states | 13 |
| §2 Bundled sequence, zero network | 13, 15 |
| §2 Live renders, not stored images | 15 (`paintEntry`) |
| §3 `explain` required, compiler-enforced | 3 |
| §3 Surrogate explanations, (i) panel | 4 |
| §4 Verdicts computed not asserted | 14 |
| §5 Social preview card + staleness note | 16 |
| §6 Inert controls | 5 |
| §7 Accessibility of new markup | 4, 11, 15, 17 |
| §8 Band legend | 2 |
| §8 Nested percentile levels | 1 |
| §9 `locate`/`position` | 6, 7, 8, 9 |
| §9 Linked markers, per-mode behaviour | 12 |
| §9 Permutation index map | 10 |

**Known ordering constraint:** Task 14 rewrites the evidence values placed in Task 13, and may change the hero entry. Do not treat Task 13's numbers as authoritative - they are placeholders that Task 14's test is designed to reject.

**Known risk:** `angularVariance` (Task 14) is a new statistic written for this plan, not the exact code that produced the numbers quoted in the spec. The measured values will almost certainly differ. That is expected and handled: Task 14 Step 4 records what the code actually measures and adjusts the verdict to match, rather than adjusting the code to match the caption.
