<!-- english-source: {"path":"artifacts/v1/static-preview-20261027/README.md","sha256":"4a34c7ab7f7d19b79341e341b215bd531193b423b48e7990c15b29e74a5228ba","translated_at":"2026-10-27T07:35:05.0256262Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`artifacts/v1/static-preview-20261027/README.md`](../../../../../artifacts/v1/static-preview-20261027/README.md). Source SHA-256: `4a34c7ab7f7d19b79341e341b215bd531193b423b48e7990c15b29e74a5228ba`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="靜態場景聲學預聽實作與分項證據"></a>
# Static Scene Acoustic Preview: Implementation and Scoped Evidence

Date: 2026-10-27. The executor is Codex; development Muse calls and live API calls for this item are both 0. This is a scoped implementation under the original UX04, **not a declaration that the complete first version is finished**.

<!-- english-original-anchor --> <a id="行為與資料邊界"></a>
## Behavior and Data Boundaries

- The Inspector's "Scene acoustic preview" uses applied objects/bindings/rules; when rule or object override drafts exist, apply or discard them first. Object emitters use snapshot positions and rotated offsets; fixed emitters use their configured positions; zones are not yet supported. Missing actual mapping inputs are explicitly rejected.
- Contact rules accept only retained actual physics inputs and accepted start VoiceIntent records. The position comes from the contact point, reusing the generator, gain, pitch, and filter accepted for that occurrence. When the original physics event is selected, the corresponding layer is also located by object/binding/rule, rather than arbitrarily taking the first sound.
- The contact cache holds at most 64 entries and shares one authoring document snapshot within the same revision/epoch; Scene/Behavior authoring changes or epoch recreation clear the cache. Before preview, the document's canonical content is compared, including binding overrides; parameters from old events are not labeled as results of the current document.
- One explicit source is routed through the existing `buildAcousticRequests`, Custom Acoustic Core, and AudioEngine. No propagation, distance gain, or HRTF algorithm was added. The preview renderer's local limits are 1 voice and 8 individual paths plus 1 late send, totaling 9 paths; these are not new values for the production product's performance budget.
- Preview uses an independent AudioContext/epoch 0. Default emission is 2 s, with a hard limit of 3 s; rule one-shot/lifecycle behavior can make it shorter. Propagation and reverb tails are counted separately. The Inspector displays the static snapshot and source/listener/Scene/document/Profile/rule/binding/contact/solver revisions. Explicit preview does not evaluate triggers/conditions and is not a vibration measurement.
- Global Mute, monitor gain, and Raw/Simulated still control preview. An enabled and muted main engine is not automatically unmuted by preview. Raw displays a centered dry-sound bypass; only Simulated uses scene propagation and HRTF.
- While Running, both dry-sound audition and scene preview require pausing first; independent preview is available while recording is paused, without writing to the original recording. During replay, returning to the live scene is required first. Run/Recording/replay, authoring changes, explicit stop, blur, or dispose cancel or stop independent preview. Runtime intent and renderer serial together prevent late playback after waiting for device enablement.
- Node integration cases compare the original Scene, Behavior document/snapshot, runId/epoch, tick, events, recording, and comparison information; preview does not modify this original data.

<!-- english-original-anchor --> <a id="可重現修復"></a>
## Reproducible Fixes

1. [drain-regression-red.tap](../../../../../artifacts/v1/static-preview-20261027/drain-regression-red.tap): when rapidly replacing reverb previews, an already disposed engine still created nodes after waiting for fade-out, increasing the count from 59 to 63. The patch checks disposed after the existing `AudioEngine.drainVoices` wait; it does not change DSP formulas or tolerances.
2. [integration-races-red.tap](../../../../../artifacts/v1/static-preview-20261027/integration-races-red.tap): two new cases first failed as expected. In one, Stop occurred before the helper started, but the old action still emitted sound late; in the other, the wrong capture was selected among multiple impact layers for the same physics event. Both passed after fixes using runtime intent and the complete selection tuple.
3. Dry-sound audition adds an independent stop and post-enable identity check to prevent late playback after starting Run or pressing stop. No native acoustic oracle, historical FAIL, or existing acceptance criteria were changed.

<!-- english-original-anchor --> <a id="驗證與限制"></a>
## Verification and Limits

The fixed helper baseline [helper-proof.json](../../../../../artifacts/v1/static-preview-20261027/helper-proof.json) preserves the initial 14 GREEN checks, 53 adjacent checks, and source hashes; subsequent integration has versioned new sources, so this baseline cannot be treated as evidence of the current bytes.

See [final-proof.json](../../../../../artifacts/v1/static-preview-20261027/final-proof.json) for current sources and command results, and [final-node-green.tap](../../../../../artifacts/v1/static-preview-20261027/final-node-green.tap) for raw Node output: related regressions **92/92 PASS**, including new preview and adjacent audio/runtime/diagnostics/locale cases. An independent agent separately ran new runtime/helper/control graph cases, **22/22 PASS**, and statically checked UI/browser test contracts. Actual Rapier contacts use the production WASM; Node audio cases use fake contexts and verify only the control graph and lifecycle, not native PCM.

The following remain **NOT RUN** for this item: actual browser preview interaction/native routes, preview PCM, device/headphone hearing tests, and overall first-version acceptance. Two cases in `tests/browser/static-preview.spec.ts` and an independent config are ready for the root to coordinate after the overall source freeze and a new build; this work did not start a browser, server, or build itself. Before actual browser evidence is complete, Node results, tokens, or code review are not used to claim that visual/acoustic output passed.
