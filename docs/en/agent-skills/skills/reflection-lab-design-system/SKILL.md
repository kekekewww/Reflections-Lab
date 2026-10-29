<!-- english-source: {"path":".agents/skills/reflection-lab-design-system/SKILL.md","sha256":"7273040da88b79020776f18f4875c9a087312069a4ae9ced944bfb16d14aebc5","translated_at":"2026-10-27T03:38:38.947915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: reflection-lab-design-system
description: Use when planning, implementing, or reviewing Reflection Lab UI, components, animation, FPS/Build, or acoustic charts; read the formal design specifications, Emil skills, states, and validation requirements as needed, and avoid treating static review as a pass on a real device.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/reflection-lab-design-system/SKILL.md`](../../../../../.agents/skills/reflection-lab-design-system/SKILL.md). Source SHA-256: `7273040da88b79020776f18f4875c9a087312069a4ae9ced944bfb16d14aebc5`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="reflection-lab-設計工程"></a>
# Reflection Lab Design Engineering

<!-- english-original-anchor --> <a id="入口與範圍"></a>
## Entry Point and Scope

Read `docs/05-ux/DESIGN_SYSTEM.md` first. This project is still in research/preproduction; this skill does not authorize formal product development, installation of UI dependencies, or deployment. The latest user requirements, adopted ADRs, and numerical/DSP contracts take precedence.

<!-- english-original-anchor --> <a id="按需讀取"></a>
## Read as Needed

- Change visual values only in `docs/05-ux/DESIGN_TOKENS.json`, whose format is governed by the schema in the same directory; do not create another set of authoritative values in the Wiki or CSS.
- For components, read `COMPONENT_SPEC.md`, `COMPONENT_STATES.json`, and `COMPONENT_STATES.md`; the seven states and async states are orthogonal.
- For workspace/selection, read `WORKSPACE_ARCHITECTURE.md`; for FPS/Build, read `FPS_INTERACTION_UX.md`, `docs/04-physics/INPUT_CONTROLS.md`, and `docs/04-physics/FPS_INTERACTION_SPEC.md`.
- For motion, read `MOTION_GUIDELINES.md`; for performance, read `PERFORMANCE_STANDARDS.md`; for extreme data/failure recovery, read `UI_STRESS_TESTS.md`.
- For upstream sources/MIT/versions/instruction differences, read `EMIL_SKILLS.md` and `third_party/emil-skills.manifest.json`. The original Emil texts are in `.agents/skills/`; use emil-design-eng for component design, animate for animation implementation, review-animations for a single review, improve-animations for an overall audit, animation-performance for measurement, pick-ui-library for library selection, prototype for authorized prototypes, and break-ui for stress testing. Loading all eight every time is unnecessary.

<!-- english-original-anchor --> <a id="工作流程"></a>
## Workflow

1. Check the current Wiki task, latest ADRs/feature status, and existing component patterns; confirm that UI implementation is already authorized for this work.
2. List workspace, input owner, stable selection, backend capability, scene/result revision, the seven states/async states, and error recovery; display high-frequency data and keyboard operations immediately.
3. Use the same tokens; draw only paths supplied by the solver in 3D; keep source/listener, models, and units traceable. A UI spring is not a physics grab, and animation does not drive the audio clock.
4. Preserve Tab/IME/Esc/blur, visible Mute/Pause, operations without pointer lock, and Reduced Motion; switching workspaces must not reset a run/recording.
5. For static validation, run `node scripts/setup/emil-skills.mjs --check` and `--standards`; then run the corresponding UI, physics, and DSP tests for the changes actually made, retaining commands and results. Measure all six performance budgets separately; do not infer the audio deadline from FPS.
6. Check the seven states, keyboard, zoom, long Traditional Chinese text, and rapid interruption/retry in a real browser; retain screenshots/frame traces/device information. If UI or screenshot capabilities are unavailable, enter `NOT RUN` or `STATIC REVIEW`, never visual PASS.
7. Update the relevant Wiki task, design decisions/review history, evidence, and handoff; maintain specific values only in docs/05-ux.

<!-- english-original-anchor --> <a id="失敗與回復"></a>
## Failure and Recovery

If an upstream hash does not match, retain the diff and do not overwrite; restore only fills missing files. When a skill cannot be found, check the manifest/local paths first; do not automatically upgrade to latest. When design conflicts with adopted physics/DSP contracts, retain the sources and record a conflict; do not guess the correct answer from appearance. Apply upstream bare greeting/wait-for-selection instructions according to the scope the actual user has already authorized; do not repeatedly request permission for ordinary reversible work.
