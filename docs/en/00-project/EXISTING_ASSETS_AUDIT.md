<!-- english-source: {"path":"docs/00-project/EXISTING_ASSETS_AUDIT.md","sha256":"540245dcaf2a04bca9e0393064ff384708a99f7ad362b1bde4d006054039f8c9","translated_at":"2026-10-27T03:37:55.6385493Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/00-project/EXISTING_ASSETS_AUDIT.md`](../../00-project/EXISTING_ASSETS_AUDIT.md). Source SHA-256: `540245dcaf2a04bca9e0393064ff384708a99f7ad362b1bde4d006054039f8c9`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="既有資產與功能稽核"></a>
# Existing Assets and Features Audit

Audit date: 2026-10-26. Each item is classified against the initially empty directory; `PLANNED` denotes a user requirement, not code that already existed.

| Asset / feature | Status | Evidence and limitations |
| --- | --- | --- |
| Reflections / Echo Canvas / Echo-Canva source code | UNVERIFIED | No files were present in this working directory; other private directories were not searched |
| Hybrid 3D Acoustic Engine / SceneSpec / AcousticFrame | PLANNED | This round contains only data contract design and schemas |
| First-order / second-order specular reflections | PLANNED | Isolated analytical tests do not constitute a product solver |
| Unified time reference for Direct / Reflections | PLANNED | Architecture contract; no real-time audio system yet |
| Stable Path ID / birth-death crossfade | PLANNED | Design specifications and limited mathematical validation; no DSP listening tests yet |
| Occlusion / Transmission | PLANNED | Model / SDK spike evidence is listed separately and does not constitute an interactive application |
| Multiband materials / Air Absorption | PLANNED | Definitions and synthetic validation values; no claim of a measured material library |
| HRTF / Delay / Filter / Reverb | PLANNED | Official API research; browser listening / device tests have not been run |
| Worker Acoustic Computation | PLANNED | Architecture and performance budgets; no thread integration yet |
| FPS / Grab / Throw / Build Mode | PLANNED | Official API and isolated physics spike; no UI yet |
| Regression / Benchmark foundation | Absent initially | Actual results after additions in this round are in docs/06-validation |

Status set: `IMPLEMENTED / PARTIAL / PLANNED / UNVERIFIED / FAILED`. No earlier prototype was found, so no formal feature can reasonably be claimed as implemented; isolated spikes from this round are tracked separately as `Technical Spike Verified`.
