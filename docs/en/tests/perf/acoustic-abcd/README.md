<!-- english-source: {"path":"tests/perf/acoustic-abcd/README.md","sha256":"b1faa28f4efb006fe5738be7246b1f387301659476836b803ac5569ad6abf9b7","translated_at":"2026-11-03T09:59:09.211Z","executor":"Codex","model_id":"gpt-6.1-sol","links":"english-relative"} -->
<!-- english-notice:start -->
> English translation of [`tests/perf/acoustic-abcd/README.md`](../../../../../tests/perf/acoustic-abcd/README.md). Source SHA-256: `b1faa28f4efb006fe5738be7246b1f387301659476836b803ac5569ad6abf9b7`. Executor: Codex; model ID gpt-6.1-sol. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="同一語料-acoustic-abcd-比較"></a>
# Same-corpus acoustic A/B/C/D comparison

This tool supports limited PERF-004/005 comparison, not formal 600 seconds, native audio, complete product acceptance or adoption. Product default remains uncached + clone; the tool changes no UI, paths, objects, caps, tolerances, SAB or isolation headers.

```powershell
node --import tsx tests/perf/acoustic-abcd/run-node.ts --out .cache/acoustic-abcd/node-fresh
node --import tsx --test --test-concurrency=1 tests/perf/acoustic-abcd/harness.test.ts
npx tsc --noEmit -p tests/perf/acoustic-abcd/tsconfig.json
node tests/browser/nonadvanced/acoustic-abcd/run.mjs --corpus .cache/acoustic-abcd/node-fresh/corpus/corpus.json --out .cache/acoustic-abcd/chrome-fresh
```

Each output directory must not exist; all writes stay in this checkout. Node CLI does not build, install or start servers; 15-minute total deadline, 5-second worker startup, original 5-second service timeout. Chrome runner starts only its owned loopback Vite dev server (port 0) and Chrome, never builds, calls npm or attaches to other servers/browsers; 10-minute total, 20-second navigation, 10-second cleanup each. Playwright `channel: chrome` chooses an available physical Chrome installation, without downloading.

`corpus/corpus.json` is an ordered manifest; each exact-graph JSON and trace has SHA-256, with the manifest additionally pinned by `metadata.json`/`summary.json`. The codec preserves negative zero, undefined and full identities. The corpus uses current `LabRuntime`, Rapier and behavior for 720 fixed ticks; it directly takes the V4 fixture's scene construction region, preserving 105 objects / 100 dynamic / 5 fixed, 8 paths, 256 geometry, 10000 segment tests and all service caps. Preserve V4's first 12-second controls: 24 body impulses, grab/throw, monitor/workspace operations, 1-second recording starting at second 10. This is a virtual prefix, not original RAF scheduling or 600 seconds. No fabricated requests or sampling; intercept every actual requests() during this period, including failures and capture batches. Audio disabled is an explicit limit; UUIDs may differ between generations, and four arms reuse only the same disk corpus.

Four configurations: A uncached clone, B cache clone, C uncached packet, D cache packet. Each arm has a new worker/cache per round, independently warms up on the first 8 corpus rows, clears cache, then replays all requests; four round orders ABCD, BCDA, CDAB, DABC. No event/capture merging, latest-only or replay backlog; await one batch at a time. Compare complete builder DTO/errors, solver output/errors, path IDs and service validation each row; any difference appears in raw and summary and causes CLI exit 1. Outcome comparisons include original rejections; rejections are not ignored as successes.

Cost unit is one requests() batch; raw also saves sourceCount to avoid dividing by source count and presenting fake per-source numbers. Separately measure builder, encode, native postMessage synchronous bracket, worker receive/queue, decode, solve, return, service validation/delivery, bounded checksum consumer and total component age; aggregate nearest-rank p50/p95/p99. Browser/Node share product service, handler, decoder and solver; the handler optional observer is enabled only for benchmarks. Timestamp envelopes stay outside strict product replies, without changing request/result fields.

receiveAndQueue includes clone serialization/queue/deserialization; queueAge is worker handler start minus main post completion (synchronous send/receive may overlap; negative values clipped to 0). It is not claimed as isolated native copy time. JSON bytes are body representation (excluding envelope), not structured-clone wire bytes. Node `process.memoryUsage` gives per-batch signed net heap/external/arrayBuffers/RSS deltas, not actual allocation or peak; worker delta runs after receive to before reply, excluding receive clone/reply serialization, with process-shared RSS. Chrome has no comparable API, so record null; JS heap or JSON reduction cannot stand in for native allocation.

`consumerChecksum` only traverses results for a bounded checksum, not an AudioEngine/UI consumer. Audio is disabled, so real emission-to-onset, PCM/hardware onset, live pose age and native consumer are NOT MEASURED; Node evidence cannot justify adoption or complete AC-03 PASS. Event identity and emission times remain in trace/corpus; negatives use existing tests to check actual admission.

All four arms use object graph structured clone. Compact packet is a deduplicated DTO, with no transferable buffers. Product transfer pool/detach/return criterion does not apply to these four arms; do not claim zero-copy. `OwnedTransferProbe` is a separate, explicitly test-only real worker_threads diagnostic: sends owned copies only, one batch, 2 MiB cap, tests detach, return, busy, crash, cancel, old generation/duplicate return and reuse; its results are not four-arm cost or product pool evidence.

Negative evidence mapping (must execute in that run; file existence is not PASS):

| Boundary | Tests |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Complete V4 four arms, raw timing, oracle substitution, SHA mismatch | `harness.test.ts` |
| clone/packet identity, timeout, cancel, crash, fallback, original caps | `tests/app/acoustic-service.test.ts`, `acoustic-compact-service.test.ts`, `acoustic-transport.test.ts` |
| stale geometry, same-revision pose/material/role/source membership, cache generation/LRU | `tests/app/acoustic-geometry-cache.test.ts`, `acoustic-component-scenarios.test.ts`, `acoustic-input-ownership.test.ts` |
| run/epoch/revision/dispose/source removal, pending dedupe, original emission time | `tests/app/acoustic-latest-pending.test.ts`; new harness negatives separately check run reset |
| Capture without latest-only, preservation each tick/event | New harness negatives, actual 720 tick corpus and captureRows |
| Real worker lifecycle and exit ownership | `tests/app/acoustic-node-worker.test.ts` |
| Owned buffer transfer diagnostic, not product candidate | New harness transfer tests |

`sourcePins` records all src, sound schema, used benchmark utilities, harness, browser fixture, V4 and lockfile, a superset of the imported source closure. Chrome verifies pins one by one before startup, rejecting changed source/corpus; do not apply updated sources to old corpus/oracle. Preserve raw, failures and early attempts without overwriting.
