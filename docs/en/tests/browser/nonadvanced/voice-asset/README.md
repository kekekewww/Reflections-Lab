<!-- english-source: {"path":"tests/browser/nonadvanced/voice-asset/README.md","sha256":"7ff0626c04b81eb5331904000609d47fa779dcb2cab9259e94bce9b3efc8606b","translated_at":"2026-11-03T09:59:09.207Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`tests/browser/nonadvanced/voice-asset/README.md`](../../../../../../tests/browser/nonadvanced/voice-asset/README.md). Source SHA-256: `7ff0626c04b81eb5331904000609d47fa779dcb2cab9259e94bce9b3efc8606b`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="perf-006007-同條件比較"></a>
# PERF-006/007 comparison under matched conditions

This test harness changes no product defaults, UI, capacity or acceptance. Node FakeAudioContext proves only scheduling, control graphs, source cursor models and reference ownership; it cannot claim native DSP, hardware onset, listening, GC or process RAM PASS. Claude separately maintains original PERF task status and criteria from evidence.

<!-- english-original-anchor --> <a id="node-執行"></a>
## Node execution

Run from this worktree root; no `npm ci`, build, server or browser required:

```text
node --import tsx tests/browser/nonadvanced/voice-asset/run-node.ts
node tests/browser/nonadvanced/voice-asset/run-checks.mjs
```

Each run creates a fresh `.cache/voice-asset/node-<UTC>-<uuid>/` or `checks-.../`, without overwriting old FAIL. Node comparison has a 120-second total deadline. Preserve `summary.json`/`summary.txt`, raw voice/asset JSON, two real runtime corpora, fixture files and SHA-256, and source pins before/after; differences or source drift return nonzero. Checks record actual child exit/signal, time and stdout/stderr hashes.

`LabRuntime` uses real Rapier, the original behavior evaluator, recorder and solver; fixed run/epoch records actual engine start/update/frame/stop inputs at each fixed step. Reference and candidate each record once, comparing all physics events, behavior decisions, audio events, voice intents and recording decisions; then the same frozen corpus feeds both engines.

Formal engine capacity is unchanged: 24 rendered, 32 sources, 32 paths/voice, 256 total paths, 256 pending, 64 MiB decoded, 2 concurrent decode; other limits use DEFAULT_AUDIO_BUDGET. Original runtime behavior cap=16 and engine render cap=24 are separate layers. This corpus uses 15 continuous emitters plus real ball impact, without changing product logical admission to reach 24.

Capacity negatives separately use explicitly rebound copies of real intents/solver routes: 24 rendered plus 32 virtual waiting, duplicate start, priority hysteresis, residence, fairness, an independent piecewise pitch integral oracle, pause/resume, tail/drain/dispose, 256 internal arrivals and overflow. These copies are not extra physics or recording decisions. Native admission beyond the reference render cap may explicitly differ; candidate accepting extra virtual voices cannot count as original logical admission improvement, and rejected reference voices need not have nonexistent reference native cursors.

<!-- english-original-anchor --> <a id="素材與政策"></a>
## Assets and policies

The repository intentionally contains no external sound files. The user permits materializing `tests/app/asset-residency.test.ts::wave`'s original PCM16 algorithm as four one-second WAVs: 44.1k/48k × mono/stereo. New tests execute the original generator and materializer and compare bytes. `fixtures.json` records original generator path/hash, parameters, rate, channels, frames, file hash and rights provenance, labeled **Synthetic (project-authored test fixture), not a licensed external sample**. No external asset license is assumed and no root LICENSE selected.

Reference retains residency; candidate invokes existing host/store LRU eviction on identical pressure operations. Both load the same durable bytes and hash/revision/rights refs, with identical BlobStore memory backend and caps. Real engine active/retiring/future pending/paused ownership and recording scoped leases validate protection before release. Identical subsequent reload is warm for reference, cold for candidate; this is an observable policy difference.

Both rebuild cold hosts for cancel, decode failure and recovery so warm hits cannot skip negatives. Cancel retains native job reservation until settlement. The quota probe uses the same explicitly bounded test store, preserving original valid bytes. AudioAssetStore also starts two actual decoders simultaneously; the third request must be rejected by the original concurrency cap. highWater accounts for known references, reservations and staging; host/engine may share PCM, so do not sum them as RAM. Native scratch, GC freed and process RAM are always unknown/null.

<!-- english-original-anchor --> <a id="claude-的原生-browser-執行入口本次-codex-不執行"></a>
## Claude's native browser entry (not executed by Codex this round)

```text
node tests/browser/nonadvanced/voice-asset/run-browser.mjs --input .cache/voice-asset/node-<passing-run>
```

To use existing Chrome, add `--executable "C:/Program Files/Google/Chrome/Application/chrome.exe"`. The runner records actual version and executable hash, downloads no browser, attaches no user profile, and uses no existing server.

The runner first verifies Node PASS, all source pins and corpus/fixture artifact hashes, then starts its owned Vite ephemeral loopback port and one Playwright BrowserServer. Only the required fixture entry is materialized; the data route uses an invocation nonce and filename allowlist. Render/decode 60 seconds, total 120 seconds; finally closes context/browser/BrowserServer/Vite within bounds, preserving raw and cleanup diagnostics on failure; the watchdog terminates only its owned browser.

Native items include:

- Same Node runtime corpus, both policies run at per-quantum checkpoints in 48k native OfflineAudioContext; compare full-length stereo dry PCM, onset and each tick window. Save times before/after checkpoint quantization separately.
- Original 24 rendered capacity, actual demotion/virtual pitch update/promotion for four oscillator waveforms and the existing `AudioAssetStore` builtin-tone sample loop (native PCM hash/rate/channels/revision separately recorded). Sample offset=0.125 seconds, counted once; the phase fixture uses existing nonconstant sine PCM, separate from residency's four materialized PCM16 WAVs. Same start/update/stop; reference explicitly rejects the 25th native voice, candidate maintains its carrier. Reference has an independent fixed 20 ms output mask for expected gate transitions; candidate adds no source tap to preserve phase. Whole PCM includes the gate's first sample; no prefix is ignored.
- The same asset sequence with real native decode verifies original PCM for four rate/channel combinations, cold/warm/cancel/failure and accounting. BlobStore remains an explicit memory backend, not IDB transaction or device latency evidence.
- Browser outputs raw `.f32`; Node independently rereads every sample in a DataView loop; fixed `2e-6`, onset difference 0 samples, nonfinite 0, no truncation or empty files. Negatives include first sample, onset, NaN, empty files and length mismatch.

These are content phase/onset and lifecycle components; they do not prove complete HRTF/IR history, hardware sound, formal 600-second performance or complete V1. Without same-load native benefits and required PCM evidence, retain reference/off and current asset store defaults.
