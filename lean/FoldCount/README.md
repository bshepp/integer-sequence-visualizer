# FoldCount: a machine-checked proof of the fold-count theorem (OEIS A400844)

A Lean 4 proof, using Mathlib, of the theorem stated in
[`docs/fold-count-proof.md`](../../docs/fold-count-proof.md).

```lean
theorem fold_count (a m : ℕ) (hm : 0 < m) : addOrderOf (S a m hm) = Nat.gcd m (K a)
```

In words: for the `(a+2)`-gonal numbers and every modulus `m ≥ 1`, the sum of
one least period of residues mod `m` has additive order `gcd(m, K(a))` in
`Z/mZ`. The OEIS entry is indexed by the number of sides `n = a + 2`.

## What you have to read to trust it

Lean checks the proof. It cannot check that the statement says what was meant,
so these definitions are the part a person has to read:

| Name | File | Meaning |
|---|---|---|
| `poly a n` | `Basic.lean` | `a * C(n,2) + n`, the `(a+2)`-gonal number |
| `IsPeriod a m t` | `Basic.lean` | `poly a (n + t) ≡ poly a n (mod m)` for every `n` |
| `period a m hm` | `Main.lean` | the least positive `t` with `IsPeriod a m t` |
| `S a m hm` | `Main.lean` | the sum of `poly a k` for `k < period`, in `ZMod m` |
| `K a` | `Basic.lean` | (1, 4 or 2 as `a` is odd, 2 mod 4, 0 mod 4) × (1 if `3 ∣ a`, else 3) |

`K (a)` for `a = 1..12` is `3, 12, 1, 6, 3, 4, 3, 6, 1, 12, 3, 2`, the terms of
A400844 for 3 to 14 sides.

## How the proof goes

It is not a transcription of the written proof, which reduces to prime powers.
This one avoids that:

1. `Basic.lean`: `t` is a period exactly when `m ∣ a*t` and `m ∣ a*C(t,2) + t`;
   the first `t` terms sum to `a*C(t,3) + C(t,2)`.
2. `Period.lean`: the periods are exactly the multiples of an explicit `per a m`
   (`m`, `2m` or `m/2` by the parities of `a` and `m`).
3. `Main.lean`: six times the sum is `p(p-1)(a(p-2)+3)`, so whether `m` divides a
   multiple of the sum is an identity in `ZMod 12` between the residues of the
   period and of `a` (`dvd_iff`).
4. `Theorem.lean`: those identities are finite, and `decide` checks all of them.
   The order then follows from the standard criterion: `g` kills the element and
   `g/2`, `g/3` do not.

## Checking it yourself

```
lake exe cache get    # downloads prebuilt Mathlib, several GB
lake build
```

Lean 4.34.1, Mathlib v4.34.1. The build has no `sorry` and no `native_decide`;
`#print axioms FoldCount.fold_count` reports only `propext`, `Classical.choice`
and `Quot.sound`, the three axioms all of Mathlib rests on.

## What it does not prove

The theorem is the arithmetic statement only. The geometric reading (that the
drawn curve closes into that many rotated copies) is argued in the written
proof and is not formalised here.

Written by Claude (Anthropic's AI) on 2026-10-09 at Brian Sheppard's request.
