<!-- english-source: {"path":"tests/browser/nonadvanced/recording-readiness/README.md","sha256":"79bc92dab43e47df691946497bbf161024a69c84fa30ac83034c66f089edfd51","translated_at":"2026-11-03T10:02:06.172Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`tests/browser/nonadvanced/recording-readiness/README.md`](../../../../../../tests/browser/nonadvanced/recording-readiness/README.md). Source SHA-256: `79bc92dab43e47df691946497bbf161024a69c84fa30ac83034c66f089edfd51`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="錄製第一個回壓-guard單次診斷"></a>
# Recording's First Backpressure Guard: Single Diagnostic

This is a bounded single-case e2e diagnostic source, not an executed result or a replacement for formal product DOM acceptance. Enable listening, simulation, and recording through public interfaces, retaining the top row's default Levels; observe for at most 10 seconds or until the first guard, then stop/seal normally. Read only existing public diagnostic getters on runtime exposed by the e2e bootstrap; do not modify runtime, sources, clock, queues, or recording state.

After Root grants a machine-resource window, execute this pinned version:

```powershell
node node_modules/vite/bin/vite.js build --mode e2e --outDir .cache/recording-readiness/e2e-dist
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5241 --strictPort --outDir .cache/recording-readiness/e2e-dist
$env:RECORDING_READINESS_ATTEMPT = 'attempt01'
node node_modules/@playwright/test/cli.js test --config tests/browser/nonadvanced/recording-readiness/diagnostic.config.ts
```

Root separately manages actual handles for build and preview in the first two commands. Config does not build or start a server itself; an existing output directory causes refusal. Use the next attempt name without deleting or overwriting historical results. Do not first run `--list` against a formal attempt, because the JSON reporter may also create its result directory.

Results are in `test-results/recording-readiness-attemptNN/`, including source/HTTP bundle hashes, Chrome version, trace, screenshots, an immutable first-guard snapshot, and normally sealed prefix identity. `FIRST_GUARD_OBSERVED` and `GUARD_NOT_REPRODUCED_WITHIN_TEN_SECONDS` are diagnostic observations, not product/throughput PASS.

Snapshot separates evaluation and storage, including their actual queue watermarks and fixed create/post/protocol reply/storage ready/append time fields. Worker creation is not ready; protocol reply is not acoustic semantic/DSP completion. Unavailable times stay null; unknown sources are not written as 0. Original 8 frames/32 MiB, low-water 2/8 MiB, 1/60 s, all tolerances, and pause protection remain unchanged. No internal retries, forced Resume, or enlarged queues.

Before execution, Root must create `.cache/recording-readiness/e2e-build-receipt.json` from the actual build: `schemaVersion:1`, `command`, `mode:"e2e"`, `exitCode:0`, `head`, `sourcePins:[{path,bytes,sha256}]` (at least the 14 src files listed by the spec), and `bundle:{indexSha256,scriptPath,scriptSha256}`. The test checks build-time sources, current sources, disk, and HTTP entry; missing or stale receipts are rejected.

Write launch-command stdout/command records first to a separate path under `.cache/recording-readiness/`; do not precreate `test-results/recording-readiness-attemptNN`, or config rejects it to protect old results. Observation uses a monotonic clock and explicitly lists the native renderer time window; out-of-window, missing observation, and other pauses are classified separately. After stopping, a nonempty captured artifact with matching continuous-tick boundaries is required before public stop is marked complete.
