<!-- english-source: {"path":"docs/14-core-pipeline/stages/05-motion.md","sha256":"7a591f832f947b127824fdd2606b0065dbece22dfea057cfe33328d7e5b3c4a1","translated_at":"2026-11-02T05:27:54.6367902+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/05-motion.md`](../../../14-core-pipeline/stages/05-motion.md). Source SHA-256: `7a591f832f947b127824fdd2606b0065dbece22dfea057cfe33328d7e5b3c4a1`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第五階段motion-動作作者與固定步控制核心"></a>
# Stage 05: Motion action authoring and fixed-step control core

Date: 2026-11-02 (Asia/Taipei). Baseline: 429efb7597ec913bd879ecc05c29a6be7ad5175c. Implementation and tests: Codex (motion_core); the AI transaction bridge was implemented by a subagent with isolated file ownership, with additional independent read-only specification and code reviews. This stage does not claim full V1, formal performance, human or device acceptance complete.

<!-- english-original-anchor --> <a id="已實作"></a>
## Implemented

- A Motion Registry JSON sidecar outside SceneSpec v1: stable action ID, action/registry revision, body generation, a full canonical SHA-256 scene pin, at most64 actions and a1 MiB import limit. Authoring save/remove/undo/redo/rebase all validate the expected registry revision; failed imports preserve existing contents.
- Move To, Move & Release and bounded impulses; linearSlerp trajectories (2–64 samples, at most30 seconds). One motion owner per body, at most8 simultaneous controls,2048-command deduplication and128 execution receipts.
- PhysicsWorld before/after-fixed-step observers run only on real solver ticks. Dynamic bodies use bounded impulse/torque servos and retain contact solving; Kinematic bodies use the existing target shape sweep and end-pose overlap. Pause freezes the cursor. Cancellation, timeout, blocking and epoch/generation/scene changes produce separate receipts.
- Kinematic Move & Release explicitly selects zero or transfer; transfer uses finite differences between adjacent, actually accepted tick poses and is constrained by linear/angular velocity caps. Dynamic bodies can preserve actual solver velocity or explicitly select zero. Motion does not invent player Grab/Throw/Release events.
- MotionPanel reuses existing NumberField, Badge and vector/axis/button classes and includes Traditional Chinese/English. It provides target/impulse editing, execution, cancellation, history, JSON export/import and explicit scene rebinding. Root owns App/Dock/Controller connections.
- AI SetTrajectory joins preview/apply/undo through MotionTransactionHooks: the digest includes the full sidecar before/candidate. Pure motion does not invent a scene revision. Mixed transactions atomically validate scene+motion revisions through one trusted runtime callback. The Host fully compares the actual published contents. recordedTrace is explicitly rejected without a trusted original trace.

<!-- english-original-anchor --> <a id="runtime-整合-api"></a>
## Runtime integration API

MotionWorkspace.create(scene, world, {getScene,onChange}) is async. It provides getSnapshot, stable getView, subscribe (progress published at most every6 fixed ticks), save/remove/undo/redo/rebase, start(actionId,commandId), cancel(runId), bindWorld(world), exportJson/importJson and dispose. start acquires only the motion owner; runtime must still explicitly resume physics. Call bindWorld when replacing the World. A reset of the same World retains observers, while generation/epoch changes visibly reject or invalidate work.

The AI hooks' getSnapshot returns {namespace:'motion',revision,document}; preview calls workspace.previewTrajectories(requests,candidateScene); commit/restore calls withExternalTransaction(candidateDocument,expectedDocument,candidateScene,commitSceneCallback). Root must implement the trusted callback through existing atomic scene preparation/commit, rather than publishing the Scene first and arbitrarily writing the registry afterward.

Standalone Motion JSON export already provides a scene pin. Project/recording references and the root UI download entry are connected during integration. Action JSON is not a native Rapier world snapshot that can be solved again.

<!-- english-original-anchor --> <a id="基本驗證與審查"></a>
## Basic validation and review

- New real-Rapier Motion regressions: 12/12 PASS; original output is in 05-motion-tests.txt. Cases include thin-wall blocking, reached, pause/cancel, zero/transfer release, impulse dedup, import/revision, failed scene commit, trajectory start pose, reset observers and sparse-JSON negatives.
- New AI transaction8 cases plus existing host/scene integration total29/29 PASS; see 05-motion-ai-validation.txt.
- Initial Motion and existing physics-world/motion-hysteresis/AI scoped regressions:67/67 PASS. Later reset/sparse repairs are covered by the12 cases above; overlapping counts are not added together.
- Scoped ESLint exit0; Prettier applied. The machine-readable receipt records the final TypeScript result.
- Independent code review found3 issues: reset observers, sparse JSON and kinematic-acceleration labeling. The first two were fixed with real regressions. The third explicitly limits the field to Dynamic-servo acceleration and disables it for Kinematic.

<!-- english-original-anchor --> <a id="限制與-claude-code-接手"></a>
## Limitations and Claude Code handoff

- Dynamic-servo parameters are Tuned control policies, not measured material models. maxAccelerationMps2 limits only the Dynamic servo's effective control acceleration. Kinematic uses bounded next poses and has no acceleration-curve authoring yet.
- Kinematic rotation has only end-pose overlap and finite angular velocity, without rotational swept-volume CCD.
- Accepted action receipts and authoritative recording poses are traceable. Motion Registry is not a complete command stream/world snapshot for solving the world again.
- Root integration verifies actual runtime atomicity of the AI scene+motion callback, Dock/Controller, Project/recording sidecar references, browser visuals/input and complete computer-use output. This branch ran neither browser tests nor Meta live.
- On integrated main, Claude Code should reverify MotionPanel, author undo/rebase, rerunning after reset, failed AI mixed-transaction restoration and motion → recording → output. Formal600-second performance remains separately subject to validation.
