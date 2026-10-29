<!-- english-source: {"path":"docs/10-sound-behaviors/SOUND_BEHAVIOR_REPORT.md","sha256":"9fe32414e8b6e97a97378b4c6094a0a50104e8b5106907091a510ff16f181933","translated_at":"2026-10-27T03:40:18Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/10-sound-behaviors/SOUND_BEHAVIOR_REPORT.md`](../../10-sound-behaviors/SOUND_BEHAVIOR_REPORT.md). Source SHA-256: `9fe32414e8b6e97a97378b4c6094a0a50104e8b5106907091a510ff16f181933`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="sound-behavior-research--architecture-integration"></a>
# Sound Behavior Research & Architecture Integration

Review and integration: 2026-10-27 (Asia/Taipei). This research, architecture/data drafts, and isolated risk validation are complete; **the production Sound Behavior runtime/UI/AudioGraph and product Meta integration have not yet been implemented**.

<!-- english-original-anchor --> <a id="建議與八個核心問題"></a>
## Recommendations and Eight Core Questions

| Question | Architecture recommendation/boundary |
| --- | --- |
| Is it worth making this a core feature? | Yes. The core is explainable events + free choice of timbre + unified propagation + traceable experiments; it is not the invention of events or a reconstruction of a DAW. |
| Should Physics or the Acoustic Core change? | Retain the solvers and clocks; add a standardized event/state bridge and a Behavior→emitter entry point. Do not silently version Scene v1 or the existing 12 AI enum values. |
| Rules, FSM, or Graph? | Declarative Event Rules + orthogonal State Machine/bounded latches; prioritize Inspector, with Graph at P2. |
| What must we build ourselves? | Episodes/deduplication/state classification, Profile/binding/override, bounded mappings and voice admission, a unified routing host, trace/A/B/preview/undo. |
| What can we reuse directly? | Rapier events/manifolds/point velocity; Web Audio buffers/loops/oscillators/gain/filters/automation; existing AJV. Do not add a mandatory runtime such as FMOD/Wwise. |
| What innovation could be demonstrated in the competition? | Switch between Physical-inspired/Creative sounds using the same motion/contact trace, inspect the rule/asset/contact emitter, retain the same acoustic propagation, then run A/B with an explicitly stated independent variable. This is a demonstration recommendation, not a novelty certification. |
| How can Muse Agent participate substantively? | Meta Model API generates an allowlisted proposal→trusted registry/domain→preview/apply/undo→real run/results; explain only numbers supported by artifacts. Development with Codex does not replace this part. |
| What is a reasonable MVP boundary? | First M0, a pure event runtime; then AlwaysOn + OnImpact/basic asset/gain/pitch/unified SourceGraph/Inspector. Unlock Grab/Throw/Airborne as their interaction prerequisites become available; Rolling/latches/material pairs/timeline are P1, Graph/modal P2. |

<!-- english-original-anchor --> <a id="文件與直接證據"></a>
## Documents and Direct Evidence

- [Mature-tool research](SOUND_BEHAVIOR_RESEARCH.md): 18 primary sources; FMOD2.04/MetaSounds original text was readable; current Wwise help returned 403, so only older official headers were used; SoundParticles was reviewed separately for SP2/SP3. No SDK or commercial assets were adopted.
- [Event model](EVENT_MODEL.md)/[Physics bridge](PHYSICS_AUDIO_BRIDGE.md): 7 continuous + 12 discrete IDs; throw is not a velocity threshold; rolling requires relative contact-point velocity/angular velocity; force and impulse differ.
- [Versioned schema](BEHAVIOR_SCHEMA.md) and [validation](SOUND_BEHAVIOR_VALIDATION.md): 12 types, AI drafts, bounded lifecycles, asset pins/revisions/two A/B protocols; no host implementation.
- [Layered sound architecture](SOUND_BEHAVIOR_ARCHITECTURE.md), [UX Inspector](../05-ux/SOUND_BEHAVIOR_UX.md), and [product Muse tools](../08-ai/MUSE_SOUND_BEHAVIOR_INTEGRATION.md) each retain one canonical maintenance location.
- [ADR-013](../02-architecture/adr/013-codex-primary-development.md): Codex leads development; MuseCode is optional. [ADR-014](../02-architecture/adr/014-sound-behavior-system.md): Sound Behavior layering. Prior ADR012/Phase3 results are retained.
- [Risk register](../KNOWN_LIMITATIONS.md), [Roadmap](../ROADMAP.md), and [next M0](NEXT_AUDIO_MILESTONE.md) establish explicit dependencies between task IDs 0011–0015 and Scene/Physics0006. These product tasks are not started in this work.

The public competition waiver was reread; its footer date is 2026-10-25. Provisions for Coding Agents such as Codex remain UNSTATED (this cannot be interpreted as explicit permission or prohibition). Meta product integration requires substantive functionality; the 25% scoring category does not provide a publicly quantified minimum threshold. Full details/submit redirect to login. [Rules recheck](../01-compliance/HACKATHON_RULES.md) retains the history and unknown terms.

<!-- english-original-anchor --> <a id="已知驗證限制"></a>
## Known Validation Limits

Valid drafts, Node fixtures, and real Rapier API probes do not establish correctness of the product callback/renderer. Browser, OfflineAudioContext, HRTF/arrival/click-pop, underrun/devices, actual authoring UX, full replay, and Meta live are all NOT RUN. gravity0 is not a vacuum; sample timbre is not real vibration; dBFS is not dB SPL. Performance numbers retain the existing TARGET/UNVERIFIED status; product capacity is not inferred from middleware marketing or a spike.

<!-- english-original-anchor --> <a id="可用的研究命令"></a>
## Available Research Commands

```powershell
npm run validate:sound-behaviors
npm run test:sound-behaviors
npm run smoke:sound-physics
```

The largest current prerequisites are the Scene/Physics host and Audio Event Runtime, not Graph. The next formally assignable work is Task0011; full acceptance is in [NEXT_AUDIO_MILESTONE](NEXT_AUDIO_MILESTONE.md).

<!-- english-original-anchor --> <a id="真正執行的驗證"></a>
## Validation Actually Executed

Summary evidence: [integration acceptance](../../../benchmarks/results/sound-behavior-validation-20261027.json). All 22 acceptance capabilities passed: 20 initially PASS; the other two were rerun with the same docs/Wiki validators and PASS after fixing one relative Wiki link. The code, tests, and original acceptance criteria were unchanged. The [original 22-command run](../../../benchmarks/results/phase3-sound-behavior-20261027-final.json), including failure stdout, is retained and is not rewritten as PASS; the aggregate confirms that the source hashes of the 6 new schemas/validator/spike match the original run.

| Execution scope | Result/permitted claim |
| --- | --- |
| Sound contracts/domain | **21/21 PASS**; 5 sets of CLI fixtures, draft validation only |
| Physics policy | **13/13 PASS**; isolated Derived/Tuned fixtures, including rotating support surfaces/missing data/finite caps/episode boundaries; Bounce is defined only in documentation, production evaluator NOT RUN |
| Real Rapier0.21.0 WASM | **3/3 PASS**; point velocity, world anchors for multiple contacts, sensor events; not complete product collision audio |
| Total new sound tests | **34/34 PASS**; no browser or listening-test claims included |
| Retained regressions | core32, Optional Harness75, prompt12, design14 PASS; Wiki53PASS/1junctionSKIP, datasets17PASS/1SKIP; original Rapier6PASS |
| Tools/sources | 19schemas compile, strictTS, lint/format, research Ledger68sources/66claims; docs/Wiki0error after correction |
| Skills | All 15 project-owned Skills PASS the official format; the fixed bytes of 8Emil were validated separately. No model inference |

[Independent review](INDEPENDENT_REVIEW.md) reproduced and cross-checked the corrections: disabled binding/rule overrides, expired latches, unbounded one-shot oscillators in general and material overrides, trusted asset pin closure, contact collider identity, rotating support and missing-data classification. No outstanding P1/P2 issues remain; this is the draft/isolated scope and still does not equal product host or audio acceptance.

All asset fixtures are explicitly marked FIXTURE_ONLY; real audio files/decoding/sound pressure/audio quality/latency were not fabricated from fake hashes. v1 validates only the current revision. Author Apply requires pause→fade/drain→atomic new revision→newrunEpoch; seamless coexistence of retired-profile voices is not yet supported.

<!-- english-original-anchor --> <a id="對既有專案的實際修改"></a>
## Actual Changes to the Existing Project

- Added ADR013/014; AGENTS and related Skills now designate Codex as primary; older Harness documents add Optional/supersession, preserving the original Phase3 history. Task0009 cancels the mandatory Live Harness goal; this is not validation passing and does not remove product Meta account Task0007.
- Retained Physics/Acoustic/Audio clocks and contracts; added event/authoring data layers. The original Scene v1, Experiment v1, and 12 AI tool enum values remain unchanged. Existing Audio/RecordReplay/A/B/AI specifications add explicit interfaces and boundaries between old and new modes.
- Added prerequisite dependencies to the Roadmap and risk register: Task0011 M0 can run in parallel with 0006; 0012 provides minimal vertical integration; 0013 enhancements; 0014 substantive product Meta tools; 0015Graph/modal P2.
- The Wiki uses the same sources/tasks/events/index and updates current state/goals/decisions/related synthesis pages and handoff, without creating another memory or task system.

See the [file manifest](../00-project/SOUND_BEHAVIOR_FILE_MANIFEST.md) for the complete list of added/modified files. The actual Git revision and final handoff are determined by [Now](../knowledge/wiki/now.md) and Git; no pushing, deployment, acceptance of terms, or production product startup took place.
