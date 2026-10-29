<!-- english-source: {"path":"docs/ROADMAP.md","sha256":"4a1f35bde53d819636c38f1457c34f624151ababf68b3df3f3da8c067143a204","translated_at":"2026-10-29T14:22:37.346Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/ROADMAP.md`](../ROADMAP.md). Source SHA-256: `4a1f35bde53d819636c38f1457c34f624151ababf68b3df3f3da8c067143a204`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="2026-10-29-研究後可執行優先級"></a>
# 2026-10-29 Actionable Priorities After Research

<!-- english-original-anchor --> <a id="2026-10-29-整合後更新與真人回報"></a>
## 2026-10-29 Post-integration update and human feedback

This round's research and minimal fixes have been merged while preserving history. The original workspace's full quality check and current UI28 / linked8 / product4 / physics2 / storage5 functional suites passed. See [integration-state.json](../12-architecture-review/integration-state.json) for actual commits, receipts, and the unfinished public-release process.

The new [R18 human feedback](../11-v1/USER_TEST_FEEDBACK_20261029-r18.json) takes precedence over earlier descriptions of “awaiting the first human test”: inability to move or operate in first person is a user-reported failure, blocking downstream FPS operations. Materials and reflections were not tested; default volume and direct manipulation have reported issues. The tested bundle and device are unknown. Automated passes cannot override this feedback or establish numerical or device validation. The next engineering slice must first pin the source and diagnose the first-person input blocker, then address volume / direct manipulation and the original recording hot path / performance. This round has not repaired those product problems. Older sections preserve their original checkpoints and subsequent designs.

This section takes precedence over the historical ten-day schedule below; retain the existing Task JSON and frozen acceptance. See the [Review](12-architecture-review/ARCHITECTURE_REVIEW.md) for the complete architecture research. This round does not close the complete V1.

| Milestone | Deliverable scope and next steps | Acceptance gates / deferral conditions |
| --- | --- | --- |
| P0 — Hackathon MVP | Retain the existing Scene / Rapier / bounded grab-throw / direct + first-order / Sound / recording-replay A/B / minimal Meta demo. First address Task0020 performance and the record onTick hot path, physical FPS / IME at normal 100% scale, and device listening tests; prepare a reproducible demo / sources / personal eligibility | Preserve R17 negative figures and the original 51 / 102 conditions; do not mark all V1 complete before passing. Public-history publication must first pass Task0021 G9 |
| P1 — Production Workflow | Separate by risk: shared producer capability, Motion registry and Move To/Release, bounded recorded evaluation lane, short-take local mix/stems / drywet, Muse tool capabilities, and durable budgets | One vertical slice and negative fixtures at a time; RenderBackend currently contains types only. No commitment to delivering all in this round or to a schedule |
| P2 — Advanced Acoustic / Export | Higher orders / dynamic reflectors / fuller materials, ADM/BW64 profile, cloud render / long-duration chunks, more HRTFs | Needs scientific references / browser capabilities / memory and profile validators; not an MVP prerequisite |

The official project deadline remains **2026-11-05 10:00 Taipei**. Applications have closed; the user must personally verify selection, submission fields behind login, and terms. See the [Meta review](12-architecture-review/MUSE_AGENT_ARCHITECTURE.md). A date does not establish eligibility. If P0 stability or buffer is insufficient, stop adding P1/P2; retain the 11/4 internal-freeze principle.

See [NEXT_ENGINEERING_TASK](NEXT_ENGINEERING_TASK.md) for the next task that can be handed directly to Codex. The original schedule and numbers below are historical and do not override this section.

<!-- english-original-anchor --> <a id="十日正式實作路線"></a>
# Ten-Day Production Implementation Roadmap

<!-- english-original-anchor --> <a id="2026-10-27目前決策與sound-behavior範圍"></a>
## 2026-10-27 Current Decisions and Sound Behavior Scope

The production Web first version has entered implementation and integration acceptance; see [Implementation Status](IMPLEMENTATION_STATUS.md) and [Full Acceptance](11-v1/ACCEPTANCE.md). The original ten-day table below preserves the early schedule; do not mark items complete merely because their dates have passed. Under [ADR-013](02-architecture/adr/013-codex-primary-development.md), Codex leads development and MuseCode is optional; product Meta and development credits are accounted for separately. The public submission date, the user's own eligibility and full terms remain governed by the [recheck record](01-compliance/HACKATHON_RULES.md).

Sound behaviors deserve core status, bounded by a minimal vertical chain of explainable events/free content/unified propagation. Implement AlwaysOn＋OnImpact and simple gain/pitch/asset selection/Inspector first. Connect OnGrab/Throw/Airborne according to their FPS interaction prerequisites rather than committing to all P0 candidates at once. Defer Graph/modal and large numbers of layers. Full sources, schemas and risks are in the [Sound Behavior Architecture](10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md).

| Stable Task | Dependencies and scope that can start | Acceptance/current status |
| --- | --- | --- |
| 0010 Research Integration | Existing Wiki/contracts/spikes | DONE; research/draft verification, not a product |
| 0011 M0 Audio Event Runtime | 0010; normalized fixtures can run in parallel with 0006 | DONE; original M0 domain/checkpoint evidence and later authoring UI extensions each retain their own versions |
| 0006 Scene/Physics | Existing design and validation foundation | Original P0-01 retained; Codex implements directly without running the Muse Harness |
| 0012 Sound P0 vertical | 0006＋0011 | Code is implemented; original audio/browser/manual listening criteria remain; not closed based on narrow tests |
| 0013 Sound P1 | 0012＋relevant FPS interaction prerequisites | Grab/Throw/Airborne, rolling/sliding, latch, materialpairs and timeline/A-B are implemented; consolidate acceptance against the original criteria |
| 0014 Product Muse behavior | 0012; live additionally requires the 0007 account/budget | Minimal real Meta tool→preview/apply→experiment evidence; a competition demonstration focus that cannot be replaced by a Coding Agent |
| 0015 P2 advanced | 0013 | Graph/modal/complex synthesis; retain as BACKLOG if time is insufficient |
| 0016–0020 Overall and acceptance slices | Reuse existing Task dependencies | Item-by-item evidence for 51 requirements, physics boundaries/Worker/recording-playback assets/browser performance; do not create another task system |

In the remaining time, first verify Scene/physics/a single audio route, then implement creative workflows and real Meta tool slices, and finally retain buffer for integration/video/terms and submission. If minimal acoustics/browser/real Meta connectivity have not passed verification, reduce content and UI before adding Graph. These are engineering priorities, not measured durations or guarantees of success.

This table is a **plan for the next phase; execution has not started**. Official project submission is 2026-11-04 21:00 ET＝**2026-11-05 10:00 Taipei**. Planning uses the ten Taipei dates 10/26–11/4; the actual start of production development depends on official kickoff/selection rules. This table does not automatically confer eligibility. First recheck the [rules](01-compliance/HACKATHON_RULES.md) on pre-competition code, coding agents, commercial SDKs and submission fields; unknown does not imply permitted.

The main track is Web-native; do not maintain Unity, Tauri and Web as three products simultaneously. Budget approximately 6–8 hours per day. Research/verification may run in parallel, but modifications to shared runtime code require ownership boundaries. Internal freeze is 11/4 18:00 Taipei, leaving 16 hours before the public deadline. Handle the official form/video no later than the morning of 11/4; do not wait until the final evening to inspect the fields.

| Day/Taipei date | Priority/dependencies | Deliverables and acceptance/tests | Main risks and fallback | Hours |
| --- | --- | --- | --- | --- |
| D1 10/26 | P0-01; complete gates before production development | Scene document host, room/sphere, Three view, Rapier fixed tick; 4 body modes, import/export/revision, geometry IDs; no NaN/scene roundtrip and mode tests | Tool integration delays: primitives and a single room only; no expansion to arbitrary mesh | 6–8h |
| D2 10/27 | P0-02, D1 | FPS capsule, gesture lock/focus, independent listener, ray pick; wall/slope/Esc/blur manual cases; fixed tick does not vary with FPS | Pointer lock restrictions: an alternative without locking; preserve collision behavior | 6–8h |
| D3 10/28 | P0-03, D2 | bounded grab/drop/throw/fix, ghost/staged/explicit enable; thin wall, corner, heavy object, low FPS and NoGravity acceptance | Unstable servo: limit mass/distance/throw cap; reduce scene objects; no teleporting through walls | 6–8h |
| D4 10/29 | P0 audio, D1/3 | continuous emitter＋dedup collision sample-based events＋HRTF; no interruptions during grab/throw; no repeated playback at rest, voice cap and clipping telemetry | Asset rights/worklet cost: original synth signals＋native WebAudio nodes | 6–8h |
| D5 10/30 | P1 acoustic, D4 | direct delay/1/r, static occlusion, finite first-order ISM; same-t0 arrival/bounds/blocker regression; real path inspector | CPU over budget: 1 source/limited paths/lower update rate; no claims of wave accuracy | 6–8h |
| D6 10/31 | P1 material/runtime, D5 | Synthetic band materials, air parameters labeled with limits, basic reverb, Raw/Simulated; offline graph impulse/energy/normalization tests | ISO coefficients still unverified: explicitly fix a demonstration air model; label reverb perceptual | 6–8h |
| D7 11/1 | P1 AI, D1/5 | Verify account/model/small budget first, then Meta Scene commands; preview/domain/undo, run artifacts and tool errors; at least one demonstrably live trace | Unresolvable model access: reduce to a single tool loop; explicitly identify an offline fallback and confirm its competition impact; do not misrepresent Meta integration | 6–8h |
| D8 11/2 | P1 experiment, D3/6/7 | motion+source/contact trace capture, same-motion material A/B, computed metrics; matching hashes, return unavailable for insufficient RT; one reproducible demo flow | Recorder cost: controlled trajectory＋immutable snapshots first; no claim of complete free-interaction replay | 6–8h |
| D9 11/3 | integration, D1–8 | Freeze features; cross-browser/headphones/low FPS tests; end-to-end Meta→scene→throw→A/B; three demonstrations from clean restarts | Cut all unstable P2 work; retain Steam only as native research evidence, not a product dependency | 6–8h |
| D10 11/4 | release buffer, D9 | Confirm official form, eligibility and asset rights; source/NOTICE/provenance, deployment/video according to official fields, manual pre-submission check; freeze at 18:00 | Deployment failure: local recording/reproducible package; official confirmation required for compliance; user submits personally | 6h＋buffer |

<!-- english-original-anchor --> <a id="p2-明確延後"></a>
## P2 Explicitly Deferred

Second-order and higher reflections, advanced bands/angle-dependent impedance, dynamic reflecting surfaces, complete free-physics recording/playback, optimized IR, wave solver, modal collision synthesis, Steam browser WASM and AI automatic optimization. Unlock only when P0/P1 are stable and sufficient integration buffer remains; completing P2 research does not make it a product feature.

<!-- english-original-anchor --> <a id="每日停止條件"></a>
## Daily Stop Conditions

Every task has reproducible acceptance, sources, limits and rollback. Do not continue adding features while core collision/audio/data consistency remains unverified. Reserve the last two days for integration and submission preparation; adjust only if the user explicitly accepts the new risk. During this phase, the agent does not independently deploy, submit or accept legal terms.
