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

import { mountApp } from '../../src/ui/app';
import { buildAbout } from '../../src/ui/about';

describe('the theme switch reaches every page', () => {
  // The landing and About cover the engine and mark it inert, so the switch
  // in the engine header is not merely hidden there - it is unreachable.
  const mountEngine = () => {
    history.replaceState(null, '', location.pathname);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    return root;
  };

  it('is on the landing page', () => {
    const root = mountEngine();
    const toggle = root.querySelector<HTMLButtonElement>('.landing .theme-toggle');
    expect(toggle, 'no theme switch on the landing').not.toBeNull();
    expect(toggle!.textContent).toMatch(/light|dark/i);
  });

  it('is on the About page, after the navigation and not stealing its focus', () => {
    const el = buildAbout({ onExamples() {}, onEngine() {}, themeToggle: (() => {
      const b = document.createElement('button');
      b.className = 'theme-toggle';
      return b;
    })() });
    const nav = el.querySelector('.page-nav')!;
    expect(nav.querySelector('.theme-toggle')).not.toBeNull();
    expect(nav.lastElementChild!.classList.contains('theme-toggle')).toBe(true);
    // showAbout focuses the first .page-nav-button; the switch must not be it.
    expect(el.querySelector('.page-nav-button')!.classList.contains('theme-toggle')).toBe(false);
  });

  it('leaves no stale label on the engine switch behind the overlay', () => {
    // Two live switches for one setting. The engine's is inert under the
    // overlay, and if it kept its old caption it would be wrong the moment
    // the visitor returned to it.
    const root = mountEngine();
    const landing = root.querySelector<HTMLButtonElement>('.landing .theme-toggle')!;
    const engine = root.querySelector<HTMLButtonElement>('.header-nav .theme-toggle')!;
    landing.click();
    expect(engine.textContent).toBe(landing.textContent);
    landing.click();
    expect(engine.textContent).toBe(landing.textContent);
  });
});

describe('a cold load lands on the page the address names', () => {
  const mountAt = (hash: string) => {
    history.replaceState(null, '', location.pathname + hash);
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    return root;
  };

  it('#about opens About, not the gallery', () => {
    // The initial router only asked "engine or not", so a cold load of #about
    // fell through to the landing. hashchange routed it correctly, so this
    // only ever broke on first load - which is precisely what a shared link
    // does, and #about is the address that points at the citations.
    const root = mountAt('#about');
    expect(root.querySelector('.about'), '#about did not open About').not.toBeNull();
    expect(root.querySelector('.landing')).toBeNull();
  });

  it('#gallery still opens the gallery', () => {
    const root = mountAt('#gallery');
    expect(root.querySelector('.landing')).not.toBeNull();
    expect(root.querySelector('.about')).toBeNull();
  });

  it('a bare address still opens the gallery', () => {
    const root = mountAt('');
    expect(root.querySelector('.landing')).not.toBeNull();
  });
});

import { FEEDBACK_LABEL } from '../../src/ui/feedbackLink';

describe('feedback is reachable from every page', () => {
  const ISSUES = 'https://github.com/bshepp/integer-sequence-visualizer/issues/new';
  const noop = () => {};

  it('is on the gallery and the About page, not only in the engine', () => {
    // These are the two pages a visitor is most likely to arrive on - the
    // gallery from a shared link, About from a citation - and neither offered
    // any way to say something back.
    const landing = buildLanding({ onOpen: noop, onPick: noop, onAbout: noop });
    const about = buildAbout({ onExamples: noop, onEngine: noop });
    for (const [name, el] of [['landing', landing], ['about', about]] as const) {
      const a = el.querySelector<HTMLAnchorElement>(`a[href="${ISSUES}"]`);
      expect(a, `no feedback link on the ${name}`).not.toBeNull();
      expect(a!.textContent).toBe(FEEDBACK_LABEL);
      expect(a!.rel).toContain('noopener');
      expect(a!.target).toBe('_blank');
    }
  });

  it('says the same thing in all three places', () => {
    // Three hand-written copies is how a label and a URL drift apart, and a
    // broken feedback link fails silently on the one person who bothered.
    const root = (() => {
      history.replaceState(null, '', location.pathname);
      const r = document.createElement('div');
      document.body.appendChild(r);
      mountApp(r);
      r.querySelector<HTMLButtonElement>('.landing-open')?.click();
      return r;
    })();
    const engine = root.querySelector<HTMLAnchorElement>(`.export-bar a[href="${ISSUES}"]`);
    expect(engine, 'engine lost its feedback link').not.toBeNull();
    expect(engine!.textContent).toBe(FEEDBACK_LABEL);
  });
});
