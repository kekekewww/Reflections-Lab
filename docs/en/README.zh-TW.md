<!-- english-source: {"path":"README.zh-TW.md","sha256":"ad539b178b26e8c9651e2b8aa91667f9605f93c817fb194ff9961c6c13d18044","translated_at":"2026-11-04T16:24:36.276Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`README.zh-TW.md`](../../README.zh-TW.md). Source SHA-256: `ad539b178b26e8c9651e2b8aa91667f9605f93c817fb194ff9961c6c13d18044`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- architecture-review-entry -->
2026-10-29: [Comprehensive Architecture Research](12-architecture-review/ARCHITECTURE_REVIEW.md), [Implementation Gaps](12-architecture-review/ARCHITECTURE_GAP_ANALYSIS.md), and [Integration and Publication Status](12-architecture-review/INTEGRATION_REPORT.md). This round preserves the existing V1, corrects the cross-layer propagation limit, and reserves RenderBackend. The complete product, performance, and human / external gates remain unfinished. The r11 counts below are historical; [R17](../11-v1/REQUIREMENT_EVIDENCE_20261029-r17.json) is the latest V1 baseline. Original Git history contains build / large artifacts prohibited from publication; public push must first pass the [complete-history audit](12-architecture-review/PUBLICATION_AUDIT.md).

<!-- english-original-anchor --> <a id="reflection-lab"></a>
# Reflection Lab

**[Watch the demo video](https://youtu.be/PHnT8HdyHCw)** · [MIT License](../../LICENSE) · [Full English guide](../../README.en.md)

<!-- english-original-anchor --> <a id="最新muse-多步驟場景建構2026-11-04"></a>
## Latest: Muse multi-step scene builder (2026-11-04)

One instruction lets Muse, through the Meta Model API, plan a scene proposal of up to 32 steps that can add, move, resize and remove objects. The app first checks it against the same physics and scene rules as a manual edit. If a step fails, Muse reads the error and tries again. You then get a preview, nothing changes until you press Apply, and Undo takes it back if you press it straight after Apply. Muse can also change sound rules and write paths, and the surfaces it adds join the acoustic paths. Results and limits are in the [record](../00-project/MUSE_SCENE_BUILDER_20261104.md), and the scope of this public snapshot is in the [note](../00-project/PUBLIC_SNAPSHOT_20261104.md).

This needs your own Meta Model API key, which stays on the local server:

```powershell
npm ci
npm run build
npm run demo:live -- --key-file "<path to the server-only key file>"
```

Then open `http://127.0.0.1:4173` and choose Meta Model API in the Meta experiment agent tab. This is a real-time approximation, not a measurement, and the full first version, performance and human listening gates are not complete.

[English README](../../README.en.md) · [English user guide](../11-v1/USER_GUIDE.en.md)

Use the language menu at the top to switch between Traditional Chinese and English. The language preference is stored locally; both languages share the same scene, sound, and acceptance data. The complete English documentation has source/translation hashes and current/stale mappings. The previous complete check confirmed that all 258 mirrors at that time were current, with 0 missing, 0 stale, and 0 errors; this change and subsequent changes still require synchronization according to the latest report. See the [supplementary English acceptance criteria](11-v1/ENGLISH_ACCEPTANCE.md) for the scope.

Latest, 2026-10-28: UI27, physics2, storage5, the complete product4 suite, and the Chromium native-audio 25/IRv2 checks in the [current r11 checkpoint](11-v1/SESSION_PROGRESS_20261028-r11.md) passed within their respective scopes. The current complete pinned check, including 917 runtime tests, and the offline prompt benchmark passed. Formal performance measurements did not pass; native desktop operation and actual-device listening still have unresolved gates. The complete first version is unfinished. The original [51 acceptance criteria](11-v1/ACCEPTANCE.md) and 61 protected files remain intact, and [M0](11-v1/M0_IMPLEMENTATION.md) retains its original scope. [ADR-013](02-architecture/adr/013-codex-primary-development.md) establishes Codex as the lead developer; Muse Code and the older Harness are optional. [Development resources](../09-agents/RESOURCE_STATUS.json) and the product's Meta Model API have separate accounting. No additional Muse or paid Meta usage occurred.

Current entry point: [persistent Wiki](knowledge/README.md) → [Index](knowledge/wiki/index.md) → [Now](knowledge/wiki/now.md). Phase 3's [Codex × Muse Harness](09-agents/CODEX_MUSE_ORCHESTRATION.md) includes bounded failover and independent verification; see its [report](09-agents/PHASE3_REPORT.md) for actual tests and live limitations. The Phase 2 [Wiki/design deliverables](09-knowledge/PHASE2_REPORT.md) and Phase 1 evidence are retained. Historical counts below must not be treated as current totals.

An experimental platform combining interactive 3D physics, traceable acoustic models, and Meta AI. Product code lives in `src/` and `server/`. Research, the Harness, spikes, and each validation level retain their own provenance; they do not stand in for complete feature acceptance. This directory was initially empty and did not reuse the Echo Canvas/Reflections prototypes.

Start with the [Bootstrap Report](BOOTSTRAP_REPORT.md), then read the [architecture](02-architecture/ARCHITECTURE.md), [ADR index](02-architecture/ADR_INDEX.md), [implementation status](IMPLEMENTATION_STATUS.md), [limitations](KNOWN_LIMITATIONS.md), and [next task](NEXT_ENGINEERING_TASK.md). Agents must read [AGENTS.md](AGENTS.md) first.

<!-- english-original-anchor --> <a id="本地驗證"></a>
## Local validation

Pinned versions: Node **22.17.0** and npm **11.4.2**; Python **3.12.11** was the version observed during this work. Actual dependency versions and integrity values are recorded in package-lock.json.

```powershell
npm ci
npm ci --prefix experiments/physics-spike
npm run check
npm run dev
npm run build
npm run test:runtime
npm run benchmark
node scripts/agents/cli.mjs help
npm run test:agents
npm run test:prompts
```

The scope of `check` is defined by package.json: it retains research regressions and adds production-runtime tests, the build, and license checks. Native SDK, browser/audio, listening, and account API validation are separate. `dev` starts the local Web app and restricted API; the product's default Meta spending limit is 0. See the [Web toolchain](03-sdk/V1_WEB_TOOLCHAIN.md) for production tooling, separate browser commands, and limitations, and the [validation plan](06-validation/BENCHMARK_PLAN.md) for the research baseline. No deployment or submission has been performed.

For first-time listening, you can remain paused and choose **Enable listening** in the bottom Monitor strip. Start at low device volume, then adjust **Monitor gain** and choose **Start simulation** or **Resume simulation**. Enabling listening does not automatically resume the simulation; muting the monitor does not pause physics. Simulated uses the unified acoustic chain; Raw reference provides centered dry audio. Finish by choosing Pause and muting the monitor. dBFS is not calibrated dB SPL.

The saved [minimal real-Meta Sound slice](server/META_LIVE_VALIDATION.md) includes the model response, Host Apply, and a local 180-tick run. Offline reuse of a recorded response is not new live-model output. Offline tools are explicitly identified as not a model. The product server defaults to network disabled and budget 0; all three request slots within this US$1 authorization have been used. Actual billing and remaining credit are unknown.

By default, `node scripts/setup/datasets.mjs` only performs a dry run. The example authorization and file pins are incomplete, so `BLOCKED`/exit 2 is expected; it is not a download failure. `npm run test:datasets` validates the acquisition tool using a local mock; no real datasets have been downloaded. See the [acquisition specification and limitations](experiments/dataset-fetch-spike/README.md).

Windows SDK spike:

```powershell
./scripts/setup/steam-audio.ps1 -Download -Extract
./experiments/sdk-smoke-tests/run.ps1
```

Versions, SHA256 values, compiler details, and individual results are recorded in [SDK_VALIDATION](03-sdk/SDK_VALIDATION.md). SDK caches and node_modules are excluded from Git. The initial download needs network access; execution requires Windows x64 and the compiler specified in the documentation. Audio-device tests have not been run.

<!-- english-original-anchor --> <a id="導覽"></a>
## Navigation

| Path | Contents |
| ----------------------------------------- | -------------------------------------------------- |
| docs/00-project | Original requirements, empty-directory baseline, assets, and provenance |
| docs/01-compliance | Official competition rules, license register, and dependency inventory |
| docs/02-architecture | Effective ADRs and history; data, timing, and backend contracts |
| docs/03-sdk | Steam Audio versions, licensing, comparisons, and native tests |
| docs/04-physics、05-ux | FPS/Grab/Build/states and UX research covering 8 tools |
| docs/06-validation、07-experiments、08-ai | V0–V5, recording/replay/A/B, Meta models, and tools |
| research | Literature, formulas, datasets, and the Evidence Ledger |
| docs/09-agents、prompts | Harness, failover, quota, prompts, and model provenance |
| schemas | Product/Wiki/agent contracts and synthetic examples |
| .agents/skills | 15 project skills and 8 pinned Emil upstream skills |
| tests、benchmarks、experiments | Isolated analytical, dependency, physics, and SDK validation |

The competition submission time is currently **2026-11-05 10:00 Taipei**. Application/selection, pre-competition work, and complete submission fields still require the user's own verification. See [HACKATHON_RULES](01-compliance/HACKATHON_RULES.md) for official sources and time-zone ambiguity. No terms have been accepted, and no application or submission has been made on the user's behalf.

The project's own content is released under the [MIT License](../../LICENSE); third parties retain their respective licenses. Measured/computed/estimated and unverified items are recorded separately. Uncalibrated dBFS is not treated as dB SPL. See [FILE_MANIFEST](00-project/FILE_MANIFEST.md) for the complete list of added files.
