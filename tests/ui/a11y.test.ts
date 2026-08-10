// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initMessages, showError, showNotice } from '../../src/ui/messages';
import { labelledControl } from '../../src/ui/a11y';
import { buildSequencePanel } from '../../src/ui/sequencePanel';
import { mountApp } from '../../src/ui/app';
import { encodeState, decodeState } from '../../src/ui/urlState';
import { DEFAULT_STYLE } from '../../src/viz/style';

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
    expect(headings).toEqual(expect.arrayContaining(['Load a sequence', 'Presets', 'Loaded']));
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
    for (const sel of ['.example-thumb', '.preset-button', '.tab-button', '.landing-open', '.landing-hero-button']) {
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

describe('#examples is a working link, not just a startup route', () => {
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
    // Deliberately the real reserved word: an unrecognised hash also lands
    // here by falling through decodeState, so testing #gallery after the
    // rename would have passed without exercising the route at all.
    location.hash = '#examples';
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
    // A list, not a single id: the button opens this panel and the null
    // one that now lives under the comparison bar.
    expect(toggle.getAttribute('aria-controls')!.split(/\s+/)).toContain(panel.id);
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
    // .style-panels is flex-basis:100%, so it claims a whole row wherever it
    // sits. Appended earlier it wrapped between the visualizer picker and the
    // (i) button, pushing the parameter sliders onto a third row.
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    const topbar = root.querySelector('.topbar')!;
    expect(topbar.lastElementChild).toBe(topbar.querySelector('.style-panels'));
  });

  it('the toggle controls it and reports its state', () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    const toggle = root.querySelector<HTMLButtonElement>('.style-toggle')!;
    const panel = root.querySelector<HTMLElement>('.style-panels')!;
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // A list, not a single id: the button opens this panel and the null
    // one that now lives under the comparison bar.
    expect(toggle.getAttribute('aria-controls')!.split(/\s+/)).toContain(panel.id);
    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('the shareable-address hint', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('offers no bookmark button, because no browser exposes an API for it', () => {
    // window.external.AddFavorite and window.sidebar.addPanel were both removed
    // years ago and never replaced. A button that silently did nothing would be
    // worse than none.
    expect(mountEngine().querySelector('.bookmark-hint')).toBeNull();
  });

  it('stays quiet while the app is only doing its own navigation', () => {
    // Opening a gallery entry changes the address, but the reader did not do
    // it and did not watch it happen, so saying so then teaches nothing.
    localStorage.removeItem('ulam-share-hint');
    const root = mountEngine();
    expect(root.querySelector('.messages [aria-live="polite"]')!.textContent).toBe('');
  });

  it('says it once when the reader first changes something, then never again', () => {
    localStorage.removeItem('ulam-share-hint');
    const root = mountEngine();
    const polite = () => root.querySelector('.messages [aria-live="polite"]')!.textContent ?? '';

    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    picker.value = 'scatter';
    picker.dispatchEvent(new Event('change'));
    expect(polite()).toMatch(/address bar/i);

    // Second change, same session: silent.
    root.querySelector('.messages [aria-live="polite"]')!.textContent = '';
    picker.value = 'histogram';
    picker.dispatchEvent(new Event('change'));
    expect(polite()).toBe('');
  });

  it('stays silent for someone who has already been told', () => {
    localStorage.setItem('ulam-share-hint', '1');
    const root = mountEngine();
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    picker.value = 'scatter';
    picker.dispatchEvent(new Event('change'));
    expect(root.querySelector('.messages [aria-live="polite"]')!.textContent).toBe('');
  });
});

describe('unlinking the null model style', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('starts linked, with a single unlabelled style panel', () => {
    const root = mountEngine();
    const link = root.querySelector<HTMLButtonElement>('.link-toggle')!;
    expect(link, 'no link toggle').not.toBeNull();
    expect(link.getAttribute('aria-pressed')).toBe('false');
    expect(link.textContent).toMatch(/linked/i);
    const groups = [...root.querySelectorAll<HTMLElement>('.style-group')];
    expect(groups).toHaveLength(2);
    expect(groups[1]!.hidden, 'null panel should be hidden while linked').toBe(true);
  });

  it('reveals a second panel when unlinked, and opens it', () => {
    const root = mountEngine();
    root.querySelector<HTMLButtonElement>('.link-toggle')!.click();
    const groups = [...root.querySelectorAll<HTMLElement>('.style-group')];
    expect(groups[1]!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('.style-panels')!.hidden).toBe(false);
    expect(root.querySelector('.style-panels')!.classList.contains('style-panels--split')).toBe(true);
  });

  it('carries the separate style through a share link, and linked state omits it', () => {
    const linked = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1,
    });
    expect(linked).not.toContain('unlink');
    expect(decodeState(linked)!.nullStyle).toBeUndefined();

    const split = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1,
      nullStyle: { ...DEFAULT_STYLE, colorMode: 'none', lineWidth: 4 },
    });
    expect(split).toContain('unlink=1');
    expect(split).toContain('null.colour=none');
    expect(split).toContain('null.line=4');
    const back = decodeState(split)!;
    expect(back.nullStyle!.colorMode).toBe('none');
    expect(back.nullStyle!.lineWidth).toBe(4);
    // The null's keys must not leak into the visualizer's parameters.
    expect(back.params['null.colour']).toBeUndefined();
    expect(back.params['null.line']).toBeUndefined();
  });

  it('survives unlinking with everything still at its default', () => {
    // No null.* keys are emitted in that case, so the flag is what carries it.
    const url = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1, nullStyle: { ...DEFAULT_STYLE },
    });
    expect(url).toContain('unlink=1');
    expect(decodeState(url)!.nullStyle).toEqual(DEFAULT_STYLE);
  });
});

describe('reshuffling the null model', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('sits beside the seed and advances it, so the redraw stays reproducible', () => {
    const root = mountEngine();
    const btn = root.querySelector<HTMLButtonElement>('.reshuffle-button')!;
    const seed = root.querySelector<HTMLInputElement>('.seed-input')!;
    expect(btn, 'no reshuffle button').not.toBeNull();
    const before = Number(seed.value);
    btn.click();
    expect(Number(seed.value)).toBe(before + 1);
    btn.click();
    expect(Number(seed.value)).toBe(before + 2);
  });

  it('is unavailable while the null model is off, like the seed it drives', () => {
    const root = mountEngine();
    const btn = root.querySelector<HTMLButtonElement>('.reshuffle-button')!;
    const seed = root.querySelector<HTMLInputElement>('.seed-input')!;
    // The engine opens with the null model on, which is the point of the app.
    expect(btn.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('.null-toggle')!.click();
    expect(btn.disabled, 'nothing to reshuffle with the null off').toBe(true);
    expect(seed.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('.null-toggle')!.click();
    expect(btn.disabled).toBe(false);
  });

  it('does not call a matched surrogate a shuffle, because it is not one', () => {
    const root = mountEngine();
    const btn = root.querySelector<HTMLButtonElement>('.reshuffle-button')!;
    const surr = root.querySelector<HTMLSelectElement>('.surrogate-select')!;
    expect(btn.textContent).toBe('Reshuffle');
    surr.value = 'matched';
    surr.dispatchEvent(new Event('change', { bubbles: true }));
    expect(btn.textContent).toBe('Redraw');
    surr.value = 'permutation';
    surr.dispatchEvent(new Event('change', { bubbles: true }));
    expect(btn.textContent).toBe('Reshuffle');
  });
});

describe('label and black-line style toggles', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('labels default on, black lines default off', () => {
    const root = mountEngine();
    expect(root.querySelector<HTMLInputElement>('.style-labels')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('.style-black')!.checked).toBe(false);
  });

  it('black lines disable the colour controls they override', () => {
    // Three live-looking controls that cannot change anything is the defect
    // already fixed twice elsewhere; black must not reintroduce it.
    const root = mountEngine();
    const black = root.querySelector<HTMLInputElement>('.style-black')!;
    const mode = root.querySelector<HTMLSelectElement>('.style-colormode')!;
    expect(mode.disabled).toBe(false);
    black.click();
    expect(mode.disabled).toBe(true);
    expect(root.querySelector<HTMLInputElement>('.style-hue-start')!.disabled).toBe(true);
    black.click();
    expect(mode.disabled).toBe(false);
  });

  it('both survive a share link, and defaults stay out of it', () => {
    const plain = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'off',
      surrogate: 'permutation', seed: 1, style: { ...DEFAULT_STYLE },
    });
    expect(plain).not.toContain('nolabels');
    expect(plain).not.toContain('black');

    const set = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'off',
      surrogate: 'permutation', seed: 1,
      style: { ...DEFAULT_STYLE, showLabels: false, blackLine: true },
    });
    expect(set).toContain('nolabels=1');
    expect(set).toContain('black=1');
    const back = decodeState(set)!.style!;
    expect(back.showLabels).toBe(false);
    expect(back.blackLine).toBe(true);
  });
});

describe('per-panel canvas in the address', () => {
  it('stays out of a default view but survives when set, per panel', () => {
    const plain = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1, style: { ...DEFAULT_STYLE },
    });
    expect(plain).not.toContain('canvas');

    const split = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1,
      style: { ...DEFAULT_STYLE, canvas: 'white' },
      // 'theme' rather than 'black': black is the default now, so it is the
      // one value the encoder is supposed to leave out.
      nullStyle: { ...DEFAULT_STYLE, canvas: 'theme' },
    });
    expect(split).toContain('canvas=white');
    expect(split).toContain('null.canvas=theme');
    const back = decodeState(split)!;
    expect(back.style!.canvas).toBe('white');
    expect(back.nullStyle!.canvas).toBe('theme');
    // The namespaced key must not leak into the visualizer's parameters.
    expect(back.params['null.canvas']).toBeUndefined();
  });

  it('falls back to the default for a malformed value, never passes it through', () => {
    // The failure this guards is a garbage value reaching withCanvas, where
    // anything that is not 'theme' or 'white' resolves to black by accident
    // rather than by decision.
    const back = decodeState('viz=turtle&canvas=chartreuse')!;
    const c = back.style?.canvas ?? DEFAULT_STYLE.canvas;
    expect(c).toBe(DEFAULT_STYLE.canvas);
    expect(['theme', 'white', 'black']).toContain(c);
  });
});

describe('the null style panel sits with the null model controls', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('comes after the comparison bar in the document, not up in the topbar', () => {
    // Grouped by what the control belongs to rather than what kind of control
    // it is: everything shaping the null should read as one block.
    const root = mountEngine();
    const bar = root.querySelector('.comparison-bar')!;
    const nullPanel = root.querySelector('.style-panels--null')!;
    expect(nullPanel, 'no relocated null style panel').not.toBeNull();
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(bar.compareDocumentPosition(nullPanel) & 4).toBeTruthy();
    // And the real one is still in the topbar.
    const real = root.querySelector('.style-panels:not(.style-panels--null)')!;
    expect(real.closest('.topbar')).not.toBeNull();
    expect(nullPanel.closest('.topbar')).toBeNull();
  });

  it('is never visible while the styles are linked', () => {
    const root = mountEngine();
    const top = root.querySelector<HTMLElement>('.style-panels:not(.style-panels--null)')!;
    const nul = root.querySelector<HTMLElement>('.style-panels--null')!;
    const style = root.querySelector<HTMLButtonElement>('.style-toggle')!;
    const link = root.querySelector<HTMLButtonElement>('.link-toggle')!;

    style.click();                       // open, still linked
    expect(top.hidden).toBe(false);
    expect(nul.hidden, 'null panel showing while linked').toBe(true);

    link.click();                        // unlink
    expect(nul.hidden).toBe(false);
    link.click();                        // relink
    expect(nul.hidden).toBe(true);
    expect(top.hidden).toBe(false);
  });

  it('is governed by the same Style button, which says so', () => {
    const root = mountEngine();
    const top = root.querySelector<HTMLElement>('.style-panels:not(.style-panels--null)')!;
    const nul = root.querySelector<HTMLElement>('.style-panels--null')!;
    const style = root.querySelector<HTMLButtonElement>('.style-toggle')!;
    root.querySelector<HTMLButtonElement>('.link-toggle')!.click();  // unlink (auto-opens)
    expect(top.hidden).toBe(false);
    expect(nul.hidden).toBe(false);
    style.click();                       // close both
    expect(top.hidden).toBe(true);
    expect(nul.hidden, 'null panel left behind when the panel closed').toBe(true);

    // A control governing two regions has to name both.
    const controls = style.getAttribute('aria-controls')!.split(/\s+/);
    expect(controls).toHaveLength(2);
    for (const id of controls) expect(root.querySelector(`#${id}`), id).not.toBeNull();
  });
});

import { readFileSync as readCss } from 'node:fs';
import { resolve as resolveCss } from 'node:path';

describe('the relocated null style panel cannot collapse the canvas', () => {
  // Asserted against the stylesheet rather than the DOM because jsdom has no
  // layout engine: the failure is purely geometric and no rendered assertion
  // here can see it. It is worth pinning anyway because the symptom is severe
  // and the cause is invisible on reading - .style-panels sets flex-basis:100%
  // for the topbar, which is a flex ROW, and the relocated copy lives in .main,
  // which is a flex COLUMN. There the same declaration claims the full HEIGHT,
  // which swallowed the column and collapsed the canvas wrapper to 0px: both
  // drawings vanished the moment the styles were unlinked.
  // Comments stripped first. The block below explains itself in prose that
  // contains the literal "flex:none", so matching the raw file made the
  // assertion pass against its own comment - it stayed green with the
  // declaration deleted, which was checked by deleting it.
  const css = readCss(resolveCss(__dirname, '../../src/style.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  it('the shared class still sets flex-basis, so the override is still needed', () => {
    const shared = /\.style-panels\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(shared, 'expected .style-panels to exist').not.toBe('');
    expect(shared).toMatch(/flex-basis:\s*100%/);
  });

  it('the null copy overrides it', () => {
    const scoped = /\.style-panels--null\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(scoped, 'expected .style-panels--null to exist').not.toBe('');
    expect(scoped, 'null style panel must not inherit flex-basis:100% in a column')
      .toMatch(/flex:\s*none/);
  });

  it('.main is a column, which is what makes the override necessary', () => {
    const main = /\.main\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(main).toMatch(/flex-direction:\s*column/);
  });
});

describe('the null model has its own (i)', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };

  it('sits between the on/off switch and the style toggle', () => {
    const root = mountEngine();
    const bar = root.querySelector('.comparison-bar')!;
    const kids = [...bar.children].map((c) => c.className.split(' ')[0]);
    expect(kids.slice(0, 3)).toEqual(['null-toggle', 'explain-button', 'link-toggle']);
  });

  it('explains the null model and names the surrogate in play', () => {
    const root = mountEngine();
    root.querySelector<HTMLButtonElement>('.comparison-bar .explain-button')!.click();
    const panel = root.querySelector<HTMLElement>('.explain-panel')!;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('.explain-title')!.textContent).toMatch(/null model/i);
    const body = panel.querySelector('.explain-body')!.textContent!;
    expect(body).toMatch(/permutation/i);
    expect(body).toMatch(/Sweep/);
  });

  it('stays available while the null model is off, unlike the rest of the bar', () => {
    // Every other control here does nothing while it is off. This one answers
    // "what is the thing I am being invited to switch on", which is precisely
    // the question asked before switching it on.
    const root = mountEngine();
    root.querySelector<HTMLButtonElement>('.null-toggle')!.click();   // off
    const info = root.querySelector<HTMLButtonElement>('.comparison-bar .explain-button')!;
    expect(root.querySelector<HTMLSelectElement>('.surrogate-select')!.disabled).toBe(true);
    expect(info.disabled).toBe(false);
    info.click();
    expect(root.querySelector<HTMLElement>('.explain-panel')!.hidden).toBe(false);
  });

  it('the visualizer (i) no longer carries the null explanation', () => {
    const root = mountEngine();
    root.querySelector<HTMLButtonElement>('.topbar .explain-button')!.click();
    const body = root.querySelector('.explain-body')!.textContent!;
    expect(body.length).toBeGreaterThan(40);
    expect(body, 'null text should live on the null button now')
      .not.toMatch(/multiset/i);
  });
});

describe('the info buttons toggle', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };
  const parts = (root: HTMLElement) => ({
    viz: root.querySelector<HTMLButtonElement>('.topbar .explain-button')!,
    nul: root.querySelector<HTMLButtonElement>('.comparison-bar .explain-button')!,
    panel: root.querySelector<HTMLElement>('.explain-panel')!,
  });

  it('a second press on the same button closes it', () => {
    const { viz, panel } = parts(mountEngine());
    viz.click();
    expect(panel.hidden).toBe(false);
    viz.click();
    expect(panel.hidden).toBe(true);
  });

  it('pressing the other button swaps the contents rather than closing', () => {
    // "Show me the other explanation" is not "hide this one". Treating every
    // press as a toggle would make the second button appear broken.
    const { viz, nul, panel } = parts(mountEngine());
    viz.click();
    const first = panel.querySelector('.explain-title')!.textContent;
    nul.click();
    expect(panel.hidden, 'switching should not close the panel').toBe(false);
    expect(panel.querySelector('.explain-title')!.textContent).not.toBe(first);
    nul.click();
    expect(panel.hidden).toBe(true);
  });

  it('both buttons report their own state, and neither lies after a switch', () => {
    const { viz, nul } = parts(mountEngine());
    expect(viz.getAttribute('aria-expanded')).toBe('false');
    viz.click();
    expect(viz.getAttribute('aria-expanded')).toBe('true');
    nul.click();
    expect(viz.getAttribute('aria-expanded'), 'viz still claims to be open').toBe('false');
    expect(nul.getAttribute('aria-expanded')).toBe('true');
  });

  it('closing from inside the panel clears both buttons', () => {
    // The close button and Escape are routes the buttons do not know about,
    // so the panel has to tell them.
    const { nul, panel } = parts(mountEngine());
    nul.click();
    expect(nul.getAttribute('aria-expanded')).toBe('true');
    panel.querySelector<HTMLButtonElement>('.explain-close')!.click();
    expect(panel.hidden).toBe(true);
    expect(nul.getAttribute('aria-expanded')).toBe('false');
    // And the next press must open rather than no-op.
    nul.click();
    expect(panel.hidden).toBe(false);
  });

  it('points at the panel it governs', () => {
    const root = mountEngine();
    const { viz, nul, panel } = parts(root);
    expect(panel.id).toBeTruthy();
    expect(viz.getAttribute('aria-controls')).toBe(panel.id);
    expect(nul.getAttribute('aria-controls')).toBe(panel.id);
  });
});

describe('splitting zoom and pan between the panels', () => {
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    root.querySelector<HTMLButtonElement>('.landing-open')?.click();
    return root;
  };
  const viewBtn = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLButtonElement>('.link-toggle')].find((b) => /View:/.test(b.textContent!))!;

  it('is off by default, and sits after Sweep at the end of the bar', () => {
    // Shared is the default because the point of side-by-side is that the two
    // panels are directly comparable; different frames removes that silently.
    const root = mountEngine();
    const btn = viewBtn(root);
    expect(btn, 'no view link toggle').toBeTruthy();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.textContent).toMatch(/linked/i);
    const bar = root.querySelector('.comparison-bar')!;
    expect(bar.lastElementChild).toBe(btn);
    expect(btn.previousElementSibling!.textContent).toMatch(/Sweep/);
  });

  it('does not resize when pressed', () => {
    // Same reasoning as the style toggle beside it: a control that changes
    // width on press shoves everything after it sideways.
    const root = mountEngine();
    const btn = viewBtn(root);
    expect(btn.className).toContain('link-toggle');
    btn.click();
    expect(btn.textContent).toMatch(/split/i);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    btn.click();
    expect(btn.textContent).toMatch(/linked/i);
  });

  it('carries a split view through a share link, and omits it when linked', () => {
    const linked = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1, viewport: { zoom: 2, panX: 10, panY: 20 },
    });
    expect(linked).toContain('zoom=2');
    expect(linked).not.toContain('splitview');
    expect(decodeState(linked)!.nullViewport).toBeUndefined();

    const split = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1,
      viewport: { zoom: 2, panX: 10, panY: 20 },
      nullViewport: { zoom: 4, panX: -30, panY: 5 },
    });
    expect(split).toContain('splitview=1');
    expect(split).toContain('null.zoom=4');
    expect(split).toContain('null.pan=-30,5');
    const back = decodeState(split)!;
    expect(back.viewport).toEqual({ zoom: 2, panX: 10, panY: 20 });
    expect(back.nullViewport).toEqual({ zoom: 4, panX: -30, panY: 5 });
    // The namespaced keys must not leak into the visualizer's parameters.
    expect(back.params['null.zoom']).toBeUndefined();
    expect(back.params['null.pan']).toBeUndefined();
  });

  it('survives a split left at the default frame', () => {
    // No null.* keys are emitted then, so the flag is what carries it.
    const url = encodeState({
      seqRef: null, vizId: 'turtle', params: {}, mode: 'side',
      surrogate: 'permutation', seed: 1, nullViewport: { zoom: 1, panX: 0, panY: 0 },
    });
    expect(url).toContain('splitview=1');
    expect(decodeState(url)!.nullViewport).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });
});
