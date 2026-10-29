<!-- english-source: {"path":"docs/12-architecture-review/PUBLICATION_AUDIT.md","sha256":"3601bfa7554aa8a76cb0df2ebf2fb7bbef9b7827f676da3fa825b4894ed99838","translated_at":"2026-10-29T05:34:12.518056+00:00","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/12-architecture-review/PUBLICATION_AUDIT.md`](../../12-architecture-review/PUBLICATION_AUDIT.md). Source SHA-256: `3601bfa7554aa8a76cb0df2ebf2fb7bbef9b7827f676da3fa825b4894ed99838`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="公開發佈獨立審查"></a>
# Independent Publication Audit

Review date: 2026-10-29, Taiwan. Executor: the Codex publication_audit subagent; a separate rights_inventory subagent performed a read-only third-party rights review. This audit concerns public push scope. It does not establish complete V1 acceptance, legal eligibility, human listening acceptance, or passing performance.

<!-- english-original-anchor --> <a id="範圍與結論"></a>
## Scope and conclusion

The baseline is `codex/sound-behavior-research` at `c210ca882ca8503b322c28884bf1e9f6e9fe126d` and all its ancestors. The original workspace was read-only. This work did not rewrite history, delete evidence, select a root LICENSE, commit, push, deploy, or change remote settings.

**A public push of this baseline's complete history is BLOCKED.** Committed oversized files and build/cache/archive outputs conflict with the user's explicit exclusions. Deleting files in a new commit or merging a new branch still sends the ancestors' Git objects. LFS would not remove the user's restriction against publishing these outputs.

Secret-rule and archive scan findings follow. A preliminary path list or metadata inventory cannot establish comprehensive publication safety.

| Observed metric | Result |
| --- | ---: |
| Reachable commits | 13 |
| Reachable Git objects | 8,774 |
| Unique blobs | 6,758 |
| Uncompressed bytes of unique blobs | 2,579,720,986 |
| HEAD tracked paths | 10,926 |
| HEAD paths under `artifacts/` | 8,755 |
| Sum of HEAD path bytes under `artifacts/` | 3,146,695,174 |

Unique-blob counts deduplicate identical content. Path-byte sums count identical content again at each path, so these figures do not conflict.

<!-- english-original-anchor --> <a id="秘密掃描"></a>
## Secret scan

Status: **The complete rule scan finished, with no confirmed real credential. Public push remains BLOCKED by outputs and large files.** Two complete runs produced identical receipts: 6,758 unique Git blobs; 8,571,358,844 input bytes including expanded ZIP/GZIP content; 2,891 archive members; and 2,329 payloads containing binary bytes that did not receive text semantic analysis. The error list was empty. An earlier Python attempt did not finish and was stopped; it is not validation evidence.

**Receipt preservation limits and supplemental evidence:** The original scanner JSON was transformed into a PowerShell summary and returned only through the tool; original stdout JSON was not saved. Independent verification of original raw files for these two executions therefore remains PARTIAL. The actual completed tool results have been transcribed as [run 1](../../../artifacts/architecture-review-20261029/publication-audit/full-scan-run-1-tool-receipt.json) and [run 2](../../../artifacts/architecture-review-20261029/publication-audit/full-scan-run-2-tool-receipt.json) receipts, explicitly not original raw JSON. A subsequent targeted recheck of known candidate locations read 102 blobs / 464,583,578 bytes and reproduced all 99 candidates and the 58/20/21 classifications in the [candidate classification JSON](../../../artifacts/architecture-review-20261029/publication-audit/candidate-classification.json). [Third-party review metadata](../../../artifacts/architecture-review-20261029/publication-audit/rights-review.json) likewise identifies itself as a later record of the completed read-only review. The [receipt summary and hashes](../../../artifacts/architecture-review-20261029/publication-audit/summary.json) record commands, baseline, methods, and gaps. No JSON records candidate values.

The user subsequently authorized a clean public snapshot while preserving all original local history. The original full-history push remains BLOCKED. This report has not established the new snapshot's safety or passing tests, and it has not been pushed. The publication gate should check that the actual public ref has no original ancestors, verify its exact allowlist and fresh clone, and preserve complete redacted scan JSON. Rerunning the original 8.57 GB history scan could strengthen historical evidence separately; it cannot replace checks on the new snapshot.

| Candidate rule | Hits | Review finding |
| --- | ---: | --- |
| `meta-token` | 58 | Every candidate has SHA-256 `09987ad5eaeb25c3dc9993cd8b7e2fc99c7c4dd5fa6c77b82b61e8c167957b63`, within WASM base64 in bundles, maps, or ZIP members. A separate tracked-path review checked 108 occurrences, all inside WASM strings. Repeated paths explain the difference from unique Git-blob hit counts. These are not Meta keys. |
| `url-password` | 20 | Nineteen hits are the same loopback `...:port/@...` development URL misclassified by the broad rule, with candidate hash `2897097508da069e44c6f1aea1b4b5b7f71bf01fc4fd4e51825ce7255762f629`. The remaining hit is a negative fixture rejecting URL userinfo in `experiments/dataset-fetch-spike/dataset-fetch.test.mjs`, hash `ec25b8fa54a9d7a878a86e6f38233af24d5d27d184b396136d6d7f0251d33c19`. |
| `literal-secret-assignment` | 21 | Twenty hits are redaction, rejection, or schema negative fixtures, or test-code strings under `tests/agents`, `tests/ai-runtime`, and `tests/integration`. The remaining hit at `server/meta-live-payload-preview.ts:47` is a synthetic preview configuration bearing preview/review/non-secret markers, hash `b025c80322000d1899f9cee4c33fd737108e050a8045b078c3e13ecb9d447a21`; it is not a loaded user key. |
| Private key / AWS / GitHub / OpenAI / Slack / Google / Stripe / JWT / literal Bearer | 0 | No rule matches. This does not prove that every possible form of secret is absent. |

The new read-only tool is [`scripts/validation/publication-audit.mjs`](../../../scripts/validation/publication-audit.mjs). Run it from the repository root:

```powershell
node scripts/validation/publication-audit.mjs --ref c210ca882ca8503b322c28884bf1e9f6e9fe126d
```

It checks every unique blob reachable from the selected ref and expands text content inside ZIP/GZIP containers. Results include only path, rule, blob SHA, offset, candidate length, and candidate SHA-256; secret values are never recorded. Rules cover private-key markers, common provider tokens, JWTs, password-bearing URLs, literal secret assignments, and Bearer candidates. Placeholder and code-expression hints support review; they do not automatically establish that a candidate is safe.

After the final research commit exists, add `--since c210ca882ca8503b322c28884bf1e9f6e9fe126d --ref <final-commit>` to scan only new blobs after the baseline. This supplements the complete ancestor scan; it does not replace it. `--ref HEAD --since HEAD --metadata-only` was actually run and correctly reported zero commits, objects, and blobs.

`--metadata-only` was actually run and reproduced the table and oversized files below. `--self-test` passed its split-token and GZIP synthetic-token cases; single-file ESLint and Prettier checks also passed. The tool does not scan other refs, reflogs, or untracked/ignored local secrets. It does not decode arbitrary base64 or semantically inspect media or encrypted content. Even zero rule matches cannot prove all secrets absent. Its exit code indicates scan execution errors; it does not automatically decide candidate validity or rights.

<!-- english-original-anchor --> <a id="確認的阻擋項目"></a>
## Confirmed blockers

<!-- english-original-anchor --> <a id="github-單檔大小"></a>
### GitHub individual-file limits

Three blobs reachable from the baseline exceed 100 MiB. [GitHub's official limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) state that regular Git repositories block files larger than 100 MiB.

| Path | Bytes | Git blob SHA |
| --- | ---: | --- |
| `artifacts/v1/active-rule-projection-candidate-r2-20261028/candidate/app-workload-runs/20261027214417921/large-baseline.json` | 125,089,335 | `a88f002b54f1014fef9069b4570cf6a9a0558a5d` |
| `artifacts/v1/active-rule-projection-candidate-r2-20261028/candidate/app-workload-runs/20261027214417921/large-candidate.json` | 125,089,336 | `7050cdf408483f84aaf143e210915b95e129f674` |
| `artifacts/v1/browser-performance-20261027T183039817Z/ui.trace.json.gz` | 108,682,397 | `042a2fa858bc2330f46356c9c447e315698a8c75` |

There are 31 blobs larger than 10 MiB; the rerunnable tool supplies the full list. Uncompressed total bytes do not equal Git network-transfer bytes, so this audit does not claim that the single-push transfer limit has already been exceeded.

<!-- english-original-anchor --> <a id="使用者排除的建置與封存內容"></a>
### Build and archive outputs excluded by the user

HEAD tracks 677 JS/MJS/CSS/map paths under `artifacts/`, including 233 source maps. Content includes `compiled/assets/`, several kinds of `bundles/`, `web/assets/`, payload/cache data, and test traces. These are not limited to handwritten source or small receipts.

For example, `artifacts/v1/r17-final-delivery-20261029/web/assets/index-DELE_Xh5.js` embeds WASM. The same delivery's `local-delivery.zip` is 6,544,048 bytes with 279 entries and SHA-256 `145bd22041f5255343e8c8fcfa0433c38b14cc10de566a61250326192085eb59`; it was most recently introduced by `cde1e2b0ed7c57228bfa64b01c262b6eeab3cba1`. An absence of `.wasm` paths does not establish an absence of distributed WASM.

All 108 ZIP containers were opened and their entry names listed successfully. No entries were directly named as research PDFs, audio, HRTFs, or SDK binaries. Playwright traces nevertheless contain opaque resources and source/bundles; extension lists cannot replace content review. Original evidence must remain local, and this audit deleted none of it.

<!-- english-original-anchor --> <a id="第三方來源與誤判區分"></a>
## Third-party sources and false-positive distinctions

| Category | Actual check | Finding |
| --- | --- | --- |
| Credential filenames | The ancestor path union contains only `.env.example`, with no directly tracked `.env`, private-key, or user-key filename. | No path-level finding; this does not replace the content scan. |
| node_modules | No tracked `node_modules/` paths appear in any ancestor. | Not a blocker here; third-party implementation inside bundles is a separate matter. |
| Research PDFs, paid audio, HRTFs | No `.pdf/.wav/.mp3/.ogg/.flac/.sofa` paths appear in any ancestor. | Existing entries are source, rights, and acquisition-pending metadata; do not claim that datasets were distributed. |
| Steam Audio | Only README/manifest files are tracked under `third_party/steam-audio/`; the SDK cache is untracked. | An SDK acquisition-source index is not SDK binary distribution. |
| Emil Skills | All 16 fixed source files match manifest SHA-256 values; the complete MIT text and copyright remain. | Identifiable lawful third-party copies; preserve their license text. |
| UNKNOWN remote sources | Ten records are all `remote_only:true` with `path:null`. | Full official documents or Gists are not distributed with the repository. UNKNOWN alone does not establish infringement. |
| R3F lineage, Rapier binary closure, and tooling full-text gaps | Existing documents retain unresolved conditions for bundle/binary redistribution. | Relevant when compiled deliverables are actually distributed; after excluding compiled outputs, these are not automatically blockers to publishing original source. |
| Root LICENSE | The user has not selected a project license; this work did not add or choose one. | A user-owned IP decision, not evidence of a discovered third-party infringement. |

References: [`LICENSE_REGISTER.md`](../01-compliance/LICENSE_REGISTER.md), [`V1_THIRD_PARTY_NOTICES.md`](../01-compliance/V1_THIRD_PARTY_NOTICES.md), [`PROJECT_PROVENANCE.md`](../00-project/PROJECT_PROVENANCE.md), [`DATASET_CATALOG.md`](../research/datasets/DATASET_CATALOG.md), [`SDK_LICENSE.md`](../03-sdk/SDK_LICENSE.md), and [`third_party/emil-skills.manifest.json`](../../../third_party/emil-skills.manifest.json). This audit downloaded no new assets, accepted no terms, and made no paid calls. It did not reverify personal account status or legal eligibility.

<!-- english-original-anchor --> <a id="可執行的發佈選項"></a>
## Actionable publication options

1. **Retain the local merge and defer public push.** Preserve original history and all test evidence. This respects the current prohibition on rewriting history and is the safe delivery available without a further scope decision.
2. **A separate public export is user-authorized, pending safety checks, tests, and the actual push.** Create a source snapshot with no original ancestors in a clean repository/public branch. Use a named allowlist to exclude build/cache/large outputs and containers while retaining provenance and necessary licenses. Review links to unpublished evidence and fresh-clone reproducibility, then rescan the actual final ref to be pushed. This does not rewrite or delete local original history; the user has authorized public ancestry separate from the original local research history.

Do not use a tip-only deletion, LFS, `--force`, or a push of all refs to bypass these blockers. New research-worktree changes and the actual final public ref still require a scan once they exist. This baseline audit cannot pre-approve uncreated commits.

<!-- english-original-anchor --> <a id="乾淨公開-snapshot-manifest-草案尚未執行"></a>
## Draft clean-public-snapshot manifest (not executed)

This is **a different publication scope, not the original full-history merge-and-push plan**. All original branches, commits, research, and test evidence remain local. The user explicitly authorized the clean public snapshot and its different ancestry. This audit agent has created only the metadata proposal, not a branch/export repository or a push. The exact export manifest, actual safety gate, and fresh-clone tests remain outstanding.

| Scope | Draft handling principle |
| --- | --- |
| `src/`: 136 paths; `server/`: 13 paths | Keep original source. Server keys continue to come from the environment or an explicitly selected key file; export no real key. |
| `tests/`: 415 paths; `schemas/`: 31 paths | Keep test source, synthetic fixtures, schemas, and numerical references. Exclude screenshots, traces, bundles, and video produced by test runs. Do not remove or weaken acceptance merely to make checks green. |
| `docs/`: 543 paths; `knowledge/`: 748 paths | Keep Traditional Chinese canonical documents, English mirrors, ADRs, source manifests, tasks/events/Wiki, and historical failures/limitations. Mark omitted evidence as retained locally and unpublished; do not present local path existence as publicly reproducible evidence. |
| `.agents/`: 30 paths; `.claude/`: 1 path | Keep project skills and reviewed third-party skills, with Emil's original MIT/copyright and manifest. |
| `scripts/`, `examples/`, `prompts/`, `experiments/`, `benchmarks/`, `research/`, `public/` | Keep source, lawful summaries, version/acquisition metadata, and synthetic fixtures. Exclude runtime downloads, compiled outputs, and caches, with a final path-by-path manifest. |
| `third_party/`: 5 paths | Keep Emil LICENSE/README/manifest and Steam Audio README/manifest. Export no SDK cache/binary or unlicensed full text. |
| Root configuration | Keep bilingual READMEs, AGENTS/CLAUDE, pinned package/lockfile, build/lint/CI configuration, and the empty-value `.env.example`. Do not add a root LICENSE without the user's selection. |
| `artifacts/`: 8,755 paths | Deny by default, then allow only the four named small JSON receipts below. The default exclusion set contains 677 JS/MJS/CSS/map paths, 233 of them maps; 108 ZIPs; 21 GZIPs; and all three blobs over 100 MiB. This does not mean every artifact is prohibited material. |
| Other outputs | Exclude `node_modules/**`, `**/cache/**`, `**/.cache/**`, `dist/**`, build outputs, test-results/playwright-report, research PDFs/audio/HRTFs/SDK binaries, complete chats, and real credential files. Directly tracked restricted binary paths currently number zero. |

The proposed small original receipts total 579,551 bytes. All four were within the full content-rule scan. Preserve original bytes and hashes; do not convert them into fabricated receipts claiming public validation passed.

| Named allowed path | Bytes | SHA-256 |
| --- | ---: | --- |
| `artifacts/v1/r17-final-delivery-20261029/root-verification.json` | 666 | `36fde1457338d539551b7731b3b719cd9a0b0c14a43f62af86e0e25184ba00ca` |
| `artifacts/v1/r17-full-check-2026-10-28T184930416Z-6c1c4c0d/verification.json` | 457,394 | `d2fbe54d68fc98f0a18d903cfdd8ce2b6440b610cd4533b844c5d42cac518c64` |
| `artifacts/v1/r17-browser-verification-20261029/verification.json` | 116,722 | `66b5a19408788615f43bc6024ad8c478951e5e20abdf48fd5d244167e06f0312` |
| `artifacts/v1/device-hearing-v3-frozen-20261029-r6/independent-review.json` | 4,769 | `ed798d5451eedb92626f7b1f532584025cd66c1feac0087164266e6e990917ce` |

Existing counts come from the c210 baseline; subsequent research changes add files. A final exact path/byte/hash allowlist, review of every exception, and a scan of the actual ref to be pushed remain necessary. Allowing only these four receipts would exclude 8,751 baseline `artifacts/` paths and 3,146,115,623 path bytes. No local data has been deleted.

**Known effects:** Artifact-relative links, source hashes, and historical Git SHAs in docs/Wiki/tasks still refer to the original local evidence. They do not make the complete evidence downloadable in a public clone. Add a publication note or source-availability index; do not batch-convert missing evidence to PASS. Existing `npm run check`, Wiki lint, or source-manifest validation may depend on excluded receipts/artifacts and must be run in an isolated fresh clone. If public-package validation configuration is needed, add an explicitly scoped command while preserving the complete original research validation and frozen acceptance. Root LICENSE selection and any newly included restricted material remain user decisions. Snapshot ancestry is authorized; the exact manifest and validation adaptations remain to be implemented.
