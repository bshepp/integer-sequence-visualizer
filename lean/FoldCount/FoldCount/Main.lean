import FoldCount.Period

/-!
# The fold-count theorem

`period a m` is the least positive period of `poly a` modulo `m`, `S a m` the
sum of one period of residues in `ZMod m`, and

    theorem fold_count : addOrderOf (S a m hm) = Nat.gcd m (K a)
-/

namespace FoldCount

theorem per_pos (a m : ℕ) (hm : 0 < m) : 0 < per a m := by
  unfold per
  split_ifs <;> omega

theorem exists_period (a m : ℕ) (hm : 0 < m) : ∃ t, 0 < t ∧ IsPeriod a m t :=
  ⟨per a m, per_pos a m hm, (isPeriod_iff_per_dvd a m _ hm).mpr dvd_rfl⟩

open Classical in
/-- The least positive period of the residues of `poly a` modulo `m`. -/
noncomputable def period (a m : ℕ) (hm : 0 < m) : ℕ := Nat.find (exists_period a m hm)

open Classical in
theorem period_eq (a m : ℕ) (hm : 0 < m) : period a m hm = per a m := by
  unfold period
  rw [Nat.find_eq_iff]
  refine ⟨⟨per_pos a m hm, (isPeriod_iff_per_dvd a m _ hm).mpr dvd_rfl⟩, ?_⟩
  rintro t ht ⟨hpos, hper⟩
  have := Nat.le_of_dvd hpos ((isPeriod_iff_per_dvd a m t hm).mp hper)
  omega

/-- The sum of one least period of residues, in `ZMod m`. -/
noncomputable def S (a m : ℕ) (hm : 0 < m) : ZMod m :=
  ∑ k ∈ Finset.range (period a m hm), (poly a k : ZMod m)

theorem S_eq (a m : ℕ) (hm : 0 < m) :
    S a m hm = ((a * (per a m).choose 3 + (per a m).choose 2 : ℕ) : ZMod m) := by
  unfold S
  rw [period_eq, ← Nat.cast_sum, sum_poly]

/-! ### The sum in closed form over the integers -/

theorem two_choose_two (p : ℕ) : (2 * (p.choose 2 : ℤ)) = p * (p - 1) := by
  induction p with
  | zero => simp
  | succ p ih =>
    rw [Nat.choose_succ_succ' p 1, Nat.choose_one_right]
    push_cast
    linear_combination ih

theorem six_choose_three (p : ℕ) : (6 * (p.choose 3 : ℤ)) = p * (p - 1) * (p - 2) := by
  induction p with
  | zero => simp
  | succ p ih =>
    rw [Nat.choose_succ_succ' p 2]
    push_cast
    linear_combination ih + 3 * two_choose_two p

theorem six_N (a p : ℕ) :
    (6 * ((a * p.choose 3 + p.choose 2 : ℕ) : ℤ)) = p * (p - 1) * (a * (p - 2) + 3) := by
  push_cast
  linear_combination (a : ℤ) * six_choose_three p + 3 * two_choose_two p

/-- The expression whose residue mod 12 decides everything. -/
def Ez (x y : ZMod 12) : ZMod 12 := (x - 1) * (y * (x - 2) + 3)

/-- Divisibility of a multiple of the sum by `m`, as an identity in `ZMod 12`.
`μ` records the ratio of the period to the modulus: `μ * m = 2 * p`. -/
theorem dvd_iff (a m p c μ : ℕ) (hp : 0 < p) (h : μ * m = 2 * p) :
    m ∣ c * (a * p.choose 3 + p.choose 2) ↔
      ((μ * c : ℕ) : ZMod 12) * Ez (p : ZMod 12) (a : ZMod 12) = 0 := by
  have hμ : 0 < μ := by
    rcases Nat.eq_zero_or_pos μ with h0 | h0
    · rw [h0] at h; omega
    · exact h0
  set N := a * p.choose 3 + p.choose 2 with hN
  have hpz : (p : ℤ) ≠ 0 := by exact_mod_cast hp.ne'
  calc m ∣ c * N
      ↔ μ * m ∣ μ * (c * N) := (Nat.mul_dvd_mul_iff_left hμ).symm
    _ ↔ 2 * p ∣ μ * (c * N) := by rw [h]
    _ ↔ ((2 * p : ℕ) : ℤ) ∣ ((μ * (c * N) : ℕ) : ℤ) := Int.natCast_dvd_natCast.symm
    _ ↔ (6 : ℤ) * ((2 * p : ℕ) : ℤ) ∣ 6 * ((μ * (c * N) : ℕ) : ℤ) :=
        (mul_dvd_mul_iff_left (by norm_num : (6 : ℤ) ≠ 0)).symm
    _ ↔ (p : ℤ) * 12 ∣ (p : ℤ) * ((μ * c : ℕ) * (((p : ℤ) - 1) * (a * (p - 2) + 3))) := by
        have e1 : (6 : ℤ) * ((2 * p : ℕ) : ℤ) = (p : ℤ) * 12 := by push_cast; ring
        have e2 : 6 * ((μ * (c * N) : ℕ) : ℤ) =
            (p : ℤ) * ((μ * c : ℕ) * (((p : ℤ) - 1) * (a * (p - 2) + 3))) := by
          have := six_N a p
          rw [← hN] at this
          push_cast
          linear_combination ((μ : ℤ) * c) * this
        rw [e1, e2]
    _ ↔ (12 : ℤ) ∣ ((μ * c : ℕ) * (((p : ℤ) - 1) * (a * (p - 2) + 3))) :=
        mul_dvd_mul_iff_left hpz
    _ ↔ ((((μ * c : ℕ) * (((p : ℤ) - 1) * (a * (p - 2) + 3)) : ℤ)) : ZMod 12) = 0 :=
        (ZMod.intCast_zmod_eq_zero_iff_dvd _ 12).symm
    _ ↔ ((μ * c : ℕ) : ZMod 12) * Ez (p : ZMod 12) (a : ZMod 12) = 0 := by
        unfold Ez
        push_cast
        rfl

end FoldCount
