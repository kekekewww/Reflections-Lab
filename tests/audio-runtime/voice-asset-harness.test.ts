import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { wave } from "../browser/nonadvanced/voice-asset/wave-fixture.js";
import { BUDGET, PCM_TOLERANCE } from "../browser/nonadvanced/voice-asset/contracts.js";
import { captureCorpus } from "../browser/nonadvanced/voice-asset/corpus-node.js";
import { compareVoices, replayCorpus } from "../browser/nonadvanced/voice-asset/voice-node.js";
import { hash, ROOT, nodeAssetAdapter } from "../browser/nonadvanced/voice-asset/node-support.js";
import { compareAssets } from "../browser/nonadvanced/voice-asset/asset-comparison.js";
import type { WaveFixture } from "../browser/nonadvanced/voice-asset/contracts.js";
import path from "node:path";
import { ControlContext } from "../browser/nonadvanced/voice-asset/voice-node.js";
import { renderPhase } from "../browser/nonadvanced/voice-asset/phase-fixture.js";

test("file materializer exactly preserves the existing project-authored WAV generator", async () => {
  const source = await readFile(path.join(ROOT, "tests/app/asset-residency.test.ts"), "utf8");
  const original = source.slice(source.indexOf("function wave("), source.indexOf("const hash ="));
  assert.ok(original.startsWith("function wave("));
  const compiled = ts.transpileModule(original, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const baseline = vm.runInNewContext(`${compiled}; wave;`) as typeof wave;
  for (const rate of [44100, 48000])
    for (const channels of [1, 2]) {
      const actual = wave(1200, rate, rate, channels),
        expected = baseline(1200, rate, rate, channels);
      assert.equal(hash(new Uint8Array(actual)), hash(new Uint8Array(expected)));
      assert.equal(actual.byteLength, 44 + rate * channels * 2);
    }
});

test("browser phase fixture exercises all 24 render slots and actual demotion/promotion under a fake checkpoint clock", async () => {
  // Control-only validation of the delivered browser fixture; emits zero PCM and
  // cannot be used as native phase evidence.
  class CheckpointContext extends ControlContext {
    private checkpoints: { time: number; release: () => void }[] = [];
    private complete: ((buffer: AudioBuffer) => void) | null = null;
    override suspend(time?: number): Promise<void> {
      if (time === undefined) return super.suspend();
      return new Promise((resolve) => this.checkpoints.push({ time, release: resolve }));
    }
    override async startRendering(): Promise<AudioBuffer> {
      const result = new Promise<AudioBuffer>((resolve) => {
        this.complete = resolve;
      });
      this.next();
      return result;
    }
    private next() {
      setImmediate(() => {
        const point = this.checkpoints.shift();
        if (point) {
          this.currentTime = point.time;
          this.state = "suspended";
          point.release();
        } else this.complete?.(this.createBuffer(1, 96000, 48000) as unknown as AudioBuffer);
      });
    }
    override async resume() {
      this.state = "running";
      if (this.complete) this.next();
    }
  }
  const previous = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = CheckpointContext as unknown as typeof OfflineAudioContext;
  try {
    // Reuse a solver frame recorded by the previous real-runtime evidence if
    // available is deliberately avoided: this test has an explicit no-path frame.
    const frame = {
      schemaVersion: "1.0.0",
      requestId: "control",
      sceneRevision: 1,
      geometryRevision: 1,
      poseTick: 0,
      backendId: "control-only",
      backendVersion: "1",
      sourceId: "control",
      listenerId: "listener",
      bandCentersHz: [1000],
      gainQuantity: "pressureRatio",
      capabilities: [],
      modelClass: "numericalApproximation",
      directDelayS: 0,
      paths: [],
      pathAvailability: "available",
      impulseResponseArtifactId: null,
      stale: false,
      limitations: ["NO_PCM_OR_GEOMETRY_CLAIM"],
    } as const;
    const seed = {
      instanceId: "seed",
      sourceId: "control",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
      gainLinear: 0.1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    } as const;
    for (const content of ["sine", "sample-loop"] as const) {
      const a = await renderPhase(
        structuredClone(seed),
        structuredClone(frame) as unknown as import("../../src/audio/types.js").AcousticFrame,
        false,
        content,
      );
      const b = await renderPhase(
        structuredClone(seed),
        structuredClone(frame) as unknown as import("../../src/audio/types.js").AcousticFrame,
        true,
        content,
      );
      assert.equal(a.admissions[0]!.accepted, false);
      assert.equal(b.admissions[0]!.accepted, true);
      assert.equal(b.observations.find((o) => o.intendedTime === 1.3)?.targetProvenance, "virtual");
      assert.equal(b.observations.at(-1)?.targetProvenance, "native");
      assert.equal(Math.max(...b.observations.map((o) => o.nativeSources)), 25);
      assert.deepEqual(a.samplePin, b.samplePin);
    }
  } finally {
    globalThis.OfflineAudioContext = previous;
  }
});

test(
  "same real runtime corpus meets full-capacity voice and residency oracles without input mutation",
  { timeout: 90000 },
  async () => {
    const corpus = await captureCorpus();
    const voices = await compareVoices(corpus);
    assert.equal(voices.reference.costs.peakNativeSlots, voices.candidate.costs.peakNativeSlots);
    assert.equal(voices.arrivals.candidate.peak.internalArrivalGraphsInUse, 256);
    assert.equal(voices.overflow.candidate.admissions.filter((a) => a.accepted).length, 56);
    const badCapacity = structuredClone(corpus);
    Object.assign(badCapacity.budget, { maxVoices: 23 });
    await assert.rejects(replayCorpus(badCapacity, true), /capacity/);
    const fixtures: WaveFixture[] = [];
    for (const rate of [44100, 48000])
      for (const channels of [1, 2]) {
        const bytes = wave(1000 + fixtures.length * 100, rate, rate, channels);
        fixtures.push({
          assetId: `fixture.${rate}.${channels}`,
          name: `${rate}-${channels}.wav`,
          rate,
          channels,
          frames: rate,
          sample: 1000 + fixtures.length * 100,
          bytes,
          sha256: hash(new Uint8Array(bytes)),
        });
      }
    const seed = corpus.ticks.flatMap((t) => t.operations).find((o) => o.kind === "start");
    assert.ok(seed?.kind === "start");
    const assets = await compareAssets(fixtures, nodeAssetAdapter, seed.frame);
    assert.equal(assets.decodeCap.peak, BUDGET.maxConcurrentDecodes);
    assert.equal(assets.candidate.costs.pressureResidentBytes, 0);
    assert.ok(assets.reference.costs.pressureResidentBytes > 0);
    assert.ok(assets.candidate.costs.decodeCalls > assets.reference.costs.decodeCalls);
    assert.equal(PCM_TOLERANCE, 2e-6);
  },
);
