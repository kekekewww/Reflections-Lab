<!-- english-source: {"path":"docs/05-ux/MOTION_GUIDELINES.md","sha256":"937960e1af54e4f7307b712dc4beb630fd40384b72ab3271e72055ecd0baf292","translated_at":"2026-10-27T03:39:05Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/05-ux/MOTION_GUIDELINES.md`](../../05-ux/MOTION_GUIDELINES.md). Source SHA-256: `937960e1af54e4f7307b712dc4beb630fd40384b72ab3271e72055ecd0baf292`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="動畫決策與時間隔離"></a>
# Animation Decisions and Clock Isolation

Updated: 2026-10-26. Status: standards/initial design values; actual UI/device animation tests **NOT RUN**. Organized around the frequency, purpose, cost, and interruption principles in the [pinned Emil version](EMIL_SKILLS.md); values are maintained only in [DESIGN_TOKENS.json](../../05-ux/DESIGN_TOKENS.json). This page does not treat visual effects as acoustic or physics evidence.

Record the following decision fields in the design review for every new animation; when the answer to the first item is "not needed," present static feedback directly.

| Order | Required question | Reflection Lab decision/verifiable result |
| --- | --- | --- |
| 1 Frequency | Is it really needed? How many times will it appear per day/session? | Display keyboard shortcuts, Command Palette, selection, numeric, and HUD updates directly. Frequent operations do not queue or wait for enter/exit animations to finish. |
| 2 Purpose | What information does it communicate? | Use only for feedback, origin, state changes, or avoiding abrupt changes; engineering diagrams do not use decorative movement. Remove it when there is no specific purpose. |
| 3 Cost | What is the cheapest tool/property? | Use CSS transitions first for simple states; use WAAPI only when programmatic control is needed; assess a library only when gesture/spring/exit is truly needed. Default to transform/opacity; measure other properties on each device. |
| 4 Easing/duration | Does it delay readability or operation? | Use `motion.easing` and `motion.duration`. Prefer out easing for entering and exiting; prohibit global `transition: all`, scale(0), and blocking input while waiting for an animation. |
| 5 Interruption | What happens on rapid repeated presses, reversal, Esc, or pointer cancel? | Retarget from the current visual value; do not duplicate domain commands; cancellation does not commit; gestures release pointer capture; clean up animations when leaving the page. |
| 6 Alternatives | What happens with Reduced Motion/keyboard/touch? | With reduced-motion, default to immediate state changes; opacity may be retained when needed to aid understanding, but record the reason. Limit hover to fine pointers, do not make focus depend on hover; keyboard operation causes no displacement. |
| 7 Evidence | Have actual screens and performance been measured? | Record browser/device/zoom, normal/reduced motion, rapid reversal, slow playback, and a frame trace; record STATIC REVIEW when only code is available. |

Occasional panels may use `duration.panel`; presses use `pressScale` only for appropriate pointer actions; modals use `duration.dialog`, but focus transfers immediately. The first Tooltip may enter briefly; display it directly when an adjacent tooltip is already open. Feedback for data errors, Pause, Mute, and loss of lock appears immediately; never delay safety behavior for an attractive fade-out. Except for explicitly stated and measured special cases, UI animations stay below 300ms; this is a design review threshold, not a performance measurement result.

Do not use continuous blur, animated fullscreen backdrops, per-row stagger, unlimited layer promotion, or per-frame React setState. Use Accordion layout animations only when transform cannot express the change; limit their scope and measure them. Apply `will-change` only to necessary elements after an actual trace reveals a problem; never apply it globally. Using transform in CSS/WAAPI does not guarantee GPU acceleration in every browser; confirm it through a recording, and preserve correct behavior when falling back.

<!-- english-original-anchor --> <a id="不可共用的時基"></a>
## Clocks That Must Remain Separate

| Clock | Responsibility | What it cannot establish |
| --- | --- | --- |
| UI transition time | Presentation of panels, presses, focus, etc. | Physics ticks, arrival delay, or sound onset |
| render / requestAnimationFrame | Three view and fixed-step interpolation | Completion of a new solver frame or an audio deadline |
| physics fixed step | Constraints, contacts, and body state | Animation easing; a UI spring cannot serve as a Rapier grab |
| acoustic solver frame | Results and revision for a source/listener set | Paths fabricated by CSS interpolation; no sound rays may be drawn without individual paths |
| audio sample/block clock | Actual frames/sampleRate, gain/delay smoothing, scheduling | The visual budget at 60 FPS |
| AI/network completion | Asynchronous suggestions/diffs/cancellation | Permission for render/audio callbacks to wait for the network |

The view may smooth the observer camera, but cannot write back to measured values or fabricate unsolved reflection lines. Grab is controlled by bounded impulse/torque and collision solving; UI bounce, over-drag, and momentum dismissal do not apply to the physical constraints of a held rigid body. Audio fades and `Freeze-and-fade` retain the [Workspace contract](WORKSPACE_ARCHITECTURE.md); their initial DSP values are not managed by CSS tokens. See [PERFORMANCE_STANDARDS.md](PERFORMANCE_STANDARDS.md) for the six independently measured budgets.

<!-- english-original-anchor --> <a id="審查與上游差異"></a>
## Review and Differences from Upstream

`review-animations` can produce a Before/After/Why table; the project also records the actual verification level. Upstream includes details such as "Reduced Motion must not be zero," longer durations for generic drawers/toasts, mandatory press scale, and picker width animation. Reflection Lab prioritizes immediate, highly readable feedback and zero animation where necessary; exceptions already decided by the standards must be explicit, and upstream advice must not be used to add dependencies, change FPS physics, or extend frequent operations. Keep the original upstream files unchanged; record differences only in the project standards.

Animation acceptance: rapid opening and closing does not jump back to the start; Esc/blur can interrupt; focus is retained; Reduced Motion still provides readable state; touch leaves no lingering hover; solver/audio results do not change with panel animation. All items are currently **NOT RUN**.
