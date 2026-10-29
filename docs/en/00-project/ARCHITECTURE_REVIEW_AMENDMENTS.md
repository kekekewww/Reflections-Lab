<!-- english-source: {"path":"docs/00-project/ARCHITECTURE_REVIEW_AMENDMENTS.md","sha256":"d6de285d402f73ece28bab828162767ff69509ebf23f3408062dc17646286fd6","translated_at":"2026-10-29T05:39:30Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/ARCHITECTURE_REVIEW_AMENDMENTS.md`](../../00-project/ARCHITECTURE_REVIEW_AMENDMENTS.md). Source SHA-256: `d6de285d402f73ece28bab828162767ff69509ebf23f3408062dc17646286fd6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="架構研究與公開快照範圍補充"></a>
# Architecture Research and Public Snapshot Scope Amendments

On 2026-10-29, the user explicitly replied: “Authorize a separate clean public snapshot; preserve all local history.” This is subsequent authorization for the publication method in the [original request](ARCHITECTURE_REVIEW_REQUEST.md), not permission to rewrite, delete, or upload the excluded original history.

The original complete history contains artifacts prohibited from publication and three blobs larger than 100 MiB; direct full-history push remains BLOCKED. Create a separate public branch with no original ancestors, publishing only reviewed source code, documentation, and genuine small receipts / reference fixtures. Preserve all local branches, commits, and evidence.

The public snapshot still requires a manifest, secret / rights / size audits, appropriate validation, and remote / CI verification. Do not fabricate missing evidence, relax frozen tests, force push, overwrite new remote history, or independently accept terms. Where a source cannot be public, explicitly state local archive availability; this does not waive original complete internal validation.
