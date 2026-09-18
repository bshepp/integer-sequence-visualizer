# Who found what

This project was built by Brian Sheppard with Claude, Anthropic's AI (the Fable
5, Sonnet 5 and Opus 5 models). Messages about it go out under Brian's name, so
this page says plainly which parts came from whom.

It was reconstructed by Claude from the working record of the project, a single
long session from 5 August to 15 September 2026, and checked against that record
quote by quote. Quotes are the words as typed, with spelling tidied. Dates are UTC, so a
late-evening message in the US can carry the next day's date. Where the
record does not say who did something, this page says so rather than guessing.

## The short version

**Brian** started it, and asked for the thing that makes it different: *"a
webpage that is live and can render, and has some of the missing rendering
techniques like a null model."* He brought the SeqFan thread that inspired it.
He chose where to look, noticed several things that turned out to be wrong, and
asked the questions that changed results. He made every call about what to
publish, how to credit people, and when something was not yet trustworthy.

**Claude** wrote nearly all of the code. It designed the statistics and the three
null models, did the measuring and the mathematics, and wrote most of the prose,
including the site copy and the drafts of messages to the list. It also got a
number of things wrong first; they are listed below.

---

## Findings reported to SeqFan

### Joshua Weinstein's rule, tested on Fibonacci

- **The rule** is Joshua Weinstein's, posted to the SeqFan thread on 13 August:
  if the residues are periodic, the figure's fold count is 360/gcd(S, 360), and
  when S is a whole number of turns it repeats as a chain instead.
- **The test** is Claude's. On 31 August Brian asked for intricate sequences
  worth showing, *"maybe there are some obvious known targets?"* Claude proposed
  Fibonacci mod 36 and mod 360 and worked out the shapes from the arithmetic
  before drawing them: ten-fold, and a chain. Both came out as predicted. Brian
  chose to make mod 36 a worked example on the site.
- **A mistake in the credit.** Claude reached the same rule without having read
  Joshua's message, and presented it as the project's own through three drafts
  of the reply. It found his message on 15 September, re-reading the whole
  thread before sending, and corrected the site and the draft.

### Four of Bill McEachen's named curves have repeating residues

- **The question** was Brian's, on 3 September. He asked for sequences from the
  NCurve thread shown beside their nulls, *"possibly ones where random
  re-arrangement is meaningful."*
- **The method and the finding** are Claude's. It measured how often a residue
  mod 360 matches the residue one period later, against the same sequence
  shuffled:

  | curve | real | shuffled |
  |---|---|---|
  | zipper | 1.000 | 0.054 |
  | saw blade | 0.982 | 0.180 |
  | Sloane's | 0.974 | 0.103 |
  | propeller | 0.962 | 0.122 |

  Claude also noticed that the zipper is Joshua's chain case. Bill's other two
  named curves do not qualify.

### Jean-Paul Allouche's A006694 and A081844

All of this is Claude's, done on 15 September in answer to Jean-Paul's
postscript of 28 August asking for parameters that make these sequences draw
something nice. Brian has not checked the mathematics, and neither has anyone
else yet.

- **Only mod 2 repeats.** Of moduli 2 to 360, over the first 600 terms of
  A006694, only 2 gives periodic residues: even, odd, odd, even, repeating. Over
  all 10,001 terms of the b-file there is no exception. a(n) is even exactly
  when 2n+1 ≡ ±1 (mod 8). A081844 = A006694 + 1 has the opposite parity.
- **Why, probably.** Claude's derivation: x^m − 1 has discriminant ±m^m, and
  Swan's 1962 form of Stickelberger's theorem then makes the number of
  irreducible factors over GF(2) odd exactly when m ≡ ±1 (mod 8). That matches
  every term checked, but it is Claude's reasoning and has not been confirmed by
  a mathematician. It may well already be in the literature, including
  Allouche, Stipulanti and Yao's 2026 *Mathematical Intelligencer* paper, which
  Claude could not access.
- **Why NCurve finds nothing.** NCurve's turning angle is a(n) mod b + c, so at
  b = 2 consecutive arcs differ by one degree. The figure closes, but its radius
  varies by 0.4%: a circle.
- **What does work.** With a multiplier, k·(a(n) mod 2) + c, one period turns
  2k + 4c degrees. k = 120, c = −42 turns 72 degrees per period and closes
  five-fold after exactly 20 terms. k = 100, c = −40 closes nine-fold after 36.
  This holds for both sequences. A shuffle keeps the total turn but does not
  close.
  [Open the five-fold figure beside a shuffle.](https://ulam.briansheppard.com/#seq=A006694&viz=polyarc&angle=120&modulus=2&offset=-42&null=side)

---

## Other findings

| Finding | Who raised it | Who worked it out |
|---|---|---|
| **A000464's pentagram is half sequence, half protractor** ([write-up](pentagram-answer.md)) | Brian, 9 August, noticing it drew a pentagram in both the real and the null panel: *"find out if the pentagram in A000464 is real"* | Claude |
| **Line shape cannot manufacture structure** ([write-up](line-shape-answer.md)) | Brian, 7 August, while asking for render controls: *"would line shape make a difference?"* | Claude, who turned it into a measurement of swept area against shuffling |
| **Kolakoski's longest run never exceeds 2** | Brian, 6 August: *"there is a spiral in A000002 … I can only see it when I animate it"* | Claude. Its first claim, that adjacent terms differ about two-thirds of the time, was retracted on 13 August: every step-preserving surrogate returns the same value, so it could not fail. The run length replaced it |
| **The primes picture is a picture of prime gaps** | The polyarc settings first appear in the record in a link Brian sent on 13 August | Claude devised the residue-step statistic and found that reordering the gaps reproduces it exactly |
| **That separation widens with more terms** | Claude predicted the comparison would weaken with more terms. Brian told it to measure at 10,000 | Claude. The prediction was wrong: 5.0% at 58 terms, 11.2% at 10,000, against about 50% shuffled |
| **a(n) = n: real structure that distinguishes nothing** | A screenshot Brian added on 6 August | Claude read it as the fingerprint of a roughly linear sequence and built the example. Whether the screenshot was exactly that is not recorded |
| **The parameter sweep** | Claude proposed it on 5 August, from Bill's remark that he had iterated no parameters. Brian chose to include it | Claude. Brian pressed on 31 August for Bill to be credited for what the remark actually was |

## The null models

- **The null-model layer** was Brian's idea (the first message, quoted above).
- **The concrete surrogates** were Claude's proposal: a shuffle, a matched
  random sequence, and ensemble bands. Brian chose "all of the above".
- **The ladder** of three nulls came from Brian's objection on 13 August: *"I
  certainly don't want them to get to the site and be like 'of course there is
  no pattern if the sequence is randomized'."* Claude found that 9 of the 16
  bundled sequences simply increase, which makes a shuffle nearly useless
  against them. Three of four verdicts changed.
- **The name.** Brian asked whether this kind of measurement *"already exists
  and has a name."* Claude identified it as surrogate-data testing (Theiler et
  al., 1992) and ordered the nulls into a ladder.
- **The language audit** came from Brian's framing, the same day: *"the null
  model removes a specific, very real and mathematically identifiable structure,
  doesn't it?"*

## The renderer: things Brian saw that were wrong

| Brian noticed | What it turned out to be |
|---|---|
| 13 August: *"I'm seeing a lot of geometric shapes at smaller scales rather than smooth curves. Is that accurate?"* | It was not. Every polygon and star was a coil drawn with too few samples. |
| *"It looks like it's still having aliasing issues."* | Claude had diagnosed it and not fixed it. The fix, drawing each term as a true arc instead of chords, showed the old picture had been a different shape, not a rougher version of the same one. |
| *"Why is the blue dot at the wrong end of the line?"* | Claude first said it wasn't, then found a real off-by-one present in all three path views. |
| 31 August: *"Is there any difference between a randomized sequence representation and one that is optimized? Aren't we going to see optimization structures?"* | Yes. A drawing shortcut straightened 67% of the null panel's arcs but 47% of the real panel's. Claude measured it as visually harmless and recommended removing it anyway. Brian decided: *"I would rather be slow or unnoticed than embarrassingly wrong."* ([details](measurement-log.md)) |
| The render-time warnings firing on the statistics views | Claude's cost warnings ignored which view was selected. They now scale with it. |

## Where Claude was wrong

Collected here because most of these were stated confidently first.

- **The first headline verdict for the landing-page example** (7 August). Its own
  test caught it.
- **The Kolakoski switch rate**, as above.
- **That a new "gap-resampling" null was needed.** The existing step surrogate
  already was one.
- **That the page froze for seconds on large loads.** It was a browser-extension
  artefact.
- **That removing the drawing shortcut would cost about 20%.** It costs 35–50%.
  A later run appearing to show a speed-up was drift between sessions.
- **That the prime comparison would weaken at 10,000 terms.**
- **7.7% for a value that rounds to 7.6%**, from rounding twice.
- **A000464's verdict**, changed from "split" to "untestable".
- **Presenting Joshua Weinstein's rule as the project's own**, as above.
- **Writing its own mistakes into a draft in Brian's voice.** A draft of the
  SeqFan reply said "three predictions of mine that the measurements refuted".
  The predictions were Claude's.

## What Brian decided

- To build it at all, with a null model, live on the web.
- That OEIS attribution had to be in place before anything was deployed.
- To stop the drawing shortcut, at a real cost in speed.
- To lead the reply with George Whale, whose thread and question it is. To credit
  Bill McEachen's remark for what it was. To keep the message to the list short.
- That this page should exist.

---

The code is MIT-licensed and every measurement above is recomputed by a test in
this repository. The record this page was reconstructed from is a private working
session and is not published. The [measurement log](measurement-log.md) has the
numbers behind the renderer entries.
