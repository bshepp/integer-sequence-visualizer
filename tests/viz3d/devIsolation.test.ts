// tests/viz3d/devIsolation.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * The 3D tool is for the author's machine. The moment `three` reaches the
 * shipped bundle, visitors pay ~150KB for a control they never see - and that
 * regresses silently, because everything still works in dev.
 */
const root = resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/** The body of every `if (import.meta.env.DEV …) { … }` block, brace-matched. */
function devGuardedBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = /if \(import\.meta\.env\.DEV/g;
  for (let m = marker.exec(source); m; m = marker.exec(source)) {
    const open = source.indexOf('{', m.index);
    if (open < 0) continue;
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) { blocks.push(source.slice(open + 1, i)); break; }
      }
    }
  }
  return blocks;
}

describe('the 3D tool stays out of the shipped bundle', () => {
  it('only files under src/viz3d/dev/ import three', () => {
    for (const file of sourceFiles(join(root, 'src'))) {
      const rel = file.slice(root.length + 1).replace(/\\/g, '/');
      const imports = /from 'three'|from "three"|import\('three'\)/.test(readFileSync(file, 'utf8'));
      if (imports) expect(rel.startsWith('src/viz3d/dev/'), `${rel} imports three`).toBe(true);
    }
  });

  it('main.ts reaches the route only inside a DEV guard, by dynamic import', () => {
    const main = readFileSync(join(root, 'src/main.ts'), 'utf8');
    const line = main.split('\n').find((l) => l.includes('viz3d/dev/route'));
    expect(line, 'main.ts does not reference the 3D route').toBeTruthy();
    expect(line!).toMatch(/import\(/);

    // A wildcard scan can cross a preceding guard's closing brace and still
    // "find" the marker text further down, unguarded - so this is a
    // structural, brace-matched check rather than a regex with a distance
    // cap. It also requires the reference to be unique, so a second,
    // unguarded copy elsewhere in the file can't slip past the first check.
    const blocks = devGuardedBlocks(main);
    expect(blocks.some((b) => b.includes("import('./viz3d/dev/route')"))).toBe(true);
    expect(main.split('viz3d/dev/route').length - 1).toBe(1);
  });

  it('the guard check itself trips when the import escapes its block', () => {
    const escaped = "if (import.meta.env.DEV && a) { void import('./ui/ogCard'); }\nvoid import('./viz3d/dev/route');\n";
    expect(devGuardedBlocks(escaped).some((b) => b.includes('viz3d/dev/route'))).toBe(false);
  });
});
