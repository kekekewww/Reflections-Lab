<!-- english-source: {"path":"docs/11-v1/M0_IMPLEMENTATION.md","sha256":"64186449d4cd1893b12b059e12be3a53d4acc9b5124d439428404e77b414fdab","translated_at":"2026-10-27T03:41:10Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/M0_IMPLEMENTATION.md`](../../11-v1/M0_IMPLEMENTATION.md). Source SHA-256: `64186449d4cd1893b12b059e12be3a53d4acc9b5124d439428404e77b414fdab`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="m0-audio-event-runtime-已實作"></a>
# M0 Audio Event Runtime Implemented

2026-10-27, Task0011 DONE; this is only an accepted domain layer within the first version and does not mean that the entire product, browser, DSP, or Meta live integration is complete.

- `src/audio-behavior/`: normalized event ordering/deduplication, orthogonal continuous and one-shot behavior, contact/object emitters, bounded latch and mapping, voice admission, snapshot/epoch, and replay.
- `src/app/behavior-editor.ts`: candidate validation, effective overrides, separating a single object's shared profile, revision/generation/asset pins, and safe authoring operations.
- The original acceptance conditions are retained; [formal validation](../../../artifacts/v1/m0-validation-20261027.json) actually ran 40 domain tests + 20 authoring tests, 60/60 PASS, with the hashes of 61 protected files preserved.
- [Independent raw domain results](../../../artifacts/v1/m0-independent-domain-review.json) contain complete stdout, exit, and 8 fixed source/test hashes, cross-checked separately against the sources for this change. The binding overrides issue in the authoring UI projection was fixed during root integration; domain tests cannot be extrapolated into UI acceptance.

To rerun:

```powershell
node --import tsx --test tests/audio-behavior/runtime.test.ts tests/app/behavior-editor.test.ts
```

Task0006, 0012–0014, and overall first-version Task0016 continue under their respective original acceptance criteria. Real Audio/browser, source phase/complete replay, device performance/listening tests, and product Meta live integration each require their own direct evidence and do not inherit M0's PASS.
