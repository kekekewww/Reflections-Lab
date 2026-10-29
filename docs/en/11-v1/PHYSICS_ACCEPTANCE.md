<!-- english-source: {"path":"docs/11-v1/PHYSICS_ACCEPTANCE.md","sha256":"65eb5d1a2422b3bd75fc319e51ca4c7bc68f36bfd8dad4aa5139c522dabccc5e","translated_at":"2026-10-27T19:35:22Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/PHYSICS_ACCEPTANCE.md`](../../11-v1/PHYSICS_ACCEPTANCE.md). Source SHA-256: `65eb5d1a2422b3bd75fc319e51ca4c7bc68f36bfd8dad4aa5139c522dabccc5e`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="物理與-scene-生命週期驗證"></a>
# Physics and Scene Lifecycle Validation

<!-- english-original-anchor --> <a id="2026-10-28當前來源補充"></a>
## 2026-10-28 Current-Source Addendum

The [current receipt for the 2 physics browser cases](../../../artifacts/v1/physics-current-operation-20261027T175652Z/operation-end.json), its comparison of 172 source hashes before and after, actual exit0, and port 5176 cleanup are complete; functional results using software ANGLE do not establish hardware performance or a completely leak-free heap. The latest narrow history/renderer DTO fixes in physics650233ed/runtimec3437ecd have 391 related regressions passing, with the complete public interpolation implementation retaining its original bytes; the earlier scope of 29 original WASM matrix cases + 9 boundary cases, totaling 38, is retained without adding together counts from different suites.

This round's formal 256-body performance-profile workload was valid, but native WASM step p95 was 2.2ms, missing the initial target of less than 2ms; complete fixed tick including copies p95 was 12.5ms. A functional matrix PASS does not replace a performance PASS. All raw results, the original protected set of 61 files, and the overall unfinished status are documented in [r10](SESSION_PROGRESS_20261028-r10.md). The existing matrix and the sources/methods from its time are retained below.

This page reports only the physics/Scene scope of the first-version matrix and does not mean the overall first version is complete. The original acceptance criteria, references, and tolerances were not changed; different agents handled implementation and the tests/review on this page.

<!-- english-original-anchor --> <a id="固定步同機重跑與抓取矩陣"></a>
## Fixed Steps, Same-Machine Reruns, and Grab Matrix

`node --import tsx --test tests/physics/v1-matrix.test.ts` actually tests the following:

- Two separately created real Rapier Worlds each run for 120 ticks with the same initial Scene, seed, creation order, fixed step, and tick-indexed intents; initial public `PhysicsSnapshot` values are compared first, followed by SHA-256 comparisons of all public snapshot fields on every tick. The observed local position/velocity difference was 0; this does not imply native WASM binary snapshot equivalence or cross-platform determinism.
- The 120 real solver states are identical at 30/60/144 Hz render cadences; reading interpolated poses does not change solver state.
- Four masses, 0.1/1/5/20 kg × thin wall/corner/dynamic stack × Gravity/NoGravity, for 24 cases. Each case uses 15 Hz rendering and 240 fixed steps; real mass/body type/gravity scale/collision/solver groups are retained, and control impulse/torque stays within the established limits. Actual collider sweep hits, horizontal displacement, nonzero impulse, blocked/saturation, and tracking error are all recorded.
- Ten real LabRuntime Run/Pause/Reset→export/import regressions were added: serialization produces fresh-world generation pins without changing live authoring pins; Scene metadata is preserved after import.
- Existing Lock/Unlock was also rechecked through actual `InteractionHost.handleKey("KeyF")`: it remembers the original NoGravity, clears Held, sets linear/angular velocities to zero, and does not operate on a remembered target through the first blocking shape; no mode metadata was added for testing. The positive regression passed. The added negative case, "an overlapping target cannot be unlocked," under `OBJECT_STATES.md` §3 reproduced a failure; the owner added an actual-pose shape query and trusted apply-boundary guard, and the independent targeted case passed. The final complete matrix contains 29 cases and still awaits new fixed evidence.

Maximum observed wall penetration during grabbing was about 0.607 mm, and dynamic-stack penetration about 0.440 mm. These are measurements from this fixture set; no universal penetration/tracking tolerance was adopted, and zero penetration is not claimed. Pass invariants include not crossing obstacles, preserving dynamic identity, bounded control, and actually involving obstacle queries.

The latest fixed evidence of **27/27 PASS, exit 0, sourceStable:true** is [matrix-v2/matrix-verification.json](../../../artifacts/v1/physics-acceptance-20261027/matrix-v2/matrix-verification.json), containing stdout/stderr/source, the package lock, and the actual WASM hash. The original 26-case [previous version](../../../artifacts/v1/physics-acceptance-20261027/matrix-verification.json) is retained; old records were not overwritten.

<!-- english-original-anchor --> <a id="真瀏覽器四-mode-與資源釋放"></a>
## Four Modes and Resource Release in a Real Browser

Actual commands:

```powershell
node tests/browser/run-physics-lifecycle.mjs
# 保存不可覆寫的正式證據版本：
node tests/browser/run-physics-lifecycle.mjs --evidence
```

A dedicated Vite configuration serves actual modules on port 5176, disables HMR, and uses a separate dependency cache, preventing reloads from other agents' development servers from interrupting acceptance. The launcher owns and releases its own server process, imposes a 120-second limit on the entire Playwright suite, and preserves stdout/stderr, source hashes before and after, and raw JSON; it does not take over or stop existing unknown processes. PhysicsWorld and React/R3F are not replaced; the tests did not call model APIs.

The four-mode Chrome case validates real 60 Hz WASM behavior: gravity/inertia/impulse, Fixed ignoring impulses, Kinematic next pose and thin-wall rejection, gravity switching while preserving velocity, Lock/Unlock at zero velocity, and pause without stepping. This is evidence from browser-hosted engine methods and is not described as Inspector click validation.

The lifecycle case uses the default React/R3F renderer of the production `mountReflectionLab`, first waiting for real GPU buffers and the registration of OrbitControls' document capture keydown, then performing ten reset/current export/import cycles and another nine remount/reset/import/dispose cycles, totaling ten mount/dispose cycles and nineteen reset/import sets. It observes native RAF, Worker, WebGL create/delete/context loss, and actual Rapier World/EventQueue free calls; no manual cancellation or substitute renderer is used to manufacture a pass.

One run with both cases passing and exit 0 is currently archived as [browser results](../../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-results.json) and [measured data](../../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-measurements.json). In that run, World 48/48, Queue 48/48, and Worker 18/18 were all released; no pending RAF, canvas, or monitored global input listener remained, and the RAF callback count stopped increasing after waiting; all ten WebGL contexts were lost, and tracked buffers/textures/programs/shaders/framebuffers/renderbuffers/VAOs returned to zero.

Both test-specific source guards passed in that run; the broader wrapper detected a concurrent update to `acoustic-service.ts` between the start and end of testing, so the [complete wrapper](../../../artifacts/v1/physics-acceptance-20261027/browser-20261027012455939/browser-verification.json) truthfully retains `sourceStable:false` and cannot serve as evidence of a frozen entire source tree. Listener observation was subsequently expanded to include visibility/IME/focus and others; the final rerun with all sources frozen still awaits recording.

<!-- english-original-anchor --> <a id="重現缺陷與限制"></a>
## Reproduced Defects and Limits

The first real-browser run reproduced `BEHAVIOR_INVALID: STALE_OBJECT_GENERATION` when exporting after Reset; the original [failure results](../../../artifacts/v1/physics-acceptance-20261027/browser-reset-generation-failure.json) are retained. The root cause was treating live runtime generation as a fresh-world Project pin. The implementer fixed the serialized copy, preserving the live document and the actual generation in recordings; an independent regression was added to confirm this.

The isolated review also identified that the main entry point originally lacked explicit unmountable React root/RAF ownership, and the risk of not releasing document listeners from an OrbitControls detached canvas; after the bootstrap and UI owners fixed these, the real-browser counts above were used to revalidate them.

The actual KeyF boundary reproduced another issue: adding an obstacle with 0.05 m overlap at the side of a fixed sphere still left the sphere as the first ray hit, and a real shape query clearly reported `OVERLAP`, but the original Host still submitted Unlock. The original [RED evidence](../../../artifacts/v1/physics-acceptance-20261027/unlock-clearance-red/verification.json) preserves test exit 1 and source hashes before and after; a positive mode-memory pass cannot replace validation of clearance rejection.

Interaction tests and the isolated review for the fixed version are retained in [interaction v3](../../../tests/interaction-runtime/evidence-20261027-v3/verification.json). This test author also ran the original targeted case and confirmed it passed without changing the expected result; the complete 29-case matrix and browser gate for the new bootstrap still depend on subsequent fixed results.

This evidence is limited to Chrome on the same machine using ANGLE/SwiftShader; it does not imply hardware GPU performance, a completely leak-free JS heap, all DOM listener types, automatic HMR/pagehide paths, audio listening tests, or cross-browser behavior. Releasing World/Queue/native GPU ownership does not mean that the JavaScript heap should decrease to zero.
