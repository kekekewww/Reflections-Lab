<!-- english-source: {"path":"docs/superpowers/plans/2026-10-27-v1-implementation.md","sha256":"3f6aad2e93e089edade52ac9573ca9f65f78bf6d530a859bf6fb031623cb5325","translated_at":"2026-10-27T05:42:00.517Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/superpowers/plans/2026-10-27-v1-implementation.md`](../../../superpowers/plans/2026-10-27-v1-implementation.md). Source SHA-256: `3f6aad2e93e089edade52ac9573ca9f65f78bf6d530a859bf6fb031623cb5325`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab-第一版實作計畫"></a>
# Reflection Lab V1 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development with separate file ownership and independent acceptance review. The user has explicitly requested direct implementation until V1 is complete; do not wait for another plan approval.

**Goal:** Complete an executable V1 for three-dimensional physics, traceable acoustics, Sound Behavior authoring, and experiments, providing tests, independent review, Wiki, handoff, and Git evidence according to existing acceptance criteria; do not use Muse quota.

**Architecture:** The Scene document and atomic commands are the authority for authoring data; Rapier's fixed step manages runtime poses. Behavior generates bounded audio intents, the Custom Acoustic Core computes actual paths, and WebAudio only renders; React/R3F provide presentation and interaction. The Meta server adapter retains the product model integration, while offline tools explicitly label their provenance.

**Tech Stack:** Existing pinned Three.js, Rapier, TypeScript, and AJV, plus exactly pinned React19/R3F9/Vite and tsx/Playwright.

**Spec:** [Roadmap](../../ROADMAP.md), [Scene/Physics slice](../../NEXT_ENGINEERING_TASK.md), [Sound architecture](../../10-sound-behaviors/SOUND_BEHAVIOR_ARCHITECTURE.md), [M0 acceptance](../../10-sound-behaviors/NEXT_AUDIO_MILESTONE.md), [Design System](../../05-ux/DESIGN_SYSTEM.md). The overall V1 scope must not be narrowed by the exclusions of a single Scene slice.

<!-- english-original-anchor --> <a id="全域限制"></a>
## Global Constraints

- Do not change existing schema/fixture/reference to weaken acceptance; add a product host adapter with an explicit version.
- SI, stable IDs, fixed physics step, independent render/acoustic/audio clocks, and no arbitrary JS rules.
- All 3D sources use unified propagation; delay/distance/HRTF each count once, and contact positions are not always the object center.
- No secrets in the repository, Muse quota calls, increases to paid limits, push, deployment, or accepting terms on the user's behalf.
- Do not call the product Meta API without a verified account / explicit nonzero budget; offline/fixture results must not impersonate Meta. Do not mark uncompleted live acceptance DONE.

<!-- english-original-anchor --> <a id="review-focus"></a>
## Review Focus

- Invalid / stale commands, file import, undo/redo, and partial failures must not corrupt current data.
- Objects still collide while grabbed; Throw happens once; mode/pause/blur/input focus changes must not leave forces active or trigger unintended actions.
- Continuous and one-shot sources coexist, with deterministic outcomes for extremes / missing assets / duplicate events / voice bursts.
- Occluded direct paths, reflection arrivals, and gain/delay must not be bypassed through another UI or audio route.
- Recording/replay and comparisons must not silently change unrelated physics conditions; return unavailable when results are missing, and AI must not generate measurement numbers.

<!-- english-original-anchor --> <a id="分工與交付順序"></a>
## Work Allocation and Delivery Order

- [ ] Task0006: `src/scene/`, `src/physics/`, and the existing `src/scene-host.mjs` acceptance entry point; pure domain and real WASM first, then browser.
- [ ] Task0011: `src/audio-behavior/`, fixed fixtures, epoch/snapshot/replay, bounded voices, and independent review.
- [ ] Task0012: Connect `src/acoustics/`, `src/audio/`, `src/ui/`, and `src/app/` into a vertical feature that can actually be operated; numeric/OfflineAudioContext/browser acceptance.
- [ ] Task0013: FPS/build/grab/throw, state and material rules, timeline, `src/experiments/`/`src/persistence/`, and both A/B types.
- [ ] Task0014: `src/ai/`, `server/`, Meta provider and safe tool host, and actual manual fallback. Retain external live gates under Task0007; do not falsely report completion.
- [ ] V1 integration: Freeze the acceptance matrix, run full regression, record separate evidence for browser operation / audio / performance, perform isolated review and repair, update status/limits/Wiki, handoff, and local Git.

Root exclusively owns package/config, app controller, Wiki/task, and final integration; each subagent writes only its own modules/tests. Write meaningful failing cases first, then implement and read actual test results; accept each milestone independently. Continue the next phase until the original goal is achieved; do not treat M0 or only passing offline tests as completion of all V1 work.
