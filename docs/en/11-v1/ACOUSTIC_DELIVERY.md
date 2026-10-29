<!-- english-source: {"path":"docs/11-v1/ACOUSTIC_DELIVERY.md","sha256":"69f0675322d676e25977edd5654370aa55fce47b46b67b0d89825acc9ae55324","translated_at":"2026-10-27T03:41:10Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`docs/11-v1/ACOUSTIC_DELIVERY.md`](../../11-v1/ACOUSTIC_DELIVERY.md). Source SHA-256: `69f0675322d676e25977edd5654370aa55fce47b46b67b0d89825acc9ae55324`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="聲學-worker-傳輸與取消驗證"></a>
# Acoustic Worker Transport and Cancellation Validation

This page records only `AcousticService` and the actual acoustic Worker; it does not replace overall product performance acceptance. The formal performance thresholds remain defined by [PERFORMANCE_BUDGET](../06-validation/PERFORMANCE_BUDGET.md).

<!-- english-original-anchor --> <a id="實際行為"></a>
## Actual Behavior

- Only one batch may run at a time, with no hidden queue; requests are rejected while busy, and backpressure is counted.
- Cancellation, timeout, and transport failure terminate the old Worker. The next job creates a new Worker; replies from an old port or batch cannot be applied to the new job.
- Every request/source/listener, scene/geometry revision, pose tick, and complete bounded result shape is validated; partially successful or malformed batches are not published.
- Batch limits are 32 sources, 256 surfaces per source, 256 paths across the batch, and 2 MiB of JSON. Preflight also rejects sparse arrays and extra array properties, preventing content ignored by JSON from bypassing the transport boundary.
- `dispose()` may be called repeatedly; all subsequent solves are rejected. An explicit synchronous mode without a Worker remains available, and telemetry does not label it as a Worker.
- `getTelemetry()` provides a fixed history of 128 successful timings, pending age, failure/cancellation/timeout/backpressure/late-reply counts, payload bytes, and Worker restarts.

`lastRoundTripMs` includes the round trip after the batch is dispatched; the profile's `roundTripIncludingDispatchMs` also includes input preflight and copying. `lastWorkerComputeMs` is a measured difference on the same clock inside the Worker. `lastDeliveryHandlerMs` measures only this service's result validation and resolution, excluding the runtime's audio/UI consumers. The runtime remains responsible for determining staleness against the actual world's current pose/frame age; a matching pinned request does not mean the current world has not advanced.

<!-- english-original-anchor --> <a id="重現與證據"></a>
## Reproduction and Evidence

```powershell
node tests/browser/run-acoustic-delivery.mjs
```

This command first creates a production bundle of the fixture, then starts its own localhost:5187 preview process, sequentially runs strict TypeScript, Node transport/parsing regressions, and real Chrome Worker tests, and then directly stops the process it owns. It avoids the Windows wait for Playwright shell webServer teardown; it does not use other development services or call models.

Production-bundle rerun at 2026-10-27T01:39:38Z: strict PASS, Node **46/46 PASS** (17 service/29 solver), real Chrome **4/4 PASS**, with matching source hashes before and after. In the fixed profile, dispatch-inclusive roundtrip p95 was **8.1 ms**, Worker compute p95 **3.9 ms**, and this service's handler p95 **0.8 ms**; cold production Worker startup and rebuilding after cancellation/timeout and failure all passed. Complete raw samples still retain slower spikes; a passing p95 must not be described as having no deadline misses.

- [Source and command manifest](../../../tests/acoustics-runtime/delivery-validation-manifest-20261027.json): source hashes before and after, actual exits, and raw stdout/stderr hashes.
- [Chrome profile](../../../tests/acoustics-runtime/delivery-browser-20261027.json): machine/browser/viewport, 120 measured jobs, 10 warmup, 20 Hz, 8 sources/32 finite planes/first-order reflections, and complete samples.
- [Raw output](../../../tests/acoustics-runtime/delivery-evidence-20261027): Node fault injection is Mock; the Chrome production Worker and delayed transport fixture are separate.
- [First-round handler threshold violation](../../../tests/acoustics-runtime/delivery-failure-20261027): p95 1.1 ms exceeded the fixed threshold; the output from that run is retained. The duplicate allocation-heavy generic tree traversal on the reply side was subsequently removed, retaining complete checks of the known shape and size.
- [Failures under concurrent load on the same machine](../../../tests/acoustics-runtime/delivery-contention-20261027): these include cold-start timeout and compute/roundtrip threshold violations. Errors are retained; selecting only the first faster result cannot establish a stable pass.
- [Controlled development-server failure](../../../tests/acoustics-runtime/delivery-quiet-dev-20261027): cold Worker timeout, roundtrip p95 21 ms, and handler p95 1.4 ms. The production bundle avoids runtime TypeScript transform/HMR; this is separate release-environment evidence and does not erase the development failure.

The manifest and final raw output determine the final result. This slice does not claim passes for the overall runtime's stale-state display, delivery to all consumers, the 10-minute UI soak, AudioWorklet deadlines, hardware listening tests, or order2.
