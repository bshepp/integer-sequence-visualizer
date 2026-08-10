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
  /** HSL lightness for the spectrum colour ramp, in percent. */
  spectrumLightness: number;
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
  spectrumLightness: 60,
};

// Not a naive inversion. The dark theme's accent and real-line hues fail
// badly on a light background (#7aa2f7 on white is 2.2:1), so both are
// darkened until they clear 4.5:1. tests/viz/theme.test.ts measures every
// pair rather than trusting this comment.
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
  spectrumLightness: 38,
};

// Module-level rather than threaded through every render() call. Canvas colour
// is ambient in the same way ctx.fillStyle is, and threading it would mean 38
// signature changes for a value that is identical everywhere at any instant.
// Defaults to dark, so behaviour is unchanged until something switches it.
let current: CanvasPalette = DARK_PALETTE;

export function canvasTheme(): CanvasPalette {
  return current;
}

export function setCanvasTheme(name: ThemeName): void {
  current = name === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}

/** What a panel draws on: the page theme, or a pinned background. */
export type CanvasChoice = 'theme' | 'white' | 'black';

// True white and true black rather than the theme's #fbfbfd / #14161a. These
// exist for figures leaving the site - a journal wants white, and the site's
// off-white carries a visible grey cast into a printed page. Everything else
// is inherited, because the light palette's ink is already tuned for a pale
// background and the dark palette's for a dark one.
export const WHITE_PALETTE: CanvasPalette = { ...LIGHT_PALETTE, bg: '#ffffff' };
export const BLACK_PALETTE: CanvasPalette = { ...DARK_PALETTE, bg: '#000000' };

/**
 * Run `fn` with the palette a panel asked for, then put the old one back.
 *
 * Background and ink are one decision, not two: strokeColorAt reads
 * spectrumLightness from the palette, so a white canvas drawn with dark-theme
 * ink washes out to pastel. Swapping the whole palette keeps them together,
 * and because the palette is module-level ambient every visualizer follows
 * along without a signature change - the same trick the viewport transform
 * uses. 'theme' does nothing at all, so the default costs nothing.
 */
export function withCanvas<T>(choice: CanvasChoice, fn: () => T): T {
  if (choice === 'theme') return fn();
  const prev = current;
  current = choice === 'white' ? WHITE_PALETTE : BLACK_PALETTE;
  try {
    return fn();
  } finally {
    current = prev;
  }
}
