import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * index.html is hand-written and nothing else reads it, so a renamed asset or
 * a stale absolute URL there fails silently: the page still loads, it just
 * loses its icon or serves a 404 to every link preview. These assertions are
 * the cheapest possible guard - that every asset the head points at is a file
 * that actually exists.
 */
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const publicFile = (p: string) => resolve(__dirname, '../../public', p.replace(/^\//, ''));

describe('index.html head', () => {
  it('declares an SVG icon, a PNG fallback and an apple touch icon', () => {
    // SVG first so browsers that understand it never pick the raster.
    expect(html.indexOf('/favicon.svg')).toBeLessThan(html.indexOf('/favicon-32.png'));
    expect(html).toContain('rel="icon" href="/favicon.svg" type="image/svg+xml"');
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it('every icon it points at exists in public/', () => {
    const hrefs = [...html.matchAll(/<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)]
      .map((m) => m[1]!);
    expect(hrefs.length, 'no icon links found at all').toBeGreaterThan(0);
    for (const h of hrefs) {
      expect(existsSync(publicFile(h)), `${h} is declared but missing from public/`).toBe(true);
    }
  });

  it('the social card it advertises exists, at the size it claims', () => {
    const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
    expect(og, 'no og:image').toBeTruthy();
    const name = og!.split('/').pop()!;
    expect(existsSync(publicFile(name)), `${name} missing from public/`).toBe(true);
    // The dimensions are asserted to crawlers, so they should not be guesses.
    expect(html).toContain('og:image:width" content="1200"');
    expect(html).toContain('og:image:height" content="630"');
  });

  it('does not still describe the site with the line the landing page dropped', () => {
    // The lede was rewritten because "some of that beauty is in the numbers"
    // implies the rest is not really there. The og description shared the
    // flaw and was missed the first time; this stops it coming back.
    expect(html).not.toContain('Some of that beauty is in the numbers');
  });
});
