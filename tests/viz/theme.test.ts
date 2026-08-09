import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import {
  canvasTheme, setCanvasTheme, DARK_PALETTE, LIGHT_PALETTE, type CanvasPalette,
} from '../../src/viz/theme';
import { fakeCtx } from '../helpers/fakeCtx';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, clearRegistry } from '../../src/viz/registry';
import { defaultParams } from '../../src/viz/types';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

afterEach(() => setCanvasTheme('dark'));

/** WCAG relative luminance and contrast, so the palettes are measured not assumed. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

describe('canvas palettes', () => {
  it('defaults to dark, so nothing changes until the theme is switched', () => {
    expect(canvasTheme()).toBe(DARK_PALETTE);
  });

  it('switches and switches back', () => {
    setCanvasTheme('light');
    expect(canvasTheme()).toBe(LIGHT_PALETTE);
    setCanvasTheme('dark');
    expect(canvasTheme()).toBe(DARK_PALETTE);
  });

  it('both palettes define every key', () => {
    const keys: Array<keyof CanvasPalette> = ['bg', 'panel', 'text', 'muted', 'accent', 'real', 'grid', 'axis', 'band'];
    for (const p of [DARK_PALETTE, LIGHT_PALETTE]) {
      for (const k of keys) expect(p[k], `${k} missing`).toBeDefined();
    }
  });

  it('text, muted, real and accent pass AA against their own background in BOTH themes', () => {
    for (const [name, p] of [['dark', DARK_PALETTE], ['light', LIGHT_PALETTE]] as const) {
      expect(contrast(p.text, p.bg), `${name}: text on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, p.bg), `${name}: muted on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.real, p.bg), `${name}: real-line on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, p.bg), `${name}: accent on bg`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the light background really is light and the dark one dark', () => {
    // Guards against a copy-paste leaving both palettes the same.
    expect(LIGHT_PALETTE.bg).not.toBe(DARK_PALETTE.bg);
    expect(contrast(LIGHT_PALETTE.bg, '#ffffff')).toBeLessThan(1.5);
    expect(contrast(DARK_PALETTE.bg, '#000000')).toBeLessThan(1.5);
  });

  it('band() returns progressively stronger fills for deeper levels', () => {
    for (const p of [DARK_PALETTE, LIGHT_PALETTE]) {
      expect(p.band(0)).not.toBe(p.band(2));
      expect(p.band(0)).toMatch(/rgba?\(/);
    }
  });
});

describe('visualizers follow the active theme', () => {
  beforeAll(() => { clearRegistry(); registerAll(); });

  const seq = new SequenceView({
    terms: Array.from({ length: 60 }, (_, i) => BigInt(i % 7)),
    name: 't', offset: 0, source: 'paste',
  } as Sequence);

  it('no visualizer emits a dark-theme literal while the light theme is active', () => {
    setCanvasTheme('light');
    const darkLiterals = ['#14161a', '#9aa0aa', '#7aa2f7', '#f7768e', '#1d2026', '255,255,255'];
    for (const viz of allVisualizers()) {
      const { ctx } = fakeCtx();
      const seen: string[] = [];
      const spy = new Proxy(ctx, {
        set(_t, prop, value) {
          if (prop === 'fillStyle' || prop === 'strokeStyle') seen.push(String(value));
          return true;
        },
        get(t, prop) { return (t as never)[prop]; },
      });
      viz.render(seq, defaultParams(viz.params), spy, { width: 300, height: 300 });
      for (const lit of darkLiterals) {
        expect(
          seen.some((c) => c.toLowerCase().includes(lit)),
          `${viz.id} emitted ${lit} while the light theme was active`,
        ).toBe(false);
      }
    }
  });
});
