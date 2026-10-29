<!-- english-source: {"path":"AGENTS.md","sha256":"ca9a0bd5e0b830350bf2f13cb3d839b30a56ae50660d0583237ca5ecef9d9276","translated_at":"2026-10-27T06:02:15.2639025Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`AGENTS.md`](../../AGENTS.md). Source SHA-256: `ca9a0bd5e0b830350bf2f13cb3d839b30a56ae50660d0583237ca5ecef9d9276`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab"></a>
# Reflection Lab

<!-- english-original-anchor --> <a id="任務與目前階段"></a>
## Mission and Current Stage

A platform for three-dimensional physics, traceable acoustics, and Meta AI experiments. Implementation and integrated acceptance of the first formal Web version are currently in progress; product code is in `src/`/`server/`, and the full scope and frozen acceptance are in `docs/11-v1/ACCEPTANCE.md`. Not all product, performance, and external gates are complete; do not claim that the entire first version is complete based on the Wiki, Harness, a spike, or one passing test.

Subsequent user-confirmed scope changes are in the [acceptance amendments](11-v1/ACCEPTANCE_AMENDMENTS.md), which take precedence over the corresponding frozen provisions. The user removed native 200% scaling; usability at normal 100% display scale is the standard. It is no longer a required human gate; historical tests and results remain.

<!-- english-original-anchor --> <a id="開發代理責任"></a>
## Development Agent Responsibilities

**Codex is responsible for primary architecture, implementation, task progress, and quality verification; Muse Code is optional only**, and a cross-coding-agent workflow is unnecessary. [ADR-013](02-architecture/adr/013-codex-primary-development.md) replaces the former Muse-first policy; the legacy Harness/tests remain Optional. See [Resource Status](../09-agents/RESOURCE_STATUS.json) for the latest Muse availability and its sources. Do not present user-reported credit as a billing query or automatically change executor or spending limits. Meta Model API remains the target for the Muse Experiment Agent inside the product; switching development to Codex does not constitute product Meta live evidence. Prioritize frozen acceptance, independent processes/benchmarks/references/isolated review; do not declare completion solely through self-review. Retain task/Git/provenance/budget rules; the [Validation Policy](09-agents/VALIDATION_POLICY.md) still applies, and the Optional Harness follows its operating documentation.

<!-- english-original-anchor --> <a id="session-startup-與持久記憶"></a>
## Session Startup and Persistent Memory

Read `knowledge/schema.md`, `knowledge/wiki/index.md`, and `knowledge/wiki/now.md` in order, then relevant task JSON and the latest handoff listed in the index; expand only pages for this task. Verify using Git, actual files, and tests; do not invent a Commit when there is no HEAD. `npm run wiki -- status` and `query <文字>` help locate information; they do not automatically reason or prove that content is correct.

Check the existing Wiki/Evidence Ledger before research; check the latest ADRs, feature status, applicable Skills, and acceptance before implementation. After important requirements, decisions, feature/SDK/research/test/Bug/design changes, update sources, tasks, and related synthesis pages, then checkpoint; hand off and update now before finishing. Full operations are in `knowledge/README.md` and `.agents/skills/persistent-project-memory/SKILL.md`. No automatic Session Hook is installed; do not treat conversation history as a persistent source.

Multiple Agents use separate file ownership; a task claim is a cooperative lock/lease within the same checkout, not cross-machine exclusive ownership. Use CLI optimistic hashes/events and reconcile; do not directly edit now/tasks/log concurrently. Do not delete an invalid lock without authorization. Git synchronization preserves original events/conflicts; do not push without permission. The Wiki is a synthesis index and cannot replace formal sources in each domain.

<!-- english-original-anchor --> <a id="架構與來源"></a>
## Architecture and Sources

- Main approach: React / TypeScript / Three.js / R3F view / Rapier WASM / Custom Web Acoustic Core / Web Audio; fixed steps do not go through React state; Steam Audio is optional. Technical direction is in ADR-011 and development/sound rules in ADR-013/014; React/R3F have been installed using the pinned toolchain and have real-browser evidence for individual items; full product, performance, and external gates remain governed by first-version acceptance and its results.
- Determine authority by information type: the latest confirmed user request for requirements; effective ADRs for technical decisions; code plus reproducible tests for actual behavior; original research/measurements for science; task JSON with evidence for tasks; and the Wiki for a synthesis index that has not become invalid. Create a Conflict Record for disagreements rather than overwriting through last-writer-wins.
- `docs/02-architecture/`: architecture, effective ADRs and history, runtime/data contracts; `docs/09-agents/` contains development Harness policies, separate from product `docs/08-ai/`.
- `research/`: papers/theory/datasets/`EVIDENCE_LEDGER.json`; do not treat abstracts as measurements.
- `schemas/`: data and AI contracts; `experiments/`: isolated spikes; `tests/` and `benchmarks/`: validation and results.
- `docs/01-compliance/`: rules, licenses, and provenance; it does not accept terms or submit on the user's behalf.
- `docs/07-experiments/`: recording/replay/A/B; `docs/08-ai/`: provider capabilities and unverified account items.
- `docs/10-sound-behaviors/`: sound behavior architecture/events/bridge/draft schema/acceptance; ADR-014. Keep physics motion, content generation, and propagation separate; a creative sample is not real vibration, and all 3D sound still passes through the unified acoustic chain. Label a comparison acoustic or behavior A/B and check its fixed conditions beforehand.

<!-- english-original-anchor --> <a id="工程規範"></a>
## Engineering Rules

Formal documents retain Traditional Chinese (Taiwan) as canonical, with an English interface and a complete set of documentation translations provided at the user's request; English documents must include the original path/hash and current/stale status. Tasks and test data are shared, without creating a separate work system. Code/API/paths use English. Keep modules concise, errors explicit, and domain IDs stable; do not use array indices/opaque Rapier handles as persistent IDs. Validate revision for each scene command, apply atomically, and support undo; do not serialize runtime engine objects into Scene.

Use SI (m, kg, s, rad, Hz, Pa); right-handed coordinates with +Y up and -Z forward; quaternion `[x,y,z,w]`. Physics uses fixed steps and rendering uses interpolation; gravity=0 is still dynamic, and fixed bodies are unaffected by forces. Grabbing retains contact solving and finite impulse; do not parent to the camera. Physics/renderer/solver/audio/AI have separate clocks; count source emission time and propagation delay only once.

Label acoustics analytical/numerical approximation/perceptual approximation/unverified. Label materials Measured/Derived/Tuned/Synthetic, clarifying energy/power/pressure, A/R/T, bands, and installation and frequency conditions. Scattering does not additionally destroy energy. dBFS is not dB SPL. Only solver data may produce sound rays; an IR does not imply individual paths are available.

The audio callback does not wait for AI, network, geometry, or physics; do not perform unbounded allocation/logging or blocking work in the callback. Use the actual block size; smooth gain/delay, use stable path IDs, and enforce a voice budget. Separate continuous sources from contact voices.

<!-- english-original-anchor --> <a id="skills"></a>
## Skills

First read the task-appropriate `.agents/skills/<name>/SKILL.md`: `acoustic-research`, `acoustic-validation`, `steam-audio-integration`, `physics-interaction`, `spatial-audio-dsp`, `ux-engineering`, `experiment-validation`, `compliance-and-provenance`. Keep full research texts/large documents in docs/research and avoid loading everything.

For Harness tasks use `agent-orchestration`, `muse-implementation`, and `codex-verification`; for prompt evaluation use `muse-prompt-optimization`, and for product Meta tools use `meta-experiment-agent`. Do not relax frozen acceptance; preserve actual executor/model provenance. `agent_execution` is only a run projection of existing Wiki tasks.

Before UI changes, read `docs/05-ux/DESIGN_SYSTEM.md`, its indexed canonical tokens and Component/FPS/Motion specifications, and `reflection-lab-design-system`; load Emil Skills with pinned sources as needed for the task. Do not record code review/token calculations as a browser visual pass; provide separate evidence for actual visuals, input, audio, and performance. Wiki UI pages are summaries only and do not separately maintain token values or Component specifications.

<!-- english-original-anchor --> <a id="建置與驗證"></a>
## Build and Validation

See `.node-version` and `package.json` for exact Node/npm versions; `npm ci` → `npm run check`. The formal Web uses `npm run dev` and `npm run build`; actual versions, separate browser commands, and the license inventory are in the [Web Toolchain](03-sdk/V1_WEB_TOOLCHAIN.md). `check` covers original research regression, runtime, build, and license checks; it does not imply inclusion of native/browser/hearing tests. Clearly list commands actually run. The original `npm run test:physics` and `npm run benchmark` are research baselines and cannot replace new formal runtime/browser acceptance; native SDK commands remain in `docs/03-sdk/SDK_VALIDATION.md`.

Important mathematical models, scene boundaries, schema positive/negative cases, and regressions require meaningful tests; do not create tests that copy the implementation for documentation-only/low-impact changes. Synchronize fixture references/tolerances when changing formulas; add Claim ID/source/conditions/verification status for important claims. Keep V0–V5 separate and mark unexecuted items NOT RUN.

<!-- english-original-anchor --> <a id="授權安全與完成定義"></a>
## Authorization, Safety, and Definition of Completion

Do not copy large amounts of papers/SDK documentation/commercial assets; record license/source/version/hash for every dependency, dataset, sound effect, and HRTF. SDK binary caches do not enter Git; the user has not decided the project's root LICENSE. Secrets must not enter the repository; Meta keys stay on the server, spending defaults to 0, and an unverified account must not be described as live integration.

Preserve uncommitted changes; destructive reset/clean and unauthorized deployment/push are prohibited. Preserve errors on failure and provide a recovery method; carry out ordinary reversible engineering work autonomously without repeatedly requesting permission. Before completion, execute appropriate commands and read the results, and synchronize ADRs/status/limits; a plausible-looking UI cannot replace physics/acoustic validation. New features require reproducible evidence, sources, and remaining limitations for the next step; changing status alone cannot establish completion.
