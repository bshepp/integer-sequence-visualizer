// tests/viz3d/colors.test.ts
import { describe, it, expect } from 'vitest';
import { colorsFor } from '../../src/viz3d/colors';
import { liftPath } from '../../src/viz3d/lift';
import { DEFAULT_STYLE } from '../../src/viz/style';
import { canvasTheme } from '../../src/viz/theme';

const geometry = liftPath(
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
  (i) => Math.max(0, i - 1),
  { step: 1 },
);

describe('colorsFor', () => {
  it('gives every vertex a colour', () => {
    const colors = colorsFor(geometry, 3);
    expect(colors).toHaveLength(geometry.termOf.length * 3);
  });

  it('walks the hue ramp: first and last vertices differ', () => {
    const colors = colorsFor(geometry, 3);
    const first = [colors[0], colors[1], colors[2]];
    const last = [...colors.slice(-3)];
    expect(first).not.toEqual(last);
  });

  it('matches the 2D drawing, which is what the canonical zero needs', async () => {
    // strokeColorAt is what the flat views use; top-down must agree with them.
    const { strokeColorAt, DEFAULT_STYLE } = await import('../../src/viz/style');
    const expected = strokeColorAt(DEFAULT_STYLE, 0);
    const [h, s, l] = expected.match(/[\d.]+/g)!.map(Number) as [number, number, number];
    const colors = colorsFor(geometry, 3);
    const [r, g, b] = hslToRgb(h, s / 100, l / 100);
    expect(Math.abs(colors[0]! - r)).toBeLessThanOrEqual(1);
    expect(Math.abs(colors[1]! - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(colors[2]! - b)).toBeLessThanOrEqual(1);
  });

  // Regression: strokeColorAt does not only return hsl(...) - blackLine
  // returns '#000000' and colorMode 'none' returns the theme's muted hex.
  // parseCssColor's [\d.]+ regex used to pull too few groups out of either
  // form and silently fall back to white, which is exactly wrong: a style
  // override should never be invisible.
  it('blackLine forces pure black for every vertex', () => {
    const colors = colorsFor(geometry, 3, { ...DEFAULT_STYLE, blackLine: true });
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).toBe(0);
    }
  });

  it("colorMode 'none' gives the theme's muted grey for every vertex, not white", () => {
    const style = { ...DEFAULT_STYLE, colorMode: 'none' as const };
    const colors = colorsFor(geometry, 3, style);
    const [er, eg, eb] = hexToRgb(canvasTheme().muted);
    expect([er, eg, eb]).not.toEqual([255, 255, 255]);
    for (let i = 0; i < colors.length / 3; i++) {
      expect(colors[i * 3]).toBe(er);
      expect(colors[i * 3 + 1]).toBe(eg);
      expect(colors[i * 3 + 2]).toBe(eb);
    }
  });
});

/** Reference hex parser, deliberately independent of colors.ts's own parser. */
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) throw new Error(`hexToRgb: not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Reference conversion, deliberately written out rather than imported. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
