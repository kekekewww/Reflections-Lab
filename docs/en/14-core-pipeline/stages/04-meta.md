<!-- english-source: {"path":"docs/14-core-pipeline/stages/04-meta.md","sha256":"cd85b0e37287f0a69fa64d48cbd9c639faea561f57cd7c005726c568f16a99a6","translated_at":"2026-11-02T05:31:47.063Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/04-meta.md`](../../../14-core-pipeline/stages/04-meta.md). Source SHA-256: `cd85b0e37287f0a69fa64d48cbd9c639faea561f57cd7c005726c568f16a99a6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="stage-04meta-產品工作流程核心"></a>
# Stage 04: Meta product workflow core

Date: 2026-11-02 (Asia/Taipei). Development executor: Codex; feature branch `codex/pipeline-meta`; baseline `429efb7597ec913bd879ecc05c29a6be7ad5175c`. This report records this branch's code and basic tests. It does not declare full V1 or Meta live complete.

<!-- english-original-anchor --> <a id="實作"></a>
## Implementation

- `server/meta-budget-ledger.ts`: a general persistent authorization ledger, separate from the historical ledgers for three live-validation runs. It pins authorization/model/data mode/rates/ceiling; every HTTP attempt reserves first, with no refunds, and integer monetary units prevent floating-point overspending. Each mutation uses an exclusive file lock, the original hash and an atomic rename. Restart preserves active/uncertain states; unknown outcomes reject retransmission, while a completed response with the same ID/hash can be retrieved again. It records only hashes, bounded provider outputs and usage; API keys, input messages and headers never enter the ledger. Actual billing/remaining credit remain null.
- `server/meta-provider.ts` / `cli.ts`: request identity is installed before the transport callback. Each retry first persists its reservation; cancellation or unconfirmed transport leaves an uncertain state, and received but unaccepted proposals are not applied. A real network adapter requires a persistent ledger. The CLI opens it only when the original provider gate is authorized READY; the network=false/budget=0 defaults are unchanged. After restart, usage reads the persisted cumulative values. Tests can still inject fixture transports.
- `server/app.ts` / `src/ai/client.ts`: the same `X-Reflection-Request-ID` and content share a result; different content is rejected. A local cancellation endpoint distinguishes a cancellation request from a confirmed result. HTTP still grants no scene Apply or budget/config-setting authority.
- `AgentSession`: preserves proposal → local preview → Apply/Undo and adds planning generation/AbortSignal protection. A late live response after cancellation cannot create an applicable preview. Explicit `runExperiment` / `compareExperiment` actions do not overlap planner/Apply execution; cancellation preserves completed steps and Host acknowledgments.
- `TrustedExperimentWorkflow`: the baseline runs RunSimulation → CaptureExperiment → AnalyzeAcousticResults. The candidate reuses baseline motion trace, seed, duration and sample rate, then captures/analyzes/compares. Each step requires a matching request/revision, explicit succeeded status and artifact IDs. The user still previews/applies candidate material changes first; the workflow does not modify the scene automatically.
- `ExperimentToolHost.getGroundingArtifact`: analysis and comparison publish immutable analysis artifacts created from actual computed records, with hashes retained. A trusted resolver and `explainVerifiedMetrics` produce Host explanations with metric/artifact/run citations. Unsupported metrics stay null rather than being filled in by the model.

<!-- english-original-anchor --> <a id="基本驗證"></a>
## Basic verification

- Final `node --import tsx --test tests/ai-runtime/*.test.ts tests/app/agent-experiment-workflow.test.ts tests/app/experiment-tools.test.ts`: 183/183 PASS, 0 fail, 0 skip, exit 0. Receipt: [04-meta-final-validation.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/c9474af71b15f5c46d1a5fc14fe8c72a6058a2a6).
- Existing provider regressions plus the new core: 27/27 PASS, including persistent restart deduplication, blocking dispatch after unknown/cancel, HTTP identity conflicts and late live cancellation. Receipt: [04-meta-provider-validation.txt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/dc1b459c1a087d80c2944120621a295961dcd5ea).
- Workflow: 8/8 PASS. One case uses real Rapier, Sound Behavior, geometric acoustics and ExperimentToolHost for baseline → acoustic-material-only change → same-motion candidate → comparison → grounding; it is not a model or Host-success stub.
- A previous scope had one synchronous active-request regression: 85/86. The [initial receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8e09a5b8c352c532d9f799dcf1203b209f8ff2ea) is retained. The fix installs the identity promise before synchronous dispatch, without changing the original test or tolerances; the final complete scope passes.
- The first new-ledger fixture used a special Windows sandbox temp directory, where atomic-rename replacement failed with EPERM. Fixtures moved inside each worktree's `.cache` and verify the absolute parent before cleanup. Production atomic rename and locks remain; deleting the destination is not used as a replacement. The final scoped suite includes these persistent-file tests and all pass.
- TypeScript, formatting and ESLint results are recorded in the [static receipt](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8ab060b50fccedc01b3fe29228aac89d2794cb59).

<!-- english-original-anchor --> <a id="整合接口與限制"></a>
## Integration interface and limits

Root integration must pass `resolveGroundingArtifact: id => experimentTools.getGroundingArtifact(id)` and `cancelTool: id => experimentTools.cancel(id)` in `AgentSessionOptions`. The UI reads `getWorkflowView()` or `getView().workflow`, calls `runExperiment()` / `compareExperiment()` / `cancel()`, and publishes state through the existing onChange. The workflow's baseline/candidate `runId` can retrieve a complete take through `ExperimentToolHost.getRun` for the offline renderer; it does not automatically switch RecordingHost.current.

The Stage 05 AI bridge supplies Motion transaction hooks. Root integration must forward them from AgentSession options into the Scene adapter. This branch avoids its `types.ts` / `host.ts` / `scene-adapter.ts` ownership. Stage 03 supplies Sound producer capability/schema; actual OnBounce comes from PhysicsWorld, not a velocity guess here.

Every model transport in this round is an injected fixture. There were no paid Meta requests, and fixtures were not relabeled live. The persistent ledger is a single-machine authorization cap, not multi-user cloud billing/auth; unknown locks require human investigation and are never stolen automatically. Physical-device hearing,600-second performance requalification and full V1 completion were not performed. After root integration, browser workflow, Motion sidecar, export UI and Computer Use audio verification remain, followed by independent Claude Code review.
