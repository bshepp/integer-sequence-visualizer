// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initMessages, showError, showNotice } from '../../src/ui/messages';
import { labelledControl } from '../../src/ui/a11y';
import { buildSequencePanel } from '../../src/ui/sequencePanel';

describe('message live regions', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'messages';
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

/** The accessible name of a form control, by the rules that actually apply. */
export function accessibleName(el: HTMLElement, root: ParentNode): string {
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
    expect(el.querySelector('.search-status')!.getAttribute('role')).toBe('status');
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
    expect(err.textContent!.length).toBeGreaterThan(0);

    formula.value = 'n*n';
    formula.dispatchEvent(new Event('input'));
    expect(formula.getAttribute('aria-invalid')).toBe('false');
    expect(err.textContent).toBe('');
  });
});
