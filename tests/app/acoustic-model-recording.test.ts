import assert from "node:assert/strict";
import test from "node:test";
import { createRenderRecordingFixture } from "../audio-runtime/render-fixture.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { ReplayAudioHost } from "../../src/app/replay-audio.js";
import { RecordingProcessor } from "../../src/app/recording-processor.js";
import { canonicalStringify, verifyRecording } from "../../src/experiments/index.js";
import {
  acousticSceneSolverVersion,
  EXTENDED_ACOUSTIC_MODEL_VERSION,
  LEGACY_ACOUSTIC_MODEL_VERSION,
} from "../../src/capabilities/acoustic-geometry.js";

test("new scene support never reinterprets or rejects original stored legacy paths during audio replay", async () => {
  const original = await createRenderRecordingFixture({
    legacyPlanarOnly: true,
    end: 4,
    grabTick: 2,
  });
  const before = canonicalStringify(original);
  assert.equal(original.configuration.backendVersion, LEGACY_ACOUSTIC_MODEL_VERSION);
  assert.equal(
    acousticSceneSolverVersion(original.configuration.sceneSnapshot),
    EXTENDED_ACOUSTIC_MODEL_VERSION,
  );
  assert.ok(
    original.frames
      .flatMap((frame) => frame.acousticFrames)
      .every((frame) => frame.backendVersion === LEGACY_ACOUSTIC_MODEL_VERSION),
  );
  await verifyRecording(original);
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), limiterEnabled: false });
  await engine.enable(0);
  engine.setMuted(false);
  const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
  try {
    await host.begin(original);
    for (const frame of original.frames) {
      context.currentTime = (frame.tick - 1) / 60;
      host.applyFrame(frame);
    }
    assert.ok(engine.getTelemetry().activeVoices >= 1);
    await host.stop();
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(canonicalStringify(original), before);
  } finally {
    engine.dispose();
  }
});

test("legacy captured model is rejected for new curved-model reevaluation instead of silently mixing backends", async () => {
  const original = await createRenderRecordingFixture({
    legacyPlanarOnly: true,
    end: 2,
    grabTick: null,
  });
  const before = canonicalStringify(original);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const config = original.configuration;
  await assert.rejects(
    processor.process(
      original.frames[0]!,
      {
        runId: "candidate.new-model",
        sceneSnapshot: config.sceneSnapshot,
        behaviorConfig: config.behaviorConfig,
        atmosphere: config.atmosphere,
        materialRegistry: config.materialRegistry,
        solverConfig: config.solverConfig,
      },
      config,
    ),
    { code: "CAPABILITY_UNSUPPORTED" },
  );
  assert.equal(canonicalStringify(original), before);
});

test("new rendering fixture declares the exact model used by every captured voice query", async () => {
  const recording = await createRenderRecordingFixture({ end: 3, grabTick: 2 });
  assert.equal(recording.configuration.backendVersion, EXTENDED_ACOUSTIC_MODEL_VERSION);
  assert.ok(
    recording.frames
      .flatMap((frame) => frame.acousticFrames)
      .every((frame) => frame.backendVersion === recording.configuration.backendVersion),
  );
});

test("extended captured model cannot be reprocessed through a newly planar-only scene under the old header", async () => {
  const original = await createRenderRecordingFixture({ end: 2, grabTick: null });
  const config = original.configuration;
  const planar = structuredClone(config.sceneSnapshot);
  for (const object of planar.objects) if (object.shape !== "box") object.acousticRole = "none";
  assert.equal(acousticSceneSolverVersion(planar), LEGACY_ACOUSTIC_MODEL_VERSION);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  await assert.rejects(
    processor.process(
      original.frames[0]!,
      {
        runId: "candidate.planar",
        sceneSnapshot: planar,
        behaviorConfig: config.behaviorConfig,
        atmosphere: config.atmosphere,
        materialRegistry: config.materialRegistry,
        solverConfig: config.solverConfig,
      },
      config,
    ),
    { code: "CAPABILITY_UNSUPPORTED" },
  );
});
