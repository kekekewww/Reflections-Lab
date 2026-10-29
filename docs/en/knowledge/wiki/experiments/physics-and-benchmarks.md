<!-- english-source: {"path":"knowledge/wiki/experiments/physics-and-benchmarks.md","sha256":"9a98b3f30ebd5215db52d9a285cb32e8656ebc5a3ce04eca04e1ac792099a270","translated_at":"2026-10-27T05:41:56.131987Z","executor":"Codex","model_id":null,"links":"english-relative"} -->
---
id: RLAB-KB-0014
title: "Physics and microbenchmark evidence"
type: experiment
status: VERIFIED
created_at: 2026-10-25T19:46:51.310610+00:00
updated_at: 2026-10-26T17:52:34.881Z
sources:
  - RLAB-SRC-0040
  - RLAB-SRC-0039
  - RLAB-SRC-0028-V2
  - SB-SRC-0002
related_tasks: []
related_decisions: []
supersedes: []
tags:
  - P1
  - benchmark
  - validation
  - Rapier
---

<!-- english-notice:start -->
> English translation of [`knowledge/wiki/experiments/physics-and-benchmarks.md`](../../../../../knowledge/wiki/experiments/physics-and-benchmarks.md). Source SHA-256: `9a98b3f30ebd5215db52d9a285cb32e8656ebc5a3ce04eca04e1ac792099a270`. Executor: Codex; model ID unavailable. Translation is not new implementation or validation evidence. Canonical sources and shared task/contract/result files retain their authority. Verbatim technical examples may retain their original language.
<!-- english-notice:end -->

<!-- english-original-anchor --> <a id="驗證結果的可宣稱範圍"></a>
# Scope of claims supported by validation results

The Rapier [immutable results](../../../../../experiments/physics-spike/results/rapier-win64-20261025T192231997Z.json) retain source/lock/ESM/WASM hashes. The 6 smoke cases cover freefall, gravity0, fixed → dynamic, force/impulse, contact and a spring in an empty scene. They are not a collision-safe production grab / CCD stress test.

The Phase1 [overall validation snapshot](../../../../../benchmarks/results/phase1-validation-preserved.json) retains 30 analytical/contract tests and their version hashes; later dependency upgrades must not rewrite this history. New Phase2 results are stored separately. P95 in the Node direct/order2/EDC microbenchmarks is a percentile of batch averages, not a browser frame/audio deadline.

V0 covers contracts, V1 limited analytical cases; V2 covers only part of synthetic EDC/decay processing. V3 independent solver has not run. V4 has local microbenchmarks but still lacks browser evidence; V5 real measurements/listening tests have not run. Units, tolerances and rerun steps are in the [Benchmark Plan](../../../06-validation/BENCHMARK_PLAN.md).
