<!-- english-source: {"path":"research/v1/meta-live-payload-preview-20261027/INDEPENDENT_REVIEW.md","sha256":"47bf42af64ffc5381a8c4cc94830d82211abb6d9d055838337d052caf1d0df26","translated_at":"2026-10-27T03:43:35.566572Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`research/v1/meta-live-payload-preview-20261027/INDEPENDENT_REVIEW.md`](../../../../../research/v1/meta-live-payload-preview-20261027/INDEPENDENT_REVIEW.md). Source SHA-256: `47bf42af64ffc5381a8c4cc94830d82211abb6d9d055838337d052caf1d0df26`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="meta-live-synthetic-payload-獨立審查"></a>
# Meta live synthetic payload independent review

Date: 2026-10-27. Reviewer: `/root/v1_ai_session_finish/sound_live_contract_review`.

Conclusion: **PASS, limited to data classification, content binding, and the fixed outbound endpoint for the three payloads in this version; it does not mean that a paid model has been run or that live acceptance is complete.**

<!-- english-original-anchor --> <a id="審查對象與結果"></a>
## Review subjects and results

The three complete requests, corresponding readable JSON files, [manifest](../../../../../research/v1/meta-live-payload-preview-20261027/manifest.json), generator, and actual CLI were read. A separate independent Node program verified deep equality between raw/readable versions, complete content matching the synthetic sources, tool definitions matching the current generators, and the following UTF-8 bytes / SHA-256; all passed.

| Phase | Raw request | bytes | SHA-256 |
| --- | --- | ---: | --- |
| Sound | [sound.request.json](../../../../../research/v1/meta-live-payload-preview-20261027/sound.request.json) | 15299 | `6c5db0f41035bf9f3162a4b0424c4bc4f89d5126b9f2348219b7437aae4e3d8f` |
| Scene | [scene.request.json](../../../../../research/v1/meta-live-payload-preview-20261027/scene.request.json) | 11979 | `1dd811bf45e98eefb9da7d7630f7945fed8eb31124c2b86a855476af8ad6b825` |
| Run | [run.request.json](../../../../../research/v1/meta-live-payload-preview-20261027/run.request.json) | 12236 | `883a8064a086ff1bfa529784be73126bd147583abd49994c3af3a27af4174792` |

<!-- english-original-anchor --> <a id="資料分類"></a>
## Data classification

- The three developer / user messages contain only fixed prompts, synthetic default data, and tool parameter contracts; the complete user JSON was compared against independent results from the [defaults](../../../../../src/app/defaults.ts), [fixed fixture](../../../../../server/meta-live-fixture.ts), and [Scene adapter](../../../../../src/ai/scene-adapter.ts).
- Sound consists of the fixed default Behavior document, IDs / generations of 6 demonstration objects, material IDs, and an empty asset registry; all sound generators are procedural oscillators. No sample assets, audio content, or private scenes were supplied.
- Scene consists of the fixed 6 objects, SI parameters, synthetic material labels, and a 220 Hz procedural signal. Run is its revision 1 after explicitly adding the demonstration sphere, with 7 objects total; it is not loaded from a user-saved project.
- Sound declares only `ProposeSoundBehavior`; Scene / Run declare the existing 11 restricted functions. There are no filesystem, shell, repository, credential-reading, or arbitrary URL tools.
- No credential markers, Authorization / Bearer data, or local absolute paths were found in the three complete bodies. This assessment is also supported by complete synthetic-source equivalence, rather than relying solely on string scanning.

<!-- english-original-anchor --> <a id="實際出口與預算綁定"></a>
## Actual outbound endpoint and budget binding

- The [offline generator](../../../../../server/meta-live-payload-preview.ts) uses an injected capture-only transport; it does not read keys, user projects, or private files, or make network requests.
- The [actual CLI](../../../../../server/meta-live-validation-cli.ts) first checks the bytes / SHA-256 of the three files against the manifest; each actual body is checked again against the same bytes / hash **before** `ledger.reserve` and `remoteFetch`. A content mismatch stops that dispatch.
- CLI prompt/context is generated from the fixed fixture; catalog proof, ledger, and preview files are used only for control and verification and are not added to the prompt. The key is passed only through the server loader into the Authorization header and does not enter the body, payload hash, or this review record.
- The fixed outbound endpoint is `POST https://api.meta.ai/v1/chat/completions`, with `redirect:error`; the model is `muse-spark-1.3`, host data mode is `standard`, and `max_completion_tokens:1000`. The persistent shared ledger retains limits of US$1 total, at most 3 requests, and US$0.25 reserved in advance per request; the budget is not reset.
- The complete fake E2E 1/1 and persistent ledger 13/13 had previously passed independently. The new parent fake test for byte binding is not treated as evidence of an actual model call by this reviewer.

<!-- english-original-anchor --> <a id="邊界"></a>
## Boundaries

Network / inference requests made by this review process were **0**. No actual key files were read, and the production paid ledger was neither created nor modified. This record is a reference for resubmitting the same command for automatic review; it adds no authorization, does not replace automatic review, and does not change the record of its previous rejection. Actual live execution, billed costs, remaining credit, and complete run artifacts must still be verified separately against subsequent real results.
