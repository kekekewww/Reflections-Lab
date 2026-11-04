<!-- english-source: {"path":"docs/15-ui-parameter-audit/zones/POSITION.md","sha256":"2c2e0b2e8292d38eba373ab835856d1017c0c377a12aa330df95c1514d62159a","translated_at":"2026-11-02T09:12:04.204Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/zones/POSITION.md`](../../../15-ui-parameter-audit/zones/POSITION.md). Source SHA-256: `2c2e0b2e8292d38eba373ab835856d1017c0c377a12aa330df95c1514d62159a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="task0029-補充連續-mode-change-的真正區域跨界"></a>
# Task0029 supplement: actual Zone crossings across continuous mode changes

Date: 2026-11-02. Starting point20bf09a1df54c81c22aabc8eff8235fc22ffc4d7. Explicitly adopted by Root, this fix supersedes the first-step-baseline limitation for mode changes in BASELINE.md's lifecycle-boundary section. Original reports and receipts remain.

<!-- english-original-anchor --> <a id="問題規則與最小修補"></a>
## Problem, rule and minimal fix

Public BodyPose.discontinuity previously covered authored transforms, creation/enable and body-mode changes together. Bounce and render interpolation still need those original semantics, but Zone body-center occupancy must not lose actual entry/exit because mode changes while position remains continuous.

- Adds zonePositionDiscontinuityUntilTick only to PhysicsWorld's internal Record. New bodies, enable and authored transforms set it for the next tick. Reset/geometry-generation reconstruction and deletion retain existing lifecycle rules.
- setMode retains its original generic-discontinuity and Bounce/contact invalidation rules. It neither writes nor clears the Zone position marker. Consequently, position-continuous mode changes/Motion release do not suppress crossings, while an authored teleport followed by multiple mode changes in the same tick cannot erase the position baseline.
- Each step passes a transient Set of at most256 position-discontinuity IDs to ZoneProducer. Explicit Set.has=false can override generic=true. A standalone producer without this trusted input retains the original generic-pose fallback.
- The marker exists only in internal Record and transient ZoneStep input. It is not added to BodyPose/PhysicsSnapshot/Scene/Recording/VoiceIntent schemas, hash inputs or persisted runtime engine objects.

<!-- english-original-anchor --> <a id="真-rapier-紅燈與綠燈"></a>
## Real-Rapier RED and GREEN

position-marker-red.txt ran before the fix:1 PASS/4 FAIL among five cases. All four failures use actual MotionWorkspace moveAndRelease+transfer: after Kinematic reaches x=1, it changes to dynamicGravity/dynamicNoGravity and crosses x=1.01 in the next step, but originally emitted no OnEnterZone/OnExitZone.

After the fix:

- position-marker-green.txt:17/17 PASS, including five new cases and12 original producer cases. The four positive cases assert no edge before release, an actual threshold crossing on the next step, generic discontinuity still true, and matching actual zone edge/zoneId/position and normalized bridge. No threshold or assertion was changed.
- The fifth case combines a same-tick authored teleport and multiple mode changes. It still invents no enter event and the subsequent baseline is stable.
- position-marker-regression.txt:76/76 PASS,0 skipped, concurrency=2; includes Bounce, Contact, MotionWorkspace, generation/history, Zone recording/worker/Project/detached ownership and actual Three wireframes.
- position-marker-lint.txt/position-marker-format.txt: scoped ESLint/Prettier exit0.
- position-marker-build.txt: npm run build (whole-tree tsc --noEmit+Vite) exit0. This local build includes a22 wireframes,20bf stale pins and this marker, producing index-Bem6B9u0.js. The original chunk-size warning remains intact; it does not establish formal performance acceptance.
- Independent bounce_review read-only review checked writers, same-tick teleport/mode changes, reset/delete, the bounded Set and public outputs. It confirmed no BLOCKER/MAJOR and did not independently rerun tests.

<!-- english-original-anchor --> <a id="容量與尚未執行"></a>
## Capacity and work not run

The original Zone classifier caps16 regions×256 bodies, with at most4096 occupancy-Map keys. This slice adds a per-step Set of at most256 IDs and an O(poses) scan, without an unbounded queue or per-tick React state. Events still share the2048 total cap. These are engineering capacities, not measured device frame-time/GPU/audio performance.

After merging, Root still needs complete three-state geometry-builder metadata integration and actual Zone UI/wireframe picking/persistence/record-replay/audio-file flows against the latest production bundle. This branch never started Chrome, Computer Use, paid APIs, a server or a push. Node, SSR and production build are not represented as browser/hearing/formal-performance or complete-V1 acceptance.
