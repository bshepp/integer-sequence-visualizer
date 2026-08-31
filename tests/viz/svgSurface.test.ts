// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SvgSurface, esc } from '../../src/viz/svgSurface';
import { buildSvg } from '../../src/ui/exportSvg';
import { registerAll } from '../../src/viz/all';
import { clearRegistry } from '../../src/viz/registry';
import { DEFAULT_STYLE } from '../../src/viz/style';
import { IDENTITY_VIEWPORT } from '../../src/ui/viewport';
import { primes } from '../../src/examples/sequences';
import type { Sequence } from '../../src/sequence/sequence';

clearRegistry(); registerAll();

const parse = (svg: string): Document =>
  new DOMParser().parseFromString(svg, 'image/svg+xml');
const parseError = (doc: Document): string | null =>
  doc.querySelector('parsererror')?.textContent ?? null;

const seq = (terms: bigint[]): Sequence =>
  ({ terms, name: 'The prime numbers', aNumber: 'A000040', offset: 0, source: 'oeis' });

describe('SvgSurface', () => {
  it('writes a stroked path with the canvas line settings', () => {
    const s = new SvgSurface();
    s.strokeStyle = '#7aa2f7'; s.lineWidth = 2; s.lineCap = 'round';
    s.beginPath(); s.moveTo(0, 0); s.lineTo(10, 5); s.stroke();
    const svg = s.toSvg(100, 100);
    expect(svg).toContain('d="M0 0L10 5"');
    expect(svg).toContain('stroke="#7aa2f7"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('fill="none"');
  });

  it('omits stroke attributes that already match the SVG defaults', () => {
    // Each segment is its own element, because each carries a different colour
    // from the hue ramp, so a redundant attribute is paid for tens of thousands
    // of times. miter and butt are the defaults in both APIs.
    const s = new SvgSurface();
    s.beginPath(); s.moveTo(0, 0); s.lineTo(1, 1); s.stroke();
    const svg = s.toSvg(10, 10);
    expect(svg).not.toContain('stroke-linejoin');
    expect(svg).not.toContain('stroke-linecap');
    // Still written when they carry information.
    const t = new SvgSurface();
    t.lineJoin = 'round'; t.lineCap = 'square';
    t.beginPath(); t.moveTo(0, 0); t.lineTo(1, 1); t.stroke();
    expect(t.toSvg(10, 10)).toContain('stroke-linejoin="round"');
    expect(t.toSvg(10, 10)).toContain('stroke-linecap="square"');
  });

  it('flattens translate and scale into the coordinates', () => {
    // Rather than nesting <g transform>. Safe only while transforms stay a
    // uniform scale plus a translate, which is all applyViewport does.
    const s = new SvgSurface();
    s.translate(100, 50);
    s.scale(2, 2);
    s.beginPath(); s.moveTo(10, 10); s.lineTo(20, 0); s.stroke();
    expect(s.toSvg(400, 400)).toContain('d="M120 70L140 50"');
  });

  it('scales stroke width by the same factor, so a zoomed line is not hairline', () => {
    const s = new SvgSurface();
    s.lineWidth = 1.5;
    s.scale(4, 4);
    s.beginPath(); s.moveTo(0, 0); s.lineTo(1, 0); s.stroke();
    expect(s.toSvg(10, 10)).toContain('stroke-width="6"');
  });

  it('turns a canvas arc into an SVG arc on the same circle', () => {
    const s = new SvgSurface();
    const cx = 50, cy = 50, r = 20, start = 0, end = Math.PI / 2;
    s.beginPath();
    s.moveTo(cx + r * Math.cos(start), cy + r * Math.sin(start));
    s.arc(cx, cy, r, start, end, false);
    s.stroke();
    const d = /d="([^"]+)"/.exec(s.toSvg(100, 100))![1]!;
    const m = /A([\d.]+) ([\d.]+) 0 (\d) (\d) ([-\d.]+) ([-\d.]+)/.exec(d)!;
    expect(m, `no arc command in ${d}`).not.toBeNull();
    expect(Number(m[1])).toBeCloseTo(r, 6);
    expect(Number(m[3]), 'a quarter turn is not the large arc').toBe(0);
    expect(Number(m[4]), 'increasing angle is a positive sweep in SVG').toBe(1);
    // The endpoint must sit on the circle it claims.
    expect(Math.hypot(Number(m[5]) - cx, Number(m[6]) - cy)).toBeCloseTo(r, 1);
  });

  it('marks a turn over half a circle as large, and reverses the sweep for ccw', () => {
    const s = new SvgSurface();
    s.beginPath(); s.arc(0, 0, 10, 0, Math.PI * 1.5, false); s.stroke();
    expect(/A[\d.]+ [\d.]+ 0 1 1 /.test(s.toSvg(50, 50)), 'expected large=1 sweep=1').toBe(true);

    const t = new SvgSurface();
    t.beginPath(); t.arc(0, 0, 10, 0, -Math.PI / 2, true); t.stroke();
    expect(/A[\d.]+ [\d.]+ 0 0 0 /.test(t.toSvg(50, 50)), 'expected large=0 sweep=0').toBe(true);
  });

  it('splits a full turn, which one SVG arc cannot express', () => {
    // Identical endpoints make an A command degenerate: it draws nothing.
    const s = new SvgSurface();
    s.beginPath(); s.arc(0, 0, 10, 0, Math.PI * 2, false); s.stroke();
    const d = /d="([^"]+)"/.exec(s.toSvg(50, 50))![1]!;
    expect(d.match(/A/g), 'a full circle needs two arc commands').toHaveLength(2);
  });

  it('refuses a non-uniform scale rather than silently drawing ellipses', () => {
    const s = new SvgSurface();
    s.scale(2, 3);
    s.beginPath();
    expect(() => s.arc(0, 0, 5, 0, 1, false)).toThrow(/non-uniform/i);
  });

  it('escapes text and attributes', () => {
    expect(esc('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;');
    const s = new SvgSurface();
    s.fillText('A & <B>', 0, 10);
    const doc = parse(s.toSvg(50, 50));
    expect(parseError(doc)).toBeNull();
    expect(doc.querySelector('text')!.textContent).toBe('A & <B>');
  });
});

describe('buildSvg', () => {
  const panel = (s: Sequence, label: string) =>
    ({ seq: s, style: { ...DEFAULT_STYLE }, viewport: IDENTITY_VIEWPORT, label });

  it('produces a parseable document at the size asked for', () => {
    const s = seq(primes(58));
    const { svg } = buildSvg([panel(s, 'real')], 'polyarc',
      { angle: 64, modulus: 187, offset: -90 }, { width: 800, height: 500 }, s);
    const doc = parse(svg);
    expect(parseError(doc)).toBeNull();
    const root = doc.documentElement;
    expect(root.getAttribute('width')).toBe('800');
    expect(root.getAttribute('viewBox')).toBe('0 0 800 500');
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('writes the polyarc as arcs, not as a polyline', () => {
    // The whole point of a vector export of this view: an arc stays an arc at
    // any magnification, where a flattened polyline bakes in a resolution
    // decision at export time.
    const s = seq(primes(58));
    const { svg, elements } = buildSvg([panel(s, 'real')], 'polyarc',
      { angle: 64, modulus: 187, offset: -90 }, { width: 800, height: 500 }, s);
    expect(elements).toBeGreaterThan(1000);
    expect((svg.match(/A[\d.]+ [\d.]+ 0 /g) ?? []).length,
      'no arc commands in the output').toBeGreaterThan(1000);
  });

  it('carries the OEIS attribution inside the file', () => {
    // An exported figure travels without the page footer.
    const s = seq(primes(20));
    const { svg } = buildSvg([panel(s, 'real')], 'turtle', { angle: 90, k: 4 },
      { width: 400, height: 300 }, s);
    expect(svg).toContain('OEIS Foundation');
    expect(svg).toContain('https://oeis.org/A000040');
  });

  it('lays two panels side by side for a comparison', () => {
    const s = seq(primes(58));
    const one = buildSvg([panel(s, 'real')], 'turtle', { angle: 90, k: 4 },
      { width: 800, height: 400 }, s);
    const two = buildSvg([panel(s, 'real'), panel(s, 'permutation null')], 'turtle',
      { angle: 90, k: 4 }, { width: 800, height: 400 }, s);
    expect(two.svg).toContain('permutation null');
    expect(two.elements).toBeGreaterThan(one.elements);
    expect(parseError(parse(two.svg))).toBeNull();
  });

  it('covers every visualizer, since none of them know about SVG', () => {
    // The argument for a recording surface over per-view emitters, checked
    // rather than asserted: nine views, no SVG code in any of them.
    const s = seq(primes(60));
    for (const id of ['scatter', 'differences', 'histogram', 'autocorr', 'ulam',
      'modgrid', 'turtle', 'digitwalk', 'polyarc']) {
      const { svg, elements } = buildSvg([panel(s, id)], id, {}, { width: 400, height: 300 }, s);
      expect(parseError(parse(svg)), `${id} produced invalid SVG`).toBeNull();
      expect(elements, `${id} drew nothing`).toBeGreaterThan(1);
    }
  });
});
