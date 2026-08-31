import type { Sequence } from '../sequence/sequence';
import { SequenceView } from '../sequence/sequence';
import { getVisualizer } from '../viz/registry';
import { SvgSurface } from '../viz/svgSurface';
import { styleToParams, type RenderStyle } from '../viz/style';
import { canvasTheme, withCanvas } from '../viz/theme';
import { applyViewport, type Viewport } from './viewport';
import { attributionLine } from './exportData';
import { downloadBlob } from './exportData';
import type { Params } from '../viz/types';

/**
 * Vector export: the same drawing, as paths rather than pixels.
 *
 * A PNG of a curve is a decision about resolution taken on the reader's behalf,
 * and a journal figure outlives that decision. This writes the geometry, so the
 * curve is exact at any magnification a typesetter asks for and the lines stay
 * editable in Illustrator or Inkscape.
 *
 * Nothing here knows about any particular visualizer. `viz.render` is called
 * with an SvgSurface in place of a canvas context, so whatever the view draws
 * is what gets written, and all nine are covered by the same few lines.
 */

const CREDIT_BAND = 30;

export interface SvgPanel {
  seq: Sequence;
  style: RenderStyle;
  viewport: Viewport;
  /** Drawn top-left of the panel, as the canvas does. */
  label: string;
}

export interface SvgResult {
  svg: string;
  /** Path and text elements written. The one number that predicts file size. */
  elements: number;
  bytes: number;
}

/**
 * Composes one or two panels into a single SVG document.
 *
 * Mirrors the engine's own composition: each panel is fitted to its own half,
 * gets its own background and its own viewport, and a divider separates them.
 * A null panel beside its sequence is the figure most of these drawings are
 * for, so exporting only the real half would mean rebuilding the comparison by
 * hand in a layout program.
 */
export function buildSvg(
  panels: SvgPanel[],
  vizId: string,
  params: Params,
  size: { width: number; height: number },
  seqForCredit: Sequence,
): SvgResult {
  const viz = getVisualizer(vizId);
  const surface = new SvgSurface();
  // The surface implements the fifteen context members the visualizers use.
  // The cast is the seam; SvgSurface's own doc comment carries the argument
  // for why that set is closed.
  const ctx = surface as unknown as CanvasRenderingContext2D;

  const { width, height } = size;
  const drawH = height - CREDIT_BAND;
  const n = panels.length;
  const panelW = n > 1 ? width / n - 1 : width;

  panels.forEach((panel, i) => {
    const ox = i * (panelW + 1);
    surface.save();
    surface.translate(ox, 0);
    withCanvas(panel.style.canvas, () => {
      const theme = canvasTheme();
      surface.fillStyle = theme.bg;
      surface.fillRect(0, 0, panelW, drawH);

      surface.save();
      applyViewport(ctx, panel.viewport);
      try {
        viz.render(new SequenceView(panel.seq), {
          ...params,
          ...styleToParams(panel.style),
          // Same rule the engine uses: a stroke keeps its on-screen weight as
          // you zoom, so zooming reveals finer structure rather than fattening
          // every line.
          styleLineWidth: panel.style.lineWidth / panel.viewport.zoom,
        }, ctx, { width: panelW, height: drawH });
      } catch {
        // One bad panel degrades to an empty half, never a failed download.
      }
      surface.restore();

      if (panel.label) {
        surface.fillStyle = theme.muted;
        surface.font = '11px system-ui';
        surface.fillText(panel.label, 8, 14);
      }
    });
    surface.restore();

    if (i > 0) {
      surface.strokeStyle = canvasTheme().grid;
      surface.lineWidth = 1;
      surface.beginPath();
      surface.moveTo(ox - 0.5, 0);
      surface.lineTo(ox - 0.5, drawH);
      surface.stroke();
    }
  });

  // The credit has to be inside the file: an exported figure travels without
  // the page footer, so attribution that lives only on the page does not
  // survive the journey.
  surface.fillStyle = '#14161a';
  surface.fillRect(0, drawH, width, CREDIT_BAND);
  surface.fillStyle = '#9aa0aa';
  surface.font = '12px system-ui';
  surface.textBaseline = 'middle';
  surface.fillText(attributionLine(seqForCredit), 12, drawH + CREDIT_BAND / 2);

  const svg = surface.toSvg(width, height);
  return { svg, elements: surface.elementCount, bytes: svg.length };
}

export function downloadSvg(svg: string, filename: string): void {
  downloadBlob(filename, 'image/svg+xml;charset=utf-8', svg);
}
