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
