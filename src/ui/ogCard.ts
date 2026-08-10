import { heroEntry } from '../examples/entries';
import { paintEntry } from './landing';

const W = 1200, H = 630;

/**
 * Dev-only OG card exporter.
 *
 * Renders the hero entry at card dimensions through the same paintEntry the
 * landing uses, so `public/og-card.png` is a picture of the actual hero
 * rather than a hand-drawn approximation free to drift away from it.
 *
 * Usage: npm run dev, then open http://localhost:5173/?ogcard
 * Save the download over public/og-card.png and commit it.
 */
export function exportOgCard(): void {
  const entry = heroEntry();
  const canvas = document.createElement('canvas');

  // paintEntry multiplies by devicePixelRatio; pin it to 1 so the exported
  // file is exactly 1200x630 regardless of the machine that produced it.
  const realDpr = window.devicePixelRatio;
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  paintEntry(entry, canvas, W, H);
  Object.defineProperty(window, 'devicePixelRatio', { value: realDpr, configurable: true });

  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Wordmark and URL over the comparison, so the card reads as a product
    // shot rather than an unattributed graph.
    ctx.fillStyle = 'rgba(20,22,26,0.86)';
    ctx.fillRect(0, H - 104, W, 104);
    ctx.fillStyle = '#e6e6e6';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('Is that pattern real?', 40, H - 58);
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Left: an OEIS sequence. Right: the same terms, shuffled.', 40, H - 26);
    ctx.fillStyle = '#7aa2f7';
    ctx.font = '600 20px system-ui, sans-serif';
    const url = 'ulam.briansheppard.com';
    ctx.fillText(url, W - 40 - ctx.measureText(url).width, H - 26);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'og-card.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}
