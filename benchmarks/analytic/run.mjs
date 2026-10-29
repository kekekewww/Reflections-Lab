import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { cpus, totalmem, platform, arch, release } from "node:os";
import { createHash } from "node:crypto";
import {
  specularPath,
  directPath,
  energyDecayDb,
} from "../../scripts/validation/analytic-kernels.mjs";

const fixtureBytes = readFileSync(new URL("../fixtures/analytical.json", import.meta.url));
const deck = JSON.parse(fixtureBytes);
const warmupIterations = 2000,
  iterationsPerSample = 5000,
  sampleCount = 20;
let sink = 0;
const percentile = (values, p) => values[Math.max(0, Math.ceil(values.length * p) - 1)];
const workloads = [
  {
    name: "direct-path",
    run: (i) => directPath([0, 0, 0], [3 + (i % 10) * 0.001, 4, 0], 343).distance,
  },
  {
    name: "finite-order2-path",
    run: (i) =>
      specularPath(
        [1 + (i % 10) * 0.001, 1, 0],
        [3, 2, 0],
        [deck.surfaces.wall, deck.surfaces.floor],
      ).distance,
  },
  {
    name: "edc-4096-samples",
    iterations: 100,
    run: () => energyDecayDb(Array.from({ length: 4096 }, (_, i) => Math.exp(-i / 512)))[1000],
  },
];
const results = [];
for (const workload of workloads) {
  const count = workload.iterations ?? iterationsPerSample;
  for (let i = 0; i < Math.min(warmupIterations, count); i++) sink += workload.run(i);
  const samples = [];
  for (let sample = 0; sample < sampleCount; sample++) {
    const start = performance.now();
    for (let i = 0; i < count; i++) sink += workload.run(i);
    samples.push((performance.now() - start) / count);
  }
  samples.sort((a, b) => a - b);
  results.push({
    name: workload.name,
    iterationsPerSample: count,
    samples: sampleCount,
    unit: "ms/operation",
    median: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    min: samples[0],
    max: samples.at(-1),
    measuredScope:
      "isolated Node synchronous mathematical kernel, includes allocations; no UI/Worker/audio",
  });
}
const report = {
  schemaVersion: "1.0.0",
  recordedAt: new Date().toISOString(),
  status: "MEASURED_LOCAL_ONLY",
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    osRelease: release(),
    cpuModel: cpus()[0]?.model,
    logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(),
  },
  configuration: {
    clock: "node:perf_hooks performance.now monotonic",
    warmupIterations: "min(2000, iterationsPerSample)",
    sampleCount,
    seed: "none; deterministic parameter cycle i%10",
    concurrency: 1,
  },
  hashes: {
    fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
    kernelSha256: createHash("sha256")
      .update(
        readFileSync(new URL("../../scripts/validation/analytic-kernels.mjs", import.meta.url)),
      )
      .digest("hex"),
    lockfileSha256: createHash("sha256").update(readFileSync("package-lock.json")).digest("hex"),
  },
  results,
  sink,
  limitations: [
    "Single machine, process, and run; JIT/thermal/OS load affect timings.",
    "p95 is across per-batch average costs, not individual frame tail latency.",
    "No browser/AudioWorklet/GPU/large scene/WASM acoustics measurements; performance targets remain unverified.",
  ],
};
mkdirSync("benchmarks/results", { recursive: true });
writeFileSync("benchmarks/results/analytic-local.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
