# Theme, Zoom/Pan, and Citation - Round 5

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A light theme that reaches the canvas as well as the chrome, zoom and pan that work in every visualizer, and a citation anyone can paste into a paper.

**Architecture:** Two decisions carry this round. Canvas colours move behind a small palette module with module-level current state, so 38 call sites read a named colour instead of a literal without 38 signature changes. Zoom and pan become a *single* viewport transform applied in `drawScene` around `viz.render`, inverted once for hit-testing - so nothing in `src/viz/` changes at all, and eleven visualizers get zoom for free.

**Tech Stack:** Vanilla TypeScript, Canvas 2D, Vitest + jsdom, no runtime npm dependencies.

## Global Constraints

- **No runtime npm dependencies.**
- **No `Math.random()` in `src/`** - seeded `mulberry32` only.
- **Terms are `bigint`**; `SequenceView` is the sole float64 boundary.
- **No `Math.min(...array)` spreads** over sequence-length data - use `minMax`.
- **Both themes must pass WCAG AA** (4.5:1 for normal text). The dark palette currently measures 5.75:1 at worst; the light one must be measured, not assumed.
- **Nothing in `src/viz/` may learn about zoom.** If a visualizer needs to know the zoom level, the design is wrong.
- **Exports keep their attribution** - PNG stamps it into the bitmap, CSV/JSON into a header.
- Run `npm test` and `npm run build` before every commit. The existing 383 tests stay green.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/viz/theme.ts` | `CanvasPalette`, the dark and light palettes, `canvasTheme()` / `setCanvasTheme()`. Data plus two accessors, no drawing. |
| `src/ui/viewport.ts` | `Viewport` (zoom + pan), `applyViewport`, `screenToWorld`, `clampViewport`. Pure maths, no DOM. |
| `src/ui/themeToggle.ts` | The control, plus reading `prefers-color-scheme` and persisting the choice. |
| `src/ui/citation.ts` | `citationFor(state)` - a pasteable reference to the current view. |
| `tests/viz/theme.test.ts`, `tests/ui/viewport.test.ts`, `tests/ui/citation.test.ts` | Tests for the above. |

**Modified:**

| File | Change |
| --- | --- |
| `src/viz/{scatter,differences,histogram,autocorrelation,ulamSpiral,modGrid}.ts` | Read palette colours instead of literals. |
| `src/ui/{comparison,landing,sweep,exportImage,app}.ts` | Same. |
| `src/ui/app.ts` | Viewport state, wheel/drag handlers, hit-test inversion, theme toggle, citation button. |
| `src/ui/urlState.ts` | `viewport` in the shared state. |
| `src/style.css` | Light palette via `:root[data-theme="light"]`, zoom controls. |

---

## Task 1: The canvas palette

**Files:**
- Create: `src/viz/theme.ts`
- Test: `tests/viz/theme.test.ts`

**Interfaces:**
- Produces:
  - `interface CanvasPalette { bg: string; panel: string; text: string; muted: string; accent: string; real: string; grid: string; axis: string; band: (level: number) => string }`
  - `const DARK_PALETTE: CanvasPalette`, `const LIGHT_PALETTE: CanvasPalette`
  - `canvasTheme(): CanvasPalette`
  - `setCanvasTheme(name: 'dark' | 'light'): void`
  - `type ThemeName = 'dark' | 'light'`

- [ ] **Step 1: Write the failing test**

Create `tests/viz/theme.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  canvasTheme, setCanvasTheme, DARK_PALETTE, LIGHT_PALETTE, type CanvasPalette,
} from '../../src/viz/theme';

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

  it('text and muted pass AA against their own background in BOTH themes', () => {
    for (const [name, p] of [['dark', DARK_PALETTE], ['light', LIGHT_PALETTE]] as const) {
      expect(contrast(p.text, p.bg), `${name}: text on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, p.bg), `${name}: muted on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.real, p.bg), `${name}: real-line on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, p.bg), `${name}: accent on bg`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the light background really is light and the dark one dark', () => {
    // Guards against a copy-paste that leaves both palettes identical.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/theme.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/viz/theme.ts`**

```ts
export type ThemeName = 'dark' | 'light';

export interface CanvasPalette {
  /** Canvas background. */
  bg: string;
  /** Slightly raised surface, used for legend backing. */
  panel: string;
  text: string;
  muted: string;
  accent: string;
  /** The real sequence's line in an ensemble chart, and the pinned marker. */
  real: string;
  /** Grid lines and panel dividers. */
  grid: string;
  /** Zero axis on the charts. */
  axis: string;
  /** Null-model band fill; level 0 is the widest and faintest. */
  band(level: number): string;
}

export const DARK_PALETTE: CanvasPalette = {
  bg: '#14161a',
  panel: '#1d2026',
  text: '#e6e6e6',
  muted: '#9aa0aa',
  accent: '#7aa2f7',
  real: '#f7768e',
  grid: '#333333',
  axis: 'rgba(255,255,255,0.18)',
  band: (level) => `rgba(122,162,247,${0.10 + level * 0.07})`,
};

// Not a naive inversion. The accent and real-line hues are darkened until they
// clear 4.5:1 against a light background, which the dark theme's versions do
// not - #7aa2f7 on white is 2.2:1. The test measures this rather than trusting
// it.
export const LIGHT_PALETTE: CanvasPalette = {
  bg: '#fbfbfd',
  panel: '#eef0f4',
  text: '#16181d',
  muted: '#565c66',
  accent: '#1f4fa8',
  real: '#a3123a',
  grid: '#c8ccd4',
  axis: 'rgba(0,0,0,0.22)',
  band: (level) => `rgba(31,79,168,${0.10 + level * 0.07})`,
};

// Module-level rather than threaded through every render() call. Canvas colour
// is ambient in the same way ctx.fillStyle is, and threading it would mean 38
// signature changes for a value that is identical everywhere at any instant.
// It defaults to dark, so behaviour is unchanged until something switches it,
// and tests reset it in afterEach.
let current: CanvasPalette = DARK_PALETTE;

export function canvasTheme(): CanvasPalette {
  return current;
}

export function setCanvasTheme(name: ThemeName): void {
  current = name === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/viz/theme.test.ts`
Expected: PASS. If a contrast assertion fails, darken the offending light-theme colour until it clears 4.5:1 - do not relax the threshold.

- [ ] **Step 5: Commit**

```bash
git add src/viz/theme.ts tests/viz/theme.test.ts
git commit -m "feat: canvas palette module with measured light and dark themes"
```

---

## Task 2: Canvas drawing reads the palette

**Files:**
- Modify: `src/viz/{scatter,differences,histogram,autocorrelation,ulamSpiral,modGrid}.ts`
- Modify: `src/ui/{comparison,landing,sweep,app}.ts`
- Test: `tests/viz/theme.test.ts`

**Interfaces:**
- Consumes: `canvasTheme()`, `setCanvasTheme()` (Task 1).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `tests/viz/theme.test.ts`:

```ts
import { fakeCtx } from '../helpers/fakeCtx';
import { registerAll } from '../../src/viz/all';
import { allVisualizers, clearRegistry } from '../../src/viz/registry';
import { defaultParams } from '../../src/viz/types';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';

const seq = new SequenceView({
  terms: Array.from({ length: 60 }, (_, i) => BigInt(i % 7)),
  name: 't', offset: 0, source: 'paste',
} as Sequence);

function coloursUsed(render: () => void): string[] {
  const out: string[] = [];
  const { ctx } = fakeCtx();
  const spy = new Proxy(ctx, {
    set(_t, prop, value) {
      if (prop === 'fillStyle' || prop === 'strokeStyle') out.push(String(value));
      return true;
    },
    get(t, prop) { return (t as never)[prop]; },
  });
  (globalThis as { __spyCtx?: unknown }).__spyCtx = spy;
  render.call(null, spy);
  return out;
}

describe('visualizers follow the active theme', () => {
  beforeAll(() => { clearRegistry(); registerAll(); });

  it('no visualizer emits a dark-theme literal while the light theme is active', () => {
    setCanvasTheme('light');
    const darkLiterals = ['#14161a', '#9aa0aa', '#7aa2f7', '#f7768e', '#1d2026'];
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
        expect(seen.some((c) => c.toLowerCase().includes(lit)), `${viz.id} emitted ${lit} in light theme`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/viz/theme.test.ts -t "follow the active theme"`
Expected: FAIL - several visualizers still emit `#7aa2f7` and `rgba(255,255,255,0.18)`.

- [ ] **Step 3: Replace the literals**

Add `import { canvasTheme } from './theme';` to each visualizer (`'../viz/theme'` from `src/ui/`), then substitute:

| File | Old | New |
| --- | --- | --- |
| `scatter.ts` | `'rgba(255,255,255,0.18)'` | `canvasTheme().axis` |
| `differences.ts` | `'rgba(255,255,255,0.18)'` | `canvasTheme().axis` |
| `autocorrelation.ts` | `'rgba(255,255,255,0.18)'` | `canvasTheme().axis` |
| `autocorrelation.ts` | `'#9aa0aa'` (log caption) | `canvasTheme().muted` |
| `histogram.ts` | `'rgba(255,255,255,0.18)'` | `canvasTheme().axis` |
| `ulamSpiral.ts` | `'#1d2026'` / `'#7aa2f7'` (parity) | `canvasTheme().panel` / `canvasTheme().accent` |
| `ulamSpiral.ts` | `'#3a3d44'` / `'#9aa0aa'` (colour-none) | `canvasTheme().grid` / `canvasTheme().muted` |
| `modGrid.ts` | `'#3a3d44'` / `'#9aa0aa'` (colour-none) | `canvasTheme().grid` / `canvasTheme().muted` |
| `comparison.ts` | `'rgba(122,162,247,…)'` band fill | `canvasTheme().band(li)` |
| `comparison.ts` | `'#9aa0aa'` median, `'#f7768e'` real, `'#e6e6e6'` key | `canvasTheme().muted` / `.real` / `.text` |
| `landing.ts` | `'#14161a'`, `'#333'`, `'#9aa0aa'` | `canvasTheme().bg` / `.grid` / `.muted` |
| `sweep.ts` | `'#14161a'` | `canvasTheme().bg` |
| `app.ts` | `'#14161a'` bg fill, `'#9aa0aa'` labels, `'#f7768e'` marker | `canvasTheme().bg` / `.muted` / `.real` |

In `comparison.ts`'s `drawLegend`, the swatch list must use the same accessors so the legend matches what is drawn:

```ts
  const items: Array<{ swatch: string; dashed?: boolean; label: string }> = [
    { swatch: canvasTheme().real, label: 'real sequence' },
    { swatch: canvasTheme().muted, dashed: true, label: 'null median' },
    ...band.levels.map((l, i) => ({ swatch: canvasTheme().band(i), label: `${l.pct}% of nulls` })),
  ];
```

In `src/viz/style.ts`, the `'none'` colour mode returns a hard-coded `NEUTRAL`; make it follow the theme:

```ts
import { canvasTheme } from './theme';
// ...
  if (s.colorMode === 'none') return canvasTheme().muted;
```

- [ ] **Step 4: Run tests**

Run: `npm test && npm run build`
Expected: PASS. `tests/viz/style.test.ts` asserts no `hsl` in colour-mode `none`; `canvasTheme().muted` is a hex, so it still holds.

- [ ] **Step 5: Commit**

```bash
git add src/viz src/ui tests/viz/theme.test.ts
git commit -m "feat: canvas drawing reads the active palette instead of literals"
```

---

## Task 3: The theme toggle

**Files:**
- Create: `src/ui/themeToggle.ts`
- Modify: `src/ui/app.ts`, `src/style.css`
- Test: `tests/ui/citation.test.ts` (create; shared file for round-5 UI)

**Interfaces:**
- Consumes: `setCanvasTheme`, `type ThemeName` (Task 1).
- Produces: `initialTheme(): ThemeName`, `applyTheme(name: ThemeName): void`, `buildThemeToggle(onChange: (t: ThemeName) => void): { el: HTMLElement; refresh(): void }`.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/citation.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initialTheme, applyTheme, buildThemeToggle } from '../../src/ui/themeToggle';
import { canvasTheme, DARK_PALETTE, LIGHT_PALETTE, setCanvasTheme } from '../../src/viz/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => setCanvasTheme('dark'));

describe('theme selection', () => {
  it('follows the OS preference when nothing is stored', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('light'), media: q, addEventListener() {}, removeEventListener() {},
    }));
    expect(initialTheme()).toBe('light');
    vi.unstubAllGlobals();
  });

  it('a stored choice beats the OS preference', () => {
    localStorage.setItem('ulam-theme', 'dark');
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('light'), media: q, addEventListener() {}, removeEventListener() {},
    }));
    expect(initialTheme()).toBe('dark');
    vi.unstubAllGlobals();
  });

  it('applying a theme sets the document attribute AND the canvas palette', () => {
    // Two halves of the same switch: CSS reads the attribute, canvas code
    // reads the module. Setting one without the other is the obvious bug.
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(canvasTheme()).toBe(LIGHT_PALETTE);
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(canvasTheme()).toBe(DARK_PALETTE);
  });

  it('remembers the choice', () => {
    applyTheme('light');
    expect(localStorage.getItem('ulam-theme')).toBe('light');
  });

  it('the toggle is a labelled button reporting which theme is active', () => {
    const { el } = buildThemeToggle(() => {});
    document.body.appendChild(el);
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('aria-label')).toMatch(/theme/i);
    expect((el.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('clicking it flips the theme and reports the new value', () => {
    applyTheme('dark');
    const seen: string[] = [];
    const { el } = buildThemeToggle((t) => seen.push(t));
    (el as HTMLButtonElement).click();
    expect(seen).toEqual(['light']);
    expect(canvasTheme()).toBe(LIGHT_PALETTE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/citation.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/themeToggle.ts`**

```ts
import { setCanvasTheme, type ThemeName } from '../viz/theme';

const KEY = 'ulam-theme';

/** Stored choice, else the OS preference, else dark. */
export function initialTheme(): ThemeName {
  const stored = (() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  })();
  if (stored === 'light' || stored === 'dark') return stored;
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch { /* matchMedia unavailable in some test environments */ }
  return 'dark';
}

/**
 * Both halves of the switch, always together: CSS reads the document
 * attribute and canvas code reads the palette module, so setting one without
 * the other leaves light chrome around a dark drawing.
 */
export function applyTheme(name: ThemeName): void {
  document.documentElement.setAttribute('data-theme', name);
  setCanvasTheme(name);
  try { localStorage.setItem(KEY, name); } catch { /* private mode */ }
}

export function buildThemeToggle(onChange: (t: ThemeName) => void): { el: HTMLElement; refresh(): void } {
  const el = document.createElement('button');
  el.className = 'theme-toggle';
  el.type = 'button';

  function refresh(): void {
    const now = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    el.textContent = now === 'light' ? 'Dark' : 'Light';
    el.setAttribute('aria-label', `Switch to the ${now === 'light' ? 'dark' : 'light'} theme`);
  }

  el.addEventListener('click', () => {
    const next: ThemeName = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    refresh();
    onChange(next);
  });

  refresh();
  return { el, refresh };
}
```

- [ ] **Step 4: Add the light palette to CSS**

Append to `src/style.css`:

```css
/* Mirrors src/viz/theme.ts. The two must agree: CSS paints the chrome and
   the module paints the canvas, and a visitor sees them side by side. */
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #fbfbfd;
  --panel: #eef0f4;
  --text: #16181d;
  --muted: #565c66;
  --accent: #1f4fa8;
}
:root[data-theme="light"] .tab-pane input,
:root[data-theme="light"] .tab-pane textarea,
:root[data-theme="light"] .tab-pane button,
:root[data-theme="light"] .tab-pane select,
:root[data-theme="light"] .viz-picker,
:root[data-theme="light"] .style-controls select,
:root[data-theme="light"] .export-bar button,
:root[data-theme="light"] .header-nav-button,
:root[data-theme="light"] .page-nav-button,
:root[data-theme="light"] .preset-button,
:root[data-theme="light"] .search-results button,
:root[data-theme="light"] .bfile-cap,
:root[data-theme="light"] .explain-button,
:root[data-theme="light"] .style-toggle { background: #ffffff; border-color: #c8ccd4; }
:root[data-theme="light"] .style-toggle { background: var(--text); color: var(--bg); border-color: var(--text); }
:root[data-theme="light"] .bfile-button,
:root[data-theme="light"] .landing-open,
:root[data-theme="light"] .page-nav-button--primary { background: var(--accent); color: #ffffff; border-color: var(--accent); }
:root[data-theme="light"] .app-header,
:root[data-theme="light"] .topbar,
:root[data-theme="light"] .comparison-bar,
:root[data-theme="light"] .export-bar { border-color: #d6dae2; }
:root[data-theme="light"] .banner-error { background: #fbe4e9; color: #8c0f31; border-color: #a3123a55; }
:root[data-theme="light"] .banner-notice { background: #e5edfb; color: #1f4fa8; border-color: #1f4fa855; }
:root[data-theme="light"] .readout { background: rgba(255,255,255,0.92); }
:root[data-theme="light"] .verdict--real { background: #dff3e6; color: #1c6b3a; }
:root[data-theme="light"] .verdict--artifact { background: #fbe4e9; color: #8c0f31; }
:root[data-theme="light"] .verdict--open { background: #e7e9ee; color: #565c66; }
.theme-toggle {
  background: #24262c; color: var(--text); border: 1px solid #3a3d44;
  border-radius: 4px; padding: 4px 12px; cursor: pointer; font: inherit; font-size: 12px;
}
:root[data-theme="light"] .theme-toggle { background: #ffffff; border-color: #c8ccd4; }
```

- [ ] **Step 5: Mount it in `app.ts`**

At the very top of `mountApp`, before any drawing:

```ts
  applyTheme(initialTheme());
```

and in the header nav, before the Gallery button:

```ts
  const themeUi = buildThemeToggle(() => redraw());
  headerNav.appendChild(themeUi.el);
```

Add imports:

```ts
import { initialTheme, applyTheme, buildThemeToggle } from './themeToggle';
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/themeToggle.ts src/ui/app.ts src/style.css tests/ui/citation.test.ts
git commit -m "feat: light theme covering both the chrome and the canvas"
```

---

## Task 4: The viewport

**Files:**
- Create: `src/ui/viewport.ts`
- Test: `tests/ui/viewport.test.ts`

**Interfaces:**
- Produces:
  - `interface Viewport { zoom: number; panX: number; panY: number }`
  - `const IDENTITY_VIEWPORT: Viewport`
  - `isIdentity(v: Viewport): boolean`
  - `applyViewport(ctx: CanvasRenderingContext2D, v: Viewport): void`
  - `screenToWorld(v: Viewport, x: number, y: number): { x: number; y: number }`
  - `zoomAt(v: Viewport, factor: number, cx: number, cy: number): Viewport`
  - `clampViewport(v: Viewport): Viewport`

- [ ] **Step 1: Write the failing test**

Create `tests/ui/viewport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  IDENTITY_VIEWPORT, isIdentity, screenToWorld, zoomAt, clampViewport, type Viewport,
} from '../../src/ui/viewport';

describe('viewport maths', () => {
  it('identity maps a point to itself', () => {
    expect(screenToWorld(IDENTITY_VIEWPORT, 120, 80)).toEqual({ x: 120, y: 80 });
    expect(isIdentity(IDENTITY_VIEWPORT)).toBe(true);
  });

  it('inverts zoom and pan exactly', () => {
    const v: Viewport = { zoom: 2.5, panX: -40, panY: 15 };
    // Forward transform is: screen = world * zoom + pan.
    const world = { x: 33, y: -12 };
    const screen = { x: world.x * v.zoom + v.panX, y: world.y * v.zoom + v.panY };
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

  it('isIdentity is false once anything moves', () => {
    expect(isIdentity({ zoom: 1.01, panX: 0, panY: 0 })).toBe(false);
    expect(isIdentity({ zoom: 1, panX: 3, panY: 0 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/viewport.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/viewport.ts`**

```ts
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
 * The whole point of this module: ONE transform, applied around the
 * visualizer's render call, and inverted once for hit-testing. No visualizer
 * knows the zoom level, so all eleven get zoom and pan without changing a
 * line - and locate()/position() keep working in the coordinate space they
 * were written for.
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

/** Zoom by `factor` about a screen point, leaving that point stationary. */
export function zoomAt(v: Viewport, factor: number, cx: number, cy: number): Viewport {
  const next = clampViewport({ ...v, zoom: v.zoom * factor });
  // Solve for the pan that keeps screenToWorld(cx, cy) unchanged.
  const world = screenToWorld(v, cx, cy);
  return clampViewport({
    zoom: next.zoom,
    panX: cx - world.x * next.zoom,
    panY: cy - world.y * next.zoom,
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/viewport.test.ts && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/viewport.ts tests/ui/viewport.test.ts
git commit -m "feat: viewport maths for zoom and pan, with a stationary zoom point"
```

---

## Task 5: Wire zoom and pan into the engine

**Files:**
- Modify: `src/ui/app.ts`, `src/ui/urlState.ts`, `src/style.css`
- Test: `tests/ui/viewport.test.ts`

**Interfaces:**
- Consumes: everything from Task 4.
- Produces: `UrlState.viewport?: Viewport`.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/viewport.test.ts`:

```ts
// @vitest-environment jsdom
import { mountApp } from '../../src/ui/app';
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

  it('offers zoom controls including a reset', () => {
    const root = mountEngine();
    for (const cls of ['.zoom-in', '.zoom-out', '.zoom-reset']) {
      const b = root.querySelector<HTMLButtonElement>(cls);
      expect(b, `${cls} missing`).not.toBeNull();
      expect(b!.tagName).toBe('BUTTON');
      expect(b!.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('survives a share-link round trip', () => {
    const v = { zoom: 3.5, panX: -120, panY: 44 };
    const back = decodeState('#' + encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'off',
      surrogate: 'permutation', seed: 1, viewport: v,
    }));
    expect(back!.viewport).toEqual(v);
  });

  it('reset returns the viewport to identity', () => {
    const root = mountEngine();
    root.querySelector<HTMLButtonElement>('.zoom-in')!.click();
    root.querySelector<HTMLButtonElement>('.zoom-in')!.click();
    root.querySelector<HTMLButtonElement>('.zoom-reset')!.click();
    // The label reports the current zoom, so identity reads as 100%.
    expect(root.querySelector('.zoom-level')!.textContent).toMatch(/100\s*%/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/viewport.test.ts -t "in the engine"`
Expected: FAIL - no `.zoom-in`.

- [ ] **Step 3: Add viewport state and controls to `app.ts`**

Beside the other mutable state:

```ts
  let viewport: Viewport = { ...IDENTITY_VIEWPORT };
```

In the export bar (after the table toggle), add the controls:

```ts
  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'zoom-level';

  const setViewport = (v: Viewport): void => {
    viewport = clampViewport(v);
    zoomLabel.textContent = `${Math.round(viewport.zoom * 100)}%`;
    redraw();
  };

  const centre = () => {
    const r = canvasWrap.getBoundingClientRect();
    return { x: Math.max(200, r.width) / 2, y: Math.max(200, r.height) / 2 };
  };

  const mkZoom = (cls: string, label: string, aria: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    exportBar.appendChild(b);
    return b;
  };

  mkZoom('zoom-out', '-', 'Zoom out', () => { const c = centre(); setViewport(zoomAt(viewport, 1 / 1.4, c.x, c.y)); });
  exportBar.appendChild(zoomLabel);
  mkZoom('zoom-in', '+', 'Zoom in', () => { const c = centre(); setViewport(zoomAt(viewport, 1.4, c.x, c.y)); });
  mkZoom('zoom-reset', 'Reset', 'Reset zoom and pan', () => setViewport({ ...IDENTITY_VIEWPORT }));
  zoomLabel.textContent = '100%';
```

Wheel and drag on the canvas:

```ts
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    setViewport(zoomAt(viewport, e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top));
  }, { passive: false });

  let dragFrom: { x: number; y: number; panX: number; panY: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    // Left button only, and never while the pointer is over the null panel in
    // side mode - dragging there would still pan the whole canvas, which is
    // correct, so no special case is needed.
    if (e.button !== 0) return;
    dragFrom = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    dragFrom = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  });
```

Extend the existing `pointermove` handler so a drag pans instead of hovering:

```ts
    if (dragFrom) {
      setViewport({
        zoom: viewport.zoom,
        panX: dragFrom.panX + (e.clientX - dragFrom.x),
        panY: dragFrom.panY + (e.clientY - dragFrom.y),
      });
      readout.set(null);
      return;
    }
```

A drag must not also fire the click-to-pin handler, so guard it:

```ts
  // Distinguish a click from the end of a drag: a pan that moved more than a
  // few pixels should not also pin a term.
  let downAt: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
```

and at the top of the existing click handler:

```ts
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
```

- [ ] **Step 4: Apply the transform around rendering, and invert it for hit-testing**

In `drawScene`, the `draw` helper wraps `viz.render`. Apply the viewport inside the clip, and keep the label outside it so text does not scale:

```ts
    const draw = (seq: typeof state.seq, w: number, h: number, ox: number, label: string) => {
      ctx.save();
      ctx.translate(ox, 0);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      ctx.save();
      applyViewport(ctx, viewport);
      try {
        // Line width is divided by the zoom so a stroke keeps its on-screen
        // thickness: zooming in should reveal finer structure, not fatten
        // every line until the picture fills in.
        const zoomed: Params = {
          ...state.params, ...styleToParams(style),
          styleLineWidth: style.lineWidth / viewport.zoom,
        };
        viz.render(new SequenceView(seq!), zoomed, ctx, { width: w, height: h });
      } catch (e) {
        showError(`Render failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      ctx.restore();
      // Labels are drawn in screen space, after restoring, so they stay the
      // same size at any zoom.
      ctx.fillStyle = canvasTheme().muted;
      ctx.font = '12px system-ui';
      ctx.fillText(label, 10, 16);
      ctx.restore();
    };
```

In `hitAt`, convert the pointer into the visualizer's own coordinate space before calling `locate`:

```ts
    const w = screenToWorld(viewport, x, pt.y);
    const hit = viz.locate(new SequenceView(seq), state.params, { width: panelW, height: size.height }, w.x, w.y);
```

and in the marker passes, convert the other way, since `position()` returns visualizer coordinates:

```ts
      const p = viz.position(view, state.params, { width, height }, pinnedIndex);
      if (p) drawMarker(ctx, { x: p.x * viewport.zoom + viewport.panX, y: p.y * viewport.zoom + viewport.panY }, canvasTheme().real);
```

Include `viewport` in `encodeState({...})` and restore it in `applyHash`:

```ts
      if (decoded.viewport) setViewport(decoded.viewport);
```

In `src/ui/urlState.ts`:

```ts
  /** Absent on links encoded before zoom existed. */
  viewport?: Viewport;
```

with `import type { Viewport } from './viewport';`.

- [ ] **Step 5: Style the controls**

Append to `src/style.css`:

```css
.zoom-level { font: 12px ui-monospace, monospace; color: var(--muted); min-width: 4em; text-align: center; }
.canvas-wrap canvas { cursor: grab; }
.canvas-wrap canvas:active { cursor: grabbing; }
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 7: Browser check**

`npm run dev`, then confirm: the wheel zooms about the cursor; dragging pans; the readout still identifies terms correctly while zoomed; a pinned marker stays on its term while zooming; Reset returns to 100%; a share link reproduces the zoom.

- [ ] **Step 8: Commit**

```bash
git add src/ui/app.ts src/ui/urlState.ts src/style.css tests/ui/viewport.test.ts
git commit -m "feat: zoom and pan for every visualizer via one viewport transform"
```

---

## Task 6: Copy citation

**Files:**
- Create: `src/ui/citation.ts`
- Modify: `src/ui/app.ts`
- Test: `tests/ui/citation.test.ts`

**Interfaces:**
- Consumes: `Sequence`, `Visualizer`, `UrlState`.
- Produces: `citationFor(opts: { seq: Sequence; vizName: string; url: string; accessed: string }): string`

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/citation.test.ts`:

```ts
import { citationFor } from '../../src/ui/citation';
import type { Sequence } from '../../src/sequence/sequence';

const fib: Sequence = {
  terms: [0n, 1n, 1n, 2n], aNumber: 'A000045',
  name: 'Fibonacci numbers', offset: 0, source: 'oeis',
};

describe('citationFor', () => {
  const base = { seq: fib, vizName: 'Turtle walk', url: 'https://ulam.briansheppard.com/#abc', accessed: '2026-08-08' };

  it('names the sequence, the view, the URL and the access date', () => {
    const c = citationFor(base);
    expect(c).toContain('A000045');
    expect(c).toContain('Fibonacci numbers');
    expect(c).toContain('Turtle walk');
    expect(c).toContain('https://ulam.briansheppard.com/#abc');
    expect(c).toContain('2026-08-08');
  });

  it('credits the OEIS, since the data is theirs', () => {
    const c = citationFor(base);
    expect(c).toMatch(/On-Line Encyclopedia of Integer Sequences/);
    expect(c).toContain('CC BY-SA 4.0');
  });

  it('omits the A-number cleanly for a non-OEIS sequence', () => {
    const c = citationFor({ ...base, seq: { terms: [1n], name: 'Pasted sequence', offset: 0, source: 'paste' } });
    expect(c).toContain('Pasted sequence');
    expect(c).not.toMatch(/A undefined|oeis\.org\/undefined/);
  });

  it('is a single paragraph, so it pastes into a bibliography intact', () => {
    expect(citationFor(base).split('\n').filter((l) => l.trim()).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/citation.test.ts -t citationFor`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/citation.ts`**

```ts
import type { Sequence } from '../sequence/sequence';

/**
 * A pasteable reference to one specific view.
 *
 * The audience is a mailing list of mathematicians, for whom a citation of an
 * exact figure is worth considerably more than a share button: the URL encodes
 * sequence, visualizer, parameters, comparison mode and seed, so the reference
 * reproduces the picture rather than merely pointing at the site.
 */
export function citationFor(opts: {
  seq: Sequence; vizName: string; url: string; accessed: string;
}): string {
  const { seq, vizName, url, accessed } = opts;
  const subject = seq.aNumber ? `${seq.aNumber} (${seq.name})` : seq.name;
  return [
    `Ulam: OEIS sequence visualizer. ${vizName} of ${subject}, ${seq.terms.length} terms.`,
    `Retrieved ${accessed} from ${url}.`,
    'Sequence data from The On-Line Encyclopedia of Integer Sequences (OEIS),',
    '(c) OEIS Foundation Inc., CC BY-SA 4.0.',
  ].join(' ');
}
```

- [ ] **Step 4: Add the button in `app.ts`**

Beside the Copy link button:

```ts
  mkExport('copy-citation', 'Copy citation', () => {
    if (!state.seq) { showNotice('Load a sequence first.'); return; }
    const text = citationFor({
      seq: state.seq,
      vizName: getVisualizer(state.vizId).name,
      url: location.href,
      accessed: new Date().toISOString().slice(0, 10),
    });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showNotice('Citation copied.'))
        .catch(() => showError('Could not copy the citation.'));
    } else {
      showNotice(text);
    }
  });
```

with `import { citationFor } from './citation';`.

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/citation.ts src/ui/app.ts tests/ui/citation.test.ts
git commit -m "feat: copy a citation that reproduces the exact view"
```

---

## Task 7: Final integration

**Files:**
- Modify: `README.md`
- Verify: everything

- [ ] **Step 1: Full suite and build**

Run: `npm test && npm run build`
Expected: green, `tsc` clean.

- [ ] **Step 2: Browser pass**

1. The theme toggle flips chrome *and* canvas together; no dark canvas in a light page.
2. Contrast holds in light mode: the readout, panel labels, band legend and verdict tags are all legible.
3. Wheel zooms about the cursor; drag pans; a drag does not also pin a term.
4. Hovering identifies terms correctly at 4x zoom, on both panels.
5. Reset returns to 100%, and a share link carries zoom, pan and theme-independent state.
6. The landing and About pages render correctly in light mode.
7. PNG export in light mode has legible attribution against a light background.

- [ ] **Step 3: README**

Add to the feature list:

```markdown
- **Light and dark themes** that reach the drawing as well as the interface.
  Both palettes are measured against WCAG AA in `tests/viz/theme.test.ts`
  rather than assumed, since a naive inversion of the dark accent lands at
  2.2:1 on white.
- **Zoom and pan** in every visualizer, applied as a single viewport transform
  around the render call and inverted once for hit-testing - so no visualizer
  knows the zoom level, and cursor identification keeps working while zoomed.
- **Copy citation** producing a reference that reproduces the exact view,
  since the URL encodes sequence, visualizer, parameters, mode and seed.
```

- [ ] **Step 4: Commit, push, deploy**

```bash
git add README.md
git commit -m "docs: describe themes, zoom/pan, and citations"
git push origin master
bash scripts/deploy.sh
```

---

## Self-Review Notes

**Scope coverage:**

| Requirement | Task |
| --- | --- |
| Light/dark palettes, measured | 1 |
| 38 canvas literals replaced | 2 |
| Toggle, OS preference, persistence | 3 |
| Viewport maths | 4 |
| Zoom/pan wired, hit-testing inverted, URL state | 5 |
| Copy citation | 6 |

**Known risk - the line-width division in Task 5.** Dividing `styleLineWidth`
by the zoom keeps strokes visually constant, which is what you want when
zooming to inspect fine structure. But it means the *rendered* geometry differs
from the unzoomed one, so the line-shape experiment's swept-area figures apply
to the unzoomed view only. That is already true (the experiment fixes its own
size) and needs no code change, but do not later "fix" the experiment to read
the live zoom.

**Known risk - `position()` and the marker.** `position()` returns coordinates
in the visualizer's space, so the marker pass must apply the viewport forward
while `hitAt` applies it backward. Getting one of the two directions wrong
produces a marker that drifts as you zoom, which looks like a rendering bug
rather than a transform bug. The browser check in Task 7 step 3 exists to catch
exactly this.

**Deliberately out of scope:** zoom in the sweep grid and the gallery
thumbnails. Both render at fixed small sizes where panning has no value, and
both would need their own viewport state.
