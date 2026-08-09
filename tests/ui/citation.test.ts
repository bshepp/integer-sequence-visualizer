// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initialTheme, applyTheme, buildThemeToggle } from '../../src/ui/themeToggle';
import { canvasTheme, DARK_PALETTE, LIGHT_PALETTE, setCanvasTheme } from '../../src/viz/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  setCanvasTheme('dark');
  vi.unstubAllGlobals();
});

const stubPrefersLight = () => vi.stubGlobal('matchMedia', (q: string) => ({
  matches: q.includes('light'), media: q, addEventListener() {}, removeEventListener() {},
}));

describe('theme selection', () => {
  it('follows the OS preference when nothing is stored', () => {
    stubPrefersLight();
    expect(initialTheme()).toBe('light');
  });

  it('a stored choice beats the OS preference', () => {
    localStorage.setItem('ulam-theme', 'dark');
    stubPrefersLight();
    expect(initialTheme()).toBe('dark');
  });

  it('falls back to dark when neither is available', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(initialTheme()).toBe('dark');
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

  it('the toggle is a labelled button naming where it will take you', () => {
    applyTheme('dark');
    const { el } = buildThemeToggle(() => {});
    document.body.appendChild(el);
    expect(el.tagName).toBe('BUTTON');
    expect(el.textContent).toBe('Light');
    expect(el.getAttribute('aria-label')).toMatch(/light theme/i);
  });

  it('clicking it flips the theme, the palette and its own label', () => {
    applyTheme('dark');
    const seen: string[] = [];
    const { el } = buildThemeToggle((t) => seen.push(t));
    (el as HTMLButtonElement).click();
    expect(seen).toEqual(['light']);
    expect(canvasTheme()).toBe(LIGHT_PALETTE);
    expect(el.textContent).toBe('Dark');
  });
});

import { citationFor } from '../../src/ui/citation';
import type { Sequence } from '../../src/sequence/sequence';

const fib: Sequence = {
  terms: [0n, 1n, 1n, 2n], aNumber: 'A000045',
  name: 'Fibonacci numbers', offset: 0, source: 'oeis',
};

describe('citationFor', () => {
  const base = {
    seq: fib, vizName: 'Turtle walk',
    url: 'https://ulam.briansheppard.com/#abc', accessed: '2026-08-08',
  };

  it('names the sequence, the view, the URL and the access date', () => {
    const c = citationFor(base);
    expect(c).toContain('A000045');
    expect(c).toContain('Fibonacci numbers');
    expect(c).toContain('Turtle walk');
    expect(c).toContain('https://ulam.briansheppard.com/#abc');
    expect(c).toContain('2026-08-08');
  });

  it('records how many terms were drawn, since the picture depends on it', () => {
    expect(citationFor(base)).toContain('4 terms');
  });

  it('credits the OEIS, since the data is theirs', () => {
    const c = citationFor(base);
    expect(c).toMatch(/On-Line Encyclopedia of Integer Sequences/);
    expect(c).toContain('CC BY-SA 4.0');
  });

  it('omits the A-number cleanly for a non-OEIS sequence', () => {
    const c = citationFor({
      ...base,
      seq: { terms: [1n], name: 'Pasted sequence', offset: 0, source: 'paste' },
    });
    expect(c).toContain('Pasted sequence');
    expect(c).not.toMatch(/A undefined|oeis\.org\/undefined|undefined/);
  });

  it('is a single paragraph, so it pastes into a bibliography intact', () => {
    expect(citationFor(base).split('\n').filter((l) => l.trim()).length).toBe(1);
  });
});
