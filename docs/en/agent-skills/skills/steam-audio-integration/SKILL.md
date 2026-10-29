<!-- english-source: {"path":".agents/skills/steam-audio-integration/SKILL.md","sha256":"e603df6cd10711f6fb69b25dfd49e9a5a6c3a50f51d76cc132de4c900f95679b","translated_at":"2026-10-27T03:38:38.947915Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
name: steam-audio-integration
description: Handle Reflection Lab Steam Audio C API, SDK download verification, native builds, licensing, capability adapters, and isolated smoke tests.
---

<!-- english-notice:start -->
> English translation of [`.agents/skills/steam-audio-integration/SKILL.md`](../../../../../.agents/skills/steam-audio-integration/SKILL.md). Source SHA-256: `e603df6cd10711f6fb69b25dfd49e9a5a6c3a50f51d76cc132de4c900f95679b`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="steam-audio-整合"></a>
# Steam Audio Integration

<!-- english-original-anchor --> <a id="trigger--purpose"></a>
## Trigger / Purpose

Maintain correct versions, ownership, and provenance when updating the SDK, using the IPL API, adjusting the native backend, or rerunning smoke tests.

<!-- english-original-anchor --> <a id="inputs"></a>
## Inputs

Target OS/arch, SDK release, hash, compiler, and required capabilities.

<!-- english-original-anchor --> <a id="workflow"></a>
## Workflow

1. Read the four documents in docs/03-sdk and the official pinned headers; confirm license/NOTICE/dependency distribution requirements.
2. Obtain it only from official releases, and run the download script's SHA256 verification; do not put the cache in Git.
3. Use the actual commands in SDK_VALIDATION to build an isolated smoke test; create context first, then scene/material/simulator/source, and solve after commit.
4. Check output units, bands, direct/reflections flags, and IR channel layout; finally release in reverse order and check reinitialization.
5. The UI displays only data supplied by the backend. Do not infer the existence of an individual specular path list from the names reflections/pathing.
6. Keep the WASM archive separate from a deployable browser runtime; do not claim web verified before the linker/worker/audio adapter is complete.

<!-- english-original-anchor --> <a id="references"></a>
## References

`docs/03-sdk/SDK_LICENSE.md`, `SDK_VALIDATION.md`, `STEAM_AUDIO_RESEARCH.md`, `INTEGRATION_COMPARISON.md`; `experiments/sdk-smoke-tests/`.

<!-- english-original-anchor --> <a id="outputs"></a>
## Outputs

Release/hash manifest, rerunnable build, numeric outputs, capability/ownership mapping, and licensing limitations.

<!-- english-original-anchor --> <a id="validation"></a>
## Validation

Actually rerun the pinned SDK smoke test and check the exit code/results; `npm run check` does not include the native SDK build.

<!-- english-original-anchor --> <a id="failure-handling"></a>
## Failure Handling

Record complete download/compilation/loading errors and the environment; preserve a working cache rather than replacing it with unverified files. Retain the Web fallback when native support is unavailable; do not fabricate smoke PASS.
