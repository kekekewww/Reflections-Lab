<!-- english-source: {"path":"docs/16-nonadvanced-completion/history/NEXT_ENGINEERING_TASK.pre-m1.d7441f1616a2.md","sha256":"d7441f1616a2f442c5581d15e69c7b02dac5bb0a71eb188bd7f635b3b0350e28","translated_at":"2026-11-03T02:23:02.333Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/history/NEXT_ENGINEERING_TASK.pre-m1.d7441f1616a2.md`](../../../16-nonadvanced-completion/history/NEXT_ENGINEERING_TASK.pre-m1.d7441f1616a2.md). Source SHA-256: `d7441f1616a2f442c5581d15e69c7b02dac5bb0a71eb188bd7f635b3b0350e28`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="2026-11-02-下一步claude獨立重驗與新增功能人工測試"></a>
# 2026-11-02 next: independent Claude revalidation and manual testing of new features

This round's six core features, Zones, spheres/capsules and dynamic reflections, Project environment, 217 limited UI cases and five WAV files have been implemented, validated and normally integrated into local main `fe663ca9f384d247bcd89b331936f6be202c761f`. The [complete check](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2f387d58e834799d809cbbdaab03e2afd2cb4194) exited 0. The [actual Main receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/529524649ac8b7fbff91d919bf6dcab6403b7865) retains the original 129 untracked files/4ba snapshot; the product remains the same as 501. Tasks24..31, including the limited Task28, are DONE. Only native AC04 in Task23 is blocked by external URL policy; real DOM digital artifacts separately PASS.

1. Claude independently revalidates and adjusts according to the [complete handoff](../../14-core-pipeline/CLAUDE_CODE_HANDOFF_20261102.md), original task criteria and frozen source/bundle/raw receipts. Preserve the original FAIL, versioned browser/PCM and original 2e-6 stem tolerance; do not pass internal APIs off as UI.
2. After Claude finishes adjustments, the user manually observes new features and audio files. The original basic features are already confirmed; do not request R19/R21 retests. Reconcile Task22's old literal AC06 as historical metadata only; do not treat reports on an unknown bundle as item-by-item measurement.
3. In a future authorized run, if the native tool can reliably identify the URL, complete literal native product operation/export; or reassess after the user explicitly revises the method. Tools have stopped for this turn and must not be bypassed; keep the first three timeouts separate from the fourth attempt, in which only CtrlN succeeded.
4. Handle formal 600-second performance, external scientific/device/listening/Meta live gates and the 14 PERF candidates/7 PROPOSED ADRs separately; do not automatically start all of them. Preserve R21 broker unknown jobs and C attachment. No push/deployment/new paid use. Subsequent bookkeeping HEAD must come from actual Git; do not guess the commit's own hash.

<!-- english-original-anchor --> <a id="以下保留先前工程規劃截點"></a>
## Earlier engineering planning snapshots retained below

<!-- english-original-anchor --> <a id="2026-10-29-下一個工程切片錄製聲學有界評估-lane"></a>
# 2026-10-29 next engineering slice: a bounded recording-acoustics evaluation lane

<!-- english-original-anchor --> <a id="2026-10-29-整合後更新與真人回報"></a>
## 2026-10-29 post-integration update and human feedback

This round's research and minimal fixes have been merged while preserving history. The original workspace's complete quality check and current UI28/linked8/product4/physics2/storage5 components passed. Actual commits, receipts and the incomplete publication process are in [integration-state.json](../../../12-architecture-review/integration-state.json).

The new [R18 human feedback](../../../11-v1/USER_TEST_FEEDBACK_20261029-r18.json) takes precedence over earlier descriptions of “awaiting the first human test”: inability to move or operate in first person is a user-reported failure, blocking downstream FPS operations. Materials and reflections were not tested; default volume and direct manipulation have problems. The tested bundle/device are unknown; automated passes cannot override this, nor imply successful numerical or device validation. The next engineering slice first pins the source and diagnoses the first-person input blocker, then addresses volume/direct manipulation and the original recording hot path/performance. These product problems were not fixed this round. Earlier sections retain their original snapshots and subsequent design.


See the [Integration Report](../../12-architecture-review/INTEGRATION_REPORT.md) for this round's research/merge/publication state. The performance, normal-100% human input/listening and external gates of original Task0020/0012 remain unchanged. The old r10 work instructions below are retained as history.

Purpose: remove the unbounded observation cost of the recording branch in src/app/runtime.ts onTick while retaining the original recording semantics. First conduct an isolated spike and CPU/allocation profile; do not directly rewrite physics/audio.

- File boundaries: the runtime.ts recording branch, recording-host/processor, experiments/types and worker client; do not modify protected oracles/references/acoustic formulas.
- Input: same-tick immutable scene/geometry/material/pose/source/event snapshots, complete revision/hash and consecutive ticks. Output: bounded results with the same semantics as original recorded frames.
- Required tests: original fixture byte/semantic comparison, cancel/timeout/stale/full queue, bounded pause/resume/stop drain, 180 ticks and 1–3-minute runs. Preserve source phase/seed, event deduplication and cross-object collision/occlusion; do not omit ticks or fill the window retroactively from outside it.
- Measurements: frame/physics/solver p95/p99, delivery, main-thread long tasks, peak memory, recording overload and audio dropouts on a normal laptop and a high-end machine separately. Preserve the full original R17 600-second FAIL.
- Stop conditions: return to the original lane if data/hash/timebase diverges and retain the failure. Do not claim performance PASS without evidence for the original thresholds.

The second slice is a shared producer-capability projection: AI context/preview must explicitly report unsupported for OnBounce and zones without a producer, without changing the schema or fabricating events. A complete local mix/stems renderer is a separate P1 slice: first add RenderJob runtime validation, then connect the same AudioEngine. This round's types-only seam is not an implementation.

Public Git history has a real blocker requiring a strategy such as retaining complete local history and a clean public snapshot, selected according to [PUBLICATION_AUDIT](../../12-architecture-review/PUBLICATION_AUDIT.md). Do not rewrite history or upload through LFS without authorization.

<!-- english-original-anchor --> <a id="目前下一步完成第一版證據與未解門檻"></a>
# Current next step: complete first-version evidence and unresolved gates

2026-10-28: original Scene/Rapier slice Task0006 and M0 are DONE. The original contract below is retained with its original bytes as history; it no longer means a formal product has not been created. [Current r10 measurements](../../11-v1/SESSION_PROGRESS_20261028-r10.md) and the [original 51-item acceptance criteria](../../11-v1/ACCEPTANCE.md) are the handoff entry points. Continue using existing tasks; Task0020 remains IN_PROGRESS.

Next address actual Hi-x65/D3V listening, native-tool initialization/visibility blockers, failed formal performance/workload and membership restrictions, then complete the 51-row evidence, production NOTICE binding, complete English freshness, pinned full check and local Git. Do not reimplement already-passed Scene/FPS/audio/product4. Do not infer from the older slice's exclusions below that the entire first version excludes already-authorized modules. No new paid Meta or Muse use; external qualification/terms/root LICENSE have not been decided on the user's behalf.

<!-- english-original-anchor --> <a id="以下保留原切片契約"></a>
## Original slice contract retained below

<!-- english-original-anchor --> <a id="下一個正式任務p0-01-最小場景與固定步物理骨架"></a>
# Next formal task: P0-01 minimal scene and fixed-step physics skeleton

This document can be handed directly to the next Codex session. **It has not been executed in this session**. After the user authorizes formal development, first verify competition gates without repeating completed research.

2026-10-27 update: [ADR-013](../../02-architecture/adr/013-codex-primary-development.md) changes development to Codex-led; the old Muse Harness is not a prerequisite. New Sound Behavior's [M0 pure Audio Event Runtime](../../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md) can be developed in parallel with fixtures. This Scene/Physics slice remains necessary for its formal 3D/audio vertical integration. Sound Behaviors is an external draft and must not silently modify existing Scene v1.

> **For the executing agent**: complete each item in this document. If using subagents, divide modules so they do not overwrite each other. First read AGENTS, ARCHITECTURE, ADR-002/007/011/013/014, the Scene schema, PHYSICS_ARCHITECTURE, OBJECT_STATES and KNOWN_LIMITATIONS. Codex leads implementation with independent acceptance prioritized. Use Muse Code only when explicitly selected and resources permit; it is not a prerequisite for this task.

**Goal**: show a single room, floor and one sphere in the browser, importable/exportable from SceneSpec. Verify four rigid-body modes with fixed-step Rapier and establish the shared data authority for later FPS/acoustics.

**Architecture**: the Scene Document is authoritative; host commands validate before creating runtime mappings. Rapier is authoritative for dynamic poses, while the Three/R3F view only renders interpolation. React panels may initially be minimal. Verify React/R3F versions against official documentation and the registry and pin them exactly when this task starts. Do not add FPS/AI/audio in passing.

**Tech Stack**: retain pinned Three/Rapier/TypeScript. Pin exact versions and licenses for any added Vite/React, and retain existing research-tool scripts.

<!-- english-original-anchor --> <a id="全域限制"></a>
## Global restrictions

- SI/right-handed +Y up/-Z forward, quaternion xyzw; body/source IDs cannot be handles.
- Only room, box, sphere and capsule primitives; sphere dimensions are three equal diameter values.
- Imports are limited by the Scene schema and domain quotas. Failure must not destroy the open scene.
- 60 Hz fixedDt; interactive mode has at most 4 catch-up steps and records dropped wall-time. Future recording/A-B pauses on overload instead of dropping ticks.
- The four state modes and velocity-restore policy follow OBJECT_STATES; no gravity is not fixed.
- Initially retain Sources in the document only; do not remove fields because there is no audio runtime yet.

<!-- english-original-anchor --> <a id="review-focus"></a>
## Review focus

1. Reject invalid/duplicate IDs, dangling refs, NaN, zero quaternions, negative mass and dimensions exceeding limits.
2. Separate fixed-step and render dt; render rates of 30/60/144Hz must not change stepping results.
3. fixed→dynamic/gravity0→gravity1 must not retain unintended control forces; sleep/wake policy must be explicit.
4. reset/import/dispose must not leave worlds, event queues, geometry/materials or multiple RAFs behind.
5. Separate authority for UI edits and runtime poses; unconfirmed transactions must not silently write the scene.

<!-- english-original-anchor --> <a id="實作項目"></a>
## Implementation items

- [ ] Create `src/domain/scene.ts`, `src/domain/validate-scene.ts`, `src/domain/commands.ts`: align with the existing JSON schema and add a domain validator and transaction inverse. Test valid/invalid/rollback/stale revision.
- [ ] Create `src/runtime/physics-world.ts`, `src/runtime/fixed-clock.ts`: stable ID mappings, 4 modes, step/dispose. Test gravity/fixed/impulse using real WASM and existing fixtures without copying the implementation's answers.
- [ ] Create `src/view/scene-view.tsx` and an imperative pose adapter: create the room/sphere from SceneSpec, display interpolation, and keep fixed steps out of React state. Separate camera/measurement listener and clean up resize/visibility/dispose.
- [ ] Create a minimal panel: Run/Pause/Reset, mode selection, import/export, scene revision and tick. Avoid extensive layout; no formal FPS/grab/throw/AI/audio.
- [ ] Add browser smoke tests and manual steps: run after a single user gesture, change mode, pause, reject imports, and reset 10 consecutive times without multiple loops.
- [ ] Run the existing `npm run check` plus the new app typecheck/build and related browser smoke tests. Preserve actual commands, versions, results and unverified items.
- [ ] Update status/ADRs (new decisions only when something changes), limits and the next P0-02 without rewriting all existing research documents.

<!-- english-original-anchor --> <a id="驗收"></a>
## Acceptance

A new session can run `npm ci` and the explicitly documented dev command to see the room and sphere. The sphere can free-fall, retain inertia with gravity0, remain unaffected by forces when fixed, and move along the specified trajectory when kinematic. Scene roundtrip preserves IDs/units/source/listener metadata. Pause does not step; reset returns to the initial snapshot. Invalid import retains the old scene. Formal FPS/Grab/audio/AI remain explicitly deferred to the next task.

Budget: 6–8 hours. Risks are dual writes between runtime/document and resource leaks. The fallback reduces panels and geometry without removing fixed-step or schema correctness. An independent agent reviews the diff after completion. Do not commit Git/push/deploy without a user request.
