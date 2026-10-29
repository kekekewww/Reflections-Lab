<!-- english-source: {"sha256":"c0ff132b4416b4921b02c97bb2c5461ee2f9b94c671f288fb0cc2a52dfdbc50d","path":"schemas/README.md","links":"english-relative","executor":"Codex","model_id":null,"translated_at":"2026-10-27T03:38:13.6167968Z"} -->
<!-- english-notice:start -->
> English translation of [`schemas/README.md`](../../../schemas/README.md). Source SHA-256: `c0ff132b4416b4921b02c97bb2c5461ee2f9b94c671f288fb0cc2a52dfdbc50d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="資料契約"></a>
# Data Contracts

Draft 2020-12. Local schemas and provider strict tool schemas are separate; see docs/08-ai for `ai-*`.

`examples/` contains synthetic test inputs, not running scenes / measurement results. Empty IR/path fields must not be treated as a successful simulation. `npm run validate:schemas` runs positive and negative cases through AJV; cross-ID checks, quaternion norm, A+R+T, capability consistency, ordered timestamps, scene bounds, and artifact existence / hash require domain validation. Domain checks may be marked VERIFIED only when implemented in validators / tests; the product host validator remains to be implemented.

Geometry `dimensionsM` is defined as object-local bounding dimensions `[width,height,depth]`; a sphere must have three equal values, with radius=width/2; capsule height includes the two hemispherical end caps, with radius=width/2, width=depth, and height>=2*radius. Nonuniform sphere scale is rejected. AI tools enter this Scene through an adapter and cannot be used directly as Scene patches.

An API schema's input space may exceed the engineering limits of the current scene; the host domain validator must narrow it to scene bounds / capability / budget. The schemas do not claim to provide arbitrary meshes: the initial version defines primitives only, and a versioned mesh asset schema will be created separately in the future.
