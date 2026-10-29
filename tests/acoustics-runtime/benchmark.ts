import { performance } from "node:perf_hooks";
import { cpus, platform, arch } from "node:os";
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createBoxSurfaces, DEFAULT_BANDS_HZ, solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticMaterial, AcousticRequest } from "../../src/acoustics/types.js";

const material: AcousticMaterial = {
  schemaVersion: "1.0.0",
  id: "synthetic-benchmark",
  revision: 0,
  label: "Synthetic room benchmark",
  dataClass: "Synthetic",
  sourceUrls: [],
  conditions: "Synthetic bounded room; no calibrated response",
  phaseModel: "zeroPhaseMagnitudeOnly",
  bands: DEFAULT_BANDS_HZ.map((centerHz) => ({
    centerHz,
    absorptionEnergy: 0.2,
    reflectionEnergy: 0.8,
    transmissionEnergy: 0,
    scatteringFraction: 0.1,
  })),
};
const boxes = [
  { id: "floor", positionM: [0, -0.1, 0], dimensionsM: [10, 0.2, 8] },
  { id: "ceiling", positionM: [0, 3.1, 0], dimensionsM: [10, 0.2, 8] },
  { id: "west", positionM: [-5.1, 1.5, 0], dimensionsM: [0.2, 3, 8] },
  { id: "east", positionM: [5.1, 1.5, 0], dimensionsM: [0.2, 3, 8] },
  { id: "north", positionM: [0, 1.5, -4.1], dimensionsM: [10, 3, 0.2] },
  { id: "south", positionM: [0, 1.5, 4.1], dimensionsM: [10, 3, 0.2] },
] as const;
const request: AcousticRequest = {
  requestId: "bounded-room-benchmark",
  sceneRevision: 0,
  geometryRevision: 0,
  poseTick: 0,
  topologyId: "benchmark-room",
  source: { id: "source", positionM: [-1, 1.2, 0] },
  listener: { id: "listener", positionM: [2, 1.7, 1] },
  surfaces: boxes.flatMap((box) => createBoxSurfaces({ ...box, materialId: material.id })),
  materials: [material],
  atmosphere: { medium: "air", speedOfSoundMps: 343 },
  budget: { maxSurfaces: 64, maxPaths: 16, maxSegmentTests: 16384 },
};
let sink = 0;
for (let i = 0; i < 30; i++) sink += solveAcoustics(request).frame.paths.length;
const samples: number[] = [];
const iterationsPerSample = 10;
for (let sample = 0; sample < 20; sample++) {
  const start = performance.now();
  for (let i = 0; i < iterationsPerSample; i++) sink += solveAcoustics(request).frame.paths.length;
  samples.push((performance.now() - start) / iterationsPerSample);
}
samples.sort((a, b) => a - b);
const solution = solveAcoustics(request);
const hashes = Object.fromEntries(
  ["types.ts", "geometry.ts", "solver.ts", "index.ts"].map((name) => [
    `src/acoustics/${name}`,
    createHash("sha256")
      .update(readFileSync(`src/acoustics/${name}`))
      .digest("hex"),
  ]),
);
const report = {
  schemaVersion: "1.0.0",
  recordedAt: new Date().toISOString(),
  status: "MEASURED_LOCAL_ONLY",
  command: "node --import tsx tests/acoustics-runtime/benchmark.ts",
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
  },
  configuration: {
    warmup: 30,
    sampleCount: 20,
    iterationsPerSample,
    surfaces: request.surfaces.length,
    bands: 7,
    concurrency: 1,
    workload:
      "36 exact static box faces; first-order bounded room solve, includes input validation and allocations",
  },
  millisecondsPerSolve: { min: samples[0], median: samples[9], p95: samples[18], max: samples[19] },
  paths: solution.frame.paths.length,
  segmentTests: solution.diagnostics.segmentTests,
  budgetExceeded: solution.diagnostics.budgetExceeded,
  sourceHashes: hashes,
  sink,
  limitations: [
    "Single local Node process under concurrent development load; not browser/worker/audio callback timing.",
    "p95 across batch average times, not individual frame tail latency.",
    "No general scene capacity, real-room accuracy or device latency claim.",
  ],
};
writeFileSync(
  "tests/acoustics-runtime/benchmark-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
