<!-- english-source: {"path":"docs/09-knowledge/KNOWLEDGE_REFERENCE_RESEARCH.md","sha256":"59fc2e3a7d13cd499bfa7ed4bc9e4e87e181e62b8d44aae0b219d6febb3d76f6","translated_at":"2026-10-27T03:40:14.459085Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/09-knowledge/KNOWLEDGE_REFERENCE_RESEARCH.md`](../../09-knowledge/KNOWLEDGE_REFERENCE_RESEARCH.md). Source SHA-256: `59fc2e3a7d13cd499bfa7ed4bc9e4e87e181e62b8d44aae0b219d6febb3d76f6`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="persistent-wiki-原始參考與本專案採用範圍"></a>
# Original Persistent Wiki Reference and Scope Adopted by This Project

Reviewed: 2026-10-26. Andrej Karpathy's original `llm-wiki.md` in the [LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f/ac46de1ad27f92b28ac95459c782c07f6b8c964a) (75 lines) was read in full, including its core ideas, three layers, operations, index/log, optional tools, and limitations; comments or other people's summaries were not used as substitutes. Source ID: `SRC-KARPATHY-LLM-WIKI`.

<!-- english-original-anchor --> <a id="來源與權利"></a>
## Sources and Rights

| Field          | Actual Review                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Author          | Andrej Karpathy (original author account `karpathy`)                                                                                                                                                                    |
| Original URL      | [Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)                                                                                                                                   |
| Pinned revision | `ac46de1ad27f92b28ac95459c782c07f6b8c964a`; checked against the official Raw link/revision page                                                                                                                             |
| SHA256        | `dc3efe98ae62f23dd08acad13aba2e95287beb20b6bec2f4af0423557fe37401` (original response bytes, 11985 bytes)                                                                                                      |
| Retrieved at      | `2026-10-25T19:41:51.3103005Z` (Taipei 2026-10-26)                                                                                                                                                           |
| Access          | `FULL_TEXT_REVIEWED`; the [pinned Raw URL](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md) was hashed in memory; the full text was not saved |
| License          | `UNKNOWN`: the Gist does not state a license; encouraging use by Agents is not an open-source license permitting redistribution                                                                                                                      |
| API limitation      | The GitHub Gist API returned 502 twice; the API failures were not reported as a failure to read the full text, and no API history results were fabricated                                                                                                                        |

This repository stores only source metadata, links, and an independently written design comparison; it does not vendor the Gist's full text. SHA256 pins the content but cannot prove that the original views have been experimentally validated.

<!-- english-original-anchor --> <a id="採用與加強"></a>
## Adoption and Extensions

The original advocates organizing sources into continuously revised, interconnected knowledge, constraining maintenance with a schema, and retrieving work through a content index and chronological log. This project adopts that pattern; the original's experience-based statements about efficiency/maintenance costs are not treated as measurements from this repository. [Original reference](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f/ac46de1ad27f92b28ac95459c782c07f6b8c964a)

| Design Area                       | Reflection Lab's Specific Approach                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Immutable sources              | Prioritize indexing existing `research/`, `docs/`, tests, and Git; source metadata pins versions, hashes, access levels, and licenses, without copying them to create a parallel authority |
| Synthesized Wiki                      | `knowledge/wiki/` stores short pages synthesized across sources; requirements, ADRs, code, measurements, and task status are each verified against their own authoritative sources                       |
| Schema                         | `knowledge/schema.md` defines formats, statuses, updates, conflicts, and concurrency protocols; the root entry point loads only necessary rules                                  |
| Index and log                   | The index provides navigation; each meaningful update retains an event, and the log is a rebuildable chronological index whose rewriting cannot erase original events                     |
| Ingest/query/lint            | A shared CLI assists with deduplication, validation, searching, and recording; Agents are responsible for careful reading, source assessment, and knowledge synthesis, and lint does not automatically resolve scientific contradictions              |
| Checkpoint/handoff/reconcile | Engineering requirements added by this project for multiple sessions/Agents; they must not be misrepresented as implementations or reliable locks already provided by the original Gist                             |
| Initial search                       | Markdown index + lexical search; qmd is an optional candidate, without introducing an embedding pipeline or MCP service first                            |

The original Gist is not a complete specification for transactions, races, rights, or evidence states. This repository additionally distinguishes `VERIFIED`, `ACCEPTED`, `PROPOSED`, `EXPERIMENTAL`, `UNVERIFIED`, and `DEPRECATED`, while retaining the distinction between implementation, testing, and physical validation. Conflicting sources are recorded first; the last writer does not determine truth.

<!-- english-original-anchor --> <a id="可證明與尚未證明"></a>
## What Is and Is Not Demonstrated

The shared knowledge base's completion criteria are reproducible ingest, deduplication, linking, task evidence, history, handoffs, and concurrent-failure tests; specific results must be traced to actual test reports. Creating files and passing schema lint cannot prove that summaries are correct, acoustic models are correct, or all Agents will follow the rules.

For cross-tool capabilities and local versions, see the [compatibility report](AGENT_COMPATIBILITY.md); for search selection, see the [search engine evaluation](SEARCH_ENGINE_EVALUATION.md); for source fields and sole-authority rules, see the [Schema](../knowledge/schema.md) and [Source Manifest](../../../knowledge/sources/manifest.json). This work did not read or store all private conversations, reasoning, credentials, or cloud memory, and did not convert upstream examples into authorization for formal product development.
