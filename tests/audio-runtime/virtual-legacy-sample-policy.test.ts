import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext, FakeGainNode } from "./fake-context.js";
const frame: AcousticFrame = {
  schemaVersion: "1.0.0",
  requestId: "legacy",
  sceneRevision: 1,
  geometryRevision: 1,
  poseTick: 1,
  backendId: "legacy-finite-control",
  backendVersion: "1",
  sourceId: "shot",
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
  limitations: ["CONTROL_ONLY_NOT_NATIVE_PCM"],
};
async function trace(candidate: boolean, pitch: number, authored?: number) {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "renderQuantumSize", { value: 128 });
  const engine = new AudioEngine({
    context: context.asContext(),
    oscillatorModel: "nativeReference",
    virtualization: candidate
      ? {
          maxNativeVoices: 1,
          maxNativeGraphs: 2,
          maxVirtualVoices: 2,
          minResidenceSeconds: 0.2,
          priorityHysteresis: 0.1,
          fairnessSeconds: 30,
        }
      : false,
  });
  try {
    await engine.enable(0);
    engine.registerBuffer("pcm", context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer, {
      name: "Original legacy lifetime",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: "a".repeat(64),
    });
    const input: VoiceInput = {
      instanceId: "shot",
      sourceId: "shot",
      generator: {
        kind: "sample",
        asset: { assetId: "pcm", revision: 1, sha256: "a".repeat(64) },
        loop: false,
        startOffsetSeconds: 0.125,
      },
      gainLinear: 1,
      pitchSemitones: pitch,
      emissionTimeSeconds: 0,
      continuous: false,
      fadeInSeconds: 0.15,
      fadeOutSeconds: 0.1,
      ...(authored === undefined ? {} : { durationSeconds: authored }),
    };
    engine.playVoice(input, frame);
    const source = context.sources()[0]!;
    const gain = source.connections[0] as FakeGainNode;
    const envelope = gain.connections[0] as FakeGainNode;
    const initialStops = [...source.stops];
    context.currentTime = 0.1;
    engine.updateVoice("shot", { pitchSemitones: pitch - 12, smoothingSeconds: 0.1 });
    return { initialStops, afterStops: [...source.stops], envelope: envelope.gain.automation };
  } finally {
    engine.dispose();
  }
}
for (const pitch of [-12, 0, 12])
  for (const authored of [undefined, 0.4])
    test(`nativeReference candidate preserves legacy finite stop and gain policy pitch${pitch} authored${authored ?? "implicit"}`, async () => {
      const reference = await trace(false, pitch, authored),
        candidate = await trace(true, pitch, authored);
      const cutoff = Math.min(authored ?? Infinity, 0.875 / 2 ** (pitch / 12));
      assert.deepEqual(reference.initialStops, [cutoff]);
      assert.deepEqual(
        candidate,
        reference,
        "resource virtualization cannot silently change finite lifetime or content envelope",
      );
    });
