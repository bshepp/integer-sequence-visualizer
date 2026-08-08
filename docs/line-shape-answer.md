# Does line shape make a difference?

**Short answer: no - by two to three orders of magnitude.**

The question came up while adding render controls: if you can change the line
join, does that change what you'd conclude about a sequence? It's a fair
question, and the honest way to answer it is the same way this project answers
everything else - put the effect next to a null model instead of arguing about
it.

## How it was measured

The effect is **how much the swept area of the drawn path changes when only
the line join changes** (miter → round → bevel), holding the sequence fixed.

The yardstick is **how much that same quantity changes when the sequence is
replaced by a permutation of its own terms**, holding the join fixed. That is
the permutation null already used throughout the app: same multiset, different
order.

The ratio `shapeSpread / nullSpread` says which is larger. Above 1 would mean
restyling moves the measure more than reshuffling does, and shape would be
something you'd have to control for. Below 1 means it's cosmetic.

Swept area is computed analytically from the path geometry
(`src/viz/sweptArea.ts`) rather than by counting pixels - each join type has a
closed form per vertex (bevel `(r²/2)·sin θ`, round `(θ/2)·r²`, miter
`r²·tan(θ/2)`, with the canvas miter-limit fallback at 10). That makes the
whole experiment deterministic and runnable in CI, with no canvas involved.

## Result

100 permutation surrogates per row, 600 terms, 800×800 render.

| Sequence | Stroke width | Shape spread | Null spread | Ratio |
| --- | ---: | ---: | ---: | ---: |
| A000002 Kolakoski | 1 | 139 | 38,857 | **0.0036** |
| A000002 Kolakoski | 1.25 *(default)* | 218 | 48,572 | **0.0045** |
| A000002 Kolakoski | 4 | 2,231 | 155,433 | **0.0144** |
| A000002 Kolakoski | 12 *(max)* | 20,083 | 466,322 | **0.0431** |
| A000040 primes | 1.25 | 117 | 18,798 | **0.0062** |
| A000040 primes | 12 | 10,782 | 180,459 | **0.0597** |
| A005132 Recamán | 1.25 | 128 | 18,390 | **0.0070** |
| A005132 Recamán | 12 | 11,791 | 176,516 | **0.0668** |

At the default stroke width, **changing the line join moves the measure by
about 0.5% of what shuffling the sequence moves it.** Even at the widest
stroke the app allows, it reaches only 4–7%. The ratio never approaches 1 for
any sequence or width tested.

The scaling behaves as the geometry predicts: joins are a fixed-radius effect
contributing O(w²) while the body of the stroke contributes O(w), so the ratio
should grow roughly linearly in width - and it does, about 12× across a 12×
width increase. Extrapolating that trend, shape would only start to compete
with the null at a stroke width somewhere around 280 pixels, which is not a
drawing, it's a colour field.

## What this means

Line shape is a **presentation choice, not an analytical one**. Pick whichever
looks best; it cannot manufacture or destroy structure that a null-model
comparison would detect. That is a genuinely useful thing to know, because the
opposite result would have meant every rendering in the app carried an
uncontrolled variable.

The same reasoning is why colour mode `none` exists: it removes the palette as
a variable so any structure still visible cannot be a palette artifact. Shape
turns out not to have needed that treatment. Colour, being what the eye
segments on first, still does.

## Scope, honestly

- Measured on the **turtle walk at angle 90°, mod 4**. That is one family of
  drawings. A visualizer that interpolates new geometry between points - a
  smoothed or spline-fitted curve rather than a polyline - is a different
  question, because it changes the path itself rather than only how the path
  is stroked. The polyarc curve already does something like this via its
  8-segments-per-term arc subdivision, and it has not been measured here.
- Swept area does not subtract self-overlap. The bias is identical in every
  arm of the comparison, so it does not affect the ratio, but the absolute
  numbers are additive area rather than covered area.
- Only the three canvas joins were tested, all with butt caps. Caps contribute
  a constant `w²` (square) or `πr²` (round) at the two path ends, which is
  negligible against thousands of segments and is not sequence-dependent at
  all.

Reproduce with `src/experiments/lineShape.ts`; the tests in
`tests/experiments/lineShape.test.ts` pin the determinism and the width
scaling.
