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
