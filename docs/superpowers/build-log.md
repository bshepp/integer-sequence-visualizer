# SDD ledger — plan: docs/superpowers/plans/2026-08-05-oeis-visualizer.md

Models: Sonnet implements Tasks 1-14, 17, 19; Fable implements Tasks 15, 16, 18; Fable reviews all tasks (user-approved).
Branch: master (user: "there is no main"). Remote: github.com/bshepp/integer-sequence-visualizer (private).
Pre-flight conflict scan: clean (plan self-reviewed at write time; no task contradicts Global Constraints).
Task 1: minor (deferred): package.json npm-init boilerplate (main/directories/description; missing "private": true)
Task 1: minor (deferred): vitest triple-slash reference deprecated form; vite.config.ts outside tsconfig include
Task 1: complete (commits 0024803..aa1e814, review clean)
Task 2: fix round 1/5 (1 addressed, 0 open — digits() base<2/non-integer guard; commits b979ee8..c75c15c)
Task 2: minor (deferred): mod(i, n<=0) violates [0,n) contract (negative n) / native RangeError (n=0) — sequence.ts mod
Task 2: minor (deferred): coverage gaps from brief suite (mod with >float64 term, digits of huge value, logMagnitude long mantissa)
Task 2: complete (commits aa1e814..c75c15c, review clean after round 1)
Task 3: minor (deferred): trailing "..." in pasted text rejected (UX polish); b-file-format paste silently interleaves indices+values (forward note)
Task 3: minor (deferred): untested supported separators (semicolons, parens, explicit +, trailing comma)
Task 3: complete (commits c75c15c..c4c91e1, review clean)
Task 4: fix round 1/5 (1 addressed, 0 open — unary minus now binds looser than ^, plan-code deviation noted: plan reference code had -2^2==4; commits 895c7d3..c9bdc5e)
Task 4: minor (deferred): unpinned behaviors (mod-by-zero msg, exponent-too-large, arity, trailing garbage); sequenceFromFormula count/start hygiene; ^1e6 compute-budget note for UI
Task 4: complete (commits c4c91e1..c9bdc5e, review clean after round 1)
Task 5: minor (deferred): BigInt('') silent 0n on malformed data string; offset parseInt NaN unguarded; results-type unchecked ({results:42} raw TypeError); search() URL unasserted; redundant Object.assign in test fake
Task 5: complete (commits c9bdc5e..c310b7b, review clean)
Task 6: minor (deferred): parseBFile cap<=0 returns one term; withTerms aliases caller's array; "types":["node"] disables future @types auto-inclusion (comment suggested)
Task 6: complete (commits c310b7b..6fc9e6e, review clean)
Task 7: minor (deferred): matched-random dead residual store + vestigial let decls; brief-prose vs code MSE-normalization discrepancy; percentileBands([[],[]]) silent empty; exp branch + negative-input coverage gaps; NaN comparator
Task 7: complete (commits 6fc9e6e..1986fa2, review clean)
Task 8: minor (deferred): fakeCtx gradient sub-calls unrecorded; unused args param; accidentally-thenable Proxy (property reads return functions — flagged for viz tasks)
Task 8: complete (commits 1986fa2..3d3ffa3, review clean)
Task 9: minor (deferred): registered-flag vs clearRegistry latent footgun (all.ts); clampBig duplication (shared helper suggested); Math.min(...vals) spread RangeError risk at ~65k+ terms (raised b-file caps); scatter stats-vs-render sign-fold divergence (documented in code)
Task 9: complete (commits 3d3ffa3..9035d5f, review clean)
Task 10: minor (deferred): computeHistogram([]) NaN edges (unreachable via viz); [0] sentinel phantom count; autocorr lineWidth 1.5 leak on shared ctx; gaps/digits/leading render paths + negative-term digit tests uncovered. (Reviewer ⚠️ digits-on-negatives resolved by controller: Task 2 digits() uses |term|, MSB-first — confirmed.)
Task 10: complete (commits 9035d5f..34b6803, review clean)
Task 11: minor (deferred): O(n^2) spiralCoord mapping (O(n) generator suggested if sliders feel slow); parity off-color equals panel bg (intentional aesthetic — verify visually in Task 15); modGrid lightness varies with residue vs prose (code authoritative); fractional centering; spread extent ~1e5 limit; spiral tested only to i=9
Task 11: complete (commits 34b6803..0a01ced, review clean)
Task 12: minor (deferred): zero-span axis off-centers path; per-segment beginPath/stroke churn on long walks; hue never hits endpoints; MSB-order/neg-mod pinned upstream (Task 2 tests — controller confirmed)
Task 12: complete (commits 0a01ced..ae5cbfd, review clean)
Task 13: minor (deferred): curvature sign convention unpinned by suite (one-line y<0 assertion suggested); segments<=0 degenerate returns single point (unreachable via UI)
Task 13: complete (commits ae5cbfd..9b08ed5, review clean)
Task 14: minor (deferred): NaN count → silent empty result; no worker.onerror/onmessageerror (load-failure leak — relevant to Task 16 wiring); onResult-before-terminate leak on throwing handler; per-key collection tolerates differing key sets; worker `every` unclamped
Task 14: complete (commits 9b08ed5..d8a89cf, review clean)
USER DIRECTIVES (overnight, 2026-08-05): (1) Keep going autonomously as long as sensible. (2) Before Task 19 deploy: check AWS for pre-existing deployment patterns (user granted AWS access) — deployment may pivot from Cloudflare Pages to the user's AWS pattern. (3) Domain: user willing to buy a clever available name, but default pattern is *.briansheppard.com subdomains; Porkbun API credentials in F:\...\secrets.txt (now gitignored, commit 57bb9eb). DO NOT purchase any domain without user confirmation; additive-only DNS records on briansheppard.com acceptable if hosting stood up. (4) OEIS ATTRIBUTION REQUIRED before deploy: per-sequence link to oeis.org/A###### (info card already does this) + visible app-level OEIS acknowledgment (footer + README) — fold into Task 19.
Task 15: NOTE: commit 7bf8f19 fixed live-OEIS shape drift (bare array/null vs {results}) in oeisClient with tests — Task 19 proxy must preserve raw OEIS response shape.
Task 15: minor (deferred): minTerms notice spam on slider drag; resize listener leak on double-mount; fractional-DPR truncation; concurrent-load race (no abort); cleared cap input → fetchBFile(a,0); "No matches." uses error banner; canvas colors duplicate CSS vars
Task 15: complete (commits d8a89cf..9afda58, review clean; controller resolved ⚠️ picker-count via real 90/90 suite run incl. mountApp test)
USER DIRECTIVE (overnight #2): explicit authorization to make necessary Porkbun changes (DNS records on briansheppard.com) via API. Domain PURCHASE still held for explicit user OK (payment).
Task 16: NOTE: worker.onerror gap (Task 14 deferred) closed here with tests.
Task 16: minor (deferred): stale-result race after cancel (job-id guard suggested); stuck "Computing..." placeholder after ensemble failure (no retry until param change); bar.update mutates mode without onChange; seed max 2^31 off-by-one; spread limit on very long stat arrays; FakeWorker termination assertion gap. In-browser Step 5 checklist pending — controller will do a browser verification pass after Task 18.
Task 16: complete (commits 57bb9eb..39f6add, review clean)
Task 17: fix round 1/5 (1 addressed, 0 open — sweepValues harmonized: exact endpoints + snapped interiors; plan-contract self-contradiction resolved; commits 7206c87..4b450f1)
Task 17: minor (deferred): prompt-cancel coalesces to first param (should abort); sweep overlay z-index 20 covers messages z-index 10; count<2 NaN out-of-contract; fractional-step float noise
Task 17: complete (commits 39f6add..4b450f1, review clean after round 1)
Task 18: fix round 1/5 (1 addressed, 0 open — currentRef seeded pre-redraw, regression test; commits b861a75..38bbb9f incl unrelated 600cfae gitignore)
Task 18: minor (deferred): decoded params not type-checked per key; replaceState on every resize (Safari rate limit — hash-unchanged guard suggested); String.fromCharCode spread limit on huge paste payloads; MODES/SURROGATES untyped duplicates; seed NaN admitted
Task 18: complete (commits 4b450f1..38bbb9f, review clean after round 1)
DEPLOY PIVOT (user-directed): Task 19 deviates from plan (Cloudflare Pages) → AWS S3+CloudFront+ACM+Porkbun CNAME, mirroring ansatz.briansheppard.com (bucket ansatz-briansheppard-com, OAC E3E2B9N9S9G1BU pattern, CachingOptimized policy, PriceClass_100, default root index.html, redirect-to-https, TLSv1.2_2021, http2+ipv6). /api/* proxy = second origin oeis.org + CloudFront Function stripping /api + query-string cache policy 24h. Chosen subdomain: ulam.briansheppard.com (matches science-term fleet: sonde/ansatz/alcubierre/mercator/nbody/residuals). No domain purchase without user OK.
BROWSER VERIFICATION PASS (controller, real Chrome + dev server + live OEIS): PASSED for OEIS lookup, b-file 2001 terms, presets, all 9 visualizers, polyarc curve, side-by-side surrogate, ensemble worker+bands (matched), sweep grid 12 thumbs, URL round-trip, error banner, ensemble auto-disable on non-stats viz, console 100% clean.
FOUND 3 defects invisible to jsdom/node suite -> Task BV brief written:
  BV-1 Important: .tab-pane{display:flex} overrides [hidden] -> all 3 input panes always visible, tab bar decorative.
  BV-2 Important: histogram target 'terms' meaningless past float64 (2001-term Fibonacci: ~1922 terms clamp to MAX_SAFE and pile into last bin) -> silently wrong.
  BV-3 Medium: permutation+histogram gives zero-width band (mathematically correct) but reads as broken UI.
Task BV: implemented 0f1ab88 (BV-1 css), adb92f9 (BV-2 histogram log fallback), 3f6eb58 (BV-3 degenerate-band caption). Controller re-verified ALL THREE in real Chrome: tab panes now hide; 2001-term Fibonacci histogram shows correct uniform log-magnitude distribution (was single clamped spike); zero-width-band caption renders.
Task BV: review found CRITICAL — log-scale decision recomputed per surrogate inside runEnsemble; permutation is invariant (safe) but difference/matched are not, so bands can mix log (~15-30) and raw-clamped (~9e15) units. Fix round 1 dispatched: thread a logScaleOverride through params from the real sequence into both the real-line statistics call and EnsembleJob.
Task 19a: implemented 046f0fb (header + attribution footer + sidebar section labels + 3 tests), 5757244 (README rewrite + MIT LICENSE + package.json license). 118/118 tests, build clean, dist ~48.5KB.
OEIS LICENSE FACTS (verified from oeis.org EULA, approved 2023-02-24): CC BY-SA 4.0 (NOT CC-BY-NC as controller initially assumed and told the user; correction issued). Attribution must credit "The On-Line Encyclopedia of Integer Sequences" + URL to oeis.org or a specific sequence.
CORS CHECK: oeis.org sends NO Access-Control-Allow-Origin header -> the /api/* proxy IS required in production (a direct browser call from the deployed origin would be blocked). Note: 19a implementer saw lookups work under `vite preview` — that is the dev-proxy/preview path, not a CORS grant; do not conclude the proxy is optional.
AWS INFRA CREATED (controller, us-east-1, acct 2903...):
  ACM cert arn:...certificate/2911383f-28e2-4c3b-a811-f2d1e7dc6077 for ulam.briansheppard.com — ISSUED (DNS validated via Porkbun record id 571598106)
  S3 bucket ulam-briansheppard-com (private, all public access blocked)
  CloudFront function ulam-api-strip-prefix (viewer-request, strips /api prefix) — LIVE
  Cache policy 5b0c5a50-8501-4473-b07e-3186113c468d (24h, all query strings) for /api/*
  OAC EY5BH3CMXVZM2
  Distribution E24RI80DXLMTA4 -> dojnj3vdoexxq.cloudfront.net; origins: s3-ulam (default, CachingOptimized) + oeis-origin (/api/*, origin req policy AllViewerExceptHostHeader so Host is NOT forwarded to oeis.org)
  NO CustomErrorResponses by design — a 404 from a missing b-file must reach the app as a real 404, not index.html
  Porkbun CNAME ulam -> dojnj3vdoexxq.cloudfront.net (record id 571599574)
  REMAINING: upload dist/ after BV fix lands, then verify https://ulam.briansheppard.com incl. /api proxy.
Task BV: fix round 1/5 (1 Critical + 2 Minor addressed, 0 open — logScaleOverride threaded from real sequence into BOTH real-line statistics and EnsembleJob; regression test drives the real runEnsemble pipeline; commits 3f6eb58..e269402). Task BV: complete, review clean.
Task 19a: complete (commits 3f6eb58..5757244, review clean — OEIS legal attribution verified consistent across footer/README/LICENSE).
DEPLOY BLOCKER FOUND + RESOLVED: OEIS /search returns Cloudflare 403 bot challenge from ALL datacenter IPs (verified persistent, UA-independent, via live CloudFront). Static /A######/ b-files DO pass. lookupById depended on /search => production would have been 100% broken. USER APPROVED pivot to OEIS bulk data (names.gz + stripped.gz, the documented bulk-consumer path).
Task 19b: complete-pending-review (commits e820744, d9e6ab2, 11dde21, 88333b4). 398,432 sequences -> 399 shards, 152MB, terms capped 80/seq. lookupById reads /data/seq/<shard>.json; search lazy-loads /data/search-index.txt once; fetchBFile still live via /api/.
LIVE DEPLOY: https://ulam.briansheppard.com serving 200. dist+data synced to S3 (154MB). Verified live: index 200, shard 000 200 w/ correct Fibonacci entry, b-file proxy 200, meta.json correct, worker emitted as own chunk (ensembleWorker-*.js), missing shard -> 403 -> client throws correct "No OEIS sequence found" error.
DEPLOY GOTCHA (must survive future deploys): CloudFront auto-compression is capped at 10MB, so the 38.8MB search-index.txt was served UNCOMPRESSED. Fixed by uploading pre-gzipped bytes to the same key with Content-Encoding: gzip (7.4MB). A plain `aws s3 sync dist/` WILL regress this — deploy must re-upload the gzipped index afterward. Needs a deploy script.
PRODUCTION BROWSER VERIFICATION (controller, real Chrome vs https://ulam.briansheppard.com) — PASSED:
  header/footer/attribution render; "Recaman" preset renders accented correctly (UTF-8 clean end-to-end)
  A-number lookup via bulk shards works (Fibonacci 41 terms, A000045 link)
  polyarc renders identically to local
  keyword search works: 7MB gzipped index lazy-loaded in ~2s, correct Kolakoski hits, clicking a hit loads A000002
  side-by-side null model: Kolakoski rosette (real) vs visibly looser permutation surrogate
  ensemble Web Worker runs from CloudFront chunk; zero-width-band caption correct for permutation+histogram
  share URL cold load (F5) correctly restores A019488/polyarc (Sloane's find)
  console: zero errors/warnings
FOUND: share URLs do NOT re-apply on same-document hash change (mountApp reads location.hash once; no hashchange listener). Cold load fine. Fix dispatched to the Task 18 implementer (add hashchange listener + loop guard vs syncUrl's replaceState).
19b review: Important — latent UTF-8 corruption at gzip chunk boundaries in build script (carry += chunk coerces each Buffer independently). Controller verified LIVE DATA IS CLEAN (strict UTF-8 decode of all 38.8MB passes, 0 replacement chars, Menage/Recaman correct) so no re-upload needed, but future regenerations could corrupt silently. Fix dispatched (StringDecoder + end-of-build U+FFFD guard).
FINAL WHOLE-BRANCH REVIEW (opus): found 3 Critical + 4 Important, all verified by execution.
  C1 ensemble histogram bands used per-draw bin edges -> could INVERT the app's central claim (Recaman: real bin0=46, shipped band 2..13 "outside", correct 3..107 "inside").
  C2 four statistics paths still clamped past float64 (autocorr, differences x2, histogram gaps) -> Fibonacci ratios read exactly 1.0 instead of phi.
  C3 Math.min(...arr) spread crashed >250k elements -> 2D digit walk + histogram digits hard-crashed on b-file data.
  I1 matched surrogate modelled the clamping artifact; I2 noise used max-envelope (bands too wide -> under-rejects); I3 stuck "Computing..."; I4 scatter stats/render sign disagreement.
Task FR: all fixed (commits 10f790c, 9a755b3, 4de568a, 05485b8, 6f71b55). Scoped re-review: all ADDRESSED except I1 residual (sign-mixed+overflow reachable via paste tab) -> closed in 6f71b55 by extending log-space fit to signedLogMagnitude.
Controller verified post-fix: Fibonacci ratio[500]=1.618033988749872 vs phi=1.618033988749895; autocorr key now labeled "(log-magnitude scale - terms exceed float64-safe range)"; 2001-term digit walk renders 418,487 points in production; Recaman ensemble now shows the real line INSIDE the band (C1 fix visible); sign-mixed overflow surrogate has 0 values at the MAX_SAFE ceiling and stays seed-deterministic.
DEPLOY FIX: removed --delete from s3 sync. Content-hashed assets meant a deploy deleted chunks that mid-session browsers still needed -> observed once as an ensemble that never finished after a deploy (did not reproduce afterward). Root-caused rather than left as a phantom.
FINAL: 182/182 tests, tsc clean, build clean, deployed, pushed. Plan Task 19 delivered as 19a (attribution/chrome) + 19b (bulk data) + AWS infra, superseding the plan's Cloudflare Pages design.
