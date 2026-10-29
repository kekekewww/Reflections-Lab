<!-- english-source: {"path":"docs/12-architecture-review/MUSE_AGENT_ARCHITECTURE.md","sha256":"47a3bd249c296190d37335839b06f93ad7e4a3759faa75d60938a43fbffead18","translated_at":"2026-10-29T05:22:55Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/MUSE_AGENT_ARCHITECTURE.md`](../../12-architecture-review/MUSE_AGENT_ARCHITECTURE.md). Source SHA-256: `47a3bd249c296190d37335839b06f93ad7e4a3759faa75d60938a43fbffead18`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="產品-meta-實驗-agent-架構審查"></a>
# Product Meta Experiment Agent Architecture Review

Review date: 2026-10-29 (Asia/Taipei). Code baseline: `c210ca882ca8503b322c28884bf1e9f6e9fe126d`; research workspace: `research/architecture-review-20261029`. This document contains **research and recommendations**, not adopted new features, account authorization, or complete V1 acceptance. This new research did not call paid models, read keys, increase budgets, or accept terms. Existing evidence is cited only within its original scope.

<!-- english-original-anchor --> <a id="1-結論與界線"></a>
## 1. Conclusions and Boundaries

The current direction is sound: an untrusted model proposes constrained tool parameters; the local Node service only plans; the browser's trusted host then validates the current scene/behavior revisions and presents a diff preview. Only the user's Apply commits a reversible transaction. Physics, sound behavior, and acoustics produce results through versioned code; the model cannot manufacture measured values. Using Codex for development and using Meta Model API in the product are separate matters. Under [ADR-013](../02-architecture/adr/013-codex-primary-development.md), successful Muse Code execution is not evidence of product Meta live integration.

The most urgent issues are **aligning advertised capabilities with actual tools**, **the security boundary between a local demo and a deployable service**, and **separating the historical minimal live test from evidence for the current complete product**. The original 12 tools are not the 13 names listed in this request; renaming them or writing a report cannot make missing implementations complete.

[AI_EXPERIMENT_AGENT](../08-ai/AI_EXPERIMENT_AGENT.md), [AI_TOOL_SCHEMAS](../08-ai/AI_TOOL_SCHEMAS.md), and [PHASE3_RUNTIME_AGENT](../08-ai/PHASE3_RUNTIME_AGENT.md) contain historical “not implemented” sections and the old Muse development workflow. Current code has progressed beyond some of those statuses. This document neither rewrites that history nor uses old headings to deny the current code. Requirements, adopted decisions, implementation, and actual tests are assessed separately.

<!-- english-original-anchor --> <a id="2-官方-meta-api-現況"></a>
## 2. Current Official Meta API Documentation

The following is a concise paraphrase of official public documentation checked on 2026-10-29. It does not mean this account has the same permissions.

| Item | What this review could verify and its design implications | Official source |
| --- | --- | --- |
| Models | `muse-spark-1.3` is still listed as the latest; 1.2/1.1 remain available. `muse-wonder-1.0` is now listed as Available, Standard only; the old preview description can only be retained as history. Wonder Full is limited to Muse Code. The public list cannot replace an actual team catalog check. | [Models](https://dev.meta.ai/docs/models) |
| Pricing and rate limits | USD per million tokens: Spark Standard input/cached/output = 1.25/0.15/4.25; Contributor = 0.10/0.002/0.20; Wonder = 4/0.20/20. The table lists 3,000 RPM/4M TPM for Standard and 150 RPM/3M TPM for Contributor, shared per team. Do not treat rate-limit headers as a billing balance. | [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits) |
| Custom tools | The host executes developer functions; `tool_choice` currently uses `auto`. Plain text replies without tools must be handled. `max_tool_calls` limits only built-in tools, so the host must still count custom loops; arguments must be complete before validation and execution. | [Tool calling](https://dev.meta.ai/docs/tool-calling) |
| Strict schema | The root is a plain object; objects are closed and all properties are required. oneOf/allOf are unsupported; anyOf is allowed only below the root; the depth limit is 10. Strict schema checks cannot establish that IDs, units, or scientific semantics are correct. | [Structured output](https://dev.meta.ai/docs/structured-output) |
| Protocol | The official recommendation for new agents is Responses; existing Chat Completions integrations can still be used, with different cross-turn reasoning behavior. There is no evidence requiring an immediate rewrite of the current adapter just because of that new recommendation. | [Choosing an API](https://dev.meta.ai/docs/protocols) |
| Data mode | Standard content not being used for training does not mean it is never retained. Contributor content may be used for training; ZDR requires separate enablement by Meta and excludes some features. This account's status is unverified. | [Data commitments](https://dev.meta.ai/legal/commitments), [ZDR](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention) |

The local `expandSchema` omits `uniqueItems` only from the wire schema, retaining the original AJV/domain uniqueness checks. The public structured-output page provides no guarantee for this keyword, so it cannot be claimed that the original observed 400 has been comprehensively fixed by Meta. See the [provider](../../../server/meta-provider.ts), [corresponding negative cases](../../../tests/ai-runtime/provider.test.ts), and [Sound negative cases](../../../tests/ai-runtime/sound-provider.test.ts).

<!-- english-original-anchor --> <a id="3-現行資料流與信任邊界"></a>
## 3. Current Data Flow and Trust Boundaries

```text
使用者目標＋當前受限 DTO
  → offline deterministic planner 或 Meta planner（server-only key）
  → 完整 JSON／封閉 schema／provenance 驗證
  → AgentHost 或 SoundProposalHost（當前 ID、revision、registry、budget）
  → 差異 preview＋digest＋expiry
  → 明示 Apply → scene／behavior 新 revision；Undo 另建 revision
  → 本機受限 Run／Capture／Analyze／Compare
  → immutable artifact＋hash＋method＋unit＋null availability
```

Code references: [server/app.ts](../../../server/app.ts), [MetaProvider](../../../server/meta-provider.ts), [AgentSession](../../../src/app/agent-session.ts), [AgentHost](../../../src/ai/host.ts), [scene adapter](../../../src/ai/scene-adapter.ts), [Sound host](../../../src/ai/sound-host.ts), and [ExperimentToolHost](../../../src/app/experiment-tools.ts).

The model has no shell, repository, arbitrary URL, provider/budget modification, or direct Apply tools. Nor can the Node endpoint directly commit a scene. The server uses client-supplied snapshots only for planning/preflight; the local host must revalidate against the actual current state. This layer cannot be omitted on the grounds that “the server already validated it.”

<!-- english-original-anchor --> <a id="4-共通政策已實作與限制"></a>
## 4. Common Policies: Implemented Behavior and Limitations

| Code / area | Actual behavior | Limitations / follow-up recommendations (PROPOSED) |
| --- | --- | --- |
| H: HTTP/authentication | The CLI binds to `127.0.0.1:8787`; checks localhost/127.0.0.1 Host, an Origin allowlist, JSON, a 256 KiB body limit, and a single active planner. It does not accept model, key, billing, or policy fields from the request. | This is a local boundary, not verified multi-user authentication, session isolation, or public rate limiting. A missing Origin still allows a local client; publishing it directly must not be described as completed authentication. |
| P: provider gate | Defaults are network=false, model=null, budget=0. Server configuration must supply a key, verified metadata, a pricing source, and a positive budget ≤US$1. Status quota is always null; liveValidation is NOT_RUN. | verifiedAt is checked only for a parseable date; no automatic expiry or catalog artifact hash resolution was found. Continue blocking unauthorized access; a future design should use a capability record with explicit validity, model, and data mode. |
| B: cost/turns | MetaProvider allows at most 12 planning turns (each turn includes bounded retries; this does not mean at most 12 HTTP attempts). Before each retry, it accumulates a reserve using a conservative token upper bound from serialized bytes plus the completion ceiling, with no refunds. Each request is limited to 120 seconds, completion≤4,000, and input reserve≤32,000. | The persistent provider's reserve is in memory; restarting does not provide a durable ceiling covering prior authorizations. The historical live-validation CLI's durable three-slot ledger is a separate flow and must not be conflated with it. Actual billing/balance remain UNKNOWN. |
| T: timeout/retry | The default transport timeout is 20 seconds (configurable from 1–120 seconds), using AbortController. Transport outcomes that cannot be confirmed are not automatically resent. 429, 500, and 503 allow at most two retries; Retry-After must be ≤10 seconds and fit within the request deadline. 401/403/explicit quota errors are not retried. | Backoff is already bounded; official guidance also recommends jitter. This review does not change transport. Apply/mutation deduplication uses request IDs; a model retry is not permission to submit again. |
| M: scene mutation | Closed AJV schema → scene/domain validator → a shared transaction of 1–32 requests → ID/revision/registry checks → preview digest/maximum five minutes → atomic Apply. Budgets allow 48 tools and at most 48 previews. Undo rejects overwriting later edits. | CreateScene replaces existing objects/sources; the preview already warns about this and Undo is available. Its name must not lead users to believe it opens a separate project. |
| S: Sound mutation | Five operations; scene/behavior revisions, object generation, profile revision, and asset revision/hash/readiness/rights are revalidated. Limits: 32 operations, 12 previews by default, five-minute TTL. Apply/Undo require exact content. | Creative samples/oscillators are not real vibration or sound pressure. Sound proposals are separate from the original scene tool enum; do not force aliases into it. |
| E: experiment execution | At most six runs/48 calls; one simulation at a time; 120 seconds per run; trace 32 MiB/stored data 64 MiB. The loop yields every eight steps; cancellation waits for loop acknowledgement. Resending the same request ID/content returns the same Promise/result. | The current local isolated Rapier + Behavior + geometric acoustics flow creates no audio device. It is not evidence of hardware listening or a complete model-planned Meta loop. |
| G: numeric grounding | Completed artifacts can be captured; hash/run/metric record/method are checked. Unsupported values are null, never zero-filled. | Without a complete IR, no RT60/EDT/T20/T30/DRR/C50/C80 numbers are provided. AI explanation is explanation, not a metric producer. |

Local evidence: [HTTP negative cases](../../../tests/ai-runtime/server.test.ts), [Sound HTTP](../../../tests/ai-runtime/sound-server.test.ts), [provider gates/retry](../../../tests/ai-runtime/provider.test.ts), [scene transactions](../../../tests/ai-runtime/host.test.ts), [Sound transactions](../../../tests/ai-runtime/sound-host.test.ts), and [experiment execution](../../../tests/app/experiment-tools.test.ts).

<!-- english-original-anchor --> <a id="5-逐工具能力對照"></a>
## 5. Capability Comparison by Tool

H/P/B/T apply to every proposal passing through a Meta endpoint; M/S/E are additional host limits. “Absent” in the table means this review did not find it in the current closed tool/action union. It does not imply that all future capability is prohibited, nor automatically constitute a frozen V1 acceptance failure. Tool names remain exact, with no silent aliases.

| Requested name | Current schema/executor status | Authentication/quota/timeout/retry/Undo | Manual fallback/gap |
| --- | --- | --- | --- |
| CreateScene | Listed in the original scene schema and provider. The adapter builds a six-sided fixed room of 1–50 m, requiring a separate transaction. It replaces existing objects/sources while retaining scene identity. | H/P/B/T + M; Apply after preview; Undo restores the original snapshot and creates a new revision. | Use existing scene/object editing. Wording must distinguish opening a project from “rebuilding the room.” |
| AddObject | Original schema and scene command are connected: box/sphere/capsule, registry materials, stable object IDs, and actual domain validation. | H/P/B/T + M; at most 16 sources in an AI scene; resending does not repeat the commit; Undo available. | Add through the Library and adjust in the Inspector; see scene-integration tests. |
| SetMaterial | Original schema and adapter are connected for acoustic/physics/both. They check the registry revision and apply physics coefficients and acoustic IDs separately. | H/P/B/T + M; creates a new revision; old results should be marked stale; Undo is revision guarded. | Physics/acoustic materials in the Inspector; do not infer Measured coefficients from names. |
| SetRigidBodyMode | The original schema has four modes. The adapter currently permits only `velocityPolicy:zero`; preserve/restoreSnapshot are explicitly rejected. | H/P/B/T + M; constrained policy with no silent rewrite; authoring settings can be undone, but past physics cannot be reversed. | Physics Inspector; NoGravity remains dynamic, while Fixed is not affected by forces. |
| CreateMotionAction | **No tool name/schema exists.** The approximate original `SetTrajectory` has a schema and is advertised by the provider, but the adapter explicitly returns CAPABILITY_UNSUPPORTED. It is not connected to a versioned Motion Registry. | There is no legal dispatch for CreateMotionAction. SetTrajectory still fails in M after H/P/B/T, without a partial transaction. | Actual interaction recording/authoritative replay is available; this is not general motion authoring. First define a motion action contract, collision clearance, and run trace; adding only a UI form is insufficient. |
| ConfigureSoundBehavior | **No exact tool name exists.** Current `ProposeSoundBehavior` contains five operations: CreateProfile/ReplaceProfile/DeleteProfile/AssignBinding/RemoveBinding, with a separate closed schema. | H/P/B/T + S; server preflight does not Apply; the local host previews, Applies, and Undoes again. | Sound Inspector/Rule/Mapping/Binding override. The simpler `ConfigureSoundSource` is a different legacy tool and cannot be presented as covering all Behavior. |
| SetListener | The scene domain command has this name. The exact AI tool name is `MoveListener`, requiring the same listener ID, position, and quaternion, explicitly independent. | H/P/B/T + M; current revision; Undo available; does not move the editor camera. | Listener Inspector; FPS attachment/exit restoration policies go through InteractionHost separately and cannot be silently changed through an alias. |
| StartRecording | **No AI tool schema exists.** UI `recordToggle` connects to RecordingHost, through a different entry point from the recording produced by offline RunSimulation. | The model must not invent a dispatch. The manual path follows the recording lifecycle/overload pause. Stop/finalize is not Undo. | Start/stop recording and export in Event Timeline. If a tool is added, use separate explicit start/stop commands so retrying a toggle cannot reverse the operation. |
| RunSimulation | Original schema and ExperimentToolHost are connected: custom-web is an explicit alias/custom-web-geometric, 1/60 second, reflection order 0 or 1, and duration must be an integer number of ticks. Unsupported values are explicitly rejected. | H/P/B/T + E; completed only when the host returns succeeded; cancel waits for acknowledgement. Completed runs cannot be undone; immutable evidence is retained. | Interactive Transport run plus manual recording; this is not the same execution mode or evidence of device output. |
| CaptureExperiment | Original schema and executor are connected. It only accepts a completed recording with a verifiable hash and creates an immutable experiment ID and references. | H/P/B/T + E; request ID deduplication and capacity guards; no scene mutation or authoring Undo semantics. | UI A/B capture/recording export; “Capture” must not imply a new measurement occurred. |
| AnalyzeAcoustics | **No exact name exists.** The original `AnalyzeAcousticResults` is connected. It computes only the supported directArrivalTimeS population mean from an actual recording; other IR-dependent metrics are null with reasons. | H/P/B/T + E/G; missing/tampered artifacts are rejected; models cannot fill numbers; analysis does not change the scene and has no Undo. | Acoustic Dock/Paths/Comparison, retaining sources and unavailable values. Tool-name mapping must be explicit and tested with negative cases. |
| CompareExperiments | Original schema and executor are connected. It requires two completed captures; the current tool permits only acousticMaterial as the independent variable, checks conditions such as identical motion, and stores candidate−baseline in a paired artifact. | H/P/B/T + E/G; incompatible comparisons return INCOMPATIBLE; mismatched method/population makes delta null; no scene Undo. | The UI separately offers acoustic/behavior comparison. That does not establish arbitrary behavior A/B support in the AI tool. |
| CreateRenderJob | **No tool/schema/job executor exists.** Current live audio, static preview, and recording JSON export are not this capability. | No legal dispatch, render budget, or job ledger exists; a successful planner does not mean rendering completed. | Current monitoring/preview and recording export. Offline PCM/video rendering would first need output format, scene/motion/listener pins, job state, capacity, cancellation, and cleanup contracts. |

There is also `PreviewSceneChanges`, one of the original 12 tools. The current read host supports collision queries for a trusted staged candidate and an Estimated cost artifact; without `getPreviewScene`, it explicitly returns PREVIEW_REQUIRED. Product runtime initialization does not provide this resolver, and the tool is not among the provider's 11 function tools. Local stage previews for ordinary mutations work; that does not make this separate tool fully available. See the [preview tests](../../../tests/app/experiment-tools.test.ts) and [initialization](../../../src/app/runtime.ts).

<!-- english-original-anchor --> <a id="6-科學與數值保護"></a>
## 6. Scientific and Numeric Safeguards

[ExperimentToolHost](../../../src/app/experiment-tools.ts) explicitly labels local results computed/V1. Limited paths and Synthetic late reverb are not a complete IR. Currently, only the average geometric propagation delay for a stated population can be obtained from actual order-0 paths; it must not be labeled the “earliest audible onset” or a measured room RT60. Missing values for vacuum, occlusion, or absent bands remain null.

[explainVerifiedMetrics](../../../src/ai/grounding.ts) checks the trusted artifact resolver, run ID, hash, and original metric record. Deleted, tampered, or forged values are rejected. Product read-result presentation also distinguishes unknown/pending/blocked from completed, and dependent tools do not continue after failure. See the [grounding regression](../../../tests/ai-runtime/scene-integration.test.ts) and [session results](../../../tests/ai-runtime/session-results.test.ts).

The recommended next slice is to produce explanations with references only for **existing completed artifacts**, attaching a metricRecordId to each statement. With no data, propose the next legal experiment instead of filling values. Optimization should select only among executed valid candidates and must not claim a global optimum.

<!-- english-original-anchor --> <a id="7-live-證據與歷史的精確範圍"></a>
## 7. Precise Scope of Live Evidence and History

The existing [minimal live summary](../../../research/v1/meta-live-validation-20261027-r3-minimal/summary.json) and [independent review](../../../research/v1/meta-live-validation-20261027-r3-minimal/independent-live-review.json) support the historical actual Meta Sound proposal, RemoveBinding/AssignBinding, Host Apply, and a local 180-tick/181-frame run. They do not support the current complete scene planner loop, product UI live operation, all 13 capabilities, a current billing balance, or hardware listening impressions.

The original authorization is in [META_API_VALIDATION_AUTH](../00-project/META_API_VALIDATION_AUTH_20261027.md); see [operations and limitations](../server/META_LIVE_VALIDATION.md). The durable ledger's three request slots have been exhausted. The first 400 response's raw body and all intermediate code versions were not fully archived. Later offline fixtures cannot fill in that history, and the old authorization must not automatically fund new paid requests. Live tests in this review are **NOT RUN**.

<!-- english-original-anchor --> <a id="8-競賽時限與合規風險"></a>
## 8. Competition Deadline and Compliance Risks

Checked on 2026-10-29: the [Meta event page](https://dev.meta.ai/events/global-hackathon) and [CV event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) still give a project deadline of **2026-11-04 21:00 ET = 2026-11-05 10:00 Taipei (02:00 UTC)**. Eastern time is UTC−05 on that date. The October 25 23:59 ET application deadline was a separate gate and has passed. The historical wording difference between EST in the page header and ET in the body is retained.

The text web tool failed on the [Official Rules/waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver), but read-only browser rendering succeeded. Its footer still says October 25, 2026. The rules require building with Meta products; OSS and third-party technical assistance remain subject to rights conditions. Judging is Meta tooling 25%, Impact 30%, Technical 20%, and Demo 25%; Indie teams may have at most four members. The public text does not explicitly allow/prohibit Codex, require API exclusivity, or set a minimum call count. An unstated condition is not a waiver.

The [submission entry](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit) currently redirects to login. Personal eligibility/acceptance, credit terms, video/repository fields after login, and final submission confirmation remain **UNKNOWN**; the agent does not accept them on the participant's behalf. Devpost's exact-name overview lookup failed and search returned zero, so another Devpost event's rules must not be used. Existing original compliance sources are in [HACKATHON_RULES](../01-compliance/HACKATHON_RULES.md) and [PROJECT_PROVENANCE](../00-project/PROJECT_PROVENANCE.md).

<!-- english-original-anchor --> <a id="9-建議優先序與驗收"></a>
## 9. Recommendation Priorities and Acceptance

| Priority/risk | Recommendation (not adopted/implemented) | Evidence required upon completion |
| --- | --- | --- |
| P0/incorrect external claims | Freeze the demo capability list, showing exact tool names, supported subsets, offline/historical live/NOT RUN, and improve current status entry points' guidance to historical documents. | Positive and negative cases showing consistency among schema, advertised provider tools, and host capability, without changing original acceptance. |
| P0/deadline and external gates | The participant should first confirm eligibility/entry/terms and arrange a demo of existing capabilities. Do not expand paid usage to meet the deadline. | Participant's external confirmation and a readable submission checklist; run fresh live tests only if separately authorized, saving actual wire/code/version evidence. |
| P1/cost and deployment | If a public service is planned: actual session authentication, per-user quotas, a durable budget ledger, response model/pricing checks, and provider verification expiry. | Tests for process restart, multiple sessions, concurrency, auth bypass, model mismatch, and unknown billing; local defaults remain zero. |
| P1/stopping interaction | Expose the existing ExperimentToolHost cancellation acknowledgement and ledger in the product job UI. Currently cancel returns directly while AI is loading; it must not be claimed to stop all dispatched work. | Actual slow-run, timeout, late-reply, cancelRequested→ack, and unapplied-result flows. |
| P2/new tools | First write separate versioned contracts and capabilities for MotionAction/StartRecording/RenderJob, then connect each to the host. Do not silently alias them because names look similar. | Atomic Apply, Undo boundaries, idempotency, resource bounds, artifact lineage, and manual fallback. |

This review subtask actually used Node 22.17.0/npm 11.4.2 and ran `node scripts/setup/emil-skills.mjs --check` (exit 0, all 16 source files MATCH) and `node scripts/setup/emil-skills.mjs --standards` (exit 0, 75 tokens/19 components, errors=[]). These are static checks of pinned sources and design standards only; they do not validate AI execution or the visual UI. This subtask did not rerun runtime/browser/Meta live/device/listening tests; references to existing tests and historical artifacts do not constitute new PASS results. Official research and static code review are complete, with no new production code/schema or expansion of the full V1 conclusion.

Technical limit labels preserved from the canonical contract: completion≤4000; reserve≤32000; Retry-After≤10. These are the same output, reservation and retry-wait limits described above.
