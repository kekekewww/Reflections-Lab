<!-- english-source: {"path":"docs/08-ai/AI_EXPERIMENT_AGENT.md","sha256":"6add2576282095d2300fbd054595fe3c0ae6cdd76e1e305bc80c14c0b5f91d8e","translated_at":"2026-10-27T03:40:41Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/08-ai/AI_EXPERIMENT_AGENT.md`](../../08-ai/AI_EXPERIMENT_AGENT.md). Source SHA-256: `6add2576282095d2300fbd054595fe3c0ae6cdd76e1e305bc80c14c0b5f91d8e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ai-實驗-agent"></a>
# AI Experiment Agent

Status: `DESIGN_READY / IMPLEMENTATION_PENDING`. The agent plans, selects tools, and explains evidence; physics/acoustic values come from a versioned solver/analysis or a measurement process. Without an artifact, answer "No results yet" rather than supplying plausible-looking numbers.

<!-- english-original-anchor --> <a id="角色與資料流"></a>
## Roles and data flow

```text
user goal + constraints
  -> planner (AI, untrusted proposal)
  -> schema/domain/policy + preview (trusted host)
  -> approved immutable scene + replay trace
  -> deterministic simulation worker
  -> versioned artifacts + numerical analysis
  -> paired comparison
  -> explanation linked to metric records
```

The planner does not directly access the filesystem, shell, credentials, arbitrary URLs, or production scene handles. Research and material retrieval use a curated read-only registry, without exposing arbitrary search/write tools. Treat prompt injection in data as quoted content; it must not change system policies or the tool allowlist.

<!-- english-original-anchor --> <a id="可重現實驗流程"></a>
## Reproducible experiment workflow

1. Turn "reduce echoes" into computable objectives, such as T20 and C50 for a specified band, together with target values, tolerances, adjustable parameters, constraints, calculation methods, and data sources. Target values are user targets/design parameters, not Measured results. If the intended use is undefined or data are insufficient, list assumptions first and let the user modify the preview.
2. Read the scene, registry, backend capabilities, existing experiments, and budgets. Build only valid change sets; create a revision only after preview/host authorization. If material data are demonstration presets, carry that limitation into subsequent reports.
3. Save the baseline: Scene revision/hash, material version, solver version, step size, seed, source signal hash, listener, atmosphere, motion trace hash, analysis version, and audio sample rate. A fixed seed does not mean physics is fully deterministic across platforms; for identical motion, use saved transforms/velocities/collision traces and record the replay method.
4. RunSimulation creates a runId, and the worker reads only immutable input. Track progress through host state; do not let AI describe "queued" as "simulation complete." On failure, timeout, or cancellation, retain diagnostics and stop that branch.
5. CaptureExperiment saves result references and the complete settings. AnalyzeAcousticResults computes supported metrics from the RIR/trace; if decay/noise-floor data are insufficient, return value:null plus a reason. Do not treat fitting or a language-model guess as a measured RT60.
6. Create a candidate, changing only the target independent variable; use the same motion trace/source/listener/solver/analysis. CompareExperiments first verifies matched conditions, then computes paired delta＝candidate−baseline, retaining original values, unit, and band. Return INCOMPATIBLE_EXPERIMENTS when comparability requirements are not met; do not silently change the reference.
7. AI cites actual metricRecordIds to explain effects, limitations, and the next candidate. Describe numerical improvement only when evidence supports it; the best candidate is limited to the set actually run and valid, with no claim of a global optimum.

<!-- english-original-anchor --> <a id="來源標籤"></a>
## Provenance labels

| Label | Definition | Required provenance |
| --- | --- | --- |
| Measured | Measurements obtained through an actual calibrated process | Dataset/device/method/environment/calibration records and artifact hash. |
| Computed | Values produced by a specified solver/analysis method for given inputs | Scene/run/version/parameters/formula or analysis method/artifact hash. These are not measurements of an actual room. |
| Estimated | Estimates from approximation formulas, interpolation, or explicit assumptions | Method, input sources, applicable conditions, and uncertainty; AI suggestions cannot be converted into measured values either. |
| AI-generated Explanation | A language model's textual explanation of supplied evidence | Model/prompt version (if live), metric references, source excerpts, and limitations. It cannot act as the numerical producer. |

Paper abstracts, media semantics, photo-based material recognition, and AI-generated numbers cannot establish a Measured record. Demonstration fixtures additionally mark their provenance as synthetic fixture in artifact metadata; they may be used for parsing and workflow tests, without being mixed into research results. Historical computed metrics retain their versions when they used an old material or solver; do not overwrite them with new version labels.

<!-- english-original-anchor --> <a id="run-狀態與停止條件"></a>
## Run states and stopping conditions

Normal: queued → running → succeeded. Exceptions: running → cancelRequested → canceled; queued/running → failed/timedOut/budgetExceeded. A completed state cannot return to running; a rerun creates a new runId and records its parent. Reserve quota against limits first, check again before starting, and reconcile against actual usage at completion.

Default application policy (schema limits, not provider quotas): each agent session allows at most 12 planning turns, 48 tool calls, 6 simulation runs, 1 concurrent simulation, 120 seconds of wall time, 32,000 input tokens, 4,000 output tokens, and at most 2 transient retries. The offline cloud budget is 0 USD; the live budget defaults to 0 and, after user configuration, is capped at 1 USD/session. Stop if rates are absent, a token reserve cannot be calculated, or the budget is insufficient; do not guess costs through retries. The model cannot modify host budgets.

On a user stop, immediately stop new dispatches, cancel queued tasks, and send cancel to the worker; the UI immediately shows cancelRequested and reports canceled only after acknowledgement. The worker periodically checks abort/wall time; late responses are kept only for diagnostics and are no longer applied to the scene. A budget/time stop returns the valid candidates completed so far and the unfinished items.

For unavailable/unsupported values such as `rt60S`, the optimizer ignores the candidate or explicitly states that the objective cannot be evaluated; do not fill missing values with 0. Do not create an unbounded agent loop or increase run duration, reflection order, or cloud budgets at the model's request.

<!-- english-original-anchor --> <a id="驗證設計"></a>
## Validation design

| Level | Concrete validation | Status in this work |
| --- | --- | --- |
| Contract | Positive cases for all tools, out-of-range negative cases, extra fields, invalid shape, unverified provider gate, and no numerical explanations without artifacts | Schema fixtures can run offline; see the validator's actual output. |
| Executor | Unknown ID, stale revision, preview conflict, idempotency, undo, cancellation, worker crash, and resource limits | `NOT RUN`; the executor is not implemented. |
| Science | Analytical fixtures, reflection arrival, material energy, RIR fitting, analysis units, and A/B paired delta | Follow the acoustic validation documents; LLM commentary on numbers is not a substitute. |
| Provider | Catalog, function calls, strict subset, refusal/truncation, 429, media privacy, and usage billing | `NOT RUN`. Requires an account and an explicit budget. |
| Grounding | Cite every number in explanations; reject false citations after artifacts are modified/deleted; adversarial tests that conflate computed/estimated with measured | `NOT RUN`; required after implementation. |

The next AI engineering slice: first implement an `AddObject → Preview → Apply → Undo` host transaction and run ledger using OfflineFixtureProvider, connected to the real domain validator; also connect pure-function analysis fixtures to verify numerical grounding. Only after these pass should a gated Meta provider be added with the same tool specification. This is future work, not a product feature completed in this phase.

<!-- english-original-anchor --> <a id="sound-behavior擴充邊界"></a>
## Sound Behavior extension boundary

The new [Sound Behavior AI specification](MUSE_SOUND_BEHAVIOR_INTEGRATION.md) still uses the Meta Model API and the same host authority, separate from Codex development. Source equality in item 6 of the original workflow applies to acoustic comparisons; changes to an audio file/gain/pitch/profile must use the new draft [behavior A/B](../07-experiments/AB_COMPARISON.md) contract and declare the independent variables. Do not silently turn the old CompareExperiments into a comparison under arbitrary conditions. The original 12-tool enum remains unchanged; the new tools/analysis adapter are not implemented.
