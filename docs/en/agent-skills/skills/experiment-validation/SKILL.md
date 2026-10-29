<!-- english-source: {"path":".agents/skills/experiment-validation/SKILL.md","sha256":"608d26bc360e3be4ffae0851d1214a64271dc05e1cfc4f078bd4941dca2cf70f","translated_at":"2026-10-27T05:41:23.2284408Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: experiment-validation
description: Handle Reflection Lab experiment recording, snapshots, motion replay, A/B conditions, result provenance, and reproducibility validation.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/experiment-validation/SKILL.md`](../../../../../.agents/skills/experiment-validation/SKILL.md). Source SHA-256: `608d26bc360e3be4ffae0851d1214a64271dc05e1cfc4f078bd4941dca2cf70f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="實驗驗證"></a>
# Experiment Validation

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

When recording/replay, capture, or A/B comparison changes, confirm that the comparison uses the same input conditions.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

experiment manifests, scene/material/trace hashes, solver/physics versions, metric method, and desired comparison.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read docs/07-experiments; distinguish motion playback, pinned resimulation, and a fresh physics run.
2. Check scene/asset hashes, tick order, body IDs, pose and contact trace, sample rate, geometry, and quality.
3. Reuse the same motion when changing only acoustic parameters; changes to mass/friction/restitution require a new run and must be labeled as multiple factors.
4. Attach Measured/Computed/Estimated, units, method, validity, and artifact ID to results; AI explanation is not a numerical source.
5. Explicitly mark insufficient RT decay, noise floor issues, and unsupported metrics unavailable; do not substitute 0.
6. Commit the manifest atomically at the end of capture; do not mark failed/canceled captures Captured.

<!-- english-original-anchor --> <a id="references"></a>
## References

`docs/07-experiments/`, `schemas/experiment.schema.json`, `docs/06-validation/`, `docs/08-ai/AI_EXPERIMENT_AGENT.md`.

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Replayable artifacts, an A/B match report, errors, validation level, and missing conditions.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

`npm run validate:schemas`; additionally validate pause/seek/cancel/roundtrip for the full recorder. Do not treat mathematics tests as end-to-end recording/replay.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Reject a matched comparison when hashes, ticks, or versions differ; retain diagnostics and optionally start a separate unmatched fresh run. Do not silently correct data.
