<!-- english-source: {"path":"docs/05-ux/DESIGN_SYSTEM.md","sha256":"2a9d0fa7d5168479a72322538686722e8eb63ae639d6d41f9d8ea481e63c5eab","translated_at":"2026-10-27T03:39:12Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/DESIGN_SYSTEM.md`](../../05-ux/DESIGN_SYSTEM.md). Source SHA-256: `2a9d0fa7d5168479a72322538686722e8eb63ae639d6d41f9d8ea481e63c5eab`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="視覺互動與可及性設計規範"></a>
# Visual, Interaction, and Accessibility Design Standards

<!-- english-original-anchor --> <a id="2026-10-28-使用者指定的-emil-ui-方向"></a>
## October 28, 2026: User-specified Emil UI direction

The user explicitly selected [Emil Kowalski Skills](https://github.com/emilkowalski/skills) as the primary reference for subsequent UI layout and interaction. Use the existing pinned `emil-design-eng`, and use animate, review-animations, and animation-performance as needed for motion; source and installation status remain in [EMIL_SKILLS](EMIL_SKILLS.md). The local main skill matched the pinned manifest hash; no upgrade, dependency installation, or upstream skill change was made.

Based on this preference and the prior user test, subsequent implementation follows these directions:

- Give the 3D scene, selection, and primary actions prominence by default; make start/pause, mute, and first-person entry/exit easy to find and operate.
- Reduce persistent explanatory text. Place revision, hash, model/source, complete limitations, and debugging details in expandable information; show errors, necessary warnings, and statuses affecting the current action where they are needed. Information must remain available without all occupying the main view. This principle also applies to requirements in other specifications in this directory to display technical data.
- Establish order through clear type hierarchy, spacing, grouping, alignment, and consistent components. Concrete values remain maintained in the canonical tokens. The default layout itself must work well.
- Size panels for the current work and retain usable adjustment, collapse, and restore controls; avoid layers of borders and explanations crowding the scene.
- Give buttons and dragging immediate, clear feedback; motion should be restrained, purposeful, and interruptible, and high-frequency controls must not wait for animation. Retain keyboard, focus, and reduced-motion rules.
- First fix the reported inaccessible first-person controls and unclear entry, then organize information and components, and finally address layout details the user may defer.

These are the user's direction and project implementation requirements, not a claim that the new UI is complete. Actual screens, interaction, and usability require separate verification; development remained paused at the user's request at this historical point. This section supplements the historical October 26, 2026 standards and does not treat the historical static check as a pass for this revision.

Review date: 2026-10-26. Status: **Original design standards; UI not implemented / no claim of WCAG conformance**. The goal is a dark but not pure-black, understandable professional tool that prioritizes data, objects, and sound states over decoration. The 4px spacing comes from this project's needs; it does not copy a competitor's tokens.

<!-- english-original-anchor --> <a id="正式來源與維護入口"></a>
## Authoritative Sources and Maintenance Entry Points

This directory is the sole authoritative maintenance location for concrete UI/UX standards; the Wiki only indexes and summarizes status and decisions. The Phase 2 additions do not authorize starting the formal product UI. Design values are `PROPOSED`, and the standards are ready for static checks; browser, animation, performance, and usability on actual devices remain **NOT RUN**.

| Standard | Sole maintenance location |
| --- | --- |
| Color / typography / spacing / radius / border / elevation / motion / z-index / interaction tokens | [DESIGN_TOKENS.json](../../05-ux/DESIGN_TOKENS.json), with the format in the [schema](../../05-ux/DESIGN_TOKENS.schema.json); Markdown no longer maintains a separate set of values |
| Component data and states | [COMPONENT_SPEC.md](COMPONENT_SPEC.md), [COMPONENT_STATES.md](COMPONENT_STATES.md), [machine-readable state matrix](../../05-ux/COMPONENT_STATES.json) |
| Animation decisions / interruption / Reduced Motion | [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) |
| Workspaces / selection / Inspector | [WORKSPACE_ARCHITECTURE.md](WORKSPACE_ARCHITECTURE.md) |
| FPS / Build normal and failure flows | [FPS_INTERACTION_UX.md](FPS_INTERACTION_UX.md), [INPUT_CONTROLS.md](../04-physics/INPUT_CONTROLS.md) |
| Performance values / six measurement methods / stress tests | [Authoritative budget](../06-validation/PERFORMANCE_BUDGET.md), [measurement methods](PERFORMANCE_STANDARDS.md), [UI_STRESS_TESTS.md](UI_STRESS_TESTS.md) |
| Emil selection / pinned version / license / limits | [EMIL_SKILLS.md](EMIL_SKILLS.md), [provenance](../../../third_party/emil-skills.manifest.json) |

Before implementation, read the applicable standards, the project's `reflection-lab-design-system` skill, and the required upstream skills. After implementation, use the stress matrix to check actual visuals/interactions, animation, and performance, then update the Wiki design decisions / review history. Static checks alone cannot close visual acceptance.

```powershell
node scripts/setup/emil-skills.mjs --check
node scripts/setup/emil-skills.mjs --standards
```

<!-- english-original-anchor --> <a id="視覺層級與-tokens"></a>
## Visual Hierarchy and Tokens

| Token group / key | Purpose |
| --- | --- |
| `color.canvas / panel / raised` | Background / sidebars / overlays |
| `color.textPrimary / textSecondary / textMuted` | Primary text / units / readable secondary information |
| `color.accent / success / warning / danger` | Focus / valid / limits and stale state / errors |
| `color.borderSubtle / borderControl` | Decorative divisions / important control boundaries |
| `typography / spacing / sizing` | Traditional Chinese font fallback, engineering numbers, density, and hit areas |
| `radius / border / elevation / zIndex` | Shape, focus, overlays, and stacking order |
| `motion / interactive / acoustic` | Purposeful motion, states, and acoustic line-style semantics |

All colors are initial tokens awaiting implementation. Check actual hover/disabled/selection backgrounds and chart color overlays, rather than validating color swatches alone. Selection uses accent plus outlines / nodes / text; errors have icons and messages; stale states have badges plus timestamps. Disabled controls must not use low opacity that makes their reasons hard to read.

On 2026-10-26, static color swatches were calculated in Python using sRGB linearization and `(Lmax+0.05)/(Lmin+0.05)`. The worst combinations across the three backgrounds `canvas/panel/raised` are below. This is a **static token calculation PASS**; transparency, color overlays, actual UI, and overall WCAG conformance have not been validated.

| Foreground | Minimum contrast ratio | Interpretation |
| --- | --- | --- |
| primary / secondary / muted text | 12.97 / 8.05 / 6.06 : 1 | Initial solid-color normal text exceeds 4.5:1 |
| accent / success / warning / danger | 7.77 / 8.50 / 8.63 / 6.54 : 1 | Solid colors are distinguishable on all three backgrounds; shapes / text are still required |
| border-control | 4.16 : 1 | Exceeds the 3:1 non-text target |
| border-subtle | 1.45 : 1 | **Does not meet the requirement for important control boundaries**; decorative divisions only, never the sole cue |

Use a 4px grid; read values only from `spacing` and `sizing`. Master Mute / Enter FPS / Enable object use `criticalTarget`; compact layouts still retain keyboard focus and `minimumTarget`. Do not increase density by shrinking hit areas.

Text uses the system fallback specified in `typography`; **no fonts were downloaded or redistributed with the package in this work**. Numeric tables use `numericVariant`; IDs / paths may use monospace. The interface uses Traditional Chinese terminology from Taiwan; APIs, units, and object IDs remain in English.

<!-- english-original-anchor --> <a id="版面與縮放"></a>
## Layout and Zoom

The initial desktop layout reads only `sizing` tokens; these are design starting values, not a guarantee of a minimum usable screen size. Sidebars can collapse, and splitters support dragging as well as keyboard arrow adjustments / reset. No panel may become so small that it hides focus. User configurations are saved separately for each Workspace, with an additional "Restore layout" entry point.

For small windows / 200% zoom, use one main workspace plus switchable panels. Shorten tool text while keeping accessible names unchanged. Monitor/Mute/Pause remain reachable and must not be hidden behind the canvas by an overflowing horizontal toolbar. 3D and large tables may retain necessary two-dimensional views, but also provide readable summaries / lists; ordinary forms and explanatory text should reflow. The 320 CSS px and zoom tests have not been run. "This is a professional tool" cannot exempt the entire UI from accessibility requirements.

<!-- english-original-anchor --> <a id="視覺狀態語彙"></a>
## Visual State Vocabulary

| State | Visuals and copy | Prohibited misleading presentation |
| --- | --- | --- |
| Running | Solid play icon + "Computing" + run/tick | A blinking light alone |
| Paused | Pause icon + reason + Resume | Describing a blur pause as completed |
| Recording | Circle icon + "Recording" + duration / gaps | A red dot without text / recording type |
| Muted | Crossed speaker + "Monitor muted; simulation still computing" | Leading users to think the source has stopped |
| Pending | Clock + "Waiting for geometry update" / the specific task | An endless spinner without cancellation / reason |
| Stale | Amber badge + result revision / current revision | Presenting old results as current |
| Unsupported | Neutral badge + reason + alternative view | An empty gray chart that leaves users guessing whether there is no sound |
| Error | Error icon + actionable reason / retry | Only showing a stack trace, or overwriting old data on retry |
| Measured/Computed/Estimated | Text badge + expandable metadata | Substituting an "AI" badge for the data source |

Do not hide units in placeholders: position m, angle deg, time ms/s, mass kg, frequency Hz. Display decimal precision according to magnitude and meaningful precision, with the original value available for inspection. Distinguish `0`, `— Not provided`, `Not yet computed`, and `Invalid fit`. Percentages and linear coefficients follow their definitions; dB must include its reference / quantity. Do not label dBFS as dB SPL.

<!-- english-original-anchor --> <a id="動態與時間"></a>
## Motion and Time

High-frequency actions (selection, Inspector values, HUD, key presses) update directly, without entrance animations that make interaction feel slow. Panel opening and closing use `motion.duration.panel`; reduced-motion defaults to immediate changes. When opacity is needed to aid understanding, record the reason in the review. See [MOTION_GUIDELINES.md](MOTION_GUIDELINES.md) for the complete decision order. Head bob, frequent shake, and blinking energy lights are prohibited as defaults. Do not infer acoustic arrival time from visual motion.

UI transitions, physics fixed steps, acoustic solver updates, and audio rendering each use their own time. Crossfades on the AudioContext timeline do not depend on CSS. Solver result data change only when a new frame is complete. Pending may be shown during computation, but interpolation must not draw reflection paths that do not exist. Dragging may smooth the **view**, but smoothed values must not be written back as measured values.

Refer to the purposeful-motion principles in the pinned Emil version. Original skills and required references are retained under MIT in `.agents/skills/`. See [EMIL_SKILLS.md](EMIL_SKILLS.md) for sources, per-file hashes, selection, and project-specific differences.

<!-- english-original-anchor --> <a id="輸入與直接操作"></a>
## Input and Direct Manipulation

Every clickable icon has a tooltip, an accessible name, and an explicit action. Tooltips can be triggered by focus and must not be the only source of essential information. Scene-authoring deletion / modification uses Undoable commands. Reset is not Undo: clearly state the target revision, retain completed results, and mark unfinished recordings as interrupted. Ordinary reversible adjustments do not add confirmation for each action. Numeric fields provide units, fine adjustment, and direct input; drag sliders have button / numeric alternatives.

3D Object outlines, selected paths, and collision contact markers use different shapes. Do not render physgun control lines and acoustic rays in the same style. Material previews show appearance; acoustic presets / band evidence are listed separately. A metallic texture must not imply measured coefficients. Ghost valid/invalid states have check / blocked icons as well as textual reasons.

Tab retains focus, and B switches FPS Build; key-binding instructions read from the action mapping. Chinese IME, contenteditable elements, and input fields own their keys; game input does not receive them. See [FPS_INTERACTION_UX.md](FPS_INTERACTION_UX.md) for safe exit on Esc / blur.

<!-- english-original-anchor --> <a id="可及性要求與音訊暴露"></a>
## Accessibility Requirements and Audio Exposure

The target is the relevant UI behaviors of WCAG 2.2 AA. There is no finished product at this stage, and **conformance has not been evaluated**. Implementation must check text / control contrast, keyboard operation, focus, reflow, chart alternatives, drag alternatives, and audio controls. Focus uses `border.focusWidth / focusOffset` and a high-contrast ring. Custom dialogs manage focus on opening and return it to the original control on closing; they must not trap the user.

Audio defaults to muted and is enabled by a user gesture; Master Mute and monitor gain remain reachable at all times. Sound events also have visual / textual displays; hearing alone must not be required to determine whether an impact occurred. 3D directions also have directional / numeric displays. Default to low monitor gain, and mode switching does not increase source gain. State honestly when actual SPL / exposure is unknown; a dBFS meter or limiter cannot serve as headphone safety calibration. No medical safety, hearing, or equipment-exposure certification has been performed.

Provide alternatives for motor impairments: toggles without hold/chord requirements, button / numeric movement, preset source/listener trajectories, and selection without pointer lock. Support zoom and high contrast for low vision; reduce motion and stop camera shake; provide readable events and analysis data for users with hearing impairments. Supplement the canvas with DOM tools, object tables, and path tables. Adding `aria-label` alone cannot justify claiming that the entire 3D editor is usable.

Platform references: [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/), [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/), [Web Audio API](https://www.w3.org/TR/webaudio-1.0/), reviewed 2026-10-26. The above is a brief summary of source principles and local design; no lengthy standards text has been copied.

<!-- english-original-anchor --> <a id="實作前後的驗證清單"></a>
## Validation Checklist Before and After Implementation

| Validation | Expectation / evidence | Status in this work |
| --- | --- | --- |
| Static token contrast | Text against its background ≥4.5:1 (normal text), important non-text boundaries ≥3:1; actual combinations require separate validation | Solid-color token calculation PASS; subtle is decorative only, not a full UI PASS |
| Keyboard / lock | Core flows can be completed, Esc exits, Tab manages focus, IME does not trigger physics | NOT RUN |
| Screen reader | Main controls, Inspector, tables, and states are understandable; no per-frame aria-live spam | NOT RUN |
| Zoom/reflow | 200% / 320 CSS px, retaining Mute/Pause / exit and forms | NOT RUN |
| Pointer alternatives | Equivalent experiments can be completed without dragging or pointer lock | NOT RUN |
| Audio | Gesture activation, reachable mute, no gain spike on Raw switching, no event retrigger | NOT RUN |
| Reduced motion | No head bob; panels do not block input; audio time does not follow animation | NOT RUN |
| Scientific clarity | Provenance, units, capabilities, stale state / limits are inspectable; no decorative fake paths | NOT RUN |

This checklist validates UX only; mathematical and performance validation of acoustics / physics / DSP must be completed separately.
