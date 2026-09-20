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
    const guard = main.slice(0, main.indexOf('viz3d/dev/route'));
    expect(guard).toMatch(/import\.meta\.env\.DEV[^]*$/);
  });
});
