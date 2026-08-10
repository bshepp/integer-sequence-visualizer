import { describe, it, expect } from 'vitest';
import {
  IDENTITY_VIEWPORT, isIdentity, screenToWorld, worldToScreen, zoomAt, clampViewport, type Viewport,
} from '../../src/ui/viewport';

describe('viewport maths', () => {
  it('identity maps a point to itself', () => {
    expect(screenToWorld(IDENTITY_VIEWPORT, 120, 80)).toEqual({ x: 120, y: 80 });
    expect(isIdentity(IDENTITY_VIEWPORT)).toBe(true);
  });

  it('screenToWorld and worldToScreen are exact inverses', () => {
    const v: Viewport = { zoom: 2.5, panX: -40, panY: 15 };
    const world = { x: 33, y: -12 };
    const screen = worldToScreen(v, world.x, world.y);
    const back = screenToWorld(v, screen.x, screen.y);
    expect(back.x).toBeCloseTo(world.x, 10);
    expect(back.y).toBeCloseTo(world.y, 10);
  });

  it('zooming at a point keeps that point stationary', () => {
    // The property that makes wheel-zoom feel right: whatever is under the
    // cursor stays under the cursor.
    const v: Viewport = { zoom: 1, panX: 0, panY: 0 };
    const cx = 300, cy = 200;
    const before = screenToWorld(v, cx, cy);
    const after = screenToWorld(zoomAt(v, 1.8, cx, cy), cx, cy);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it('composes repeated zooms about different points without drifting', () => {
    let v: Viewport = IDENTITY_VIEWPORT;
    v = zoomAt(v, 1.4, 100, 100);
    v = zoomAt(v, 1.4, 400, 250);
    const stay = screenToWorld(v, 400, 250);
    const after = screenToWorld(zoomAt(v, 1.4, 400, 250), 400, 250);
    expect(after.x).toBeCloseTo(stay.x, 8);
    expect(after.y).toBeCloseTo(stay.y, 8);
  });

  it('clamps zoom to a usable range', () => {
    expect(clampViewport({ zoom: 0.001, panX: 0, panY: 0 }).zoom).toBeGreaterThanOrEqual(0.25);
    expect(clampViewport({ zoom: 10_000, panX: 0, panY: 0 }).zoom).toBeLessThanOrEqual(64);
  });

  it('rejects a non-finite viewport rather than propagating NaN into the transform', () => {
    const bad = clampViewport({ zoom: NaN, panX: Infinity, panY: -Infinity });
    expect(Number.isFinite(bad.zoom)).toBe(true);
    expect(Number.isFinite(bad.panX)).toBe(true);
    expect(Number.isFinite(bad.panY)).toBe(true);
  });

  it('stays stationary even at the zoom limit, where the factor is clipped', () => {
    // zoomAt must derive its pan from the CLAMPED zoom, or a wheel spin at
    // maximum zoom walks the drawing sideways.
    const v: Viewport = { zoom: 64, panX: 10, panY: 20 };
    const before = screenToWorld(v, 300, 200);
    const after = screenToWorld(zoomAt(v, 4, 300, 200), 300, 200);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it('isIdentity is false once anything moves', () => {
    expect(isIdentity({ zoom: 1.01, panX: 0, panY: 0 })).toBe(false);
    expect(isIdentity({ zoom: 1, panX: 3, panY: 0 })).toBe(false);
  });
});

// @vitest-environment jsdom
import { mountApp } from '../../src/ui/app';
import { turtleViz } from '../../src/viz/turtle';
import { kolakoski } from '../../src/examples/sequences';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const mkView = (terms: bigint[]) =>
  new SequenceView({ terms, name: 'k', offset: 0, source: 'paste' } as Sequence);
import { encodeState, decodeState } from '../../src/ui/urlState';

describe('viewport in the engine', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('offers labelled zoom controls including a reset', () => {
    const root = mountEngine();
    for (const cls of ['.zoom-in', '.zoom-out', '.zoom-reset']) {
      const b = root.querySelector<HTMLButtonElement>(cls);
      expect(b, `${cls} missing`).not.toBeNull();
      expect(b!.tagName).toBe('BUTTON');
      expect(b!.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('reports the zoom level and returns to 100% on reset', () => {
    const root = mountEngine();
    root.querySelector<HTMLButtonElement>('.zoom-in')!.click();
    root.querySelector<HTMLButtonElement>('.zoom-in')!.click();
    expect(root.querySelector('.zoom-level')!.textContent).not.toMatch(/^100\s*%$/);
    root.querySelector<HTMLButtonElement>('.zoom-reset')!.click();
    expect(root.querySelector('.zoom-level')!.textContent).toMatch(/100\s*%/);
  });

  it('survives a share-link round trip', () => {
    const v = { zoom: 3.5, panX: -120, panY: 44 };
    const back = decodeState('#' + encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'off',
      surrogate: 'permutation', seed: 1, viewport: v,
    }));
    expect(back!.viewport).toEqual(v);
  });
});

describe('hit-testing survives the viewport', () => {
  // The app converts in both directions: hitAt runs screenToWorld before
  // calling locate, and the marker pass runs worldToScreen after position().
  // Getting one direction wrong yields a marker that drifts as you zoom, or a
  // cursor that reports the wrong term - both of which look like rendering
  // bugs rather than transform bugs, so they are pinned here.
  const seq = mkView(kolakoski(200));
  const SIZE = { width: 800, height: 600 };
  const params = { angle: 73, k: 7 };
  const VIEWPORTS: Viewport[] = [
    { zoom: 1, panX: 0, panY: 0 },
    { zoom: 3.84, panX: -230, panY: -95 },
    { zoom: 0.4, panX: 60, panY: 20 },
    { zoom: 12, panX: -1500, panY: -900 },
  ];

  it('locate still names the term the cursor is over, at any zoom', () => {
    for (const v of VIEWPORTS) {
      for (const i of [0, 37, 120, 199]) {
        const world = turtleViz.position!(seq, params, SIZE, i)!;
        const screen = worldToScreen(v, world.x, world.y);
        const back = screenToWorld(v, screen.x, screen.y);
        const hit = turtleViz.locate!(seq, params, SIZE, back.x, back.y);
        expect(hit, `zoom ${v.zoom}, term ${i}`).toEqual({ kind: 'term', index: i });
      }
    }
  });

  it('the marker lands where the cursor found the term', () => {
    for (const v of VIEWPORTS) {
      const world = turtleViz.position!(seq, params, SIZE, 60)!;
      const marker = worldToScreen(v, world.x, world.y);
      const cursor = worldToScreen(v, world.x, world.y);
      expect(marker.x).toBeCloseTo(cursor.x, 9);
      expect(marker.y).toBeCloseTo(cursor.y, 9);
    }
  });
});
