# [SeqFan] A new visualization tool for OEIS sequences

**Thread archive** — SeqFan mailing list (`seqfan@googlegroups.com`)
**Span:** 1 Aug 2026 – 5 Aug 2026 · 7 messages
**Participants:** George Whale (`propatriauk@gmail.com`), Bill McEachen (`bill.mceachen@gmail.com`), Jean-Paul Allouche (`jpallouche.math@gmail.com`)
**Thread permalink:** https://groups.google.com/d/topic/seqfan/vGfMma6DkDk

Quoted reply-chains have been stripped; each entry contains only its new content.

---

## 1 · George Whale — Sat 1 Aug 2026, 18:03 EDT

> Hello all, I've just joined SeqFan, and thought I'd introduce myself.
>
> Let me confess first of all that I'm not a mathematician — my background's in art/design and software development.
>
> A while back, I began developing an app to visualize character / number sequences as line drawings. I was using production (string rewrite) systems to generate sequences, but the results were mostly uninteresting due, I think, to limited variety in the output. Then I discovered OEIS!
>
> The new version of the app (developed with my capable assistant, Claude.ai) transforms OEIS sequences into polyarc curve drawings. Some are chaotic-looking, others surprisingly structured — begging the question: do such visualizations tell us, at a glance, anything useful or significant about the structure and character of the underlying sequences?
>
> The (free) app is called NCurve, and you can try it out here:
> https://openprocessing.org/@GeorgeWhaleResearch/2986029
> (Hint: press the 'New sequence' button repeatedly to search for interesting forms.)
>
> Feedback (positive and negative!) welcome.
>
> George Whale.

---

## 2 · Bill McEachen — Mon 3 Aug 2026, 11:34 UTC

> After fiddling with it a bit, my favorite so far is one added by Dr Sloane:

*Attachment: `NCurve_A019488.png`*

---

## 3 · George Whale — Mon 3 Aug 2026, 11:51 UTC

> That's a nice one. I might add a gallery of favourites alongside the app, if I can find a way to do it.

---

## 4 · George Whale — Tue 4 Aug 2026, 19:41 UTC

> Hi Bill
>
> I now have a small gallery, including your find:
> https://openprocessing.org/@GeorgeWhaleResearch/2986585
>
> Best
>
> George

---

## 5 · Bill McEachen — Tue 4 Aug 2026, 21:37 UTC

> Dr Whale:
>
> Only becuase you wrote again, I attach other images I had found interesting (eye of the beholder) and saved off the other day.
>
> **Your gallery is great.**
>
> I cannot imagine the visualizations wouldn't provide useful insight in many cases.
>
> I give "names" to most of them, and as you can see I iterated no parameters.

| Sequence | Bill's name | OEIS |
|---|---|---|
| A000376 | French curve | https://oeis.org/A000376 |
| A000464 | pie crust | https://oeis.org/A000464 |
| A000828 | propeller | https://oeis.org/A000828 |
| A001051 | tire | https://oeis.org/A001051 |
| A001553 | saw blade | https://oeis.org/A001553 |
| A001571 | ?? | https://oeis.org/A001571 |
| A001603 | ?? | https://oeis.org/A001603 |
| A019488 | *(Sloane's, from msg 2)* | https://oeis.org/A019488 |
| A039188 | record disc | https://oeis.org/A039188 |
| A039685 | zipper | https://oeis.org/A039685 |
| A039970 | Slinky | https://oeis.org/A039970 |

*Attachments: 11 × `NCurve_A******.png`*

---

## 6 · George Whale — Tue 4 Aug 2026, 21:57 UTC

> Thanks, these will help expand the library. I like your idea of giving them concise names, but with nearly 400,000 sequences in the OEIS, and the average vocabulary only around 25,000 words, it could become challenging!
>
> Best
>
> George W.

---

## 7 · Jean-Paul Allouche — Wed 5 Aug 2026, 05:44 UTC

> Hi
>
> For similar ideas and pictures in more ancient papers (in the 1980's), please see
>
> F. M. Dekking, M. Mendès France, *Uniform distribution modulo one: a geometrical viewpoint*, J. Reine Angew. Math. **329** (1981), 143–153. [cf. pp. 149 and 151]
>
> J.-M. Deshouillers, *Geometric aspect of Weyl sums*, in Elementary and Analytic Theory of Numbers (Warsaw, 1982), Banach Center Publ., **17**, PWN, Warsaw, 1985, pp. 75–82.
> [available at https://bibliotekanauki.pl/articles/721340.pdf — similar pictures in all pages but the first]
>
> Actually I did not have the time to check whether these two references are somewhere in the OEIS, may be they are not.
>
> best wishes
> jean-paul

---

## 8 · George Whale — Wed 5 Aug 2026, 06:37 UTC

> Bonjour Jean-Paul
>
> Thank you so much for these references (from the 1980s!). I've been thinking of writing a short paper, and these will certainly help contextualise my efforts.
>
> Best regards
>
> George W.

---

## Open threads worth picking up

1. **George's question is unanswered.** *"Do such visualizations tell us, at a glance, anything useful or significant about the structure and character of the underlying sequences?"* Bill's reply — "I cannot imagine the visualizations wouldn't provide useful insight" — is an intuition, not evidence. Nobody has proposed a way to test it.
2. **Bill iterated no parameters.** He says so explicitly. Every image in the thread is a single point in a parameter space nobody has swept.
3. **Naming doesn't scale and shouldn't.** George is right about 400k sequences vs. 25k words. The useful object is a *feature vector*, not a name — then names fall out of clustering rather than being assigned by hand.
4. **Allouche has handed over the citation lineage.** Dekking–Mendès France (1981) and Deshouillers (1985) are the mathematical grounding for exactly this class of picture. Neither appears to be linked from the relevant OEIS entries — an easy, real contribution.
5. **George wants to write a short paper.** There's an opening to collaborate rather than compete.
