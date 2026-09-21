// tests/viz3d/devIsolation.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

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

/**
 * Every syntactic form a source file can use to pull in `three`:
 * `from 'three'` / `from "three"`, a subpath (`from 'three/src/...'`,
 * `from 'three/examples/...'`), either quote style, `import(...)` with either
 * quote style, `require(...)`, and a bare side-effect `import 'three'` with no
 * `from` clause at all. The narrower pattern this replaced
 * (`/from 'three'|from "three"|import\('three'\)/`) missed every one of
 * those except the plain single/double-quoted `from` form and a
 * single-quoted dynamic import - see the unit tests below, which fail
 * against the OLD pattern for exactly the forms it missed.
 */
const THREE_IMPORT =
  /from\s+['"]three(\/[^'"]*)?['"]|import\(\s*['"]three(\/[^'"]*)?['"]\s*\)|require\(\s*['"]three(\/[^'"]*)?['"]\s*\)|import\s+['"]three(\/[^'"]*)?['"]/;

/** Every relative import specifier (`from`, dynamic `import(...)`, `require(...)`) in a source file. */
function relativeImportSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /from\s+['"](\.[^'"]+)['"]/g,
    /import\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    /require\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (let m = re.exec(source); m; m = re.exec(source)) specs.push(m[1]!);
  }
  return specs;
}

/**
 * True when `source` (the contents of `file`) has a relative import that
 * resolves into `src/viz3d/dev/` - the direction the isolation guard never
 * checked before: not "does dev/ import three" but "does anything reach INTO
 * dev/ from outside it", which would drag three.js toward the bundle just as
 * surely as importing it directly.
 */
function importsDevDir(file: string, source: string): boolean {
  const devDir = join(root, 'src/viz3d/dev').replace(/\\/g, '/');
  return relativeImportSpecifiers(source).some((spec) => {
    const resolved = resolve(dirname(file), spec).replace(/\\/g, '/');
    return resolved === devDir || resolved.startsWith(devDir + '/');
  });
}

describe('the 3D tool stays out of the shipped bundle', () => {
  it('only files under src/viz3d/dev/ import three', () => {
    for (const file of sourceFiles(join(root, 'src'))) {
      const rel = file.slice(root.length + 1).replace(/\\/g, '/');
      const imports = THREE_IMPORT.test(readFileSync(file, 'utf8'));
      if (imports) expect(rel.startsWith('src/viz3d/dev/'), `${rel} imports three`).toBe(true);
    }
  });

  it('the widened three-import pattern catches forms the old narrower one missed', () => {
    // Each of these would have slipped straight past
    // /from 'three'|from "three"|import\('three'\)/ - proof the widening is
    // not cosmetic. Run this against the OLD pattern and every line fails.
    const missedByOldPattern = [
      "export * from 'three/src/Three.js';",
      'import { X } from "three/examples/jsm/controls/OrbitControls.js";',
      'import("three");',
      "const t = require('three');",
      "import 'three';",
    ];
    for (const source of missedByOldPattern) {
      expect(THREE_IMPORT.test(source), source).toBe(true);
    }
  });

  it('does not flag an unrelated package whose name merely starts with "three"', () => {
    expect(THREE_IMPORT.test("import x from 'threejs-utils';")).toBe(false);
    expect(THREE_IMPORT.test("import x from 'three-utils';")).toBe(false);
  });

  it('no file outside src/viz3d/dev/ imports from it, except main.ts\'s own DEV-guarded reference', () => {
    // The other direction the isolation guard never checked: a production
    // file reaching INTO dev/ (to reuse a type, a helper, anything) would
    // drag three.js toward the bundle just as surely as importing three
    // itself, and the three-import test above cannot see it - the offending
    // file need never mention 'three' by name.
    for (const file of sourceFiles(join(root, 'src'))) {
      const rel = file.slice(root.length + 1).replace(/\\/g, '/');
      if (rel.startsWith('src/viz3d/dev/')) continue; // dev/ files may reference each other freely
      const source = readFileSync(file, 'utf8');
      if (!importsDevDir(file, source)) continue;
      expect(rel, `${rel} imports from src/viz3d/dev/ - only main.ts's DEV-guarded dynamic import may`).toBe(
        'src/main.ts',
      );
    }
  });

  it('importsDevDir flags a scratch file that reaches into dev/, and clears one that does not', () => {
    // Proof this check can actually fail, without touching the real
    // filesystem: a fabricated file next to src/ui/ importing dev/'s scene
    // module is exactly the shape a regression would take.
    const fakeFile = join(root, 'src/ui/fake.ts');
    expect(importsDevDir(fakeFile, "import { createScene } from '../viz3d/dev/scene';")).toBe(true);
    expect(importsDevDir(fakeFile, "import { geometryFor } from '../viz3d/geometry';")).toBe(false);
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
