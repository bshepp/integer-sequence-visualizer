// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { shouldShowLanding, buildLanding, GALLERY_HASH } from '../../src/ui/landing';
import { encodeState } from '../../src/ui/urlState';
import { GALLERY } from '../../src/gallery/entries';
import { registerAll } from '../../src/viz/all';
import { clearRegistry } from '../../src/viz/registry';

beforeAll(() => { clearRegistry(); registerAll(); });

describe('landing routing', () => {
  it('shows for a bare URL', () => {
    expect(shouldShowLanding('')).toBe(true);
    expect(shouldShowLanding('#')).toBe(true);
  });

  it('shows for the reserved gallery hash', () => {
    expect(shouldShowLanding('#' + GALLERY_HASH)).toBe(true);
  });

  it('skips for a decodable engine state', () => {
    expect(shouldShowLanding('#' + encodeState(GALLERY[0]!.state))).toBe(false);
  });

  it('shows for an undecodable hash rather than opening a broken engine', () => {
    expect(shouldShowLanding('#not-valid-base64-json!!')).toBe(true);
  });

  it('the reserved hash cannot collide with a real encoded state', () => {
    for (const e of GALLERY) expect(encodeState(e.state)).not.toBe(GALLERY_HASH);
  });
});

describe('landing content', () => {
  it('renders one button per non-hero entry plus the engine link', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {}, onAbout: () => {} });
    expect(el.querySelectorAll('.gallery-thumb')).toHaveLength(GALLERY.length - 1);
    expect(el.querySelector('.landing-open')).not.toBeNull();
  });

  it('every thumbnail is a real button with an accessible name', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {}, onAbout: () => {} });
    for (const t of el.querySelectorAll('.gallery-thumb')) {
      expect(t.tagName).toBe('BUTTON');
      expect((t.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('calls onPick with the entry when a thumbnail is clicked', () => {
    const onPick = vi.fn();
    const el = buildLanding({ onOpen: () => {}, onPick, onAbout: () => {} });
    el.querySelector<HTMLButtonElement>('.gallery-thumb')!.click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(GALLERY).toContain(onPick.mock.calls[0]![0]);
  });

  it('calls onOpen from the engine button', () => {
    const onOpen = vi.fn();
    const el = buildLanding({ onOpen, onPick: () => {}, onAbout: () => {} });
    el.querySelector<HTMLButtonElement>('.landing-open')!.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('makes no network requests', () => {
    // The whole point of bundling each entry's Sequence: first paint must not
    // wait on /data/*.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    buildLanding({ onOpen: () => {}, onPick: () => {}, onAbout: () => {} });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('has exactly one h1 and links OEIS attribution', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {}, onAbout: () => {} });
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('a[href*="oeis.org"]')).not.toBeNull();
    expect(el.querySelector('a[href*="creativecommons.org"]')).not.toBeNull();
  });

  it('shows the hero verdict as a labelled tag, not a bare colour', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {}, onAbout: () => {} });
    const tag = el.querySelector('.landing-hero-caption .verdict')!;
    expect((tag.textContent ?? '').trim().length).toBeGreaterThan(0);
  });
});

import { routeFor, ABOUT_HASH } from '../../src/ui/landing';
import { buildAbout, CITATIONS } from '../../src/ui/about';

describe('three-page routing', () => {
  it('maps each hash to exactly one page', () => {
    expect(routeFor('')).toBe('landing');
    expect(routeFor('#')).toBe('landing');
    expect(routeFor('#' + GALLERY_HASH)).toBe('landing');
    expect(routeFor('#' + ABOUT_HASH)).toBe('about');
    expect(routeFor('#' + encodeState(GALLERY[0]!.state))).toBe('engine');
  });

  it('sends an undecodable hash to the landing rather than a broken engine', () => {
    expect(routeFor('#not-valid!!')).toBe('landing');
  });

  it('reserved words cannot collide with an encoded state', () => {
    for (const e of GALLERY) {
      const encoded = encodeState(e.state);
      expect(encoded).not.toBe(GALLERY_HASH);
      expect(encoded).not.toBe(ABOUT_HASH);
    }
  });
});

describe('about page', () => {
  const build = () => buildAbout({ onGallery: () => {}, onEngine: () => {} });

  it('offers navigation to both other pages', () => {
    const el = build();
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.page-nav-button')];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect((b.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('calls the right handler for each destination', () => {
    const onGallery = vi.fn(), onEngine = vi.fn();
    const el = buildAbout({ onGallery, onEngine });
    const [gallery, engine] = [...el.querySelectorAll<HTMLButtonElement>('.page-nav-button')];
    gallery!.click();
    engine!.click();
    expect(onGallery).toHaveBeenCalledTimes(1);
    expect(onEngine).toHaveBeenCalledTimes(1);
  });

  it('renders every citation with its reference text and a reason', () => {
    const el = build();
    const items = el.querySelectorAll('.citation-list li');
    expect(items).toHaveLength(CITATIONS.length);
    expect(CITATIONS.length).toBeGreaterThanOrEqual(5);
    for (const li of items) {
      expect(li.querySelector('.citation-text')!.textContent!.trim().length).toBeGreaterThan(20);
      expect(li.querySelector('.citation-note')!.textContent!.trim().length).toBeGreaterThan(10);
    }
  });

  it('keeps the two references supplied on the thread verbatim', () => {
    // These were given by Jean-Paul Allouche and are quoted, not paraphrased.
    const text = CITATIONS.map((c) => c.text).join(' ');
    expect(text).toContain('J. Reine Angew. Math. 329 (1981), 143–153');
    expect(text).toContain('Banach Center Publ. 17, PWN, Warsaw, 1985, pp. 75–82');
  });

  it('has one h1 and states the AI disclosure', () => {
    const el = build();
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.textContent).toMatch(/Opus 5/);
    expect(el.textContent).toMatch(/CC BY-SA 4\.0/);
  });

  it('opens every external link safely', () => {
    const el = build();
    for (const a of el.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')) {
      expect(a.rel).toContain('noopener');
    }
  });
});
