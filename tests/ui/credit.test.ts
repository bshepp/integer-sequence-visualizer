// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildLanding } from '../../src/ui/landing';
import { CITATIONS } from '../../src/ui/about';

const NCURVE = 'https://openprocessing.org/@GeorgeWhaleResearch/2986029';

/**
 * The debt to NCurve is the one piece of attribution that has to be right.
 * It was on the About page and in the README but absent from the landing page,
 * which is the only page most visitors will ever see.
 */
describe('NCurve credit', () => {
  it('is on the landing page, linked, not just on About', () => {
    const el = buildLanding({ onOpen() {}, onPick() {}, onAbout() {} });
    const credit = el.querySelector('.landing-credit');
    expect(credit, 'no credit line on the landing page').not.toBeNull();
    expect(credit!.textContent).toContain('George Whale');
    expect(credit!.textContent).toContain('NCurve');
    const link = credit!.querySelector<HTMLAnchorElement>('a');
    expect(link?.href).toBe(NCURVE);
  });

  it('claims "prompted by", not "based on"', () => {
    // Accuracy is the point of crediting. One of nine views is NCurve-style
    // and none of its code is here, so "based on" would overstate the debt in
    // a way that implies George had a hand in the rest.
    const el = buildLanding({ onOpen() {}, onPick() {}, onAbout() {} });
    const text = el.querySelector('.landing-credit')!.textContent!;
    expect(text.toLowerCase()).toContain('prompted by');
    expect(text.toLowerCase()).not.toContain('based on');
  });

  it('is in the README, with a working link rather than a bare name', () => {
    const readme = readFileSync(resolve(__dirname, '../../README.md'), 'utf8');
    expect(readme).toContain(NCURVE);
    expect(readme).toContain('George Whale');
  });

  it('is in the citations, credited to George Whale', () => {
    const c = CITATIONS.find((x) => x.href === NCURVE);
    expect(c, 'NCurve missing from CITATIONS').toBeTruthy();
    expect(c!.text).toContain('George Whale');
  });
});
