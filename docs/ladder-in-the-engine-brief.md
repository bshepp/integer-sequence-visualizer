# Wiring the ladder into the engine: what it will actually take

A design brief, not a decision. Written to make one conversation efficient,
because the options below differ in scope by about a factor of five and the
choice between them is not mine to make.

Status: nothing here is implemented. `src/nullmodel/ladder.ts` is built and
tested and still imported only by tests.

## The blocker is not the one I named

I have been describing the remaining work as "wire `ladder.ts` into the
engine", as though the ladder were a display layer waiting for a socket. It
is not. Four of the nine visualizers implement `statistics()`:

| has `statistics()` | does not |
|---|---|
| autocorr, differences, histogram, scatter | **turtle, polyarc, ulam, modgrid, digitwalk** |

Everything in the right-hand column is a trajectory or grid view, and the
right-hand column is the entire subject matter of this project. The engine
gates ensemble mode on `Boolean(viz.statistics)` (`app.ts:215`), so on those
five views Sweep is simply disabled.

Concretely, today:

- **The hero cannot be tested in the engine.** It is a polyarc. A visitor
  clicks the landing image, lands in the engine, and the button About calls
  "the version that settles it" is greyed out.
- **The view the site is named after cannot be tested.** The Ulam spiral has
  no `statistics()`.
- **None of the six SeqFan thread entries can be tested.** All six are
  polyarc. The landing copy invites the reader to put a null model beside
  them - "so you can be the first" - and the engine will not let them.

## The part that should have been caught sooner

Sort all seventeen entries by whether their view supports ensembles:

| | verdicts carried |
|---|---|
| views **with** `statistics()` | `open`, `open`, `open` - nothing measured |
| views **without** | `survives-steps`, `survives-steps`, `untestable`, `untestable`, `foregone` |

Every entry that makes a measured claim sits on a view the engine cannot
measure. Every entry on a view the engine *can* measure carries no claim.

The verdicts are not wrong - they are computed by `src/examples/statistics.ts`
and recomputed in CI, which is why they survived the audits. But they are
computed by code the engine never runs. The gallery and the engine are two
separate measuring instruments that happen to agree, and only one of them is
the thing a visitor can point at their own sequence.

## Why there are two systems

They have incompatible shapes, which is how they drifted apart without
anyone noticing:

    viz.statistics(seq, params)  ->  Record<string, number[]>   per-index curves
    examples/statistics.ts       ->  number                     one scalar

The array form exists to draw confidence bands along a chart - a band at each
lag, each bucket, each index. The ladder compares one number against a band,
three times. `RungReading` is scalar. The two never meet, so the engine grew
band charts and the gallery grew verdicts, and neither can read the other.

## Options

**A. Scalar statistics on the Visualizer interface.** Add an optional
`scalarStats(seq, params): Record<string, number>` alongside `statistics()`,
implement it for all nine views (reusing `examples/statistics.ts` where the
function already exists), and build the ladder panel on it. Every view becomes
testable, and a worked example's verdict becomes reproducible live in the UI
the visitor is looking at. Largest job; it is the only one that closes the gap
above.

**B. Ladder only where `statistics()` already exists.** Cheapest. Ships the
ladder on autocorr, differences, histogram and scatter - and on none of the
views this project is about. It would make the engine's most rigorous feature
unavailable on its own front page.

**C. A separate ladder panel, scalar-only.** Same per-view scalar statistics
as A, but sitting beside the band machinery rather than inside it. Avoids
touching the ensemble/bands path, at the cost of two parallel systems again -
which is the thing that caused this.

**Recommendation: A.** B is not worth building. C differs from A only in
whether the new statistics are reachable through the existing interface, and
the argument for the interface is that a fifth parallel measuring system is
how we got here. A is the one that makes the gallery and the engine the same
instrument.

Cost to be aware of: the ladder needs three ensembles where the engine now
runs one, so 600 surrogate draws at the current default of 200. The worker
already exists, and `polyarcPath` at 58 terms is cheap, but a 10,000-term
b-file would not be.

## A defect to fix on the way, not after

`foregone()` decides a comparison was settled in advance by checking whether the
terms are monotone. That is right for a turtle walk on the raw values and wrong
for every view that reduces mod b, because those never see the terms - the
polyarc and the mod-N grid consume `a(n) mod b`, and monotone terms imply
nothing whatever about their residues.

The counterexample is already on the site. `fibonacci-rosette` has strictly
increasing terms, so `foregone()` returns true and would label it vacuous. Its
permutation null keeps every residue *and their sum*, so both walks finish
pointing the same way and only the arrangement is destroyed - which makes it the
least vacuous comparison in the gallery, and the one this function is most
confident about dismissing.

So the check has to ask what the statistic consumes rather than what the sequence
looks like, which means it needs the view's modulus passed in. Worth doing before
the wiring rather than after: shipping a vacuity warning that fires hardest on
the best example would be worse than shipping no warning.

## Your question about the name

You asked whether the vacuity measure is something that already exists and has
a standard name, and whether it can be continuous rather than binary. It is,
and it can:

- The framework is **surrogate data testing**, and the ordering of nulls by
  how much structure each preserves is the **hierarchy of constrained
  realizations** (Theiler et al., 1992). That is what `RUNGS` is.
- The continuous quantity is a **skill score** (Murphy, 1988): the observed
  effect measured against what a reference that already contains the boring
  explanation achieves. It is implemented, as `explainedByStricter()` -
  `(strict.median - weak.median) / (weak.measured - weak.median)`, clamped to
  [0, 1]. 1 means the stricter null lands exactly where the real sequence
  does, so the whole result was the structure that null preserves. 0 means the
  finding is the sequence's own.
- The degenerate end already has a name here too: zero band width is
  `no-power`, a null with nothing to test.

So the "vacuity scale" you asked for is a skill score, it is continuous, and
the arithmetic is written and tested. What is missing is computing it live and
finding it a home on screen.

One consequence worth taking: `foregone()` is still a binary monotone check,
and the continuous version of exactly that question - how much of a
permutation null's rejection is attributable to the sequence merely
increasing - is the skill score of the difference null against the permutation
null. If A gets built, the binary flag can retire in favour of the number, and
the answer to "of course it falls apart when you shuffle it" stops being a
warning label and becomes a measurement.

## What I did not do, and why

I did not implement any of this. You asked to talk about the vacuity
diagnostic before it got built, the options above range from a day to a week,
and A changes a public interface. Waking up to the wrong one of those three
would be worse than waking up to none.
