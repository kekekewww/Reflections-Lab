<!-- english-source: {"path":"research/v1/meta-live-payload-preview-20261027-r2/INDEPENDENT_REVIEW.md","sha256":"54c82850817513fa71d868f01f46c375b12be6cba2d480697887774dc83bf55d","translated_at":"2026-10-27T03:43:35.566572Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/v1/meta-live-payload-preview-20261027-r2/INDEPENDENT_REVIEW.md`](../../../../../research/v1/meta-live-payload-preview-20261027-r2/INDEPENDENT_REVIEW.md). Source SHA-256: `54c82850817513fa71d868f01f46c375b12be6cba2d480697887774dc83bf55d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-live-r2-獨立審查"></a>
# Meta live r2 independent review

Date: 2026-10-27. Reviewer: `/root/v1_ai_session_finish/sound_live_contract_review`.

Conclusion: **PASS, limited to the offline review of the r2 synthetic payloads, diagnostic redaction, and dispatch-stop controls.** The root cause of the first HTTP 400 has not been confirmed, and success of the next model request is not guaranteed; this record is not a new spending authorization.

<!-- english-original-anchor --> <a id="完整-payload-核對"></a>
## Complete payload verification

The three complete raw requests, readable JSON files, [manifest](../../../../../research/v1/meta-live-payload-preview-20261027-r2/manifest.json), and [offline repair record](OFFLINE_REPAIR_AUDIT.md) were read. An independent program verified deep equality between raw/readable versions, UTF-8 bytes, SHA-256, all user JSON, and complete tool definitions for each file; all results matched.

| Phase | request | bytes | SHA-256 |
| --- | --- | ---: | --- |
| Scene | [scene.request.json](../../../../../research/v1/meta-live-payload-preview-20261027-r2/scene.request.json) | 11979 | `1dd811bf45e98eefb9da7d7630f7945fed8eb31124c2b86a855476af8ad6b825` |
| Sound | [sound.request.json](../../../../../research/v1/meta-live-payload-preview-20261027-r2/sound.request.json) | 15430 | `71e9291cc763a9d3b7c0a4b912f38b4ca5368845ec0dd89cc0188205025db704` |
| Run | [run.request.json](../../../../../research/v1/meta-live-payload-preview-20261027-r2/run.request.json) | 12236 | `883a8064a086ff1bfa529784be73126bd147583abd49994c3af3a27af4174792` |

The complete content agrees with independent results from the [synthetic defaults](../../../../../src/app/defaults.ts), [fixed prompts / oscillator registry](../../../../../server/meta-live-fixture.ts), [deterministic Scene adapter](../../../../../src/ai/scene-adapter.ts), and current tool schema generators. Scene uses the fixed 6 demonstration objects; Sound uses scene revision 1 / 7 objects after the explicit addition of a demonstration sphere and the unchanged default Behavior document; Run uses the same fixed Scene. Sounds are procedural oscillators, and the asset registry is empty.

No user-saved project, private files, sample audio, or key content was used. No credential marker, Bearer data, or local absolute path was found in the three complete bodies; this classification is also supported by complete source equivalence. Tools are limited to Sound proposals or the existing Scene / experiment allowlist, with no filesystem, shell, repository, or arbitrary URL tools.

<!-- english-original-anchor --> <a id="診斷流程與預算控制"></a>
## Diagnostics, workflow, and budget controls

- The [sanitizer](../../../../../server/meta-http-diagnostic.ts) first redacts the complete supplied key and any case variant of an `LLM_` token, then removes control characters and truncates; it retains only four bounded strings, `code/type/param/message`, plus a fixed kind, without copying the body, headers, or other nested fields.
- The [CLI](../../../../../server/meta-live-validation-cli.ts) saves the sanitized HTTP receipt before `ledger.settle`. Known 4xx rejections and ledger stops are retained separately; a reserve rejection uses `BUDGET_EXCEEDED` and is no longer mislabeled as a transport timeout.
- There is no automatic proposal retry within a phase, and provider `maxRetries` is 0. Execution order is Scene ? Sound; whether an additional model Run request is made depends on `remainingRequestSlots` in the same persistent ledger. The fixture test with one existing reservation adds only 2 model requests, with Run explicitly identified as local `HOST_EXPLICIT_FIXED60`, not Meta Run.
- HTTP 400 acknowledgement in the [ledger](../../../../../server/meta-live-budget.ts) only appends an explicit record; it does not rewrite the original attempt, usage, unknown billing status, or the US$0.25 reservation. Unknown transport / other HTTP / usage issues still stop execution, and the policy of US$1 total, US$0.25 per request, and at most 3 requests remains in effect.
- Manifest / body files are checked before the key loader; each actual body's bytes / SHA-256 are checked again before reserve and remote transport. Content differences neither reserve budget nor dispatch. The fixed official endpoint, `muse-spark-1.3` Standard, 1000 completion tokens, and prohibition on redirects remain unchanged.

<!-- english-original-anchor --> <a id="獨立執行證據與限制"></a>
## Independently executed evidence and limitations

- `node --import tsx --test tests/ai-runtime/meta-http-diagnostic.test.ts tests/ai-runtime/meta-live-validation.test.ts`: **6/6 PASS**, including the shared budget after a prior HTTP 400, zero-dispatch mismatch, and the negative 400 case that saves redacted diagnostics first.
- `node --import tsx --test tests/ai-runtime/meta-live-budget.test.ts`: **17/17 PASS**, including acknowledgement not clearing an unknown outcome, not refunding, not increasing the three-request limit, and preservation of data and locks.
- Complete preview comparison in this review: **PASS**; all test transports were injected fakes, and files used only test temporary directories.

This review did not read the actual key, catalog, or production paid ledger, made no network / model requests, and did not modify r1 or previous failure evidence. The only added file was this record. The cause of the first 400 remains unknown; this review must not be used to infer zero cost, successful inference, or completed live acceptance.
