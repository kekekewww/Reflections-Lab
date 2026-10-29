<!-- english-source: {"path":"docs/11-v1/SESSION_PROGRESS_20261027-r7.md","sha256":"a77a7f48ceeb1a4d8c03a5631a4825cae43a47b02f325441076a9be30e43a9fe","translated_at":"2026-10-27T17:35:16.8645160Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/SESSION_PROGRESS_20261027-r7.md`](../../11-v1/SESSION_PROGRESS_20261027-r7.md). Source SHA-256: `a77a7f48ceeb1a4d8c03a5631a4825cae43a47b02f325441076a9be30e43a9fe`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版整合-checkpoint-r7效能修補已建置音訊準備逾時另行驗證"></a>
# First Version Integration Checkpoint r7: Performance Repairs Built; Audio Preparation Timeout Under Separate Verification

Date: 2026-10-27. The complete first-version goal remains ACTIVE; the original 51 requirements, EN01–06, Task criteria, performance loads, and numerical thresholds have not been relaxed. Codex continues to own implementation and coordination, verifying through frozen tests, independent processes, references, and isolated review; this round used no Muse Code and added no paid Meta requests.

<!-- english-original-anchor --> <a id="已核實的新版範圍"></a>
## Verified Scope of the New Version

- Completed offline `npm ci` for the main project and physics spike using explicitly specified Node `22.17.0` and npm CLI `11.4.2`; both lockfiles were unchanged, and 1734 source items matched before and after. [Locked-version installation receipt](../../../artifacts/v1/qualification-locked-offline-ci-20261027144405972/verification.json). This evidence supersedes the earlier installation record that could not establish the npm PATH version; the original record is retained.
- Reran `typecheck`, `lint`, and `test:runtime` after installation, each actually exiting 0; runtime **900/900 PASS**, with no fail, cancel, skip, or todo, and 1734 source items matching before and after. [Post-CI receipt](../../../artifacts/v1/qualification-post-ci-explicit-node-20261027145219929/verification.json). This is not a complete `npm run check` or browser／device acceptance.
- The formal candidate build succeeded, with input digest `a699b0b4dbcb53227ec76124b782641ae2ba7685b76f03878e045feb311f5637`; 170 build inputs and 12 bundles. This step launched no preview or browser. [Build archive receipt](../../../artifacts/v1/ui-qualification-fixed-build-20261027T145717497Z/proof-receipt.json).

<!-- english-original-anchor --> <a id="效能修補及證據界線"></a>
## Performance Repairs and Evidence Boundaries

UI／physics／interaction repairs prevent narrow camera, Listener, and mode reads from triggering projection of the entire world; contact projection now uses an index built per call. Authoring data maintains a separate, frozen view template based on actual document identity; public DTOs remain independent, and the authoritative original Scene is not frozen. Event projection retains the original ordering and 512-entry boundary. RED／GREEN, original projection references, mutation／retained-snapshot／same-revision import, and independent review evidence are in the [UI repair archive](../../../artifacts/v1/ui-performance-candidate-sourceend-20261027T143736524Z/EXPORT_RECEIPT.json). Node measurements do not establish that browser p95 meets its target.

The audio band filter retains operation order, using bounded FFT layout／workspace and exact IEEE-754 normalized-response memoization; at most 512 entries and 1 MiB of key/kernel payload, without claiming that total heap is only 1 MiB. All 12480 old／new outputs are byte-for-byte identical. Routes are reused only when the desired IR exactly matches the current active target bank, while retaining scale, delay, direction, gate, ramp, epoch, and dispose semantics. [Audio repair receipt](../../../artifacts/v1/audio-delivery-candidate-sourceend-20261027143309508/sourceend-proof.json). Reuse retains convolution history, so byte-for-byte PCM identity around the old version's redundant rebuilds cannot be claimed; the new independent native state reference has not yet run.

The performance harness's RAF collection provenance and marker boundaries were verified separately, retaining original native task duration／edge work; physics wakes the existing 255 Dynamic bodies before every measured step, keeping the original 30-step impulse, 1 Fixed／64 CCD, geometry, solver, dt, and load unchanged, with wake cost reported separately. 146/146 Node tests and independent static review passed; the new profile remains NOT RUN. [Harness repair receipt](../../../artifacts/v1/performance-boundary-awake-sourceend-20261027.json).

The only completed formal 600-second first round is retained in [r6](SESSION_PROGRESS_20261027-r6.md), along with the original FAIL／UNVERIFIED: physics native p95 2.10 ms, delivery 15.10／51.10 ms, UI RAF p95 66.60 ms, plus cadence／load and trace start-boundary issues. Original raw data／traces are not rewritten or rebinned offline into a PASS.

<!-- english-original-anchor --> <a id="當前音訊驗證阻礙"></a>
## Current Audio Verification Blocker

Both new-version attempts at the original 25-case Chromium verification produced **18 PASS／0 numerical FAIL／7 NOT RUN**; seven cases stopped during baseline module preparation and never reached DSP evaluation. In the second attempt, with passive observation, prepare evaluate actually took 17731.0554 ms, exceeding the original 15000 ms; all fourteen local requests returned HTTP 200, with the last response arriving after the deadline, and Vite source transform／delivery delays were observed. The underlying cause of the Windows／Vite delay has not yet been determined; observation itself has a cost and cannot be claimed to be timing-neutral. [Diagnosis](../../../artifacts/v1/audio-qualification-original25-observed-20261027151352235/diagnosis-summary.json), [original results](../../../artifacts/v1/audio-qualification-original25-observed-20261027151352235/verification.json).

The original 23 inputs, oracle, and 15-second／2-second limits were unchanged; the actual Node exit was 1, and cleanup of known owned Node／browser／server processes was completed. A separate Windows `--import` URL-format error occurred before the runner／browser launched and is retained independently as a transport error, not a native trial.

A separate prepared-static V2 has been approved: prebuild the same six suites and harness, use a local static server with fixed bytes, retain the original per-suite flow, gesture, capability, classifier, oracle, and time limits, and add frozen source／bundle hashes, AST conformance, and negative-case checks. **This has only entered implementation; there is no V2 native PASS yet.** Old errors are not overwritten.

<!-- english-original-anchor --> <a id="待完成及下一步"></a>
## Remaining Work and Next Steps

1. After prepared-static V2 conformance／independent review, execute the original 25 cases once; after passage and cleanup, execute the new IR state native reference, then a short smoke run. A short smoke run cannot replace the formal 600-second profile.
2. Revalidate UI／real native zoom／physics／storage／product E2E against the new fixed sources; the earlier `0eef…` functional PASS proves only that version and cannot be transferred directly to an `a699…` pass.
3. Authorize a new formal profile only after confirming load／boundaries and cost, retaining all existing failures.
4. The user reports headphones **Austrian Audio Hi-x65** and speakers **ADAM Audio D3V**. Listening tests for actual output routing, sample rate, block, click/pop, volume jumps, moving localization, dropout, and Pause/Resume remain NOT RUN; the same-context silent block helper has only 18 synthetic PASS cases and does not establish native, hearing, Worklet p99, or SPL results.
5. Update final status, requirement evidence, Tasks／Wiki／handoff, all English freshness, complete quality checks, and the local Git checkpoint; no push／deployment. The original 243 English mirrors are an earlier snapshot and cannot be claimed to cover the new checkpoint.

Task0006／0017／0019 retain their evidence-backed DONE status; Task0020 remains IN_PROGRESS. Meta's completed minimal product sound live slice is retained; the three authorized request slots are exhausted, billing is unverified, and no new paid calls are added. Eligibility／post-login terms, the root LICENSE, and publishing decisions retain external gates. The current local Git recovery point is `f006b0e60db18450bdfcbcf22d790b9913724b1e`; this round's repairs and evidence remain uncommitted.
