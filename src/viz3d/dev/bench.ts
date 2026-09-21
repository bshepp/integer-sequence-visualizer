// src/viz3d/dev/bench.ts
import { createScene } from './scene';
import { liftPath } from '../lift';

/** Which timer paced a frame: a real vsync, or the hidden-tab fallback. */
export type FramePacing = 'raf' | 'timer';

/**
 * One vertex count's cost, broken into the phases that turned out to differ:
 * building the path in JS, uploading it to the GPU, and steady-state frame
 * time once it's on screen. `totalMs` is `buildMs + uploadMs` - the stall a
 * viewer feels when a drawing is constructed, before any frame is drawn.
 *
 * `framePacing` is data, not a comment to be trusted on faith: it is `'raf'`
 * only when every one of this row's frames was paced by a real
 * `requestAnimationFrame` callback, and `'timer'` the moment even one frame
 * fell back to the hidden-tab timer (see `nextFrame` below) - a tab can go
 * hidden partway through a row's sweep, so this is checked frame by frame,
 * not read once at the row's start. When it is `'timer'`, `msPerFrame` is
 * `null` rather than a number that merely carries a warning in its type
 * comment: a reading from an unpaced loop is not a frame time, and a `null`
 * cannot be pasted into a table and mistaken for one the way a plausible
 * number can.
 */
export interface BenchRow {
  vertices: number;
  buildMs: number;
  uploadMs: number;
  totalMs: number;
  msPerFrame: number | null;
  framePacing: FramePacing;
}

/**
 * One frame's wait, however the tab can currently deliver it - and which of
 * the two it was, so the caller can tell a real frame boundary from a
 * fallback rather than inferring it after the fact.
 *
 * `requestAnimationFrame` never fires while `document.hidden` is true - an
 * automated browser tab, or one in a background window - so awaiting it
 * there hangs forever. This falls back to a macrotask timer in that case,
 * which is not a real frame boundary but does resolve, which is the point:
 * it is what keeps `runBench` from hanging rather than a claim about frame
 * pacing.
 */
function nextFrame(): Promise<FramePacing> {
  if (document.hidden) return new Promise((resolve) => setTimeout(() => resolve('timer'), 0));
  return new Promise((resolve) => requestAnimationFrame(() => resolve('raf')));
}

/**
 * Build, upload and frame cost against vertex count on whatever machine this
 * is.
 *
 * The ceiling this produces is a fact about one GPU, which is why the docs
 * record the renderer string beside it rather than stating a universal
 * number. `gl.finish()` brackets both the upload and every frame so each
 * timing waits for the GPU rather than for the JS call that only queued work
 * for it - without that, a timing can read as near-zero regardless of how
 * much work it actually queued.
 */
export async function runBench(canvas: HTMLCanvasElement): Promise<BenchRow[]> {
  const scene = createScene(canvas);
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  try {
    const rows: BenchRow[] = [];
    for (const vertices of [10_000, 50_000, 100_000, 500_000, 1_000_000, 2_000_000, 5_000_000]) {
      const buildStart = performance.now();
      const path = Array.from({ length: vertices }, (_, i) => ({
        x: Math.cos(i / 97) * i, y: Math.sin(i / 89) * i,
      }));
      const geometry = liftPath(path, (i) => i, { step: 0.5 });
      const buildMs = performance.now() - buildStart;

      const uploadStart = performance.now();
      scene.setGeometry(geometry);
      gl?.finish();
      const uploadMs = performance.now() - uploadStart;

      const FRAMES = 30;
      let framePacing: FramePacing = 'raf';
      const frameStart = performance.now();
      for (let f = 0; f < FRAMES; f++) {
        // A plain re-render, not resize() - resize() reassigns the canvas
        // size and reallocates the drawing buffer, which is real GPU work
        // that has nothing to do with steady-state frame cost and would
        // otherwise be paid every one of these 30 iterations.
        scene.render();
        gl?.finish();
        const pacing = await nextFrame();
        if (pacing === 'timer') framePacing = 'timer'; // sticky: one fallback taints the whole row's average
      }
      const msPerFrame = framePacing === 'raf' ? (performance.now() - frameStart) / FRAMES : null;

      rows.push({ vertices, buildMs, uploadMs, totalMs: buildMs + uploadMs, msPerFrame, framePacing });
    }
    return rows;
  } finally {
    scene.dispose();
  }
}

/** The GPU string, so a number can be attributed to the machine that produced it. */
export function gpuName(canvas: HTMLCanvasElement): string {
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
}
