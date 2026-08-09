# Is the A000464 pentagram real?

A000464 (expansion of e.g.f. `sin(x)/cos(2x)`) drawn as a turtle walk at
73 degrees, mod 4, produces a clean five-pointed star. The site's own question
applies to the site's own output, so it got measured rather than admired.

**Short answer: the closed figure is real, the five points are not.**

Measured by `src/experiments/pentagram.ts`, pinned by
`tests/experiments/pentagram.test.ts`, 30 terms, 200 permutation surrogates.

## What the sequence contributes

The residues `a(n) mod 4` alternate `1, 3, 1, 3, ...` without a single
exception across all 216 terms of the b-file. That is a genuine arithmetic
property, and it is the entire reason the walk closes into a regular figure
instead of wandering: every pair of terms turns by the same amount, so the
walk is a rotation repeated.

| | lag-1 autocorrelation of residues |
|---|---|
| A000464 | **-0.967** (the floor for 30 terms) |
| permutation null, 95% band | -0.367 to +0.367 |
| permutation null, mean | -0.035 |
| p | **0 of 200** |

No shuffle of the same terms comes near it. This half survives the null model
outright.

## What the angle contributes

A pair of terms turns `(1 + 3) x 73 = 292` degrees, and 292 is close to
`288 = 4 x 360/5`. That near miss is the whole reason the figure has five
points. The sequence has no say in it:

| angle | pair turn | figure | drift per circuit |
|---|---|---|---|
| 30 deg | 120 | 3-fold | 0 |
| 45 deg | 180 | 2-fold (a line) | 0 |
| 60 deg | 240 | 3-fold | 0 |
| **73 deg** | **292** | **5-fold** | **20 deg** |
| 90 deg | 0 | degenerate | 0 |
| 100 deg | 40 | 9-fold | 0 |

Feed the same perfect alternation a different angle and the point count
follows the angle. "Pentagram" is a fact about 73 degrees; "closed regular
figure" is the fact about A000464.

## The star is a short-run picture

73 degrees does not close exactly: `5 x 292 = 1460 = 20 (mod 360)`, so every
circuit lands 20 degrees on from the last. Over the 15 terms the site loads by
default that reads as a clean star. Over the full 216-term b-file the same walk
precesses through a full turn and fills in a rosette.

| terms | 5-fold concentration of the figure's vertices |
|---|---|
| 15 | 0.77 |
| 400 | < 0.2 |

This is the one place where the site's usual advice inverts: this figure looks
cleaner with *fewer* terms.

## Why the null sometimes draws a star too

This was the observation that started the investigation: at some seeds the
permutation surrogate draws a pentagram of its own, which looks like the null
model failing. It is not. It is the sample size.

At the 15 terms the site loads by default, the shuffle is arranging 8 ones and
7 threes, and a fair number of those arrangements come out near-alternating by
luck. Over 2000 seeds:

| terms | shuffles reading as a star (alternation < -0.5) | strongly (< -0.8) |
|---|---|---|
| 15 | **5.3%** | 0.3% |
| 30 | 0.4% | 0.0% |

So about one seed in twenty produces a null that looks like the real thing, and
pressing Reshuffle a few times will find one. Two fixes, both of which the site
already offers: load more terms, which drops the coincidence rate by an order
of magnitude, or use Sweep, which is the whole point of having an ensemble
rather than a single draw.

This is a compact demonstration of the site's own thesis turned on itself. A
single surrogate is one sample, and eyeballing one comparison is not a test.

## The honest negative

The obvious statistic does not work, and it is worth recording why.

"Does the walk stick to five compass directions?" scores the real sequence no
better than its own null band, and here slightly worse:

| | 5-fold direction concentration |
|---|---|
| A000464 | 0.190 |
| permutation null, 95% band | 0.087 to 0.289 |
| permutation null, mean | 0.184 |

A shuffle wanders, but it wanders in clumps, and lands on a similar spread of
directions. The real walk covers that same spread in strict rotational order.
The eye is reading the *order*, not the spread, so a statistic that scores only
the spread finds nothing at all.

Had this been the only statistic tried, the honest report would have been
"the pentagram does not survive its null model" - which is false. It is a good
reminder that a null model tests a specific statistic, not a picture, and that
choosing the statistic is where the judgement lives.
