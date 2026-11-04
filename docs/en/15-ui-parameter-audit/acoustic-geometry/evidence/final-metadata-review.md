<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/evidence/final-metadata-review.md","sha256":"7332e0d51f09e9a14e8e63dcbeb6932e3420ea04873cb53d6db8160dfc03cb17","translated_at":"2026-11-02T09:44:46.677Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/evidence/final-metadata-review.md`](../../../../15-ui-parameter-audit/acoustic-geometry/evidence/final-metadata-review.md). Source SHA-256: `7332e0d51f09e9a14e8e63dcbeb6932e3420ea04873cb53d6db8160dfc03cb17`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="最終模型-metadataworker重播相容性獨立審查"></a>
# Final independent review of model metadata/Worker/replay compatibility

Date: 2026-11-02. Method: read-only code review, controlled Worker-reply fault injection, two new helper/test files and their small pure-box reference. No Chrome, complete runtime/performance or device/hearing tests. Worktree-base HEAD was f6abb936a8c7c87ff8eb5e6587260b837e6b67ae; new implementation was uncommitted then. Actual file hashes in metadata-review-pins.json in the same directory pin source; the base HEAD cannot be presented as the new implementation commit.

<!-- english-original-anchor --> <a id="一項已確認且已修正的問題"></a>
## One confirmed issue, now fixed

AcousticService originally pinned only request/source/listener/revision/tick, treating backendVersion merely as a bounded-length string. Independent fault injection took a real solver result for a request explicitly requiring web-geometric-primitives-1.0.0 and changed only frame.backendVersion to old web-geometric-1.0.0; the old Service still reported completedBatches=1.

- Original evidence: [model-version-fault-probe-original.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/67629c40ad7efb855991f297d8d5e0d86fbe105f).
- Fix: solver/service share acousticRequestSolverVersion, pending work pins expected backendVersion, and replies validate backendId/version/path-ID version prefixes.
- The same fault rerun: [model-version-fault-probe-final.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/46593d7e2766352ac293f65f7caa120d6b416c78), **rejected as ACOUSTIC_REPLY_IDENTITY, completedBatches=0, failedBatches=1, Worker terminated=true**.
- This reviewer did not modify Service; lead implemented the fix. Controlled protocol-fault injection is not an actual browser or network-integrity measurement.

<!-- english-original-anchor --> <a id="本次查核結論"></a>
## Conclusions from this review

1. **Scene model identity**: acousticSceneSolverVersion uses the complete authored scene, not just one request with an emitter excluded. New scenes pin modelVersion, so even if a source's exclusion leaves only planes, frames within the same recording do not mix backendVersion values. Only legacy planar-only requests lacking new capabilities retain old serialization fields/versions.
2. **Fixed capacity**: before Worker dispatch, Service totals surfaces/primitives/boxOccluders under the unchanged product cap256; solver separately applies shared geometry/segment/path/time budgets. Analytical box compaction converts only occluders that originally produce no reflection. It drops no object, silently upgrades no reflector and does not lift old planar-only-scene budgets.
3. **Replay versus reevaluation**: ReplayAudioHost consumes archived frames without solving again or inserting new policy/default fields into original artifacts. RecordingProcessor and experiment-Host reevaluation validate model/emission-geometry policy. Affected old fixed/zone baselines require fresh capture first; all-box geometry does not excuse missing a semantic change.
4. **New recording policy**: emitterGeometryPolicyPin() pins explicit-emitter-body-v1 on every new capture, including object-only A. Thus A→fixed/zone B does not incorrectly change solver hash merely because a conditional field is present/absent. hasCurrentEmitterGeometryPolicy is a compatibility check, not a substitute for formal document/config validation. Unknown present policies, including explicit undefined, reject. Old object/contact can omit it without changing original data.
5. **Three-state emitter API**: undefined retains legacy owner exclusion; null indicates a detached position while retaining binding-owner occlusion geometry; an explicit object ID excludes only the actual emitter body. Unknown owner/emitter IDs reject. This builder API has direct tests.

No further unhandled metadata blocker could currently be confirmed within this branch. Cross-branch connections below remain Root's merge-verification responsibility.

<!-- english-original-anchor --> <a id="跨分支接線界線"></a>
## Cross-branch connection boundaries

At this snapshot, the acoustic branch's runtime.requests/ExperimentToolHost/RecordingProcessor source maps had not yet derived three-state emitterObjectId from rule emitters. Adding a policy pin cannot prove that these callers actually retained remote-owner occluders. The Zone branch separately supplies a trusted behavior-acoustic-source helper: fixed/zone should pass null; object/contact follows existing object-attachment policy. Lead confirmed Root will merge Zone first, then this branch, and run its five caller-proof cases. **This review does not mark unmerged code or an unexecuted combined-browser workflow PASS.**

<!-- english-original-anchor --> <a id="新政策的獨立小測"></a>
## Independent small tests of the new policy

New file tests/app/emitter-geometry-policy.test.ts:

- **10/10 PASS,0 skip, exit0**: [emitter-geometry-policy-final.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/45c7d5c1cc335ab741fafeb04be5e36670974bb3).
- The first six cases check unconditional new pins, no data insertion when old object/contact omits them, current-pin requirements for fixed/zone, unknown/explicit-undefined rejection, invalid shapes and accessors not executed.
- The final four use original pure-box scenes, actual Rapier fixed steps/Behavior/solver/ExperimentRecorder archival, without manually changing artifact hashes. The fixed fixture actually calls the public builder with emitterObjectId:null, but gives the owner acousticRole:none, so this comparison **does not prove runtime callers retain remote-owner occluders**.
- Reevaluation rejects a pure-box/old-backend fixed baseline missing policy. Unchanged ReplayAudioHost+FakeAudioEngine can play/stop it while artifact bytes stay unchanged.
- With current policy, object A→fixed B permits matched behavior comparison. Actual solverConfigHash differs between missing/current policies and comparison is unmatched.
- In the initial9/10 run, the new fixture captured from tick0, so pre-step tick0 violated the existing audio-replay previous-step contract. [Original output](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/fd5d39479960cbe74cf1a2e768f185005ddf76f3) is retained. The fixture now captures from tick1 after actual world.step(), without modifying or relaxing product clock validation.
- Both files' ESLint/Prettier and whole-worktree tsc --noEmit were executed with exit0. Full check/runtime was not rerun.

FakeAudioEngine validates metadata/recording compatibility and graph control, not native PCM, hardware sound or human hearing. Geometry mathematics/sources remain in reference/'s nine independent cases and V0–V5 limits.
