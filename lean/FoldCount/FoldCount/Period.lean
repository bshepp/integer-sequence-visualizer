import FoldCount.Basic

/-!
# The least period of the polygonal numbers modulo `m`

`per a m` is an explicit formula, and `isPeriod_iff_per_dvd` says the periods
are exactly its multiples:

* `m` odd: `m`;
* `m` even, `a` odd: `2 * m`;
* `m` divisible by 4 and `a ≡ 2 (mod 4)`: `m / 2`;
* otherwise: `m`.
-/

namespace FoldCount

theorem two_mul_choose_two_succ (u : ℕ) : 2 * (u + 1).choose 2 = (u + 1) * u := by
  induction u with
  | zero => simp
  | succ u ih =>
    rw [Nat.choose_succ_succ' (u + 1) 1, Nat.choose_one_right, Nat.mul_add, ih]
    ring

/-- Twice the second period condition, factored. -/
theorem two_mul_cond (a u : ℕ) :
    2 * (a * (u + 1).choose 2 + (u + 1)) = (u + 1) * (a * u + 2) := by
  have h := two_mul_choose_two_succ u
  calc 2 * (a * (u + 1).choose 2 + (u + 1))
      = a * (2 * (u + 1).choose 2) + 2 * (u + 1) := by ring
    _ = a * ((u + 1) * u) + 2 * (u + 1) := by rw [h]
    _ = (u + 1) * (a * u + 2) := by ring

/-- The explicit least period. -/
def per (a m : ℕ) : ℕ :=
  if m % 2 = 1 then m
  else if a % 2 = 1 then 2 * m
  else if a % 4 = 2 ∧ m % 4 = 0 then m / 2
  else m

/-- The period conditions for `t = u + 1`, with the second one doubled and factored. -/
theorem isPeriod_succ_iff (a m u : ℕ) :
    IsPeriod a m (u + 1) ↔ m ∣ a * (u + 1) ∧ 2 * m ∣ (u + 1) * (a * u + 2) := by
  rw [isPeriod_iff, ← two_mul_cond, Nat.mul_dvd_mul_iff_left (by norm_num : 0 < 2)]

/-- Any period `t` has `m ∣ 2 * t`. -/
theorem dvd_two_mul_of_cond {a m u : ℕ} (h1 : m ∣ a * (u + 1))
    (h2 : 2 * m ∣ (u + 1) * (a * u + 2)) : m ∣ 2 * (u + 1) := by
  have h3 : m ∣ (u + 1) * (a * u + 2) := Dvd.dvd.trans (Dvd.intro_left 2 rfl) h2
  have h4 : (u + 1) * (a * u + 2) = a * (u + 1) * u + 2 * (u + 1) := by ring
  rw [h4] at h3
  exact (Nat.dvd_add_right (Dvd.dvd.mul_right h1 u)).mp h3

theorem isPeriod_iff_per_dvd (a m t : ℕ) (hm : 0 < m) : IsPeriod a m t ↔ per a m ∣ t := by
  rcases t with _ | u
  · simp [IsPeriod]
  rw [isPeriod_succ_iff]
  unfold per
  by_cases hmo : m % 2 = 1
  · -- m odd: the period is m
    simp only [hmo, ↓reduceIte]
    have hc : Nat.Coprime m 2 := by
      rw [Nat.coprime_two_right]; exact Nat.odd_iff.mpr hmo
    constructor
    · rintro ⟨h1, h2⟩
      have h := dvd_two_mul_of_cond h1 h2
      rw [Nat.mul_comm] at h
      exact hc.dvd_of_dvd_mul_right h
    · intro h
      refine ⟨Dvd.dvd.mul_left h a, ?_⟩
      rw [Nat.mul_comm 2 m]
      refine hc.mul_dvd_of_dvd_of_dvd (Dvd.dvd.mul_right h _) ?_
      rw [← two_mul_cond]; exact Dvd.intro _ rfl
  · simp only [hmo, ↓reduceIte]
    obtain ⟨h, rfl⟩ : ∃ h, m = 2 * h := ⟨m / 2, by omega⟩
    have hh : 0 < h := by omega
    by_cases hao : a % 2 = 1
    · -- m even, a odd: the period is 2 * m
      simp only [hao, ↓reduceIte]
      constructor
      · rintro ⟨h1, h2⟩
        have h3 := dvd_two_mul_of_cond h1 h2
        obtain ⟨j, hj⟩ := (Nat.mul_dvd_mul_iff_left (by norm_num : 0 < 2)).mp h3
        -- 2 ∣ a * j, so 2 ∣ j
        have h5 : 2 * h ∣ h * (a * j) := by
          have : a * (u + 1) = h * (a * j) := by rw [hj]; ring
          rw [← this]; exact h1
        rw [Nat.mul_comm 2 h] at h5
        have h6 : 2 ∣ a * j := (Nat.mul_dvd_mul_iff_left hh).mp h5
        have hac : Nat.Coprime 2 a := by
          rw [Nat.coprime_two_left]; exact Nat.odd_iff.mpr hao
        obtain ⟨i, hi⟩ := hac.dvd_of_dvd_mul_left h6
        -- now u + 1 = 2 * h * i
        have hT : u + 1 = 2 * h * i := by rw [hj, hi]; ring
        have h7 : 2 * (2 * h) ∣ 2 * h * (i * (a * u + 2)) := by
          have : (u + 1) * (a * u + 2) = 2 * h * (i * (a * u + 2)) := by rw [hT]; ring
          rw [← this]; exact h2
        rw [Nat.mul_comm 2 (2 * h)] at h7
        have h8 : 2 ∣ i * (a * u + 2) := (Nat.mul_dvd_mul_iff_left (by omega : 0 < 2 * h)).mp h7
        have hu : u % 2 = 1 := by
          have : u + 1 = 2 * (h * i) := by rw [hT]; ring
          omega
        have hX : Nat.Coprime 2 (a * u + 2) := by
          rw [Nat.coprime_two_left, Nat.odd_iff, Nat.add_mod, Nat.mul_mod, hao, hu]
        obtain ⟨k, hk⟩ := hX.dvd_of_dvd_mul_right h8
        exact ⟨k, by rw [hT, hk]; ring⟩
      · rintro ⟨k, hk⟩
        refine ⟨⟨2 * k * a, by rw [hk]; ring⟩, ?_⟩
        exact Dvd.dvd.mul_right ⟨k, hk⟩ _
    · simp only [hao, ↓reduceIte]
      obtain ⟨b, rfl⟩ : ∃ b, a = 2 * b := ⟨a / 2, by omega⟩
      -- the doubled condition reduces to 2 * h ∣ (u + 1) * (b * u + 1)
      have red : 2 * (2 * h) ∣ (u + 1) * (2 * b * u + 2) ↔ 2 * h ∣ (u + 1) * (b * u + 1) := by
        have : (u + 1) * (2 * b * u + 2) = 2 * ((u + 1) * (b * u + 1)) := by ring
        rw [this, Nat.mul_dvd_mul_iff_left (by norm_num : 0 < 2)]
      rw [red]
      by_cases hcase : 2 * b % 4 = 2 ∧ 2 * h % 4 = 0
      · -- a ≡ 2 (mod 4), 4 ∣ m: the period is m / 2 = h
        simp only [hcase, and_self, ↓reduceIte]
        have hdiv : 2 * h / 2 = h := by omega
        rw [hdiv]
        constructor
        · rintro ⟨h1, h2⟩
          have h3 := dvd_two_mul_of_cond h1 (red.mpr h2)
          exact (Nat.mul_dvd_mul_iff_left (by norm_num : 0 < 2)).mp h3
        · rintro ⟨k, hk⟩
          refine ⟨⟨b * k, by rw [hk]; ring⟩, ?_⟩
          -- h even, so u + 1 even, u odd, b odd, b * u + 1 even
          have hbu : (b * u + 1) % 2 = 0 := by
            have hb : b % 2 = 1 := by omega
            have hu : u % 2 = 1 := by
              obtain ⟨h', rfl⟩ : ∃ h', h = 2 * h' := ⟨h / 2, by omega⟩
              have : u + 1 = 2 * (h' * k) := by rw [hk]; ring
              omega
            rw [Nat.add_mod, Nat.mul_mod, hb, hu]
          obtain ⟨e, he⟩ : ∃ e, b * u + 1 = 2 * e := ⟨(b * u + 1) / 2, by omega⟩
          exact ⟨k * e, by rw [hk, he]; ring⟩
      · -- otherwise the period is m = 2 * h
        simp only [hcase, ↓reduceIte]
        constructor
        · rintro ⟨h1, h2⟩
          have h3 := dvd_two_mul_of_cond h1 (red.mpr h2)
          obtain ⟨j, hj⟩ := (Nat.mul_dvd_mul_iff_left (by norm_num : 0 < 2)).mp h3
          have h4 : h * 2 ∣ h * (j * (b * u + 1)) := by
            have : (u + 1) * (b * u + 1) = h * (j * (b * u + 1)) := by rw [hj]; ring
            rw [← this, Nat.mul_comm h 2]; exact h2
          have h5 : 2 ∣ j * (b * u + 1) := (Nat.mul_dvd_mul_iff_left hh).mp h4
          -- show j is even
          have hjev : j % 2 = 0 := by
            by_contra hjodd
            have hj1 : j % 2 = 1 := by omega
            have hprod : (j * (b * u + 1)) % 2 = 0 := Nat.mod_eq_zero_of_dvd h5
            rw [Nat.mul_mod, hj1] at hprod
            have hbu0 : (b * u + 1) % 2 = 0 := by omega
            -- b * u is odd, so b and u are odd
            have hbu1 : (b * u) % 2 = 1 := by omega
            have hb : b % 2 = 1 := by
              by_contra hb'
              have : b % 2 = 0 := by omega
              rw [Nat.mul_mod, this] at hbu1; simp at hbu1
            have hu : u % 2 = 1 := by
              by_contra hu'
              have : u % 2 = 0 := by omega
              rw [Nat.mul_mod, this] at hbu1; simp at hbu1
            -- u + 1 = h * j is even with j odd, so h is even: then hcase holds
            have hhev : h % 2 = 0 := by
              by_contra hh'
              have hh1 : h % 2 = 1 := by omega
              have : (h * j) % 2 = 1 := by rw [Nat.mul_mod, hh1, hj1]
              omega
            exact hcase ⟨by omega, by omega⟩
          obtain ⟨i, hi⟩ : ∃ i, j = 2 * i := ⟨j / 2, by omega⟩
          exact ⟨i, by rw [hj, hi]; ring⟩
        · rintro ⟨k, hk⟩
          exact ⟨⟨2 * b * k, by rw [hk]; ring⟩, Dvd.dvd.mul_right ⟨k, hk⟩ _⟩

end FoldCount
