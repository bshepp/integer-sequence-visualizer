// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildLanding, HEADLINE } from '../../src/ui/landing';
import { buildAbout } from '../../src/ui/about';

/**
 * The language rules the site has to keep, enforced rather than remembered.
 *
 * Both of these were live on the deployed site at once, and both are the same
 * failure: copy written in one file drifting away from what the apparatus in
 * another file actually does. Prose has no compiler, so it gets one here.
 */

const root = resolve(__dirname, '../..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

/** Every .ts under src/, so a new file cannot quietly reintroduce a banned phrase. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const SOURCES = sourceFiles(join(root, 'src')).map((f) => ({
  path: f.slice(root.length + 1).replace(/\\/g, '/'),
  text: readFileSync(f, 'utf8'),
}));

describe('the headline says the same thing everywhere', () => {
  it('index.html carries it in the title and both social cards', () => {
    // Three copies in a file no bundler touches, so nothing but this test
    // notices when they fall out of step with the page they describe.
    for (const tag of ['<title>Ulam - ', 'og:title" content="Ulam - ', 'twitter:title" content="Ulam - ']) {
      const at = html.indexOf(tag);
      expect(at, `${tag} missing from index.html`).toBeGreaterThan(-1);
      // Case-insensitively: the h1 opens a sentence and these follow a dash,
      // so "Which" and "which" are both correct in their own place.
      expect(html.slice(at, at + tag.length + HEADLINE.length).toLowerCase())
        .toContain(HEADLINE.toLowerCase());
    }
  });

  it('the landing page renders it as the h1', () => {
    const el = buildLanding({ onOpen() {}, onPick() {}, onAbout() {} });
    expect(el.querySelector('h1.landing-title')!.textContent).toBe(HEADLINE);
  });

  it('does not promise a verdict on reality anywhere it used to', () => {
    // "Is that pattern real?" was the title, both social titles, the landing
    // h1 and the text baked into the social card image. A null model answers
    // whether one named number is reproduced by one named scrambling, and no
    // arrangement of that machinery decides whether a pattern is real.
    // Checked against what the pages actually render rather than against the
    // source text, so the comments recording why it went can quote it.
    expect(html).not.toMatch(/is that pattern real/i);
    const landing = buildLanding({ onOpen() {}, onPick() {}, onAbout() {} });
    const about = buildAbout({ onExamples() {}, onEngine() {} });
    for (const [name, el] of [['landing', landing], ['about', about]] as const) {
      expect(el.textContent ?? '', `${name} still asks whether a pattern is real`)
        .not.toMatch(/is that pattern real/i);
    }
  });
});

describe('"survives" means one thing on this site', () => {
  // It meant two opposite things, in copy a reader met in a single session.
  //
  //   "the pattern survives the shuffle"  - still there after scrambling, so
  //                                         the technique drew it: boring
  //   "the finding survives the null"     - the null did not reproduce it, so
  //                                         the finding stands: interesting
  //
  // The second is the one the code speaks - `survives-steps`, RUNGS,
  // highestSurviving() - and the one the surrogate literature uses, so the
  // first had to go. Anyone learning it from a visualizer's info popover read
  // "Survives all three nulls" on the gallery as exactly its opposite.
  // Widened after the first version missed one. It banned "survives the
  // shuffle" and "survives the scrambling" but not "survives the destruction",
  // which is what the null-model info panel said - the one place on the site
  // whose job is to define the term, teaching the losing sense of it. Matching
  // the verb against the thing being destroyed, rather than against a fixed
  // list of two nouns, is what should have been written first.
  const BANNED = [
    /survives?\s+(the\s+)?(shuffl|scrambl|destruct|permut|reorder)/i,
    /(pattern|feature|structure)\s+survives?/i,
    /survives?\s+having/i,
  ];

  it('is never applied to a pattern outlasting a scrambling', () => {
    for (const { path, text } of SOURCES) {
      for (const pattern of BANNED) {
        const hit = pattern.exec(text);
        expect(hit, `${path}: "${hit?.[0]}" is the boring sense of survive`).toBeNull();
      }
    }
  });

  it('the About page explains the null without reaching for the word', () => {
    const el = buildAbout({ onExamples() {}, onEngine() {} });
    const method = el.textContent ?? '';
    expect(method).toMatch(/still there once the numbers underneath have been scrambled/i);
    // And it still says the thing the whole page exists to say.
    expect(method).toMatch(/cannot tell you whether/i);
  });
});

describe('claims are bounded to what was actually run', () => {
  it('no copy claims a result holds against every null there could be', () => {
    // Three nulls are implemented. "Survives every null" invites the reading
    // "every null model that exists", which is infinitely many.
    for (const { path, text } of SOURCES) {
      expect(text, `${path} claims a result against every possible null`)
        .not.toMatch(/(outside|survives?)\s+every\s+null/i);
    }
  });

  it('the About page names the eye-versus-statistic gap', () => {
    // Issue #4's second half. The site's sharpest entry is entirely about the
    // difference between the star you see and the alternation that gets
    // measured, and the copy above it used to flatten exactly that.
    const el = buildAbout({ onExamples() {}, onEngine() {} });
    const text = el.textContent ?? '';
    expect(text).toMatch(/what you see and what gets measured are different objects/i);
    expect(text).toMatch(/names its statistic/i);
  });
});
