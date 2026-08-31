// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountApp } from '../../src/ui/app';

/**
 * Leaving the landing page has to leave a way back to it.
 *
 * Reported from the live site: engine, then Worked examples, then click an
 * example, then Back - and Back went to the previous *drawing* rather than to
 * the gallery. goTo() reaches the reserved pages by assigning location.hash,
 * which pushes a history entry, but openEntry() then wrote over that entry
 * with replaceState, so the gallery left no trace in history at all.
 */
const HASH_STATE = /^#.*viz=/;

describe('browser history through the landing page', () => {
  let push: ReturnType<typeof vi.spyOn>;
  let replace: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    history.replaceState(null, '', location.pathname); // start with no hash
    push = vi.spyOn(history, 'pushState');
    replace = vi.spyOn(history, 'replaceState');
  });
  afterEach(() => {
    push.mockRestore();
    replace.mockRestore();
    history.replaceState(null, '', location.pathname);
  });

  const mount = () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountApp(root);
    return root;
  };

  it('pushes when an example opens the engine, so Back can return', () => {
    const root = mount();
    const hero = root.querySelector<HTMLButtonElement>('.landing-hero-button');
    expect(hero, 'landing did not mount, so nothing is being tested').not.toBeNull();
    push.mockClear();
    hero!.click();
    const pushed = (push.mock.calls as unknown[][]).map((c) => String(c[2]));
    expect(pushed.some((h: string) => HASH_STATE.test(h)),
      `openEntry pushed nothing; calls were ${JSON.stringify(pushed)}`).toBe(true);
  });

  it('does not push for an ordinary redraw, which is not a place to go back to', () => {
    // The other half of the rule. If syncUrl pushed, every parameter nudge
    // would need its own press of Back to escape.
    const root = mount();
    root.querySelector<HTMLButtonElement>('.landing-hero-button')!.click();
    push.mockClear();
    replace.mockClear();
    window.dispatchEvent(new Event('resize'));
    root.querySelector<HTMLSelectElement>('.viz-picker')!.dispatchEvent(new Event('change'));
    expect(push).not.toHaveBeenCalled();
  });

  it('leaves the landing reachable again by its reserved hash', () => {
    // What Back actually lands on: the hash the gallery was pushed under. The
    // route has to still resolve to the landing after the engine has been
    // opened once, or going back would show an engine with no overlay.
    const root = mount();
    root.querySelector<HTMLButtonElement>('.landing-hero-button')!.click();
    expect(root.querySelector('.landing'), 'overlay should be gone').toBeNull();

    location.hash = '#examples';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(root.querySelector('.landing'), 'going back to #examples must re-show it').not.toBeNull();
  });
});
