// src/viz3d/dev/bench.ts
import { createScene } from './scene';
import { liftPath } from '../lift';

export interface BenchRow { vertices: number; msPerFrame: number; }

/**
 * Frame time against vertex count on whatever machine this is.
 *
 * The ceiling this produces is a fact about one GPU, which is why the docs
 * record the renderer string beside it rather than stating a universal number.
 */
export async function runBench(canvas: HTMLCanvasElement): Promise<BenchRow[]> {
  const scene = createScene(canvas);
  try {
    const rows: BenchRow[] = [];
    for (const vertices of [10_000, 50_000, 100_000, 500_000, 1_000_000, 2_000_000, 5_000_000]) {
      const path = Array.from({ length: vertices }, (_, i) => ({
        x: Math.cos(i / 97) * i, y: Math.sin(i / 89) * i,
      }));
      scene.setGeometry(liftPath(path, (i) => i, { step: 0.5 }));
      const t0 = performance.now();
      const FRAMES = 30;
      for (let f = 0; f < FRAMES; f++) {
        scene.resize();
        await new Promise((r) => requestAnimationFrame(r));
      }
      rows.push({ vertices, msPerFrame: (performance.now() - t0) / FRAMES });
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
