# Task 10: load b-files so the dev route can reach the sizes it was measured for

**Commit:** `aab00d8` on branch `3d-view`.

## The defect, confirmed by reading

`lookupById` (`src/sequence/oeisClient.ts`) reads `/data/seq/{shard}.json`,
whose `d` field is a comma-separated inline term list capped at 80 terms per
sequence. `createRebuilder` (`src/viz3d/dev/route.ts`) sliced that to
`state.terms`, so a term-count control set to 500 or 100,000 still drew at
most 80 terms - `MEASURED_CEILING` (1,000,000 vertices, `src/viz3d/budget.ts`)
and the over-budget warning from the previous task were unreachable.

## Files changed

- `src/viz3d/dev/route.ts`
- `tests/viz3d/rebuild.test.ts`

No other files touched. `git diff --stat` before commit: 2 files changed,
231 insertions(+), 11 deletions(-).

## What changed

`src/viz3d/dev/route.ts`:

- New exported type `BFileLoader = (aNumber: string, cap: number) =>
  Promise<BFileResult>`, isolating `fetchBFile`'s shape the same way
  `SequenceLoader` isolates `lookupById`'s.
- New exported interface `LoadReport { requested, loaded, source: 'inline' |
  'bfile', truncated?, error? }` - what a rebuild actually drew, versus what
  the control state asked for.
- `createRebuilder` gained two new **trailing** optional parameters -
  `onLoadReport?: (report: LoadReport) => void` and `bfileLoader:
  BFileLoader = fetchBFile` - appended after the existing `onOverBudget`
  parameter, so every existing positional call site (route.ts's own call,
  and the existing test) still compiles unchanged.
- Rebuild logic: after the inline load's staleness check passes, if
  `state.terms > terms.length` (the inline data doesn't cover what was
  asked), it calls `bfileLoader(state.aNumber, state.terms)` - the same call
  shape `sequencePanel.ts`'s b-file button and preset loader use. **A second
  staleness check (`if (mine !== generation) return;`) runs immediately after
  this second await**, mirroring the one after the first await, with a
  comment explaining why: this is the second await the request-generation
  token has to cover, or a slow b-file fetch from a superseded request can
  overwrite a newer one's drawing - the exact bug the existing guard exists
  to kill. A rejected b-file fetch is caught and falls back to the inline
  terms (`report.source = 'inline'`, `report.error` set) rather than
  propagating and failing the draw.
- `onLoadReport?.(report)` fires for every winning rebuild (before
  `onSequence`), reporting `requested`, `loaded`, `source`, and (for a
  b-file) `truncated`.
- New exported pure function `describeLoad(report): string` turns a
  `LoadReport` into a sentence: notes an explicit fetch failure; for a
  b-file with `truncated: false` and `loaded < requested`, says the b-file
  itself is that short (not the cap); otherwise a plain "loaded N terms."
  line.
- `mount3dRoute` wires `onLoadReport` to the readout div, keeping the last
  load-status string in a `loadStatus` variable so the (separate)
  over-budget warning callback - which can fire later in the same rebuild,
  for the same, now-larger geometry - prepends it instead of erasing it.

## How failure is reported to the reader

Three cases, all visible in the bottom-right readout div without needing a
click:

1. **Requested count satisfied from a b-file:** `"loaded 5,000 terms from
   the b-file."`
2. **B-file itself shorter than requested** (`truncated: false`, `loaded <
   requested`): `"loaded 10,000 of 20,000 requested terms - the b-file
   itself only has 10,000."` - distinguishes "OEIS doesn't publish more"
   from "the cap stopped it," exactly as `fetchBFile`'s own `truncated` flag
   is meant to.
3. **B-file fetch failed:** `"loaded 80 terms (the b-file fetch failed:
   <message> - showing the inline data instead)."` - the draw still
   happens, from the inline terms, degraded rather than dead.

If a later over-budget warning fires in the same rebuild, it's appended
after the load status rather than replacing it, so both facts stay visible.

## Test commands and output

`npx vitest run tests/viz3d/rebuild.test.ts`:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Four tests: the pre-existing staleness-on-first-await test, plus three new
ones added per the dispatch:

1. `fetches the b-file when the requested term count exceeds the inline
   data, and draws the larger count` - inline loader returns 3 terms, state
   asks for 50, fake `bfileLoader` returns 50 terms; asserts the b-file was
   called with `{ aNumber: 'A_FIRST', cap: 50 }`, the drawn geometry has
   `(50+1)*3` position floats (not `(3+1)*3`), and the report is `{
   requested: 50, loaded: 50, source: 'bfile', truncated: false }`.
2. `falls back to the inline terms and reports it when the b-file fetch
   rejects, without failing the draw` - fake `bfileLoader` rejects with `B-
   file request failed (HTTP 500).`; asserts the draw still happens from the
   3 inline terms (`(3+1)*3` positions) and the report has `source:
   'inline'`, `loaded: 3`, `error` set to that message.
3. `holds the staleness guard across the b-file fetch too - a second await
   the generation token must also cover` - two requests, both routed through
   deferred fake b-file promises. Uses an `until()` microtask-polling helper
   (rather than counting `await` ticks, which is an engine-scheduling detail)
   to let the first request's inline load resolve and its b-file fetch get
   issued *before* the second request starts, so both requests clear the
   FIRST staleness check while only one generation is active - isolating the
   SECOND check as the only thing that can tell them apart. Resolves the
   second (newer) request's b-file fetch first, then the first (stale)
   request's last, and asserts exactly one `setGeometry` call, with the
   newer request's (70-term) geometry.

### Deliberately breaking the guard to prove test 3 catches it

Per the dispatch, I removed the second staleness check
(`if (mine !== generation) return;` right after `await
bfileLoader(...)`) and reran:

```
 ❯ tests/viz3d/rebuild.test.ts (4 tests | 1 failed) 12ms
     × holds the staleness guard across the b-file fetch too - a second await the generation token must also cover 6ms

 FAIL  tests/viz3d/rebuild.test.ts > createRebuilder > holds the staleness guard across the b-file fetch too - a second await the generation token must also cover
AssertionError: expected [ { …(4) }, { …(4) } ] to have a length of 1 but got 2

 ❯ tests/viz3d/rebuild.test.ts:176:19
    174|     await firstDone;
    175|
    176|     expect(calls).toHaveLength(1);
       |                   ^
    177|     expect(calls[0]!.positions).toHaveLength((70 + 1) * 3);

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

The other three tests stayed green - only the guard-specific test caught the
regression. Restored the check immediately after; reran and confirmed 4/4
pass again.

`npm test` (full suite): `Test Files 59 passed (59)`, `Tests 730 passed
(730)`. (jsdom prints repeated `Not implemented: HTMLCanvasElement's
getContext()` warnings from unrelated pre-existing scene/bench tests - not
new, not failures.)

`npm run build` (`tsc --noEmit && vite build`): clean, no type errors,
bundle unchanged in shape (`dist/assets/index-BFHzFX5b.js 226.46 kB`).

`npm run build && grep -rl "OrbitControls\|three/build" dist/ || echo
"clean: three is not in dist"`:

```
clean: three is not in dist
```

## Decisions this dispatch did not specify

- **Parameter order for the two new `createRebuilder` seams.** Appended
  `onLoadReport` and `bfileLoader` (in that order) strictly after
  `onOverBudget`, both trailing, so every existing positional call
  compiles without change. `bfileLoader` comes last (with the production
  default) even though `onLoadReport` has no default, since TS requires
  parameters after the first defaulted one to remain optional/defaulted,
  and putting the callback before the defaulted loader reads more
  naturally next to the other three callbacks.
- **Trigger condition for the b-file fetch.** `state.terms > loaded.terms.length`
  - i.e., only fetch when the inline data can't already cover what's
    asked. Matches the dispatch's "when the requested count needs more
    than the inline data provides."
- **What identifies the sequence to `fetchBFile`.** Used `state.aNumber`
  (the same string handed to the primary `loader`), not `loaded.aNumber`,
  since `fetchBFile` normalizes it itself and this keeps both fetches keyed
  off the same input rather than trusting a field the loader happens to
  echo back.
- **Readout composition when both a load report and an over-budget warning
  fire in the same rebuild.** Not specified. Chose to keep the load status
  in a closure variable and prepend it to the over-budget sentence rather
  than letting the warning silently overwrite the term-count fact - these
  two conditions are likely to co-occur (a b-file large enough to need
  fetching is also large enough to threaten the ceiling).
- **Message wording for the three `describeLoad` cases** (bfile-success,
  bfile-itself-shorter, fetch-failed, inline-short) - not specified beyond
  "make the real count visible" and "say that" for the two callout cases;
  wrote plain sentences following the existing readout's tone.
- **Test-timing technique for test 3.** Used a microtask-polling `until()`
  helper instead of counting `await Promise.resolve()` ticks, to avoid
  depending on V8's specific number of microtask turns for promise
  resolution (an engine implementation detail, not a language guarantee).
