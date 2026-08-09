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
  } catch { /* matchMedia is unavailable in some environments */ }
  return 'dark';
}

/**
 * Both halves of the switch, always together: CSS reads the document
 * attribute and canvas code reads the palette module. Setting one without the
 * other leaves light chrome wrapped around a dark drawing, which is the
 * obvious way for this to go wrong.
 */
export function applyTheme(name: ThemeName): void {
  document.documentElement.setAttribute('data-theme', name);
  setCanvasTheme(name);
  try { localStorage.setItem(KEY, name); } catch { /* private browsing */ }
}

export function buildThemeToggle(onChange: (t: ThemeName) => void): { el: HTMLElement; refresh(): void } {
  const el = document.createElement('button');
  el.className = 'theme-toggle';
  el.type = 'button';

  function currentTheme(): ThemeName {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function refresh(): void {
    const now = currentTheme();
    // Labelled with the destination rather than the current state: a button
    // reading "Light" while the page is light is genuinely ambiguous.
    el.textContent = now === 'light' ? 'Dark' : 'Light';
    el.setAttribute('aria-label', `Switch to the ${now === 'light' ? 'dark' : 'light'} theme`);
  }

  el.addEventListener('click', () => {
    const next: ThemeName = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    refresh();
    onChange(next);
  });

  refresh();
  return { el, refresh };
}
