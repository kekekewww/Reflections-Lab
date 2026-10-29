<!-- english-source: {"path":"knowledge/wiki/experiments/steam-audio.md","sha256":"59fc2414c9d794bd66fdae3388e61104e866715d879e105f634fdf86520f426d","translated_at":"2026-10-27T05:42:10.929391Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: "RLAB-KB-0013"
title: "Steam Audio feasibility and capabilities"
type: "experiment"
status: "VERIFIED"
created_at: "2026-10-25T19:46:51.310610+00:00"
updated_at: "2026-10-25T19:46:51.310610+00:00"
sources: ["RLAB-SRC-0012", "RLAB-SRC-0013", "RLAB-SRC-0014", "RLAB-SRC-0015", "RLAB-SRC-0016"]
related_tasks: ["RLAB-TASK-0002"]
related_decisions: ["ADR-005"]
supersedes: []
tags: ["P1", "Steam", "SDK", "IR", "paths"]
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/experiments/steam-audio.md`](../../../../../knowledge/wiki/experiments/steam-audio.md). Source SHA-256: `59fc2414c9d794bd66fdae3388e61104e866715d879e105f634fdf86520f426d`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="steam-audio-481原生smoke已驗"></a>
# Steam Audio 4.8.1: native smoke validated

[SDK_VALIDATION](../../../03-sdk/SDK_VALIDATION.md) records three cycles of context/scene/material/source/direct/occlusion/transmission/parametric/convolution/release on Windows x64/GCC15.2. Original results and the [final confirmation](../../../../../experiments/sdk-smoke-tests/results/native-win64-confirmation-2026-10-26.json) are retained as fixed records, with traceable sha256 and settings.

At 2m, attenuation=.5, clear/blocked occlusion=1/0 and transmission match synthetic inputs; convolution is finite and nonzero. This establishes only the minimal flow on the current platform, not acoustic accuracy, leak-free behavior, multi-source/P95 or device testing. The two stochastic reflection runs produced different output, so bit-exact results cannot be claimed.

The public simulator provides no individual specular point/path ID list; the pathing callback supplies probe segments. 4.8.1 does include a WASM static archive, but there are no emcc/browser/worklet link results. The default 400/2500/15000Hz values are not equivalent to canonical octaves; the adapter must record conversions and definitions.

The mainline remains bounded Web ISM, with native Steam as a reversible candidate; see [architecture](../architecture/runtime-and-contracts.md). Before an SDK update, verify the download / license / smoke tests, then update the Source version, tasks, ADR/risks and this synthesis page rather than merely adding a new report.
