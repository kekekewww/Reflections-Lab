<!-- english-source: {"path":"docs/15-ui-parameter-audit/acoustic-geometry/builder/REPORT.md","sha256":"1453c64d1005a188dc0e89dd7ecf93acda254485f74cdb25c97b4f1a2fe26a89","translated_at":"2026-11-02T10:01:02.350Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/15-ui-parameter-audit/acoustic-geometry/builder/REPORT.md`](../../../../15-ui-parameter-audit/acoustic-geometry/builder/REPORT.md). Source SHA-256: `1453c64d1005a188dc0e89dd7ecf93acda254485f74cdb25c97b4f1a2fe26a89`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="曲面聲學輸入與-inspector-接線"></a>
# Curved acoustic input and Inspector connections

Task0030 subscope. Status: basic Node/SSR validation passed; the lead/Root separately records actual production-browser and final merged verification.

<!-- english-original-anchor --> <a id="實作"></a>
## Implementation

- `buildAcousticRequests` supplies live/record/replay/A-B from the same data: boxes retain six planes; spheres/capsules contribute one analytical primitive per object. The capsule axis rotates local +Y by the actual quaternion, with half-segment length `(height-diameter)/2`.
- `surfaces.length + primitives.length` shares the existing `maxSurfaces`. The 105-object fixture is 24 planes +100 primitives=124, without relaxing the original default cap of256. Over-budget input rejects early without dropping geometry.
- Each emitter excludes its own geometry. Every request deep-copies positions, axes and geometry; the cache does not survive calls, and a new tick/pose rebuilds immediately. Missing moving poses, nonfinite/sparse positions and nonunit quaternions explicitly reject.
- A shared `acousticSnapshotRole` makes fixed staticSurface reflective and explicit dynamicReflector reflective at the snapshot. Older moving staticSurface retains occlusion semantics; the UI explains why without automatically changing authoring settings.

| Before | After | Why |
| --- | --- | --- |
| Entire sphere/capsule material and role fields disabled | Enabled through shared shape capability; editing remains disabled during running/replay | Controls actually enter solver geometry while retaining state rules |
| Dynamic reflection labeled backend-dependent | Explicit dynamic-reflector and quasi-static limits | Users can assess the implemented model and its boundaries |
| A moving object could newly select staticSurface and silently become occlusion-only | staticSurface choices are restricted to fixed objects; an older value remains with an explanation | Avoid implying that a static setting reflects while moving |

Existing Section/select/microcopy/tokens are reused. No animation, CSS or separate design values were added. ARIA descriptions point to actual model and legacy explanations.

Each request also pins the solver model from the complete authored Scene. Even when the emitter is the only sphere and self-exclusion removes it, that request does not mix back into the legacy version. Purely planar scenes still omit new fields to preserve their older serialized representation.

<!-- english-original-anchor --> <a id="原失敗與測試調整"></a>
## Original failures and test adjustments

`legacy-contract-before-update.txt` retains the older24-case result:16 PASS/8 FAIL. Complete original-test preimages and SHA values remain in `legacy-test-preimages.json`; original data was not deleted.

- An older ownership fixture omitted the default ball pose and passed only because curves were previously excluded. It now supplies the actual pose; original box-vertex/normal/material/ownership assertions are unchanged.
- Exact per-source budget accounting now includes the request's one sphere as well as planes. The global256 cap is unchanged.
- Older recording-processor cases explicitly expected dynamicReflector to degrade to occlusion and curves to be ignored. Only expectations superseded by the user's expanded scope were updated, with sphere/capsule poses added. Original direct occlusion, finite-plane path length, delay and pressure-ratio tolerances are entirely retained.

<!-- english-original-anchor --> <a id="已執行"></a>
## Executed checks

- Final `node --import tsx --test tests/app/acoustic-primitives-input.test.ts tests/app/acoustic-input-ownership.test.ts tests/app/recording-processor.test.ts`:41/41 PASS,0 skip, exit0. Original output: `builder-mixed105.txt`.
- The new file contains17 cases covering all shapes/roles, RecordedPose/BodyPose consistency, pose updates, clone ownership,105 objects and exact capacity, missing-pose/NaN/sparse rejection, legacy omission, stable ordering and Inspector SSR states.
- Scoped six-file ESLint, Prettier and whole-source TypeScript: exit0. Receipts and file hashes are in `verification.json`.

<!-- english-original-anchor --> <a id="受保護混合-105-物件容量修補"></a>
## Protected mixed105-object capacity correction

The originally added105-object test contained only cloned balls. The actual performance-fixture.mjs uiScene contains33 boxes,33 spheres,33 capsules and the original default objects. Retaining six faces per dynamic box gives222 faces+67 primitives=289, exceeding the original256. The original fixture and established SHA of its746-byte constructor are checked individually by the new test; fixture, old numerical oracle and cap were not changed.

Only for the EXTENDED model, when the current source's uncompressed geometry exceeds the same cap, mapped dynamicOccluder boxes become one analytical OBB occlusion volume each. Reflecting boxes retain six exact planes; legacy pure-box models gain no fields or representation changes. The actual mixed fixture becomes24 reflecting planes+67 curved primitives+33 OBBs=124. Both256 and exact124 succeed;123 still explicitly rejects.

Each source determines whether compression is needed after its own emitter exclusion. Cache keys explicitly distinguish faces/volume so one source's representation cannot contaminate another. New tests cover both source orders, independent ownership of OBB center/halfExtents/quaternion, actual pose updates and owner exclusion, and negative cases that preserve reflector/legacy representation.

This is geometry-representation and capacity regression evidence, not formal performance improvement or a600-second test pass. Independent OBB-intersection and solver-integration mathematics are recorded separately by the lead/primitive-math task.

<!-- english-original-anchor --> <a id="限制與接手"></a>
## Limits and handoff

SSR establishes field connections and disabled/text states only, not browser visual/input acceptance. Actual UI selection/save/rays/recording/WAV were not run in this subtask; they require Root's browser lease and final integration.

The solver finds curved specular positions, while amplitude retains the ray-path model without curvature focusing, diffraction, solid transmission or retarded moving-boundary/Doppler. Mathematical references, energy and V0–V5 evidence belong to the geometry lead/independent-reference subtasks and cannot be replaced by these UI/builder tests.

The old browser case expecting curves not to participate was located at `tests/browser/ui-refined-v2.spec.ts:476`. This subtask did not modify or run it. The lead/Root should retain its original cutoff, update it for the new capability and revalidate.
