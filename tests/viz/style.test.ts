import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STYLE, styleToParams, styleFromParams, strokeColorAt, type RenderStyle,
} from '../../src/viz/style';
import { fakeCtx } from '../helpers/fakeCtx';
import { turtleViz } from '../../src/viz/turtle';
import { ulamViz } from '../../src/viz/ulamSpiral';
import { scatterViz } from '../../src/viz/scatter';
import { modGridViz } from '../../src/viz/modGrid';
import { differencesViz } from '../../src/viz/differences';
import { histogramViz } from '../../src/viz/histogram';
import { autocorrViz } from '../../src/viz/autocorrelation';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams, type Visualizer } from '../../src/viz/types';

const mk = (n: number) =>
  new SequenceView({
    terms: Array.from({ length: n }, (_, i) => BigInt(i % 7)),
    name: 't', offset: 0, source: 'paste',
  } as Sequence);

/** Records everything assigned to the 2D context, which a Proxy-based fake drops. */
function recordingCtx(): { ctx: CanvasRenderingContext2D; sets: Record<string, unknown[]> } {
  const sets: Record<string, unknown[]> = {};
  const { ctx } = fakeCtx();
  const spy = new Proxy(ctx, {
    set(_t, prop, value) { (sets[String(prop)] ??= []).push(value); return true; },
    get(t, prop) { return (t as never)[prop]; },
  });
  return { ctx: spy, sets };
}

describe('RenderStyle param round-trip', () => {
  it('survives encode/decode unchanged', () => {
    const s: RenderStyle = {
      lineWidth: 3, lineJoin: 'bevel', lineCap: 'square',
      colorMode: 'flat', hueStart: 40, hueEnd: 300,
    };
    expect(styleFromParams(styleToParams(s))).toEqual(s);
  });

  it('falls back to defaults for missing or malformed keys', () => {
    expect(styleFromParams({})).toEqual(DEFAULT_STYLE);
    expect(styleFromParams({ styleLineWidth: 'wide', styleColorMode: 'rainbow' })).toEqual(DEFAULT_STYLE);
  });

  it('clamps line width into a drawable range', () => {
    expect(styleFromParams({ styleLineWidth: 0 }).lineWidth).toBeGreaterThan(0);
    expect(styleFromParams({ styleLineWidth: 9999 }).lineWidth).toBeLessThanOrEqual(12);
  });
});

describe('strokeColorAt', () => {
  const s: RenderStyle = { ...DEFAULT_STYLE, hueStart: 0, hueEnd: 300, colorMode: 'spectrum' };

  it('interpolates hue from start to end across the path', () => {
    expect(strokeColorAt(s, 0)).toContain('hsl(0');
    expect(strokeColorAt(s, 1)).toContain('hsl(300');
  });

  it('respects a reversed range', () => {
    const rev: RenderStyle = { ...s, hueStart: 300, hueEnd: 0 };
    expect(strokeColorAt(rev, 0)).toContain('hsl(300');
    expect(strokeColorAt(rev, 1)).toContain('hsl(0');
  });

  it('flat mode ignores position and uses hueStart throughout', () => {
    const flat: RenderStyle = { ...s, colorMode: 'flat' };
    expect(strokeColorAt(flat, 0)).toBe(strokeColorAt(flat, 1));
  });

  it('"none" mode is a single neutral colour, not a hue', () => {
    const none: RenderStyle = { ...s, colorMode: 'none' };
    expect(strokeColorAt(none, 0)).toBe(strokeColorAt(none, 0.7));
    expect(strokeColorAt(none, 0)).not.toContain('hsl');
  });
});

describe('visualizers honour RenderStyle', () => {
  it('turtle applies the requested line width, join and cap', () => {
    const { ctx, sets } = recordingCtx();
    turtleViz.render(mk(50), {
      ...defaultParams(turtleViz.params),
      ...styleToParams({
        lineWidth: 4, lineJoin: 'round', lineCap: 'square',
        colorMode: 'flat', hueStart: 200, hueEnd: 200,
      }),
    }, ctx, { width: 300, height: 300 });
    expect(sets.lineWidth).toContain(4);
    expect(sets.lineJoin).toContain('round');
    expect(sets.lineCap).toContain('square');
  });

  const COLOURED: Visualizer[] = [
    turtleViz, ulamViz, scatterViz, modGridViz, differencesViz, histogramViz, autocorrViz,
  ];

  it('colour mode "none" produces no hsl colours anywhere', () => {
    for (const viz of COLOURED) {
      const { ctx, sets } = recordingCtx();
      viz.render(mk(60), {
        ...defaultParams(viz.params),
        ...styleToParams({
          lineWidth: 1, lineJoin: 'miter', lineCap: 'butt',
          colorMode: 'none', hueStart: 0, hueEnd: 300,
        }),
      }, ctx, { width: 300, height: 300 });
      const colours = [...(sets.fillStyle ?? []), ...(sets.strokeStyle ?? [])].map(String);
      expect(colours.some((c) => c.includes('hsl')), `${viz.id} still emits hsl in "none" mode`).toBe(false);
    }
  });

  it('defaults reproduce the previous appearance', () => {
    const { ctx, sets } = recordingCtx();
    turtleViz.render(mk(20), defaultParams(turtleViz.params), ctx, { width: 300, height: 300 });
    // The value strokePath hard-coded before the style layer existed.
    expect(sets.lineWidth).toContain(1.25);
  });
});
