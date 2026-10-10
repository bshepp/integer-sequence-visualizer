# Ring or helix: when a periodic 3D walk has no slide

**DRAFT, not reviewed.** Written by Claude (Anthropic's AI) on 2026-10-09 at
Brian Sheppard's request, after the first 3D renders of polygonal-number
curves showed the squares and triangular numbers orbiting a fixed axis while
the pentagonal numbers corkscrewed away. Checked numerically for eleven cases
(tables below), including one prediction made before it was computed. Not
machine-checked. Whether the result is new is unknown: a reflection-symmetric
turn sequence giving a slide-free screw is a natural observation, and it may
exist in the literature on discrete space curves or turtle geometry. **No
mathematician has read it.**

The 3D drawing rule this is about is the walk of `src/viz3d/polyarc3d.ts`,
with any rule that takes the tilt angle from a residue of the term. The
numbers in the tables come from `scripts/ring-or-helix.py`.

## Setup

A **walk** is a sequence of unit-length circular arcs. The walker carries a
right-handed frame (H, L, U): heading, left, up. Step n turns the frame by an
angle y_n about U (the yaw) and q_n about L (the pitch) at a steady rate while
moving forward at unit speed. Turning steadily about a fixed combination of
two of the walker's own axes is turning about one fixed axis, so each step is
an exact circular arc, of length 1, bending by the angle phi_n =
sqrt(y_n^2 + q_n^2) about the axis (y_n U + q_n L)/phi_n. With q_n = 0 the
walk is the flat polyarc curve.

The two angles come from the sequence: y_n is a function of a(n) mod m (the
flat rule, 1 degree per residue unit with an offset of -180 degrees in the
renders) and q_n a function of a(n) mod m2 for a second modulus m2. Both are
then functions of a(n) mod M where M = lcm(m, m2), and the **turn sequence**
t_n = (y_n, q_n) is purely periodic whenever a(n) mod M is. Let p be a period.

Let g be the rigid motion of space that carries the frame at vertex 0 to the
frame at vertex p. Because every step is determined by the turn sequence and
the frame it starts from, g carries vertex n to vertex n + p for every n, so g
maps the whole infinite curve C onto itself, shifted one period along.

**Screws.** Every proper rigid motion of 3-space is a screw (Chasles): a
rotation by some angle theta in [0, pi] about an axis l, composed with a
translation by a distance d along l. When 0 < theta < pi the axis is unique
and, orienting it so the rotation is counter-clockwise, d has a definite
sign. Call the sign of d the **handedness** of the screw (0 when d = 0). A
screw with d = 0 is a rotation: iterating it keeps every point on a circle, so
C stays within a bounded distance of l forever. A screw with d != 0 carries C
off to infinity along l, like a helix. The two cases are what the renders
show as a ring and a corkscrew.

Two facts about handedness, both immediate from the definition:

- (H1) g and g^-1 have the same handedness (g^-1 rotates by -theta and
  translates by -d; reversing the orientation of l makes that +theta and +d
  about the same line).
- (H2) If sigma is an improper isometry (a reflection, or anything with
  determinant -1), sigma g sigma^-1 has the opposite handedness to g.
  Conjugation moves the axis to sigma(l) and keeps the translation distance;
  a reflection reverses the sense of rotation, so the sign of d relative to
  the counter-clockwise orientation flips.

## Two lemmas about the walk

**Lemma 1 (mirror).** Reflect the walk in a plane. The result is the walk,
from the reflected frame (re-right-handed), whose turn sequence has one of the
two angles negated: (y_n, -q_n) for a reflection in the plane of H and L, or
(-y_n, q_n) for a reflection in the plane of H and U.

*Proof.* A reflection carries a circular arc to a circular arc of the same
length and bend, and reverses the sense of every rotation. Reflecting in the
plane spanned by H and L fixes H and L and sends U to -U; the reflected
walker's frame is (H, L, H x L) = (H, L, U) again. The step's rotation axis
(y U + q L)/phi reflects to (-y U + q L)/phi, and a rotation by phi about it
becomes a rotation by -phi about its image, which is a rotation by phi about
(y U - q L)/phi: the step with turns (y, -q). The other plane is the same with
the roles of L and U exchanged. Induction on the steps. QED

**Lemma 2 (reversal).** Run the walk backwards. From any vertex, the backward
walk is the walk from the frame (-H, L, -U) at that vertex (the frame turned
half a turn about L, which is proper) whose turn sequence is the forward
sequence read backwards with the pitch negated: step k of the backward walk is
(y_j, -q_j) where step j is the forward step that the backward walker is
retracing.

*Proof.* Retracing an arc keeps its centre of curvature and reverses the
tangent. In the forward walker's frame the arc bends toward the direction
s = w x H, where w is its rotation axis. The backward walker has heading
-H, and with frame (-H, L, -U) it bends toward the same s, so its axis is
w' with w' x (-H) = s = w x H, that is w' = -w = (-y U - q L)/phi =
(y (-U) - q L)/phi: in the backward walker's own frame (-H, L, -U) that is the
axis of the turn (y, -q). The frame after the step is the backward walker's
frame at the previous vertex by the same argument. Induction. QED

## Theorem

**Theorem (ring or helix).** Let t_n = (y_n, q_n), n in Z, be a purely
periodic turn sequence with a reflection symmetry: an integer c with

    t_n = t_{c-n}   for every n.

(c odd means the symmetry is about vertex (c+1)/2; c even means it is about the
midpoint of step c/2.) Let g be the period motion of the walk and theta its
rotation angle. If theta is not 0 and not pi, then the slide of g is zero: g
is a rotation about a fixed axis, and the walk stays within a bounded distance
of that axis for all time.

*Proof.* Place vertex 0 so that the symmetry is centred there: shift the
indexing so that c = -1 (vertex centre) or c = 0 (midpoint centre); the
period motion is unchanged up to conjugation by a proper motion, which
preserves theta and the slide.

Vertex centre (c = -1, so t_{-1-n} = t_n). By Lemma 2 the reversed curve is the
walk from (-H, L, -U) at vertex 0 with turns (y_{-1-n}, -q_{-1-n}) =
(y_n, -q_n). By Lemma 1 that is the mirror, in the plane of H and L through
vertex 0, of the walk from the frame (-H, L, U) with turns (y_n, q_n). The
frame (-H, L, U) is the reflection of (H, L, U) in the plane perpendicular to
H. So the reversed curve is sigma(C) where sigma is the reflection in the plane
through vertex 0 perpendicular to the heading there, composed with a second
reflection that undoes the first's effect on the frame; in all, sigma is an
improper isometry with sigma(C) = C and sigma reversing the direction of
travel. (Midpoint centre: the same with vertex 0 replaced by the midpoint of
step 0, using that a circular arc is symmetric about its own midpoint.)

Because sigma reverses the direction along C and g shifts C one period
forward, sigma g sigma^-1 shifts C one period backward: sigma g sigma^-1 =
g^-1. By (H1) the right-hand side has the handedness of g; by (H2) the
left-hand side has the opposite handedness. So the handedness of g is 0, that
is d = 0. (Handedness is defined because 0 < theta < pi.) QED

**What the theorem does not say.** When theta = 0 or theta = pi the argument
is silent: a translation has no handedness, and a half-turn screw is its own
mirror image. The ring need not close: it closes only if theta is a rational
multiple of 360 degrees, and for the squares below theta = 133.212... degrees,
which has not been shown to be rational or irrational. And nothing here says a
walk without the symmetry must slide; it says only that one with it cannot.

## Polygonal numbers

For the s-gonal numbers P(n) = ((s-2) n^2 - (s-4) n)/2 write a = s - 2. The
turn sequence depends on P(n) mod M, so a centre c exists exactly when
P(c-n) = P(n) (mod M) for all n, that is (expanding)

    a c + 2 - a = 0 (mod M)   and   c (a c + 2 - a) / 2 = 0 (mod M),

with c ranging over the integers. In particular gcd(a, M) must divide a - 2.

- Triangular numbers (a = 1): c = -1 works for every M, since
  T(-1-n) = T(n) identically.
- Squares (a = 2): c = 0 works for every M, since (-n)^2 = n^2.
- Pentagonal numbers (a = 3): a centre exists if and only if 3 does not
  divide M.
- Hexagonal (a = 4): needs 4 c = 2 (mod M), impossible when M is even.

So with the flat rule at m = 360 and any second modulus, only the triangular
numbers and squares have the symmetry among s = 3, 4, 5, 6, and every a with
gcd(a, 360) not dividing a - 2 is excluded.

## Numerical checks

Per-period motion of the walk, computed in double precision by composing the
step rotations (`scripts/ring-or-helix.py`). "Slide" is |t . l| for the translation t
and unit axis l of the period motion. Values around 1e-14 are zero to
rounding after thousands of rotations.

Bend 1 deg x (a(n) mod 360) - 180; tilt (360/7) deg x signed(a(n) mod 7);
M = 2520.

| sequence | period | turn theta | slide | symmetry centre | theorem says |
|---|---|---|---|---|---|
| triangular | 5040 | 105.110 | 9e-14 | c = -1 | ring |
| squares | 1260 | 133.212 | 3e-14 | c = 0 | ring |
| pentagonal | 5040 | 142.707 | 26.45 | none | (silent) |
| hexagonal | 2520 | 98.631 | 15.98 | none | (silent) |
| heptagonal | 5040 | 146.901 | 26.84 | none | (silent) |
| octagonal | 1260 | 166.117 | 14.64 | none | (silent) |
| nonagonal | 5040 | 155.642 | 76.60 | none | (silent) |
| decagonal | 2520 | 152.316 | 15.23 | none | (silent) |

Prediction made before computing: with both moduli odd and not divisible by 3
the pentagonal numbers acquire a centre and should ring. Bend (360/7) deg x
(a(n) mod 7) - 180; tilt (360/11) deg x signed(a(n) mod 11); M = 77.

| sequence | period | turn theta | slide | symmetry centre | theorem says |
|---|---|---|---|---|---|
| squares | 77 | 47.697 | 1e-15 | c = 0 | ring |
| pentagonal | 77 | 139.455 | 3e-15 | c = 26 | ring |
| hexagonal | 77 | 88.101 | 1e-15 | c = 39 (= -38) | ring |

## Remarks

- This is a different statement from the fold-count theorem (A400844,
  `fold-count-proof.md`), which is about the flat drawing and is arithmetic.
  The two conditions do not coincide: the hexagonal numbers close in the plane
  (6 folds at m = 360) but corkscrew in space at M = 2520.
- The symmetry is of the turn sequence, not of the sequence of terms, so the
  theorem applies to any rule in which the two angles are functions of
  residues of a(n): the next-digit rule of Film 1 (where M = m^2) included.
- "Ring" means bounded distance from an axis, not a closed curve. Whether any
  of these rings closes is open.
- Open: a proof that the slide is nonzero when the symmetry is absent (the
  table suggests it, for these sequences); whether theta is ever a rational
  multiple of 360 degrees; the literature.
