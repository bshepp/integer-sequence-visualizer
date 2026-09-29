# 3D view — SDD working record

**Run:** 2026-09-20. **Plan:** [`../../plans/2026-09-20-3d-view.md`](../../plans/2026-09-20-3d-view.md).
**Spec:** [`../../specs/2026-09-19-3d-view-design.md`](../../specs/2026-09-19-3d-view-design.md).
**Result:** merged to `master` as `8e8ca7f`, 746 tests, production bundle
byte-identical to before the branch.

This is the working record of the subagent-driven run that built the
developer-only 3D view: the controller ledger, the ten implementer reports,
and the final whole-branch fix report. It lived in
`.superpowers/sdd/2026-09-20-3d-view/`, which is gitignored scratch that the
process deletes once a run is clean. It was kept, and then moved here, on the
author's request.

[`../../build-log.md`](../../build-log.md) is the same artifact for the earlier
2026-08-05 run that built the visualizer itself, condensed to one file. That
one was condensed; this one is verbatim.

## What is here

| File | Was | What it is |
|---|---|---|
| `ledger.md` | `progress.md` | The controller ledger: the pre-flight conflict scan, every task completion with its commit range, each fix round, the deferred minors, and the sixteen rulings made without stopping to ask (three from the pre-flight conflict scan, thirteen during execution). The recovery map if a session had been lost. |
| `task-01-report.md` … `task-10-report.md` | `task-1-report.md` … | Each implementer subagent's own account of its task: what it built, what it tested, what it doubted. Zero-padded so they sort. |
| `final-fix-report.md` | unchanged | The fourteen findings from the final whole-branch review and how each was fixed, in one wave. |

## What was left behind, and how to get it back

**The 20 review packages (404K).** Each was a `git diff` over a commit
range that is still in `master`, so every one is reproducible exactly:

```bash
git diff -U10 <base>..<head>   # plus git log --oneline and --stat for the same range
```

All ranges were verified resolvable on 2026-09-29. Smallest first:

| Range | Size | Head commit |
|---|---|---|
| `2dba28a..0d31b7a` | 3K | test(3d): add termOf assertions to turtle and polyarc t... |
| `92888bf..7550364` | 3K | fix(3d): replace the DEV-guard regex with a brace-match... |
| `95c35b6..2dba28a` | 5K | feat(3d): geometry for the turtle, polyarc and digit walk |
| `b5f94bc..92888bf` | 5K | fix(3d): resize the ortho frustum, dispose the line mat... |
| `3cb0187..95c35b6` | 6K | feat(3d): lift a 2D path along z by index, with a canon... |
| `6a93778..e10fe17` | 6K | fix(3d): parseCssColor handles hex forms instead of sil... |
| `caf8f7e..1e0bd50` | 6K | fix(3d): drop an unmeasured OEIS generalisation, fix a ... |
| `7550364..f75e039` | 7K | feat(3d): view, sequence, term-count and lift controls |
| `f75e039..93558ad` | 7K | fix(3d): guard rebuild against out-of-order fetch resol... |
| `93558ad..6a93778` | 9K | feat(3d): colour by index, from the 2D hue ramp |
| `aab00d8..a19d287` | 9K | fix(3d): flag timer-paced bench rows in data, not just ... |
| `a19d287..caf8f7e` | 11K | docs(3d): the smoke check the test suite cannot do |
| `983e6af..0859081` | 13K | fix(3d): frame the camera on the union of the real and ... |
| `b6b6b4f..ae0e7f6` | 14K | feat(3d): pick a term by clicking a strand |
| `ae0e7f6..983e6af` | 15K | feat(3d): measured ceiling, and a warning that cites th... |
| `0859081..aab00d8` | 17K | feat(3d): load b-files so the route can reach the sizes... |
| `e10fe17..b6b6b4f` | 17K | feat(3d): the null model beside the real object, under ... |
| `0d31b7a..b5f94bc` | 18K | feat(3d): dev-only route with a three.js scene, fenced ... |
| `1e0bd50..2221313` | 70K | fix(3d): close six review gaps and fix six more in the ... |
| `acdf780..1e0bd50` | 165K | fix(3d): drop an unmeasured OEIS generalisation, fix a ... |

**The 9 task briefs.** Each was a verbatim extract of one task from the
plan, produced by the process's own `task-brief` script. Checked before
discarding: every sampled passage of `task-1-brief.md` appears word for word in
the plan. Regenerate from the plan rather than storing a second copy of it.

## Why keep any of it

The diffs and briefs are derivable; these files are not. The ledger records
decisions taken under time pressure with reasons attached, including the ones
that were wrong — an isolation test that passed against a deleted guard, twice;
a benchmark that hung because `requestAnimationFrame` never fires in a hidden
tab; a defect nearly filed against working code because synthetic pointer
events cannot call `setPointerCapture`. The reports record what each
implementer believed it had proven. Read together they say how the thing was
actually built, which no diff shows.
