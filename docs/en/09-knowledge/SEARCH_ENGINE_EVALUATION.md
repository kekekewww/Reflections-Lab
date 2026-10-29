<!-- english-source: {"path":"docs/09-knowledge/SEARCH_ENGINE_EVALUATION.md","sha256":"62503efc900b6e4c5b3cd9d2866a2401f581460493217a017ccac373d6ab724a","translated_at":"2026-10-27T03:40:14.459085Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-knowledge/SEARCH_ENGINE_EVALUATION.md`](../../09-knowledge/SEARCH_ENGINE_EVALUATION.md). Source SHA-256: `62503efc900b6e4c5b3cd9d2866a2401f581460493217a017ccac373d6ab724a`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="wiki-搜尋引擎評估"></a>
# Wiki Search Engine Evaluation

Reviewed: 2026-10-26. The initial version uses **a Markdown index + this repository's lexical search + `rg`**. The research repository currently contains roughly a hundred Markdown documents, and no retrieval-quality data yet demonstrates a need for a vector model; this choice meets the user's requirements and leaves room to replace the search layer in the future. qmd was not installed, no models were downloaded, and MCP was not started during this work.

<!-- english-original-anchor --> <a id="qmd-官方來源與版本"></a>
## qmd Official Sources and Versions

The entire main README of the official [tobi/qmd](https://github.com/tobi/qmd) repository was read, along with the requirements, installation, search, and API instructions for a pinned release; package, LICENSE, CHANGELOG, and CI were also checked. The program is licensed under MIT and authored by Tobi Lutke. Rights for models and dependencies still require separate checks. [LICENSE](https://github.com/tobi/qmd/blob/facd35e01359e59d938bc9418e93fb9318addee3/LICENSE)

| Item              | Pinned Information                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Released version        | npm `@tobilu/qmd@2.8.3`; tag `v2.8.3` → commit `facd35e01359e59d938bc9418e93fb9318addee3`          |
| Release README hash  | `24c049f59408d3d021fbee70d4cd5dd744cdb51f5caea956b417f4dfe7e26880`                                 |
| Release package hash | `14462e2764e9d140afbeb3c924e6dd81c0448177e97785822e763d901d70f20b`                                 |
| LICENSE hash      | `24c446836e7e2cdea13a914de10c88c553e6297366061ba24013b8ce73c8f7fa`                                 |
| main              | commit `86d2365d17fc682e491c2c53d1e4a884aee8682a`; CHANGELOG includes Unreleased and must not be equated with the released `2.8.3` |
| Retrieved at          | `2026-10-25T19:38:00.2616339Z` (Taipei 2026-10-26); original byte hashes and source locations are registered in the Manifest         |

README/package/LICENSE use `SRC-QMD-README-MD-V2-8-3`, `SRC-QMD-PACKAGE-JSON-V2-8-3`, and `SRC-QMD-LICENSE-V2-8-3`; main's README/CHANGELOG/CI have separate source IDs. Retaining only a mutable `main` URL cannot support a claim of reproducible installation.

<!-- english-original-anchor --> <a id="能力成本與本機邊界"></a>
## Capabilities, Costs, and Local Boundaries

| Option                     | Applicability and Limitations                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| This repository's lexical query/`rg` | No additional models or services; directly locates English IDs, APIs, paths, and Traditional Chinese phrases. It does not provide semantic understanding or guarantee morphological, synonym, or cross-language recall |
| qmd `search`             | SQLite FTS5/BM25; queries do not require an LLM, but installation still includes native dependencies                                           |
| qmd `vsearch`            | Semantic vector search requiring embeddings and index rebuilding; cross-language and Traditional Chinese performance has not yet been validated in this repository                                     |
| qmd `query`              | Hybrid search, query expansion, and reranking; increases local model, memory, and latency requirements, and scores are not evidence credibility                        |
| qmd CLI/MCP             | The CLI can be used from a shell, and stdio/HTTP MCP is also provided; this repository has not configured or started a service                                         |

The product capabilities above are based on the [pinned README](https://github.com/tobi/qmd/blob/facd35e01359e59d938bc9418e93fb9318addee3/README.md). Its requirements are Node ≥22 or Bun ≥1.0.0, with dependencies including `better-sqlite3`, `sqlite-vec`, and `node-llama-cpp`. This project's Node 22.17.0 meets qmd's declared minimum, but this alone cannot guarantee a successful native installation. [Pinned package](https://github.com/tobi/qmd/blob/facd35e01359e59d938bc9418e93fb9318addee3/package.json)

The package provides an optional Windows x64 sqlite-vec package, and the README also includes Windows CUDA notes; the reviewed [main CI](https://github.com/tobi/qmd/blob/86d2365d17fc682e491c2c53d1e4a884aee8682a/.github/workflows/ci.yml) lists only Ubuntu/macOS. This supports “Windows-related implementation exists,” but not “it is available on this local Windows machine.” Installation, native backend, indexing, retrieval speed, and memory tests are all **NOT RUN**.

If installation is pursued later, first pin `@tobilu/qmd@2.8.3` and the lockfile/integrity in an isolated spike, and review native install scripts; this work did not execute the README's global installation, `bunx`, model downloads, or MCP configuration. Version updates require a new review; uncontrolled `latest` must not be used.

<!-- english-original-anchor --> <a id="初版與升級條件"></a>
## Initial Version and Upgrade Conditions

For queries, read the [Wiki index](../knowledge/wiki/index.md) first, then use the shared CLI to locate pages; for exact text, run directly:

```powershell
npm run wiki -- query "Steam Audio individual paths" --format json
rg -n --glob '*.md' 'individual paths|聲線' knowledge docs research
```

Search results must include file/source locations; Agents should trace original evidence and status, and must not treat hit rankings as correctness rankings. The index covers only explicitly defined text scopes and does not read `.env`, private sessions, `node_modules`, binary caches, or large third-party full texts; the shared CLI/Schema defines the file scope.

If repeated failures to find information, inadequate cross-language recall, or clearly rising search costs arise in the future, open a retrieval spike. First create a set of Traditional Chinese/English questions with expected sources, covering ADRs, SDK capabilities, tasks, invalidated decisions, and opposing claims; compare existing search, BM25, and hybrid search on recall@k/MRR, irrelevant hits, source location, cold/warm latency, indexing time, and disk/memory use. A data-volume threshold is not a performance measurement; do not claim that qmd outperforms existing tools before these results exist.

Search indexes must be rebuildable from the original Markdown. Even if qmd is adopted later, `knowledge/schema.md`, the Source Manifest, stable page IDs, and file handoffs remain the shared contract; SQLite, MCP, or any Agent configuration must not become the sole copy of the knowledge.
