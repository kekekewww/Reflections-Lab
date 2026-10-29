<!-- english-source: {"path":"docs/01-compliance/PROVENANCE_POLICY.md","sha256":"cdb9044f44f3776909ee1160ecb26918c9c111edc41832e91b9c29daa18faddd","translated_at":"2026-10-27T03:38:17Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/01-compliance/PROVENANCE_POLICY.md`](../../01-compliance/PROVENANCE_POLICY.md). Source SHA-256: `cdb9044f44f3776909ee1160ecb26918c9c111edc41832e91b9c29daa18faddd`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="來源與競賽前後成果政策"></a>
# Provenance and Pre-Event / Event Work Policy

Effective: 2026-10-26; applies to research, documentation, dependencies, data, SDKs, AI collaboration, and future product code. Preserve existing work as instructed by the user and perform no destructive Git operations; this work does not register, accept legal terms, or submit on the user's behalf.

<!-- english-original-anchor --> <a id="分類與證據"></a>
## Classification and Evidence

At a minimum, distinguish the following categories for each item in its provenance record:

| Category | Meaning | Required evidence |
|---|---|---|
| `PREEXISTING` | User or third-party work that existed before this work began | Original location, author, creation time or verifiable commit; write UNKNOWN when evidence is unavailable, and do not invent a time. |
| `RESEARCH_PREPARATION` | Literature indexes, original summaries, architecture, environment, and licensing research | Verification time, sources, claims / limitations, author or agent. |
| `ISOLATED_SPIKE` | Isolated validation of SDKs, dependencies, geometric mathematics, and physics / audio APIs | Path, reproduction commands, dependency versions, raw stdout / results, and result date; keep separate from formal features. |
| `EVENT_IMPLEMENTATION` | Product features created after the valid competition period and rules have been confirmed | Actual start UTC, commit / diff, author, pre-event work used, and scope of changes. Do not apply this label before confirmation. |
| `THIRD_PARTY` | Software, binaries, research data, sound effects, models, textures | Official source, license / terms, version, SHA-256, modifications, and attribution. |
| `AI_ASSISTED` | Content generated or assisted by Codex / Muse Code / other models | Tool / model (when known), date, scope of work, human / programmatic verification, and source dependencies; confidential prompts need not be saved. |

AI assistance is a label that can coexist with other categories; it is not a source of rights or proof of authenticity. Write `UNKNOWN` when the model version, time, or author cannot be confirmed. The existence of a document does not mean a feature works; keep `IMPLEMENTED / PARTIAL / PLANNED / UNVERIFIED / FAILED` separate from research evidence status.

<!-- english-original-anchor --> <a id="本次工程邊界"></a>
## Engineering Scope of This Work

According to the [official rules verification](HACKATHON_RULES.md), special competition rules for pre-event product code owned by the project, reuse of existing code, and non-Meta coding agents have not yet been established. Under the user's Phase B instructions, continue research, documentation, dependency / SDK preparation, engineering environment setup, test foundations, mathematical validation, and isolated technical spikes; do not implement formal product features at scale.

The official announcement gives 10/26 as the start date, but the exact kickoff / valid development start time still has an ET / EST labeling discrepancy. Do not automatically classify all work performed on 10/26 in Taipei as event work. Record the actual UTC and label it after obtaining clear rules; do not rewrite history. If isolated work is reused in the future, disclose its actual completion time and the scope of reuse.

<!-- english-original-anchor --> <a id="原始碼與資料管理"></a>
## Source Code and Data Management

1. Preserve existing work through original commits, file hashes, actual inventories, and diffs; do not falsify authors / times or claim that files newly created in this work were past prototypes.
2. Download only into a reproducible cache or isolated `third_party`; do not put large SDKs, binaries, private weights, full paid papers, or sound libraries in Git. Record the URL, version, digest, and reconstruction method.
3. Package lockfiles, original fixtures, and required licenses / notices may be committed; for data with unclear licensing, keep only source links and pending-verification records, and do not remove the original restrictions by converting formats.
4. For each data transformation, record the original file hash, transformation program / parameters, output hash, sampling rate / units / coordinates / frequency bands; distinguish measured, derived, perceptually tuned, and synthetic values.
5. For access failures, record the HTTP / tool status and the scope obtained; mark search snippets `SEARCH_ONLY`, and do not claim to have read the complete original text. Write `NOT RUN` and the reason for validation that cannot be executed.
6. Do not save API keys, login tokens, private email, full account information, or identifiable prompts; remove secrets from raw test output as well.

<!-- english-original-anchor --> <a id="ai科學與展示誠信"></a>
## AI, Scientific, and Demonstration Integrity

Models may suggest parameters and operations; physics / acoustic values must come from a traceable solver or measurement. Link every numerical result to its inputs, model, version, seed, time, and assumptions; do not present a model's description as a measurement. Do not infer that an SDK provides individual geometric paths merely because it produces reflection output, and do not claim that a formal product is complete because a smoke test passes.

Demonstration documentation must disclose reused open source, SDKs, data, pre-event preparation, AI collaboration, and mocks / approximations; claim only tests that were executed and recorded. Human or agent review of results does not replace permission from the original author.

<!-- english-original-anchor --> <a id="正式開發與提交留痕"></a>
## Formal Development and Submission Records

After selection and the formal rules have been confirmed, create a secret-free "event-start baseline": UTC at that time, current commit (state explicitly if Git is unavailable), inventory and hashes of existing files, completed spikes / research, adopted assets, and outstanding items. Describe event-period additions using actual diffs / commits thereafter; do not change dates to erase pre-event work.

Before submission, check the [license register](LICENSE_REGISTER.md), the actual official form, and the public content. The rights warranties and broad license granted to the organizer required by HC-02 must be compatible with the licensable scope of every asset; if there is doubt, remove / replace the material or obtain explicit permission. Provenance records do not automatically obtain additional rights.

This policy can be applied directly to research and validation; personal eligibility, application / selection, and acceptance of legal terms are handled by the user. Account status was not checked in this work; do not assume the user has registered.
