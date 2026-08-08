import type { Sequence } from '../sequence/sequence';
import { attributionLine } from './exportData';

const BAND = 34;

/**
 * Draws the OEIS credit into the bitmap.
 *
 * An exported PNG travels without the page footer, so the attribution has to
 * survive inside the image or it does not survive at all.
 */
export function drawAttribution(
  ctx: CanvasRenderingContext2D, text: string, width: number, height: number,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(20,22,26,0.88)';
  ctx.fillRect(0, height - BAND, width, BAND);
  ctx.fillStyle = '#9aa0aa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, height - BAND / 2);
  ctx.restore();
}

/** Copies the live canvas, stamps attribution, and downloads it. */
export function exportCanvasPng(canvas: HTMLCanvasElement, seq: Sequence, filename: string): void {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(canvas, 0, 0);
  // The source canvas is scaled by devicePixelRatio; match it so the credit is
  // the same visual size as on screen rather than hairline on a HiDPI display.
  const cssWidth = parseFloat(canvas.style.width || String(canvas.width));
  const dpr = cssWidth > 0 ? canvas.width / cssWidth : 1;
  ctx.scale(dpr, dpr);
  drawAttribution(ctx, attributionLine(seq), out.width / dpr, out.height / dpr);
  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}
