import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AudioBufferPreset } from "../../src/audio/buffer-preset.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext } from "./fake-context.js";

// Native clock/control-graph oracle only. This fixture emits no native PCM.
// The independent sample-step oracle below covers the retained k-rate ramp;
// it does not claim access to a browser's internal PCM read pointer.
const sampleRate = 48000;
const quantumFrames = 160;
const suspendTime = 20480 / sampleRate;
const rampStart = 0.2;
const rampEnd = 0.6;
const presets: readonly { name: AudioBufferPreset; lookahead: number }[] = [
  { name: "interactive", lookahead: 0.06 },
  { name: "balanced", lookahead: 0.08 },
  { name: "playback", lookahead: 0.12 },
];

class CarrierClockContext extends FakeAudioContext {
  readonly renderQuantumSize = quantumFrames;
}

function frame(sourceId: string): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: `carrier-clock-${sourceId}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "carrier-clock-control-oracle",
    backendVersion: "1",
    sourceId,
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0,
    paths: [
      {
        id: `${sourceId}-direct`,
        sourceId,
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 1,
        absoluteDelayS: 0,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [1],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_CLOCK_ONLY_NOT_NATIVE_PCM_POINTER_OR_HEARING"],
  };
}

function voice(id: string, overrides: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId: id,
    sourceId: id,
    generator: {
      kind: "sample",
      asset: { assetId: "unit-pcm", revision: 1, sha256: "a".repeat(64) },
      loop: true,
      startOffsetSeconds: 0,
    },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: true,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    priority: 1,
    ...overrides,
  };
}

function close(actual: number, expected: number, reason: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${reason}: ${actual} != ${expected}`);
}

function rampedSamplePosition(onset: number, time: number): number {
  const first = Math.round(onset * sampleRate);
  const last = Math.round(time * sampleRate);
  let position = 0;
  for (let sample = first; sample < last; sample++) {
    const blockTime = (Math.floor(sample / quantumFrames) * quantumFrames) / sampleRate;
    const progress = Math.fround((blockTime - rampStart) * Math.fround(1 / (rampEnd - rampStart)));
    const rate =
      blockTime < rampStart ? 1 : blockTime >= rampEnd ? 2 : Math.fround(1 + Math.fround(progress));
    position += rate / sampleRate;
  }
  return position;
}

for (const preset of presets) {
  test(`${preset.name} carrier native observation uses the actual clock across fade suspend resume`, async () => {
    const context = new CarrierClockContext();
    const ended: string[] = [];
    const engine = new AudioEngine({
      context: context.asContext(),
      bufferPreset: preset.name,
      budget: { maxVoices: 1 },
      virtualization: {
        maxNativeVoices: 1,
        maxNativeGraphs: 1,
        maxNativeCarriers: 6,
        maxVirtualVoices: 4,
        minResidenceSeconds: 0.2,
        priorityHysteresis: 0.1,
        fairnessSeconds: 10,
      },
      onVoiceEnded: (id) => ended.push(id),
    });
    const suspend = context.suspend.bind(context);
    try {
      await engine.enable(0);
      engine.registerBuffer(
        "unit-pcm",
        context.createBuffer(1, sampleRate, sampleRate) as unknown as AudioBuffer,
        {
          name: "Original carrier clock unit PCM",
          origin: "generated",
          license: "PROJECT_GENERATED_TEST_FIXTURE",
          sha256: "a".repeat(64),
        },
      );
      assert.equal(engine.getTelemetry().schedulingLookaheadSeconds, preset.lookahead);
      assert.equal(engine.playVoice(voice("signal"), frame("signal")).accepted, true);
      assert.equal(
        engine.playVoice(voice("future", { emissionTimeSeconds: 2 }), frame("future")).accepted,
        true,
      );
      // All presets exhaust this native shot at .41, inside the fade advance.
      assert.equal(
        engine.playVoice(
          voice("shot", {
            continuous: false,
            generator: {
              kind: "sample",
              asset: { assetId: "unit-pcm", revision: 1, sha256: "a".repeat(64) },
              loop: false,
              startOffsetSeconds: 0.59 + preset.lookahead,
            },
          }),
          frame("shot"),
        ).accepted,
        true,
      );
      const originalSources = [...context.sources()];
      const signal = originalSources[0]!;
      const future = originalSources[1]!;
      const shot = originalSources[2]!;
      close(signal.starts[0]!.when, preset.lookahead, "initial onset-only lookahead");
      close(future.starts[0]!.when, 2 + preset.lookahead, "original future deadline");
      context.currentTime = rampStart;
      engine.updateVoice("signal", { pitchSemitones: 12, smoothingSeconds: 0.4 });
      const rateAutomation = signal.playbackRate.automation.map((entry) => ({ ...entry }));
      context.currentTime = 0.4;
      context.suspend = async () => {
        context.currentTime = suspendTime;
        shot.finish();
        shot.finish();
        await suspend();
      };
      await engine.pause(0.4);
      assert.equal(context.state, "suspended");
      const before = engine.getVoiceCursorState("signal", 0.4)!;
      close(
        before.cursor.playheadSeconds,
        rampedSamplePosition(preset.lookahead, suspendTime),
        "paused native ramp position",
      );
      close(
        before.cursor.elapsedSinceEmissionSeconds,
        suspendTime - preset.lookahead,
        "paused actual native elapsed",
      );
      const logicalAtCutoff = before.logicalCursor;
      assert.equal(engine.getVoiceCursorState("shot", 0.4), null);
      assert.deepEqual(ended, ["shot"], "native exhaustion does not replay a logical completion");

      await engine.resume(0.4);
      const after = engine.getVoiceCursorState("signal", 0.4)!;
      // Compare semantics before the new audit field so RED catches the extra
      // lookahead in the old native query, not merely a missing property.
      close(
        after.cursor.playheadSeconds,
        before.cursor.playheadSeconds,
        "resume cannot count onset lookahead as played PCM",
      );
      close(
        after.cursor.elapsedSinceEmissionSeconds,
        before.cursor.elapsedSinceEmissionSeconds,
        "resume cannot advance native elapsed",
      );
      assert.deepEqual(after.logicalCursor, logicalAtCutoff);
      close(before.nativeAudioTimeSeconds, suspendTime, "paused native observation timestamp");
      close(after.nativeAudioTimeSeconds, suspendTime, "resumed native observation timestamp");
      assert.deepEqual(
        signal.playbackRate.automation,
        rateAutomation,
        "retained native ramp is neither shifted nor restarted",
      );
      assert.deepEqual(context.sources(), originalSources);
      assert.equal(signal.starts.length, 1);
      assert.deepEqual(signal.stops, []);
      assert.equal(future.starts.length, 1);
      close(
        future.starts[0]!.when,
        2 + preset.lookahead,
        "resume cannot shift a retained future deadline",
      );
      assert.deepEqual(future.stops, []);

      context.currentTime = 0.5;
      const simulationNow = 0.4 + context.currentTime - suspendTime;
      const duringRemainder = engine.getVoiceCursorState("signal", simulationNow)!;
      close(
        duringRemainder.cursor.playheadSeconds,
        rampedSamplePosition(preset.lookahead, 0.5),
        "remaining ramp keeps its original native audio times",
      );
      close(duringRemainder.nativeAudioTimeSeconds, 0.5, "native rate observation timestamp");
      const futureSimulationQuery = engine.getVoiceCursorState("signal", simulationNow + 1)!;
      close(
        futureSimulationQuery.cursor.playheadSeconds,
        duringRemainder.cursor.playheadSeconds,
        "simulation query time cannot fabricate native playback",
      );
      assert.notDeepEqual(
        futureSimulationQuery.logicalCursor,
        duringRemainder.logicalCursor,
        "logical intent still follows its requested simulation time",
      );

      context.currentTime = 2 + preset.lookahead + 0.1;
      const futureSimulationNow = 0.4 + context.currentTime - suspendTime;
      const futureState = engine.getVoiceCursorState("future", futureSimulationNow)!;
      close(
        futureState.cursor.playheadSeconds,
        0.1,
        "future native source advances only after its unchanged onset",
      );
      close(
        futureState.cursor.elapsedSinceEmissionSeconds,
        0.1,
        "future native elapsed ignores fresh epoch lookahead",
      );
      close(
        futureState.nativeAudioTimeSeconds,
        context.currentTime,
        "future native observation timestamp",
      );
      assert.equal(shot.starts.length, 1);
      assert.equal(shot.onended, null);
      shot.finish();
      assert.deepEqual(ended, ["shot"]);
      assert.deepEqual(context.sources(), originalSources);
    } finally {
      context.suspend = suspend;
      engine.dispose();
    }
  });
}
