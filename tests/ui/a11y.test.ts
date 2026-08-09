// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initMessages, showError, showNotice } from '../../src/ui/messages';
import { labelledControl } from '../../src/ui/a11y';
import { buildSequencePanel } from '../../src/ui/sequencePanel';
import { mountApp } from '../../src/ui/app';

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

describe('skip link', () => {
  it('is the first focusable element and targets the main region', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);

    const skip = root.querySelector<HTMLAnchorElement>('.skip-link');
    expect(skip, 'no skip link').not.toBeNull();
    expect(root.firstElementChild).toBe(skip);

    const target = root.querySelector<HTMLElement>('main.main');
    expect(target, 'skip link points at nothing').not.toBeNull();
    expect(skip!.getAttribute('href')).toBe(`#${target!.id}`);
    // Must be focusable, or the browser scrolls without moving focus.
    expect(target!.tabIndex).toBe(-1);
  });
});

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

  it('routes every click target through a real interactive element', () => {
    const root = mount();
    for (const sel of ['.gallery-thumb', '.preset-button', '.tab-button', '.landing-open', '.landing-hero-button']) {
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

describe('modal layers contain focus completely', () => {
  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const reachable = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]'));

  it('nothing outside the landing is reachable while it is up', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    expect(root.querySelector('.landing')).not.toBeNull();
    const escapees = reachable(root).filter((el) => !el.closest('.landing'));
    expect(escapees.map((e) => e.className), 'focusable outside the landing').toEqual([]);
  });

  it('nothing outside the sweep dialog is reachable while it is open', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')!.click();

    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    picker.value = 'turtle';
    picker.dispatchEvent(new Event('change'));
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent === 'Sweep…')!.click();

    expect(root.querySelector('.sweep-overlay')).not.toBeNull();
    const escapees = reachable(root).filter((el) => !el.closest('.sweep-overlay'));
    expect(escapees.map((e) => e.className), 'focusable outside the sweep dialog').toEqual([]);
  });
});

describe('#gallery is a working link, not just a startup route', () => {
  it('reopens the landing after it has been dismissed', () => {
    // jsdom shares one location across the file; a prior test's engine hash
    // would otherwise mean the landing never mounts here in the first place.
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);

    root.querySelector<HTMLButtonElement>('.landing-open')!.click();
    expect(root.querySelector('.landing')).toBeNull();

    // Same-document navigation to the reserved hash must bring it back.
    location.hash = '#gallery';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(root.querySelector('.landing')).not.toBeNull();
  });
});

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

  it('the table toggle reports and flips its expanded state', () => {
    const root = mountEngine();
    const toggle = root.querySelector<HTMLButtonElement>('.table-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const panel = root.querySelector<HTMLElement>('.data-table')!;
    expect(toggle.getAttribute('aria-controls')).toBe(panel.id);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
  });
});

describe('panel labels identify the sequence', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('names the sequence and its term count in the canvas description', () => {
    // jsdom has no 2D context, so this also pins that the description is set
    // before the context guard -- it is state, not rendering.
    const root = mountEngine();
    const label = root.querySelector('canvas')!.getAttribute('aria-label') ?? '';
    expect(label).toContain('A000002');
    expect(label).toMatch(/\d[\d,.\s]* terms/);
    expect(label).toContain('Turtle walk');
  });
});

describe('null model toggle', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('surfaces the null model as a pressed-state toggle', () => {
    const root = mountEngine();
    const t = root.querySelector<HTMLButtonElement>('.null-toggle')!;
    expect(t, 'no null toggle').not.toBeNull();
    expect(t.getAttribute('aria-pressed')).toBeTruthy();
    expect(t.textContent).toMatch(/null model/i);
  });

  it('remembers which comparison you were using', () => {
    // Turning the null off and on again should resume, not reset to a default.
    const root = mountEngine();
    const mode = root.querySelector<HTMLSelectElement>('.mode-select')!;
    const toggle = root.querySelector<HTMLButtonElement>('.null-toggle')!;

    mode.value = 'flip';
    mode.dispatchEvent(new Event('change'));
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    expect(mode.value).toBe('off');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    expect(mode.value).toBe('flip');
  });

  it('starts off, matching the default comparison state', () => {
    const root = mountEngine();
    const toggle = root.querySelector<HTMLButtonElement>('.null-toggle')!;
    const mode = root.querySelector<HTMLSelectElement>('.mode-select')!;
    // The gallery hero opens in side mode, so read the pair rather than
    // assuming: whatever the mode is, the toggle must agree with it.
    expect(toggle.getAttribute('aria-pressed')).toBe(String(mode.value !== 'off'));
  });
});

describe('footer contact', () => {
  it('offers a mailto link assembled at runtime', () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    const link = root.querySelector<HTMLAnchorElement>('.contact-link')!;
    expect(link, 'no contact link').not.toBeNull();
    expect(link.getAttribute('href')).toBe('mailto:bshepp@gmail.com');
  });
});

describe('style panel placement', () => {
  it('is the last thing in the topbar, so it cannot split the controls', () => {
    // .style-controls is flex-basis:100%, so it claims a whole row wherever it
    // sits. Appended earlier it wrapped between the visualizer picker and the
    // (i) button, pushing the parameter sliders onto a third row.
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    const topbar = root.querySelector('.topbar')!;
    expect(topbar.lastElementChild).toBe(topbar.querySelector('.style-controls'));
  });

  it('the toggle controls it and reports its state', () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    const toggle = root.querySelector<HTMLButtonElement>('.style-toggle')!;
    const panel = root.querySelector<HTMLElement>('.style-controls')!;
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(panel.id);
    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('bookmark affordance', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('offers a bookmark button in the export bar', () => {
    const root = mountEngine();
    const b = root.querySelector<HTMLButtonElement>('.bookmark-hint');
    expect(b, 'no bookmark button').not.toBeNull();
    expect(b!.tagName).toBe('BUTTON');
  });

  it('tells you the shortcut rather than pretending to bookmark', () => {
    // No browser exposes an API to write a bookmark; the IE and Firefox ones
    // were removed and never replaced. A button that silently did nothing
    // would be worse than no button.
    const root = mountEngine();
    root.querySelector<HTMLButtonElement>('.bookmark-hint')!.click();
    const region = root.querySelector('.messages [aria-live="polite"]')!;
    expect(region.textContent).toMatch(/\+D/);
    expect(region.textContent).toMatch(/bookmark/i);
  });
});
