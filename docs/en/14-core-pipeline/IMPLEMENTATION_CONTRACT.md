<!-- english-source: {"path":"docs/14-core-pipeline/IMPLEMENTATION_CONTRACT.md","sha256":"c407c71c78daccae3e1d1c84d076d35026aa727ad403b2462f5f724e9c6d6346","translated_at":"2026-11-02T05:21:37.4627443+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/IMPLEMENTATION_CONTRACT.md`](../../14-core-pipeline/IMPLEMENTATION_CONTRACT.md). Source SHA-256: `c407c71c78daccae3e1d1c84d076d35026aa727ad403b2462f5f724e9c6d6346`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="六項核心實作契約"></a>
# Six-core implementation contract

Date: 2026-11-02 (Taiwan time). Status: the finite implementation scope authorized by the user for this round; this is neither a test result nor full V1 closure. The requirement summary is in [REQUEST_20261102.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1c8807e9ba7b981c937b04a7e84ea12859bfb497); ownership and the evidence workflow are in [STAGES.md](STAGES.md).

<!-- english-original-anchor --> <a id="目標與權威"></a>
## Goal and authority

Complete the core recording, audio-cost observation, shared-capability, Meta workflow, Motion-authoring and short-take-renderer loops in the existing production Web application. The integration branch is `codex/core-pipeline-local-20261102`, starting at `429efb7597ec913bd879ecc05c29a6be7ad5175c`. All worktrees live inside the project under `.worktrees/`; retain other branches, uncommitted work and historical artifacts.

The user has confirmed that basic-function testing is complete and the functions work, and has authorized these six cores, parallel worktrees, local integration into main, persistent memory/checkpoints, later Claude review and audio-file export through computer-use. Do not make another R18/R21 basic-operation retest a prerequisite for this round. This authorization does not cover new paid APIs, pushing, deployment, accepting terms or deciding the root LICENSE.

The [V1 acceptance criteria](../11-v1/ACCEPTANCE.md), [confirmed amendments](../11-v1/ACCEPTANCE_AMENDMENTS.md) and ADR-011/013/014/015 remain effective. This contract fixes the core completion conditions for this round without changing existing references, tolerances or performance thresholds, and does not start all 14 optimization tasks. Retain the broader acceptance conditions and dependencies of the existing PERF tasks. Task0023 projects this round's finite work back to those tasks; do not remove dependencies to obtain a claim.

<!-- english-original-anchor --> <a id="01-錄製與-ab-有界-evaluation"></a>
## 01 Bounded recording and A/B evaluation

Corresponds to PERF-001/002/014; this round's projection is Task0023 AC-01.

- Recording evaluation consumes immutable scene/geometry/material/pose/source/event inputs from the same tick. Bound the queue by both frame count and bytes, and identify accepted/evaluated/published ticks explicitly.
- Pause the producer at the high-water mark without dropping simulation ticks or omitting collision events through latest-only processing. Within normal capacity, preserve the original recording semantics, source phase, seed, event ordering and deduplication.
- Cancellation, timeout, stale revision/epoch, a full queue and worker failure have finite termination/recovery behavior. Stop/drain must not wait indefinitely, and failure must not publish a complete artifact.
- A/B recomputation uses the same bounded service and retains the fixed conditions for acoustic/behavior A/B. Cancellation must not contaminate another run or overwrite the original artifact.
- Compare data and semantics against the existing synchronous reference using a fixed fixture of at least 180 ticks, and verify queue watermarks and pause/resume/stop/cancel/stale negative cases. This evidence is not a 600-second performance pass.

<!-- english-original-anchor --> <a id="02-成本觀測與-native-音訊更新"></a>
## 02 Cost observation and native audio updates

Corresponds to PERF-001/003/014; this round's projection is Task0023 AC-02.

- Provide bounded cost/capacity observation that can be disabled. Distinguish evaluation, copy/delivery, native control updates, late onset, snapshot/voice/path rejection and actually available output statistics. Fields without device support remain null/unsupported rather than zero.
- Bind receipts to source, bundle, browser, actual sample rate and method. Retain an unknown device route as unknown; do not assume 128 frames or a fixed hardware buffer.
- Separate responsibility for scalar pressure gain, normalized shape, delay and direction updates. Preserve the existing FIR cache, stable routes, dual banks, phase, tails and a single propagation delay, avoiding repeated identical native parameter scheduling on every physics tick.
- Use existing digital graph/fixture checks for identity, gain/shape/delay/direction, pause re-anchoring and disposal. Report approximate deadband error separately from exact deduplication. Reduced observed cost does not establish human hearing, Worklet deadline or cross-device benefits.

<!-- english-original-anchor --> <a id="03-uiaipreviewhost-共用能力與最小-bounce-producer"></a>
## 03 Shared UI/AI/Preview/Host capabilities and a minimal Bounce producer

Corresponds to Task0024 and inherits the existing Sound/Acoustic/Meta capability contracts.

- Establish one machine-readable capability description shared by available UI controls, AI context/tool declarations, Preview and Host validation. Report capability IDs, supported scope and specific rejection reasons.
- An evaluator accepting an event does not mean the product has a producer. Unwired zones and unsupported geometry/modes must not expose an entry that falsely applies successfully. Reject unsupported requests atomically while retaining the previous scene/draft.
- This round's minimal OnBounce accepts only genuine PhysicsWorld contact/motion data and an explicit static-support determination. Do not substitute restitution > 0, ContactEnd alone or a new Impact for Bounce. Reject or retain unknown for dynamic support, uncovered shapes or unknown data according to actual capabilities.
- Positive and negative cases cover consistent capability projections, unsupported tools/rules, lack of a valid bounce and duplicate events. Bounce thresholds classified as Derived/Tuned must not be labeled physical constants or measured real vibration.

<!-- english-original-anchor --> <a id="04-meta-工具-ui-閉環"></a>
## 04 Meta tool UI loop

Corresponds to Task0025; it does not replace account, real-live or broader acceptance conditions under Task0007/0014.

- In the product UI, start with context/a proposal, inspect affected items and the preview, explicitly apply/undo, execute bounded run/capture and read actual analysis/compare results and insufficiency conditions.
- The existing server provider, safe Host and revision/schema/domain/capability/budget gates remain authoritative. The model must not directly operate the engine, provide arbitrary file paths or invent hashes.
- An offline/fixture provider may generate deterministic proposals, but subsequent Host tools must actually operate product state. Fixture text cannot stand in for a run, artifact or measurement. Errors, cancellation, stale state and unsupported items must be understandable within the workflow.
- At least one reproducible UI workflow covers proposal through analysis/comparison, plus one rejection case. Without new paid authorization, mark live NOT RUN; do not substitute Codex/Claude for Meta and claim a pass.

<!-- english-original-anchor --> <a id="05-motion-authoring-與-settrajectory"></a>
## 05 Motion authoring and SetTrajectory

Corresponds to Task0026 and retains the same PhysicsWorld, Scene revision/command/undo and fixed step.

- Provide finite, versioned object-trajectory authoring data, validation and a minimal UI, supporting at least the explicitly scoped kinematic keyframes/linear trajectories. `SetTrajectory` must actually apply its supported subset through the same capabilities and validator.
- Transactions include object ID, generation/revision, start tick, finite duration and bounds. Reject invalid/stale requests atomically. Apply/undo must not leave partial data, and Rapier/Three runtime objects must not be serialized.
- Do not replace existing kinematic clearance/collision policies with direct transform teleportation. Fixed/Held conflicts, cancellation, pause/resume/reset and delete/mode changes require explicit control ownership and termination receipts.
- Fixed-tick results must agree across render cadences. Declare Dynamic Move To/Move & Release supported only after implementing their bounded controllers, release-velocity policy and collision validation. Otherwise report unsupported; do not substitute body modes to fill the gap.

<!-- english-original-anchor --> <a id="06-短-take-full-mixobject-stems-renderer"></a>
## 06 Short-take full-mix/object-stems renderer

Corresponds to Task0027 and inherits ADR-015 and the existing `RenderJob`. The full PERF-011 chunk-state-carry/long-output research retains its original BACKLOG status.

- Implement runtime job/hash/clock/capability/budget validation and produce PCM through the same AudioEngine in a real OfflineAudioContext. Core limits are a 30-second take and at most 16 outputs. The validator explicitly enforces the remaining frame/working-bytes/output-bytes limits.
- Produce at least one full mix and genuine object stems selected by recorded source ID, retaining the same tick/sample origin, original physics world, behavior/admission, source phase and pre-roll/tail semantics. Do not remove collision objects or decide source admission again to select a stem.
- Declare only actual tap, channel and spatialization capabilities. Label native HRTF browserManagedUnspecified without inventing a coefficients hash. Stems with nonlinear master/limiter processing do not promise to sum to the full mix.
- Reject NaN/Infinity, invalid hashes/windows/output counts/lengths, missing assets, unknown sources and unsupported jobs early. Cancellation/retry, changed content under the same job ID and final atomic publication must have verifiable behavior.
- Digital tests cover sample alignment, finite peaks/digital clipping reports, source isolation, tails and cancellation. The product can download WAV. Root also operates the product through computer-use to export audio for the user to hear, saving source/settings and artifact hashes. A successful export is not a human-hearing pass.

<!-- english-original-anchor --> <a id="本輪完成驗證與交接界線"></a>
## Completion, verification and handoff boundaries for this round

1. Actual code and UI connections for all six cores work. Each stage report distinguishes IMPLEMENTED, PASS/FAIL/NOT RUN, source/commit, commands, exit codes and limitations. Interfaces, documents or types alone are insufficient.
2. Run corresponding basic tests and necessary integration/browser/digital-audio checks for each core. Do not modify protected oracles, references or tolerances to manufacture a pass. Performance-load windows must not overlap other retests.
3. Deliver basic verification and complete commands/source/artifact entry points for Claude's later independent revalidation. Until Claude runs it, report NOT RUN. List human observation of new features separately without reopening already confirmed basic-function testing.
4. The user has authorized normal local merging into main while retaining branches. Before integration, check ownership and uncommitted changes. Destructive reset/clean, rewriting original history or pushing complete local history to the clean public main are prohibited.
5. One writer updates sources, tasks, Wiki, checkpoints/handoffs and English mirrors. Retain historical R17/research 600-second FAIL results, trace gaps and device/science/Meta-live/external gates. Finishing this finite core scope does not complete full V1.
