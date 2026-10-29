<!-- english-source: {"path":"knowledge/wiki/concepts/memory-and-search.md","sha256":"3601e51b4fd181a26c2651d1b979067bc820d64142a420f26d42ba41336ab52f","translated_at":"2026-10-27T05:42:31.833508Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0022
title: Memory maintenance and search boundaries
type: concept
status: ACCEPTED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-25T19:46:51.310610+00:00
sources:
  - RLAB-SRC-0002
  - RLAB-SRC-0047
  - RLAB-SRC-0048
  - SRC-QMD-README-MD-V2-8-3
  - SRC-QMD-PACKAGE-JSON-V2-8-3
  - SRC-QMD-LICENSE-V2-8-3
  - SRC-QMD-MAIN-README-MD-20261026
  - SRC-QMD-MAIN-PACKAGE-JSON-20261026
  - SRC-QMD-MAIN-LICENSE-20261026
  - SRC-QMD-MAIN-CHANGELOG-MD-20261026
  - SRC-QMD-MAIN--GITHUB-WORKFLOWS-CI-YML-20261026
  - SRC-KARPATHY-LLM-WIKI
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - wiki
  - query
  - search
  - qmd
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/concepts/memory-and-search.md`](../../../../../knowledge/wiki/concepts/memory-and-search.md). Source SHA-256: `3601e51b4fd181a26c2651d1b979067bc820d64142a420f26d42ba41336ab52f`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="編譯知識與查詢"></a>
# Compiled knowledge and queries

The original source layer retains evidence. Wiki synthesizes existing research/decisions/status and cross-links them; schemas constrain the update process. Query starts with the index, then relevant pages, tracing back to sources. Valuable new findings are validated before being recorded, rather than repeating research across the entire repository each time.

The local CLI uses lexical search and limited excerpts/citations. It calls neither embeddings nor LLMs and does not treat scores as confidence. Agents must read the body and sources before answering. Natural-language questions are not guaranteed to be understood like a RAG model; Chinese/English keywords and IDs can improve retrieval.

The [qmd evaluation](../../../09-knowledge/SEARCH_ENGINE_EVALUATION.md) retains future BM25/hybrid/MCP options. This phase does not install large models/vector databases. Automated lint cannot detect every semantic contradiction or the latest online version; explicit assertions and human review complement each other.
