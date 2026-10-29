<!-- english-source: {"path":"docs/NEXT_ENGINEERING_TASK.md","sha256":"bd3fc6a21c69be42e2f9db669698276bf8b813b897c0f8a89cbb0940bc02c959","translated_at":"2026-10-29T14:22:37.348Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/NEXT_ENGINEERING_TASK.md`](../NEXT_ENGINEERING_TASK.md). Source SHA-256: `bd3fc6a21c69be42e2f9db669698276bf8b813b897c0f8a89cbb0940bc02c959`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="2026-10-29-下一個工程切片錄製聲學有界評估-lane"></a>
# 2026-10-29 Next Engineering Slice: Bounded Evaluation Lane for Recording Acoustics

<!-- english-original-anchor --> <a id="2026-10-29-整合後更新與真人回報"></a>
## 2026-10-29 Post-integration update and human feedback

This round's research and minimal fixes have been merged while preserving history. The original workspace's full quality check and current UI28 / linked8 / product4 / physics2 / storage5 functional suites passed. See [integration-state.json](../12-architecture-review/integration-state.json) for actual commits, receipts, and the unfinished public-release process.

The new [R18 human feedback](../11-v1/USER_TEST_FEEDBACK_20261029-r18.json) takes precedence over earlier descriptions of “awaiting the first human test”: inability to move or operate in first person is a user-reported failure, blocking downstream FPS operations. Materials and reflections were not tested; default volume and direct manipulation have reported issues. The tested bundle and device are unknown. Automated passes cannot override this feedback or establish numerical or device validation. The next engineering slice must first pin the source and diagnose the first-person input blocker, then address volume / direct manipulation and the original recording hot path / performance. This round has not repaired those product problems. Older sections preserve their original checkpoints and subsequent designs.

See the [Integration Report](12-architecture-review/INTEGRATION_REPORT.md) for this round's research / merge / publication status. The original Task0020 / 0012 performance, physical input at 100% / listening, and external gates remain unchanged; the older r10 work instructions below retain their historical scope.

Purpose: remove unbounded observation costs in the onTick recording branch of src/app/runtime.ts while preserving original recording semantics. Start with an isolated spike and CPU / allocation profiles, without directly rewriting physics / audio.

- File boundaries: the runtime.ts recording branch, recording-host / processor, experiments/types, and worker client; do not change protected oracles / references / acoustic formulas.
- Input: immutable scene/geometry/material/pose/source/event snapshots from the same tick, complete revisions / hashes, and continuous ticks; output: bounded results with the same semantics as original recorded frames.
- Required tests: original-fixture byte/semantic comparison, cancellation / timeout / stale / queue-full, bounded pause/resume / stop-drain, 180-tick and 1–3-minute runs. Preserve source phase / seed, event deduplication, and collisions / occlusion across objects, without missing ticks or backfilling from outside the window.
- Measurements: frame/physics/solver p95/p99, delivery, main long tasks, peak memory, recording overload, and audio dropout on both an ordinary laptop and a high-end machine. Preserve the original R17 600-second FAIL in full.
- Stop conditions: return to the original lane if data / hashes / timebases disagree, preserving failures; do not claim a performance PASS without evidence against original gates.

The second slice is a shared projection of producer capabilities: AI context / preview must explicitly return unsupported for missing OnBounce and zone producers, without changing the schema or fabricating events. A complete local mix/stems renderer is a separate P1 slice: first add RenderJob runtime validation, then connect the same AudioEngine. This round's types-only seam does not count as implementation.

Public Git history has a separate real blocker. Follow [PUBLICATION_AUDIT](12-architecture-review/PUBLICATION_AUDIT.md) to choose strategies such as retaining complete local history with a clean public snapshot; do not rewrite history or upload to LFS without authorization.

<!-- english-original-anchor --> <a id="目前下一步完成第一版證據與未解門檻"></a>
# Current Next Step: Complete First-Version Evidence and Unresolved Gates

2026-10-28: the original Scene / Rapier slice Task0006 and M0 are DONE; the original contract below is retained in its original bytes as history and no longer means that a production product has not been established. The [r10 current measurements](11-v1/SESSION_PROGRESS_20261028-r10.md) and [original 51-item acceptance](11-v1/ACCEPTANCE.md) are the handoff entry points; continue using existing Tasks, with Task0020 still IN_PROGRESS.

Next address actual Hi-x65 / D3V listening tests, native-tool initialization / visibility blockers, unmet formal performance targets / load and membership limitations, then complete the 51-row evidence, production NOTICE binding, full English freshness, pinned complete check, and local Git. Do not reimplement the Scene / FPS / audio / product4 that have passed; do not infer from the old slice's exclusions below that the whole first version excludes already authorized modules. No paid Meta or Muse usage was added; external eligibility / terms / root LICENSE decisions were not made on the user's behalf.

<!-- english-original-anchor --> <a id="以下保留原切片契約"></a>
## Original Slice Contract Retained Below

<!-- english-original-anchor --> <a id="下一個正式任務p0-01-最小場景與固定步物理骨架"></a>
# Next Production Task: P0-01 Minimal Scene and Fixed-Step Physics Skeleton

This document can be handed directly to the next Codex session. **Not executed in this work**; after the user authorizes production development, check competition gates first without repeating completed research.

2026-10-27 update: [ADR-013](02-architecture/adr/013-codex-primary-development.md) makes Codex the lead; the old Muse Harness is not a prerequisite. The new Sound Behavior [M0 pure Audio Event Runtime](10-sound-behaviors/NEXT_AUDIO_MILESTONE.md) can be developed in parallel with fixtures; this Scene/Physics remains a necessary prerequisite for its production 3D / audio vertical integration. Sound Behaviors is an external draft and does not silently modify the existing Scene v1.

> **For the executing agent**: complete the items in this document individually; when using subagents, divide work into modules that do not overwrite one another. First read AGENTS, ARCHITECTURE, ADR-002/007/011/013/014, Scene schema, PHYSICS_ARCHITECTURE, OBJECT_STATES, and KNOWN_LIMITATIONS. Codex leads implementation, with independent acceptance first; use MuseCode only when explicitly selected and resources permit, as it is not a prerequisite for this task.

**Goal**: display in the browser a single room, floor, and sphere that can be imported/exported through SceneSpec, validate four rigid-body modes with fixed-step Rapier, and establish the shared data authority for later FPS / acoustics.

**Architecture**: the Scene Document is authoritative; runtime mapping is created after host command validation. Rapier is authoritative for dynamic pose, while the Three/R3F view only renders interpolation. React panels may initially be minimal; verify React / R3F versions through official documentation and the registry and pin them exactly when starting this task. Do not add FPS/AI/audio implementation to this slice.

**Tech Stack**: continue using pinned Three/Rapier/TypeScript; if Vite/React are added, pin exact versions and licenses, and retain the existing research-tool scripts.

<!-- english-original-anchor --> <a id="全域限制"></a>
## Global Constraints

- SI / right-handed +Y up/-Z forward, quaternion xyzw; body/source IDs must not be handles.
- Only room, box, sphere, and capsule primitives; sphere dimensions are three equal diameter values.
- Import size is limited by Scene schema and domain quota; failure must not damage the open scene.
- 60Hz fixedDt; interactive mode allows at most 4 catchup steps and records dropped wall-time; record/A-B will later pause on overload without dropping ticks.
- Follow OBJECT_STATES for the four state modes and velocity restore policy; no gravity is not fixed.
- Keep Source in the document initially; do not delete fields merely because an audio runtime does not yet exist.

<!-- english-original-anchor --> <a id="review-focus"></a>
## Review focus

1. Reject invalid / duplicate IDs, dangling refs, NaN, zero quaternion, negative mass, and dimensions beyond limits.
2. Separate fixed stepping from render dt; 30/60/144Hz rendering must not change stepping results.
3. fixed→dynamic / gravity0→gravity1 must not retain unintended control forces; make sleep/wake policy explicit.
4. reset/import/dispose must not leave behind world, event queue, geometry/material, or multiple RAF loops.
5. Separate authority for UI editing and runtime pose; unconfirmed transactions must not silently write to the scene.

<!-- english-original-anchor --> <a id="實作項目"></a>
## Implementation Items

- [ ] Create `src/domain/scene.ts`, `src/domain/validate-scene.ts`, and `src/domain/commands.ts`: align with existing JSON schema, add a domain validator and transaction inverse. Test valid/invalid/rollback/stale revision.
- [ ] Create `src/runtime/physics-world.ts` and `src/runtime/fixed-clock.ts`: stable ID mapping, 4 modes, step/dispose; test gravity/fixed/impulse using actual WASM and existing fixtures without copying implementation answers.
- [ ] Create `src/view/scene-view.tsx` and an imperative pose adapter: create the room / sphere from SceneSpec, display interpolation, and keep fixed stepping out of React state; separate camera/measurement listener and clean up resize/visibility/dispose.
- [ ] Create a minimal panel: Run/Pause/Reset, mode selection, import/export, scene revision, and tick; no extensive layout or production FPS / grab/throw / AI / audio.
- [ ] Add browser smoke and manual steps: run after a single user gesture, change mode, pause, reject import, and reset 10 times consecutively without multiple loops.
- [ ] Run the existing `npm run check` + new app typecheck/build + related browser smoke; retain actual commands, versions, results, and unverified items.
- [ ] Update status/ADR (new decisions only when changes occur), limitations, and the next P0-02; do not rewrite existing research documents wholesale.

<!-- english-original-anchor --> <a id="驗收"></a>
## Acceptance

A new session can run `npm ci` and the explicitly documented dev command to see the room and sphere; the sphere can fall freely, gravity0 maintains inertia, fixed receives no force, and kinematic follows the specified trajectory. Scene roundtrip retains IDs / units / source/listener metadata. pause does not step, and reset returns to the initial snapshot. An invalid import retains the old scene. Production FPS / Grab / audio / AI remain explicitly deferred to the next task.

Budget: 6–8 hours. Risks are duplicate writes between runtime and document / resource leaks; the fallback reduces panels and geometry without weakening fixed stepping or schema correctness. After completion, an independent agent reviews the diff; do not commit Git / push / deploy without a user request.
