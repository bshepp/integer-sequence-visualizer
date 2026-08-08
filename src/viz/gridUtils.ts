import type { Size } from './types';
import { minMax } from './mathUtils';

export function spiralCoord(i: number): { x: number; y: number } {
  // Walk the spiral: direction cycle R,U,L,D with run lengths 1,1,2,2,3,3,…
  let x = 0, y = 0;
  let dir = 0; // 0=R 1=U 2=L 3=D
  let run = 1, stepsInRun = 0, runsAtThisLength = 0;
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
  for (let n = 0; n < i; n++) {
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
  return { x, y };
}

/**
 * All spiral coordinates up to n in a single O(n) walk.
 *
 * spiralCoord(i) restarts the walk on every call, so building the whole list
 * from it is O(n^2) - render already paid that, and locate() would have paid
 * it again on every pointer move.
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

/** The exact layout render() uses, so locate() inverts the same numbers. */
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
