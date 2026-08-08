# OEIS Sequence Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static webpage that renders OEIS sequences with nine Canvas-2D visualizers and a first-class null-model comparison layer (surrogates, side-by-side/flip, ensemble bands), plus parameter sweeps and shareable URLs.

**Architecture:** Vite + TypeScript static frontend, no UI framework, all rendering client-side on Canvas 2D. Visualizers are pure `render(seq, params, ctx, size)` modules composed by a null-model layer and a sweep view. A small Cloudflare Worker proxies oeis.org under `/api/*`; Vite's dev proxy substitutes for it locally.

**Tech Stack:** TypeScript 5, Vite 5, Vitest (+ jsdom for UI tests), Cloudflare Workers (wrangler). No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-05-oeis-visualizer-design.md` (approved 2026-08-05).

## Global Constraints

- No UI framework, no runtime npm dependencies. Dev dependencies only (vite, typescript, vitest, jsdom).
- Sequence terms are `bigint` everywhere in the data layer; visualizers consume numbers ONLY via `SequenceView` accessors.
- All randomness is seeded (mulberry32). No `Math.random()` anywhere in `src/`.
- Visualizer `render` functions are pure: no module state, no DOM access, draw only via the passed `ctx`.
- OEIS is reached ONLY via relative `/api/*` URLs (dev proxy or deployed Worker), never `oeis.org` directly from page code.
- B-file loads cap at 10,000 terms by default (user-raisable in the UI).
- Ensemble default N=200, max N=1000, computed in a Web Worker.
- Errors surface as visible UI messages; never a silently blank canvas.
- Dark theme. Executor: load the `dataviz` skill before implementing Tasks 9–13 and 16, and the `frontend-design` skill before Task 15.
- Commit after every task (at minimum); use `feat:`/`test:`/`chore:` prefixes.

## File Structure

```
index.html                      Page shell, mounts src/main.ts
vite.config.ts                  Dev proxy for /api → oeis.org
package.json / tsconfig.json    Scaffolding
src/
  main.ts                       Bootstraps App
  style.css                     Dark-theme layout styles
  sequence/
    sequence.ts                 Sequence type + SequenceView accessors
    pasteParser.ts              parsePasted(text) → bigint[]
    formula.ts                  compileFormula(src) → (n: bigint) => bigint
    oeisClient.ts               lookupById, search, fetchBFile (via /api)
    presets.ts                  PRESETS: the SeqFan finds + classics
  viz/
    types.ts                    Visualizer, ParamSpec, Params, Size
    registry.ts                 registerVisualizer / getVisualizer / allVisualizers
    scatter.ts                  basic: term-vs-index scatter
    differences.ts              basic: differences & ratios
    histogram.ts                stats: histogram (terms/gaps/digits/leading)
    autocorrelation.ts          stats: lag correlation
    gridUtils.ts                spiralCoord(i) shared helper
    ulamSpiral.ts               grid: Ulam-style spiral
    modGrid.ts                  grid: mod-N row-major fill
    turtle.ts                   trajectory: turtle walk (+ exported turtlePath)
    digitWalk.ts                trajectory: 2D digit walk (+ exported digitWalkPath)
    polyarc.ts                  trajectory: NCurve-style polyarc (+ exported polyarcPath)
  nullmodel/
    rng.ts                      mulberry32(seed), shuffleInPlace(arr, rand)
    surrogates.ts               permutationSurrogate, differenceSurrogate, matchedRandomSurrogate
    bands.ts                    percentileBands(arrays, lo, hi)
    ensemble.ts                 runEnsemble(job) → EnsembleResult (pure, worker-independent)
    ensembleWorker.ts           Web Worker wrapper around runEnsemble
  ui/
    app.ts                      App: wires sidebar, topbar, canvas, comparison, sweep
    paramControls.ts            buildParamControls(specs, values, onChange) → HTMLElement
    sequencePanel.ts            Input tabs, presets shelf, info card
    comparison.ts               Comparison mode state + split-canvas rendering
    sweep.ts                    Sweep thumbnail grid
    urlState.ts                 encodeState/decodeState ↔ location.hash
    messages.ts                 showError/showNotice banners
functions/
  api/[[path]].ts               Cloudflare Pages Function: /api/* → oeis.org + 24h cache
tests/                          Mirrors src/ (tests/sequence/, tests/viz/, ...)
  fixtures/                     Recorded OEIS JSON + b-file text
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/style.css`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm run dev`, `npm test`, `npm run build`; `/api/*` proxied to `https://oeis.org/*` in dev.

- [ ] **Step 1: Init npm and install dev deps**

```bash
npm init -y
npm install -D vite typescript vitest jsdom
```

- [ ] **Step 2: Write config files**

Edit `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts` (vitest reads the `test` key from the same file via a triple-slash types reference):

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://oeis.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
```

`.gitignore`:

```
node_modules/
dist/
.wrangler/
```

- [ ] **Step 3: Write page shell**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OEIS Sequence Visualizer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:

```ts
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.textContent = 'OEIS Sequence Visualizer - scaffold OK';
```

`src/style.css` (starter; Task 15 expands it):

```css
:root {
  color-scheme: dark;
  --bg: #14161a;
  --panel: #1d2026;
  --text: #e6e6e6;
  --muted: #9aa0aa;
  --accent: #7aa2f7;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; }
```

- [ ] **Step 4: Verify dev server and build**

Run: `npm run dev` - open the printed URL, confirm the scaffold text renders on a dark page, then stop the server.
Run: `npm run build` - expected: completes without errors.
Run: `npm test` - expected: passes (no test files yet).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Vitest with /api dev proxy"
```

---

### Task 2: Sequence model and SequenceView

**Files:**
- Create: `src/sequence/sequence.ts`
- Test: `tests/sequence/sequence.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all later tasks depend on these exact shapes):

```ts
export type SequenceSource = 'oeis' | 'paste' | 'formula';

export interface Sequence {
  terms: bigint[];
  aNumber?: string;      // "A000045" - present when source === 'oeis'
  name: string;          // OEIS name, or "Pasted sequence" / the formula text
  offset: number;        // index of first term (OEIS offset), 0 for paste/formula
  source: SequenceSource;
}

export class SequenceView {
  constructor(readonly seq: Sequence) {}
  get length(): number;
  term(i: number): bigint;              // throws RangeError if out of [0, length)
  toNumber(i: number): number;          // clamped to ±Number.MAX_SAFE_INTEGER
  logMagnitude(i: number): number;      // log10(|term|); 0 for term 0
  mod(i: number, n: number): number;    // mathematical mod, result in [0, n)
  digits(i: number, base?: number): number[]; // |term| digits, most significant first; base default 10
  sign(i: number): -1 | 0 | 1;
}
```

- [ ] **Step 1: Write the failing tests**

`tests/sequence/sequence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Sequence, SequenceView } from '../../src/sequence/sequence';

function mkSeq(terms: bigint[]): Sequence {
  return { terms, name: 'test', offset: 0, source: 'paste' };
}

describe('SequenceView', () => {
  it('exposes length and raw terms', () => {
    const v = new SequenceView(mkSeq([0n, 1n, 1n, 2n, 3n]));
    expect(v.length).toBe(5);
    expect(v.term(3)).toBe(2n);
    expect(() => v.term(5)).toThrow(RangeError);
    expect(() => v.term(-1)).toThrow(RangeError);
  });

  it('toNumber clamps beyond float64 safe range', () => {
    const huge = 10n ** 30n;
    const v = new SequenceView(mkSeq([7n, -7n, huge, -huge]));
    expect(v.toNumber(0)).toBe(7);
    expect(v.toNumber(1)).toBe(-7);
    expect(v.toNumber(2)).toBe(Number.MAX_SAFE_INTEGER);
    expect(v.toNumber(3)).toBe(-Number.MAX_SAFE_INTEGER);
  });

  it('logMagnitude works for huge values via digit count', () => {
    const v = new SequenceView(mkSeq([0n, 1000n, -1000n, 10n ** 25n]));
    expect(v.logMagnitude(0)).toBe(0);
    expect(v.logMagnitude(1)).toBeCloseTo(3, 5);
    expect(v.logMagnitude(2)).toBeCloseTo(3, 5);
    expect(v.logMagnitude(3)).toBeCloseTo(25, 5);
  });

  it('mod is mathematical (never negative)', () => {
    const v = new SequenceView(mkSeq([-7n, 7n]));
    expect(v.mod(0, 5)).toBe(3);
    expect(v.mod(1, 5)).toBe(2);
  });

  it('digits returns most-significant-first in the given base', () => {
    const v = new SequenceView(mkSeq([123n, -45n, 0n]));
    expect(v.digits(0)).toEqual([1, 2, 3]);
    expect(v.digits(1)).toEqual([4, 5]);   // absolute value
    expect(v.digits(2)).toEqual([0]);
    expect(v.digits(0, 2)).toEqual([1, 1, 1, 1, 0, 1, 1]); // 123 = 0b1111011
  });

  it('sign', () => {
    const v = new SequenceView(mkSeq([-3n, 0n, 9n]));
    expect(v.sign(0)).toBe(-1);
    expect(v.sign(1)).toBe(0);
    expect(v.sign(2)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sequence/sequence.test.ts`
Expected: FAIL - cannot resolve `src/sequence/sequence`.

- [ ] **Step 3: Implement**

`src/sequence/sequence.ts`:

```ts
export type SequenceSource = 'oeis' | 'paste' | 'formula';

export interface Sequence {
  terms: bigint[];
  aNumber?: string;
  name: string;
  offset: number;
  source: SequenceSource;
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export class SequenceView {
  constructor(readonly seq: Sequence) {}

  get length(): number {
    return this.seq.terms.length;
  }

  term(i: number): bigint {
    const t = this.seq.terms[i];
    if (t === undefined) throw new RangeError(`term index ${i} out of range`);
    return t;
  }

  toNumber(i: number): number {
    const t = this.term(i);
    if (t > MAX_SAFE) return Number.MAX_SAFE_INTEGER;
    if (t < -MAX_SAFE) return -Number.MAX_SAFE_INTEGER;
    return Number(t);
  }

  logMagnitude(i: number): number {
    const t = this.term(i);
    if (t === 0n) return 0;
    const s = (t < 0n ? -t : t).toString();
    // log10(d.dddd × 10^(len-1)) = (len-1) + log10(leading digits)
    const lead = Number(s.slice(0, 15)) / 10 ** (Math.min(s.length, 15) - 1);
    return s.length - 1 + Math.log10(lead);
  }

  mod(i: number, n: number): number {
    const bn = BigInt(n);
    return Number(((this.term(i) % bn) + bn) % bn);
  }

  digits(i: number, base = 10): number[] {
    let t = this.term(i);
    if (t < 0n) t = -t;
    if (t === 0n) return [0];
    const b = BigInt(base);
    const out: number[] = [];
    while (t > 0n) {
      out.push(Number(t % b));
      t /= b;
    }
    return out.reverse();
  }

  sign(i: number): -1 | 0 | 1 {
    const t = this.term(i);
    return t < 0n ? -1 : t > 0n ? 1 : 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sequence/sequence.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sequence/sequence.ts tests/sequence/sequence.test.ts
git commit -m "feat: Sequence model and BigInt-safe SequenceView accessors"
```

---

### Task 3: Paste parser

**Files:**
- Create: `src/sequence/pasteParser.ts`
- Test: `tests/sequence/pasteParser.test.ts`

**Interfaces:**
- Consumes: `Sequence` from Task 2.
- Produces:

```ts
export function parsePasted(text: string): bigint[];   // throws Error with a human message on bad tokens
export function sequenceFromPaste(text: string): Sequence; // name "Pasted sequence", offset 0, source 'paste'
```

- [ ] **Step 1: Write the failing tests**

`tests/sequence/pasteParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePasted, sequenceFromPaste } from '../../src/sequence/pasteParser';

describe('parsePasted', () => {
  it('parses comma-separated integers', () => {
    expect(parsePasted('0, 1, 1, 2, 3, 5')).toEqual([0n, 1n, 1n, 2n, 3n, 5n]);
  });

  it('parses whitespace/newline separated and bracketed input', () => {
    expect(parsePasted('[8\n 13  21]')).toEqual([8n, 13n, 21n]);
    expect(parsePasted('{1, 2, 3}')).toEqual([1n, 2n, 3n]);
  });

  it('handles negatives and huge values', () => {
    expect(parsePasted('-5, 1234567890123456789012345')).toEqual([
      -5n,
      1234567890123456789012345n,
    ]);
  });

  it('rejects non-integer tokens with a useful message', () => {
    expect(() => parsePasted('1, banana, 3')).toThrow(/banana/);
    expect(() => parsePasted('1.5, 2')).toThrow(/1\.5/);
  });

  it('rejects empty input', () => {
    expect(() => parsePasted('  ')).toThrow(/no numbers/i);
  });

  it('sequenceFromPaste wraps into a Sequence', () => {
    const s = sequenceFromPaste('4, 5');
    expect(s.terms).toEqual([4n, 5n]);
    expect(s.source).toBe('paste');
    expect(s.offset).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sequence/pasteParser.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement**

`src/sequence/pasteParser.ts`:

```ts
import type { Sequence } from './sequence';

export function parsePasted(text: string): bigint[] {
  const cleaned = text.replace(/[\[\]{}()]/g, ' ');
  const tokens = cleaned.split(/[\s,;]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) throw new Error('No numbers found in input.');
  return tokens.map((tok) => {
    if (!/^[+-]?\d+$/.test(tok)) {
      throw new Error(`"${tok}" is not an integer.`);
    }
    return BigInt(tok);
  });
}

export function sequenceFromPaste(text: string): Sequence {
  return {
    terms: parsePasted(text),
    name: 'Pasted sequence',
    offset: 0,
    source: 'paste',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sequence/pasteParser.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sequence/pasteParser.ts tests/sequence/pasteParser.test.ts
git commit -m "feat: paste parser tolerant of OEIS copy formats"
```

---

### Task 4: Formula evaluator

**Files:**
- Create: `src/sequence/formula.ts`
- Test: `tests/sequence/formula.test.ts`

**Interfaces:**
- Consumes: `Sequence` from Task 2.
- Produces:

```ts
export function compileFormula(src: string): (n: bigint) => bigint; // throws Error with message on syntax error
export function validateFormula(src: string): string | null;        // null = OK, else the error message (for live UI validation)
export function sequenceFromFormula(src: string, count: number, start?: number): Sequence;
// name = src, offset = start (default 0), source = 'formula'
```

Grammar (recursive descent, integer/bigint semantics): `+ - * / % ^`, unary minus, parentheses, variable `n`, functions `abs(x)`, `min(a,b)`, `max(a,b)`, `gcd(a,b)`. `/` truncates toward zero (BigInt division). `^` is right-associative, exponent must be ≥ 0 and ≤ 1e6. No `eval` - hand-written tokenizer + parser.

- [ ] **Step 1: Write the failing tests**

`tests/sequence/formula.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compileFormula, validateFormula, sequenceFromFormula } from '../../src/sequence/formula';

describe('compileFormula', () => {
  it('evaluates polynomials in n', () => {
    const f = compileFormula('n*n + n + 41');
    expect(f(0n)).toBe(41n);
    expect(f(1n)).toBe(43n);
    expect(f(10n)).toBe(151n);
  });

  it('handles precedence and parentheses', () => {
    expect(compileFormula('2 + 3 * 4')(0n)).toBe(14n);
    expect(compileFormula('(2 + 3) * 4')(0n)).toBe(20n);
  });

  it('power is right-associative with bigint results', () => {
    expect(compileFormula('2^10')(0n)).toBe(1024n);
    expect(compileFormula('2^3^2')(0n)).toBe(512n); // 2^(3^2)
    expect(compileFormula('2^100')(0n)).toBe(2n ** 100n);
  });

  it('division truncates toward zero; % is remainder', () => {
    expect(compileFormula('7/2')(0n)).toBe(3n);
    expect(compileFormula('-7/2')(0n)).toBe(-3n);
    expect(compileFormula('7%3')(0n)).toBe(1n);
  });

  it('unary minus and functions', () => {
    expect(compileFormula('-n')(5n)).toBe(-5n);
    expect(compileFormula('abs(-8)')(0n)).toBe(8n);
    expect(compileFormula('min(3, n)')(1n)).toBe(1n);
    expect(compileFormula('max(3, n)')(1n)).toBe(3n);
    expect(compileFormula('gcd(12, 18)')(0n)).toBe(6n);
  });

  it('rejects bad syntax with messages', () => {
    expect(() => compileFormula('n +')).toThrow();
    expect(() => compileFormula('2 ** 3')).toThrow();
    expect(() => compileFormula('foo(n)')).toThrow(/foo/);
    expect(() => compileFormula('1/0')(0n)).toThrow(/zero/i);
    expect(() => compileFormula('2^-1')(0n)).toThrow(/exponent/i);
  });

  it('validateFormula returns null or the message', () => {
    expect(validateFormula('n^2')).toBeNull();
    expect(typeof validateFormula('n +')).toBe('string');
  });

  it('sequenceFromFormula builds a Sequence', () => {
    const s = sequenceFromFormula('n*n', 4);
    expect(s.terms).toEqual([0n, 1n, 4n, 9n]);
    expect(s.name).toBe('n*n');
    expect(s.source).toBe('formula');
    const s1 = sequenceFromFormula('n', 3, 5);
    expect(s1.terms).toEqual([5n, 6n, 7n]);
    expect(s1.offset).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sequence/formula.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement**

`src/sequence/formula.ts`:

```ts
import type { Sequence } from './sequence';

type Tok =
  | { kind: 'num'; value: bigint }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (/\d/.test(c)) {
      let j = i;
      while (j < src.length && /\d/.test(src[j]!)) j++;
      toks.push({ kind: 'num', value: BigInt(src.slice(i, j)) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j]!)) j++;
      toks.push({ kind: 'name', value: src.slice(i, j) });
      i = j;
    } else if ('+-*/%^(),'.includes(c)) {
      toks.push({ kind: 'op', value: c });
      i++;
    } else {
      throw new Error(`Unexpected character "${c}"`);
    }
  }
  return toks;
}

type Node = (n: bigint) => bigint;

const FUNCS: Record<string, (args: bigint[]) => bigint> = {
  abs: ([a]) => (a! < 0n ? -a! : a!),
  min: ([a, b]) => (a! < b! ? a! : b!),
  max: ([a, b]) => (a! > b! ? a! : b!),
  gcd: ([a, b]) => {
    let x = a! < 0n ? -a! : a!;
    let y = b! < 0n ? -b! : b!;
    while (y) { [x, y] = [y, x % y]; }
    return x;
  },
};
const FUNC_ARITY: Record<string, number> = { abs: 1, min: 2, max: 2, gcd: 2 };

class Parser {
  pos = 0;
  constructor(readonly toks: Tok[]) {}

  peek(): Tok | undefined { return this.toks[this.pos]; }

  eatOp(op: string): boolean {
    const t = this.peek();
    if (t?.kind === 'op' && t.value === op) { this.pos++; return true; }
    return false;
  }

  expectOp(op: string): void {
    if (!this.eatOp(op)) throw new Error(`Expected "${op}"`);
  }

  parseExpr(): Node {
    let left = this.parseTerm();
    for (;;) {
      if (this.eatOp('+')) { const r = this.parseTerm(); const l = left; left = (n) => l(n) + r(n); }
      else if (this.eatOp('-')) { const r = this.parseTerm(); const l = left; left = (n) => l(n) - r(n); }
      else return left;
    }
  }

  parseTerm(): Node {
    let left = this.parsePower();
    for (;;) {
      if (this.eatOp('*')) { const r = this.parsePower(); const l = left; left = (n) => l(n) * r(n); }
      else if (this.eatOp('/')) {
        const r = this.parsePower(); const l = left;
        left = (n) => {
          const d = r(n);
          if (d === 0n) throw new Error('Division by zero');
          return l(n) / d;
        };
      } else if (this.eatOp('%')) {
        const r = this.parsePower(); const l = left;
        left = (n) => {
          const d = r(n);
          if (d === 0n) throw new Error('Modulo by zero');
          return l(n) % d;
        };
      } else return left;
    }
  }

  parsePower(): Node {
    const base = this.parseUnary();
    if (this.eatOp('^')) {
      const exp = this.parsePower(); // right-associative
      return (n) => {
        const e = exp(n);
        if (e < 0n) throw new Error('Negative exponent not allowed');
        if (e > 1000000n) throw new Error('Exponent too large (max 1e6)');
        return base(n) ** e;
      };
    }
    return base;
  }

  parseUnary(): Node {
    if (this.eatOp('-')) { const inner = this.parseUnary(); return (n) => -inner(n); }
    return this.parsePrimary();
  }

  parsePrimary(): Node {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of formula');
    if (t.kind === 'num') { this.pos++; const v = t.value; return () => v; }
    if (t.kind === 'name') {
      this.pos++;
      if (t.value === 'n') return (n) => n;
      const fn = FUNCS[t.value];
      if (!fn) throw new Error(`Unknown function or variable "${t.value}"`);
      this.expectOp('(');
      const args: Node[] = [this.parseExpr()];
      while (this.eatOp(',')) args.push(this.parseExpr());
      this.expectOp(')');
      const arity = FUNC_ARITY[t.value]!;
      if (args.length !== arity) throw new Error(`${t.value} takes ${arity} argument(s)`);
      return (n) => fn(args.map((a) => a(n)));
    }
    if (t.kind === 'op' && t.value === '(') {
      this.pos++;
      const inner = this.parseExpr();
      this.expectOp(')');
      return inner;
    }
    throw new Error(`Unexpected "${t.value}"`);
  }
}

export function compileFormula(src: string): (n: bigint) => bigint {
  const p = new Parser(tokenize(src));
  const node = p.parseExpr();
  if (p.pos !== p.toks.length) {
    const t = p.toks[p.pos]!;
    throw new Error(`Unexpected "${'value' in t ? t.value : '?'}" after expression`);
  }
  return node;
}

export function validateFormula(src: string): string | null {
  try {
    compileFormula(src);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function sequenceFromFormula(src: string, count: number, start = 0): Sequence {
  const f = compileFormula(src);
  const terms: bigint[] = [];
  for (let i = 0; i < count; i++) terms.push(f(BigInt(start + i)));
  return { terms, name: src, offset: start, source: 'formula' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sequence/formula.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sequence/formula.ts tests/sequence/formula.test.ts
git commit -m "feat: safe bigint formula evaluator (no eval)"
```

---

### Task 5: OEIS client - lookup and search

**Files:**
- Create: `src/sequence/oeisClient.ts`, `tests/fixtures/oeis-fib.json`, `tests/fixtures/oeis-empty.json`
- Test: `tests/sequence/oeisClient.test.ts`

**Interfaces:**
- Consumes: `Sequence` from Task 2.
- Produces:

```ts
export type FetchLike = (url: string) => Promise<{
  ok: boolean; status: number;
  json(): Promise<unknown>; text(): Promise<string>;
}>;

export function normalizeANumber(input: string): string;  // "45" | "a45" | "A000045" → "A000045"; throws on garbage
export interface OeisSearchHit { aNumber: string; name: string; }
export async function lookupById(aNumber: string, fetchFn?: FetchLike): Promise<Sequence>;
export async function search(query: string, fetchFn?: FetchLike): Promise<OeisSearchHit[]>;
```

`fetchFn` defaults to the global `fetch`; tests inject fakes returning fixture JSON. Real URLs used: `/api/search?q=id:A000045&fmt=json` and `/api/search?q=<encoded query>&fmt=json`. The OEIS JSON body has shape `{ count: number, results: Array<{ number: number, name: string, data: string, offset: string }> | null }` - `results` is `null` when nothing matches. `data` is a comma-joined term string; `offset` is like `"0,4"` (first part is the sequence offset).

- [ ] **Step 1: Write fixtures**

`tests/fixtures/oeis-fib.json`:

```json
{
  "greeting": "Greetings from The On-Line Encyclopedia of Integer Sequences!",
  "query": "id:A000045",
  "count": 1,
  "start": 0,
  "results": [
    {
      "number": 45,
      "id": "M0692 N0256",
      "data": "0,1,1,2,3,5,8,13,21,34,55,89,144",
      "name": "Fibonacci numbers: F(n) = F(n-1) + F(n-2) with F(0) = 0 and F(1) = 1.",
      "offset": "0,4",
      "keyword": "core,nonn,nice,easy"
    }
  ]
}
```

`tests/fixtures/oeis-empty.json`:

```json
{
  "greeting": "Greetings from The On-Line Encyclopedia of Integer Sequences!",
  "query": "id:A999999",
  "count": 0,
  "start": 0,
  "results": null
}
```

- [ ] **Step 2: Write the failing tests**

`tests/sequence/oeisClient.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeANumber, lookupById, search, type FetchLike } from '../../src/sequence/oeisClient';
import fib from '../fixtures/oeis-fib.json';
import empty from '../fixtures/oeis-empty.json';

function fakeFetch(body: unknown, ok = true, status = 200): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return Object.assign(fn, { calls });
}

describe('normalizeANumber', () => {
  it('normalizes common forms', () => {
    expect(normalizeANumber('A000045')).toBe('A000045');
    expect(normalizeANumber('a45')).toBe('A000045');
    expect(normalizeANumber('45')).toBe('A000045');
    expect(normalizeANumber(' A019488 ')).toBe('A019488');
  });
  it('rejects garbage', () => {
    expect(() => normalizeANumber('banana')).toThrow();
    expect(() => normalizeANumber('')).toThrow();
  });
});

describe('lookupById', () => {
  it('fetches via /api and builds a Sequence', async () => {
    const f = fakeFetch(fib);
    const seq = await lookupById('A000045', f);
    expect(f.calls[0]).toBe('/api/search?q=id%3AA000045&fmt=json');
    expect(seq.aNumber).toBe('A000045');
    expect(seq.name).toMatch(/Fibonacci/);
    expect(seq.offset).toBe(0);
    expect(seq.terms.slice(0, 7)).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 8n]);
    expect(seq.source).toBe('oeis');
  });

  it('throws a clear error when the id is unknown', async () => {
    await expect(lookupById('A999999', fakeFetch(empty))).rejects.toThrow(/A999999/);
  });

  it('throws on HTTP failure', async () => {
    await expect(lookupById('A000045', fakeFetch({}, false, 502))).rejects.toThrow(/502/);
  });
});

describe('search', () => {
  it('returns hits with normalized A-numbers', async () => {
    const hits = await search('fibonacci', fakeFetch(fib));
    expect(hits).toEqual([{ aNumber: 'A000045', name: fib.results[0].name }]);
  });

  it('returns [] for no matches', async () => {
    expect(await search('zzzz', fakeFetch(empty))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/sequence/oeisClient.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 4: Implement**

`src/sequence/oeisClient.ts`:

```ts
import type { Sequence } from './sequence';

export type FetchLike = (url: string) => Promise<{
  ok: boolean; status: number;
  json(): Promise<unknown>; text(): Promise<string>;
}>;

const defaultFetch: FetchLike = (url) => fetch(url);

export function normalizeANumber(input: string): string {
  const m = input.trim().match(/^[Aa]?(\d{1,6})$/);
  if (!m) throw new Error(`"${input}" is not an OEIS A-number.`);
  return 'A' + m[1]!.padStart(6, '0');
}

export interface OeisSearchHit { aNumber: string; name: string; }

interface OeisResult { number: number; name: string; data: string; offset: string; }
interface OeisResponse { count: number; results: OeisResult[] | null; }

async function fetchJson(url: string, fetchFn: FetchLike): Promise<OeisResponse> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`OEIS request failed (HTTP ${res.status}).`);
  const body = (await res.json()) as OeisResponse;
  if (typeof body !== 'object' || body === null || !('results' in body)) {
    throw new Error('Unexpected response from OEIS.');
  }
  return body;
}

function resultToSequence(r: OeisResult): Sequence {
  const aNumber = 'A' + String(r.number).padStart(6, '0');
  const terms = r.data.split(',').map((t) => BigInt(t.trim()));
  const offset = parseInt(r.offset.split(',')[0] ?? '0', 10);
  return { terms, aNumber, name: r.name, offset, source: 'oeis' };
}

export async function lookupById(aNumber: string, fetchFn: FetchLike = defaultFetch): Promise<Sequence> {
  const id = normalizeANumber(aNumber);
  const body = await fetchJson(`/api/search?q=${encodeURIComponent('id:' + id)}&fmt=json`, fetchFn);
  const first = body.results?.[0];
  if (!first) throw new Error(`No OEIS sequence found for ${id}.`);
  return resultToSequence(first);
}

export async function search(query: string, fetchFn: FetchLike = defaultFetch): Promise<OeisSearchHit[]> {
  const body = await fetchJson(`/api/search?q=${encodeURIComponent(query)}&fmt=json`, fetchFn);
  return (body.results ?? []).map((r) => ({
    aNumber: 'A' + String(r.number).padStart(6, '0'),
    name: r.name,
  }));
}
```

Note: `tsconfig.json` needs `"resolveJsonModule": true` added to `compilerOptions` for the fixture imports - add it in this task.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/sequence/oeisClient.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/sequence/oeisClient.ts tests/sequence/oeisClient.test.ts tests/fixtures tsconfig.json
git commit -m "feat: OEIS lookup and search client with fixture tests"
```

---

### Task 6: B-file fetch and parser

**Files:**
- Modify: `src/sequence/oeisClient.ts` (append b-file functions)
- Create: `tests/fixtures/bfile-good.txt`, `tests/fixtures/bfile-gap.txt`
- Test: `tests/sequence/bfile.test.ts`

**Interfaces:**
- Consumes: `FetchLike`, `normalizeANumber` (Task 5), `Sequence` (Task 2).
- Produces:

```ts
export function parseBFile(text: string, cap: number): bigint[];
// Skips '#' comments and blank lines. Each data line is "<index> <value>".
// Reads values in order, tolerating any starting index, but STOPS at the first
// index discontinuity (non-consecutive index). Stops at cap terms. Throws if no
// data lines at all.
export async function fetchBFile(aNumber: string, cap?: number, fetchFn?: FetchLike): Promise<bigint[]>;
// GET /api/<A-number>/b<digits>.txt, e.g. /api/A000045/b000045.txt; cap default 10000
export function withTerms(seq: Sequence, terms: bigint[]): Sequence;
// same metadata, new terms - the "upgrade in place" used by the UI
```

- [ ] **Step 1: Write fixtures**

`tests/fixtures/bfile-good.txt`:

```
# A000045 b-file (excerpt)
0 0
1 1
2 1
3 2
4 3
5 5
6 8
```

`tests/fixtures/bfile-gap.txt`:

```
1 10
2 20
5 99
6 100
```

- [ ] **Step 2: Write the failing tests**

`tests/sequence/bfile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBFile, fetchBFile, withTerms, type FetchLike } from '../../src/sequence/oeisClient';

const good = readFileSync(join(__dirname, '../fixtures/bfile-good.txt'), 'utf8');
const gap = readFileSync(join(__dirname, '../fixtures/bfile-gap.txt'), 'utf8');

describe('parseBFile', () => {
  it('parses values, skipping comments', () => {
    expect(parseBFile(good, 10000)).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 8n]);
  });

  it('stops at the first index discontinuity', () => {
    expect(parseBFile(gap, 10000)).toEqual([10n, 20n]);
  });

  it('respects the cap', () => {
    expect(parseBFile(good, 3)).toEqual([0n, 1n, 1n]);
  });

  it('throws when there are no data lines', () => {
    expect(() => parseBFile('# nothing\n\n', 10)).toThrow(/no terms/i);
  });
});

describe('fetchBFile', () => {
  it('requests the right URL and parses', async () => {
    const calls: string[] = [];
    const f: FetchLike = async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({}), text: async () => good };
    };
    const terms = await fetchBFile('45', 10000, f);
    expect(calls[0]).toBe('/api/A000045/b000045.txt');
    expect(terms.length).toBe(7);
  });

  it('throws on HTTP failure', async () => {
    const f: FetchLike = async () => ({
      ok: false, status: 404, json: async () => ({}), text: async () => '',
    });
    await expect(fetchBFile('A000045', 10000, f)).rejects.toThrow(/404/);
  });
});

describe('withTerms', () => {
  it('replaces terms, keeps metadata', () => {
    const seq = { terms: [1n], aNumber: 'A000045', name: 'Fib', offset: 0, source: 'oeis' as const };
    const up = withTerms(seq, [1n, 2n, 3n]);
    expect(up.terms).toEqual([1n, 2n, 3n]);
    expect(up.aNumber).toBe('A000045');
    expect(up.name).toBe('Fib');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/sequence/bfile.test.ts`
Expected: FAIL - exports missing.

- [ ] **Step 4: Implement (append to `src/sequence/oeisClient.ts`)**

```ts
export function parseBFile(text: string, cap: number): bigint[] {
  const terms: bigint[] = [];
  let expectedIndex: bigint | null = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const m = line.match(/^(-?\d+)\s+(-?\d+)$/);
    if (!m) continue; // tolerate stray non-data lines
    const idx = BigInt(m[1]!);
    if (expectedIndex !== null && idx !== expectedIndex) break; // discontinuity
    terms.push(BigInt(m[2]!));
    expectedIndex = idx + 1n;
    if (terms.length >= cap) break;
  }
  if (terms.length === 0) throw new Error('B-file contained no terms.');
  return terms;
}

export async function fetchBFile(
  aNumber: string,
  cap = 10000,
  fetchFn: FetchLike = defaultFetch,
): Promise<bigint[]> {
  const id = normalizeANumber(aNumber);
  const res = await fetchFn(`/api/${id}/b${id.slice(1)}.txt`);
  if (!res.ok) throw new Error(`B-file request failed (HTTP ${res.status}).`);
  return parseBFile(await res.text(), cap);
}

export function withTerms(seq: Sequence, terms: bigint[]): Sequence {
  return { ...seq, terms };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/sequence/bfile.test.ts`
Expected: PASS (7 tests). Also run the full suite: `npm test` - all green.

- [ ] **Step 6: Commit**

```bash
git add src/sequence/oeisClient.ts tests/sequence/bfile.test.ts tests/fixtures
git commit -m "feat: b-file fetch and parser with cap and discontinuity handling"
```

---

### Task 7: Seeded RNG, surrogate generators, percentile bands

**Files:**
- Create: `src/nullmodel/rng.ts`, `src/nullmodel/surrogates.ts`, `src/nullmodel/bands.ts`
- Test: `tests/nullmodel/surrogates.test.ts`, `tests/nullmodel/bands.test.ts`

**Interfaces:**
- Consumes: nothing (operates on plain `bigint[]`).
- Produces:

```ts
// rng.ts
export function mulberry32(seed: number): () => number;          // deterministic, returns floats in [0,1)
export function shuffleInPlace<T>(arr: T[], rand: () => number): T[]; // Fisher–Yates, returns arr

// surrogates.ts
export type SurrogateType = 'permutation' | 'difference' | 'matched';
export function permutationSurrogate(terms: bigint[], seed: number): bigint[];
export function differenceSurrogate(terms: bigint[], seed: number): bigint[];
export function matchedRandomSurrogate(terms: bigint[], seed: number): bigint[];
export function makeSurrogate(terms: bigint[], type: SurrogateType, seed: number): bigint[];

// bands.ts
export interface Bands { lo: number[]; median: number[]; hi: number[]; }
export function percentileBands(arrays: number[][], loPct?: number, hiPct?: number): Bands;
// loPct default 5, hiPct default 95; linear-interpolation percentile per index.
// All inner arrays must share one length; throws otherwise.
```

`matchedRandomSurrogate` algorithm: convert terms to clamped numbers; least-squares fit both a linear model `v ≈ a·i + b` and (if every |term| > 0) an exponential model `log10|v| ≈ a·i + b`; pick the model with smaller mean squared residual; generate each surrogate value as `model(i) + uniform(-R, +R)` where `R` is the max absolute residual of the fit; clamp results into `[min(terms), max(terms)]`; round to `bigint`.

- [ ] **Step 1: Write the failing tests**

`tests/nullmodel/surrogates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, shuffleInPlace } from '../../src/nullmodel/rng';
import {
  permutationSurrogate, differenceSurrogate, matchedRandomSurrogate, makeSurrogate,
} from '../../src/nullmodel/surrogates';

const sorted = (xs: bigint[]) => [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const fib = [0n, 1n, 1n, 2n, 3n, 5n, 8n, 13n, 21n, 34n, 55n, 89n];

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const va = Array.from({ length: 5 }, () => a());
    const vb = Array.from({ length: 5 }, () => b());
    expect(va).toEqual(vb);
    for (const v of va) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
});

describe('shuffleInPlace', () => {
  it('permutes deterministically under a seed', () => {
    const a = shuffleInPlace([1, 2, 3, 4, 5, 6], mulberry32(1));
    const b = shuffleInPlace([1, 2, 3, 4, 5, 6], mulberry32(1));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('permutationSurrogate', () => {
  it('preserves the exact multiset, destroys order, reproducible', () => {
    const s1 = permutationSurrogate(fib, 7);
    const s2 = permutationSurrogate(fib, 7);
    expect(s1).toEqual(s2);
    expect(sorted(s1)).toEqual(sorted(fib));
    expect(s1).not.toEqual(fib); // astronomically unlikely to be identity
    expect(fib).toEqual([0n, 1n, 1n, 2n, 3n, 5n, 8n, 13n, 21n, 34n, 55n, 89n]); // input untouched
  });
});

describe('differenceSurrogate', () => {
  it('preserves first term, last term, and the multiset of differences', () => {
    const s = differenceSurrogate(fib, 7);
    expect(s.length).toBe(fib.length);
    expect(s[0]).toBe(fib[0]);
    expect(s[s.length - 1]).toBe(fib[fib.length - 1]); // sum of diffs is invariant
    const diffs = (xs: bigint[]) => xs.slice(1).map((v, i) => v - xs[i]!);
    expect(sorted(diffs(s))).toEqual(sorted(diffs(fib)));
  });
});

describe('matchedRandomSurrogate', () => {
  it('matches length, stays within the value envelope, reproducible', () => {
    const s1 = matchedRandomSurrogate(fib, 7);
    const s2 = matchedRandomSurrogate(fib, 7);
    expect(s1).toEqual(s2);
    expect(s1.length).toBe(fib.length);
    for (const v of s1) {
      expect(v >= 0n && v <= 89n).toBe(true);
    }
    expect(matchedRandomSurrogate(fib, 8)).not.toEqual(s1);
  });
});

describe('makeSurrogate', () => {
  it('dispatches by type', () => {
    expect(makeSurrogate(fib, 'permutation', 3)).toEqual(permutationSurrogate(fib, 3));
    expect(makeSurrogate(fib, 'difference', 3)).toEqual(differenceSurrogate(fib, 3));
    expect(makeSurrogate(fib, 'matched', 3)).toEqual(matchedRandomSurrogate(fib, 3));
  });
});
```

`tests/nullmodel/bands.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { percentileBands } from '../../src/nullmodel/bands';

describe('percentileBands', () => {
  it('computes per-index median and band edges', () => {
    const bands = percentileBands([[1, 10], [2, 20], [3, 30]]);
    expect(bands.median).toEqual([2, 20]);
    expect(bands.lo[0]!).toBeGreaterThanOrEqual(1);
    expect(bands.lo[0]!).toBeLessThanOrEqual(2);
    expect(bands.hi[0]!).toBeGreaterThanOrEqual(2);
    expect(bands.hi[0]!).toBeLessThanOrEqual(3);
  });

  it('honors custom percentiles (p0/p100 = min/max)', () => {
    const bands = percentileBands([[1], [2], [3]], 0, 100);
    expect(bands.lo).toEqual([1]);
    expect(bands.hi).toEqual([3]);
  });

  it('throws on ragged input', () => {
    expect(() => percentileBands([[1, 2], [3]])).toThrow();
    expect(() => percentileBands([])).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/nullmodel`
Expected: FAIL - modules not found.

- [ ] **Step 3: Implement**

`src/nullmodel/rng.ts`:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
```

`src/nullmodel/surrogates.ts`:

```ts
import { mulberry32, shuffleInPlace } from './rng';

export type SurrogateType = 'permutation' | 'difference' | 'matched';

export function permutationSurrogate(terms: bigint[], seed: number): bigint[] {
  return shuffleInPlace([...terms], mulberry32(seed));
}

export function differenceSurrogate(terms: bigint[], seed: number): bigint[] {
  if (terms.length < 2) return [...terms];
  const diffs = terms.slice(1).map((v, i) => v - terms[i]!);
  shuffleInPlace(diffs, mulberry32(seed));
  const out = [terms[0]!];
  for (const d of diffs) out.push(out[out.length - 1]! + d);
  return out;
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampNum = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

function fitLine(ys: number[]): { a: number; b: number; mse: number } {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
  const a = den === 0 ? 0 : num / den;
  const b = my - a * mx;
  const mse = ys.reduce((s, y, i) => s + (y - (a * i + b)) ** 2, 0) / n;
  return { a, b, mse };
}

export function matchedRandomSurrogate(terms: bigint[], seed: number): bigint[] {
  if (terms.length === 0) return [];
  const nums = terms.map(clampNum);
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const rand = mulberry32(seed);

  const lin = fitLine(nums);
  let model: (i: number) => number;
  let residual: number;
  const allPositive = nums.every((v) => v > 0);
  if (allPositive) {
    const logs = nums.map((v) => Math.log10(v));
    const exp = fitLine(logs);
    // compare in value space: normalize linear mse by value scale, exp mse by log scale
    const linRelMse = lin.mse / Math.max(1, (hi - lo) ** 2);
    const expRelMse = exp.mse / Math.max(1e-12, (Math.max(...logs) - Math.min(...logs)) ** 2 || 1);
    if (expRelMse < linRelMse) {
      const maxRes = Math.max(...logs.map((y, i) => Math.abs(y - (exp.a * i + exp.b))));
      model = (i) => 10 ** (exp.a * i + exp.b + (rand() * 2 - 1) * maxRes);
      residual = 0; // residual folded into model above
      return nums.map((_, i) => toClampedBigint(model(i), lo, hi));
    }
  }
  const maxRes = Math.max(...nums.map((y, i) => Math.abs(y - (lin.a * i + lin.b))));
  model = (i) => lin.a * i + lin.b;
  residual = maxRes;
  return nums.map((_, i) => toClampedBigint(model(i) + (rand() * 2 - 1) * residual, lo, hi));
}

function toClampedBigint(v: number, lo: number, hi: number): bigint {
  return BigInt(Math.round(Math.min(hi, Math.max(lo, v))));
}

export function makeSurrogate(terms: bigint[], type: SurrogateType, seed: number): bigint[] {
  switch (type) {
    case 'permutation': return permutationSurrogate(terms, seed);
    case 'difference': return differenceSurrogate(terms, seed);
    case 'matched': return matchedRandomSurrogate(terms, seed);
  }
}
```

`src/nullmodel/bands.ts`:

```ts
export interface Bands { lo: number[]; median: number[]; hi: number[]; }

function percentile(sortedVals: number[], pct: number): number {
  const q = (sortedVals.length - 1) * (pct / 100);
  const base = Math.floor(q);
  const frac = q - base;
  const lo = sortedVals[base]!;
  const hi = sortedVals[Math.min(base + 1, sortedVals.length - 1)]!;
  return lo + (hi - lo) * frac;
}

export function percentileBands(arrays: number[][], loPct = 5, hiPct = 95): Bands {
  if (arrays.length === 0) throw new Error('percentileBands: no arrays');
  const len = arrays[0]!.length;
  if (arrays.some((a) => a.length !== len)) throw new Error('percentileBands: ragged input');
  const lo: number[] = [], median: number[] = [], hi: number[] = [];
  for (let i = 0; i < len; i++) {
    const col = arrays.map((a) => a[i]!).sort((x, y) => x - y);
    lo.push(percentile(col, loPct));
    median.push(percentile(col, 50));
    hi.push(percentile(col, hiPct));
  }
  return { lo, median, hi };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/nullmodel`
Expected: PASS (all tests in both files).

- [ ] **Step 5: Commit**

```bash
git add src/nullmodel tests/nullmodel
git commit -m "feat: seeded surrogate generators and percentile bands"
```

---

### Task 8: Visualizer types, registry, and fake-canvas test helper

**Files:**
- Create: `src/viz/types.ts`, `src/viz/registry.ts`, `tests/helpers/fakeCtx.ts`
- Test: `tests/viz/registry.test.ts`

**Interfaces:**
- Consumes: `SequenceView` (Task 2).
- Produces (every visualizer task depends on these exact shapes):

```ts
// types.ts
export interface Size { width: number; height: number; }
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;
export type ParamSpec =
  | { kind: 'number'; id: string; label: string; default: number; min: number; max: number; step: number }
  | { kind: 'select'; id: string; label: string; default: string; options: string[] }
  | { kind: 'boolean'; id: string; label: string; default: boolean };
export type VizFamily = 'grid' | 'trajectory' | 'stats' | 'basic';
export interface Visualizer {
  id: string;
  name: string;
  family: VizFamily;
  params: ParamSpec[];
  minTerms: number;
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size): void;
  statistics?(seq: SequenceView, params: Params): Record<string, number[]>;
}
export function defaultParams(specs: ParamSpec[]): Params;

// registry.ts
export function registerVisualizer(v: Visualizer): void;   // throws on duplicate id
export function getVisualizer(id: string): Visualizer;      // throws on unknown id
export function allVisualizers(): Visualizer[];             // registration order
export function clearRegistry(): void;                      // test-only helper

// tests/helpers/fakeCtx.ts
export function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] };
// Proxy that no-ops every method (recording its name in calls) and accepts any
// property set - lets render() smoke-tests run under Node without a real canvas.
```

- [ ] **Step 1: Write the failing tests**

`tests/viz/registry.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { registerVisualizer, getVisualizer, allVisualizers, clearRegistry } from '../../src/viz/registry';
import { defaultParams, type Visualizer } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mkViz = (id: string): Visualizer => ({
  id, name: id, family: 'basic', params: [], minTerms: 1,
  render: (_seq, _params, ctx) => { ctx.beginPath(); },
});

describe('registry', () => {
  beforeEach(clearRegistry);

  it('registers and retrieves in order', () => {
    registerVisualizer(mkViz('a'));
    registerVisualizer(mkViz('b'));
    expect(allVisualizers().map((v) => v.id)).toEqual(['a', 'b']);
    expect(getVisualizer('b').name).toBe('b');
  });

  it('throws on duplicates and unknowns', () => {
    registerVisualizer(mkViz('a'));
    expect(() => registerVisualizer(mkViz('a'))).toThrow(/duplicate/i);
    expect(() => getVisualizer('nope')).toThrow(/nope/);
  });
});

describe('defaultParams', () => {
  it('collects defaults by id', () => {
    expect(defaultParams([
      { kind: 'number', id: 'k', label: 'K', default: 4, min: 2, max: 12, step: 1 },
      { kind: 'select', id: 'mode', label: 'Mode', default: 'terms', options: ['terms', 'gaps'] },
      { kind: 'boolean', id: 'log', label: 'Log', default: false },
    ])).toEqual({ k: 4, mode: 'terms', log: false });
  });
});

describe('fakeCtx', () => {
  it('no-ops methods and records calls', () => {
    const { ctx, calls } = fakeCtx();
    ctx.beginPath();
    ctx.lineTo(1, 2);
    ctx.fillStyle = 'red'; // property set must not throw
    expect(calls).toEqual(['beginPath', 'lineTo']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/viz/registry.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Implement**

`src/viz/types.ts` - exactly the interfaces shown above, plus:

```ts
export function defaultParams(specs: ParamSpec[]): Params {
  const out: Params = {};
  for (const s of specs) out[s.id] = s.default;
  return out;
}
```

`src/viz/registry.ts`:

```ts
import type { Visualizer } from './types';

const registry = new Map<string, Visualizer>();

export function registerVisualizer(v: Visualizer): void {
  if (registry.has(v.id)) throw new Error(`Duplicate visualizer id: ${v.id}`);
  registry.set(v.id, v);
}

export function getVisualizer(id: string): Visualizer {
  const v = registry.get(id);
  if (!v) throw new Error(`Unknown visualizer: ${id}`);
  return v;
}

export function allVisualizers(): Visualizer[] {
  return [...registry.values()];
}

export function clearRegistry(): void {
  registry.clear();
}
```

`tests/helpers/fakeCtx.ts`:

```ts
export function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return { addColorStop: () => {} };
        }
        if (prop === 'measureText') return { width: 10 };
        return undefined;
      };
    },
    set() { return true; },
  });
  return { ctx, calls };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/viz/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/viz/types.ts src/viz/registry.ts tests/helpers/fakeCtx.ts tests/viz/registry.test.ts
git commit -m "feat: visualizer interface, registry, and fake-canvas test helper"
```

---

### Task 9: Basic visualizers - scatter, differences & ratios

**Files:**
- Create: `src/viz/scatter.ts`, `src/viz/differences.ts`, `src/viz/all.ts`
- Test: `tests/viz/basic.test.ts`

**Interfaces:**
- Consumes: `Visualizer`, `Params`, `Size`, `defaultParams` (Task 8); `SequenceView` (Task 2); `fakeCtx` helper.
- Produces:

```ts
// scatter.ts
export const scatterViz: Visualizer;  // id 'scatter', family 'basic', minTerms 2
// params: [{kind:'select', id:'scale', label:'Scale', default:'linear', options:['linear','log']}]
// statistics: { value: number[] } - toNumber per index for 'linear', logMagnitude for 'log'

// differences.ts
export const differencesViz: Visualizer;  // id 'differences', family 'basic', minTerms 3
// params: [{kind:'select', id:'mode', label:'Mode', default:'differences', options:['differences','ratios']}]
// statistics: { value: number[] } - length N-1; clamped bigint differences, or
// ratios toNumber(i+1)/toNumber(i) with 0 where the denominator term is 0

// all.ts
export function registerAll(): void;  // idempotent; registers every shipped visualizer
```

Load the `dataviz` skill before implementing the drawing code in this task.

- [ ] **Step 1: Write the failing tests**

`tests/viz/basic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { scatterViz } from '../../src/viz/scatter';
import { differencesViz } from '../../src/viz/differences';
import { registerAll } from '../../src/viz/all';
import { allVisualizers } from '../../src/viz/registry';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

const SIZE = { width: 400, height: 300 };

describe('scatterViz.statistics', () => {
  it('linear scale returns clamped numbers', () => {
    const stats = scatterViz.statistics!(mk([0n, 1n, 10n ** 30n]), { scale: 'linear' });
    expect(stats.value).toEqual([0, 1, Number.MAX_SAFE_INTEGER]);
  });
  it('log scale returns log magnitudes', () => {
    const stats = scatterViz.statistics!(mk([1n, 1000n]), { scale: 'log' });
    expect(stats.value![0]).toBeCloseTo(0, 5);
    expect(stats.value![1]).toBeCloseTo(3, 5);
  });
});

describe('differencesViz.statistics', () => {
  it('differences mode', () => {
    const stats = differencesViz.statistics!(mk([0n, 1n, 1n, 2n, 3n, 5n]), { mode: 'differences' });
    expect(stats.value).toEqual([1, 0, 1, 1, 2]);
  });
  it('ratios mode guards division by zero', () => {
    const stats = differencesViz.statistics!(mk([0n, 2n, 4n]), { mode: 'ratios' });
    expect(stats.value).toEqual([0, 2]);
  });
});

describe('render smoke tests', () => {
  const cases: Array<[string, typeof scatterViz]> = [
    ['scatter', scatterViz],
    ['differences', differencesViz],
  ];
  const edgeSeqs = [
    mk([1n, 2n]),                    // minimum-ish length
    mk([-5n, 0n, 5n]),               // negatives and zero
    mk([10n ** 40n, -(10n ** 40n), 1n]), // beyond float64
  ];
  for (const [name, viz] of cases) {
    it(`${name} renders every edge case without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, SIZE)).not.toThrow();
      }
    });
  }
});

describe('registerAll', () => {
  it('registers shipped visualizers once, idempotently', () => {
    registerAll();
    registerAll();
    const ids = allVisualizers().map((v) => v.id);
    expect(ids).toContain('scatter');
    expect(ids).toContain('differences');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/viz/basic.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Implement**

`src/viz/scatter.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;

function values(seq: SequenceView, scale: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < seq.length; i++) {
    out.push(scale === 'log' ? seq.logMagnitude(i) * (seq.sign(i) < 0 ? -1 : 1) : seq.toNumber(i));
  }
  return out;
}

export const scatterViz: Visualizer = {
  id: 'scatter',
  name: 'Term vs index',
  family: 'basic',
  minTerms: 2,
  params: [
    { kind: 'select', id: 'scale', label: 'Scale', default: 'linear', options: ['linear', 'log'] },
  ],
  statistics(seq: SequenceView, params: Params) {
    // NOTE: statistics uses plain log-magnitude (no sign fold) so bands stay simple
    const out: number[] = [];
    for (let i = 0; i < seq.length; i++) {
      out.push(params.scale === 'log' ? seq.logMagnitude(i) : seq.toNumber(i));
    }
    return { value: out };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const vals = values(seq, String(params.scale));
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, 1);
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const x = (i: number) => MARGIN + (i / Math.max(1, vals.length - 1)) * w;
    const y = (v: number) => MARGIN + h - ((v - lo) / (hi - lo || 1)) * h;

    // zero axis
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y(0));
    ctx.lineTo(MARGIN + w, y(0));
    ctx.stroke();

    ctx.fillStyle = '#7aa2f7';
    const r = vals.length > 400 ? 1.5 : 3;
    for (let i = 0; i < vals.length; i++) {
      ctx.beginPath();
      ctx.arc(x(i), y(vals[i]!), r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
```

`src/viz/differences.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampBig = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

function derived(seq: SequenceView, mode: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < seq.length; i++) {
    if (mode === 'ratios') {
      const d = seq.toNumber(i);
      out.push(d === 0 ? 0 : seq.toNumber(i + 1) / d);
    } else {
      out.push(clampBig(seq.term(i + 1) - seq.term(i)));
    }
  }
  return out;
}

export const differencesViz: Visualizer = {
  id: 'differences',
  name: 'Differences & ratios',
  family: 'basic',
  minTerms: 3,
  params: [
    { kind: 'select', id: 'mode', label: 'Mode', default: 'differences', options: ['differences', 'ratios'] },
  ],
  statistics(seq: SequenceView, params: Params) {
    return { value: derived(seq, String(params.mode)) };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const vals = derived(seq, String(params.mode));
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, 1);
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const x = (i: number) => MARGIN + (i / Math.max(1, vals.length - 1)) * w;
    const y = (v: number) => MARGIN + h - ((v - lo) / (hi - lo || 1)) * h;

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y(0));
    ctx.lineTo(MARGIN + w, y(0));
    ctx.stroke();

    ctx.strokeStyle = '#7aa2f7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < vals.length; i++) {
      if (i === 0) ctx.moveTo(x(i), y(vals[i]!));
      else ctx.lineTo(x(i), y(vals[i]!));
    }
    ctx.stroke();
  },
};
```

`src/viz/all.ts`:

```ts
import { registerVisualizer } from './registry';
import { scatterViz } from './scatter';
import { differencesViz } from './differences';

let registered = false;

export function registerAll(): void {
  if (registered) return;
  registered = true;
  // Later tasks append their visualizers to this list.
  for (const v of [scatterViz, differencesViz]) registerVisualizer(v);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/viz/basic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viz/scatter.ts src/viz/differences.ts src/viz/all.ts tests/viz/basic.test.ts
git commit -m "feat: scatter and differences/ratios visualizers with statistics"
```

---

### Task 10: Stats visualizers - histogram, autocorrelation

**Files:**
- Create: `src/viz/histogram.ts`, `src/viz/autocorrelation.ts`
- Modify: `src/viz/all.ts` (add both to the registration list)
- Test: `tests/viz/stats.test.ts`

**Interfaces:**
- Consumes: Task 8 types; `SequenceView`.
- Produces:

```ts
// histogram.ts
export function computeHistogram(values: number[], binCount: number): { edges: number[]; counts: number[] };
// edges has binCount+1 entries, uniform over [min, max]; max value lands in the last bin.
export const histogramViz: Visualizer;  // id 'histogram', family 'stats', minTerms 4
// params: [{kind:'select', id:'target', label:'Of', default:'terms', options:['terms','gaps','digits','leading']},
//          {kind:'number', id:'bins', label:'Bins', default:20, min:4, max:60, step:1}]
// 'terms' = clamped values; 'gaps' = differences; 'digits' = all base-10 digits pooled;
// 'leading' = first digit of each |term| (Benford view)
// statistics: { count: number[] } - the counts array (length = bins param)

// autocorrelation.ts
export function autocorrelation(values: number[], maxLag: number): number[];
// r[0..maxLag]; r[0] === 1; r[k] = Σ(x_i-μ)(x_{i+k}-μ) / Σ(x_i-μ)²; returns zeros if variance is 0
export const autocorrViz: Visualizer;  // id 'autocorr', family 'stats', minTerms 8
// params: [{kind:'number', id:'maxLag', label:'Max lag', default:32, min:4, max:200, step:1}]
// statistics: { r: number[] } - autocorrelation of clamped terms, maxLag capped at length-2
```

- [ ] **Step 1: Write the failing tests**

`tests/viz/stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { computeHistogram, histogramViz } from '../../src/viz/histogram';
import { autocorrelation, autocorrViz } from '../../src/viz/autocorrelation';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('computeHistogram', () => {
  it('bins uniformly and puts max in the last bin', () => {
    const { edges, counts } = computeHistogram([1, 2, 2, 3], 3);
    expect(edges.length).toBe(4);
    expect(edges[0]).toBeCloseTo(1);
    expect(edges[3]).toBeCloseTo(3);
    expect(counts).toEqual([1, 2, 1]);
  });
  it('handles constant input in one bin', () => {
    const { counts } = computeHistogram([5, 5, 5], 4);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('histogramViz.statistics targets', () => {
  it('digits pools every base-10 digit', () => {
    const stats = histogramViz.statistics!(mk([12n, 345n]), { target: 'digits', bins: 10 });
    // digits: 1,2,3,4,5 → counts sum to 5
    expect(stats.count!.reduce((a, b) => a + b, 0)).toBe(5);
  });
  it('leading takes the first digit of each term', () => {
    const stats = histogramViz.statistics!(mk([123n, 91n, 8n]), { target: 'leading', bins: 9 });
    expect(stats.count!.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('autocorrelation', () => {
  it('r[0] is 1; alternating series has r[1] = -(n-1)/n', () => {
    const alt = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 1 : -1));
    const r = autocorrelation(alt, 2);
    expect(r[0]).toBeCloseTo(1, 10);
    expect(r[1]).toBeCloseTo(-0.9, 10);
  });
  it('returns zeros for constant series', () => {
    expect(autocorrelation([4, 4, 4, 4], 2)).toEqual([0, 0, 0]);
  });
});

describe('render smoke tests', () => {
  const edgeSeqs = [
    mk([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]),
    mk([-5n, 0n, 5n, -5n, 0n, 5n, -5n, 0n]),
    mk([10n ** 40n, 1n, 10n ** 40n, 1n, 2n, 3n, 4n, 5n]),
  ];
  for (const viz of [histogramViz, autocorrViz]) {
    it(`${viz.id} renders edge cases without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, { width: 400, height: 300 })).not.toThrow();
      }
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/viz/stats.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Implement**

`src/viz/histogram.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const clampBig = (t: bigint) =>
  t > MAX_SAFE ? Number.MAX_SAFE_INTEGER : t < -MAX_SAFE ? -Number.MAX_SAFE_INTEGER : Number(t);

export function computeHistogram(values: number[], binCount: number): { edges: number[]; counts: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const edges = Array.from({ length: binCount + 1 }, (_, i) => lo + (span * i) / binCount);
  const counts = new Array<number>(binCount).fill(0);
  for (const v of values) {
    const bin = Math.min(binCount - 1, Math.floor(((v - lo) / span) * binCount));
    counts[bin]!++;
  }
  return { edges, counts };
}

function targetValues(seq: SequenceView, target: string): number[] {
  const out: number[] = [];
  if (target === 'gaps') {
    for (let i = 0; i + 1 < seq.length; i++) out.push(clampBig(seq.term(i + 1) - seq.term(i)));
  } else if (target === 'digits') {
    for (let i = 0; i < seq.length; i++) out.push(...seq.digits(i));
  } else if (target === 'leading') {
    for (let i = 0; i < seq.length; i++) out.push(seq.digits(i)[0]!);
  } else {
    for (let i = 0; i < seq.length; i++) out.push(seq.toNumber(i));
  }
  return out.length > 0 ? out : [0];
}

export const histogramViz: Visualizer = {
  id: 'histogram',
  name: 'Histogram',
  family: 'stats',
  minTerms: 4,
  params: [
    { kind: 'select', id: 'target', label: 'Of', default: 'terms', options: ['terms', 'gaps', 'digits', 'leading'] },
    { kind: 'number', id: 'bins', label: 'Bins', default: 20, min: 4, max: 60, step: 1 },
  ],
  statistics(seq: SequenceView, params: Params) {
    const { counts } = computeHistogram(targetValues(seq, String(params.target)), Number(params.bins));
    return { count: counts };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const { counts } = computeHistogram(targetValues(seq, String(params.target)), Number(params.bins));
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const maxC = Math.max(...counts, 1);
    const bw = w / counts.length;
    ctx.fillStyle = '#7aa2f7';
    for (let i = 0; i < counts.length; i++) {
      const bh = (counts[i]! / maxC) * h;
      ctx.fillRect(MARGIN + i * bw + 1, MARGIN + h - bh, Math.max(1, bw - 2), bh);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(MARGIN, MARGIN, w, h);
  },
};
```

`src/viz/autocorrelation.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

const MARGIN = 28;

export function autocorrelation(values: number[], maxLag: number): number[] {
  const n = values.length;
  const mu = values.reduce((s, v) => s + v, 0) / n;
  const dev = values.map((v) => v - mu);
  const denom = dev.reduce((s, d) => s + d * d, 0);
  const out: number[] = [];
  for (let k = 0; k <= maxLag; k++) {
    if (denom === 0) { out.push(0); continue; }
    let num = 0;
    for (let i = 0; i + k < n; i++) num += dev[i]! * dev[i + k]!;
    out.push(num / denom);
  }
  return out;
}

function seqValues(seq: SequenceView): number[] {
  const out: number[] = [];
  for (let i = 0; i < seq.length; i++) out.push(seq.toNumber(i));
  return out;
}

export const autocorrViz: Visualizer = {
  id: 'autocorr',
  name: 'Autocorrelation',
  family: 'stats',
  minTerms: 8,
  params: [
    { kind: 'number', id: 'maxLag', label: 'Max lag', default: 32, min: 4, max: 200, step: 1 },
  ],
  statistics(seq: SequenceView, params: Params) {
    const maxLag = Math.min(Number(params.maxLag), seq.length - 2);
    return { r: autocorrelation(seqValues(seq), maxLag) };
  },
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const maxLag = Math.min(Number(params.maxLag), seq.length - 2);
    const r = autocorrelation(seqValues(seq), maxLag);
    const w = size.width - 2 * MARGIN;
    const h = size.height - 2 * MARGIN;
    const x = (k: number) => MARGIN + (k / Math.max(1, r.length - 1)) * w;
    const y = (v: number) => MARGIN + h / 2 - v * (h / 2);

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(MARGIN, y(0));
    ctx.lineTo(MARGIN + w, y(0));
    ctx.stroke();

    ctx.strokeStyle = '#7aa2f7';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < r.length; k++) {
      ctx.beginPath();
      ctx.moveTo(x(k), y(0));
      ctx.lineTo(x(k), y(r[k]!));
      ctx.stroke();
    }
  },
};
```

Update `src/viz/all.ts` registration list:

```ts
import { histogramViz } from './histogram';
import { autocorrViz } from './autocorrelation';
// ...
for (const v of [scatterViz, differencesViz, histogramViz, autocorrViz]) registerVisualizer(v);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/viz/stats.test.ts` then `npm test`
Expected: PASS, full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/viz/histogram.ts src/viz/autocorrelation.ts src/viz/all.ts tests/viz/stats.test.ts
git commit -m "feat: histogram and autocorrelation visualizers"
```

---

### Task 11: Grid visualizers - Ulam-style spiral, mod-N grid

**Files:**
- Create: `src/viz/gridUtils.ts`, `src/viz/ulamSpiral.ts`, `src/viz/modGrid.ts`
- Modify: `src/viz/all.ts` (add both)
- Test: `tests/viz/grid.test.ts`

**Interfaces:**
- Consumes: Task 8 types; `SequenceView`.
- Produces:

```ts
// gridUtils.ts
export function spiralCoord(i: number): { x: number; y: number };
// Counterclockwise square spiral: 0→(0,0), 1→(1,0), 2→(1,1), 3→(0,1), 4→(-1,1),
// 5→(-1,0), 6→(-1,-1), 7→(0,-1), 8→(1,-1), 9→(2,-1). Run lengths 1,1,2,2,3,3,…

// ulamSpiral.ts
export const ulamViz: Visualizer;  // id 'ulam', family 'grid', minTerms 4
// params: [{kind:'select', id:'colorBy', label:'Color by', default:'mod', options:['mod','parity','magnitude']},
//          {kind:'number', id:'modulus', label:'Modulus', default:6, min:2, max:32, step:1}]

// modGrid.ts
export const modGridViz: Visualizer;  // id 'modgrid', family 'grid', minTerms 4
// params: [{kind:'number', id:'modulus', label:'Modulus', default:10, min:2, max:64, step:1},
//          {kind:'number', id:'columns', label:'Columns', default:20, min:4, max:100, step:1}]
```

Coloring: `mod` → `hsl(residue/modulus*360, 65%, 60%)`; `parity` → residue mod 2 picks `#7aa2f7` / `#1d2026`; `magnitude` → lightness scaled by `logMagnitude` relative to the sequence max (guard max 0).

- [ ] **Step 1: Write the failing tests**

`tests/viz/grid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spiralCoord } from '../../src/viz/gridUtils';
import { ulamViz } from '../../src/viz/ulamSpiral';
import { modGridViz } from '../../src/viz/modGrid';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('spiralCoord', () => {
  it('matches the canonical counterclockwise spiral', () => {
    const expected = [
      [0, 0], [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1], [2, -1],
    ];
    expected.forEach(([x, y], i) => {
      expect(spiralCoord(i)).toEqual({ x, y });
    });
  });
});

describe('grid render smoke tests', () => {
  const edgeSeqs = [
    mk([1n, 2n, 3n, 4n]),
    mk(Array.from({ length: 200 }, (_, i) => BigInt(i * i))),
    mk([-5n, 0n, 10n ** 40n, 3n]),
  ];
  for (const viz of [ulamViz, modGridViz]) {
    it(`${viz.id} renders edge cases without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, { width: 400, height: 400 })).not.toThrow();
      }
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/viz/grid.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Implement**

`src/viz/gridUtils.ts`:

```ts
export function spiralCoord(i: number): { x: number; y: number } {
  // Walk the spiral: direction cycle R,U,L,D with run lengths 1,1,2,2,3,3,…
  let x = 0, y = 0;
  let dir = 0; // 0=R 1=U 2=L 3=D
  let run = 1, stepsInRun = 0, runsAtThisLength = 0;
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1];
  for (let n = 0; n < i; n++) {
    x += dx[dir]!;
    y += dy[dir]!;
    stepsInRun++;
    if (stepsInRun === run) {
      stepsInRun = 0;
      dir = (dir + 1) % 4;
      runsAtThisLength++;
      if (runsAtThisLength === 2) { runsAtThisLength = 0; run++; }
    }
  }
  return { x, y };
}
```

`src/viz/ulamSpiral.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { spiralCoord } from './gridUtils';

function cellColor(seq: SequenceView, i: number, colorBy: string, modulus: number, maxLog: number): string {
  if (colorBy === 'parity') return seq.mod(i, 2) === 0 ? '#1d2026' : '#7aa2f7';
  if (colorBy === 'magnitude') {
    const l = maxLog > 0 ? (seq.logMagnitude(i) / maxLog) * 60 + 15 : 40;
    return `hsl(220, 60%, ${l}%)`;
  }
  return `hsl(${(seq.mod(i, modulus) / modulus) * 360}, 65%, 60%)`;
}

export const ulamViz: Visualizer = {
  id: 'ulam',
  name: 'Ulam-style spiral',
  family: 'grid',
  minTerms: 4,
  params: [
    { kind: 'select', id: 'colorBy', label: 'Color by', default: 'mod', options: ['mod', 'parity', 'magnitude'] },
    { kind: 'number', id: 'modulus', label: 'Modulus', default: 6, min: 2, max: 32, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const n = seq.length;
    const coords = Array.from({ length: n }, (_, i) => spiralCoord(i));
    const xs = coords.map((c) => c.x), ys = coords.map((c) => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const cols = maxX - minX + 1, rows = maxY - minY + 1;
    const cell = Math.max(1, Math.floor(Math.min(size.width / cols, size.height / rows)));
    const ox = (size.width - cols * cell) / 2;
    const oy = (size.height - rows * cell) / 2;
    let maxLog = 0;
    for (let i = 0; i < n; i++) maxLog = Math.max(maxLog, seq.logMagnitude(i));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cellColor(seq, i, String(params.colorBy), Number(params.modulus), maxLog);
      const c = coords[i]!;
      // canvas y grows downward; flip so the spiral matches math orientation
      ctx.fillRect(ox + (c.x - minX) * cell, oy + (maxY - c.y) * cell, cell, cell);
    }
  },
};
```

`src/viz/modGrid.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

export const modGridViz: Visualizer = {
  id: 'modgrid',
  name: 'Mod-N grid',
  family: 'grid',
  minTerms: 4,
  params: [
    { kind: 'number', id: 'modulus', label: 'Modulus', default: 10, min: 2, max: 64, step: 1 },
    { kind: 'number', id: 'columns', label: 'Columns', default: 20, min: 4, max: 100, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    const m = Number(params.modulus);
    const cols = Number(params.columns);
    const rows = Math.ceil(seq.length / cols);
    const cell = Math.max(1, Math.floor(Math.min(size.width / cols, size.height / rows)));
    const ox = (size.width - cols * cell) / 2;
    const oy = (size.height - rows * cell) / 2;
    for (let i = 0; i < seq.length; i++) {
      const r = seq.mod(i, m);
      ctx.fillStyle = `hsl(${(r / m) * 360}, 65%, ${25 + (r / m) * 45}%)`;
      ctx.fillRect(ox + (i % cols) * cell, oy + Math.floor(i / cols) * cell, cell, cell);
    }
  },
};
```

Update `src/viz/all.ts` list to include `ulamViz, modGridViz`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/viz/grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viz/gridUtils.ts src/viz/ulamSpiral.ts src/viz/modGrid.ts src/viz/all.ts tests/viz/grid.test.ts
git commit -m "feat: Ulam spiral and mod-N grid visualizers"
```

---

### Task 12: Trajectory visualizers - turtle walk, digit walk

**Files:**
- Create: `src/viz/turtle.ts`, `src/viz/digitWalk.ts`
- Modify: `src/viz/all.ts` (add both)
- Test: `tests/viz/trajectory.test.ts`

**Interfaces:**
- Consumes: Task 8 types; `SequenceView`.
- Produces:

```ts
// turtle.ts
export function turtlePath(seq: SequenceView, angleDeg: number, k: number): Array<{ x: number; y: number }>;
// Start at (0,0) heading +x. For each term i: turn by angleDeg * seq.mod(i, k)
// degrees (counterclockwise), then step 1 unit. Returns length+1 points.
export const turtleViz: Visualizer;  // id 'turtle', family 'trajectory', minTerms 4
// params: [{kind:'number', id:'angle', label:'Angle °', default:90, min:1, max:180, step:1},
//          {kind:'number', id:'k', label:'Mod k', default:4, min:2, max:24, step:1}]

// digitWalk.ts
export function digitWalkPath(seq: SequenceView, base: number): Array<{ x: number; y: number }>;
// Pool the base-b digits of every |term| in order. Each digit d steps 1 unit in
// direction 2π·d/base (0 = +x, counterclockwise). Returns digitCount+1 points.
export const digitWalkViz: Visualizer;  // id 'digitwalk', family 'trajectory', minTerms 2
// params: [{kind:'number', id:'base', label:'Base', default:10, min:2, max:16, step:1}]
```

Both `render`s: compute the path, fit its bounding box into the canvas with 10% padding (uniform scale), stroke the polyline with hue advancing along the path (`hsl(i/points*300, 70%, 60%)` per segment).

- [ ] **Step 1: Write the failing tests**

`tests/viz/trajectory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { turtlePath, turtleViz } from '../../src/viz/turtle';
import { digitWalkPath, digitWalkViz } from '../../src/viz/digitWalk';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('turtlePath', () => {
  it('zero turns walk straight along +x', () => {
    const path = turtlePath(mk([0n, 4n, 8n]), 90, 4); // all ≡ 0 mod 4
    expect(path.length).toBe(4);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[3]!.x).toBeCloseTo(3, 10);
    expect(path[3]!.y).toBeCloseTo(0, 10);
  });
  it('constant 90° turns trace a unit square', () => {
    const path = turtlePath(mk([1n, 1n, 1n, 1n]), 90, 4);
    expect(path[1]!.x).toBeCloseTo(0, 10); // first turn: heading +y
    expect(path[1]!.y).toBeCloseTo(1, 10);
    expect(path[4]!.x).toBeCloseTo(0, 10); // returns to origin
    expect(path[4]!.y).toBeCloseTo(0, 10);
  });
});

describe('digitWalkPath', () => {
  it('digit 0 steps +x, digit base/2 steps -x', () => {
    const path = digitWalkPath(mk([0n, 2n]), 4); // digits: [0], [2]
    expect(path.length).toBe(3);
    expect(path[1]!.x).toBeCloseTo(1, 10);
    expect(path[1]!.y).toBeCloseTo(0, 10);
    expect(path[2]!.x).toBeCloseTo(0, 10); // 2/4 → angle π → back to x=0
    expect(path[2]!.y).toBeCloseTo(0, 10);
  });
  it('pools multi-digit terms', () => {
    expect(digitWalkPath(mk([123n]), 10).length).toBe(4); // 3 digits + origin
  });
});

describe('trajectory render smoke tests', () => {
  const edgeSeqs = [
    mk([1n, 2n, 3n, 4n]),
    mk([-5n, 0n, 5n, -5n]),
    mk([10n ** 40n, 1n, 10n ** 40n, 2n]),
  ];
  for (const viz of [turtleViz, digitWalkViz]) {
    it(`${viz.id} renders edge cases without throwing`, () => {
      for (const seq of edgeSeqs) {
        const { ctx } = fakeCtx();
        expect(() => viz.render(seq, defaultParams(viz.params), ctx, { width: 400, height: 400 })).not.toThrow();
      }
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/viz/trajectory.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Implement**

`src/viz/turtle.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';

export function turtlePath(seq: SequenceView, angleDeg: number, k: number): Array<{ x: number; y: number }> {
  const pts = [{ x: 0, y: 0 }];
  let heading = 0;
  let x = 0, y = 0;
  for (let i = 0; i < seq.length; i++) {
    heading += (angleDeg * seq.mod(i, k) * Math.PI) / 180;
    x += Math.cos(heading);
    y += Math.sin(heading);
    pts.push({ x, y });
  }
  return pts;
}

export function strokePath(
  pts: Array<{ x: number; y: number }>,
  ctx: CanvasRenderingContext2D,
  size: Size,
): void {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const pad = 0.1;
  const scale = Math.min((size.width * (1 - 2 * pad)) / spanX, (size.height * (1 - 2 * pad)) / spanY);
  const ox = (size.width - spanX * scale) / 2 - minX * scale;
  const oy = (size.height - spanY * scale) / 2 - minY * scale;
  ctx.lineWidth = 1.25;
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = `hsl(${(i / pts.length) * 300}, 70%, 60%)`;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1]!.x * scale + ox, size.height - (pts[i - 1]!.y * scale + oy));
    ctx.lineTo(pts[i]!.x * scale + ox, size.height - (pts[i]!.y * scale + oy));
    ctx.stroke();
  }
}

export const turtleViz: Visualizer = {
  id: 'turtle',
  name: 'Turtle walk',
  family: 'trajectory',
  minTerms: 4,
  params: [
    { kind: 'number', id: 'angle', label: 'Angle °', default: 90, min: 1, max: 180, step: 1 },
    { kind: 'number', id: 'k', label: 'Mod k', default: 4, min: 2, max: 24, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    strokePath(turtlePath(seq, Number(params.angle), Number(params.k)), ctx, size);
  },
};
```

`src/viz/digitWalk.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokePath } from './turtle';

export function digitWalkPath(seq: SequenceView, base: number): Array<{ x: number; y: number }> {
  const pts = [{ x: 0, y: 0 }];
  let x = 0, y = 0;
  for (let i = 0; i < seq.length; i++) {
    for (const d of seq.digits(i, base)) {
      const a = (2 * Math.PI * d) / base;
      x += Math.cos(a);
      y += Math.sin(a);
      pts.push({ x, y });
    }
  }
  return pts;
}

export const digitWalkViz: Visualizer = {
  id: 'digitwalk',
  name: '2D digit walk',
  family: 'trajectory',
  minTerms: 2,
  params: [
    { kind: 'number', id: 'base', label: 'Base', default: 10, min: 2, max: 16, step: 1 },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    strokePath(digitWalkPath(seq, Number(params.base)), ctx, size);
  },
};
```

Update `src/viz/all.ts` list to include `turtleViz, digitWalkViz`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/viz/trajectory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viz/turtle.ts src/viz/digitWalk.ts src/viz/all.ts tests/viz/trajectory.test.ts
git commit -m "feat: turtle walk and digit walk trajectory visualizers"
```

---

### Task 13: Polyarc curve visualizer (NCurve-style)

**Files:**
- Create: `src/viz/polyarc.ts`
- Modify: `src/viz/all.ts` (add it)
- Test: `tests/viz/polyarc.test.ts`

**Interfaces:**
- Consumes: Task 8 types; `SequenceView`; `strokePath` (Task 12).
- Produces:

```ts
export function polyarcPath(
  seq: SequenceView,
  opts: { angle: number; modulus: number; centered: boolean; segments?: number },
): Array<{ x: number; y: number }>;
// Each term i contributes one arc of unit length: total turning
// δ_i = angle° × (centered ? residue − (modulus−1)/2 : residue), residue = seq.mod(i, modulus).
// The arc is approximated by `segments` (default 8) sub-steps, each turning δ_i/segments
// then advancing 1/segments. Start (0,0) heading +x. Returns seq.length×segments + 1 points.
export const polyarcViz: Visualizer;  // id 'polyarc', family 'trajectory', minTerms 4
// params: [{kind:'number', id:'angle', label:'Angle °', default:30, min:1, max:120, step:1},
//          {kind:'number', id:'modulus', label:'Modulus', default:7, min:2, max:32, step:1},
//          {kind:'boolean', id:'centered', label:'Center residues', default:true}]
```

Centered residues make low residues curve one way and high residues the other - this is what produces NCurve's organic closed forms rather than always-spiraling-left curves.

- [ ] **Step 1: Write the failing tests**

`tests/viz/polyarc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { polyarcPath, polyarcViz } from '../../src/viz/polyarc';
import { SequenceView, type Sequence } from '../../src/sequence/sequence';
import { defaultParams } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mk = (terms: bigint[]): SequenceView =>
  new SequenceView({ terms, name: 't', offset: 0, source: 'paste' } as Sequence);

describe('polyarcPath', () => {
  it('zero residues, uncentered → straight unit steps along +x', () => {
    const path = polyarcPath(mk([0n, 7n, 14n]), { angle: 30, modulus: 7, centered: false });
    expect(path.length).toBe(3 * 8 + 1);
    expect(path[path.length - 1]!.x).toBeCloseTo(3, 8);
    expect(path[path.length - 1]!.y).toBeCloseTo(0, 8);
  });

  it('is deterministic and respects the segments option', () => {
    const a = polyarcPath(mk([1n, 2n, 3n]), { angle: 30, modulus: 7, centered: true, segments: 4 });
    const b = polyarcPath(mk([1n, 2n, 3n]), { angle: 30, modulus: 7, centered: true, segments: 4 });
    expect(a).toEqual(b);
    expect(a.length).toBe(3 * 4 + 1);
  });

  it('centered flips curvature sign around the middle residue', () => {
    // modulus 3, centered: residue 0 → −angle, residue 2 → +angle. Mirror-symmetric y.
    const lo = polyarcPath(mk([0n]), { angle: 45, modulus: 3, centered: true });
    const hi = polyarcPath(mk([2n]), { angle: 45, modulus: 3, centered: true });
    expect(lo[lo.length - 1]!.y).toBeCloseTo(-hi[hi.length - 1]!.y, 8);
    expect(lo[lo.length - 1]!.x).toBeCloseTo(hi[hi.length - 1]!.x, 8);
  });
});

describe('polyarc render smoke test', () => {
  it('renders edge cases without throwing', () => {
    for (const seq of [mk([1n, 2n, 3n, 4n]), mk([-5n, 0n, 10n ** 40n, 3n])]) {
      const { ctx } = fakeCtx();
      expect(() => polyarcViz.render(seq, defaultParams(polyarcViz.params), ctx, { width: 400, height: 400 })).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/viz/polyarc.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement**

`src/viz/polyarc.ts`:

```ts
import type { SequenceView } from '../sequence/sequence';
import type { Params, Size, Visualizer } from './types';
import { strokePath } from './turtle';

export function polyarcPath(
  seq: SequenceView,
  opts: { angle: number; modulus: number; centered: boolean; segments?: number },
): Array<{ x: number; y: number }> {
  const segments = opts.segments ?? 8;
  const pts = [{ x: 0, y: 0 }];
  let heading = 0;
  let x = 0, y = 0;
  for (let i = 0; i < seq.length; i++) {
    const residue = seq.mod(i, opts.modulus);
    const signed = opts.centered ? residue - (opts.modulus - 1) / 2 : residue;
    const deltaRad = (opts.angle * signed * Math.PI) / 180;
    for (let s = 0; s < segments; s++) {
      heading += deltaRad / segments;
      x += Math.cos(heading) / segments;
      y += Math.sin(heading) / segments;
      pts.push({ x, y });
    }
  }
  return pts;
}

export const polyarcViz: Visualizer = {
  id: 'polyarc',
  name: 'Polyarc curve',
  family: 'trajectory',
  minTerms: 4,
  params: [
    { kind: 'number', id: 'angle', label: 'Angle °', default: 30, min: 1, max: 120, step: 1 },
    { kind: 'number', id: 'modulus', label: 'Modulus', default: 7, min: 2, max: 32, step: 1 },
    { kind: 'boolean', id: 'centered', label: 'Center residues', default: true },
  ],
  render(seq: SequenceView, params: Params, ctx: CanvasRenderingContext2D, size: Size) {
    strokePath(
      polyarcPath(seq, {
        angle: Number(params.angle),
        modulus: Number(params.modulus),
        centered: Boolean(params.centered),
      }),
      ctx,
      size,
    );
  },
};
```

Update `src/viz/all.ts` - final registration list (all nine):

```ts
for (const v of [
  scatterViz, differencesViz,
  histogramViz, autocorrViz,
  ulamViz, modGridViz,
  turtleViz, digitWalkViz, polyarcViz,
]) registerVisualizer(v);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/viz/polyarc.test.ts` then `npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/viz/polyarc.ts src/viz/all.ts tests/viz/polyarc.test.ts
git commit -m "feat: NCurve-style polyarc curve visualizer"
```

---

### Task 14: Ensemble runner and Web Worker

**Files:**
- Create: `src/nullmodel/ensemble.ts`, `src/nullmodel/ensembleWorker.ts`
- Test: `tests/nullmodel/ensemble.test.ts`

**Interfaces:**
- Consumes: `makeSurrogate`, `SurrogateType` (Task 7); `percentileBands`, `Bands` (Task 7); `getVisualizer` (Task 8); `registerAll` (Task 9); `SequenceView` (Task 2); `Params` (Task 8).
- Produces:

```ts
// ensemble.ts
export interface EnsembleJob {
  terms: string[];          // bigint terms as decimal strings (structured-clone-friendly)
  surrogate: SurrogateType;
  count: number;            // clamped into [1, 1000]
  seed: number;
  vizId: string;
  params: Params;
  loPct?: number;           // default 5
  hiPct?: number;           // default 95
}
export interface EnsembleResult { stats: Record<string, Bands>; }
export function runEnsemble(job: EnsembleJob, onProgress?: (done: number, total: number) => void): EnsembleResult;
// Throws if vizId is unknown or the visualizer has no statistics().
// Surrogate j uses seed job.seed + j - reproducible and independent per member.

export type EnsembleMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; stats: Record<string, Bands> }
  | { type: 'error'; message: string };
export function startEnsembleWorker(
  job: EnsembleJob,
  handlers: { onProgress(done: number, total: number): void; onResult(stats: Record<string, Bands>): void; onError(message: string): void },
): { cancel(): void };
// Spawns new Worker(new URL('./ensembleWorker.ts', import.meta.url), { type: 'module' });
// cancel() terminates it.
```

- [ ] **Step 1: Write the failing tests**

`tests/nullmodel/ensemble.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runEnsemble, type EnsembleJob } from '../../src/nullmodel/ensemble';

const job = (over: Partial<EnsembleJob> = {}): EnsembleJob => ({
  terms: ['0', '1', '1', '2', '3', '5', '8', '13'],
  surrogate: 'permutation',
  count: 8,
  seed: 1,
  vizId: 'scatter',
  params: { scale: 'linear' },
  ...over,
});

describe('runEnsemble', () => {
  it('produces per-index bands matching the statistic length, deterministically', () => {
    const a = runEnsemble(job());
    const b = runEnsemble(job());
    expect(a).toEqual(b);
    expect(a.stats.value!.median.length).toBe(8);
    expect(a.stats.value!.lo.length).toBe(8);
  });

  it('permutation bands stay within the value range', () => {
    const { stats } = runEnsemble(job());
    for (const v of stats.value!.hi) expect(v).toBeLessThanOrEqual(13);
    for (const v of stats.value!.lo) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('reports progress and clamps count', () => {
    const seen: number[] = [];
    runEnsemble(job({ count: 5000 }), (done, total) => { seen.push(done); expect(total).toBe(1000); });
    expect(seen.length).toBe(1000);
  });

  it('throws for unknown viz or one without statistics', () => {
    expect(() => runEnsemble(job({ vizId: 'nope' }))).toThrow(/nope/);
    expect(() => runEnsemble(job({ vizId: 'turtle' }))).toThrow(/statistics/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/nullmodel/ensemble.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement**

`src/nullmodel/ensemble.ts`:

```ts
import { SequenceView, type Sequence } from '../sequence/sequence';
import { makeSurrogate, type SurrogateType } from './surrogates';
import { percentileBands, type Bands } from './bands';
import { getVisualizer } from '../viz/registry';
import { registerAll } from '../viz/all';
import type { Params } from '../viz/types';

registerAll();

export interface EnsembleJob {
  terms: string[];
  surrogate: SurrogateType;
  count: number;
  seed: number;
  vizId: string;
  params: Params;
  loPct?: number;
  hiPct?: number;
}

export interface EnsembleResult { stats: Record<string, Bands>; }

export function runEnsemble(
  job: EnsembleJob,
  onProgress?: (done: number, total: number) => void,
): EnsembleResult {
  const viz = getVisualizer(job.vizId);
  if (!viz.statistics) throw new Error(`Visualizer "${job.vizId}" has no statistics() - ensemble mode unavailable.`);
  const terms = job.terms.map((t) => BigInt(t));
  const total = Math.max(1, Math.min(1000, Math.floor(job.count)));

  const collected: Record<string, number[][]> = {};
  for (let j = 0; j < total; j++) {
    const surrTerms = makeSurrogate(terms, job.surrogate, job.seed + j);
    const seq: Sequence = { terms: surrTerms, name: 'surrogate', offset: 0, source: 'paste' };
    const stats = viz.statistics(new SequenceView(seq), job.params);
    for (const [key, arr] of Object.entries(stats)) {
      (collected[key] ??= []).push(arr);
    }
    onProgress?.(j + 1, total);
  }

  const stats: Record<string, Bands> = {};
  for (const [key, arrays] of Object.entries(collected)) {
    stats[key] = percentileBands(arrays, job.loPct ?? 5, job.hiPct ?? 95);
  }
  return { stats };
}

export type EnsembleMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; stats: Record<string, Bands> }
  | { type: 'error'; message: string };

export function startEnsembleWorker(
  job: EnsembleJob,
  handlers: {
    onProgress(done: number, total: number): void;
    onResult(stats: Record<string, Bands>): void;
    onError(message: string): void;
  },
): { cancel(): void } {
  const worker = new Worker(new URL('./ensembleWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<EnsembleMessage>) => {
    const msg = e.data;
    if (msg.type === 'progress') handlers.onProgress(msg.done, msg.total);
    else if (msg.type === 'result') { handlers.onResult(msg.stats); worker.terminate(); }
    else { handlers.onError(msg.message); worker.terminate(); }
  };
  worker.postMessage(job);
  return { cancel: () => worker.terminate() };
}
```

`src/nullmodel/ensembleWorker.ts`:

```ts
import { runEnsemble, type EnsembleJob, type EnsembleMessage } from './ensemble';

self.onmessage = (e: MessageEvent<EnsembleJob>) => {
  const post = (m: EnsembleMessage) => (self as unknown as Worker).postMessage(m);
  try {
    const every = Math.max(1, Math.floor(Math.min(1000, e.data.count) / 20));
    const { stats } = runEnsemble(e.data, (done, total) => {
      if (done % every === 0 || done === total) post({ type: 'progress', done, total });
    });
    post({ type: 'result', stats });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/nullmodel/ensemble.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/nullmodel/ensemble.ts src/nullmodel/ensembleWorker.ts tests/nullmodel/ensemble.test.ts
git commit -m "feat: ensemble runner with Web Worker wrapper and progress"
```

---

### Task 15: App shell UI - layout, sequence panel, presets, param controls

**Files:**
- Create: `src/ui/app.ts`, `src/ui/sequencePanel.ts`, `src/ui/paramControls.ts`, `src/ui/messages.ts`, `src/sequence/presets.ts`
- Modify: `src/main.ts` (mount the app), `src/style.css` (layout styles)
- Test: `tests/ui/ui.test.ts` (jsdom)

Load the `frontend-design` skill before implementing this task.

**Interfaces:**
- Consumes: everything from Tasks 2–13.
- Produces:

```ts
// presets.ts
export interface Preset { aNumber: string; label: string; }
export const PRESETS: Preset[];

// messages.ts
export function initMessages(container: HTMLElement): void; // call once from app
export function showError(msg: string): void;   // red transient banner (6s)
export function showNotice(msg: string): void;  // neutral transient banner (4s)

// paramControls.ts
export function buildParamControls(
  specs: ParamSpec[],
  values: Params,
  onChange: (id: string, value: ParamValue) => void,
): HTMLElement;
// number → <input type="range"> + live value label; select → <select>; boolean → <input type="checkbox">
// onChange receives properly coerced values (number for range, boolean for checkbox).

// sequencePanel.ts
export function buildSequencePanel(handlers: {
  onSequence(seq: Sequence): void;
  onError(msg: string): void;
}): { el: HTMLElement; setInfo(seq: Sequence): void };
// Tabs: "A-number" | "Search" | "Custom" (paste textarea + formula input + term count).
// Presets shelf below the tabs. setInfo fills the info card: name, linked A-number,
// term count, source, and - for source 'oeis' - a "Load all terms" b-file button
// with a numeric cap input (default 10000); on success calls
// handlers.onSequence(withTerms(seq, terms)).

// app.ts
export function mountApp(root: HTMLElement): void;
// Layout: <div class="layout"> sidebar | <main> topbar (viz picker + params) + canvas area.
// State: { seq, vizId, params }; picker change resets params to defaultParams(viz.params);
// any change triggers redraw(). redraw() sizes the canvas to its container with
// devicePixelRatio scaling, fills the background, warns via showNotice when
// seq.length < viz.minTerms (still renders what it can), and calls viz.render.
// If canvas.getContext('2d') returns null (jsdom), redraw returns silently.
```

- [ ] **Step 1: Write the failing tests**

`tests/ui/ui.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { buildParamControls } from '../../src/ui/paramControls';
import { buildSequencePanel } from '../../src/ui/sequencePanel';
import { mountApp } from '../../src/ui/app';
import { PRESETS } from '../../src/sequence/presets';

describe('PRESETS', () => {
  it('includes the SeqFan finds and classics', () => {
    const ids = PRESETS.map((p) => p.aNumber);
    for (const a of ['A000376', 'A000464', 'A000828', 'A001051', 'A001553',
                     'A001571', 'A001603', 'A019488', 'A039188', 'A039685',
                     'A039970', 'A000045', 'A000040', 'A005132']) {
      expect(ids).toContain(a);
    }
  });
});

describe('buildParamControls', () => {
  const specs = [
    { kind: 'number', id: 'k', label: 'K', default: 4, min: 2, max: 12, step: 1 },
    { kind: 'select', id: 'mode', label: 'Mode', default: 'a', options: ['a', 'b'] },
    { kind: 'boolean', id: 'log', label: 'Log', default: false },
  ] as const;

  it('renders one control per spec', () => {
    const el = buildParamControls([...specs], { k: 4, mode: 'a', log: false }, () => {});
    expect(el.querySelectorAll('input[type="range"]').length).toBe(1);
    expect(el.querySelectorAll('select').length).toBe(1);
    expect(el.querySelectorAll('input[type="checkbox"]').length).toBe(1);
  });

  it('emits coerced values on change', () => {
    const onChange = vi.fn();
    const el = buildParamControls([...specs], { k: 4, mode: 'a', log: false }, onChange);
    const range = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    range.value = '7';
    range.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('k', 7);
  });
});

describe('buildSequencePanel', () => {
  it('has three tabs and a presets shelf', () => {
    const { el } = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    expect(el.querySelectorAll('.tab-button').length).toBe(3);
    expect(el.querySelectorAll('.preset-button').length).toBe(PRESETS.length);
  });

  it('setInfo shows name and b-file button for OEIS sequences', () => {
    const panel = buildSequencePanel({ onSequence: () => {}, onError: () => {} });
    panel.setInfo({ terms: [1n], aNumber: 'A000045', name: 'Fibonacci numbers', offset: 0, source: 'oeis' });
    expect(panel.el.textContent).toContain('Fibonacci');
    expect(panel.el.querySelector('.bfile-button')).not.toBeNull();
    panel.setInfo({ terms: [1n], name: 'n*n', offset: 0, source: 'formula' });
    expect(panel.el.querySelector('.bfile-button')).toBeNull();
  });
});

describe('mountApp', () => {
  it('mounts sidebar, picker with all visualizers, and a canvas', () => {
    const root = document.createElement('div');
    mountApp(root);
    expect(root.querySelector('.sidebar')).not.toBeNull();
    expect(root.querySelector('canvas')).not.toBeNull();
    const picker = root.querySelector<HTMLSelectElement>('.viz-picker')!;
    expect(picker.options.length).toBe(9);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/ui.test.ts`
Expected: FAIL - modules not found.

- [ ] **Step 3: Implement**

`src/sequence/presets.ts`:

```ts
export interface Preset { aNumber: string; label: string; }

export const PRESETS: Preset[] = [
  // SeqFan thread finds (Bill McEachen's names)
  { aNumber: 'A000376', label: 'French curve' },
  { aNumber: 'A000464', label: 'Pie crust' },
  { aNumber: 'A000828', label: 'Propeller' },
  { aNumber: 'A001051', label: 'Tire' },
  { aNumber: 'A001553', label: 'Saw blade' },
  { aNumber: 'A001571', label: 'A001571' },
  { aNumber: 'A001603', label: 'A001603' },
  { aNumber: 'A019488', label: "Sloane's find" },
  { aNumber: 'A039188', label: 'Record disc' },
  { aNumber: 'A039685', label: 'Zipper' },
  { aNumber: 'A039970', label: 'Slinky' },
  // Classics
  { aNumber: 'A000045', label: 'Fibonacci' },
  { aNumber: 'A000040', label: 'Primes' },
  { aNumber: 'A005132', label: 'Recamán' },
];
```

`src/ui/messages.ts`:

```ts
let container: HTMLElement | null = null;

export function initMessages(el: HTMLElement): void {
  container = el;
}

function banner(msg: string, cls: string, ms: number): void {
  if (!container) return;
  const div = document.createElement('div');
  div.className = `banner ${cls}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), ms);
}

export function showError(msg: string): void { banner(msg, 'banner-error', 6000); }
export function showNotice(msg: string): void { banner(msg, 'banner-notice', 4000); }
```

`src/ui/paramControls.ts`:

```ts
import type { ParamSpec, ParamValue, Params } from '../viz/types';

export function buildParamControls(
  specs: ParamSpec[],
  values: Params,
  onChange: (id: string, value: ParamValue) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'param-controls';
  for (const spec of specs) {
    const field = document.createElement('label');
    field.className = 'param-field';
    const title = document.createElement('span');
    title.textContent = spec.label;
    field.appendChild(title);

    if (spec.kind === 'number') {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(values[spec.id] ?? spec.default);
      const val = document.createElement('span');
      val.className = 'param-value';
      val.textContent = input.value;
      input.addEventListener('input', () => {
        val.textContent = input.value;
        onChange(spec.id, Number(input.value));
      });
      field.append(input, val);
    } else if (spec.kind === 'select') {
      const sel = document.createElement('select');
      for (const opt of spec.options) {
        const o = document.createElement('option');
        o.value = o.textContent = opt;
        sel.appendChild(o);
      }
      sel.value = String(values[spec.id] ?? spec.default);
      sel.addEventListener('change', () => onChange(spec.id, sel.value));
      field.appendChild(sel);
    } else {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = Boolean(values[spec.id] ?? spec.default);
      cb.addEventListener('change', () => onChange(spec.id, cb.checked));
      field.appendChild(cb);
    }
    wrap.appendChild(field);
  }
  return wrap;
}
```

`src/ui/sequencePanel.ts`:

```ts
import type { Sequence } from '../sequence/sequence';
import { lookupById, search, fetchBFile, withTerms } from '../sequence/oeisClient';
import { sequenceFromPaste } from '../sequence/pasteParser';
import { sequenceFromFormula, validateFormula } from '../sequence/formula';
import { PRESETS } from '../sequence/presets';

interface Handlers {
  onSequence(seq: Sequence): void;
  onError(msg: string): void;
}

export function buildSequencePanel(handlers: Handlers): { el: HTMLElement; setInfo(seq: Sequence): void } {
  const el = document.createElement('div');
  el.className = 'sequence-panel';

  // --- tabs ---
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  const panes: Record<string, HTMLElement> = {};
  for (const name of ['A-number', 'Search', 'Custom']) {
    const btn = document.createElement('button');
    btn.className = 'tab-button';
    btn.textContent = name;
    btn.addEventListener('click', () => {
      for (const [k, pane] of Object.entries(panes)) pane.hidden = k !== name;
      tabBar.querySelectorAll('.tab-button').forEach((b) => b.classList.toggle('active', b === btn));
    });
    tabBar.appendChild(btn);
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.hidden = name !== 'A-number';
    panes[name] = pane;
  }
  el.appendChild(tabBar);

  const load = (p: Promise<Sequence>) =>
    p.then(handlers.onSequence).catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)));

  // A-number pane
  {
    const pane = panes['A-number']!;
    const input = document.createElement('input');
    input.placeholder = 'A000045';
    const btn = document.createElement('button');
    btn.textContent = 'Load';
    btn.addEventListener('click', () => load(lookupById(input.value)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(lookupById(input.value)); });
    pane.append(input, btn);
    el.appendChild(pane);
  }

  // Search pane
  {
    const pane = panes['Search']!;
    const input = document.createElement('input');
    input.placeholder = 'e.g. partition numbers';
    const btn = document.createElement('button');
    btn.textContent = 'Search';
    const results = document.createElement('ul');
    results.className = 'search-results';
    const run = () =>
      search(input.value)
        .then((hits) => {
          results.replaceChildren();
          if (hits.length === 0) { handlers.onError('No matches.'); return; }
          for (const hit of hits.slice(0, 12)) {
            const li = document.createElement('li');
            const a = document.createElement('button');
            a.textContent = `${hit.aNumber} - ${hit.name}`;
            a.addEventListener('click', () => load(lookupById(hit.aNumber)));
            li.appendChild(a);
            results.appendChild(li);
          }
        })
        .catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)));
    btn.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    pane.append(input, btn, results);
    el.appendChild(pane);
  }

  // Custom pane (paste + formula)
  {
    const pane = panes['Custom']!;
    const ta = document.createElement('textarea');
    ta.placeholder = 'Paste terms: 0, 1, 1, 2, 3, 5, …';
    const pasteBtn = document.createElement('button');
    pasteBtn.textContent = 'Load pasted';
    pasteBtn.addEventListener('click', () => {
      try { handlers.onSequence(sequenceFromPaste(ta.value)); }
      catch (e) { handlers.onError(e instanceof Error ? e.message : String(e)); }
    });

    const formula = document.createElement('input');
    formula.placeholder = 'Formula in n, e.g. n*n + n + 41';
    const formulaErr = document.createElement('div');
    formulaErr.className = 'formula-error';
    formula.addEventListener('input', () => {
      formulaErr.textContent = formula.value ? validateFormula(formula.value) ?? '' : '';
    });
    const count = document.createElement('input');
    count.type = 'number';
    count.value = '200';
    const formulaBtn = document.createElement('button');
    formulaBtn.textContent = 'Generate';
    formulaBtn.addEventListener('click', () => {
      try { handlers.onSequence(sequenceFromFormula(formula.value, Number(count.value))); }
      catch (e) { handlers.onError(e instanceof Error ? e.message : String(e)); }
    });
    pane.append(ta, pasteBtn, formula, formulaErr, count, formulaBtn);
    el.appendChild(pane);
  }

  // presets shelf
  const shelf = document.createElement('div');
  shelf.className = 'presets-shelf';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'preset-button';
    b.textContent = p.label;
    b.title = p.aNumber;
    b.addEventListener('click', () => load(lookupById(p.aNumber)));
    shelf.appendChild(b);
  }
  el.appendChild(shelf);

  // info card
  const info = document.createElement('div');
  info.className = 'info-card';
  el.appendChild(info);

  function setInfo(seq: Sequence): void {
    info.replaceChildren();
    const name = document.createElement('div');
    name.className = 'info-name';
    name.textContent = seq.name;
    info.appendChild(name);
    const meta = document.createElement('div');
    meta.className = 'info-meta';
    if (seq.aNumber) {
      const a = document.createElement('a');
      a.href = `https://oeis.org/${seq.aNumber}`;
      a.target = '_blank';
      a.textContent = seq.aNumber;
      meta.appendChild(a);
    }
    meta.append(` · ${seq.terms.length} terms · ${seq.source}`);
    info.appendChild(meta);
    if (seq.source === 'oeis' && seq.aNumber) {
      const cap = document.createElement('input');
      cap.type = 'number';
      cap.value = '10000';
      cap.className = 'bfile-cap';
      const btn = document.createElement('button');
      btn.className = 'bfile-button';
      btn.textContent = 'Load all terms (b-file)';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        fetchBFile(seq.aNumber!, Number(cap.value))
          .then((terms) => handlers.onSequence(withTerms(seq, terms)))
          .catch((e) => handlers.onError(e instanceof Error ? e.message : String(e)))
          .finally(() => { btn.disabled = false; });
      });
      info.append(btn, cap);
    }
  }

  return { el, setInfo };
}
```

`src/ui/app.ts`:

```ts
import type { Sequence } from '../sequence/sequence';
import { SequenceView } from '../sequence/sequence';
import { registerAll } from '../viz/all';
import { allVisualizers, getVisualizer } from '../viz/registry';
import { defaultParams, type Params } from '../viz/types';
import { buildParamControls } from './paramControls';
import { buildSequencePanel } from './sequencePanel';
import { initMessages, showError, showNotice } from './messages';

export function mountApp(root: HTMLElement): void {
  registerAll();

  const state: { seq: Sequence | null; vizId: string; params: Params } = {
    seq: null,
    vizId: allVisualizers()[0]!.id,
    params: defaultParams(allVisualizers()[0]!.params),
  };

  root.innerHTML = '';
  const layout = document.createElement('div');
  layout.className = 'layout';
  root.appendChild(layout);

  const messages = document.createElement('div');
  messages.className = 'messages';
  root.appendChild(messages);
  initMessages(messages);

  // sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  const panel = buildSequencePanel({
    onSequence(seq) {
      state.seq = seq;
      panel.setInfo(seq);
      redraw();
    },
    onError: showError,
  });
  sidebar.appendChild(panel.el);
  layout.appendChild(sidebar);

  // main column
  const main = document.createElement('main');
  main.className = 'main';
  layout.appendChild(main);

  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  main.appendChild(topbar);

  const picker = document.createElement('select');
  picker.className = 'viz-picker';
  for (const v of allVisualizers()) {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = `${v.family} · ${v.name}`;
    picker.appendChild(o);
  }
  picker.addEventListener('change', () => {
    state.vizId = picker.value;
    state.params = defaultParams(getVisualizer(state.vizId).params);
    rebuildParams();
    redraw();
  });
  topbar.appendChild(picker);

  const paramsHost = document.createElement('div');
  topbar.appendChild(paramsHost);
  function rebuildParams(): void {
    paramsHost.replaceChildren(
      buildParamControls(getVisualizer(state.vizId).params, state.params, (id, value) => {
        state.params[id] = value;
        redraw();
      }),
    );
  }
  rebuildParams();

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'canvas-wrap';
  main.appendChild(canvasWrap);
  const canvas = document.createElement('canvas');
  canvasWrap.appendChild(canvas);

  function redraw(): void {
    const rect = canvasWrap.getBoundingClientRect();
    const width = Math.max(200, rect.width);
    const height = Math.max(200, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(0, 0, width, height);
    if (!state.seq) {
      ctx.fillStyle = '#9aa0aa';
      ctx.font = '16px system-ui';
      ctx.fillText('Load a sequence to begin - try a preset on the left.', 24, 40);
      return;
    }
    const viz = getVisualizer(state.vizId);
    const view = new SequenceView(state.seq);
    if (view.length < viz.minTerms) {
      showNotice(`${viz.name} works best with at least ${viz.minTerms} terms (loaded: ${view.length}).`);
    }
    try {
      viz.render(view, state.params, ctx, { width, height });
    } catch (e) {
      showError(`Render failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  window.addEventListener('resize', redraw);
  redraw();
}
```

`src/main.ts` (replace content):

```ts
import './style.css';
import { mountApp } from './ui/app';

mountApp(document.querySelector<HTMLDivElement>('#app')!);
```

Append to `src/style.css`:

```css
.layout { display: grid; grid-template-columns: 300px 1fr; height: 100vh; }
.sidebar { background: var(--panel); padding: 12px; overflow-y: auto; }
.main { display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; gap: 12px; align-items: center; padding: 10px 14px; background: var(--panel); border-left: 1px solid #000; flex-wrap: wrap; }
.canvas-wrap { flex: 1; position: relative; min-height: 0; }
.canvas-wrap canvas { position: absolute; inset: 0; }
.tab-bar { display: flex; gap: 4px; margin-bottom: 8px; }
.tab-button { flex: 1; background: transparent; color: var(--muted); border: 1px solid #333; border-radius: 4px; padding: 4px; cursor: pointer; }
.tab-button.active { color: var(--text); border-color: var(--accent); }
.tab-pane { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.tab-pane input, .tab-pane textarea, .tab-pane button, .tab-pane select { background: #24262c; color: var(--text); border: 1px solid #3a3d44; border-radius: 4px; padding: 6px; font: inherit; }
.tab-pane button { cursor: pointer; }
.formula-error { color: #f7768e; font-size: 12px; min-height: 1em; }
.search-results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.search-results button { width: 100%; text-align: left; background: #24262c; color: var(--text); border: 1px solid #3a3d44; border-radius: 4px; padding: 6px; cursor: pointer; font-size: 12px; }
.presets-shelf { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.preset-button { background: #24262c; color: var(--accent); border: 1px solid #3a3d44; border-radius: 12px; padding: 3px 10px; cursor: pointer; font-size: 12px; }
.info-card { border-top: 1px solid #333; padding-top: 10px; font-size: 13px; }
.info-name { font-weight: 600; margin-bottom: 4px; }
.info-meta { color: var(--muted); margin-bottom: 8px; }
.bfile-cap { width: 80px; margin-left: 6px; }
.param-controls { display: flex; gap: 14px; flex-wrap: wrap; }
.param-field { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--muted); }
.param-value { min-width: 2.5em; color: var(--text); }
.viz-picker { background: #24262c; color: var(--text); border: 1px solid #3a3d44; border-radius: 4px; padding: 6px; }
.messages { position: fixed; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 10; }
.banner { padding: 8px 14px; border-radius: 6px; font-size: 13px; max-width: 360px; }
.banner-error { background: #3d1f26; color: #f7768e; border: 1px solid #f7768e55; }
.banner-notice { background: #1f2a3d; color: #7aa2f7; border: 1px solid #7aa2f755; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/ui.test.ts`
Expected: PASS.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`. Confirm: presets load real sequences from OEIS (network tab shows `/api/search`), the picker switches among all nine visualizers, param sliders re-render live, the b-file button grows Fibonacci past 500 terms, bad A-numbers/formulas produce visible banners.

- [ ] **Step 6: Commit**

```bash
git add src/ui src/sequence/presets.ts src/main.ts src/style.css tests/ui/ui.test.ts
git commit -m "feat: app shell with sequence panel, presets, and auto-generated param controls"
```

---

### Task 16: Comparison modes - side-by-side, flip, ensemble bands

**Files:**
- Create: `src/ui/comparison.ts`
- Modify: `src/ui/app.ts` (comparison bar + redraw branches)
- Test: `tests/ui/comparison.test.ts` (jsdom)

Load the `dataviz` skill before implementing the ensemble chart.

**Interfaces:**
- Consumes: `makeSurrogate`, `SurrogateType` (Task 7); `withTerms` (Task 6); `startEnsembleWorker`, `EnsembleJob` (Task 14); `Bands` (Task 7); Task 8 types.
- Produces:

```ts
export type ComparisonMode = 'off' | 'side' | 'flip' | 'ensemble';
export interface ComparisonState {
  mode: ComparisonMode;
  surrogate: SurrogateType;   // default 'permutation'
  seed: number;               // default 1
  showSurrogate: boolean;     // flip mode's toggle, default false
  ensembleN: number;          // default 200
}
export function defaultComparison(): ComparisonState;

export function surrogateSequence(seq: Sequence, type: SurrogateType, seed: number): Sequence;
// withTerms(seq, makeSurrogate(seq.terms, type, seed)) with name `${seq.name} (${type} surrogate)`

export function drawEnsembleChart(
  ctx: CanvasRenderingContext2D,
  size: Size,
  real: Record<string, number[]>,
  bands: Record<string, Bands>,
): void;
// One stacked panel per stat key sharing the width: shaded lo–hi band
// (rgba(122,162,247,0.18)), dashed median (#9aa0aa), solid real line (#f7768e),
// key label top-left. Y-scale per panel from min/max of band ∪ real.

export function buildComparisonBar(
  state: ComparisonState,
  onChange: () => void,   // called after any mutation of state
): { el: HTMLElement; update(vizHasStats: boolean): void };
// Controls: mode <select class="mode-select"> (off/side/flip/ensemble),
// surrogate <select class="surrogate-select"> (permutation/difference/matched),
// seed <input type="number" class="seed-input">, N <input type="number" class="n-input"> (1–1000),
// flip toggle <button class="flip-button"> (visible only in flip mode).
// update(false) disables the 'ensemble' option (visualizer lacks statistics()).
```

- [ ] **Step 1: Write the failing tests**

`tests/ui/comparison.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  defaultComparison, surrogateSequence, drawEnsembleChart, buildComparisonBar,
} from '../../src/ui/comparison';
import { fakeCtx } from '../helpers/fakeCtx';

const seq = { terms: [1n, 2n, 3n, 4n, 5n], name: 'Test', offset: 0, source: 'paste' as const };

describe('surrogateSequence', () => {
  it('replaces terms with a same-multiset surrogate and renames', () => {
    const s = surrogateSequence(seq, 'permutation', 7);
    expect(s.terms.length).toBe(5);
    expect([...s.terms].sort()).toEqual([1n, 2n, 3n, 4n, 5n]);
    expect(s.name).toContain('surrogate');
    expect(seq.terms).toEqual([1n, 2n, 3n, 4n, 5n]); // original untouched
  });
});

describe('drawEnsembleChart', () => {
  it('draws without throwing for two stat keys', () => {
    const { ctx } = fakeCtx();
    const bands = { lo: [0, 0], median: [1, 1], hi: [2, 2] };
    expect(() =>
      drawEnsembleChart(ctx, { width: 400, height: 300 },
        { a: [1.5, 0.5], b: [0, 1] }, { a: bands, b: bands }),
    ).not.toThrow();
  });
});

describe('buildComparisonBar', () => {
  it('exposes mode/surrogate/seed controls and mutates state', () => {
    const state = defaultComparison();
    const onChange = vi.fn();
    const { el } = buildComparisonBar(state, onChange);
    const mode = el.querySelector<HTMLSelectElement>('.mode-select')!;
    mode.value = 'flip';
    mode.dispatchEvent(new Event('change'));
    expect(state.mode).toBe('flip');
    expect(onChange).toHaveBeenCalled();
    const seed = el.querySelector<HTMLInputElement>('.seed-input')!;
    seed.value = '42';
    seed.dispatchEvent(new Event('change'));
    expect(state.seed).toBe(42);
  });

  it('update(false) disables the ensemble option', () => {
    const { el, update } = buildComparisonBar(defaultComparison(), () => {});
    update(false);
    const opt = el.querySelector<HTMLOptionElement>('.mode-select option[value="ensemble"]')!;
    expect(opt.disabled).toBe(true);
    update(true);
    expect(opt.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/comparison.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/comparison.ts`**

```ts
import type { Sequence } from '../sequence/sequence';
import { withTerms } from '../sequence/oeisClient';
import { makeSurrogate, type SurrogateType } from '../nullmodel/surrogates';
import type { Bands } from '../nullmodel/bands';
import type { Size } from '../viz/types';

export type ComparisonMode = 'off' | 'side' | 'flip' | 'ensemble';

export interface ComparisonState {
  mode: ComparisonMode;
  surrogate: SurrogateType;
  seed: number;
  showSurrogate: boolean;
  ensembleN: number;
}

export function defaultComparison(): ComparisonState {
  return { mode: 'off', surrogate: 'permutation', seed: 1, showSurrogate: false, ensembleN: 200 };
}

export function surrogateSequence(seq: Sequence, type: SurrogateType, seed: number): Sequence {
  const s = withTerms(seq, makeSurrogate(seq.terms, type, seed));
  return { ...s, name: `${seq.name} (${type} surrogate)` };
}

export function drawEnsembleChart(
  ctx: CanvasRenderingContext2D,
  size: Size,
  real: Record<string, number[]>,
  bands: Record<string, Bands>,
): void {
  const keys = Object.keys(bands);
  if (keys.length === 0) return;
  const panelH = size.height / keys.length;
  const MARGIN = 30;

  keys.forEach((key, p) => {
    const band = bands[key]!;
    const realVals = real[key] ?? [];
    const top = p * panelH;
    const w = size.width - 2 * MARGIN;
    const h = panelH - 2 * MARGIN;
    const all = [...band.lo, ...band.hi, ...realVals];
    const lo = Math.min(...all), hi = Math.max(...all);
    const n = band.median.length;
    const x = (i: number) => MARGIN + (i / Math.max(1, n - 1)) * w;
    const y = (v: number) => top + MARGIN + h - ((v - lo) / (hi - lo || 1)) * h;

    // band fill
    ctx.fillStyle = 'rgba(122,162,247,0.18)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(band.hi[i]!));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(band.lo[i]!));
    ctx.closePath();
    ctx.fill();

    // median (dashed)
    ctx.strokeStyle = '#9aa0aa';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < n; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(band.median[i]!));
    ctx.stroke();
    ctx.setLineDash([]);

    // real line
    ctx.strokeStyle = '#f7768e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < Math.min(n, realVals.length); i++) {
      (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(realVals[i]!));
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.fillStyle = '#e6e6e6';
    ctx.font = '12px system-ui';
    ctx.fillText(key, MARGIN, top + 16);
  });
}

export function buildComparisonBar(
  state: ComparisonState,
  onChange: () => void,
): { el: HTMLElement; update(vizHasStats: boolean): void } {
  const el = document.createElement('div');
  el.className = 'comparison-bar';

  const mkSelect = (cls: string, options: string[], value: string, set: (v: string) => void) => {
    const sel = document.createElement('select');
    sel.className = cls;
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = o;
      sel.appendChild(opt);
    }
    sel.value = value;
    sel.addEventListener('change', () => { set(sel.value); onChange(); });
    return sel;
  };
  const mkNumber = (cls: string, value: number, min: number, max: number, set: (v: number) => void) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = cls;
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener('change', () => {
      const v = Math.max(min, Math.min(max, Number(input.value) || min));
      input.value = String(v);
      set(v);
      onChange();
    });
    return input;
  };

  const modeSel = mkSelect('mode-select', ['off', 'side', 'flip', 'ensemble'], state.mode,
    (v) => { state.mode = v as ComparisonMode; flipBtn.hidden = v !== 'flip'; });
  const surrSel = mkSelect('surrogate-select', ['permutation', 'difference', 'matched'], state.surrogate,
    (v) => { state.surrogate = v as SurrogateType; });
  const seedInput = mkNumber('seed-input', state.seed, 0, 2 ** 31, (v) => { state.seed = v; });
  const nInput = mkNumber('n-input', state.ensembleN, 1, 1000, (v) => { state.ensembleN = v; });

  const flipBtn = document.createElement('button');
  flipBtn.className = 'flip-button';
  flipBtn.textContent = 'Flip real / surrogate';
  flipBtn.hidden = state.mode !== 'flip';
  flipBtn.addEventListener('click', () => { state.showSurrogate = !state.showSurrogate; onChange(); });

  const label = (t: string) => {
    const s = document.createElement('span');
    s.className = 'bar-label';
    s.textContent = t;
    return s;
  };
  el.append(label('Compare:'), modeSel, label('null:'), surrSel, label('seed'), seedInput, label('N'), nInput, flipBtn);

  return {
    el,
    update(vizHasStats: boolean) {
      const opt = modeSel.querySelector<HTMLOptionElement>('option[value="ensemble"]')!;
      opt.disabled = !vizHasStats;
      if (!vizHasStats && state.mode === 'ensemble') { state.mode = 'off'; modeSel.value = 'off'; }
    },
  };
}
```

- [ ] **Step 4: Wire into `src/ui/app.ts`**

Add imports:

```ts
import { defaultComparison, surrogateSequence, drawEnsembleChart, buildComparisonBar } from './comparison';
import { startEnsembleWorker, type EnsembleJob } from '../nullmodel/ensemble';
import type { Bands } from '../nullmodel/bands';
```

Extend state and add the bar between topbar and canvas:

```ts
const comparison = defaultComparison();
let ensembleCancel: { cancel(): void } | null = null;
let ensembleBands: Record<string, Bands> | null = null;
let ensembleKey = '';
let ensembleStatus: 'idle' | 'running' = 'idle';

const bar = buildComparisonBar(comparison, redraw);
main.insertBefore(bar.el, canvasWrap);
```

In the picker's change handler and after each `onSequence`, call `bar.update(Boolean(getVisualizer(state.vizId).statistics))`.

Replace the tail of `redraw()` (from the `const viz = ...` line down) with mode-aware drawing:

```ts
const viz = getVisualizer(state.vizId);
const view = new SequenceView(state.seq);
if (view.length < viz.minTerms) {
  showNotice(`${viz.name} works best with at least ${viz.minTerms} terms (loaded: ${view.length}).`);
}
const draw = (seq: typeof state.seq, w: number, h: number, ox: number, label: string) => {
  ctx.save();
  ctx.translate(ox, 0);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  try {
    viz.render(new SequenceView(seq!), state.params, ctx, { width: w, height: h });
  } catch (e) {
    showError(`Render failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  ctx.fillStyle = '#9aa0aa';
  ctx.font = '12px system-ui';
  ctx.fillText(label, 10, h - 10);
  ctx.restore();
};

if (comparison.mode === 'side') {
  const surr = surrogateSequence(state.seq, comparison.surrogate, comparison.seed);
  draw(state.seq, width / 2 - 1, height, 0, 'real');
  ctx.strokeStyle = '#333';
  ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
  draw(surr, width / 2 - 1, height, width / 2 + 1, `${comparison.surrogate} surrogate`);
} else if (comparison.mode === 'flip') {
  const shown = comparison.showSurrogate
    ? surrogateSequence(state.seq, comparison.surrogate, comparison.seed)
    : state.seq;
  draw(shown, width, height, 0, comparison.showSurrogate ? `${comparison.surrogate} surrogate` : 'real');
} else if (comparison.mode === 'ensemble' && viz.statistics) {
  const job: EnsembleJob = {
    terms: state.seq.terms.map(String),
    surrogate: comparison.surrogate,
    count: comparison.ensembleN,
    seed: comparison.seed,
    vizId: state.vizId,
    params: { ...state.params },
  };
  const key = JSON.stringify(job);
  if (key !== ensembleKey) {
    ensembleKey = key;
    ensembleBands = null;
    ensembleCancel?.cancel();
    ensembleStatus = 'running';
    ensembleCancel = startEnsembleWorker(job, {
      onProgress: () => {},
      onResult: (stats) => { ensembleBands = stats; ensembleStatus = 'idle'; redraw(); },
      onError: (m) => { ensembleStatus = 'idle'; showError(`Ensemble failed: ${m}`); },
    });
  }
  if (ensembleBands) {
    drawEnsembleChart(ctx, { width, height }, viz.statistics(view, state.params), ensembleBands);
  } else {
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '14px system-ui';
    ctx.fillText(`Computing ${comparison.ensembleN}-surrogate ensemble…`, 24, 40);
  }
} else {
  draw(state.seq, width, height, 0, '');
}
```

Append to `src/style.css`:

```css
.comparison-bar { display: flex; gap: 8px; align-items: center; padding: 8px 14px; background: var(--panel); border-top: 1px solid #000; flex-wrap: wrap; }
.comparison-bar select, .comparison-bar input, .comparison-bar button { background: #24262c; color: var(--text); border: 1px solid #3a3d44; border-radius: 4px; padding: 4px 8px; font: inherit; }
.comparison-bar input { width: 70px; }
.bar-label { color: var(--muted); font-size: 13px; }
```

- [ ] **Step 5: Run tests, then verify manually**

Run: `npx vitest run tests/ui/comparison.test.ts` then `npm test` - all green.
Run: `npm run dev` and verify with A000045 + polyarc: side-by-side shows real vs shuffled clearly differing; flip toggles in place; with scatter + ensemble, bands appear after a brief "Computing…" state; changing seed/N recomputes; picking turtle disables the ensemble option.

- [ ] **Step 6: Commit**

```bash
git add src/ui/comparison.ts src/ui/app.ts src/style.css tests/ui/comparison.test.ts
git commit -m "feat: null-model comparison modes - side-by-side, flip, ensemble bands"
```

---

### Task 17: Parameter-sweep small-multiples view

**Files:**
- Create: `src/ui/sweep.ts`
- Modify: `src/ui/app.ts` (Sweep button + overlay)
- Test: `tests/ui/sweep.test.ts` (jsdom)

**Interfaces:**
- Consumes: `Visualizer`, `Params`, `ParamSpec` (Task 8); `SequenceView`, `Sequence` (Task 2).
- Produces:

```ts
export function sweepValues(spec: { min: number; max: number; step: number }, count: number): number[];
// `count` values spread uniformly across [min, max], snapped to the step grid,
// deduplicated, always including min and max. count ≥ 2.

export function buildSweepView(opts: {
  seq: Sequence;
  viz: Visualizer;
  baseParams: Params;
  paramId: string;          // must be a kind:'number' param of viz
  count: number;            // thumbnails, default caller passes 12
  onPick(value: number): void;
  onClose(): void;
}): HTMLElement;
// Overlay <div class="sweep-overlay"> with a close button (class "sweep-close") and a
// grid of <figure class="sweep-cell"> each holding a 180×140 canvas rendered with
// {...baseParams, [paramId]: value} plus a <figcaption> "paramId = value".
// Clicking a cell calls onPick(value) then onClose(). getContext null-guarded (jsdom).
```

- [ ] **Step 1: Write the failing tests**

`tests/ui/sweep.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { sweepValues, buildSweepView } from '../../src/ui/sweep';
import { turtleViz } from '../../src/viz/turtle';
import { defaultParams } from '../../src/viz/types';

describe('sweepValues', () => {
  it('spans min..max snapped to step, deduped', () => {
    expect(sweepValues({ min: 2, max: 12, step: 1 }, 6)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(sweepValues({ min: 1, max: 3, step: 1 }, 12)).toEqual([1, 2, 3]);
  });
});

describe('buildSweepView', () => {
  const seq = { terms: [1n, 2n, 3n, 4n, 5n, 6n], name: 't', offset: 0, source: 'paste' as const };

  it('renders a cell per value and picks on click', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const el = buildSweepView({
      seq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
      paramId: 'angle', count: 6, onPick, onClose,
    });
    const cells = el.querySelectorAll('.sweep-cell');
    expect(cells.length).toBeGreaterThanOrEqual(2);
    (cells[0] as HTMLElement).click();
    expect(onPick).toHaveBeenCalledWith(1); // angle spec min is 1
    expect(onClose).toHaveBeenCalled();
  });

  it('close button closes without picking', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const el = buildSweepView({
      seq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
      paramId: 'angle', count: 4, onPick, onClose,
    });
    el.querySelector<HTMLButtonElement>('.sweep-close')!.click();
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/sweep.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/sweep.ts`**

```ts
import { SequenceView, type Sequence } from '../sequence/sequence';
import type { Params, Visualizer } from '../viz/types';

export function sweepValues(spec: { min: number; max: number; step: number }, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const raw = spec.min + ((spec.max - spec.min) * i) / (count - 1);
    const snapped = spec.min + Math.round((raw - spec.min) / spec.step) * spec.step;
    out.push(Math.min(spec.max, snapped));
  }
  return [...new Set(out)];
}

export function buildSweepView(opts: {
  seq: Sequence;
  viz: Visualizer;
  baseParams: Params;
  paramId: string;
  count: number;
  onPick(value: number): void;
  onClose(): void;
}): HTMLElement {
  const spec = opts.viz.params.find((p) => p.id === opts.paramId);
  if (!spec || spec.kind !== 'number') throw new Error(`"${opts.paramId}" is not a numeric parameter.`);

  const overlay = document.createElement('div');
  overlay.className = 'sweep-overlay';

  const close = document.createElement('button');
  close.className = 'sweep-close';
  close.textContent = '× close';
  close.addEventListener('click', opts.onClose);
  overlay.appendChild(close);

  const grid = document.createElement('div');
  grid.className = 'sweep-grid';
  overlay.appendChild(grid);

  const view = new SequenceView(opts.seq);
  for (const value of sweepValues(spec, opts.count)) {
    const cell = document.createElement('figure');
    cell.className = 'sweep-cell';
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 140;
    const caption = document.createElement('figcaption');
    caption.textContent = `${opts.paramId} = ${value}`;
    cell.append(canvas, caption);
    cell.addEventListener('click', () => { opts.onPick(value); opts.onClose(); });
    grid.appendChild(cell);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#14161a';
      ctx.fillRect(0, 0, 180, 140);
      try {
        opts.viz.render(view, { ...opts.baseParams, [opts.paramId]: value }, ctx, { width: 180, height: 140 });
      } catch { /* a thumbnail failing must not break the grid */ }
    }
  }
  return overlay;
}
```

- [ ] **Step 4: Wire into `src/ui/app.ts`**

In the comparison bar area, add a Sweep control (after `bar.el` creation):

```ts
import { buildSweepView } from './sweep';
// ...
const sweepBtn = document.createElement('button');
sweepBtn.textContent = 'Sweep…';
sweepBtn.addEventListener('click', () => {
  if (!state.seq) { showNotice('Load a sequence first.'); return; }
  const numeric = getVisualizer(state.vizId).params.filter((p) => p.kind === 'number');
  if (numeric.length === 0) { showNotice('This visualizer has no numeric parameters to sweep.'); return; }
  const paramId = numeric.length === 1
    ? numeric[0]!.id
    : window.prompt(`Sweep which parameter? (${numeric.map((p) => p.id).join(', ')})`, numeric[0]!.id) ?? numeric[0]!.id;
  if (!numeric.some((p) => p.id === paramId)) { showError(`Unknown parameter "${paramId}".`); return; }
  const overlay = buildSweepView({
    seq: state.seq, viz: getVisualizer(state.vizId), baseParams: { ...state.params },
    paramId, count: 12,
    onPick(value) { state.params[paramId] = value; rebuildParams(); redraw(); },
    onClose() { overlay.remove(); },
  });
  root.appendChild(overlay);
});
bar.el.appendChild(sweepBtn);
```

Append to `src/style.css`:

```css
.sweep-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 20; overflow-y: auto; padding: 40px; }
.sweep-close { position: fixed; top: 12px; right: 16px; background: #24262c; color: var(--text); border: 1px solid #3a3d44; border-radius: 4px; padding: 6px 12px; cursor: pointer; }
.sweep-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.sweep-cell { margin: 0; cursor: pointer; background: var(--panel); border: 1px solid #333; border-radius: 6px; padding: 6px; }
.sweep-cell:hover { border-color: var(--accent); }
.sweep-cell figcaption { color: var(--muted); font-size: 12px; text-align: center; padding-top: 4px; }
```

- [ ] **Step 5: Run tests, then verify manually**

Run: `npx vitest run tests/ui/sweep.test.ts` then `npm test` - all green.
Run: `npm run dev` - load A019488, pick polyarc, press Sweep, choose `angle`: 12 thumbnails, clicking one adopts the value.

- [ ] **Step 6: Commit**

```bash
git add src/ui/sweep.ts src/ui/app.ts src/style.css tests/ui/sweep.test.ts
git commit -m "feat: parameter-sweep small-multiples view"
```

---

### Task 18: Shareable URL state

**Files:**
- Create: `src/ui/urlState.ts`
- Modify: `src/ui/app.ts` (read on load, write on change)
- Test: `tests/ui/urlState.test.ts`

**Interfaces:**
- Consumes: `Params` (Task 8); `ComparisonMode`, `SurrogateType` types.
- Produces:

```ts
export type SeqRef =
  | { kind: 'oeis'; aNumber: string }
  | { kind: 'formula'; src: string; count: number }
  | { kind: 'paste'; terms: string[] };   // capped at 500 terms on encode

export interface UrlState {
  seqRef: SeqRef | null;
  vizId: string;
  params: Params;
  mode: ComparisonMode;
  surrogate: SurrogateType;
  seed: number;
}

export function encodeState(s: UrlState): string;         // base64url of JSON, unicode-safe
export function decodeState(hash: string): UrlState | null; // accepts with/without leading '#'; null on garbage
```

- [ ] **Step 1: Write the failing tests**

`tests/ui/urlState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, type UrlState } from '../../src/ui/urlState';

const state: UrlState = {
  seqRef: { kind: 'formula', src: 'n*n + n + 41', count: 200 },
  vizId: 'polyarc',
  params: { angle: 30, modulus: 7, centered: true },
  mode: 'side',
  surrogate: 'difference',
  seed: 7,
};

describe('urlState', () => {
  it('round-trips through encode/decode', () => {
    expect(decodeState(encodeState(state))).toEqual(state);
    expect(decodeState('#' + encodeState(state))).toEqual(state);
  });

  it('round-trips oeis and paste refs', () => {
    const oeis = { ...state, seqRef: { kind: 'oeis' as const, aNumber: 'A019488' } };
    expect(decodeState(encodeState(oeis))).toEqual(oeis);
    const paste = { ...state, seqRef: { kind: 'paste' as const, terms: ['1', '2', '3'] } };
    expect(decodeState(encodeState(paste))).toEqual(paste);
  });

  it('caps paste terms at 500 on encode', () => {
    const big = { ...state, seqRef: { kind: 'paste' as const, terms: Array.from({ length: 800 }, (_, i) => String(i)) } };
    const back = decodeState(encodeState(big))!;
    expect((back.seqRef as { terms: string[] }).terms.length).toBe(500);
  });

  it('is URL-hash-safe and rejects garbage', () => {
    expect(encodeState(state)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeState('not-base64!!!')).toBeNull();
    expect(decodeState('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/urlState.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/ui/urlState.ts`**

```ts
import type { Params } from '../viz/types';
import type { ComparisonMode } from './comparison';
import type { SurrogateType } from '../nullmodel/surrogates';

export type SeqRef =
  | { kind: 'oeis'; aNumber: string }
  | { kind: 'formula'; src: string; count: number }
  | { kind: 'paste'; terms: string[] };

export interface UrlState {
  seqRef: SeqRef | null;
  vizId: string;
  params: Params;
  mode: ComparisonMode;
  surrogate: SurrogateType;
  seed: number;
}

function b64urlEncode(s: string): string {
  const utf8 = String.fromCharCode(...new TextEncoder().encode(s));
  return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(s: UrlState): string {
  const ref = s.seqRef?.kind === 'paste'
    ? { ...s.seqRef, terms: s.seqRef.terms.slice(0, 500) }
    : s.seqRef;
  return b64urlEncode(JSON.stringify({ ...s, seqRef: ref }));
}

export function decodeState(hash: string): UrlState | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    const obj = JSON.parse(b64urlDecode(raw)) as UrlState;
    if (typeof obj !== 'object' || obj === null || typeof obj.vizId !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Wire into `src/ui/app.ts`**

Add a `syncUrl()` helper and call it at the end of `redraw()`:

```ts
import { encodeState, decodeState, type SeqRef } from './urlState';
// ...
let currentRef: SeqRef | null = null; // set wherever a sequence loads:
//   lookupById path (panel onSequence with seq.source==='oeis') → {kind:'oeis', aNumber: seq.aNumber!}
//   formula generate → {kind:'formula', src: seq.name, count: seq.terms.length}
//   paste → {kind:'paste', terms: seq.terms.map(String)}

function syncUrl(): void {
  history.replaceState(null, '', '#' + encodeState({
    seqRef: currentRef, vizId: state.vizId, params: state.params,
    mode: comparison.mode, surrogate: comparison.surrogate, seed: comparison.seed,
  }));
}
```

Set `currentRef` inside the panel's `onSequence` from `seq.source` (as annotated above). On startup, after `redraw()`:

```ts
const initial = decodeState(location.hash);
if (initial) {
  state.vizId = initial.vizId;
  state.params = initial.params;
  comparison.mode = initial.mode;
  comparison.surrogate = initial.surrogate;
  comparison.seed = initial.seed;
  picker.value = initial.vizId;
  rebuildParams();
  const ref = initial.seqRef;
  if (ref?.kind === 'oeis') lookupById(ref.aNumber).then((s) => { currentRef = ref; applySeq(s); }).catch((e) => showError(String(e)));
  else if (ref?.kind === 'formula') { currentRef = ref; applySeq(sequenceFromFormula(ref.src, ref.count)); }
  else if (ref?.kind === 'paste') { currentRef = ref; applySeq({ terms: ref.terms.map(BigInt), name: 'Pasted sequence', offset: 0, source: 'paste' }); }
}
```

where `applySeq` is the existing sequence-apply path (`state.seq = seq; panel.setInfo(seq); bar.update(...); redraw();` - factor it out of the panel handler so both share it). Add the needed imports (`lookupById`, `sequenceFromFormula`).

- [ ] **Step 5: Run tests, then verify manually**

Run: `npx vitest run tests/ui/urlState.test.ts` then `npm test` - all green.
Run: `npm run dev` - load A019488 + polyarc + side mode, copy the URL into a new tab: identical view appears.

- [ ] **Step 6: Commit**

```bash
git add src/ui/urlState.ts src/ui/app.ts tests/ui/urlState.test.ts
git commit -m "feat: shareable URL hash state"
```

---

### Task 19: OEIS proxy (Cloudflare Pages Function), README, deploy

**Files:**
- Create: `functions/api/[[path]].ts`, `README.md`
- Modify: `tsconfig.json` (include `functions`)

**Interfaces:**
- Consumes: nothing from `src/` (runs on Cloudflare, not in the page).
- Produces: same-origin `/api/*` in production. Allowlisted routes only:
  `/api/search?...` → `https://oeis.org/search?...` and
  `/api/A######/b######.txt` → the b-file. 24h edge cache.

The spec says "Cloudflare Worker at `/api/*`" - a Pages Function is exactly that (a Worker bundled with the Pages deployment), with the advantage that no separate route/zone configuration is needed: one Pages project serves both the static site and `/api/*` on the same origin, and Vite's dev proxy remains the local substitute.

- [ ] **Step 1: Implement `functions/api/[[path]].ts`**

```ts
// Cloudflare Pages Function: proxies allowlisted OEIS paths with a 24h edge cache.
interface PagesContext {
  request: Request;
  waitUntil(p: Promise<unknown>): void;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const upstreamPath = url.pathname.replace(/^\/api/, '');
  const allowed = upstreamPath === '/search' || /^\/A\d{6}\/b\d{6}\.txt$/.test(upstreamPath);
  if (!allowed) return new Response('Not found', { status: 404 });

  const upstream = 'https://oeis.org' + upstreamPath + url.search;
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(upstream);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const res = await fetch(upstream, {
    headers: { 'User-Agent': 'integer-sequence-visualizer (personal research tool)' },
  });
  if (!res.ok) return new Response(`OEIS upstream error (${res.status})`, { status: 502 });

  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'public, max-age=86400');
  context.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
};
```

Update `tsconfig.json` `include` to `["src", "tests", "functions"]`.

- [ ] **Step 2: Write `README.md`**

```markdown
# Integer Sequence Visualizer

A live webpage that renders [OEIS](https://oeis.org) sequences with nine
visualization techniques and a first-class **null-model comparison layer** -
so you can test whether the structure you see is a property of the sequence
or an artifact of the rendering. Inspired by a SeqFan thread on George
Whale's NCurve (see `docs/seqfan-ncurve-thread.md`).

## Develop

    npm install
    npm run dev      # Vite dev server; /api/* proxies to oeis.org
    npm test         # Vitest suite

## Deploy (Cloudflare Pages)

1. Push this repo to GitHub/GitLab.
2. Cloudflare dashboard → Pages → connect the repo.
   Build command: `npm run build` · output directory: `dist`.
3. The `functions/` directory is auto-deployed as a Pages Function serving
   `/api/*` (OEIS proxy with a 24h cache). No extra configuration.

Local production check: `npm run build && npx wrangler pages dev dist`.

## Design docs

- Spec: `docs/superpowers/specs/2026-08-05-oeis-visualizer-design.md`
- Plan: `docs/superpowers/plans/2026-08-05-oeis-visualizer.md`
```

- [ ] **Step 3: Verify**

Run: `npm run build` - clean.
Run: `npm test` - full suite green.
Optional (needs network): `npx wrangler pages dev dist` and confirm `curl http://127.0.0.1:8788/api/search?q=id:A000045&fmt=json` returns OEIS JSON and `/api/anything-else` returns 404.

- [ ] **Step 4: Commit**

```bash
git add functions README.md tsconfig.json
git commit -m "feat: Cloudflare Pages Function OEIS proxy and README"
```

---

## Plan self-review notes

- **Spec coverage:** all spec sections map to tasks - data layer (2–6), presets (15), visualizers ×9 (9–13), surrogates + ensemble + Worker (7, 14), comparison modes (16), sweep (17), URL state (18), error handling (15–16 banners + per-module throws), testing strategy (every task), deployment (1, 19). The spec's "Cloudflare Worker" is delivered as a Pages Function - same runtime, same-origin `/api/*`, less configuration; noted in Task 19.
- **Ensemble bands rendering:** the spec's "bands under the real curve" is delivered as a dedicated statistic-vs-index chart in ensemble mode (comparison-owned), because visualizer-internal axes aren't exposed. This satisfies the spec's intent - seeing which statistics escape the null - without coupling the overlay to per-visualizer coordinate systems.
- **Type consistency check:** `SequenceView` accessor names (`toNumber`, `logMagnitude`, `mod`, `digits`, `sign`, `term`, `length`) match across Tasks 2 and 9–13; `Bands` `{lo, median, hi}` matches across 7, 14, 16; `EnsembleJob` fields match between 14 and 16; `withTerms` (6) used by 15–16; `strokePath` exported from turtle (12) and consumed by digitWalk (12) and polyarc (13).

