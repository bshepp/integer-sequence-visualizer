import FoldCount.Main

/-!
# Proof of the fold-count theorem

After `dvd_iff`, every divisibility question about the sum is an identity in
`ZMod 12` between the residues of the period and of `a`. Those are finite
checks, done by `decide` in `good_of_period_eq`, `good_of_period_double` and
`good_of_period_half`: one for each shape the least period can take.
-/

namespace FoldCount

theorem K_dvd_twelve (a : ℕ) : K a ∣ 12 := by
  unfold K
  split_ifs <;> decide

theorem K_mod (a : ℕ) : K a = K (a % 12) := by
  unfold K
  have h2 : a % 12 % 2 = a % 2 := Nat.mod_mod_of_dvd a (by decide)
  have h4 : a % 12 % 4 = a % 4 := Nat.mod_mod_of_dvd a (by decide)
  have h3 : a % 12 % 3 = a % 3 := Nat.mod_mod_of_dvd a (by decide)
  rw [h2, h4, h3]

theorem gcd_K_mod (a m : ℕ) : Nat.gcd m (K a) = Nat.gcd (m % 12) (K (a % 12)) := by
  rw [← K_mod]
  have hk := K_dvd_twelve a
  calc Nat.gcd m (K a) = Nat.gcd (K a) m := Nat.gcd_comm _ _
    _ = Nat.gcd (m % K a) (K a) := Nat.gcd_rec _ _
    _ = Nat.gcd (m % 12 % K a) (K a) := by rw [Nat.mod_mod_of_dvd m hk]
    _ = Nat.gcd (K a) (m % 12) := (Nat.gcd_rec _ _).symm
    _ = Nat.gcd (m % 12) (K a) := Nat.gcd_comm _ _

/-- An element `N` of `ZMod m` has additive order `g` once `g • N = 0` and no
proper divisor `g / q` of `g` by a prime kills it. -/
theorem order_of_cast (m N g : ℕ) (hg : 0 < g) (hA : m ∣ g * N)
    (hB : ∀ q : ℕ, q.Prime → q ∣ g → ¬ m ∣ (g / q) * N) :
    addOrderOf ((N : ℕ) : ZMod m) = g := by
  apply addOrderOf_eq_of_nsmul_and_div_prime_nsmul hg
  · rw [nsmul_eq_mul, ← Nat.cast_mul, ZMod.natCast_eq_zero_iff]
    exact hA
  · intro q hq hqg h
    apply hB q hq hqg
    rwa [nsmul_eq_mul, ← Nat.cast_mul, ZMod.natCast_eq_zero_iff] at h

/-- What has to hold in `ZMod 12` for the order to be `g`: `g` kills the sum,
and neither `g / 2` nor `g / 3` does. `μ` is twice the period over the modulus. -/
abbrev Good (μ g : ℕ) (x y : ZMod 12) : Prop :=
  ((μ * g : ℕ) : ZMod 12) * Ez x y = 0 ∧
  (2 ∣ g → ((μ * (g / 2) : ℕ) : ZMod 12) * Ez x y ≠ 0) ∧
  (3 ∣ g → ((μ * (g / 3) : ℕ) : ZMod 12) * Ez x y ≠ 0)

set_option synthInstance.maxSize 100000 in
set_option synthInstance.maxHeartbeats 2000000 in
set_option maxRecDepth 100000 in
/-- Period equal to the modulus: `m` odd, or `a` even outside the halving case. -/
theorem good_of_period_eq : ∀ r, r < 12 → ∀ s, s < 12 →
    (r % 2 = 1 ∨ (s % 2 = 0 ∧ ¬(s % 4 = 2 ∧ r % 4 = 0))) →
    Good 2 (Nat.gcd r (K s)) ((r : ℕ) : ZMod 12) ((s : ℕ) : ZMod 12) := by
  decide

set_option synthInstance.maxSize 100000 in
set_option synthInstance.maxHeartbeats 2000000 in
set_option maxRecDepth 100000 in
/-- Period twice the modulus: `m` even and `a` odd. -/
theorem good_of_period_double : ∀ r, r < 12 → ∀ s, s < 12 → r % 2 = 0 → s % 2 = 1 →
    Good 4 (Nat.gcd r (K s)) ((2 * r : ℕ) : ZMod 12) ((s : ℕ) : ZMod 12) := by
  decide

set_option synthInstance.maxSize 100000 in
set_option synthInstance.maxHeartbeats 2000000 in
set_option maxRecDepth 100000 in
/-- Period half the modulus: `4 ∣ m` and `a ≡ 2 (mod 4)`. Here `x` is the
residue of the period, so the modulus has residue `2 * x`. -/
theorem good_of_period_half : ∀ x, x < 12 → ∀ s, s < 12 → x % 2 = 0 → s % 4 = 2 →
    Good 1 (Nat.gcd (2 * x % 12) (K s)) ((x : ℕ) : ZMod 12) ((s : ℕ) : ZMod 12) := by
  decide

/-- **The fold-count theorem (OEIS A400844).** For the `(a+2)`-gonal numbers
and every modulus `m ≥ 1`, the sum of one least period of residues has
additive order `gcd m (K a)` in `ZMod m`. -/
theorem fold_count (a m : ℕ) (hm : 0 < m) : addOrderOf (S a m hm) = Nat.gcd m (K a) := by
  rw [S_eq]
  have hppos := per_pos a m hm
  have hg : 0 < Nat.gcd m (K a) := Nat.gcd_pos_of_pos_left (K a) hm
  have hr : m % 12 < 12 := Nat.mod_lt m (by norm_num)
  have hs : a % 12 < 12 := Nat.mod_lt a (by norm_num)
  have ha : ((a : ℕ) : ZMod 12) = ((a % 12 : ℕ) : ZMod 12) := (ZMod.natCast_mod a 12).symm
  have key : ∃ μ, μ * m = 2 * per a m ∧
      Good μ (Nat.gcd m (K a)) ((per a m : ℕ) : ZMod 12) ((a : ℕ) : ZMod 12) := by
    rw [gcd_K_mod, ha]
    by_cases hmo : m % 2 = 1
    · have hp : per a m = m := by unfold per; simp [hmo]
      refine ⟨2, by rw [hp], ?_⟩
      rw [hp, ← ZMod.natCast_mod m 12]
      exact good_of_period_eq _ hr _ hs (Or.inl (by omega))
    · by_cases hao : a % 2 = 1
      · have hp : per a m = 2 * m := by unfold per; simp [hmo, hao]
        refine ⟨4, by rw [hp]; ring, ?_⟩
        have hx : ((2 * m : ℕ) : ZMod 12) = ((2 * (m % 12) : ℕ) : ZMod 12) := by
          push_cast; rw [ZMod.natCast_mod]
        rw [hp, hx]
        exact good_of_period_double _ hr _ hs (by omega) (by omega)
      · by_cases hc : a % 4 = 2 ∧ m % 4 = 0
        · have hp : per a m = m / 2 := by unfold per; simp [hmo, hao, hc]
          refine ⟨1, by rw [hp]; omega, ?_⟩
          have hmr : m % 12 = 2 * (m / 2 % 12) % 12 := by omega
          rw [hp, hmr, ← ZMod.natCast_mod (m / 2) 12]
          exact good_of_period_half _ (Nat.mod_lt _ (by norm_num)) _ hs (by omega) (by omega)
        · have hp : per a m = m := by unfold per; simp [hmo, hao, hc]
          refine ⟨2, by rw [hp], ?_⟩
          rw [hp, ← ZMod.natCast_mod m 12]
          exact good_of_period_eq _ hr _ hs (Or.inr ⟨by omega, by omega⟩)
  obtain ⟨μ, hμ, hA, hB2, hB3⟩ := key
  apply order_of_cast m _ _ hg
  · exact (dvd_iff a m (per a m) _ μ hppos hμ).mpr hA
  · intro q hq hqg
    have hq12 : q ∣ 2 * 2 * 3 :=
      dvd_trans hqg (dvd_trans (Nat.gcd_dvd_right _ _) (K_dvd_twelve a))
    have hq23 : q = 2 ∨ q = 3 := by
      rcases (Nat.Prime.dvd_mul hq).mp hq12 with h | h
      · rcases (Nat.Prime.dvd_mul hq).mp h with h | h <;>
          exact Or.inl ((Nat.prime_dvd_prime_iff_eq hq Nat.prime_two).mp h)
      · exact Or.inr ((Nat.prime_dvd_prime_iff_eq hq Nat.prime_three).mp h)
    rw [dvd_iff a m (per a m) _ μ hppos hμ]
    rcases hq23 with rfl | rfl
    · exact hB2 hqg
    · exact hB3 hqg

end FoldCount
