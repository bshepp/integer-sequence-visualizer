/**
 * A drawing surface that records SVG instead of painting pixels.
 *
 * It implements the part of CanvasRenderingContext2D the visualizers actually
 * use, which is a much smaller thing than the full interface: fifteen members,
 * counted rather than guessed. So every one of the nine views gets vector
 * export without a line of per-view code, and a view added later gets it for
 * free as long as it stays inside the same set.
 *
 * The alternative was teaching each visualizer to emit vector primitives, which
 * would have meant nine parallel implementations of drawing code that already
 * exists, and nine chances for the SVG to disagree with the canvas. Here the
 * disagreement is impossible by construction: `viz.render` is called once, with
 * this in place of a context, and whatever it draws is what gets written.
 *
 * Transforms are flattened into the emitted coordinates rather than expressed
 * as nested <g transform>. That is safe here because everything this app
 * applies is a uniform scale plus a translate - applyViewport does exactly
 * `translate(panX, panY); scale(zoom, zoom)` - so a circle stays a circle and
 * one number describes the scale. A non-uniform scale would turn arcs into
 * ellipses and this would need real matrices; assertUniform guards that.
 */

export interface SvgSurfaceOptions {
  /** Coordinates are rounded to this many decimals. */
  precision?: number;
}

interface Matrix { a: number; d: number; e: number; f: number }

const TWO_PI = Math.PI * 2;

/** XML-escapes text and attribute values. Colours are author-controlled, labels are not. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] ?? c));
}

export class SvgSurface {
  // --- canvas state the visualizers set ---
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth = 1;
  lineJoin: CanvasLineJoin = 'miter';
  lineCap: CanvasLineCap = 'butt';
  font = '10px sans-serif';
  globalAlpha = 1;
  textBaseline: CanvasTextBaseline = 'alphabetic';

  private readonly body: string[] = [];
  private m: Matrix = { a: 1, d: 1, e: 0, f: 0 };
  private readonly stack: Matrix[] = [];
  private path: string[] = [];
  private startOfSubpath: { x: number; y: number } | null = null;
  private readonly p: number;

  constructor(opts: SvgSurfaceOptions = {}) {
    // Two decimals is a fortieth of a pixel at 1x and keeps files roughly a
    // third the size of full float output, which matters: a polyarc at high
    // parameters emits one path element per segment and there can be hundreds
    // of thousands of them.
    this.p = opts.precision ?? 2;
  }

  // --- transforms ---
  save(): void { this.stack.push({ ...this.m }); }
  restore(): void { const m = this.stack.pop(); if (m) this.m = m; }
  translate(x: number, y: number): void { this.m.e += this.m.a * x; this.m.f += this.m.d * y; }
  scale(sx: number, sy: number): void { this.m.a *= sx; this.m.d *= sy; }
  setTransform(a: number, _b: number, _c: number, d: number, e: number, f: number): void {
    this.m = { a, d, e, f };
  }
  /** Clipping is a no-op: panels are composed side by side, never overlapping. */
  clip(): void { /* intentionally empty */ }
  rect(): void { /* only ever used to build a clip path here */ }

  measureText(text: string): { width: number } {
    // Approximate, and only used for label backing plates. Reading a real
    // metric would mean carrying a canvas around purely to size a rectangle.
    const size = parseFloat(this.font) || 10;
    return { width: text.length * size * 0.55 };
  }

  // --- path building ---
  beginPath(): void { this.path = []; this.startOfSubpath = null; }

  moveTo(x: number, y: number): void {
    const px = this.tx(x), py = this.ty(y);
    this.startOfSubpath = { x: px, y: py };
    this.path.push(`M${this.n(px)} ${this.n(py)}`);
  }

  lineTo(x: number, y: number): void {
    this.path.push(`L${this.n(this.tx(x))} ${this.n(this.ty(y))}`);
  }

  arc(cx: number, cy: number, r: number, start: number, end: number, ccw = false): void {
    this.assertUniform();
    const R = Math.abs(this.m.a) * r;
    const sx = this.tx(cx + r * Math.cos(start)), sy = this.ty(cy + r * Math.sin(start));
    const ex = this.tx(cx + r * Math.cos(end)), ey = this.ty(cy + r * Math.sin(end));

    // Canvas sweeps forward from `start` unless ccw, wrapping as needed. SVG
    // instead needs the two endpoints plus two flags, so the sweep has to be
    // normalised into a signed delta first.
    let delta = end - start;
    if (!ccw) { while (delta < 0) delta += TWO_PI; delta = Math.min(delta, TWO_PI); }
    else { while (delta > 0) delta -= TWO_PI; delta = Math.max(delta, -TWO_PI); }

    if (this.startOfSubpath === null) {
      this.startOfSubpath = { x: sx, y: sy };
      this.path.push(`M${this.n(sx)} ${this.n(sy)}`);
    } else if (Math.hypot(sx - this.lastX(), sy - this.lastY()) > 1e-9) {
      // Canvas draws an implicit line from the current point to the arc's
      // start. Every caller here has already moved to that exact point, so this
      // is a zero-length no-op in practice - emitted anyway so the surface is
      // faithful to the API rather than to its callers.
      this.path.push(`L${this.n(sx)} ${this.n(sy)}`);
    }

    // A full turn cannot be expressed as one SVG arc: identical endpoints make
    // it degenerate and it renders as nothing. Split it.
    if (Math.abs(Math.abs(delta) - TWO_PI) < 1e-9) {
      const mx = this.tx(cx + r * Math.cos(start + delta / 2));
      const my = this.ty(cy + r * Math.sin(start + delta / 2));
      const sweepFlag = delta > 0 ? 1 : 0;
      this.path.push(`A${this.n(R)} ${this.n(R)} 0 0 ${sweepFlag} ${this.n(mx)} ${this.n(my)}`);
      this.path.push(`A${this.n(R)} ${this.n(R)} 0 0 ${sweepFlag} ${this.n(ex)} ${this.n(ey)}`);
      return;
    }
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta > 0 ? 1 : 0;
    this.path.push(`A${this.n(R)} ${this.n(R)} 0 ${large} ${sweep} ${this.n(ex)} ${this.n(ey)}`);
  }

  // --- painting ---
  stroke(): void {
    if (this.path.length === 0) return;
    this.assertUniform();
    const w = Math.abs(this.m.a) * this.lineWidth;
    // linejoin and linecap are omitted when they match SVG's own defaults,
    // which happen to be canvas's defaults too. Every segment of a path is its
    // own element here - each carries a different colour from the hue ramp -
    // so two attributes that say nothing cost about 60 bytes per segment, and
    // a 58-term hero has eleven thousand of them. Measured on that hero, two
    // panels at 900x460: 1.91 MB before, 1.45 MB after, 175 bytes an element
    // down to 130, with no change to what is drawn.
    const join = this.lineJoin === 'miter' ? '' : ` stroke-linejoin="${this.lineJoin}"`;
    const cap = this.lineCap === 'butt' ? '' : ` stroke-linecap="${this.lineCap}"`;
    this.body.push(
      `<path d="${this.path.join('')}" fill="none" stroke="${esc(String(this.strokeStyle))}"`
      + ` stroke-width="${this.n(w)}"${join}${cap}${this.alpha()}/>`,
    );
  }

  fill(): void {
    if (this.path.length === 0) return;
    this.body.push(
      `<path d="${this.path.join('')}Z" fill="${esc(String(this.fillStyle))}"${this.alpha()}/>`,
    );
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const { x: rx, y: ry, w: rw, h: rh } = this.rectIn(x, y, w, h);
    this.body.push(
      `<rect x="${this.n(rx)}" y="${this.n(ry)}" width="${this.n(rw)}" height="${this.n(rh)}"`
      + ` fill="${esc(String(this.fillStyle))}"${this.alpha()}/>`,
    );
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    const { x: rx, y: ry, w: rw, h: rh } = this.rectIn(x, y, w, h);
    this.body.push(
      `<rect x="${this.n(rx)}" y="${this.n(ry)}" width="${this.n(rw)}" height="${this.n(rh)}"`
      + ` fill="none" stroke="${esc(String(this.strokeStyle))}"`
      + ` stroke-width="${this.n(Math.abs(this.m.a) * this.lineWidth)}"${this.alpha()}/>`,
    );
  }

  fillText(text: string, x: number, y: number): void {
    const size = (parseFloat(this.font) || 10) * Math.abs(this.m.a);
    // The family is whatever follows the size in the shorthand; everything here
    // asks for system-ui, which no SVG viewer resolves, so a stack is supplied.
    // SVG's default text anchor is the alphabetic baseline, same as canvas, so
    // only the other baselines need saying.
    const baseline = this.textBaseline === 'middle' ? ' dominant-baseline="central"'
      : this.textBaseline === 'top' || this.textBaseline === 'hanging' ? ' dominant-baseline="hanging"'
      : '';
    this.body.push(
      `<text x="${this.n(this.tx(x))}" y="${this.n(this.ty(y))}"`
      + ` font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"`
      + ` font-size="${this.n(size)}" fill="${esc(String(this.fillStyle))}"`
      + `${baseline}${this.alpha()}>${esc(text)}</text>`,
    );
  }

  /** Number of SVG elements written, which is what decides the file's size. */
  get elementCount(): number { return this.body.length; }

  toSvg(width: number, height: number, background?: string): string {
    const bg = background
      ? `<rect width="${this.n(width)}" height="${this.n(height)}" fill="${esc(background)}"/>`
      : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.n(width)}"`
      + ` height="${this.n(height)}" viewBox="0 0 ${this.n(width)} ${this.n(height)}">`
      + bg + this.body.join('') + '</svg>';
  }

  // --- internals ---
  private tx(x: number): number { return this.m.a * x + this.m.e; }
  private ty(y: number): number { return this.m.d * y + this.m.f; }
  private n(v: number): number {
    const r = Number(v.toFixed(this.p));
    return Object.is(r, -0) ? 0 : r;
  }
  private alpha(): string { return this.globalAlpha >= 1 ? '' : ` opacity="${this.n(this.globalAlpha)}"`; }
  private lastX(): number { return this.startOfSubpath?.x ?? 0; }
  private lastY(): number { return this.startOfSubpath?.y ?? 0; }

  private rectIn(x: number, y: number, w: number, h: number) {
    const x0 = this.tx(x), y0 = this.ty(y);
    const x1 = this.tx(x + w), y1 = this.ty(y + h);
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  }

  private assertUniform(): void {
    if (Math.abs(Math.abs(this.m.a) - Math.abs(this.m.d)) > 1e-9) {
      throw new Error(
        'SvgSurface: non-uniform scale. Arcs and stroke widths are flattened '
        + 'into coordinates on the assumption of a uniform transform.',
      );
    }
  }
}
