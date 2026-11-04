<!-- english-source: {"path":"docs/11-v1/ACCEPTANCE_AMENDMENTS.md","sha256":"b6163f9c9f2c1d281de36d00385095aa2cfeca85953ad6138c80b061f87f8a8d","translated_at":"2026-11-02T07:34:39.6597379+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/ACCEPTANCE_AMENDMENTS.md`](../../11-v1/ACCEPTANCE_AMENDMENTS.md). Source SHA-256: `b6163f9c9f2c1d281de36d00385095aa2cfeca85953ad6138c80b061f87f8a8d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="第一版驗收補充"></a>
# First-version acceptance amendments

This page records changes the user explicitly made after the first-version acceptance was frozen. The original `ACCEPTANCE.md`, `REQUIREMENTS.json`, and historical tests are retained; the confirmed changes below take precedence when interpreting current gates. This does not permit implementers to relax tests on their own.

<!-- english-original-anchor --> <a id="2026-10-28正常顯示比例"></a>
## 2026-10-28: Normal display scale

The user confirmed: “Native 200% scaling does not need to be verified. This scale is too extreme; we only need to ensure that the product is usable at normal scale.”

- Remove the pre-delivery human verification gate for “native browser 200% scaling” from V1-UX-05. Do not schedule that test or list it as a required item awaiting the user.
- Current acceptance checks readability, access to primary controls, layout and operation at normal 100% display scale. Existing responsive, keyboard, focus and Reduced Motion automated regressions and historical results remain in place.
- First-person entry, movement, mouse lock and safe exit, and actual-device listening requirements remain valid. Automated tests cannot replace these human observations.
- This change does not mark the unrun native 200% test PASS or declare the complete first version finished.

<!-- english-original-anchor --> <a id="2026-11-01第一人稱滑鼠操作與直接建造"></a>
## 2026-11-01: First-person mouse controls and direct building

In the B5 section of the R20 human test the user reported: “Build mode is very unintuitive… I should not have to click a confirmation before I can keep building or operating objects; I should be able to operate directly. … After entering build mode I could not leave it.” They asked that “a left click should grab objects directly and a right click should build, without needing shortcuts such as E or B”. The user also chose: while holding, left click throws and right click puts down; hold the right button to preview and release to place; objects placed in mid-air stay in the air but still collide. The full report is in the [R21 user report](../../11-v1/USER_TEST_FEEDBACK_20261101-r21.json).

- Replaces “explicit Enable after geometry ack, then a separate Resume” in V1-BLD-01 and V1-CON-05: releasing the right button places the object. Internally the Ghost → PlacementPending → Staged → Active sequence still runs; before the geometry ack there is no active body, collider or sound source, and revalidation and overlap rejection are unchanged. After the ack the object is enabled automatically without a user confirmation. If the simulation was running before placement and nothing else paused it meanwhile, it keeps running. On failure the transaction rolls back, leaving no half-created or disabled object and requiring no hidden button to escape. Each release of the right button creates at most one object.
- Replaces `throw` = left click, `toggleBuild` = B, `ghostPlace` = left click and `ghostCancel` = right click in the input mapping of `docs/05-ux/FPS_INTERACTION_UX.md`: when not holding, left click grabs, and holding the right button previews and releasing places; when holding, left click throws and right click puts down (same semantics as Drop). During a preview, left click or Esc cancels. E, G, F, R and L remain optional shortcuts; B and a build mode are not needed.
- Changes how V1-PHY-06 preserves the ghost: the right-button preview is transient input, so Esc, focus loss, losing the mouse lock or pausing cancels it without placing. The Held preservation rules are unchanged.
- Adds mid-air placement: when the crosshair hits no surface within the preview distance, the object is placed at the preview distance along the view direction and defaults to `dynamicNoGravity`; surface placement keeps the draft's mode. Full shape-query overlap rejection and the 3.5 m range limit are unchanged.
- Adds: first-person control hints move to a hint bar at the bottom of the viewport that does not cover the crosshair or the centre of the view, and list the actual keys for the current context.
- The click that acquires the mouse lock (left or right) must not grab, throw or place; alternative input without mouse lock still provides equivalent buttons.
- This change marks nothing PASS; B5 must be retested by the user after implementation.

<!-- english-original-anchor --> <a id="2026-11-01主頁面說明文字改為懸浮提示"></a>
## 2026-11-01: Main-page help text becomes hover tooltips

The user asked: “Write documentation for the detailed settings of every parameter, then delete all explanatory text from the main project page, or turn that text into alternative text that appears when the mouse hovers over it.”

- The main page no longer shows explanatory paragraphs; static help becomes a tooltip next to the field or heading, opened by mouse hover and by keyboard focus, closed by Esc, and exposed to assistive technology through `aria-describedby`. The reason a control is disabled must also be reachable by focus.
- Field labels, values and units, dynamic status, errors, refusal reasons, safety and volume warnings, and short evidence tags such as “Synthetic” or “numerical approximation” stay visible; the design-system rule that a tooltip must never be the only source of required information still applies to them.
- The unit, range, default and effect of every parameter are collected in the [parameter reference](PARAMETER_REFERENCE.md).
- This change does not mark touch or screen-reader operation PASS.

Original pinned source SHA-256: `ACCEPTANCE.md` = `9a7355656a1fdb734a4261cd525f25baaad99664bbe876952087026b2ab6e406`; `REQUIREMENTS.json` = `7506d24fa30acca446a517c4a9660ee53b62928ab0047048151583c8de5c6a3c`.

<!-- english-original-anchor --> <a id="2026-11-02基本功能回報與新增實作範圍"></a>
## 2026-11-02: basic-function feedback and added implementation scope

The user explicitly reported, "Testing is complete and basic functions work"; see the [formal feedback](../../11-v1/USER_TEST_FEEDBACK_20261102-basic-complete.json). The R18/R21 blocker awaiting human basic-operation testing is resolved. Do not request the same basic-function test round again; retain historical FAIL and then-pending test records. This is user-reported evidence, not automatic PASS for scientific validation, device-specific checks, formal 600-second performance, full Meta live or the newly added features.

The user subsequently authorized six-core implementation, parallel worktrees inside the project, independent Claude revalidation after basic tests, memory checkpoints/handoffs, local-main integration and actually operating the product to export audio. The finite core scope and acceptance follow the [implementation contract](../14-core-pipeline/IMPLEMENTATION_CONTRACT.md) and [authorization source](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1c8807e9ba7b981c937b04a7e84ea12859bfb497). This does not automatically start all 14 performance optimizations or adopt every PERF proposal, and does not mean full V1 is complete.

<!-- english-original-anchor --> <a id="2026-11-02全產品參數實際操作並實作尚未支援的選項"></a>
## 2026-11-02: actual operation of all product parameters, including implementation of unsupported options

The user further requested: "After completing all validation, actually operate the interface: click every parameter in the various possible ways, ensure it works, and record anything unusable while considering how to make it pass and implement it." The user explicitly added, "Also implement the options that are not yet supported." Sources: [whole-product audit request](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/a72f7bab1db603a9911d74a287164e1a63fd6f98) and [explicit unsupported-option authorization](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1863912da15dd68ade3ee77d87fb9cff0307e4f8).

- Scope covers the entire existing product UI and visible unsupported options, not only the six new tabs. Reconcile actual production-DOM pointer/keyboard interactions, applicable gestures, valid/invalid/exact-boundary cases, state/persistence/undo and original FAIL → fix → revalidation against the [audit contract](../15-ui-parameter-audit/CONTRACT.md). Unexecuted combinations remain NOT RUN; a static inventory is not browser PASS.
- The [implementation amendment](../15-ui-parameter-audit/AMENDMENT_UNSUPPORTED_OPTIONS_20261102.md) supersedes corresponding parts of the original core-scope limit that left unsupported OnZoneEnter/Exit and similar options as future work. Actual product capabilities are required. Merely removing disabled status, fabricating events/rays or renaming gaps external gates cannot close the task. Do not rewrite the original six-core point/data/tests.
- The sole official task is the Task0028 whole-product audit and its execution slices, including Task0029 (Zone), 0030 (curved/dynamic reflections) and 0031 (formal Project environment persistence). These three currently visible gap categories do not mean the inventory is exhaustive. After additional implementation, refresh inventory/pins/crosswalk and revalidate affected source.
- Explicitly separate legitimate state/data prerequisites from genuine external account/device/permission gates. No paid/network-budget increase, deployment/push or acceptance of external terms on the user's behalf is authorized. Normal 100% scale remains. The earlier native Computer Use approval timeout cannot be relabeled success; keep actual-DOM, human, hearing, science and performance evidence separate.
- Local main and this round's delivery await implementation, validation and memory/English/handoff completion across the full scope. Neither adding this amendment nor an individual PASS establishes completion.
