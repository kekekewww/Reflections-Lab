<!-- english-source: {"path":"docs/08-ai/AI_TOOL_SCHEMAS.md","sha256":"48eb330d7c2f30dd544d61bd1dc75d0657569985696f1a0a9fd8db9c6340602f","translated_at":"2026-10-27T03:40:41Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/08-ai/AI_TOOL_SCHEMAS.md`](../../08-ai/AI_TOOL_SCHEMAS.md). Source SHA-256: `48eb330d7c2f30dd544d61bd1dc75d0657569985696f1a0a9fd8db9c6340602f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="ai-工具契約"></a>
# AI Tool Contracts

Status: Draft 2020-12 JSON Schema is provided; tool executors and provider integration **are not implemented**. The original Phase J text lists **11** tools; this research adds `PreviewSceneChanges` for a total of 12, explicitly as a safety-preview extension rather than an original twelfth item. Apply/Undo are trusted host operations.

<!-- english-original-anchor --> <a id="檔案與界線"></a>
## Files and boundaries

| File | What it validates |
| --- | --- |
| `schemas/ai-tool-request.schema.json` | Envelopes for 12 request types and `$defs/<ToolName>` parameters; mutations require non-null transactionId; execution/analysis tools require null. |
| `schemas/ai-tool-result.schema.json` | Status, artifact IDs, metrics, errors, and usage returned by the host/solver. |
| `schemas/ai-scene-change-set.schema.json` | Host-managed transaction records and preview/approval metadata. |
| `schemas/ai-provider-config.schema.json` | Secret-free provider gates, capability verification, and cost/resource budgets. |

Relative `$ref` resolves only the files above inside the repository; the validator must not arbitrarily download schemas from the network. All objects forbid extra fields; numeric NaN/Infinity are rejected at the JSON parser layer. JSON Schema `format` requires an enabled format checker; the host separately checks datetime freshness.

<!-- english-original-anchor --> <a id="操作清單"></a>
## Operation list

Common envelope: `schemaVersion:"1.0.0"`, `requestId`, `sceneId`, `expectedSceneRevision`, `transactionId`, `tool`, and `arguments`. The host issues requestId to a restricted dispatcher; it is not a permission token. Revisions and IDs must be consistent within the same scene/transaction. Except for room creation, dimensions are full dimensions; see AI_SCENE_CONTROL for detailed domain conditions.

| Tool | Required arguments | Bounds and side effects |
| --- | --- | --- |
| CreateScene | label, roomDimensionsM, surfaceMaterialId, seed | New scene; origin at the center of the room floor, dimensions `[X,Y,Z]`; 6 fixed surfaces initially sharing a material. Stage only; cannot overwrite. |
| AddObject | objectId, label, shape, dimensionsM, positionM, orientationQuaternion, materialId, mode, massKg | box/sphere/capsule; dimensions 0.01–100m, mass 0.001–10,000kg; stage. |
| SetMaterial | objectId, materialId, materialRegistryRevision, scope | acoustic/physics/both; registry fields must exist and versions must be retained; stage. |
| SetRigidBodyMode | objectId, mode, velocityPolicy | dynamicGravity/dynamicNoGravity/fixed/kinematic; zero/preserve/restoreSnapshot; stage. |
| ConfigureSoundSource | sourceId, objectId, signalId, mode, gainDbfs, referenceFrequencyHz | continuous/impact; −80 to −6dBFS, 20–20,000Hz; does not automatically start sound; stage. |
| MoveListener | listenerId, positionM, orientationQuaternion | Production listener; separate from the editor camera; stage. |
| SetTrajectory | objectId, interpolation, samples | linearSlerp/recordedTrace; 2–64 points, 0–30 seconds; ordered times, non-fixed body, source trace verification; stage. |
| RunSimulation | backendId, durationS, timeStepS, seed, replayTraceId, maxReflectionOrder, sampleRateHz | 0.1–30 seconds, steps of 1/60 or 1/120, order 0–2, 44.1/48kHz; execute only supported capabilities; return a run artifact. |
| CaptureExperiment | runId, label | Completed runs only; save immutable snapshot/metadata references, without writing its own numerical values. |
| AnalyzeAcousticResults | runId, metrics, bandCentersHz | At most 8 metrics and 6 specified bands; analyze only actual artifacts; return unavailable for missing data. |
| CompareExperiments | baselineExperimentId, candidateExperimentId, metrics, requireMatchedMotionTrace | requireMatchedMotionTrace is fixed at true; check settings/method/motion comparability and output computed deltas. |
| PreviewSceneChanges | includeCollisionCheck, includeAcousticCostEstimate | Both flags are fixed at true; the host writes a preview artifact and identifies capability gaps; no commit. |

JSON Schema does not silently supply defaults; all required fields must be explicit, and nullable fields must explicitly pass null. The domain validator still checks shape, applicability of source frequencies, source count, signal mappings, and valid material coefficients. For broadband signals, `referenceFrequencyHz` is an analysis reference; it does not mean that all signal energy is at that frequency.

<!-- english-original-anchor --> <a id="與-scenespec-的轉換"></a>
## Conversion to SceneSpec

Tool parameters are a command contract and cannot be directly spread into `scene.schema.json`. `expectedSceneRevision` is a request precondition corresponding to the `sceneRevision` read by the host; the revision increments only at commit. The ID pattern, mode, geometry dimensions, quaternion, and ±200m coordinates are aligned with the root contract.

`materialId` is a controlled preset ID on the tool side; the host must resolve it to SceneSpec's `physicsMaterialId`/`acousticMaterialId`, obtain friction and restitution from a versioned registry, and select acousticRole by explicit rules. Reject if no usable preset exists, a scope is missing, or parameters are unsupported; do not guess based on the name alone. `SetMaterial(scope:"both")` must likewise resolve both kinds of data; do not put acoustic absorption into friction.

The host allocates CreateScene's 6 surfaces and listener ID and returns them in staged context; the model references only those IDs in the next turn. Labels such as ball/wall are editor metadata; `referenceFrequencyHz` is signal/analysis metadata, with no field in the current SceneSpec. The host must save it in the corresponding versioned metadata or return CAPABILITY_UNSUPPORTED, rather than silently discarding it. A source's initial setting is playing=false; listener attachment remains explicitly independent/fpsHead. These converters are not currently implemented.

<!-- english-original-anchor --> <a id="provider-schema-與本地-schema"></a>
## Provider schema and local schema

The entire operation union cannot be used directly as a Meta strict schema. The subset required by the [official Structured output documentation](https://dev.meta.ai/docs/structured-output) does not include `oneOf`/`allOf` used locally. For each `$defs/<ToolName>`, the adapter must expand non-cyclic refs and emit plain-object tool parameters individually; all properties required, additionalProperties:false at every level, and null used for genuinely nullable fields. The full local schema/domain/policy validation still runs afterward.

The provider receives only tool parameters and restricted context; a trusted dispatcher supplies host metadata such as scene/revision/transaction, and the model cannot change the authorized scene. Successful compilation of `strict:true`, complete argument streaming, and refusal/truncation handling must be tested in practice; in this work, `NOT RUN`. The host schedules only after a complete function_call and completed JSON parsing. [Official Tool calling documentation](https://dev.meta.ai/docs/tool-calling)

The official documentation specifically states that a function tool's `strict` flag currently controls only the server's strict-subset check of the parameters schema; it cannot replace local argument validation or guarantee that tool arguments have correct scene semantics. Test structured-output decoding constraints separately from the purpose of this flag.

<!-- english-original-anchor --> <a id="回傳錯誤與使用量"></a>
## Returns, errors, and usage

`state` is queued/running/succeeded/failed/cancelRequested/canceled/timedOut/budgetExceeded. queued and running return only progress metadata, without final metrics; failed partial solver artifacts may be retained for diagnostics but are not displayed as completed values. cancelRequested does not mean the process has stopped; canceled requires worker acknowledgement. Only succeeded can proceed to Capture/Analyze.

Errors have fixed fields `code, message, retryable, fieldPaths, retryAfterMs, detailsArtifactId`. Do not return secrets, internal stacks, or untrusted HTML verbatim. Common codes: SCHEMA_INVALID, DOMAIN_INVALID, UNKNOWN_ID, REVISION_CONFLICT, POLICY_DENIED, PREVIEW_REQUIRED, APPROVAL_REQUIRED, PROVIDER_UNVERIFIED, MODEL_UNAVAILABLE, CAPABILITY_UNSUPPORTED, QUOTA_EXCEEDED, BUDGET_EXCEEDED, TIMEOUT, CANCELED, SOLVER_FAILED, INSUFFICIENT_DATA, INCOMPATIBLE_EXPERIMENTS, INTERNAL_ERROR.

Only transient 429/connection errors may be retried under policy, at most 2 times; do not blindly resubmit schema, policy, ID, or revision errors. If the transport outcome is unknown, first query the host ledger using requestId; retries must not duplicate simulations or scene mutations.

Usage records wallTimeMs, solverSteps, inputTokens, outputTokens, estimatedCostUsd, and actualCostUsd; unknown actual cost or provider token usage is null, not a fabricated measured 0. Offline fixtures have a cloud cost of 0, and their metadata must mark them as fixture.

<!-- english-original-anchor --> <a id="結果來源"></a>
## Result provenance

Every metric record requires metricRecordId, metricId, band, value, unit, availability, provenance, evidenceArtifactId, runId, methodId, backendVersion, materialRevision, validationLevel, and limitations. When `availability != available`, value must be null. Time metrics use seconds and cannot be negative; DRR/C50/C80 use `dB_ratio`, without confusing them with dBFS or dBSPL.

The schema limits numerical provenance to measured/computed/estimated; textual explanations separately have the fixed `ai_generated_explanation` label and cite metricReferences. This prevents mislabeling, but JSON content itself is not authentication: only host-produced artifacts with verifiable hashes can serve as evidence. The host still checks mappings among metricRecordId, runId, and evidenceArtifactId, unit comparability, V levels, and producer provenance.

Offline contract validation uses the project's shared AJV 8.17.1 validation workflow: `npm run validate:schemas`; positive and negative fixtures run through `tests/integration/schemas.test.mjs` in `npm test`. Actual results on 2026-10-26: all 8 repository schemas compiled in strict/strictTypes mode; the 4 AI schemas also independently compiled with 4/4 PASS. All 11 contract test groups passed, covering positive cases for 12 tools and negative cases including out-of-bounds dimensions, extra fields, incorrect transactionId, unverified provider, offline network/cost, insufficientDecay missing values, provenance, and transaction digests. Refer to `docs/06-validation/` and shared test output for complete results.

These are all offline contract-level validations; the domain executor, real acoustic values, provider contract, and account API remain `NOT RUN`. Passing fixtures must not be interpreted as completed integration.
