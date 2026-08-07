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
    const el = buildLanding({ onOpen: () => {}, onPick: () => {} });
    expect(el.querySelectorAll('.gallery-thumb')).toHaveLength(GALLERY.length - 1);
    expect(el.querySelector('.landing-open')).not.toBeNull();
  });

  it('every thumbnail is a real button with an accessible name', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {} });
    for (const t of el.querySelectorAll('.gallery-thumb')) {
      expect(t.tagName).toBe('BUTTON');
      expect((t.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('calls onPick with the entry when a thumbnail is clicked', () => {
    const onPick = vi.fn();
    const el = buildLanding({ onOpen: () => {}, onPick });
    el.querySelector<HTMLButtonElement>('.gallery-thumb')!.click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(GALLERY).toContain(onPick.mock.calls[0]![0]);
  });

  it('calls onOpen from the engine button', () => {
    const onOpen = vi.fn();
    const el = buildLanding({ onOpen, onPick: () => {} });
    el.querySelector<HTMLButtonElement>('.landing-open')!.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('makes no network requests', () => {
    // The whole point of bundling each entry's Sequence: first paint must not
    // wait on /data/*.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    buildLanding({ onOpen: () => {}, onPick: () => {} });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('has exactly one h1 and links OEIS attribution', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {} });
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('a[href*="oeis.org"]')).not.toBeNull();
    expect(el.querySelector('a[href*="creativecommons.org"]')).not.toBeNull();
  });

  it('shows the hero verdict as a labelled tag, not a bare colour', () => {
    const el = buildLanding({ onOpen: () => {}, onPick: () => {} });
    const tag = el.querySelector('.landing-hero-caption .verdict')!;
    expect((tag.textContent ?? '').trim().length).toBeGreaterThan(0);
  });
});
