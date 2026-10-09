import Mathlib

/-!
# Fold counts of polygonal-number curves (OEIS A400844)

`poly a n = a * C(n,2) + n` is the `(a+2)`-gonal number: `a = 1` the triangular
numbers, `a = 2` the squares, `a = 3` the pentagonal numbers.

Fix a modulus `m ≥ 1`. The residues `poly a n mod m` are periodic; `period a m`
is the least positive period, and `S a m` the sum of one period of residues,
as an element of `ZMod m`. The theorem is

    addOrderOf (S a m) = Nat.gcd m (K a)

where `K a` is the product of a 2-part (1, 4 or 2 as `a` is odd, 2 mod 4 or
0 mod 4) and a 3-part (1 if 3 divides `a`, else 3).

This file holds the definitions and the statement-level facts about periods.
-/

namespace FoldCount

/-- The `(a+2)`-gonal numbers: `0, 1, a+2, 3a+3, ...`. -/
def poly (a n : ℕ) : ℕ := a * n.choose 2 + n

/-- `t` is a period of the residues of `poly a` modulo `m`. -/
def IsPeriod (a m t : ℕ) : Prop := ∀ n, (poly a (n + t) : ZMod m) = (poly a n : ZMod m)

/-- The constant of the theorem. -/
def K (a : ℕ) : ℕ :=
  (if a % 2 = 1 then 1 else if a % 4 = 2 then 4 else 2) * (if a % 3 = 0 then 1 else 3)

/-- `C(n + t, 2) = C(n, 2) + n * t + C(t, 2)`. -/
theorem choose_two_add (n t : ℕ) : (n + t).choose 2 = n.choose 2 + n * t + t.choose 2 := by
  induction t with
  | zero => simp
  | succ t ih =>
    rw [← Nat.add_assoc, Nat.choose_succ_succ' (n + t) 1, Nat.choose_succ_succ' t 1, ih]
    simp only [Nat.choose_one_right]
    ring

/-- Shifting the index by `t` adds `a * t * n + (a * C(t,2) + t)`. -/
theorem poly_add (a n t : ℕ) :
    poly a (n + t) = poly a n + (a * t * n + (a * t.choose 2 + t)) := by
  unfold poly
  rw [choose_two_add]
  ring

/-- `t` is a period mod `m` exactly when `m ∣ a * t` and `m ∣ a * C(t,2) + t`. -/
theorem isPeriod_iff (a m t : ℕ) :
    IsPeriod a m t ↔ m ∣ a * t ∧ m ∣ a * t.choose 2 + t := by
  unfold IsPeriod
  have key : ∀ n, ((poly a (n + t) : ℕ) : ZMod m) = (poly a n : ZMod m) ↔
      m ∣ a * t * n + (a * t.choose 2 + t) := by
    intro n
    rw [poly_add, Nat.cast_add, add_eq_left, ZMod.natCast_eq_zero_iff]
  constructor
  · intro h
    have h0 := (key 0).mp (h 0)
    have h1 := (key 1).mp (h 1)
    simp only [Nat.mul_zero, Nat.zero_add, Nat.mul_one] at h0 h1
    exact ⟨(Nat.dvd_add_left h0).mp h1, h0⟩
  · rintro ⟨h1, h2⟩ n
    exact (key n).mpr (Dvd.dvd.add (Dvd.dvd.mul_right h1 n) h2)

/-- The sum of the first `t` polygonal numbers. -/
theorem sum_poly (a t : ℕ) :
    ∑ k ∈ Finset.range t, poly a k = a * t.choose 3 + t.choose 2 := by
  induction t with
  | zero => simp
  | succ t ih =>
    rw [Finset.sum_range_succ, ih, Nat.choose_succ_succ' t 2, Nat.choose_succ_succ' t 1]
    unfold poly
    simp only [Nat.choose_one_right]
    ring

end FoldCount
