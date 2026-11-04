import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { captureCorpus } from "./corpus-node.js";
import { compareVoices } from "./voice-node.js";
import { compareAssets } from "./asset-comparison.js";
import { freshDirectory, json, materialize, nodeAssetAdapter, pins, hash } from "./node-support.js";

const directory = await freshDirectory("node");
const started = performance.now();
// An outer process deadline also bounds unexpected native/async settlement failures.
const watchdog = setTimeout(() => {
  console.error(`VOICE_ASSET_DEADLINE: ${directory}`);
  process.exit(124);
}, 120_000);
let result: Record<string, unknown> = {
  status: "RUNNING",
  directory,
  command: "node --import tsx tests/browser/nonadvanced/voice-asset/run-node.ts",
};
try {
  const before = await pins();
  await json(directory, "source-pins.json", before);
  const fixtures = await materialize(directory);
  const corpus = await captureCorpus(false);
  await json(directory, "corpus.json", corpus);
  const candidateCorpus = await captureCorpus(true);
  await json(directory, "candidate-runtime-corpus.json", candidateCorpus);
  assert.deepEqual(
    candidateCorpus.recording,
    corpus.recording,
    "resource policy cannot alter recording decisions/physics",
  );
  assert.deepEqual(
    candidateCorpus.ticks,
    corpus.ticks,
    "resource policy cannot alter real runtime voice intents or native input stream",
  );
  const voices = await compareVoices(corpus);
  await json(directory, "voice-raw.json", voices);
  const seed = corpus.ticks.flatMap((t) => t.operations).find((o) => o.kind === "start");
  assert.ok(seed?.kind === "start");
  const assets = await compareAssets(fixtures, nodeAssetAdapter, seed.frame);
  await json(directory, "asset-raw.json", assets);
  const after = await pins();
  assert.deepEqual(after, before, "source drift invalidates matched comparison");
  await json(directory, "source-pins-after.json", after);
  const artifacts: Record<string, { bytes: number; sha256: string }> = {};
  for (const name of await readdir(directory)) {
    const bytes = await readFile(path.join(directory, name));
    artifacts[name] = { bytes: bytes.byteLength, sha256: hash(bytes) };
  }
  result = {
    ...result,
    status: "PASS",
    elapsedMs: performance.now() - started,
    artifacts,
    scope:
      "Node only; browser/OAC/hearing/native DSP CPU/GC/RAM NOT RUN; no product default changes",
    recordingOracle: {
      ticks: corpus.ticks.length,
      samePhysicsAndRecording: true,
      physicsEvents: corpus.ticks.reduce((n, t) => n + t.physicsEvents.length, 0),
      voiceIntents: corpus.ticks.reduce((n, t) => n + t.voiceIntents.length, 0),
    },
    voices: {
      reference: voices.reference.costs,
      candidate: voices.candidate.costs,
      overflowReference: voices.overflow.reference.snapshots,
      overflowCandidate: voices.overflow.candidate.snapshots,
      fullArrivalGraphs: voices.arrivals.candidate.peak.internalArrivalGraphsInUse,
      recommendation: voices.recommendation,
    },
    assets: {
      reference: assets.reference.costs,
      candidate: assets.candidate.costs,
      referenceLatencies: assets.reference.latencies,
      candidateLatencies: assets.candidate.latencies,
      decodeCapPeak: assets.decodeCap.peak,
      recommendation: assets.recommendation,
    },
  };
} catch (error) {
  result = {
    ...result,
    status: "FAIL",
    elapsedMs: performance.now() - started,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
  };
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  await json(directory, "summary.json", result);
  await writeFile(path.join(directory, "summary.txt"), JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(JSON.stringify(result, null, 2));
}
