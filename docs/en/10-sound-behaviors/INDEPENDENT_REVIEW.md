<!-- english-source: {"sha256":"09bfa748810d2b468e8954b8261789f9ae0027b635b9338e7a8165e951d7df8c","path":"docs/10-sound-behaviors/INDEPENDENT_REVIEW.md","links":"english-relative","executor":"Codex","model_id":null,"translated_at":"2026-10-27T05:42:51.746764Z"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/INDEPENDENT_REVIEW.md`](../../10-sound-behaviors/INDEPENDENT_REVIEW.md). Source SHA-256: `09bfa748810d2b468e8954b8261789f9ae0027b635b9338e7a8165e951d7df8c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->


<!-- english-original-anchor --> <a id="sound-behavior-獨立審查"></a>
# Sound Behavior Independent Review

Review date: 2026-10-27 (Asia/Taipei). Reviewer: independent Codex subagent `sound_review`; implementation was performed by other agents with separate file ownership. Conducted under [codex-verification](../agent-skills/skills/codex-verification/SKILL.md) and the [Validation Policy](../09-agents/VALIDATION_POLICY.md). Before starting, the reviewer read the Wiki startup documents, Task0010, the user's original request, and ADR-013/014. This reviewer only added this report and did not modify implementation, tests, original benchmarks, or the Wiki.

**Conclusion: no unresolved P1/P2 issues remain within the current research/draft contract/isolated policy scope.** The respective implementers have fixed the issues found during review, and the concrete counterexamples below have been checked again. Root's final integration gate, source manifest, Task/Wiki, checkpoint, and handoff still await completion by root; this report cannot preemptively declare the overall task DONE.

The actual Git HEAD at review time was `914cfc742e7e575a09272fba5738d20c3fd5e3b7`, with uncommitted changes for this work in the working directory. This report does not prove that the commit already includes Sound Behavior. Root's final source/dirty hashes and gate artifact should record the delivered version.

<!-- english-original-anchor --> <a id="已重現並修正的問題"></a>
## Reproduced and Fixed Issues

All of the following were defects in local drafts or isolated spikes, rather than failures in a released product. Counterexamples are based on the [document/context/runtime fixtures](../../../schemas/sound-behavior/examples).

| ID/Original Priority | Original Reproducible Counterexample | Fix and Independent Check |
| --- | --- | --- |
| SB-REV-01/P2 | A binding override set `rule.always` to `enabled:false`, yet a checkpoint that remained active/playing passed; OnImpact start also passed when the binding master was disabled | `effectiveEnabled` consistently combines the binding master and rule override/base flag; active, scheduled/playing, and start/update are rejected, while stop/fading cleanup may remain. The original counterexamples respectively return DISABLED_INSTANCE/INVALID_ACTIVE_RULE/DISABLED_EVENT |
| SB-REV-02/P2 | An ordinary OnImpact changed to an oscillator was still treated as a one-shot without a finite stop; a latch with deadlineTick=300 also passed while still playing at state.tick=301 | A discrete oscillator must have `oneShotDurationSeconds` with enough duration to accommodate the envelope; after the latched deadline is reached, only fading/stopped is allowed. Missing duration returns ONE_SHOT_DURATION_REQUIRED, a valid 0.1-second example passes, and an expired latch returns LATCH_EXPIRED |
| SB-REV-03/P2 | After the first fix, a material-pair override replacing a sample with an oscillator could still bypass the duration check on the rule's base generator | The same finite-duration gate is applied to every selected generator; the original override returns ONE_SHOT_DURATION_REQUIRED and passes when rule duration=0.1 seconds is added. The added 21st regression was executed independently |
| SB-REV-04/P2 | A valid empty document had empty assets/profiles/bindings; CreateProfile using an asset already in the trusted catalog failed because there was no document pin, and none of the five proposal operations could add a pin | Candidate validation derives `derivedAssetPins` only from exact ID/revision/hash matches in the trusted catalog; the original example passes and returns one pin, with the input document bytes unchanged. Unknown/missing files/unverified rights are still rejected; formal Preview/inverse/atomic commit remain for the host to implement |
| SB-REV-05/P2 | contact.colliderA=`collider.invented` was still accepted as committed event geometry | The trusted collider registry checks existence and participant ownership; the original example returns CONTACT_COLLIDER_IDENTITY. This only validates references and cannot prove that the input is an actual Rapier contact |
| SB-REV-06/P2 | A sphere and its support shared world angular velocity with contact slip=0, yet the original classifier returned ROLLING; the sphere could actually be completely at rest in the support frame | Support angular velocity is explicit, support point velocity is converted to the sphere COM, and relative angular velocity is used. The original co-rotation example becomes RESTING/slip0; unknown support angular state returns UNCLASSIFIED |

The independent analytical inputs for SB-REV-06 are `vCOM=[0,1,0]`, `omegaBody=[0,0,1]`, `contactOffset=[0,-1,0]`, `vSupportAtContact=[1,1,0]`, `normal=[0,1,0]`, and `omegaSupport=[0,0,1]`. Relative motion is zero when the two objects share rigid-body rotation; the original API lacked support angular state and could not distinguish this. This fix only applies to the explicitly Derived/Synthetic isolated sphere candidate and does not establish that rolling for arbitrary meshes has been verified.

The physics sub-review fixes were also checked: `maxGroups` has a safe-integer/1–256 limit; OnBounce requires a bounded time window after its parent impact and evidence of normal reversal/separation, rather than ContactEnd alone. The `WhileRolling` documentation now consistently uses a contact anchor and does not offer authors an object anchor that the validator would reject.

<!-- english-original-anchor --> <a id="本-reviewer-實際執行與讀查"></a>
## Commands Actually Run and Outputs Inspected by This Reviewer

| Action | Actual Result and Boundary |
| --- | --- |
| `node --test tests/sound-behaviors/contracts.test.mjs` | Independently ran after the first fixes: 20/20 PASS, exit0. SB-REV-03 was found and fixed afterward; this 20-test output is not presented as a complete final run of all 21 tests |
| `node --test --test-name-pattern='selected generator cannot bypass' tests/sound-behaviors/contracts.test.mjs` | The final added regression actually ran: 1/1 PASS, exit0. Two earlier filters that did not match the name do not count as validation evidence |
| `node --input-type=module -e ...`, directly calling exported validators | Rechecked the original enabled, duration, expired latch, collider, and empty-document asset proposal counterexamples above, together with valid controls, in sequence. Results matched expectations; no evaluator was run and no audio was played |
| `node --input-type=module -e ...`, directly calling `contactMotion` | The same co-rotation case returns RESTING/slip0; omitting support angular state returns UNCLASSIFIED/slip0 |
| Read the [implementer's final contracts raw output](../../../tests/sound-behaviors/latest-test-output.txt) and [CLI fixtures](../../../tests/sound-behaviors/latest-fixture-output.json) | 21/21, fail0; all 5 draft fixture groups PASS. This was inspection of the implementer's output; the complete final independent root gate is recorded separately |
| Read the [physics final raw artifact](../../../experiments/sound-behavior-spike/physics-validation-final-2026-10-27.json) and recomputed source hashes | exit0, 13/13; all 3 SHA256 hashes for the policy source/policy test/WASM probe match the actual files. This was neither a reviewer rerun of the 13 tests nor an audio success rate |
| Compared the schema trigger enum with the Event Model | 7 continuous + 12 discrete, totaling 19 unique IDs; all appear in the event document |
| `git diff --name-only -- tests benchmarks package-lock.json` | Existing tracked tests/benchmarks/lockfile have no changes from this work; new sound tests are listed separately. Untracked new files cannot be interpreted as overwriting existing acceptance criteria |

This reviewer did not rerun the entire old Harness/core/Wiki suites, to avoid duplicating root's final gate. Physics artifact SHA256: `a7786170f8b7d19464bba698e3a0dbf122d18620f185891cef55a0d59be55296`; the old 10-test/intermediate results remain historical records and are not evidence that the current code passes.

<!-- english-original-anchor --> <a id="跨文件核對"></a>
## Cross-Document Checks

- [ADR-013](../02-architecture/adr/013-codex-primary-development.md) makes Codex primary and Muse Code optional; no dispatch is made while the Muse quota is 0. Old ADR/Phase3 artifacts remain historical; the product Meta Model API is separate from the coding executor, and Codex development has not been presented as Meta live evidence.
- [Event Model](EVENT_MODEL.md)/[Bridge](PHYSICS_AUDIO_BRIDGE.md) distinguish force N, impulse N·s, geometric/solver indices, world contact position, COM/point velocity, and pre-step estimates. Held/Moving/sleep/contact are orthogonal; Throw/Drop come from successful interaction intent. Airborne cannot replace a latch that does not restart after the first Impact.
- [Architecture](SOUND_BEHAVIOR_ARCHITECTURE.md)/[Audio Runtime](../02-architecture/AUDIO_RUNTIME.md) share SourceGraph, and all positioned 3D emissions go through the same propagation chain; distance, delay, Doppler, and HRTF each have a single responsible component. Dry audition/Raw monitoring have explicit boundaries and are not retroactively treated as complete spatial-acoustic results.
- [Schema](BEHAVIOR_SCHEMA.md)/[Meta tools](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) use closed enums/bounded declarative JSON and reject arbitrary JavaScript, graphs, URLs/local paths, arbitrary patches, and physics mutations. JSON shape, domain/registry, and host capability/revision/budget are separate validation layers; the original Scene v1/AI12enum have not been claimed to have completed extensions.
- [Record Replay](../07-experiments/RECORD_REPLAY.md)/[A/B](../07-experiments/AB_COMPARISON.md) separate the original physics/player trace from the behavior decision trace. Acoustic A/B holds source generation fixed; behavior A/B explicitly changes content/mapping while holding motion, raw inputs, listener, solver, medium, and propagation materials fixed. The latter does not require identical voice decisions between the two versions and does not infer RT60 from a piano timbre.
- Voices, active emitters, per-emitter/total paths, queues, and decode memory have separate bounds; schema limits and perceptual thresholds are neither measured capacities nor natural constants. Comparisons with mature tools retain the Wwise legacy/403, version-specific Sound Particles, and non-execution evidence limitations.
- [Roadmap](../ROADMAP.md)/[M0](NEXT_AUDIO_MILESTONE.md) use stable Task0011–0015 to express prerequisites: a fixture-only domain runtime can proceed in parallel with Scene/Physics0006, while audible vertical0012 requires both. Interaction/rolling/latch and product Meta are divided into capability-based slices, with Graph/modal left at P2. These tasks have not yet started.

<!-- english-original-anchor --> <a id="不能由本報告推論的項目"></a>
## Items This Report Cannot Establish

The formal Behavior evaluator, Audio Event Runtime, host Apply/Undo, complete capture/replay, browser/Inspector, OfflineAudioContext, HRTF/click-pop/arrival continuity, device/headphone/performance testing, and product Meta live are **all NOT RUN/not implemented**. The draft checkpoint validator does not validate cross-version voices from retired profiles; v1 authoring boundary/drain/new epoch still require explicit implementation by the subsequent host, and seamless multiversion playback is not promised.

This reviewer did not recheck the full remote competition rules or accept terms; only the source metadata for this work and the documents' permitted/unknown boundaries were checked. No Muse/Meta API was called, no sound assets were downloaded, and no deployment or push occurred. Scientific measurements, sound quality on actual hardware, and complete competition compliance are outside this review's passing scope.
