<!-- english-source: {"path":"knowledge/wiki/research/datasets-and-rights.md","sha256":"8616288a1dc595059448bd2e00234ad694778e9398b9b7260085e14d533a2e5c","translated_at":"2026-10-27T03:44:07.128220Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0012
title: Datasets and rights boundaries
type: research
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-27T02:52:29.193Z
sources:
  - RLAB-SRC-0011
  - RLAB-SRC-0037-V2
  - RLAB-SRC-0013
  - V1-SRC-0008
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - dataset
  - license
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/research/datasets-and-rights.md`](../../../../../knowledge/wiki/research/datasets-and-rights.md). Source SHA-256: `8616288a1dc595059448bd2e00234ad694778e9398b9b7260085e14d533a2e5c`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="資料來源不等於可再散布"></a>
# A data source does not establish redistribution rights

[DATASET_CATALOG](../../../research/datasets/DATASET_CATALOG.md) evaluates 9 RIR/HRTF/impact datasets; no real audio was downloaded. A repository code license cannot be applied to its dataset, and SOFA is only a format. Rights for some external dEchorate/RealImpact files remain UNKNOWN.

The acquisition tool defaults to dry-run and requires a VERIFIED license for each file, pinned URL/size/hash, host, and a 50MB limit. The mock results of 17PASS/1junction SKIP are not ACQUIRED or V5 evidence. [Script limitations](../../../experiments/dataset-fetch-spike/README.md) include unsupported signed URLs/CDNs and local TOCTOU limitations without a sandbox guarantee.

Steam's primary Apache license does not mean official binaries contain only Apache-licensed components; IPP/CIPIC and other terms are recorded separately. The Emil MIT copy and source hash are retained. Unresolved Gist/qmd licensing is not treated as permission for unrestricted copying. Recheck the actual asset combination before each redistribution.


The new Web dependencies for the first version have an [exact license inventory r2](../../../../01-compliance/V1_DEPENDENCY_LICENSE_INVENTORY-r2.json) and [third-party notices](../../../01-compliance/V1_THIRD_PARTY_NOTICES.md), covering 199 lock entries/149 installed/50 optional omitted. License checks do not replace the user's decision on the root LICENSE. Actual Synthetic builtin PCM and users' local WAV files have a pins/rights workflow; this does not establish that external research datasets are ACQUIRED.
