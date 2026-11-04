<!-- english-source: {"path":"docs/16-nonadvanced-completion/lanes/integration/USER_REPORTED_FIXES_20261103.md","sha256":"eb55030d6e3134d9d63d2818709e28e7f198ac574ccf3b1cd48fa9a6ca377949","translated_at":"2026-11-03T15:08:11.000Z","executor":"Claude Code","model_id":"claude-opus-5-5","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/16-nonadvanced-completion/lanes/integration/USER_REPORTED_FIXES_20261103.md`](../../../../16-nonadvanced-completion/lanes/integration/USER_REPORTED_FIXES_20261103.md). Source SHA-256: `eb55030d6e3134d9d63d2818709e28e7f198ac574ccf3b1cd48fa9a6ca377949`. Executor: Claude Code; model ID claude-opus-5-5. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="人工測試回報的三個問題與修正2026-11-03"></a>
# Three issues reported in manual testing and their fixes (2026-11-03)

Before and during manual testing the user reported three issues:

1. "When looking around in first person, the view occasionally jumps to another angle, which distracts users."
2. "The default ball sometimes makes no sound after an action."
3. "Grab should be snappier; at the moment, when the view turns a little faster, the held object comes loose, so users must be very careful."

| Item | Fix commit | User's own test |
| --- | --- | --- |
| View jumps, ball occasionally silent | `c1002ac7` (src tree `6cb3d25a`) | User reported "Both fixed" on 2026-11-03 (4173 production build `c1002ac7`) |
| Grab comes loose | `2f2aa2c7` (src tree `c4bab9cb`) | User reported "Grab feels good" on 2026-11-03 (4173 production build `2f2aa2c7`) |

Browser-test maintenance is in `15e0282f`, `956ee761` and `f04fbbf8` (test selectors and row selection only; no assertion changed).

<!-- english-original-anchor --> <a id="1-第一人稱視角跳動"></a>
## 1. First-person view jumps

**Cause**: entering first person acquired the mouse lock with `requestPointerLock()` without `unadjustedMovement` (the [input spec](../../../04-physics/INPUT_CONTROLS.md) IC-01 requires raw mouse input, falling back only when unsupported). In Chrome's normal (OS-adjusted) mode on Windows, a single large movement the mouse never produced is occasionally reported (for example when the cursor is re-centred, or the first event after re-locking). The interaction host only limited each event to ±500 px at 0.002 rad/px, so one bad event could turn the view by up to about 57°, which is the "jump to another angle" that was seen. The camera pose is built directly from yaw/pitch without interpolation, and the host is created once, which rules out jumps from interpolating across ±π or from a reset.

**Fix** (`src/ui/viewport/useFPSInput.ts`, `src/ui/viewport/look-filter.ts`):

- Entry now uses `requestPointerLock({ unadjustedMovement: true })`; only when the browser answers `NotSupportedError` does it fall back to normal mode, and other errors are shown as before.
- Mouse movement first passes through `LookSpikeFilter`: an event far above recent motion (> max(120 px, 4× recent peak), recent peak half-life 60 ms) is held for one event; it is applied together with the next event only if that one continues in the same direction with at least 1/4 of its size, otherwise it is dropped. A real fast flick is delayed by one event, and an isolated bad movement is dropped. The filter resets on every lock change.
- Sensitivity 0.002 rad/px is unchanged; raw mode bypasses Windows pointer acceleration, so the feel may differ slightly.

<!-- english-original-anchor --> <a id="2-預設球偶爾無聲"></a>
## 2. Default ball occasionally silent

**Cause** (reproduced with the real Rapier default scene): an impact sound is decided only on the tick a contact episode begins, and `samplePair` skipped contact points whose pre-step distance exceeded 1.5 cm. When the ball lands at a moderate speed, the solver may apply the impulse through a speculative contact while the ball is still 1.6 cm above the floor; that point was skipped, so there was no OnImpact. Whether a landing falls into this case depends only on the phase of the 60 Hz fixed step, so the same action sometimes sounded and sometimes did not. Example: after a drop from 1.6 m, the second landing at 1.44 m/s with an impulse of 2.1 N·s was completely silent. In addition, low bounces (about 0.3–0.7 m/s) never left the contact range, counted as the same episode and did not sound again.

**Fix** (`src/physics/physics-world.ts`):

- Contact points that carry actual impulse always count, whatever their pre-step distance; distant points without impulse are still excluded by the 1.5 cm rule.
- Following the rearm rule of the [event model](../../../10-sound-behaviors/EVENT_MODEL.md): within one episode, a new impulse after 3 consecutive ticks without normal impulse (stable separation) is a new strike, and it must still pass the original impulse, closing-speed and 80 ms cooldown gates. Resting or rolling contact has impulse every tick and never retriggers.
- The sentence in the [Physics Bridge](../../../10-sound-behaviors/PHYSICS_AUDIO_BRIDGE.md) saying the persistent-contact re-strike rearm extension is not yet done is superseded by this fix; that spec page is a pinned Wiki source, was not rewritten in this round, and is listed for a later documentation sync.

<!-- english-original-anchor --> <a id="3-抓取在快速轉視角時鬆脫"></a>
## 3. Grab comes loose during fast view turns

**Cause**: a held object chases, with finite impulses, a target point 2 m in front of the view. The target point could move at most 3 m per second, the velocity feed-forward was capped at 3 m/s, the per-kilogram acceleration budget was 20 m/s², and any lag over 1.5 m released the object at once. An ordinary fast 172°/s turn moves the target point at 6 m/s, so the default ball could not keep up and was released; at 115°/s it already lagged 1.18 m.

**Fix** (`src/physics/physics-world.ts`; [physics architecture](../../../04-physics/PHYSICS_ARCHITECTURE.md) 4.1 marks these as tunable demo bounds):

| Parameter | Old value | New value |
| --- | --- | --- |
| Target-point travel and velocity feed-forward limit | 3 m/s | 20 m/s |
| Servo natural frequency wn / damping | 10 rad/s / 1 | 20 rad/s / 1 (kp 400, kd 40) |
| Per-kilogram acceleration budget | 20 m/s² | 150 m/s² |
| Absolute hand-force limit FhandMax | 150 N | 150 N (unchanged) |
| Torque budget | 15 N·m | 15 N·m (unchanged) |
| Release condition | Lag > 1.5 m releases at once | Lag > 1.5 m sustained for 0.5 s, or lag > 3 m at once |

It is still a finite-impulse servo with a target sweep and overlap check, never parented to the camera and never teleported; the rule that a blocked target stops extending behind a wall is unchanged, and heavy objects still lag more under the 150 N limit. The "suggested starting values" in [physics architecture](../../../04-physics/PHYSICS_ARCHITECTURE.md) 4.1 and the [acceptance amendments](../../../11-v1/ACCEPTANCE_AMENDMENTS.md) are also pinned Wiki sources and were not rewritten in this round; this page holds the values, and the sync is listed as follow-up.

<!-- english-original-anchor --> <a id="驗證"></a>
## Verification

Evidence files are in [user-reported-fixes-20261103](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/user-reported-fixes-20261103).

| Item | Result | Evidence |
| --- | --- | --- |
| Impact sound: landing reproduction (Node + real Rapier) | Before the fix, drops from 0.4–3 m had 1–2 silent landings at 0.41–1.44 m/s; after it, every landing at ≥0.4 m/s has an OnImpact and nothing retriggers at rest; the new tests are RED before the fix and GREEN after | `tests/physics/contact-emission.test.ts`, [probe](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d2a63d852baa62c7a15c4f706980957b9ffc43dc) |
| Impact sound: real Chrome product build (`c1002ac7`, e2e) | 10 drops; every OnImpact started one native 440 Hz voice (2–3 impacts per drop), 0 rejections | [impact-sound-probe-c1002ac7.json](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/38f3c9b6570b0131940e3171d0ed59349f779ad6) |
| View: unit tests | Spike filter 6/6; first-person entry coordination 19/19; the two new cases "requests raw mouse input and falls back only when unsupported" and "an isolated spike is dropped" both fail on the pre-fix source `3a03adc3` and pass after the fix | `src/ui/viewport/look-filter.test.ts`, `src/ui/viewport/fps-entry-coordination.test.ts` |
| Grab: fast-turn tests (Node + real Rapier) | Default ball at 2 m, 180° turns: 172°/s went from released at 1.42 m lag→held at 0.18 m lag; 344°/s→0.57 m; 573°/s→1.82 m, still held and catching up; the new test is RED on the old servo | `tests/physics/grab-turn.test.ts`, [probe](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/53b04beacdb19937a129e6a51ef21d831181177a) |
| Grab: V1 wall/corner/stack matrix (0.1–20 kg) | Wall and corner penetration ≤0.1 mm (was ≤0.6 mm); 20 kg gravity stack contact 0.4→2.0 mm; impulse never exceeds the unchanged 150 N limit | [before](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/8a22cf7ba1db47d2691351977c3a35805ad929ad)/[after](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/2102343869f4b6ea6a405b4e843354dfc4137b8d) |
| All runtime unit tests (`2f2aa2c7`) | 2284/2284 | [log](archive://uncommitted-local/docs/16-nonadvanced-completion/lanes/integration/user-reported-fixes-20261103/test-runtime-2f2aa2c7.log) |
| Real Chrome: pointer-lock race (`956ee761`) | 2/2 | [result](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/d57aa7dd2d5ca7ef3c1666b67aac978dd84a02d5) |
| Real Chrome: ten-cycle lifecycle (`956ee761`) | 2/2 | [result](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/59bfb758f7c559d1c1c5d93055e0d5ef4c61a4c1) |
| Real Chrome: linked-workflow-v2 (`f04fbbf8`) | 8/8 (the 2 earlier failures came only from the canvas selector and a "newest row first" assumption; the tests were fixed, assertions unchanged) | [result](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7113959e47f1dc5fb98f086c7baac0ac0f7d85b2) |
| Real Chrome: ui-refined-v2 | 43/47 after the fix at `956ee761`; the same specs on the pre-fix source `3a03adc3` fail the same 4 cases (English dialogs, duplicate audio-buffer restart message, curved-body acoustics note, OnBounce option), so they are existing drift, not caused by these fixes | [after](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/1a052858027de48483f4868a7817f4d67fd3aa61)/[before](archive://f95431483db0bf48e7fc86fc630179a73ed810ff/7f908f3648291ca98d5e3e828cdbe599cc311790) |
| Real Chrome: refined v3 product E2E (`956ee761`) | 1/3 clean launches plus relink passed; the failures are still the "recording evaluation queue full" pause during recording, the same environment problem as before the fix | `artifacts/v1/product-e2e-chrome-20261103T142634Z/` |
| User's own test | View and impact sound "Both fixed"; grab "Grab feels good" | Top of this page |
| Full S4 22 routes | NOT RUN (not rerun in this round) | — |

Test maintenance: the pointer-lock race, ui-refined-v2 (including gizmo, first use, locale and first-person race) and linked-workflow-v2 specs used `locator("canvas")` or `document.querySelector("canvas")`; after the top monitor added a second canvas they failed before reaching the lock logic, or silently picked the top-monitor level meter. All now use `.viewport-canvas-wrap canvas`, with no assertion changed. Specs outside the documented procedure (linked-workflow-v1, meta-ui-workflow, native-admission, pipeline-ui) still use the same form. A test run had overwritten the tracked R21 evidence screenshots `artifacts/v1/r21-helptips-20261101/help-*.png`; the original files were restored.

<!-- english-original-anchor --> <a id="限制與後續"></a>
## Limits and follow-up

- Raw mouse mode and the spike filter can only be confirmed by unit tests and the user's own hardware; headless Chrome cannot reproduce the Windows bad movements.
- The grab parameters, the rearm and the speculative-contact rule are recorded on this page and in the code; the pinned Wiki sources `PHYSICS_ARCHITECTURE.md`, `PHYSICS_AUDIO_BRIDGE.md` and `ACCEPTANCE_AMENDMENTS.md` await a later sync.
- refined v3 still cannot reach a stable 4/4 on this machine in its current state (an environment problem; see the [interface pass record](../ui/readability-pass-20261103/README.md)).
