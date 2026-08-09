export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export const IDENTITY_VIEWPORT: Viewport = { zoom: 1, panX: 0, panY: 0 };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 64;

const finite = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

export function clampViewport(v: Viewport): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finite(v.zoom, 1)));
  return { zoom, panX: finite(v.panX, 0), panY: finite(v.panY, 0) };
}

export function isIdentity(v: Viewport): boolean {
  return v.zoom === 1 && v.panX === 0 && v.panY === 0;
}

/**
 * One transform, applied around the visualizer's render call and inverted
 * once for hit-testing.
 *
 * This is the whole design. No visualizer knows the zoom level, so all eleven
 * get zoom and pan without changing a line, and locate()/position() keep
 * working in the coordinate space they were written for. Threading a zoom
 * factor through every visualizer and its hit-test pair was the alternative,
 * and it is the reason this looked like a week of work rather than a day.
 *
 * Forward: screen = world * zoom + pan.
 */
export function applyViewport(ctx: CanvasRenderingContext2D, v: Viewport): void {
  ctx.translate(v.panX, v.panY);
  ctx.scale(v.zoom, v.zoom);
}

export function screenToWorld(v: Viewport, x: number, y: number): { x: number; y: number } {
  return { x: (x - v.panX) / v.zoom, y: (y - v.panY) / v.zoom };
}

export function worldToScreen(v: Viewport, x: number, y: number): { x: number; y: number } {
  return { x: x * v.zoom + v.panX, y: y * v.zoom + v.panY };
}

/** Zoom by `factor` about a screen point, leaving that point stationary. */
export function zoomAt(v: Viewport, factor: number, cx: number, cy: number): Viewport {
  const next = clampViewport({ ...v, zoom: v.zoom * factor });
  // Solve for the pan that keeps whatever is under (cx, cy) under it.
  const world = screenToWorld(v, cx, cy);
  return clampViewport({
    zoom: next.zoom,
    panX: cx - world.x * next.zoom,
    panY: cy - world.y * next.zoom,
  });
}
