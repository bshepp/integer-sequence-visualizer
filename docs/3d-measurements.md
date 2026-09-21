# 3D measurements

**Asked as:** "can we do testing to see when the 3D tool starts to stall?"

## Method and machine

Median of 3 runs of `?3d&bench` (`src/viz3d/dev/bench.ts`), Chrome, 900x600
canvas.

**GPU:** `ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 SUPER (0x00002187) Direct3D11
vs_5_0 ps_5_0, D3D11)`
**Date:** 2026-09-20

## What was measured

Geometry build (JS) plus everything `setGeometry` does before the next frame
is drawn, bracketed by `gl.finish()` so the timing waits for the GPU rather
than for the JS call that only queued work for it. "GPU upload" undersells
what that call does: it uploads the real object's own position/colour
buffers, but it also decimates a picking proxy (`decimate` in
`src/viz3d/pick.ts`, capped at 20,000 vertices - see `MAX_PICK_VERTICES` in
`src/viz3d/dev/scene.ts`) and uploads that proxy's buffer separately,
recomputes the camera framing from the new bounds (`reframe`/`framingFor`),
and renders one frame. All of that runs inside the `setGeometry` call this
table times, against vertex count:

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

`bench.ts` returns two fields per row for this: `framePacing`
(`'raf' | 'timer'`) and `msPerFrame` (`number | null`). `framePacing` is
`'raf'` only when every one of that row's 30 frames was paced by a real
`requestAnimationFrame` callback, and flips to `'timer'` the moment even one
frame falls back to a plain timer - checked frame by frame, since a tab can
go hidden partway through a row's sweep, not read once at the start. When a
row is `'timer'`-paced, its `msPerFrame` is `null`, not a number with an
asterisk: a reading from an unpaced loop is not a frame time, and `null`
cannot be copied into a table and mistaken for a real one the way a plausible
number could be. This is what happened on this run - every row's timing came
back `framePacing: 'timer'`, `msPerFrame: null` - which is the whole reason
this file reports build+upload cost as the fact and frame rate as
unmeasured, rather than printing whatever number the timer fallback
produced.

## Getting a real frame-rate number later

To measure steady-state frame rate (not attempted in this pass):

1. Run `npx vite --port 5179 --strictPort`. (`npm run dev` defaults to port
   5173, which on this machine is already held by another project;
   `--strictPort` fails loudly instead of silently landing on a different
   port.)
2. Open `http://localhost:5179/?3d&bench` in an actual, focused, visible
   browser tab or window - not a headless run, not a background tab, and not
   an automated tab driven by a tool that never brings it into the
   foreground. `document.hidden` must read `false` for the whole run.
3. Watch the console: `runBench` prints a table (`console.table`) and the GPU
   string (`console.log('GPU:', ...)`).
4. Check `framePacing` before trusting `msPerFrame` on any row. `'raf'` means
   that row's `msPerFrame` is a real measurement; `'timer'` means it is
   `null` in the table, because the tab lost visibility during that row's
   sweep. Only copy `msPerFrame` values from `'raf'` rows into this document.

## Standing lesson

An automated tab can render correctly and still make a benchmark harness lie,
because `requestAnimationFrame` is throttled independently of rendering
itself. A hang (no number) is more honest than a fallback number offered as a
frame rate - which is why this file states the build+upload cost as a fact
and states frame rate as unmeasured, rather than filling the gap with the
nearest number the automated run happened to produce.
