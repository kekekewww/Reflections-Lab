<!-- english-source: {"path":"tests/audio-runtime/CROSS_ENGINE.md","sha256":"442e12e66bd5b2388af72f3d8d0447a6ba0eafa3c0bf6c7748ac61f785f5b847","translated_at":"2026-10-27T06:03:13.2465595Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`tests/audio-runtime/CROSS_ENGINE.md`](../../../../tests/audio-runtime/CROSS_ENGINE.md). Source SHA-256: `442e12e66bd5b2388af72f3d8d0447a6ba0eafa3c0bf6c7748ac61f785f5b847`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="跨引擎-native-音訊驗證"></a>
# Cross-Engine Native Audio Validation

This runner directly reuses the **25 original cases** from six existing native suites; it does not change the numerical oracles / thresholds or modify `src/audio`, the runtime, or App bootstrap. Each suite uses a new browser context; the test page has only one real user-activation button, with no product App, Vite client, or HMR. AudioContext / OfflineAudioContext and audio nodes are each engine's real native implementations.

The actual execution on 2026-10-27 was an overall **FAIL / exit1**, with identical source hashes before and after that execution:

| Actual engine                    | PASS | FAIL | API-blocked | Not run due to aggregate dependency |
| -------------------------------- | ---: | ---: | ----------: | ----------------------------------: |
| Firefox157.0                     |    8 |    1 |           9 |                                   7 |
| Windows cached Playwright WebKit27.2 | 0 | 0 |          25 |                                   0 |

Firefox's energy was 0.31246948243551215 versus the ideal 0.3125, still failing the original `abs(error)<1e-5`. The missing `OfflineAudioContext.suspend` blocks the timed offline oracle; it cannot be used to assert that the product's live Pause fails. That WebKit build has no AudioContext / OfflineAudioContext; this observation does not generalize to other Safari / WebKit platforms. [Original verification](../../../../artifacts/v1/audio-cross-engine-run-20261027053729781/verification.json), [execution summary](../../artifacts/v1/audio-cross-engine-run-20261027053729781/execution-summary.md).

A subsequent, separately versioned native Delay reference with 9 graphs was executed only once, obtaining complete PCM and AudioParam readback; the 0.075s graph without Convolver matched the previously fixed Float32 fractional-delay model exactly sample by sample, and the two-path graph also reproduced the original energy. This narrows the difference to that native Delay precision / interpolation compatibility; it does not prove that the product passes across engines as a whole. The new `1e-7` is an independent model diagnostic value; the original `1e-5` FAIL is retained. [Compatibility evidence and runner limits](../../artifacts/v1/audio-delay-reference-v1-run-20261027054851146/compatibility-summary.md), [v1 plan](DELAY_REFERENCE_V1.md).

Preparation does not start a browser / server:

```powershell
node tests/audio-runtime/run-cross-engine.mjs --prepare --engines firefox,webkit
node --test tests/audio-runtime/cross-engine-runner.test.mjs
```

Execute only after obtaining Root's browser slot:

```powershell
node tests/audio-runtime/run-cross-engine.mjs --run --engines firefox,webkit
```

Use `--engines chromium` to additionally run the original fixture's control group; there is no automatic install, product API, or model call. `--output <directory-within-workspace>` can specify a new evidence directory; overwriting existing results is rejected. The default output is under `artifacts/v1/audio-cross-engine-*` and includes preparation, each group's original results / operation trace, before-and-after source hashes, and verification.

The current package manifest is Playwright1.64.1, and the cache labels are Firefox revision1555 / version157.0 and WebKit revision2370 / version27.2. Cache labels and actual execution evidence are separate; prepare only checks file existence. See the table above for actual versions / APIs / DSP results. A preparation report cannot be called a cross-engine pass. When the local sandbox rewrites the default cache location, the actual command must first specify `$env:PLAYWRIGHT_BROWSERS_PATH='C:\Users\kevin\AppData\Local\ms-playwright'`; native process / loopback permissions still require authorization according to the execution environment, and engines are not installed automatically.

Classification rules:

- A suite is marked **PASS** only when the original suite returns all pinned IDs in full and every original `pass` is true.
- Each engine must cover six distinct original suites and 25 original case IDs; duplicate suites cannot make up for missing ones. Failure to obtain API probe data is a harness **ERROR**, not an unsupported capability.
- A valid render that misses the original threshold remains **FAIL**; do not change delay, compensate for latency, relax tolerance, or select the best rerun.
- Missing required APIs such as Offline suspend/resume, PeriodicWave, or WebCrypto is classified as **BLOCKED_CAPABILITY**. The original function is aggregate; if a missing API prevents the original function from returning other unrelated cases, those cases are classified as **NOT_RUN_AGGREGATE_DEPENDENCY**. Do not falsely claim that the case itself is unsupported.
- A native `NotSupportedError`, or an `EncodingError` with a decode operation trace, is classified as a capability block; preserve the original codec/stage/error. Zero HRTF energy alone does not mean unsupported.
- If AudioContext.resume is still actually suspended/pending after the deadline, classify it as an environment block. A timeout without this observation, method instrumentation / readonly assignment errors, and unknown exceptions are classified as **ERROR**.
- Missing `cancelAndHoldAtTime` does not prevent testing: the product's existing fallback must satisfy the same fade oracle.

Each suite's numerical execution deadline is 45s and launch is 20s; context / page creation, navigation, API probe, and module preparation each have 15s, and cleanup / kill fallback each have 8s. The observer only forwards calls to native methods and records at most 128 entries of state / codec metadata, preserving original promises and numerical values; it does not replace contexts or synthesize output. After an exception / timeout, close the entire context; if it cannot be closed, stop subsequent suites for that engine. BrowserServer and the source server are created and released by the runner itself; it does not take over other agents' processes or a fixed port.

Those deadlines do not cover local Vite's dynamic import / createServer; both actual executions in this run completed and retained normal-cleanup records, but the runner cannot claim that every initialization await is cancellable. If a later graph in the independent Delay reference throws, previously completed PCM is currently not checkpointed back to the host graph by graph either; all 9 graphs in this run successfully returned complete PCM, without encountering that failure path. These tool limitations do not alter the original numerical results.

Overall exit code: **0** only when all 25 cases pass for every selected engine, sources are stable, and cleanup succeeds; **1** for numerical / runner errors; **2** when some or all cases are blocked by capabilities / the environment. Partial results do not become green merely because Playwright launch succeeds.

This runner provides only limited native DSP / cursor / pause fixtures. Human listening tests, headphone personalization, device end-to-end latency, SPL, AudioWorklet underruns, and long-duration realtime capacity are outside its passing scope.
