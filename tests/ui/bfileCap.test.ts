// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Sequence } from '../../src/sequence/sequence';

// Hoisted because vi.mock is: a plain const declared above would still be in
// its temporal dead zone when the factory runs.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

// Only fetchBFile is replaced. The panel also imports lookupById, searchByName
// and the paste/formula builders from this module, and a bare vi.mock would
// blank all of them.
vi.mock('../../src/sequence/oeisClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/sequence/oeisClient')>()),
  fetchBFile: (...args: unknown[]) => fetchMock(...args),
}));

const { buildSequencePanel } = await import('../../src/ui/sequencePanel');

const FIB: Sequence = {
  terms: [1n], aNumber: 'A000045', name: 'Fibonacci numbers', offset: 0, source: 'oeis',
};

/** A panel wired the way the app wires it: onSequence feeds setInfo. */
function panelWithInfo() {
  const panel = buildSequencePanel({
    onSequence: (s: Sequence) => panel.setInfo(s),
    onError: () => {},
  });
  return panel;
}

const q = <T extends Element>(root: Element, sel: string): T => root.querySelector<T>(sel)!;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => fetchMock.mockReset());

describe('the b-file button says how many terms it will fetch', () => {
  it('names the cap before anything is touched', () => {
    const { el } = panelWithInfo();
    expect(q<HTMLButtonElement>(el, '.bfile-button').textContent)
      .toBe('Load up to 10,000 terms (b-file)');
  });

  it('follows the cap box', () => {
    const { el } = panelWithInfo();
    const cap = q<HTMLInputElement>(el, '.bfile-cap');
    cap.value = '250';
    cap.dispatchEvent(new Event('input'));
    expect(q<HTMLButtonElement>(el, '.bfile-button').textContent)
      .toBe('Load up to 250 terms (b-file)');
  });

  it('follows the slider, which is the control most people will reach for', () => {
    const { el } = panelWithInfo();
    const slider = q<HTMLInputElement>(el, '.bfile-slider');
    slider.value = '0'; // the bottom of the log range
    slider.dispatchEvent(new Event('input'));
    expect(q<HTMLButtonElement>(el, '.bfile-button').textContent)
      .toBe('Load up to 50 terms (b-file)');
  });
});

describe('the terms display says whether that is all of them', () => {
  it('a complete fetch stops the control offering more than exists', async () => {
    // The A000040 case generalised: the fetch came back under its own cap, so
    // the b-file's exact length is now known and there is nothing further to
    // ask for. Raising the cap afterwards cannot buy a term.
    fetchMock.mockResolvedValue({ terms: [1n, 2n, 3n], truncated: false });
    const panel = panelWithInfo();
    panel.setInfo(FIB);
    q<HTMLButtonElement>(panel.el, '.bfile-button').click();
    await flush();

    const note = q(panel.el, '.info-bfile-note');
    expect(note.textContent).toMatch(/every term in the b-file/i);
    expect(note.classList.contains('info-bfile-note--capped')).toBe(false);
    expect(q<HTMLInputElement>(panel.el, '.bfile-cap').max).toBe('3');
  });

  it('a truncated fetch says so, and keeps the ceiling open', async () => {
    // Truncation proves only that there is more, which is not a number, so the
    // optimistic ceiling has to stand or the reader could not go and get it.
    fetchMock.mockResolvedValue({ terms: [1n, 2n], truncated: true });
    const panel = panelWithInfo();
    panel.setInfo(FIB);
    q<HTMLButtonElement>(panel.el, '.bfile-button').click();
    await flush();

    const note = q(panel.el, '.info-bfile-note');
    expect(note.textContent).toMatch(/capped at 2/i);
    expect(note.classList.contains('info-bfile-note--capped')).toBe(true);
    expect(q<HTMLInputElement>(panel.el, '.bfile-cap').max).toBe('100000');
  });

  it('forgets what it learned when a different sequence is loaded', async () => {
    // A ceiling learned from one b-file says nothing about the next, and
    // carrying it over would silently cap an unrelated fetch.
    fetchMock.mockResolvedValue({ terms: [1n, 2n, 3n], truncated: false });
    const panel = panelWithInfo();
    panel.setInfo(FIB);
    q<HTMLButtonElement>(panel.el, '.bfile-button').click();
    await flush();
    expect(q<HTMLInputElement>(panel.el, '.bfile-cap').max).toBe('3');

    panel.setInfo({ ...FIB, aNumber: 'A000002', name: 'Kolakoski' });
    expect(q<HTMLInputElement>(panel.el, '.bfile-cap').max).toBe('100000');
    expect(panel.el.querySelector('.info-bfile-note')).toBeNull();
  });

  it('says nothing about a stored snapshot, which cannot know', () => {
    // The snapshot caps terms per sequence and reports no total, so any claim
    // here would be a guess.
    const panel = panelWithInfo();
    panel.setInfo(FIB);
    expect(panel.el.querySelector('.info-bfile-note')).toBeNull();
  });
});
