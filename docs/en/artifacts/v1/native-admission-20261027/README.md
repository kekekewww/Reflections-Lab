<!-- english-source: {"path":"artifacts/v1/native-admission-20261027/README.md","sha256":"b207917328aff8b6e82c34bf6a1595de209670c1014f38c16b23592add5fd55e","translated_at":"2026-10-27T08:28:49.8513876Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/native-admission-20261027/README.md`](../../../../../artifacts/v1/native-admission-20261027/README.md). Source SHA-256: `b207917328aff8b6e82c34bf6a1595de209670c1014f38c16b23592add5fd55e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="原生音訊准入拒絕關聯與診斷修補"></a>
# Native Audio Admission Rejection: Attribution and Diagnostics Fix

Date: 2026-10-27. The scope is limited to real-time native rejection attribution under V1-UX-04; it does not mean the complete first version is finished.

`LabRuntime.solveCurrent` previously displayed `AudioEngine.playVoice` rejections only through a notice that could be overwritten. The fix preserves the VoiceIntent and Behavior document revision at enqueue time, linking actual rejection results to the original event, instance, binding, rule, object/generation, epoch, profile, source, and AcousticFrame request. Subsequent logical updates do not rewrite the original associations; the rejection time and logical event time are displayed separately.

At most 64 real-time native rejections are retained. Event/Rule diagnostics are separate from core logical decisions, clearly labeling native rejection reasons and stating that "a logical instance does not represent actual device output." Authoring/epoch and replay/seek boundaries clear this cache; preview does not rewrite the original run diagnostics. Schemas, recording formats, core cooldown/global limit, audio budgets, and acoustic DSP were not modified.

<!-- english-original-anchor --> <a id="已執行證據"></a>
## Executed Evidence

- [Original RED](../../../../../artifacts/v1/native-admission-20261027/red.txt): actual LabRuntime, actual AudioEngine, FakeAudioContext, and actual solver results; explicitly sets the test-only `maxSources=8`, with native admission accepting 8 of 9 logical sources and rejecting 1, but the original code provided no inspectable association. The original failure text is preserved, without relaxing acceptance criteria.
- [GREEN 35/35](../../../../../artifacts/v1/native-admission-20261027/green-final.txt) and [commands/source hashes](../../../../../artifacts/v1/native-admission-20261027/node-verification.json): 5 new cases cover asynchronous original intent, saved pending copies, pause/notice, capture exclusion, replay/seek cleanup, bounded capacity, and unknown/prototype-name reasons; adjacent core diagnostics, preview, replay, and runtime cases also passed.
- [Independent review](../../../../../artifacts/v1/native-admission-20261027/independent-review.json): 20/20 PASS in a separate process, with matching before/after hashes for 16 checked files, and suggested fixes checked. Typecheck, lint/format for specified files, and Emil pin/standards passed; the latter two are only static checks.

Production native budgets remain 24 voices/32 sources; the test's 8-source capacity is an explicit fixture, not the product default. FakeAudioContext only records the control graph and does not simulate DSP/PCM.

<!-- english-original-anchor --> <a id="尚未執行"></a>
## Not Yet Executed

[2 native browser cases](../../../../../tests/browser/native-admission.spec.ts) and an [independent config](../../../../../tests/browser/native-admission.config.ts) are ready, with status **NOT RUN**; the root arranges the source freeze and browser test window. Actual device output, hearing tests, PCM, and performance are not inferred to have passed from this fix's Node evidence. The root integrates the full `npm run check`, Wiki/Task, English documentation, and Git housekeeping.
