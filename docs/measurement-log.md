# Measurement log

Things this project believed, measured, and in several cases had to stop
believing. Kept because the site's claim is that measuring beats looking, and
that claim is worth very little if it is not applied to the site itself.

Each entry is a question, what was measured, and what changed as a result. The
wrong answers are here on purpose: most of them were confidently held first.

---

## Copy: "survives" meant two opposite things at once

**Found while:** auditing the site's language (issue #4).

Two usages were live at the same time, in copy a reader met in one session:

| where | meaning |
|---|---|
| "the pattern survives the shuffle" — About, scatter, spiral, digit walk | still there after scrambling, so the *technique* drew it: boring |
| "survives the null" — `VERDICT_LABEL`, `survives-steps`, `highestSurviving` | the null did *not* reproduce it, so the finding stands: interesting |

Someone who learned the first sense from a visualizer's info popover would read
"Survives every null" on the Kolakoski card as exactly its opposite. The second
sense is the one the code speaks and the one the surrogate literature uses, so
the four prose sites of the first were rewritten. `tests/ui/copy.test.ts` bans
the losing sense across `src/`.

Also from that audit: "every null" became "all three nulls" wherever a result is
claimed, because three were run and the phrase invited "every null there could
be", which is infinitely many.

---

## Rendering: are the two panels drawn under the same rules?

**Asked as:** "is there any difference between a randomized sequence
representation and one that is optimized? aren't we going to see optimization
structures?"

The best question of the session, and the setup was exactly the kind that hides
the answer. Each panel is fitted to its own bounding box, so the two draw at
different scales, so a threshold expressed in device pixels fires at different
rates on each. At the hero's settings and its own 58 terms:

| panel | segments culled to straight lines |
|---|---|
| real | 46.6% |
| permutation null | 67.2% |

The null was having two-thirds of its arcs straightened while the real sequence
kept more than half of its own.

**Measured:** worst culled-arc error — real 0.329px, permutation 0.341,
difference 0.344, matched 0.279, all inside the 0.35px threshold. Rendering with
and without moved 97% of affected pixels by under 32/255 of a channel, changed
total ink by 0.2%, and put one pixel in the real panel and eleven in the null
past a delta of 128, out of 435,500.

So it was harmless. **It was removed anyway.** The argument for it was about
perception and the argument against it is about trust: this site asks people to
believe a side-by-side, and should not answer that with a tolerance that fires
more often on one side than the other.

Cost, from a controlled A/B (one loop, one dataset, the cull as the only
variable): **+35% at 10,000 terms, +50% at 2,000**. `deviceScaleOf` left with
it — it existed only to express the threshold in device pixels, which was itself
a fix for the cull misbehaving under zoom. A whole class of bug left with the
feature.

A second asymmetry turned up on the way and is *not* fixable by the same move:
the panels are sampled at different densities (96 samples/term for the real
primes against 99 and 94 for the difference and matched nulls, because
`segmentsFor` reads the sharpest turn and those surrogates hold different
values). It is harmless only because `polyarcPath` integrates each term as an
arc, so samples land on the true curve and density is a rendering choice rather
than a geometric one. Without that property, removing the cull would have fixed
one asymmetry and left a worse one. `tests/viz/panelParity.test.ts` pins both,
including the premise that the rates differ at all.

---

## Performance: what actually costs anything

**Asked as:** "can we do testing to see when things start to get very slow?"

Every view at its default parameters, one panel, 20,000 terms:

| view | family | ms |
|---|---|---|
| histogram | stats | 5 |
| autocorr | stats | 7 |
| differences | basic | 23 |
| modgrid | grid | 23 |
| scatter | basic | 28 |
| ulam | grid | 28 |
| turtle | trajectory | 53 |
| digitwalk | trajectory | 337 |
| polyarc | trajectory | 532 |
| **polyarc at the hero's settings** | trajectory | **2,153** |

The conclusion that mattered: **cost is driven by parameters, not by the view.**
The same polyarc is 532ms or 2.2s depending on its modulus, because a sharply
bending term needs dozens of arc samples where a gentle one needs eight. Every
other family is free at any term count worth loading.

### Three wrong numbers on the way to that

1. **"The b-file load locks the tab for several seconds."** It does not.
   Profiling the real pipeline: fetch 0.8s cold, parse 5ms, surrogate 0ms, two
   renders ~1s — under two seconds total, and only two render calls. The
   30-second stalls were a browser-extension artifact, not the page.
2. **"Removing the cull costs about 20%."** From a 500-term sample. At real
   sizes it is 35–50%.
3. **"Removing the cull made it *faster*."** A later run appeared to show a 60%
   speedup. That was drift between measuring sessions. The final number holds
   both arms in a single run, which is the only reason it can be trusted.

---

## The hero: does more data make a better picture?

**Asked as:** "we can do a full b-file render and post the image for that. Am I
wrong?"

`entries.ts` had asserted in a comment for weeks that more primes do not improve
the hero. Nobody had checked. It is right, and understated:

| primes | what it looks like | draw time |
|---|---|---|
| 58 | two spirals and a sweep, filling the frame | 10ms |
| 500 | fragmented into a chain of small coils | 82ms |
| 2,000 | a messy chain | 361ms |
| 10,000 | a tangled clump using a third of the frame | 1,222ms |

The mechanism is the same one behind the culling asymmetry: the path is fitted
to its own bounding box, so a longer walk means a bigger box, a smaller scale,
and smaller coils. **The picture loses detail as terms are added, not gains it.**

Also measured, because the proposal was about saving work: the entire landing
page — hero plus all 16 thumbnails — paints in **32ms**. There was no cost to
save. The hero stays a live render, which is also what keeps it matching the
view it links to.

This became a feature rather than a note: the landing page now redraws the hero
at 58 / 500 / 2,000 / 10,000 in one click, and clicking the image opens the
engine at whatever count is on screen.

---

## The statistic: does the comparison weaken with more terms?

**Predicted:** yes. At 10,000 primes both panels look like the same tangle, so
the striking difference at 58 terms looked like a small-*n* effect.

**Wrong. It strengthens.** `residueStep`, mod 187, 200 surrogates:

| terms | real | permutation | matched | difference |
|---|---|---|---|---|
| 58 | 5.0% | 42.1–55.6% rejects | 7.2–9.9% rejects | no power |
| 500 | 7.6% | 47.6–52.6% rejects | 44.1–49.2% rejects | no power |
| 2,000 | 9.3% | 48.8–51.2% rejects | 46.8–49.5% rejects | no power |
| 10,000 | 11.2% | 49.4–50.5% rejects | 47.9–49.1% rejects | no power |

The real figure climbs because prime gaps grow with size; a shuffle sits near
half the dial throughout. So the measured separation widens exactly as the
picture becomes unreadable — **the eye loses the structure at 10,000 and the
statistic does not.** That is the entry's whole subject, arrived at by being
wrong about it first.

The difference null has no power at any count, because `residueStep` is a
function of the multiset of steps and that null preserves it exactly. So the
`untestable` verdict holds whichever count a visitor picks, which is what made
it safe to write copy covering all four.

### A rounding mistake worth keeping

The copy first said 7.7% for 500 terms. The value is 7.6495%, which rounds to
**7.6**. The measurement had printed `7.650%` at three decimals and that got
rounded a second time — each step correct, composing to a wrong answer, because
the second step saw a `5` the first step manufactured. Round once, from the
original. `tests/examples/heroCounts.test.ts` now rounds the way the sentence is
read rather than allowing a tolerance; `toBeCloseTo(_, 1)` would have passed
7.6495 as "7.7" by five ten-thousandths.

---

## History: leaving a page left no way back

**Reported as:** engine → Worked examples → click an example → Back, and Back
went to the previous drawing rather than to the gallery.

`goTo()` reaches the reserved pages by assigning `location.hash`, which pushes a
history entry. `openEntry()` then wrote over that entry with `replaceState`, so
the gallery left no trace in history at all. On a first visit it was worse:
clicking the hero replaced the entry for `/`, so Back left the site.

One line. Every route out of the landing and the About page goes through
`openEntry`. `syncUrl()` keeps `replaceState`, correctly — a parameter tweak is
not somewhere you should have to press Back to escape.

---

## Standing lessons

- **Measure in one run.** Two of the wrong numbers above came from comparing
  across sessions or across canvas sizes. A controlled A/B is not a formality.
- **Never round a rounded number**, and format for display last.
- **A test that passes before the fix is worth nothing.** The history fix was
  checked by reinstating the bug and watching the test fail.
- **`tsc` and `vitest` disagree.** Vitest does not typecheck; `npm run build`
  runs `tsc --noEmit` first and has caught stale types three times now,
  including in this session's own test files.
- **A comment asserting a fact is not the same as the fact.** Two long-standing
  comments in `entries.ts` turned out to be true when finally checked. The next
  one might not be.
