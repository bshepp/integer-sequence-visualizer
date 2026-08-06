import { mulberry32, shuffleInPlace } from './rng';
import { signedLogMagnitude } from '../sequence/sequence';
import { minMax } from '../viz/mathUtils';

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

// Box-Muller transform: two uniforms from the same seeded mulberry32 stream
// -> one standard-normal draw. Keeps every surrogate fully deterministic and
// reproducible under a seed (no Math.random() anywhere in src/, per project
// constraints) while giving the noise a realistic bell-shaped distribution
// instead of a hard-edged uniform one (see matchedRandomSurrogate's doc).
function gaussian(rand: () => number): number {
  const u1 = Math.max(rand(), Number.EPSILON); // avoid log(0) = -Infinity
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Inverse of the (unsigned) magnitude half of signedLogMagnitude: reconstruct
// a same-order-of-magnitude BigInt from a base-10 log value, preserving ~15
// significant digits (float64's own precision budget — the same 15 digits
// bigMagnitude reads off the decimal string). Never routes the
// full-precision integer through `Number` (which is exactly the bug this
// exists to avoid: `Math.round(10 ** log)` silently loses precision past
// ~1e15 and overflows to Infinity well before a realistic OEIS magnitude).
function fromLogMagnitude(log: number): bigint {
  if (!Number.isFinite(log) || log < 0) return 0n;
  const intPart = Math.floor(log);
  const frac = log - intPart;
  const sigDigits = Math.min(intPart + 1, 15);
  let mantissaInt = Math.round(10 ** (frac + sigDigits - 1));
  let zeros = intPart + 1 - sigDigits;
  if (mantissaInt >= 10 ** sigDigits) { mantissaInt /= 10; zeros += 1; } // rounding carried a digit
  return BigInt(mantissaInt) * 10n ** BigInt(zeros);
}

// Inverse of signedLogMagnitude: same reconstruction as fromLogMagnitude,
// with the sign folded back in from which side of zero `v` fell on. This is
// what makes the log-space surrogate path (below) sound for sign-mixed
// overflowing sequences, not just non-negative ones: signedLogMagnitude is
// continuous and monotonic in the underlying value (large negative -> very
// negative, through ~0 near +-1, to large positive -> very positive), so
// fitting a line to it and inverting through this function round-trips sign
// the same way magnitude already round-tripped.
function fromSignedLogMagnitude(v: number): bigint {
  if (!Number.isFinite(v)) return 0n;
  const mag = fromLogMagnitude(Math.abs(v));
  return v < 0 ? -mag : mag;
}

function bigintMinMax(terms: bigint[]): { lo: bigint; hi: bigint } {
  let lo = terms[0]!, hi = terms[0]!;
  for (let i = 1; i < terms.length; i++) {
    const t = terms[i]!;
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  return { lo, hi };
}

function clampBigint(v: bigint, lo: bigint, hi: bigint): bigint {
  return v < lo ? lo : v > hi ? hi : v;
}

// Overflow-safe path for matchedRandomSurrogate: fits and generates entirely
// in exact *signed* log-magnitude space, only converting to BigInt at the
// very end. Using signedLogMagnitude (not the unsigned bigMagnitude) rather
// than requiring non-negative input is what makes this sound for sign-mixed
// overflowing sequences too — e.g. alternating huge positive/negative
// terms, reachable today via the paste tab (pasteParser.ts has no magnitude
// or sign restriction). See matchedRandomSurrogate's doc for why the plain
// numeric path below cannot be used once terms exceed float64-safe range.
function matchedLogSpaceSurrogate(terms: bigint[], rand: () => number): bigint[] {
  const logs = terms.map(signedLogMagnitude);
  const { a, b, mse } = fitLine(logs);
  const sd = Math.sqrt(mse);
  const { lo, hi } = bigintMinMax(terms);
  return logs.map((_, i) => clampBigint(fromSignedLogMagnitude(a * i + b + gaussian(rand) * sd), lo, hi));
}

export function matchedRandomSurrogate(terms: bigint[], seed: number): bigint[] {
  if (terms.length === 0) return [];
  const rand = mulberry32(seed);

  // clampNum() ceilings every term beyond float64-safe range to the same
  // Number.MAX_SAFE_INTEGER — fitting/generating from that flattens a
  // genuinely varying tail into a constant and models THAT clamping
  // artifact instead of the sequence (measured: a 2001-term Fibonacci
  // b-file's matched surrogate has 1057 distinct values out of 2001, 945 of
  // them pinned at MAX_SAFE — task FR, I1). Route every overflowing
  // sequence — sign-mixed included — through an exact signed-log-magnitude
  // fit instead: the plain numeric exp-fit branch below cannot do the same
  // (it requires strict positivity, since Math.log10(v) is -Infinity at
  // v <= 0), but signedLogMagnitude is defined and continuous for zero and
  // negative terms too (see sequence.ts), so there is no sign restriction
  // needed here. This matters because pasteParser.ts places no cap on
  // magnitude or sign, so a user can paste e.g. alternating +-1e20-scale
  // terms and pick 'matched' directly — an earlier version of this fix
  // gated on `terms.every(t => t >= 0n)` on the mistaken assumption that a
  // sign-mixed *overflowing* sequence could only arise from this module's
  // own (slope-bounded) linear model reaching that far, rather than simply
  // being handed one as input; that gate is gone.
  const overflow = terms.some((t) => t > MAX_SAFE || t < -MAX_SAFE);
  if (overflow) {
    return matchedLogSpaceSurrogate(terms, rand);
  }

  const nums = terms.map(clampNum);
  const { lo, hi } = minMax(nums);
  const lin = fitLine(nums);
  const allPositive = nums.every((v) => v > 0);
  if (allPositive) {
    const logs = nums.map((v) => Math.log10(v));
    const exp = fitLine(logs);
    // compare in value space: normalize linear mse by value scale, exp mse by log scale
    const linRelMse = lin.mse / Math.max(1, (hi - lo) ** 2);
    const { lo: logLo, hi: logHi } = minMax(logs);
    const expRelMse = exp.mse / Math.max(1e-12, (logHi - logLo) ** 2 || 1);
    if (expRelMse < linRelMse) {
      // Noise scale: the *residual standard deviation* (sqrt of the fit's
      // mean squared residual), drawn from a Gaussian — not the old
      // uniform-on-[-maxRes,+maxRes] draw. Uniform-on-±max has sd =
      // max/sqrt(3), typically 2-4x the true residual sd for a roughly
      // normal residual distribution, with a flat hard-edged shape instead
      // of a bell curve — so the old bands were too wide, silently making
      // the app under-reject (call real structure "could be noise") more
      // often than the surrogate's own residual spread justifies. That's
      // the quieter, more dangerous direction of error for a tool whose job
      // is telling structure from noise (task FR, I2).
      const sd = Math.sqrt(exp.mse);
      return nums.map((_, i) => toClampedBigint(10 ** (exp.a * i + exp.b + gaussian(rand) * sd), lo, hi));
    }
  }
  const sd = Math.sqrt(lin.mse);
  return nums.map((_, i) => toClampedBigint(lin.a * i + lin.b + gaussian(rand) * sd, lo, hi));
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
