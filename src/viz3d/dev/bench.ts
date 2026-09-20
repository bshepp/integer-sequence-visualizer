// src/viz3d/dev/bench.ts
import { createScene } from './scene';
import { liftPath } from '../lift';

/**
 * One vertex count's cost, broken into the phases that turned out to differ:
 * building the path in JS, uploading it to the GPU, and steady-state frame
 * time once it's on screen. `totalMs` is `buildMs + uploadMs` - the stall a
 * viewer feels when a drawing is constructed, before any frame is drawn.
 *
 * `msPerFrame` is only honest when the tab is visible - see `nextFrame`
 * below. In an automated, hidden tab the frame callback is throttled, so the
 * number this field carries there is not steady-state frame rate; it is
 * whatever the timer fallback measured, which is not the same thing.
 */
export interface BenchRow {
  vertices: number;
  buildMs: number;
  uploadMs: number;
  totalMs: number;
  msPerFrame: number;
}

/**
 * One frame's wait, however the tab can currently deliver it.
 *
 * `requestAnimationFrame` never fires while `document.hidden` is true - an
 * automated browser tab, or one in a background window - so awaiting it
 * there hangs forever. This falls back to a macrotask timer in that case,
 * which is not a real frame boundary but does resolve, which is the point:
 * it is what keeps `runBench` from hanging rather than a claim about frame
 * pacing.
 */
function nextFrame(): Promise<void> {
  if (document.hidden) return new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
      const frameStart = performance.now();
      for (let f = 0; f < FRAMES; f++) {
        scene.resize();
        gl?.finish();
        await nextFrame();
      }
      const msPerFrame = (performance.now() - frameStart) / FRAMES;

      rows.push({ vertices, buildMs, uploadMs, totalMs: buildMs + uploadMs, msPerFrame });
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
