# Accessibility Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing engine markup - sequence panel, sweep overlay, message banners, document structure - up to the 508/WCAG AA standard that round 1's new markup was written to.

**Architecture:** Almost entirely semantic: real `<label>` elements, the WAI-ARIA tab pattern, live regions for the notification system, the sweep overlay promoted to a focus-managed dialog, and a skip link. No palette work - contrast was measured across every foreground/background pair in the theme and the lowest ratio is 5.75:1, comfortably past the 4.5:1 AA threshold. No visual redesign; every change is either invisible or reveals itself only on keyboard focus.

**Tech Stack:** Vanilla TypeScript, Vitest + jsdom, no runtime npm dependencies.

## Global Constraints

- **No runtime npm dependencies.** Nothing may be added to `dependencies` in `package.json`.
- **No visual regressions.** These changes must not alter the rendered appearance for a sighted mouse user, except that focus indicators become visible on keyboard focus and the skip link appears when focused.
- **Contrast is already conformant** - do not change `--text`, `--muted`, `--accent`, `--bg`, or `--panel`. Measured: text 14.51:1, muted-on-bg 6.89:1, muted-on-panel 6.20:1, accent-on-panel 6.48:1, accent-on-field 6.01:1, muted-on-field 5.75:1, error-on-panel 6.17:1. All pass AA normal text.
- **`placeholder` is not an accessible name.** Every control needs a real `<label>` or `aria-label`.
- Run `npm test` and `npm run build` (`tsc --noEmit && vite build`) before every commit.
- The existing 273 tests must stay green throughout.

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/ui/a11y.ts` | Small shared helpers: `visuallyHiddenLabel`, `labelledControl`, `trapWithin`. No app logic. |
| `tests/ui/a11y.test.ts` | Conformance net: walks the mounted DOM asserting every control has an accessible name and every click target is a real control. |

**Modified:**

| File | Change |
| --- | --- |
| `src/ui/messages.ts` | Two persistent live regions (assertive for errors, polite for notices). |
| `src/ui/sequencePanel.ts` | Labelled inputs, ARIA tab pattern with roving tabindex + arrow keys, heading elements, announced status. |
| `src/ui/sweep.ts` | Overlay becomes `role="dialog"`; cells become `<button>`; Escape closes. |
| `src/ui/app.ts` | Skip link, `main` target, sweep focus management via the existing `setEngineInert`. |
| `src/style.css` | `.visually-hidden`, `.skip-link`, sweep-cell button reset. |

---

## Task 1: Message banners become live regions

The most serious defect in the audit. `showError` builds a plain `<div>` and appends it, so a failed OEIS lookup, a render error, or a b-file failure produces **no perceivable feedback whatsoever** for a screen-reader user. The app has an error-reporting system that is invisible to assistive technology.

**Files:**
- Modify: `src/ui/messages.ts`
- Test: `tests/ui/a11y.test.ts` (create)

**Interfaces:**
- Consumes: `initMessages(el)`, `showError(msg)`, `showNotice(msg)` - signatures unchanged.
- Produces: same three exports; `initMessages` now builds two child live regions inside the container it is given.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/a11y.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initMessages, showError, showNotice } from '../../src/ui/messages';

describe('message live regions', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    initMessages(container);
  });

  it('creates both live regions up front, before any message exists', () => {
    // A live region must be in the DOM *before* its content changes,
    // otherwise assistive technology has nothing subscribed to announce.
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('routes errors to the assertive region', () => {
    showError('lookup failed');
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('lookup failed');
  });

  it('routes notices to the polite region', () => {
    showNotice('needs more terms');
    const polite = container.querySelector('[aria-live="polite"]')!;
    expect(polite.textContent).toContain('needs more terms');
  });

  it('keeps the visible banner classes so styling is unchanged', () => {
    showError('boom');
    expect(container.querySelector('.banner.banner-error')).not.toBeNull();
    showNotice('hi');
    expect(container.querySelector('.banner.banner-notice')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/a11y.test.ts`
Expected: FAIL - no `[role="alert"]` element exists.

- [ ] **Step 3: Implement**

Replace `src/ui/messages.ts` entirely:

```ts
let assertive: HTMLElement | null = null;
let polite: HTMLElement | null = null;

function makeRegion(container: HTMLElement, assertiveRegion: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'message-region';
  if (assertiveRegion) {
    // role="alert" implies aria-live="assertive" + aria-atomic="true".
    // Errors interrupt deliberately: the user's action just failed.
    el.setAttribute('role', 'alert');
  } else {
    el.setAttribute('aria-live', 'polite');
  }
  container.appendChild(el);
  return el;
}

/**
 * Both regions are created here, empty, rather than when the first message
 * arrives. A live region has to exist in the DOM *before* its contents change
 * - assistive technology subscribes to the node, so one inserted already
 * populated is frequently not announced at all.
 */
export function initMessages(el: HTMLElement): void {
  el.replaceChildren();
  assertive = makeRegion(el, true);
  polite = makeRegion(el, false);
}

function banner(region: HTMLElement | null, msg: string, cls: string, ms: number): void {
  if (!region) return;
  const div = document.createElement('div');
  div.className = `banner ${cls}`;
  div.textContent = msg;
  region.appendChild(div);
  setTimeout(() => div.remove(), ms);
}

export function showError(msg: string): void { banner(assertive, msg, 'banner-error', 6000); }
export function showNotice(msg: string): void { banner(polite, msg, 'banner-notice', 4000); }
```

- [ ] **Step 4: Keep the stacking layout intact**

The container was previously the flex column holding banners directly; now it holds two region wrappers. Append to `src/style.css`:

```css
.message-region { display: flex; flex-direction: column; gap: 8px; }
.message-region:empty { display: none; }
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/messages.ts src/style.css tests/ui/a11y.test.ts
git commit -m "fix: error and notice banners are announced to assistive technology"
```

---

## Task 2: Shared accessibility helpers

**Files:**
- Create: `src/ui/a11y.ts`
- Modify: `src/style.css`
- Test: `tests/ui/a11y.test.ts`

**Interfaces:**
- Produces:
  - `labelledControl(labelText: string, control: HTMLElement, opts?: { visible?: boolean }): HTMLLabelElement`
  - `VISUALLY_HIDDEN = 'visually-hidden'`

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/a11y.test.ts`:

```ts
import { labelledControl } from '../../src/ui/a11y';

describe('labelledControl', () => {
  it('associates the label with the control by id', () => {
    const input = document.createElement('input');
    const label = labelledControl('OEIS A-number', input);
    expect(label.tagName).toBe('LABEL');
    expect(input.id).toBeTruthy();
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toContain('OEIS A-number');
  });

  it('hides the label text visually by default', () => {
    const label = labelledControl('Search', document.createElement('input'));
    expect(label.querySelector('.visually-hidden')).not.toBeNull();
  });

  it('can show the label text when the design has room for it', () => {
    const label = labelledControl('Bins', document.createElement('input'), { visible: true });
    expect(label.querySelector('.visually-hidden')).toBeNull();
  });

  it('generates unique ids across calls', () => {
    const a = document.createElement('input'), b = document.createElement('input');
    labelledControl('One', a);
    labelledControl('Two', b);
    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/a11y.test.ts -t labelledControl`
Expected: FAIL - module `src/ui/a11y` not found.

- [ ] **Step 3: Implement `src/ui/a11y.ts`**

```ts
export const VISUALLY_HIDDEN = 'visually-hidden';

let seq = 0;

/**
 * Wraps a control in a real <label>, associated by id.
 *
 * The sidebar's inputs previously carried only a `placeholder`, which is not
 * an accessible name: it vanishes as soon as the user types, and several
 * screen readers ignore it for naming entirely. The label text is
 * visually hidden by default so the compact sidebar layout is unchanged.
 */
export function labelledControl(
  labelText: string,
  control: HTMLElement,
  opts: { visible?: boolean } = {},
): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'a11y-field';
  if (!control.id) control.id = `f${++seq}`;
  label.htmlFor = control.id;

  const text = document.createElement('span');
  text.textContent = labelText;
  if (!opts.visible) text.className = VISUALLY_HIDDEN;

  label.append(text, control);
  return label;
}
```

- [ ] **Step 4: Add the visually-hidden utility**

Append to `src/style.css`:

```css
/* Removed from view but kept in the accessibility tree - not display:none,
   which would remove it from that tree too. */
.visually-hidden {
  position: absolute !important;
  width: 1px; height: 1px;
  margin: -1px; padding: 0; border: 0;
  clip-path: inset(50%);
  overflow: hidden; white-space: nowrap;
}
.a11y-field { display: contents; }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/ui/a11y.test.ts && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/a11y.ts src/style.css tests/ui/a11y.test.ts
git commit -m "feat: shared accessible-label helper and visually-hidden utility"
```

---

## Task 3: Label every sequence-panel control

**Files:**
- Modify: `src/ui/sequencePanel.ts`
- Test: `tests/ui/a11y.test.ts`

**Interfaces:**
- Consumes: `labelledControl` (Task 2).
- Produces: `buildSequencePanel` unchanged in signature.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/a11y.test.ts`:

```ts
import { buildSequencePanel } from '../../src/ui/sequencePanel';

/** The accessible name of a form control, by the rules that actually apply. */
function accessibleName(el: HTMLElement, root: ParentNode): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria;
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) return root.querySelector(`#${labelledby}`)?.textContent ?? '';
  if (el.id) {
    const forLabel = root.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
    if (forLabel) return forLabel.textContent ?? '';
  }
  return el.closest('label')?.textContent ?? '';
}

describe('sequence panel controls are all named', () => {
  it('every input, textarea and select has an accessible name', () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    document.body.appendChild(el);
    const controls = el.querySelectorAll<HTMLElement>('input, textarea, select');
    expect(controls.length).toBeGreaterThanOrEqual(5);
    for (const c of controls) {
      const name = accessibleName(c, el).trim();
      expect(name.length, `${c.tagName}.${c.className || '(no class)'} has no accessible name`).toBeGreaterThan(0);
    }
  });

  it('does not rely on placeholder as the name', () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    for (const c of el.querySelectorAll<HTMLInputElement>('input[placeholder]')) {
      expect(accessibleName(c, el).trim().length).toBeGreaterThan(0);
    }
  });

  it('every button has a non-empty accessible name', () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    for (const b of el.querySelectorAll<HTMLButtonElement>('button')) {
      const name = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
      expect(name.length, 'a button has no accessible name').toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/a11y.test.ts -t "all named"`
Expected: FAIL - the A-number, search, paste, formula and count controls have no name.

- [ ] **Step 3: Wrap each control**

In `src/ui/sequencePanel.ts`, add the import:

```ts
import { labelledControl } from './a11y';
```

A-number pane - replace `pane.append(input, btn);` with:

```ts
    input.setAttribute('inputmode', 'text');
    pane.append(labelledControl('OEIS A-number', input), btn);
```

Search pane - replace `pane.append(input, btn, status, results);` with:

```ts
    pane.append(labelledControl('Search OEIS by keyword', input), btn, status, results);
```

Custom pane - replace `pane.append(ta, pasteBtn, formula, formulaErr, count, formulaBtn);` with:

```ts
    pane.append(
      labelledControl('Paste sequence terms', ta),
      pasteBtn,
      labelledControl('Formula in n', formula),
      formulaErr,
      labelledControl('Number of terms to generate', count),
      formulaBtn,
    );
```

Info card b-file input - replace `info.append(btn, cap);` with:

```ts
      info.append(btn, labelledControl('Maximum terms to fetch', cap));
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ui/a11y.test.ts && npm test`
Expected: PASS. If an existing test in `tests/ui/ui.test.ts` queried an input by `pane.children[0]` or similar positional access, update it to a class/selector query - the label wrapper changes child positions.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sequencePanel.ts tests/ui/a11y.test.ts
git commit -m "fix: every sequence-panel control has a real label, not just a placeholder"
```

---

## Task 4: The WAI-ARIA tab pattern

The three tabs are plain `<button>`s: no `role`, no `aria-selected`, no `aria-controls`, and no arrow-key navigation. A screen reader announces three unrelated buttons and never says which pane is showing.

**Files:**
- Modify: `src/ui/sequencePanel.ts:23-43`
- Test: `tests/ui/a11y.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/a11y.test.ts`:

```ts
describe('sequence panel tabs follow the ARIA tab pattern', () => {
  const build = () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    document.body.appendChild(el);
    return el;
  };

  it('marks up a tablist with tabs and panels', () => {
    const el = build();
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();
    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(el.querySelectorAll('[role="tabpanel"]')).toHaveLength(3);
  });

  it('each tab points at the panel it controls', () => {
    const el = build();
    for (const tab of el.querySelectorAll<HTMLElement>('[role="tab"]')) {
      const panel = el.querySelector(`#${tab.getAttribute('aria-controls')}`);
      expect(panel, `tab "${tab.textContent}" controls nothing`).not.toBeNull();
      expect(panel!.getAttribute('aria-labelledby')).toBe(tab.id);
    }
  });

  it('exactly one tab is selected, and only it is in the tab order', () => {
    const el = build();
    const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    expect(tabs.filter((t) => t.tabIndex === -1)).toHaveLength(2);
  });

  it('ArrowRight moves selection to the next tab and wraps', () => {
    const el = build();
    const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')];
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    tabs[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    tabs[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('ArrowLeft wraps backwards, Home and End jump to the ends', () => {
    const el = build();
    const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')];
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true');
    tabs[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true');
  });

  it('selecting a tab shows exactly one panel', () => {
    const el = build();
    const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')];
    tabs[1]!.click();
    const visible = [...el.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((p) => !p.hidden);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.getAttribute('aria-labelledby')).toBe(tabs[1]!.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/a11y.test.ts -t "ARIA tab pattern"`
Expected: FAIL - no `[role="tablist"]`.

- [ ] **Step 3: Implement**

In `src/ui/sequencePanel.ts`, replace the whole `// --- tabs ---` block (from `el.appendChild(sectionLabel('Load a sequence'));` down to `el.appendChild(tabBar);`) with:

```ts
  // --- tabs (WAI-ARIA tab pattern) ---
  el.appendChild(sectionLabel('Load a sequence'));
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', 'How to load a sequence');

  const panes: Record<string, HTMLElement> = {};
  const tabNames = ['A-number', 'Search', 'Custom'];
  const tabs: HTMLButtonElement[] = [];

  function selectTab(index: number, moveFocus: boolean): void {
    tabNames.forEach((name, i) => {
      const chosen = i === index;
      const tab = tabs[i]!;
      tab.setAttribute('aria-selected', String(chosen));
      // Roving tabindex: only the selected tab is reachable by Tab, so the
      // tablist is one stop rather than three.
      tab.tabIndex = chosen ? 0 : -1;
      tab.classList.toggle('active', chosen);
      panes[name]!.hidden = !chosen;
    });
    if (moveFocus) tabs[index]!.focus();
  }

  tabNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-button';
    btn.type = 'button';
    btn.textContent = name;
    btn.id = `seqtab-${i}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', `seqpane-${i}`);
    btn.addEventListener('click', () => selectTab(i, false));
    btn.addEventListener('keydown', (e) => {
      const last = tabNames.length - 1;
      let next: number | null = null;
      if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = last;
      if (next === null) return;
      e.preventDefault();
      selectTab(next, true);
    });
    tabBar.appendChild(btn);
    tabs.push(btn);

    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.id = `seqpane-${i}`;
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', btn.id);
    // Focusable so a keyboard user can reach the panel's content directly
    // after the tablist, per the ARIA authoring practices.
    pane.tabIndex = 0;
    panes[name] = pane;
  });

  el.appendChild(tabBar);
  selectTab(0, false);
```

- [ ] **Step 4: Run tests**

Run: `npm test && npm run build`
Expected: PASS. `tests/ui/ui.test.ts` has tab-switching tests that click `.tab-button` - those still work, since the buttons keep that class and their click handlers.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sequencePanel.ts tests/ui/a11y.test.ts
git commit -m "fix: sequence panel tabs implement the ARIA tab pattern with arrow keys"
```

---

## Task 5: Heading structure and announced status

**Files:**
- Modify: `src/ui/sequencePanel.ts`
- Test: `tests/ui/a11y.test.ts`

**Interfaces:** no new exports.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/a11y.test.ts`:

```ts
describe('sequence panel structure and status', () => {
  const build = () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    document.body.appendChild(el);
    return el;
  };

  it('section labels are real headings', () => {
    const el = build();
    const headings = [...el.querySelectorAll('h2')].map((h) => h.textContent);
    expect(headings).toEqual(expect.arrayContaining(['Load a sequence', 'Gallery', 'Loaded']));
  });

  it('search status is a live region', () => {
    const el = build();
    const status = el.querySelector('.search-status')!;
    expect(status.getAttribute('role')).toBe('status');
  });

  it('formula errors are announced and mark the field invalid', () => {
    const el = build();
    const err = el.querySelector('.formula-error')!;
    expect(err.getAttribute('aria-live')).toBe('polite');

    const formula = el.querySelector<HTMLInputElement>('input[placeholder^="Formula"]')!;
    expect(formula.getAttribute('aria-describedby')).toBe(err.id);

    formula.value = 'n +';
    formula.dispatchEvent(new Event('input'));
    expect(formula.getAttribute('aria-invalid')).toBe('true');

    formula.value = 'n*n';
    formula.dispatchEvent(new Event('input'));
    expect(formula.getAttribute('aria-invalid')).toBe('false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/a11y.test.ts -t "structure and status"`
Expected: FAIL - `sectionLabel` returns a `<div>`.

- [ ] **Step 3: Implement**

In `src/ui/sequencePanel.ts`, replace `sectionLabel`:

```ts
  // A real heading, not a styled div: these are the only landmarks in the
  // sidebar, and without them there is no structure to navigate by.
  function sectionLabel(text: string): HTMLElement {
    const label = document.createElement('h2');
    label.className = 'section-label';
    label.textContent = text;
    return label;
  }
```

In the Search pane, after `status.className = 'search-status';` add:

```ts
    status.setAttribute('role', 'status');
```

and inside the `.then((hits) => …)` handler, immediately after `results.replaceChildren();` add:

```ts
          // Announce the outcome; without this a screen-reader user gets a
          // silently repopulated list and no indication anything happened.
          status.textContent = `${hits.length} match${hits.length === 1 ? '' : 'es'}`;
```

In the Custom pane, replace the formula error wiring:

```ts
    const formulaErr = document.createElement('div');
    formulaErr.className = 'formula-error';
    formulaErr.id = 'formula-error';
    formulaErr.setAttribute('aria-live', 'polite');
    formula.setAttribute('aria-describedby', formulaErr.id);
    formula.setAttribute('aria-invalid', 'false');
    formula.addEventListener('input', () => {
      const message = formula.value ? validateFormula(formula.value) ?? '' : '';
      formulaErr.textContent = message;
      formula.setAttribute('aria-invalid', String(message.length > 0));
    });
```

Note `formulaErr` must now be declared **before** the `formula.addEventListener` call it references - move the `const formulaErr` block above it if the existing order differs.

- [ ] **Step 4: Keep heading styling identical**

`.section-label` already sets `font-size: 11px`, `text-transform: uppercase` and margins, so an `h2` inherits the same look - but browsers apply a default `font-weight: bold` to headings. Append to `src/style.css`:

```css
.section-label { font-weight: 400; }
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/sequencePanel.ts src/style.css tests/ui/a11y.test.ts
git commit -m "fix: sidebar headings, announced search results, announced formula errors"
```

---

## Task 6: The sweep overlay becomes a dialog

The overlay covers the viewport, but the engine behind it stays in the tab order, there is no `role`, Escape does nothing, and each thumbnail is a `<figure>` with a click handler - not focusable, not announced as interactive. Same defect class as the gallery thumbnails fixed in round 1.

**Files:**
- Modify: `src/ui/sweep.ts`
- Modify: `src/ui/app.ts` (focus management around open/close)
- Modify: `src/style.css`
- Test: `tests/ui/sweep.test.ts`

**Interfaces:**
- Consumes: `buildSweepView(opts)` - signature unchanged.
- Produces: overlay element now exposes `role="dialog"` and its cells are `<button class="sweep-cell">`.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/sweep.test.ts`:

```ts
import { buildSweepView } from '../../src/ui/sweep';
import { turtleViz } from '../../src/viz/turtle';
import { defaultParams } from '../../src/viz/types';
import type { Sequence } from '../../src/sequence/sequence';

const seq: Sequence = {
  terms: Array.from({ length: 40 }, (_, i) => BigInt(i % 5)),
  name: 't', offset: 0, source: 'paste',
};

const mkSweep = (onPick = () => {}, onClose = () => {}) =>
  buildSweepView({
    seq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
    paramId: 'k', count: 6, onPick, onClose,
  });

describe('sweep overlay accessibility', () => {
  it('is a labelled modal dialog', () => {
    const el = mkSweep();
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.getAttribute('aria-label')).toMatch(/sweep/i);
  });

  it('every cell is a button with a name describing its value', () => {
    const el = mkSweep();
    const cells = el.querySelectorAll<HTMLButtonElement>('.sweep-cell');
    expect(cells.length).toBeGreaterThan(1);
    for (const c of cells) {
      expect(c.tagName).toBe('BUTTON');
      expect((c.textContent ?? '').trim()).toMatch(/k = \d+/);
    }
  });

  it('picking a cell reports its value and closes', () => {
    const picked: number[] = [];
    let closed = 0;
    const el = mkSweep((v: number) => picked.push(v), () => { closed++; });
    el.querySelector<HTMLButtonElement>('.sweep-cell')!.click();
    expect(picked).toHaveLength(1);
    expect(closed).toBe(1);
  });

  it('Escape closes the dialog', () => {
    let closed = 0;
    const el = mkSweep(() => {}, () => { closed++; });
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(1);
  });

  it('hides the decorative thumbnails from assistive technology', () => {
    // The button's own text carries the meaning; the canvas would otherwise
    // announce as an unlabelled graphic per cell.
    const el = mkSweep();
    for (const c of el.querySelectorAll('canvas')) {
      expect(c.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/sweep.test.ts -t accessibility`
Expected: FAIL - overlay has no `role`.

- [ ] **Step 3: Implement in `src/ui/sweep.ts`**

Replace the body of `buildSweepView` below the `spec` check:

```ts
  const overlay = document.createElement('div');
  overlay.className = 'sweep-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Parameter sweep over ${opts.paramId}`);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); opts.onClose(); }
  });

  const close = document.createElement('button');
  close.className = 'sweep-close';
  close.type = 'button';
  close.textContent = '× close';
  close.addEventListener('click', opts.onClose);
  overlay.appendChild(close);

  const grid = document.createElement('div');
  grid.className = 'sweep-grid';
  overlay.appendChild(grid);

  const view = new SequenceView(opts.seq);
  for (const value of sweepValues(spec, opts.count)) {
    // A <button>, not a <figure> with a click handler: the cells are the
    // whole point of this view and were unreachable by keyboard.
    const cell = document.createElement('button');
    cell.className = 'sweep-cell';
    cell.type = 'button';
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 140;
    // Decorative here - the caption below carries the meaning.
    canvas.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span');
    caption.className = 'sweep-caption';
    caption.textContent = `${opts.paramId} = ${value}`;
    cell.append(canvas, caption);
    cell.addEventListener('click', () => { opts.onPick(value); opts.onClose(); });
    grid.appendChild(cell);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#14161a';
      ctx.fillRect(0, 0, 180, 140);
      try {
        opts.viz.render(view, { ...opts.baseParams, [opts.paramId]: value }, ctx, { width: 180, height: 140 });
      } catch { /* a thumbnail failing must not break the grid */ }
    }
  }
  return overlay;
```

- [ ] **Step 4: Restyle the cell as a button**

In `src/style.css`, replace the `.sweep-cell` rules with:

```css
.sweep-cell {
  margin: 0; cursor: pointer; background: var(--panel);
  border: 1px solid #333; border-radius: 6px; padding: 6px;
  display: flex; flex-direction: column; color: inherit; font: inherit;
}
.sweep-cell:hover { border-color: var(--accent); }
.sweep-caption { color: var(--muted); font-size: 12px; text-align: center; padding-top: 4px; }
```

(The old `.sweep-cell figcaption` selector no longer matches anything - remove it.)

- [ ] **Step 5: Manage focus in `app.ts`**

In the sweep button handler in `src/ui/app.ts`, replace the `const overlay = buildSweepView({…}); root.appendChild(overlay);` block with:

```ts
    // Remember where focus came from so it can be restored on close - losing
    // focus to <body> after a dialog closes strands keyboard users.
    const opener = document.activeElement as HTMLElement | null;
    const overlay = buildSweepView({
      seq: state.seq, viz: getVisualizer(state.vizId), baseParams: { ...state.params },
      paramId, count: 12,
      onPick(value) { state.params[paramId] = value; rebuildParams(); redraw(); },
      onClose() {
        overlay.remove();
        setEngineInert(false);
        opener?.focus();
      },
    });
    root.appendChild(overlay);
    // Same trick the landing uses: everything behind the dialog leaves the
    // tab order and the accessibility tree, which is a focus trap without
    // hand-rolling one.
    setEngineInert(true);
    overlay.querySelector<HTMLButtonElement>('.sweep-close')?.focus();
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/sweep.ts src/ui/app.ts src/style.css tests/ui/sweep.test.ts
git commit -m "fix: sweep overlay is a focus-managed dialog with keyboard-reachable cells"
```

---

## Task 7: Skip link

The sidebar puts roughly twenty preset buttons plus the whole load panel ahead of the visualizer. A keyboard user tabs through all of it on every page load to reach the actual tool.

**Files:**
- Modify: `src/ui/app.ts`
- Modify: `src/style.css`
- Test: `tests/ui/a11y.test.ts`

**Interfaces:** no new exports.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/a11y.test.ts`:

```ts
import { mountApp } from '../../src/ui/app';

describe('skip link', () => {
  it('is the first focusable element and targets the main region', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);

    const skip = root.querySelector<HTMLAnchorElement>('.skip-link');
    expect(skip, 'no skip link').not.toBeNull();
    expect(root.firstElementChild).toBe(skip);

    const target = root.querySelector(skip!.getAttribute('href')!);
    expect(target, 'skip link points at nothing').not.toBeNull();
    // Must be focusable, or the browser moves the viewport without moving focus.
    expect((target as HTMLElement).tabIndex).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/a11y.test.ts -t "skip link"`
Expected: FAIL - no `.skip-link`.

- [ ] **Step 3: Implement**

In `src/ui/app.ts`, immediately after `root.replaceChildren();` insert:

```ts
  // First thing in the DOM so it is the first Tab stop: the sidebar puts
  // ~20 preset buttons ahead of the visualizer otherwise.
  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = '#main-view';
  skip.textContent = 'Skip to the visualization';
  root.appendChild(skip);
```

and where `main` is created, add:

```ts
  main.id = 'main-view';
  // -1 rather than 0: reachable as a skip target without adding a Tab stop.
  main.tabIndex = -1;
```

- [ ] **Step 4: Style it**

Append to `src/style.css`:

```css
.skip-link {
  position: absolute; left: 8px; top: -60px; z-index: 40;
  background: var(--accent); color: #14161a;
  padding: 8px 14px; border-radius: 0 0 6px 6px;
  text-decoration: none; font-weight: 600;
  transition: top 0.15s;
}
.skip-link:focus { top: 0; }
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/app.ts src/style.css tests/ui/a11y.test.ts
git commit -m "feat: skip link past the sidebar to the visualization"
```

---

## Task 8: Conformance net and verification

**Files:**
- Modify: `tests/ui/a11y.test.ts`
- Modify: `README.md`

**Interfaces:** no new exports.

- [ ] **Step 1: Write the whole-app conformance test**

Append to `tests/ui/a11y.test.ts`:

```ts
describe('whole-app accessibility conformance', () => {
  const mount = () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    return root;
  };

  it('every control in the mounted app has an accessible name', () => {
    const root = mount();
    for (const c of root.querySelectorAll<HTMLElement>('input, textarea, select')) {
      expect(accessibleName(c, root).trim().length, `${c.className} unnamed`).toBeGreaterThan(0);
    }
    for (const b of root.querySelectorAll<HTMLButtonElement>('button')) {
      const name = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
      expect(name.length, `button.${b.className} unnamed`).toBeGreaterThan(0);
    }
  });

  it('uses no positive tabindex anywhere', () => {
    // A positive tabindex reorders the whole document's tab sequence and is
    // almost always a bug.
    const root = mount();
    for (const el of root.querySelectorAll<HTMLElement>('[tabindex]')) {
      expect(el.tabIndex, `${el.className} has a positive tabindex`).toBeLessThanOrEqual(0);
    }
  });

  it('has no click handlers on non-interactive elements', () => {
    // Enforced structurally: every element carrying our click-target classes
    // must be a real button or link.
    const root = mount();
    for (const sel of ['.gallery-thumb', '.preset-button', '.tab-button', '.sweep-cell']) {
      for (const el of root.querySelectorAll(sel)) {
        expect(['BUTTON', 'A'], `${sel} is a ${el.tagName}`).toContain(el.tagName);
      }
    }
  });

  it('exposes exactly one live region of each urgency', () => {
    const root = mount();
    expect(root.querySelectorAll('.messages [role="alert"]')).toHaveLength(1);
    expect(root.querySelectorAll('.messages [aria-live="polite"]')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Keyboard walkthrough in a real browser**

Run `npm run dev` and verify by keyboard only, without touching the mouse:

1. Load `/`, press Tab once - the skip link appears at the top-left.
2. From the landing, Tab reaches the hero button, then each thumbnail, then "Open the full engine"; Tab never escapes into the engine behind.
3. In the engine, Tab once and activate the skip link - focus lands on the visualization region.
4. Tab to the sidebar tablist: it is a single stop; Left/Right arrows switch panes; Home/End jump to the ends.
5. Trigger a failure (load A-number `zzz`) - confirm a red banner appears inside the `role="alert"` region.
6. Open Sweep - focus lands on "× close"; Tab cycles only within the dialog; Escape closes it and focus returns to the Sweep button.
7. Every focused element shows a visible focus ring.

- [ ] **Step 4: Document conformance in the README**

Add a section after "Attribution and licensing":

```markdown
## Accessibility

The interface targets **WCAG 2.1 AA / Section 508**. Specifics:

- Every control has a programmatic label; `placeholder` is never used as an
  accessible name.
- The sequence-panel tabs implement the WAI-ARIA tab pattern with roving
  tabindex and arrow-key navigation.
- Errors and notices are delivered through persistent live regions - an
  assertive one for errors, a polite one for notices - created at startup
  rather than when the first message arrives.
- The landing overlay and the sweep dialog mark everything behind them
  `inert`, which removes it from both the tab order and the accessibility
  tree; focus is moved in on open and restored to the opener on close.
- A skip link bypasses the sidebar, which otherwise puts ~20 preset buttons
  ahead of the visualization.
- Canvases carry `role="img"` and a description drawn from the visualizer's
  own `explain.long` text; decorative thumbnails are `aria-hidden`.
- `prefers-reduced-motion` is honoured; nothing auto-animates.
- Colour contrast was measured across every foreground/background pair in the
  theme: the lowest is 5.75:1, against a 4.5:1 AA threshold for normal text.

`tests/ui/a11y.test.ts` enforces the structural half of this - accessible
names, no positive tabindex, no click handlers on non-interactive elements,
and exactly one live region of each urgency.

Not yet covered: the canvas renderings themselves convey information visually
that has no textual equivalent beyond the cursor readout and the
`explain.long` description. A tabular view of the underlying terms is the
obvious next step.
```

- [ ] **Step 5: Commit and push**

```bash
git add tests/ui/a11y.test.ts README.md
git commit -m "test: whole-app accessibility conformance net, and document the standard"
git push origin master
```

---

## Self-Review Notes

**Audit coverage check:**

| Audit finding | Task |
| --- | --- |
| 1. Banners announced to nobody | 1 |
| 2. Six unlabelled inputs | 2, 3 |
| 3. Tabs aren't tabs | 4 |
| 4. Sweep cells are clickable `<figure>`s | 6 |
| 5. Sweep overlay isn't a dialog | 6 |
| 6. No skip link | 7 |
| 7. Search status never announced | 5 |
| 8. Formula errors silent | 5 |
| 9. Section labels aren't headings | 5 |
| Contrast | none needed - measured conformant |

**Known risk:** Task 3 wraps controls in `<label>` elements, which changes the
child ordering inside each pane. Any existing test that reaches a control by
positional index rather than by selector will break. That is expected; fix by
switching the query to a class or attribute selector, not by removing the
label.

**Deliberately out of scope:** the `window.prompt` used to choose which
parameter to sweep (`src/ui/app.ts`). It is a native dialog and therefore
technically accessible, but it is a poor pattern and untestable. Replacing it
with a real control belongs with round 3's UI work, not with a conformance
pass.
