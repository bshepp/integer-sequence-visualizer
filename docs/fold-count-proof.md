# Fold counts of polygonal-number curves: statement and proof

OEIS: [A400844](https://oeis.org/A400844), allocated to Brian J. Sheppard on
2026-10-07. A draft as of that date, not yet reviewed by an editor.

Status: the proof below was written by Claude (Anthropic's AI) on 2026-10-07,
after Eddie Lin asked on the SeqFan list why triangular numbers draw triangles
and Brian Sheppard doubted that the answer was coincidence. It agrees with
brute force for every s from 2 to 79 and every modulus m from 1 to 200
(15,600 cases, no mismatch). A second model, given only the statement,
proved the algebraic theorem independently by the same route, checked it for
s = 3..39 and m < 400, and caught an overclaim in the geometry, corrected
below. **No mathematician has read it.** The computation it is checked
against is `src/experiments/foldCount.ts`, pinned by
`tests/experiments/foldCount.test.ts`.

## Setup

For s >= 2 let P(n) = P_s(n) = ((s-2)n^2 - (s-4)n)/2, n >= 0, the s-gonal
numbers, and write a = s - 2, so that

    P(n) = a*C(n,2) + n.

Fix a modulus m >= 1. The residues P(n) mod m are purely periodic; let p be
the least period, and let

    S = P(0) + P(1) + ... + P(p-1)   (mod m).

The **fold count** F(s, m) is the additive order of S in Z/m, that is
m / gcd(S, m), with F = 1 when S = 0.

Why this is the number of folds in the drawing. Draw one arc of length 1 per
term, turning by (P(n) mod m)/m of a full turn. One period of residues moves
the pen by a fixed rigid motion whose rotation part is S/m of a turn. If S is
not 0 mod m that motion is a rotation about a point, the drawing is carried
onto itself by it, and it closes after exactly F periods, with F-fold
rotational symmetry (F copies of one motif around a centre, which may overlap
if the motif has symmetry of its own). If S = 0 the motion is a translation
by the pen's net displacement over one period: the motif repeats along a
line, unless that displacement happens to be zero, in which case the curve
closes after a single period. The theorem says nothing about which; see the
last remark. At m = 360 this is NCurve's default rule; its
offset of -180 adds 180p to S, a multiple of 360 whenever p is even.

## Theorem

For every s >= 2 and every m >= 1,

    F(s, m) = gcd(m, K(s)),    K(s) = K2 * K3,

where, with a = s - 2,

    K3 = 3 if 3 does not divide a, and 1 if it does;
    K2 = 1 if a is odd, 4 if a = 2 (mod 4), 2 if a = 0 (mod 4).

K(s) depends only on s mod 12:

    s mod 12 :  3   4   5   6   7   8   9  10  11   0   1   2
    K(s)     :  3  12   1   6   3   4   3   6   1  12   3   2

## Proof

**Step 0. Two identities.** For any t >= 1,

    P(n+t) - P(n) = a*t*n + a*C(t,2) + t,                         (1)
    P(0) + ... + P(t-1) = a*C(t,3) + C(t,2).                      (2)

By (1), t is a period mod m exactly when

    (i)  m divides a*t,   and   (ii)  m divides t + a*t(t-1)/2.

**Step 1. Reduction to prime powers.** Write m as a product of prime powers
q^f. A number t is a period mod m exactly when it is a period mod each q^f,
so p(m) is the least common multiple of the p(q^f). Steps 2 to 4 show that
p(q^f) is always a power of q. Hence p(m)/p(q^f) is prime to q, and

    S(m) = (p(m)/p(q^f)) * S(q^f)   (mod q^f),

a unit multiple. So the order of S(m) in Z/m, which is the product of the
orders of its components in the Z/q^f, equals the product of the F(s, q^f).
Since gcd(m, K) is likewise the product of the gcd(q^f, K), it is enough to
prove the theorem for m = q^f.

**Step 2. q >= 5.** Here 2 is invertible, so (ii) reads q^f | t(2 + a(t-1)).
If q does not divide a, (i) already forces q^f | t. If q divides a, then
2 + a(t-1) = 2 (mod q) is a unit and (ii) forces q^f | t. Either way
p = q^f = m. By (2), S = a*C(m,3) + C(m,2). Now C(m,2) = m(m-1)/2 with m odd,
and C(m,3) = m * (m-1)(m-2)/6 where (m-1)(m-2)/6 is an integer because m is
prime to 6. Both are multiples of m, so S = 0 and F = 1 = gcd(q^f, K).

**Step 3. q = 3.** The same argument gives p = m = 3^f, and C(m,2) = 0 mod m.
Put u = (m-1)(m-2)/2, an integer with u = 1 (mod 3). Then C(m,3) = m*u/3 =
3^(f-1) * u, so

    S = a * 3^(f-1) * u   (mod 3^f).

If 3 divides a then S = 0 and F = 1. Otherwise S is 3^(f-1) times a unit and
F = 3. That is gcd(3^f, K3).

**Step 4. q = 2**, m = 2^f.

*a odd.* (i) forces 2^f | t. For t = 2^f * k, t + a*t(t-1)/2 =
2^f*k + 2^(f-1)*k*a*(t-1), which is 2^(f-1) mod 2^f when k is odd. So
p = 2^(f+1) = 2m. Then C(p,2) = m(2m-1) and C(p,3) = 2m * (2m-1)(m-1)/3,
where 3 divides (2m-1)(m-1) because m is 1 or 2 mod 3. Both are multiples of
m, so S = 0 and F = 1.

*a = 0 (mod 4).* Then 1 + (a/2)(t-1) is odd, so (ii) forces 2^f | t and
p = m. C(m,2) = 2^(f-1) * (m-1) = 2^(f-1) (mod 2^f), while C(m,3) is 0 for
f = 1 and equals 2^f * (m-1)(2^(f-1) - 1)/3 for f >= 2. So S = 2^(f-1) and
F = 2 for every f >= 1.

*a = 2 (mod 4).* Write a = 2b with b odd; (ii) reads 2^f | t(1 + b(t-1)).
For f = 1: t = 1 fails, t = 2 works, p = 2, S = C(2,2) = 1, F = 2.
For f >= 2: (i) forces 2^(f-1) | t, and t = 2^(f-1) works because
1 + b(t-1) is then even. So p = m/2. C(p,2) = 2^(f-2) * (p-1), an odd
multiple of 2^(f-2). C(p,3) is 0 for f = 2 and an odd multiple of 2^(f-1)
for f >= 3, so a*C(p,3) = 0 (mod 2^f). Hence S is an odd multiple of
2^(f-2) and F = 4.

In all three sub-cases F = gcd(2^f, K2). QED.

## Remarks

- The least period itself: p(m) is the product over prime powers of q^f for
  odd q, and for q = 2 of 2^(f+1) (a odd), 2^f (a = 0 mod 4, or f = 1), or
  2^(f-1) (a = 2 mod 4 and f >= 2). For the squares mod 360 = 8*9*5 this
  gives 4*9*5 = 180, and for the triangular numbers 16*9*5 = 720.
- s = 2 gives P(n) = n and K = 2: the natural numbers mod m fold twice when
  m is even and drift when m is odd.
- The triangular numbers (K = 3) close into three copies exactly when 3
  divides m; the squares (K = 12) give gcd(m, 12); the pentagonal numbers
  (K = 1) have no net turn at any modulus.
- **No net turn is not the same as never closing.** When F = 1 the curve
  closes exactly when the displacement over one period is zero, and that
  depends on the drawing rule. With straight steps (turn, then step one
  unit) it does happen: the pentagonal numbers close in one period at
  m = 4, 12, 16, 20, 28, 36, 44, 48, 52, 60, the triangular numbers at
  m = 8, 16, 25, 32, 40, 49, 50, 56, and the squares at m = 25, 49. With
  unit arcs, the rule used here and by NCurve, a search of every modulus up
  to 60 found no such closure for any of the three. That is a computed
  absence, not a proof.
