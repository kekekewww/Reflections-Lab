<!-- english-source: {"path":"docs/14-core-pipeline/stages/04-meta-workflow.md","sha256":"41eff0afc57451447eb62d5eebd66f86055bfad7f742f7ffb55715fc46476bd3","translated_at":"2026-11-02T05:31:47.069Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/14-core-pipeline/stages/04-meta-workflow.md`](../../../14-core-pipeline/stages/04-meta-workflow.md). Source SHA-256: `41eff0afc57451447eb62d5eebd66f86055bfad7f742f7ffb55715fc46476bd3`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-可信實驗工作流程核心"></a>
# Meta trusted experiment workflow core

Executor: Codex subagent `meta_core/experiment_workflow`. Development branch: `codex/pipeline-meta`; the root agent records the final integration commit.

<!-- english-original-anchor --> <a id="實作"></a>
## Implementation

- `TrustedExperimentWorkflow` reuses the product's `RunSimulation`, `CaptureExperiment`, `AnalyzeAcousticResults` and `CompareExperiments` tools. It does not modify Scene directly or apply changes on the user's behalf.
- The baseline fixes duration,60 Hz, seed and sample rate. The candidate references the baseline run's motion trace; incompatible physics, geometry or Listener follows the existing Host rejection policy.
- Each step accepts only a `succeeded` result with matching request ID, Scene revision and artifacts. Failure, incomplete work, empty artifacts or a revision change preserve completed results and stop later steps.
- Numerical explanations come only from grounding artifacts in the Host catalog, after checking run, full hash and metric records. Missing values remain unavailable; model or protocol fixtures are not measurement sources.
- Cancellation first requests the Host and awaits its result. If the Host already succeeded, that success is retained and only the remaining workflow stops. Only an explicit `canceled` response sets `cancelAcknowledged`.
- `getView()` exposes baseline/candidate runs, captures, analysis and comparison artifact IDs, step results and citations for integration into the existing interface.

<!-- english-original-anchor --> <a id="基本驗證"></a>
## Basic verification

Executed:

```text
node --import tsx --test tests/app/agent-experiment-workflow.test.ts
exit 0; tests 8; pass 8; fail 0; skipped 0
```

One case creates a real Rapier/Behavior/geometric-acoustics Host and completes a0.2-second baseline (13 frames), an acoustic-material-only change, a same-motion candidate, Capture/Analyze/Compare and a source-cited explanation. Other negative cases cover stopping on failure, unknown success, cancellation acknowledgment, stopping after success, revision races, missing/tampered/wrong-run grounding and invalid input.

This evidence is local Computed functional verification, not Meta live, browser visual verification, device hearing or600-second performance acceptance. No external model was called and no new costs were incurred. After integration, the root agent performs formatting, type, UI and complete-pipeline checks.
