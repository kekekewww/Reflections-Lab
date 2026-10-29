<!-- english-source: {"path":"docs/11-v1/CAPTURE_INPUT_OPTIMIZATION.md","sha256":"498ac96dffb3a604531b24342f848c6a4f1673be9b76abae437b2464ce3c545b","translated_at":"2026-10-27T03:41:10Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/CAPTURE_INPUT_OPTIMIZATION.md`](../../11-v1/CAPTURE_INPUT_OPTIMIZATION.md). Source SHA-256: `498ac96dffb3a604531b24342f848c6a4f1673be9b76abae437b2464ce3c545b`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="錄製前處理的語義等價整理"></a>
# Semantically Equivalent Cleanup of Capture Preprocessing

This change only removes duplicate work that can be confirmed from the sources; **no product performance improvement was measured or claimed**. Fixed 60Hz, maximum 4-step catch-up, pausing capture on overload, all path/phase/capacity validation, and frozen acceptance remain in place. This page does not represent complete product E2E or a performance pass.

`src/app/acoustic-input.ts` creates an object-ID Set for a validated Scene, sorting objects only once per call; within the same call, surface geometry is built only once for the same box snapshot. The first request receives the new surface data, and subsequent requests receive their own independent clones. The cache does not span ticks/revisions/function calls; the source owner is still excluded first, so another source or preconstruction cannot incorrectly require its missing moving pose. Each request's geometry, materials, atmosphere, and endpoints remain isolated from other requests and the caller. The original `createScene`, solver, and identity/surface caps are not omitted.

`src/experiments/hash.ts` adds `immutableCloneWithByteLength`: the same validated canonical string is used for parse/deepfreeze and UTF-8 byte accounting; the original `immutableClone` continues to avoid UTF-8 encoding. `ExperimentRecorder.appendFrame` uses the new helper to avoid another canonical traversal of the same complete frame. Domain validation, budget checks, cumulative bytes, event deduplication, and commit order remain in place; acoustic or source evidence is not omitted.

The pre-change [hash source](../../../artifacts/v1/capture-cost-baseline-20261027/hash.ts) and [recorder source](../../../artifacts/v1/capture-cost-baseline-20261027/recorder.ts) preserve the original bytes. Independent tests load these local old implementations as references, with no network or model calls and no rewriting of the old source to fabricate a baseline.

<!-- english-original-anchor --> <a id="已執行驗證"></a>
## Validation Performed

- [53 regression tests and static checks](../../../artifacts/v1/capture-cost-validation-20261027/verification.json): hash clone/bytes and the original capture/RecordingHost/RecordingProcessor/ReplayAudio tests all passed; global TypeScript and scoped ESLint/Prettier passed. The 61 original protected-file hashes were unchanged, and sources matched before and after.
- [12 tests from the isolated review](../../../artifacts/v1/capture-cost-independent-20261027-r2/verification.json) all passed: 8 acoustic-request data ownership/dynamic pose/sorting/owner exclusion/error and capacity cases, plus 4 cases comparing equivalence with the archived old recorder for artifacts/fingerprints/UTF-8 byte budgets/immutability/error ordering. Complete artifact JSON, fingerprints, SHA, and traceBytes matched the old version; rejection/retained state at the exact byte boundary and one byte short also matched. Strict test types, ESLint, and Prettier passed, with matching source hashes before and after. All 12 cases passed in the first test run, but the readonly casts used for test mutations failed strict checking; that original failure is retained, and r2 only fixes the test syntax without changing production sources.

Geometry clones are not added for the original single-source case; the actual costs of multi-source reuse and native cloning still require browser measurement. This change did not alter renderer settings, reduce acoustic frequency, skip ticks, delete tests, or increase budgets. The formal 10-minute profile, listening tests, and overall first-version completion remain subject to the original acceptance criteria, item by item.
