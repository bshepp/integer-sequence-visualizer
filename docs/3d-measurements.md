# 3D measurements

**Asked as:** "can we do testing to see when the 3D tool starts to stall?"

## Method and machine

Median of 3 runs of `?3d&bench` (`src/viz3d/dev/bench.ts`), Chrome, 900x600
canvas.

**GPU:** `ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 SUPER (0x00002187) Direct3D11
vs_5_0 ps_5_0, D3D11)`
**Date:** 2026-09-20

## What was measured

Geometry build (JS) plus GPU upload (`setGeometry` followed by `gl.finish()`),
against vertex count:

| vertices | build ms | upload ms | total ms |
|---|---|---|---|
| 10,000 | 1 | 3 | 4 |
| 50,000 | 2 | 3 | 5 |
| 100,000 | 4 | 4 | 8 |
| 500,000 | 34 | 21 | 55 |
| 1,000,000 | 41 | 24 | 65 |
| 2,000,000 | 164 | 81 | 244 |
| 5,000,000 | 400 | 206 | 606 |

`total ms` is the stall a viewer feels the moment a drawing is constructed -
the JS work to lay out the path, plus handing it to the GPU - not the cost of
any frame drawn afterward.

**Ceiling: 1,000,000 vertices.** Chosen from this table, not from frame rate:
65ms at 1,000,000 is tolerable, 244ms at 2,000,000 is a visible stall, and
606ms at 5,000,000 is unusable. `src/viz3d/budget.ts` warns above it.

## What was NOT measured

**Steady-state frame rate.** No frames-per-second or ms-per-frame number is
recorded here, and none should be inferred from the table above.

The run that produced these numbers happened in an automated browser tab,
where `document.hidden` is `true`. `requestAnimationFrame` does not fire in a
hidden tab, so a harness that waits on it hangs rather than measuring
anything - confirmed directly on this run (`rafFired: false`,
`visibilityState: 'hidden'`). Rendering itself works fine in that tab; only
the frame callback is throttled. Separately, `gl.finish()`-bracketed frame
timings taken outside the harness came back at 0.03ms for 5,000,000 vertices,
which is not a real number, and a `readPixels`-based approach is dominated by
the pixel transfer rather than the draw. Neither is trustworthy, so neither is
reported as a fact here.

`bench.ts` still returns an `msPerFrame` field per row (Stage B widened
`BenchRow` to carry it alongside `buildMs`/`uploadMs`/`totalMs`), and it now
falls back to a timer instead of `requestAnimationFrame` when the tab is
hidden, so the harness terminates instead of hanging. That fallback makes the
harness finish; it does not make the number it produces in a hidden tab a
frame rate. Treat `msPerFrame` as meaningful only from a run in a visible tab.

## Getting a real frame-rate number later

To measure steady-state frame rate (not attempted in this pass):

1. Run `npm run dev`.
2. Open `http://localhost:5173/?3d&bench` in an actual, focused, visible
   browser tab or window - not a headless run, not a background tab, and not
   an automated tab driven by a tool that never brings it into the
   foreground. `document.hidden` must read `false` for the whole run.
3. Watch the console: `runBench` prints a table (`console.table`) and the GPU
   string (`console.log('GPU:', ...)`).
4. Read `msPerFrame` from that table. It is only honest if the tab stayed
   visible for the whole run - switching away partway through will silently
   fall back to the timer path for the remaining frames.

## Standing lesson

An automated tab can render correctly and still make a benchmark harness lie,
because `requestAnimationFrame` is throttled independently of rendering
itself. A hang (no number) is more honest than a fallback number offered as a
frame rate - which is why this file states the build+upload cost as a fact
and states frame rate as unmeasured, rather than filling the gap with the
nearest number the automated run happened to produce.
