<!-- english-source: {"path":"docs/14-core-pipeline/stages/08-motion-experiment.md","sha256":"42b21e4da4e97e2a9cf16f3aee8ba0a40fb7dd608361a43713f982e54ae4a3d0","translated_at":"2026-11-02T05:50:42.625Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/08-motion-experiment.md`](../../../14-core-pipeline/stages/08-motion-experiment.md). Source SHA-256: `42b21e4da4e97e2a9cf16f3aee8ba0a40fb7dd608361a43713f982e54ae4a3d0`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="stage-08作者-motion--實驗錄製接線"></a>
# Stage 08: Authored Motion → experiment recording connection

Date: 2026-11-02. Scope: local isolated physics execution in the production `ExperimentToolHost`. SceneSpec/AI Tool schemas, Runtime UI and persistent memory were not changed.

<!-- english-original-anchor --> <a id="問題與實作"></a>
## Problem and implementation

Previously, `RunSimulation` created a new Rapier world but did not execute authored actions in `physicsConfig.motionRegistry`. As a result, an experiment recording could still contain only free fall after a successful `SetTrajectory` commit. This stage adds `prepareExperimentMotion()`: the simulation internally consumes an immutable snapshot of trusted configuration and installs authored actions in real `MotionWorkspace` fixed-step observers.

A nonempty registry first passes complete, bounded, closed JSON validation, then matches the authored scene's ID/revision/canonical SHA-256 pin. At most eight actions can run simultaneously, with only one action per object. Multiple actions for one object, stale pins and invalid body modes/first points/fields are explicitly rejected; no single action is silently selected and no partial recording is published. After every action has been registered successfully in its original array order, the existing tick0 append → resume → fixed-step recording sequence is preserved. moveTo, moveAndRelease, trajectory and impulse reuse the existing controllers, without adding teleports or extra recorded ticks.

Each experiment creates an independent world. An author's generation after reset can exceed1; the source generation is not falsely presented as equal to the clone world's generation. Trusted projection rebinds only for the new experiment world. The recorded `physicsConfig` contains:

- `motionRegistry`: the runtime registry actually installed, including runtime pin/generation/import revision.
- `motionExecution.sourceRegistry` / `sourceRegistrySha256`: the original authored JSON and its SHA-256, preserving author revision, pin, generation and parameters.
- `runtimeRegistrySha256` / `generationBindings`: the hash of actual execution contents and per-action author → runtime generation mappings.
- `policy` / `rebindReason`: explicit simultaneous-start and one-action-per-object policies, and the reason for isolated-world rebinding.

When a different seed is requested, the original authored scene pin is verified first, then the new seed's runtime pin is explicitly recorded without silently changing authored contents. An absent registry or a valid empty registry preserves existing behavior without Motion. An empty sidecar has no actions, so an old pin after ordinary scene edits does not block pre-existing functionality.

Cancellation/deadline is checked after every setup await. If setup fails, the helper releases the workspace it created. Whether simulation succeeds, is canceled, times out or throws, finally disposes the workspace before disposing the world. Replay takes the existing reprocess path before world creation, using the original pose trace/physics provenance rather than executing current authored Motion again.

<!-- english-original-anchor --> <a id="驗證"></a>
## Verification

The new `tests/app/motion-experiment-pipeline.test.ts` has eight cases that execute local Rapier/Behavior/acoustic recording with actual poses:

1. AI trajectory preview/commit → RunSimulation:13 frames (tick0–12), final-pose displacement greater than0.15 m and tick0 AlwaysOn retained. Original configuration remains unchanged and source/runtime hashes can be recomputed. The same test replays with a stale current pin, proving it reuses the original trace/physicsConfig without a second execution.
2. A bounded impulse from author-world generation2 after reset actually moves clone-world generation1, recording the2 →1 mapping.
3. Rejects a stale scene pin.
4. Rejects two actions for the same object.
5. Rejects unknown JSON fields.
6. Rejects nonfinite JSON numbers as DOMAIN_INVALID.
7. Cancellation checks motion → world disposal order, cleared active controllers and no publication of a partial run.
8. Timeout checks the same cleanup and atomic-publication guarantees.

Executed:

- `node --import tsx --test tests/app/motion-experiment-pipeline.test.ts`:8/8 PASS.
- `node --import tsx --test tests/app/motion-experiment-pipeline.test.ts tests/app/experiment-tools.test.ts tests/app/agent-experiment-workflow.test.ts tests/physics/motion-generation-projection.test.ts`:38/38 PASS (before adding the nonfinite-JSON case). The final new positive/negative cases ran separately with8/8 PASS.
- `npm run typecheck`:PASS.
- `node node_modules/eslint/bin/eslint.js src/app/motion-experiment.ts src/app/experiment-tools.ts tests/app/motion-experiment-pipeline.test.ts`:PASS.
- Prettier for the three designated files: formatted. Independent read-only agent review found no blocking issue.

Limits: this is V1 local numerical/pipeline evidence. It adds no browser, hearing, audio-device or Meta live evidence. It implements no multi-action timeline or automatic scheduling; more than eight actions must first be split into explicit tasks. This stage cannot establish complete first-version acceptance. The integration root agent consolidates stages/commits, updates long-term memory and prepares the Claude handoff.
