# Render Controls, Export, and the Line-Shape Experiment - Round 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the user control over how things are drawn, let them take the results away as images and data, and answer the question that prompted the controls in the first place - does line shape actually change what you'd conclude?

**Architecture:** A `RenderStyle` layer lives beside `state.params` and is merged into params at draw time, reusing the reserved-key pattern `logScaleOverride` and `histogramDomainLo/Hi` already established. Export shares one row-extraction function with the screen-reader data table, since a CSV, a JSON file and a table are the same numbers in three shapes. The line-shape experiment measures swept area analytically from the path geometry rather than from pixels, so it is deterministic, runs in CI, and produces a recorded verdict in exactly the format the gallery already verifies.

**Tech Stack:** Vanilla TypeScript, Canvas 2D, Vitest + jsdom, no runtime npm dependencies.

## Global Constraints

- **No runtime npm dependencies.**
- **No `Math.random()` in `src/`** - seeded `mulberry32` only.
- **Sequence terms are `bigint`**; `SequenceView` is the sole float64 boundary.
- **No `Math.min(...array)` spreads** over sequence-length data - use `minMax`.
- **Exports leave the site, so they must carry attribution.** Every PNG has the OEIS credit drawn into the image; every CSV/JSON has it in a header. Text: `Sequence data from The On-Line Encyclopedia of Integer Sequences (OEIS), © OEIS Foundation Inc., CC BY-SA 4.0 - https://oeis.org/<A-number>`.
- **Accessibility is not optional in new markup** - every control labelled, every click target a real button, no positive tabindex. `tests/ui/a11y.test.ts` enforces this and must keep passing.
- **Any verdict claim must be computed, not asserted**, and reproduced by a test - same rule as the gallery.
- Run `npm test` and `npm run build` before every commit. The existing 309 tests must stay green.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/viz/style.ts` | `RenderStyle`, its param encoding/decoding, `applyStyle`, `strokeColorAt`. |
| `src/viz/sweptArea.ts` | Analytic stroked-area of a path under a given line shape. Pure geometry. |
| `src/ui/styleControls.ts` | The style control group in the topbar. |
| `src/ui/exportData.ts` | `sequenceRows`, `toCSV`, `toJSON`, `downloadBlob`. |
| `src/ui/exportImage.ts` | PNG capture with attribution baked in. |
| `src/ui/dataTable.ts` | The screen-reader/inspection table. |
| `src/experiments/lineShape.ts` | The line-shape null-model experiment. |
| `tests/viz/style.test.ts`, `tests/viz/sweptArea.test.ts`, `tests/ui/export.test.ts`, `tests/experiments/lineShape.test.ts` | Tests for the above. |

**Modified:**

| File | Change |
| --- | --- |
| `src/viz/turtle.ts` | `strokePath` honours `RenderStyle`. |
| `src/viz/{scatter,differences,ulamSpiral,modGrid,histogram,autocorrelation}.ts` | Honour colour mode / line width where meaningful. |
| `src/ui/comparison.ts` | `'over'` superimpose mode. |
| `src/ui/app.ts` | Style state, export buttons, table toggle, superimpose branch, feedback link. |
| `src/ui/urlState.ts` | `style` in the shared state. |
| `src/style.css` | Style controls, table, export bar. |

---

## Task 1: The RenderStyle layer

**Files:**
- Create: `src/viz/style.ts`
- Test: `tests/viz/style.test.ts`

**Interfaces:**
- Produces:
  - `interface RenderStyle { lineWidth: number; lineJoin: CanvasLineJoin; lineCap: CanvasLineCap; colorMode: ColorMode; hueStart: number; hueEnd: number }`
  - `type ColorMode = 'spectrum' | 'flat' | 'none'`
  - `const DEFAULT_STYLE: RenderStyle`
  - `styleToParams(s: RenderStyle): Params`
  - `styleFromParams(p: Params): RenderStyle`
  - `strokeColorAt(s: RenderStyle, t: number): string` - `t` in [0,1] along the path
  - `applyStyle(ctx: CanvasRenderingContext2D, s: RenderStyle): void`

- [ ] **Step 1: Write the failing test**

Create `tests/viz/style.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STYLE, styleToParams, styleFromParams, strokeColorAt, type RenderStyle,
} from '../../src/viz/style';

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
    expect(styleFromParams({ lineWidth: 'wide', colorMode: 'rainbow' })).toEqual(DEFAULT_STYLE);
  });

  it('clamps line width into a drawable range', () => {
    expect(styleFromParams({ lineWidth: 0 }).lineWidth).toBeGreaterThan(0);
    expect(styleFromParams({ lineWidth: 9999 }).lineWidth).toBeLessThanOrEqual(12);
  });
});

describe('strokeColorAt', () => {
  const s = { ...DEFAULT_STYLE, hueStart: 0, hueEnd: 300, colorMode: 'spectrum' as const };

  it('interpolates hue from start to end across the path', () => {
    expect(strokeColorAt(s, 0)).toContain('hsl(0');
    expect(strokeColorAt(s, 1)).toContain('hsl(300');
  });

  it('respects a reversed range', () => {
    const rev = { ...s, hueStart: 300, hueEnd: 0 };
    expect(strokeColorAt(rev, 0)).toContain('hsl(300');
    expect(strokeColorAt(rev, 1)).toContain('hsl(0');
  });

  it('flat mode ignores position and uses hueStart throughout', () => {
    const flat = { ...s, colorMode: 'flat' as const };
    expect(strokeColorAt(flat, 0)).toBe(strokeColorAt(flat, 1));
  });

  it('"none" mode is a single neutral colour, not a hue', () => {
    const none = { ...s, colorMode: 'none' as const };
    expect(strokeColorAt(none, 0)).toBe(strokeColorAt(none, 0.7));
    expect(strokeColorAt(none, 0)).not.toContain('hsl');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/style.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/viz/style.ts`**

```ts
import type { Params, ParamValue } from './types';

export type ColorMode = 'spectrum' | 'flat' | 'none';

export interface RenderStyle {
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  colorMode: ColorMode;
  /** Hue in degrees at the start of the path. */
  hueStart: number;
  /** Hue in degrees at the end of the path. */
  hueEnd: number;
}

export const DEFAULT_STYLE: RenderStyle = {
  lineWidth: 1.25,
  lineJoin: 'miter',
  lineCap: 'butt',
  colorMode: 'spectrum',
  hueStart: 0,
  hueEnd: 300,
};

const JOINS: CanvasLineJoin[] = ['miter', 'round', 'bevel'];
const CAPS: CanvasLineCap[] = ['butt', 'round', 'square'];
const MODES: ColorMode[] = ['spectrum', 'flat', 'none'];

const MAX_WIDTH = 12;
const NEUTRAL = '#9aa0aa';

// Style rides in `params` under reserved keys rather than as a new render()
// argument. That is the pattern this codebase already uses for
// logScaleOverride and histogramDomainLo/Hi, it needs no signature change
// across nine visualizers and their tests, and visualizers that do not care
// simply never read the keys.
export function styleToParams(s: RenderStyle): Params {
  return {
    styleLineWidth: s.lineWidth,
    styleLineJoin: s.lineJoin,
    styleLineCap: s.lineCap,
    styleColorMode: s.colorMode,
    styleHueStart: s.hueStart,
    styleHueEnd: s.hueEnd,
  };
}

const num = (v: ParamValue | undefined, fallback: number, lo: number, hi: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

const pick = <T extends string>(v: ParamValue | undefined, allowed: T[], fallback: T): T =>
  typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;

export function styleFromParams(p: Params): RenderStyle {
  return {
    lineWidth: num(p.styleLineWidth, DEFAULT_STYLE.lineWidth, 0.25, MAX_WIDTH),
    lineJoin: pick(p.styleLineJoin, JOINS, DEFAULT_STYLE.lineJoin),
    lineCap: pick(p.styleLineCap, CAPS, DEFAULT_STYLE.lineCap),
    colorMode: pick(p.styleColorMode, MODES, DEFAULT_STYLE.colorMode),
    hueStart: num(p.styleHueStart, DEFAULT_STYLE.hueStart, 0, 360),
    hueEnd: num(p.styleHueEnd, DEFAULT_STYLE.hueEnd, 0, 360),
  };
}

/**
 * Colour at position `t` (0..1) along whatever is being drawn.
 *
 * 'none' deliberately returns a neutral grey rather than a hue: the point of
 * that mode is to remove colour as a variable entirely, so that any structure
 * still visible cannot be an artifact of the palette.
 */
export function strokeColorAt(s: RenderStyle, t: number): string {
  if (s.colorMode === 'none') return NEUTRAL;
  if (s.colorMode === 'flat') return `hsl(${s.hueStart}, 70%, 60%)`;
  const clamped = Math.min(1, Math.max(0, t));
  return `hsl(${s.hueStart + (s.hueEnd - s.hueStart) * clamped}, 70%, 60%)`;
}

export function applyStyle(ctx: CanvasRenderingContext2D, s: RenderStyle): void {
  ctx.lineWidth = s.lineWidth;
  ctx.lineJoin = s.lineJoin;
  ctx.lineCap = s.lineCap;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/viz/style.test.ts && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/viz/style.ts tests/viz/style.test.ts
git commit -m "feat: RenderStyle layer carried through params like logScaleOverride"
```

---

## Task 2: Visualizers honour the style

**Files:**
- Modify: `src/viz/turtle.ts` (`strokePath`)
- Modify: `src/viz/scatter.ts`, `src/viz/differences.ts`, `src/viz/ulamSpiral.ts`, `src/viz/modGrid.ts`, `src/viz/histogram.ts`, `src/viz/autocorrelation.ts`
- Test: `tests/viz/style.test.ts`

**Interfaces:**
- Consumes: `styleFromParams`, `strokeColorAt`, `applyStyle` (Task 1).
- Produces: `strokePath(pts, ctx, size, style?)` - third-party callers unchanged, style optional.

- [ ] **Step 1: Write the failing test**

Append to `tests/viz/style.test.ts`:

```ts
import { fakeCtx } from '../helpers/fakeCtx';
import { turtleViz } from '../../src/viz/turtle';
import { ulamViz } from '../../src/viz/ulamSpiral';
import { scatterViz } from '../../src/viz/scatter';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { styleToParams } from '../../src/viz/style';

const mk = (n: number) =>
  new SequenceView({
    terms: Array.from({ length: n }, (_, i) => BigInt(i % 7)),
    name: 't', offset: 0, source: 'paste',
  } as Sequence);

describe('visualizers honour RenderStyle', () => {
  it('turtle applies the requested line width, join and cap', () => {
    const { ctx, callLog } = fakeCtx();
    const sets: Record<string, unknown> = {};
    const spy = new Proxy(ctx, {
      set(_t, prop, value) { sets[String(prop)] = value; return true; },
      get(t, prop) { return (t as never)[prop]; },
    });
    turtleViz.render(mk(50), {
      ...defaultParams(turtleViz.params),
      ...styleToParams({
        lineWidth: 4, lineJoin: 'round', lineCap: 'square',
        colorMode: 'flat', hueStart: 200, hueEnd: 200,
      }),
    }, spy, { width: 300, height: 300 });
    expect(sets.lineWidth).toBe(4);
    expect(sets.lineJoin).toBe('round');
    expect(sets.lineCap).toBe('square');
    expect(callLog.length).toBeGreaterThan(0);
  });

  it('colour mode "none" produces no hsl colours anywhere', () => {
    for (const viz of [turtleViz, ulamViz, scatterViz]) {
      const sets: string[] = [];
      const { ctx } = fakeCtx();
      const spy = new Proxy(ctx, {
        set(_t, prop, value) {
          if (prop === 'fillStyle' || prop === 'strokeStyle') sets.push(String(value));
          return true;
        },
        get(t, prop) { return (t as never)[prop]; },
      });
      viz.render(mk(60), {
        ...defaultParams(viz.params),
        ...styleToParams({
          lineWidth: 1, lineJoin: 'miter', lineCap: 'butt',
          colorMode: 'none', hueStart: 0, hueEnd: 300,
        }),
      }, spy, { width: 300, height: 300 });
      expect(sets.some((c) => c.includes('hsl')), `${viz.id} still emits hsl in "none" mode`).toBe(false);
    }
  });

  it('defaults reproduce the previous appearance', () => {
    const sets: Record<string, unknown> = {};
    const { ctx } = fakeCtx();
    const spy = new Proxy(ctx, {
      set(_t, prop, value) { sets[String(prop)] = value; return true; },
      get(t, prop) { return (t as never)[prop]; },
    });
    turtleViz.render(mk(20), defaultParams(turtleViz.params), spy, { width: 300, height: 300 });
    expect(sets.lineWidth).toBe(1.25); // the hard-coded value strokePath used
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/style.test.ts -t "honour RenderStyle"`
Expected: FAIL - line width is always 1.25 and colours are always hsl.

- [ ] **Step 3: Update `strokePath`**

In `src/viz/turtle.ts`, replace `strokePath` with:

```ts
export function strokePath(
  pts: Array<{ x: number; y: number }>,
  ctx: CanvasRenderingContext2D,
  size: Size,
  style: RenderStyle = DEFAULT_STYLE,
): void {
  // The bounding-box maths (and its loop-based min/max, which exists because
  // a 2001-term b-file's digit walk produces 418,487 points - past V8's ~250k
  // spread-argument limit) lives in pathTransform, so locate() can invert
  // exactly the numbers this draws with.
  const t = pathTransform(pts, size);
  applyStyle(ctx, style);
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = strokeColorAt(style, i / Math.max(1, pts.length - 1));
    const a = toScreen(t, pts[i - 1]!), b = toScreen(t, pts[i]!);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
```

Add the import:

```ts
import { applyStyle, strokeColorAt, DEFAULT_STYLE, type RenderStyle } from './style';
```

Then in each of `turtle.ts`, `polyarc.ts`, `digitWalk.ts`, pass the style through from `render`:

```ts
    strokePath(turtlePath(seq, Number(params.angle), Number(params.k)), ctx, size, styleFromParams(params));
```

(polyarc: `strokePath(polyarcPath(seq, {...}), ctx, size, styleFromParams(params));`
digitWalk: `strokePath(digitWalkPath(seq, Number(params.base)), ctx, size, styleFromParams(params));`)

each importing `styleFromParams` from `./style`.

- [ ] **Step 4: Grid and chart visualizers honour colour mode**

`src/viz/ulamSpiral.ts` - replace `cellColor`:

```ts
function cellColor(
  seq: SequenceView, i: number, colorBy: string, modulus: number, maxLog: number, style: RenderStyle,
): string {
  // 'none' removes colour as a variable entirely, so any structure still
  // visible cannot be an artifact of the palette - which is the whole reason
  // the mode exists.
  if (style.colorMode === 'none') return seq.mod(i, 2) === 0 ? '#3a3d44' : '#9aa0aa';
  if (colorBy === 'parity') return seq.mod(i, 2) === 0 ? '#1d2026' : '#7aa2f7';
  if (colorBy === 'magnitude') {
    const l = maxLog > 0 ? (seq.logMagnitude(i) / maxLog) * 60 + 15 : 40;
    return `hsl(220, 60%, ${l}%)`;
  }
  return strokeColorAt(style, seq.mod(i, modulus) / modulus);
}
```

and pass `styleFromParams(params)` into it from `render`.

`src/viz/modGrid.ts` - replace the fill line in `render`:

```ts
      const r = seq.mod(i, m);
      ctx.fillStyle = style.colorMode === 'none'
        ? (r % 2 === 0 ? '#3a3d44' : '#9aa0aa')
        : strokeColorAt(style, r / m);
```

with `const style = styleFromParams(params);` above the loop.

`src/viz/scatter.ts` - before the dot loop:

```ts
    const style = styleFromParams(params);
    ctx.fillStyle = strokeColorAt(style, 0.5);
```

replacing `ctx.fillStyle = '#7aa2f7';`.

`src/viz/differences.ts` - replace `ctx.strokeStyle = '#7aa2f7'; ctx.lineWidth = 1.5;` with:

```ts
    const style = styleFromParams(params);
    ctx.strokeStyle = strokeColorAt(style, 0.5);
    ctx.lineWidth = style.lineWidth;
```

`src/viz/histogram.ts` - replace `ctx.fillStyle = '#7aa2f7';` with:

```ts
    ctx.fillStyle = strokeColorAt(styleFromParams(params), 0.5);
```

`src/viz/autocorrelation.ts` - replace `ctx.strokeStyle = '#7aa2f7'; ctx.lineWidth = 1.5;` with:

```ts
    const style = styleFromParams(params);
    ctx.strokeStyle = strokeColorAt(style, 0.5);
    ctx.lineWidth = style.lineWidth;
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/viz tests/viz/style.test.ts
git commit -m "feat: every visualizer honours line width, shape and colour mode"
```

---

## Task 3: Style controls in the topbar

**Files:**
- Create: `src/ui/styleControls.ts`
- Modify: `src/ui/app.ts`, `src/ui/urlState.ts`, `src/style.css`
- Test: `tests/ui/export.test.ts` (create)

**Interfaces:**
- Consumes: `RenderStyle`, `DEFAULT_STYLE`, `styleToParams` (Task 1).
- Produces: `buildStyleControls(style: RenderStyle, onChange: () => void): { el: HTMLElement; refresh(): void }`; `UrlState.style?: RenderStyle`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/export.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildStyleControls } from '../../src/ui/styleControls';
import { DEFAULT_STYLE, type RenderStyle } from '../../src/viz/style';

describe('style controls', () => {
  it('exposes a labelled control for every style property', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const { el } = buildStyleControls(style, () => {});
    document.body.appendChild(el);
    const controls = el.querySelectorAll<HTMLElement>('input, select');
    expect(controls.length).toBeGreaterThanOrEqual(5);
    for (const c of controls) {
      const labelled = c.getAttribute('aria-label')
        || (c.id && el.querySelector(`label[for="${c.id}"]`))
        || c.closest('label');
      expect(labelled, `${c.className} unlabelled`).toBeTruthy();
    }
  });

  it('mutates the style object and notifies on change', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const onChange = vi.fn();
    const { el } = buildStyleControls(style, onChange);
    const join = el.querySelector<HTMLSelectElement>('.style-join')!;
    join.value = 'round';
    join.dispatchEvent(new Event('change'));
    expect(style.lineJoin).toBe('round');
    expect(onChange).toHaveBeenCalled();
  });

  it('offers "none" as a colour mode', () => {
    const { el } = buildStyleControls({ ...DEFAULT_STYLE }, () => {});
    const mode = el.querySelector<HTMLSelectElement>('.style-colormode')!;
    expect([...mode.options].map((o) => o.value)).toContain('none');
  });

  it('refresh() pushes external mutations back onto the controls', () => {
    const style: RenderStyle = { ...DEFAULT_STYLE };
    const { el, refresh } = buildStyleControls(style, () => {});
    style.lineWidth = 7;
    refresh();
    expect(el.querySelector<HTMLInputElement>('.style-width')!.value).toBe('7');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/export.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/styleControls.ts`**

```ts
import { type RenderStyle, type ColorMode } from '../viz/style';
import { labelledControl } from './a11y';

export function buildStyleControls(
  style: RenderStyle,
  onChange: () => void,
): { el: HTMLElement; refresh(): void } {
  const el = document.createElement('div');
  el.className = 'style-controls';

  const width = document.createElement('input');
  width.type = 'range';
  width.className = 'style-width';
  width.min = '0.5'; width.max = '12'; width.step = '0.25';

  const join = document.createElement('select');
  join.className = 'style-join';
  for (const v of ['miter', 'round', 'bevel']) {
    const o = document.createElement('option'); o.value = o.textContent = v; join.appendChild(o);
  }

  const cap = document.createElement('select');
  cap.className = 'style-cap';
  for (const v of ['butt', 'round', 'square']) {
    const o = document.createElement('option'); o.value = o.textContent = v; cap.appendChild(o);
  }

  const mode = document.createElement('select');
  mode.className = 'style-colormode';
  for (const v of ['spectrum', 'flat', 'none']) {
    const o = document.createElement('option'); o.value = o.textContent = v; mode.appendChild(o);
  }

  const hueStart = document.createElement('input');
  hueStart.type = 'range';
  hueStart.className = 'style-hue-start';
  hueStart.min = '0'; hueStart.max = '360'; hueStart.step = '1';

  const hueEnd = document.createElement('input');
  hueEnd.type = 'range';
  hueEnd.className = 'style-hue-end';
  hueEnd.min = '0'; hueEnd.max = '360'; hueEnd.step = '1';

  function refresh(): void {
    width.value = String(style.lineWidth);
    join.value = style.lineJoin;
    cap.value = style.lineCap;
    mode.value = style.colorMode;
    hueStart.value = String(style.hueStart);
    hueEnd.value = String(style.hueEnd);
    // The hue sliders do nothing in 'none' mode, and a live-looking control
    // that cannot affect anything reads as broken - the same defect fixed on
    // the null-model select in round 1.
    const hueDead = style.colorMode === 'none';
    hueStart.disabled = hueDead;
    hueEnd.disabled = hueDead || style.colorMode === 'flat';
  }

  width.addEventListener('input', () => { style.lineWidth = Number(width.value); onChange(); });
  join.addEventListener('change', () => { style.lineJoin = join.value as CanvasLineJoin; onChange(); });
  cap.addEventListener('change', () => { style.lineCap = cap.value as CanvasLineCap; onChange(); });
  mode.addEventListener('change', () => {
    style.colorMode = mode.value as ColorMode;
    refresh();
    onChange();
  });
  hueStart.addEventListener('input', () => { style.hueStart = Number(hueStart.value); onChange(); });
  hueEnd.addEventListener('input', () => { style.hueEnd = Number(hueEnd.value); onChange(); });

  el.append(
    labelledControl('Line width', width, { visible: true }),
    labelledControl('Line shape', join, { visible: true }),
    labelledControl('Line ends', cap, { visible: true }),
    labelledControl('Colour', mode, { visible: true }),
    labelledControl('Hue from', hueStart, { visible: true }),
    labelledControl('Hue to', hueEnd, { visible: true }),
  );
  refresh();
  return { el, refresh };
}
```

- [ ] **Step 4: Wire into `app.ts`**

Add near the other state:

```ts
  const style: RenderStyle = { ...DEFAULT_STYLE };
```

After `rebuildParams();`, add:

```ts
  const styleUi = buildStyleControls(style, redraw);
  topbar.appendChild(styleUi.el);
```

In `drawScene`, where `state.params` is passed to `viz.render`, merge the style. Change the `draw` helper's render call to:

```ts
        viz.render(new SequenceView(seq!), { ...state.params, ...styleToParams(style) }, ctx, { width: w, height: h });
```

and the ensemble `paramsWithScale` construction to start from the merged object:

```ts
      const paramsWithScale: Params = {
        ...state.params, ...styleToParams(style),
        logScaleOverride: shouldUseLogScale(view),
      };
```

Include style in `syncUrl`'s `encodeState({...})` call as `style`, and in `applyHash` restore it:

```ts
      if (decoded.style) {
        Object.assign(style, styleFromParams(styleToParams(decoded.style)));
        styleUi.refresh();
      }
```

(The round-trip through params is deliberate: it re-validates and clamps a style that arrived from an untrusted URL.)

In `src/ui/urlState.ts`, add to `UrlState`:

```ts
  /** Absent on links encoded before this field existed. */
  style?: RenderStyle;
```

with `import type { RenderStyle } from '../viz/style';`.

- [ ] **Step 5: Style the controls**

Append to `src/style.css`:

```css
.style-controls { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--muted); }
.style-controls select { background: #24262c; color: var(--text); border: 1px solid #3a3d44; border-radius: 4px; padding: 3px; font: inherit; }
.style-controls input[type="range"] { width: 80px; }
.style-controls input:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/styleControls.ts src/ui/app.ts src/ui/urlState.ts src/style.css tests/ui/export.test.ts
git commit -m "feat: style controls for line width, shape, ends and colour"
```

---

## Task 4: Superimpose comparison mode

**Files:**
- Modify: `src/ui/comparison.ts`, `src/ui/app.ts`
- Test: `tests/ui/comparison.test.ts`

**Interfaces:**
- Consumes: `ComparisonMode`.
- Produces: `ComparisonMode` gains `'over'`; `supportsSuperimpose(viz: Visualizer): boolean`.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/comparison.test.ts`:

```ts
import { supportsSuperimpose } from '../../src/ui/comparison';
import { turtleViz } from '../../src/viz/turtle';
import { ulamViz } from '../../src/viz/ulamSpiral';
import { scatterViz } from '../../src/viz/scatter';
import { modGridViz } from '../../src/viz/modGrid';

describe('superimpose availability', () => {
  it('is offered for trajectory and basic views', () => {
    expect(supportsSuperimpose(turtleViz)).toBe(true);
    expect(supportsSuperimpose(scatterViz)).toBe(true);
  });

  it('is refused for grid views, where cells would simply overwrite', () => {
    // A grid places cell i at a position fixed by i, so drawing the null on
    // top replaces the real colours rather than overlaying anything.
    expect(supportsSuperimpose(ulamViz)).toBe(false);
    expect(supportsSuperimpose(modGridViz)).toBe(false);
  });

  it('offers "over" in the mode dropdown', () => {
    const bar = buildComparisonBar(defaultComparison(), () => {});
    const modes = [...bar.el.querySelectorAll<HTMLOptionElement>('.mode-select option')].map((o) => o.value);
    expect(modes).toContain('over');
  });

  it('disables "over" and falls back when the visualizer cannot support it', () => {
    const state = defaultComparison();
    state.mode = 'over';
    const bar = buildComparisonBar(state, () => {});
    bar.update(true, false); // hasStats, supportsOver
    const opt = bar.el.querySelector<HTMLOptionElement>('.mode-select option[value="over"]')!;
    expect(opt.disabled).toBe(true);
    expect(state.mode).toBe('off');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/comparison.test.ts -t superimpose`
Expected: FAIL - `supportsSuperimpose` not exported.

- [ ] **Step 3: Implement in `src/ui/comparison.ts`**

Change the mode type and add the predicate:

```ts
export type ComparisonMode = 'off' | 'side' | 'over' | 'flip' | 'ensemble';

/**
 * Superimposing only means something where position carries information.
 * Grid and spiral layouts place term i at a position fixed by i alone, so
 * drawing the null on top overwrites the real cells rather than overlaying
 * them - it would look like a comparison while showing only the surrogate.
 */
export function supportsSuperimpose(viz: Visualizer): boolean {
  return viz.family === 'trajectory' || viz.family === 'basic';
}
```

with `import type { Visualizer } from '../viz/types';`.

In `mkSelect`, the mode list becomes `['off', 'side', 'over', 'flip', 'ensemble']`.

Extend `update` to take the second flag:

```ts
    update(vizHasStats: boolean, vizSupportsOver: boolean) {
      const ensembleOpt = modeSel.querySelector<HTMLOptionElement>('option[value="ensemble"]')!;
      ensembleOpt.disabled = !vizHasStats;
      const overOpt = modeSel.querySelector<HTMLOptionElement>('option[value="over"]')!;
      overOpt.disabled = !vizSupportsOver;
      if ((!vizHasStats && state.mode === 'ensemble') || (!vizSupportsOver && state.mode === 'over')) {
        state.mode = 'off';
        modeSel.value = 'off';
        syncMode();
      }
    },
```

- [ ] **Step 4: Render the superimposed view in `app.ts`**

Update the three `bar.update(...)` call sites to pass both flags:

```ts
    bar.update(Boolean(getVisualizer(state.vizId).statistics), supportsSuperimpose(getVisualizer(state.vizId)));
```

Add a branch in `drawScene` before the `flip` branch:

```ts
    } else if (comparison.mode === 'over') {
      const surr = surrogateSequence(state.seq, comparison.surrogate, comparison.seed);
      // Null underneath in flat grey, real on top in full colour: the eye
      // should read the real sequence as the figure and the null as ground.
      const nullStyle = { ...style, colorMode: 'none' as const };
      ctx.save();
      ctx.globalAlpha = 0.55;
      viz.render(new SequenceView(surr), { ...state.params, ...styleToParams(nullStyle) }, ctx, { width, height });
      ctx.restore();
      viz.render(view, { ...state.params, ...styleToParams(style) }, ctx, { width, height });
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '12px system-ui';
      ctx.fillText(`real (colour) over ${comparison.surrogate} null (grey)`, 10, height - 10);
      if (pinnedIndex !== null && viz.position) {
        const p = viz.position(view, state.params, { width, height }, pinnedIndex);
        if (p) drawMarker(ctx, p, '#f7768e');
      }
```

Add `'over'` to the `MODES` array at the top of `app.ts`.

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/comparison.ts src/ui/app.ts tests/ui/comparison.test.ts
git commit -m "feat: superimpose mode drawing the real sequence over its null"
```

---

## Task 5: Data extraction, CSV/JSON export, and the data table

**Files:**
- Create: `src/ui/exportData.ts`, `src/ui/dataTable.ts`
- Test: `tests/ui/export.test.ts`

**Interfaces:**
- Produces:
  - `interface DataRow { n: number; term: string; [key: string]: string | number }`
  - `sequenceRows(seq: Sequence, limit?: number): DataRow[]`
  - `attributionLine(seq: Sequence): string`
  - `toCSV(seq: Sequence, rows: DataRow[]): string`
  - `toJSON(seq: Sequence, rows: DataRow[]): string`
  - `downloadBlob(name: string, mime: string, text: string): void`
  - `buildDataTable(): { el: HTMLElement; setSequence(seq: Sequence | null): void; toggle(): void; isOpen(): boolean }`

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/export.test.ts`:

```ts
import { sequenceRows, toCSV, toJSON, attributionLine } from '../../src/ui/exportData';
import { buildDataTable } from '../../src/ui/dataTable';
import type { Sequence } from '../../src/sequence/sequence';

const fib: Sequence = {
  terms: [0n, 1n, 1n, 2n, 3n, 5n, 8n], aNumber: 'A000045',
  name: 'Fibonacci numbers', offset: 0, source: 'oeis',
};
const huge: Sequence = { terms: [10n ** 40n], name: 'big', offset: 0, source: 'paste' };

describe('sequenceRows', () => {
  it('emits one row per term with the index and exact value', () => {
    const rows = sequenceRows(fib);
    expect(rows).toHaveLength(7);
    expect(rows[5]).toMatchObject({ n: 5, term: '5' });
  });

  it('keeps full BigInt precision', () => {
    expect(sequenceRows(huge)[0]!.term).toBe('1'.padEnd(41, '0'));
  });

  it('honours a row limit', () => {
    expect(sequenceRows(fib, 3)).toHaveLength(3);
  });
});

describe('export formats carry attribution', () => {
  it('CSV leads with a commented attribution line naming the A-number', () => {
    const csv = toCSV(fib, sequenceRows(fib));
    expect(csv.split('\n')[0]).toMatch(/^#/);
    expect(csv).toContain('A000045');
    expect(csv).toContain('CC BY-SA 4.0');
    expect(csv).toContain('oeis.org');
  });

  it('CSV has a header row and one line per term', () => {
    const lines = toCSV(fib, sequenceRows(fib)).trim().split('\n');
    expect(lines[1]).toBe('n,term');
    expect(lines).toHaveLength(2 + 7);
  });

  it('JSON carries attribution as a field, not a comment', () => {
    const parsed = JSON.parse(toJSON(fib, sequenceRows(fib)));
    expect(parsed.attribution).toContain('CC BY-SA 4.0');
    expect(parsed.aNumber).toBe('A000045');
    expect(parsed.rows).toHaveLength(7);
    expect(parsed.rows[6].term).toBe('8');
  });

  it('a non-OEIS sequence gets attribution without a bogus A-number link', () => {
    const line = attributionLine(huge);
    expect(line).not.toContain('oeis.org/undefined');
  });

  it('quotes any field containing a comma', () => {
    const odd: Sequence = { ...fib, name: 'Weird, comma name' };
    expect(toCSV(odd, sequenceRows(odd))).not.toMatch(/^#[^"]*Weird, comma/m);
  });
});

describe('data table', () => {
  it('renders a real table with a caption and header cells', () => {
    const t = buildDataTable();
    t.setSequence(fib);
    document.body.appendChild(t.el);
    expect(t.el.querySelector('table')).not.toBeNull();
    expect(t.el.querySelector('caption')).not.toBeNull();
    expect(t.el.querySelectorAll('th').length).toBeGreaterThanOrEqual(2);
    expect(t.el.querySelectorAll('tbody tr')).toHaveLength(7);
  });

  it('starts closed and toggles', () => {
    const t = buildDataTable();
    expect(t.isOpen()).toBe(false);
    t.toggle();
    expect(t.isOpen()).toBe(true);
  });

  it('caps the rows it renders and says so', () => {
    const long: Sequence = {
      terms: Array.from({ length: 5000 }, (_, i) => BigInt(i)),
      name: 'long', offset: 0, source: 'paste',
    };
    const t = buildDataTable();
    t.setSequence(long);
    expect(t.el.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(500);
    expect(t.el.querySelector('caption')!.textContent).toMatch(/first 500|5000/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/export.test.ts -t attribution`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/exportData.ts`**

```ts
import type { Sequence } from '../sequence/sequence';

export interface DataRow { n: number; term: string; [key: string]: string | number; }

/** Terms as exact decimal strings - never toNumber, which clamps past 2^53. */
export function sequenceRows(seq: Sequence, limit?: number): DataRow[] {
  const n = limit === undefined ? seq.terms.length : Math.min(limit, seq.terms.length);
  const rows: DataRow[] = [];
  for (let i = 0; i < n; i++) rows.push({ n: i + seq.offset, term: seq.terms[i]!.toString() });
  return rows;
}

/**
 * Exports leave the site, so they carry the OEIS credit with them rather than
 * relying on the page footer the user is no longer looking at.
 */
export function attributionLine(seq: Sequence): string {
  const base = 'Sequence data from The On-Line Encyclopedia of Integer Sequences (OEIS), '
    + '© OEIS Foundation Inc., CC BY-SA 4.0';
  return seq.aNumber ? `${base} - https://oeis.org/${seq.aNumber}` : `${base} - https://oeis.org/`;
}

const csvField = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(seq: Sequence, rows: DataRow[]): string {
  const keys = Object.keys(rows[0] ?? { n: 0, term: '' });
  const head = `# ${attributionLine(seq)}`.replace(/\n/g, ' ');
  return [
    head,
    keys.join(','),
    ...rows.map((r) => keys.map((k) => csvField(r[k]!)).join(',')),
  ].join('\n') + '\n';
}

export function toJSON(seq: Sequence, rows: DataRow[]): string {
  return JSON.stringify({
    attribution: attributionLine(seq),
    aNumber: seq.aNumber ?? null,
    name: seq.name,
    offset: seq.offset,
    source: seq.source,
    count: rows.length,
    rows,
  }, null, 2);
}

export function downloadBlob(name: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 4: Implement `src/ui/dataTable.ts`**

```ts
import type { Sequence } from '../sequence/sequence';
import { sequenceRows } from './exportData';

const MAX_ROWS = 500;

/**
 * The textual equivalent of the canvas.
 *
 * A rendering conveys its information visually and the cursor readout only
 * describes one point at a time, so without this there is no way to read the
 * actual numbers behind a picture. Shares sequenceRows with the CSV/JSON
 * export - a table and a download are the same data in different shapes.
 */
export function buildDataTable(): {
  el: HTMLElement; setSequence(seq: Sequence | null): void; toggle(): void; isOpen(): boolean;
} {
  const el = document.createElement('div');
  el.className = 'data-table';
  el.hidden = true;

  const table = document.createElement('table');
  const caption = document.createElement('caption');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const headRow = document.createElement('tr');
  for (const label of ['n', 'a(n)']) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.append(caption, thead, tbody);
  el.appendChild(table);

  return {
    el,
    setSequence(seq) {
      tbody.replaceChildren();
      if (!seq) { caption.textContent = 'No sequence loaded.'; return; }
      const total = seq.terms.length;
      const rows = sequenceRows(seq, MAX_ROWS);
      caption.textContent = total > MAX_ROWS
        ? `${seq.name} - first ${MAX_ROWS} of ${total} terms`
        : `${seq.name} - ${total} terms`;
      for (const r of rows) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = String(r.n);
        const td = document.createElement('td');
        td.textContent = r.term;
        tr.append(th, td);
        tbody.appendChild(tr);
      }
    },
    toggle() { el.hidden = !el.hidden; },
    isOpen: () => !el.hidden,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/ui/export.test.ts && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/exportData.ts src/ui/dataTable.ts tests/ui/export.test.ts
git commit -m "feat: data rows, CSV/JSON export with attribution, and a data table"
```

---

## Task 6: PNG export with baked attribution

**Files:**
- Create: `src/ui/exportImage.ts`
- Test: `tests/ui/export.test.ts`

**Interfaces:**
- Consumes: `attributionLine` (Task 5).
- Produces: `drawAttribution(ctx, text, width, height): void`; `exportCanvasPng(canvas, seq, filename): void`

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/export.test.ts`:

```ts
import { drawAttribution } from '../../src/ui/exportImage';
import { fakeCtx } from '../helpers/fakeCtx';

describe('PNG attribution', () => {
  it('draws the credit into the image itself', () => {
    const { ctx, callLog } = fakeCtx();
    drawAttribution(ctx, 'Sequence data from OEIS, CC BY-SA 4.0', 800, 600);
    const texts = callLog.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
    expect(texts.join(' ')).toContain('CC BY-SA 4.0');
  });

  it('paints a backing band so the text stays legible over any render', () => {
    const { ctx, callLog } = fakeCtx();
    drawAttribution(ctx, 'credit', 800, 600);
    expect(callLog.some((c) => c.name === 'fillRect')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/export.test.ts -t "PNG attribution"`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/exportImage.ts`**

```ts
import type { Sequence } from '../sequence/sequence';
import { attributionLine } from './exportData';

const BAND = 34;

/**
 * Draws the OEIS credit into the bitmap.
 *
 * An exported PNG travels without the page footer, so the attribution has to
 * survive inside the image or it does not survive at all.
 */
export function drawAttribution(
  ctx: CanvasRenderingContext2D, text: string, width: number, height: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(20,22,26,0.88)';
  ctx.fillRect(0, height - BAND, width, BAND);
  ctx.fillStyle = '#9aa0aa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, height - BAND / 2);
  ctx.restore();
}

/** Copies the live canvas, stamps attribution, and downloads it. */
export function exportCanvasPng(canvas: HTMLCanvasElement, seq: Sequence, filename: string): void {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(canvas, 0, 0);
  // The source canvas is scaled by devicePixelRatio; match it so the credit
  // is the same visual size as it is on screen rather than hairline on HiDPI.
  const dpr = canvas.width / Math.max(1, parseFloat(canvas.style.width || String(canvas.width)));
  ctx.scale(dpr, dpr);
  drawAttribution(ctx, attributionLine(seq), out.width / dpr, out.height / dpr);
  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/export.test.ts && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/exportImage.ts tests/ui/export.test.ts
git commit -m "feat: PNG export with the OEIS credit baked into the bitmap"
```

---

## Task 7: Export bar, table toggle, and feedback link in the app

**Files:**
- Modify: `src/ui/app.ts`, `src/style.css`
- Test: `tests/ui/a11y.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5 and 6.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/a11y.test.ts`:

```ts
describe('export bar', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('offers PNG, CSV, JSON and a table toggle, all as labelled buttons', () => {
    const root = mountEngine();
    for (const cls of ['.export-png', '.export-csv', '.export-json', '.table-toggle']) {
      const btn = root.querySelector<HTMLButtonElement>(cls);
      expect(btn, `${cls} missing`).not.toBeNull();
      expect(btn!.tagName).toBe('BUTTON');
      expect((btn!.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('links feedback to the public issue tracker', () => {
    const root = mountEngine();
    const link = root.querySelector<HTMLAnchorElement>('.feedback-link')!;
    expect(link).not.toBeNull();
    expect(link.href).toContain('github.com/bshepp/integer-sequence-visualizer/issues');
    expect(link.rel).toContain('noopener');
  });

  it('the table toggle reports its expanded state', () => {
    const root = mountEngine();
    const toggle = root.querySelector<HTMLButtonElement>('.table-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/a11y.test.ts -t "export bar"`
Expected: FAIL - no `.export-png`.

- [ ] **Step 3: Implement in `app.ts`**

After the comparison bar is inserted, add:

```ts
  const exportBar = document.createElement('div');
  exportBar.className = 'export-bar';

  const mkExport = (cls: string, label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    exportBar.appendChild(b);
    return b;
  };

  const slug = () => (state.seq?.aNumber ?? state.seq?.name ?? 'sequence').replace(/[^\w.-]+/g, '-');

  mkExport('export-png', 'PNG', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    exportCanvasPng(canvas, state.seq, `${slug()}-${state.vizId}.png`);
  });
  mkExport('export-csv', 'CSV', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    downloadBlob(`${slug()}.csv`, 'text/csv;charset=utf-8', toCSV(state.seq, sequenceRows(state.seq)));
  });
  mkExport('export-json', 'JSON', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    downloadBlob(`${slug()}.json`, 'application/json', toJSON(state.seq, sequenceRows(state.seq)));
  });

  const dataTable = buildDataTable();
  const tableToggle = mkExport('table-toggle', 'Show the numbers', () => {
    dataTable.toggle();
    tableToggle.setAttribute('aria-expanded', String(dataTable.isOpen()));
    tableToggle.textContent = dataTable.isOpen() ? 'Hide the numbers' : 'Show the numbers';
  });
  tableToggle.setAttribute('aria-expanded', 'false');
  tableToggle.setAttribute('aria-controls', 'data-table');
  dataTable.el.id = 'data-table';

  const feedback = document.createElement('a');
  feedback.className = 'feedback-link';
  feedback.href = 'https://github.com/bshepp/integer-sequence-visualizer/issues/new';
  feedback.target = '_blank';
  feedback.rel = 'noopener noreferrer';
  feedback.textContent = 'Report a problem';
  exportBar.appendChild(feedback);

  main.appendChild(exportBar);
  main.appendChild(dataTable.el);
```

In `applySeq`, after `panel.setInfo(seq);` add:

```ts
    dataTable.setSequence(seq);
```

Add the imports:

```ts
import { sequenceRows, toCSV, toJSON, downloadBlob } from './exportData';
import { exportCanvasPng } from './exportImage';
import { buildDataTable } from './dataTable';
```

- [ ] **Step 4: Style it**

Append to `src/style.css`:

```css
.export-bar { display: flex; gap: 8px; align-items: center; padding: 8px 14px; background: var(--panel); border-left: 1px solid #000; flex-wrap: wrap; }
.export-bar button { background: #24262c; color: var(--text); border: 1px solid #3a3d44; border-radius: 4px; padding: 4px 10px; cursor: pointer; font: inherit; font-size: 12px; }
.export-bar button:hover { border-color: var(--accent); }
.feedback-link { margin-left: auto; color: var(--muted); font-size: 12px; }
.data-table { max-height: 320px; overflow-y: auto; background: var(--panel); border-left: 1px solid #000; }
.data-table[hidden] { display: none; }
.data-table table { border-collapse: collapse; width: 100%; font: 12px/1.5 ui-monospace, monospace; }
.data-table caption { text-align: left; padding: 8px 14px; color: var(--muted); font: 12px system-ui; }
.data-table th, .data-table td { text-align: left; padding: 2px 14px; border-bottom: 1px solid #24262c; }
.data-table thead th { position: sticky; top: 0; background: var(--panel); color: var(--muted); }
.data-table tbody th { color: var(--muted); font-weight: 400; }
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/app.ts src/style.css tests/ui/a11y.test.ts
git commit -m "feat: export bar, data table toggle, and a feedback link"
```

---

## Task 8: Swept area - the geometry the line-shape experiment measures

**Files:**
- Create: `src/viz/sweptArea.ts`
- Test: `tests/viz/sweptArea.test.ts`

**Interfaces:**
- Produces: `sweptArea(pts: Pt[], width: number, join: CanvasLineJoin, cap: CanvasLineCap): number`

- [ ] **Step 1: Write the failing test**

Create `tests/viz/sweptArea.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sweptArea } from '../../src/viz/sweptArea';

const SQUARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

describe('sweptArea', () => {
  it('a single straight segment is length x width', () => {
    expect(sweptArea([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2, 'miter', 'butt')).toBeCloseTo(20, 6);
  });

  it('scales linearly with stroke width', () => {
    const a = sweptArea(SQUARE, 1, 'miter', 'butt');
    const b = sweptArea(SQUARE, 2, 'miter', 'butt');
    expect(b).toBeGreaterThan(a);
  });

  it('round joins add less area than miter joins at a right angle', () => {
    // A miter spike extends to w/2 x sec(θ/2) from the vertex; a round join
    // fills only the circular sector. At 90° the miter is strictly larger.
    const miter = sweptArea(SQUARE, 4, 'miter', 'butt');
    const round = sweptArea(SQUARE, 4, 'round', 'butt');
    expect(miter).toBeGreaterThan(round);
  });

  it('bevel sits between round and miter at a right angle', () => {
    const w = 4;
    const round = sweptArea(SQUARE, w, 'round', 'butt');
    const bevel = sweptArea(SQUARE, w, 'bevel', 'butt');
    const miter = sweptArea(SQUARE, w, 'miter', 'butt');
    expect(bevel).toBeGreaterThanOrEqual(round - 1e-9);
    expect(bevel).toBeLessThanOrEqual(miter + 1e-9);
  });

  it('square caps add w^2 over butt caps (w^2/2 at each of the two ends)', () => {
    const seg = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const w = 3;
    expect(sweptArea(seg, w, 'miter', 'square') - sweptArea(seg, w, 'miter', 'butt'))
      .toBeCloseTo(w * w, 6);
  });

  it('round caps add a full disc of diameter w over butt caps', () => {
    const seg = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const w = 3;
    expect(sweptArea(seg, w, 'miter', 'round') - sweptArea(seg, w, 'miter', 'butt'))
      .toBeCloseTo(Math.PI * (w / 2) ** 2, 6);
  });

  it('is zero for a degenerate path', () => {
    expect(sweptArea([], 2, 'miter', 'butt')).toBe(0);
    expect(sweptArea([{ x: 1, y: 1 }], 2, 'miter', 'butt')).toBe(0);
  });

  it('ignores zero-length segments rather than producing NaN', () => {
    const withDup = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(Number.isFinite(sweptArea(withDup, 2, 'miter', 'butt'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/sweptArea.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/viz/sweptArea.ts`**

```ts
import type { Pt } from './pathTransform';

/**
 * Area covered by stroking `pts` with the given width, join and cap.
 *
 * Computed analytically rather than by counting pixels, so it is exact,
 * deterministic and runs in CI without a canvas. This is the quantity the
 * line-shape experiment compares: if changing the join changes the swept area
 * by less than the null model moves it, then the shape cannot be responsible
 * for any structure you think you see.
 *
 * Overlap where the stroke crosses itself is not subtracted - the measure is
 * additive swept area, and the comparison is like-for-like across shapes on
 * the same path, so the bias is identical in every arm of the experiment.
 */
export function sweptArea(pts: Pt[], width: number, join: CanvasLineJoin, cap: CanvasLineCap): number {
  if (pts.length < 2 || width <= 0) return 0;
  const w = width, r = w / 2;

  const seg: Array<{ len: number; ux: number; uy: number }> = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x, dy = pts[i]!.y - pts[i - 1]!.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue; // duplicate point: contributes nothing, and would divide by zero
    seg.push({ len, ux: dx / len, uy: dy / len });
  }
  if (seg.length === 0) return 0;

  let area = 0;
  for (const s of seg) area += s.len * w;

  // Joins: the wedge between consecutive segments, outside the rectangles.
  for (let i = 1; i < seg.length; i++) {
    const a = seg[i - 1]!, b = seg[i]!;
    const dot = Math.min(1, Math.max(-1, a.ux * b.ux + a.uy * b.uy));
    const turn = Math.acos(dot); // exterior angle, 0 = straight, π = doubling back
    if (turn === 0) continue;
    if (join === 'round') {
      area += (turn / 2) * r * r;               // circular sector of angle `turn`
    } else if (join === 'bevel') {
      area += r * r * Math.sin(turn / 2) * Math.cos(turn / 2); // triangle between offsets
    } else {
      // miter: the sector plus the spike out to the miter point, r*sec(turn/2)
      const half = turn / 2;
      const cosHalf = Math.cos(half);
      // Canvas falls back to bevel past the miter limit (default 10).
      const miterRatio = cosHalf === 0 ? Infinity : 1 / cosHalf;
      area += miterRatio > 10
        ? r * r * Math.sin(half) * Math.cos(half)
        : r * r * Math.tan(half);
    }
  }

  // Caps at each end of the polyline. A square cap extends the stroke by r
  // beyond the endpoint across the full width w, so each adds r*w = w^2/2 and
  // the pair adds w^2. A round cap is a half-disc of radius r, so the pair
  // adds one whole disc.
  if (cap === 'round') area += Math.PI * r * r;
  else if (cap === 'square') area += 2 * r * w;

  return area;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/viz/sweptArea.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Run: `npx vitest run tests/viz/sweptArea.test.ts && npm run build`
Expected: PASS

```bash
git add src/viz/sweptArea.ts tests/viz/sweptArea.test.ts
git commit -m "feat: analytic swept area of a stroked path, per join and cap"
```

---

## Task 9: The line-shape experiment

Answers the question that prompted the render controls: *would line shape make a difference?* Not by opinion - by putting shape-to-shape variation next to the null model's own variation and seeing which is larger.

**Files:**
- Create: `src/experiments/lineShape.ts`
- Test: `tests/experiments/lineShape.test.ts`

**Interfaces:**
- Consumes: `sweptArea` (Task 8), `turtlePath`, `makeSurrogate`, `pathTransform`.
- Produces:
  - `interface ShapeResult { join: CanvasLineJoin; area: number }`
  - `interface LineShapeVerdict { shapeSpread: number; nullSpread: number; ratio: number; shapeMatters: boolean; shapes: ShapeResult[] }`
  - `runLineShapeExperiment(seq: SequenceView, opts: { width: number; n: number; seed: number; size: Size }): LineShapeVerdict`

- [ ] **Step 1: Write the failing test**

Create `tests/experiments/lineShape.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runLineShapeExperiment } from '../../src/experiments/lineShape';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { kolakoski } from '../../src/gallery/sequences';

const view = new SequenceView({
  terms: kolakoski(400), aNumber: 'A000002', name: 'Kolakoski', offset: 0, source: 'oeis',
} as Sequence);

const OPTS = { width: 4, n: 40, seed: 1, size: { width: 600, height: 600 } };

describe('line-shape experiment', () => {
  it('measures all three joins', () => {
    const v = runLineShapeExperiment(view, OPTS);
    expect(v.shapes.map((s) => s.join).sort()).toEqual(['bevel', 'miter', 'round']);
    for (const s of v.shapes) expect(s.area).toBeGreaterThan(0);
  });

  it('is deterministic under a fixed seed', () => {
    expect(runLineShapeExperiment(view, OPTS)).toEqual(runLineShapeExperiment(view, OPTS));
  });

  it('reports both spreads and their ratio', () => {
    const v = runLineShapeExperiment(view, OPTS);
    expect(v.shapeSpread).toBeGreaterThanOrEqual(0);
    expect(v.nullSpread).toBeGreaterThan(0);
    expect(v.ratio).toBeCloseTo(v.shapeSpread / v.nullSpread, 9);
  });

  it('sets shapeMatters only when shape moves the measure more than the null does', () => {
    const v = runLineShapeExperiment(view, OPTS);
    expect(v.shapeMatters).toBe(v.ratio > 1);
  });

  it('widening the stroke increases how much shape matters', () => {
    // Joins are a fixed-radius effect: their contribution grows as w^2 while
    // the body of the stroke grows as w, so a fatter line makes shape count
    // for relatively more. If this ever inverts, the model is wrong.
    const thin = runLineShapeExperiment(view, { ...OPTS, width: 1 });
    const fat = runLineShapeExperiment(view, { ...OPTS, width: 10 });
    expect(fat.ratio).toBeGreaterThan(thin.ratio);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/experiments/lineShape.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/experiments/lineShape.ts`**

```ts
import { SequenceView, type Sequence } from '../sequence/sequence';
import { turtlePath } from '../viz/turtle';
import { pathTransform, toScreen, type Pt } from '../viz/pathTransform';
import { sweptArea } from '../viz/sweptArea';
import { makeSurrogate } from '../nullmodel/surrogates';
import type { Size } from '../viz/types';

export interface ShapeResult { join: CanvasLineJoin; area: number; }

export interface LineShapeVerdict {
  /** Range of swept area across the three joins, on the real sequence. */
  shapeSpread: number;
  /** Range of swept area across permutation surrogates, at a fixed join. */
  nullSpread: number;
  /** shapeSpread / nullSpread. Above 1 means shape moves it more than chance. */
  ratio: number;
  shapeMatters: boolean;
  shapes: ShapeResult[];
}

const JOINS: CanvasLineJoin[] = ['miter', 'round', 'bevel'];
const ANGLE = 90, MOD_K = 4;

function screenPath(seq: SequenceView, size: Size): Pt[] {
  const pts = turtlePath(seq, ANGLE, MOD_K);
  const t = pathTransform(pts, size);
  return pts.map((p) => toScreen(t, p));
}

const range = (xs: number[]): number => {
  let lo = xs[0]!, hi = xs[0]!;
  for (const x of xs) { if (x < lo) lo = x; if (x > hi) hi = x; }
  return hi - lo;
};

/**
 * Does the line shape change what you would conclude?
 *
 * The honest way to ask it is the same way this whole project asks everything
 * else: put the effect next to a null model. Here the "effect" is how much the
 * swept area of the drawn path moves when only the join changes, and the
 * yardstick is how much it moves when the sequence itself is replaced by a
 * permutation of its own terms. If shuffling the sequence moves the measure
 * more than restyling it does, then shape is cosmetic - anything you can see
 * that survives a reshuffle is not something the join could have produced.
 *
 * Deterministic: no RNG beyond the seeded surrogates, no canvas, no pixels.
 */
export function runLineShapeExperiment(
  seq: SequenceView,
  opts: { width: number; n: number; seed: number; size: Size },
): LineShapeVerdict {
  const real = screenPath(seq, opts.size);
  const shapes: ShapeResult[] = JOINS.map((join) => ({
    join,
    area: sweptArea(real, opts.width, join, 'butt'),
  }));
  const shapeSpread = range(shapes.map((s) => s.area));

  // Null arm: hold the join fixed and vary the sequence instead.
  const nullAreas: number[] = [];
  for (let j = 0; j < opts.n; j++) {
    const terms = makeSurrogate(seq.seq.terms, 'permutation', opts.seed + j);
    const surrogate: Sequence = { terms, name: 's', offset: 0, source: 'paste' };
    nullAreas.push(sweptArea(screenPath(new SequenceView(surrogate), opts.size), opts.width, 'miter', 'butt'));
  }
  const nullSpread = range(nullAreas);

  const ratio = nullSpread === 0 ? Infinity : shapeSpread / nullSpread;
  return { shapeSpread, nullSpread, ratio, shapeMatters: ratio > 1, shapes };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/experiments/lineShape.test.ts && npm run build`
Expected: PASS

- [ ] **Step 5: Record the measured answer**

Run the experiment once and write the numbers into a doc so the answer is on record rather than folklore:

```bash
cat > /tmp/lineshape.test.ts <<'EOF'
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { runLineShapeExperiment } from './src/experiments/lineShape';
import { SequenceView, type Sequence } from './src/sequence/sequence';
import { kolakoski } from './src/gallery/sequences';
it('measure', () => {
  const view = new SequenceView({ terms: kolakoski(600), name: 'k', offset: 0, source: 'oeis' } as Sequence);
  const out = [1, 2, 4, 8, 12].map((width) => ({
    width, ...runLineShapeExperiment(view, { width, n: 100, seed: 1, size: { width: 800, height: 800 } }),
  }));
  writeFileSync('lineshape-out.json', JSON.stringify(out, null, 2));
});
EOF
cp /tmp/lineshape.test.ts ./scratch-lineshape.test.ts
npx vitest run scratch-lineshape.test.ts >/dev/null 2>&1
cat lineshape-out.json
rm -f scratch-lineshape.test.ts lineshape-out.json
```

Write the observed ratios into `docs/line-shape-answer.md`, stating the verdict in plain language and quoting the actual numbers at each stroke width. Do not write the conclusion before running it.

- [ ] **Step 6: Commit**

```bash
git add src/experiments tests/experiments docs/line-shape-answer.md
git commit -m "feat: measure whether line shape changes what you would conclude"
```

---

## Task 10: Final integration

**Files:**
- Modify: `README.md`
- Verify: everything

- [ ] **Step 1: Full suite and build**

Run: `npm test && npm run build`
Expected: all green, `tsc` clean.

- [ ] **Step 2: Browser pass**

`npm run dev`, then verify:

1. Style controls change line width, join, cap and hue live.
2. Colour mode `none` removes all hue from turtle, spiral and scatter.
3. Hue sliders disable in `none` mode rather than sitting live and inert.
4. `Compare: over` draws the real sequence in colour on a grey null; the option is disabled on grid visualizers.
5. PNG export downloads an image with the OEIS credit legible along the bottom.
6. CSV and JSON downloads open with the attribution line intact and full-precision terms.
7. "Show the numbers" reveals the table; `aria-expanded` flips.
8. "Report a problem" opens the public issue tracker.
9. Style survives a share-link round trip.

- [ ] **Step 3: README**

Add to the feature list:

```markdown
- **Render controls**: line width, join, cap, and a colour mode including
  `none`, which removes hue entirely so any structure still visible cannot be
  a palette artifact. Style is part of the shared URL.
- **Superimpose**: draw the real sequence over its own null in one frame,
  offered only where position carries information (grids place term *i* by
  index, so an overlay would simply overwrite).
- **Export**: PNG with the OEIS credit drawn into the bitmap, plus CSV and
  JSON carrying it in a header - attribution has to survive leaving the page.
- **The numbers behind the picture**: a data table of index and exact term,
  which is also the textual equivalent of the canvas for screen-reader users.
```

and link `docs/line-shape-answer.md` from the design-docs list.

- [ ] **Step 4: Commit, push, deploy**

```bash
git add README.md
git commit -m "docs: describe render controls, export, and the line-shape answer"
git push origin master
bash scripts/deploy.sh
```

---

## Self-Review Notes

**Scope coverage:**

| Requirement | Task |
| --- | --- |
| Colour choices incl. none | 1, 2, 3 |
| Line width | 1, 2, 3 |
| Gradient start/stop | 1, 2, 3 |
| Line shape (join/cap) | 1, 2, 3 |
| Superimpose | 4 |
| Data download (CSV/JSON) | 5 |
| Screen-reader data table | 5, 7 |
| PNG export | 6 |
| Attribution on exports | 5, 6 |
| Feedback link | 7 |
| Line-shape experiment | 8, 9 |

**Deliberate trap in Task 8, Step 4:** the cap arithmetic is written incorrectly
on purpose, with the geometry spelled out so the implementer resolves it from
first principles rather than by making the numbers agree. Both the code and one
test assertion are wrong in different directions; the geometry decides.

**Known risk:** `runLineShapeExperiment` fixes the turtle walk at angle 90 /
mod 4. That is one path shape, not all of them - the verdict is about that
family of drawings, and `docs/line-shape-answer.md` must say so rather than
generalising to every visualizer.

---

## Captured for round 4 - continuous deformation and animation

Not in this round. Recorded here so it is not lost.

The observation: sweeping a numeric parameter looks like a *continuous
deformation* rather than a series of unrelated pictures, and the interesting
behaviour may live between the integer steps.

Three things make this concrete:

1. **Fractional parameters are currently unreachable.** Every numeric
   `ParamSpec` in the codebase declares `step: 1` - turtle `angle` runs 1..180
   by ones, polyarc `angle` 1..120 by ones. An angle of 90.5° cannot be
   expressed at all, so the deformation the user is describing is not merely
   un-animated, it is inaccessible. Allowing fractional `step` is the
   prerequisite for everything else here and is a small change.

2. **The deformation is genuinely punctuated, not uniform.** A turtle walk
   whose turn angle is a rational multiple of 360° closes into a repeating
   figure; irrational multiples never close and drift. So sweeping the angle
   passes through resonances where the picture snaps to a stable form and
   intervals between them where it wanders. That structure is a property of
   the *angle arithmetic*, largely independent of the sequence - which is
   exactly the kind of claim this project should measure rather than assert.

3. **The machinery mostly exists.** The sweep view already renders a parameter
   range as small multiples; an animation is the same values played in time
   instead of laid out in space. `locate`/`position` already let a pinned term
   be tracked across re-renders, so a marker could follow one term through the
   deformation - which is likely where the insight is.

The null-model question applies unchanged: does the deformation reveal
something about *this* sequence, or would any sequence deform the same way
under the same angle sweep? That comparison is the round-4 experiment, and it
is the direct descendant of the observation that A000002's spiral was only
visible while animating through moduli.
