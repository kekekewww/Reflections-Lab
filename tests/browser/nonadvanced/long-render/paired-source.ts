import { createRenderRecordingFixture } from "../../../audio-runtime/render-fixture.js";
import { createRenderPreset } from "../../../../src/audio/render-preset.js";
import { MAX_MONITOR_GAIN } from "../../../../src/audio/monitor-level.js";
import { encodeFloatWave, hashRenderBytes } from "../../../../src/audio/render-pcm.js";
import { canonicalStringify, sha256Canonical } from "../../../../src/experiments/hash.js";
import type { SceneSpec } from "../../../../src/scene/types.js";
import type { RenderJob } from "../../../../src/audio/render-contract.js";
import type { RenderConfiguration, RenderInput } from "../../../../src/audio/render-types.js";

export const PAIRED_RECORDING_SHA256 =
  "7ee6ae2185b90cf5bab1fe2dc7dcbbae0a0946651de4e0aaeca1538072e16827";
export const PAIRED_ASSET_SHA256 =
  "97ae03f5d9a897f06dec1cf82bba77fa33519aff9c2117cdfa419a23a3828cd8";
export const PAIRED_RENDER_CONFIGURATION_SHA256 =
  "469c82d645e9c426967472ea6a1677b86b727c899f330493573e241a3daaa294";
export const PAIRED_RECORDING_CONFIGURATION_SHA256 =
  "bf07c1b318972059e64bc921a8a82e0f173285f66f451c40d3d990a645eeb538";
export const PAIRED_CONTROL_SHA256 =
  "90a06d180eb0f00155bcd7a926c2335858ddabbfd2dd7eefbb7e0e54fd0f91ec";
export const PAIRED_RATE = 48000;
export const PAIRED_EMISSION_FRAMES = 2880000;
export const PAIRED_PREROLL_FRAMES = 800;
export const PAIRED_62_FRAMES = 2976000;
export const PAIRED_63_FRAMES = 3024000;
export const PAIRED_ENCODED_BYTES = 96000224;

export interface PairedSourceIdentity {
  recordingSha256: string;
  recordingStoredSha256: string;
  recordingConfigurationSha256: string;
  renderConfigurationSha256: string;
  recording: {
    schemaVersion: string;
    runId: string;
    runEpoch: string;
    status: string;
    frameCount: number;
    startTick: number | null;
    endTick: number | null;
    traceBytes: number;
  };
  assetSha256: string;
  asset: {
    assetId: string;
    revision: 1;
    sha256: string;
    bytes: number;
    frames: 96000;
    channels: 1;
    rate: 48000;
    origin: string;
    license: string;
  };
  spatialization: RenderJob["spatialization"];
  clock: RenderJob["clock"];
  window: {
    startTick: 2;
    endTickExclusive: 3602;
    preRollFrames: 800;
    emissionFrames: 2880000;
  };
}
export interface PairedNativeSource {
  input: RenderInput;
  job: RenderJob;
  configuration: RenderConfiguration;
  identity: PairedSourceIdentity;
  pathTransitions: {
    tick: number;
    sourceId: string;
    outputControlSample: number;
    seamDistance: number;
  }[];
  expectedControlSamples: number[];
  preparationMs: number;
}

/**
 * Exact generation recipe from the preserved long-native fixture. This regenerates
 * original sample bytes and real Behavior/solver/recorder input; no archived mix PCM
 * is read, fed to a graph, or treated as a whole-source reference.
 */
export async function createPairedNativeSource(jobId: string): Promise<PairedNativeSource> {
  const started = performance.now();
  const originalWave = encodeFloatWave(
    [
      Float32Array.from(
        { length: 96000 },
        (_, i) => 0.7 * Math.sin((2 * Math.PI * i) / 240) + 0.15 * Math.sin((2 * Math.PI * i) / 59),
      ),
    ],
    PAIRED_RATE,
  ).bytes;
  const sourceHash = await hashRenderBytes(originalWave);
  if (sourceHash !== PAIRED_ASSET_SHA256 || originalWave.byteLength !== 384056)
    throw new Error("PAIRED_ASSET_IDENTITY_MISMATCH");
  const decodeContext = new OfflineAudioContext(1, 1, PAIRED_RATE);
  const sample = await decodeContext.decodeAudioData(originalWave.buffer.slice(0));
  if (sample.numberOfChannels !== 1 || sample.length !== 96000 || sample.sampleRate !== PAIRED_RATE)
    throw new Error("PAIRED_DECODED_ASSET_LAYOUT_MISMATCH");
  const pin = { assetId: "asset.original-long-loop", revision: 1, sha256: sourceHash };
  let scene!: SceneSpec;
  const recording = await createRenderRecordingFixture({
    end: 3601,
    allowLongTake: true,
    grabTick: null,
    runId: "run.long-native-3601",
    assets: [
      { ...pin, availability: "READY", rightsStatus: "APPROVED", durationSeconds: sample.duration },
    ],
    editScene(value) {
      scene = value;
      value.objects = value.objects.filter((object) =>
        ["floor", "speaker", "ball"].includes(object.id),
      );
    },
    editDocument(document) {
      document.assets = [pin];
      document.profiles = [document.profiles[0]!];
      const rule = document.profiles[0]!.rules[0]!;
      rule.generator = { kind: "sample", asset: pin, loop: true, startOffsetSeconds: 0.125 };
      rule.gainLinear = 0.9;
      rule.mappings = [
        {
          mappingId: "mapping.long-pitch",
          input: "sourceSpeedMetresPerSecond",
          target: "pitchSemitones",
          inputMin: 0,
          inputMax: 10,
          outputMin: -7,
          outputMax: 7,
          curve: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          interpolation: "linear",
          clamp: true,
          smoothingSeconds: 0.01,
        },
      ];
      document.bindings = [document.bindings.find((binding) => binding.objectId === "speaker")!];
      document.bindings[0]!.overrides = [{ ruleId: rule.ruleId, gainLinear: 0.9 }];
      document.bindings.push({
        ...document.bindings[0]!,
        bindingId: "binding.long-ball",
        objectId: "ball",
        overrides: [{ ruleId: rule.ruleId, gainLinear: 0.75, pitchSemitones: 4 }],
      });
    },
    editInput(frame) {
      const seconds = frame.tick / 60;
      for (const object of frame.objects) {
        if (object.objectId === "floor") continue;
        object.positionMetres[0] +=
          Math.sin(seconds * 0.7) * (object.objectId === "ball" ? 2.7 : 0.6);
        object.metrics.sourceSpeedMetresPerSecond = 5 + 4 * Math.sin(seconds * 0.37);
      }
      scene.listener.positionM[0] = 0.35 * Math.sin(seconds * 0.4);
    },
    editFrame(frame) {
      // Exactly the original finite quality-selection input. Every retained tap
      // came from the real solve; these authored poses are not resimulated physics.
      if (frame.tick >= 43 && frame.tick < 84)
        frame.acousticFrames = frame.acousticFrames.map((acoustic) => ({
          ...acoustic,
          paths: acoustic.paths.filter((path) => path.order === 0),
        }));
    },
  });
  if (
    recording.status !== "captured" ||
    recording.frameCount !== 3601 ||
    recording.startTick !== 1 ||
    recording.endTick !== 3601 ||
    recording.traceBytes > 64 * 1024 * 1024 ||
    recording.artifactSha256 !== PAIRED_RECORDING_SHA256
  )
    throw new Error(`PAIRED_RECORDING_IDENTITY_MISMATCH:${recording.artifactSha256}`);
  const pathSets = new Map<string, string>();
  const pathTransitions: PairedNativeSource["pathTransitions"] = [];
  for (const frame of recording.frames)
    for (const acoustic of frame.acousticFrames) {
      const key = acoustic.paths
        .map((path) => path.id)
        .sort()
        .join("|");
      const previous = pathSets.get(acoustic.sourceId);
      if (previous !== undefined && previous !== key) {
        const outputControlSample = Math.floor(((frame.tick - 1) * 800) / 128) * 128 - 800;
        const phase = ((outputControlSample % 32768) + 32768) % 32768;
        pathTransitions.push({
          tick: frame.tick,
          sourceId: acoustic.sourceId,
          outputControlSample,
          seamDistance: Math.min(phase, 32768 - phase),
        });
      }
      pathSets.set(acoustic.sourceId, key);
    }
  if (pathTransitions.length < 2 || !pathTransitions.some((point) => point.seamDistance <= 128))
    throw new Error("PAIRED_SOLVED_PATH_TRANSITIONS_MISSING");
  const preset = await createRenderPreset(
    recording,
    [
      {
        assetId: pin.assetId,
        buffer: sample,
        metadata: {
          revision: 1,
          sha256: sourceHash,
          name: "Original long native loop",
          origin: "generated",
          license: "ORIGINAL_TEST_FIXTURE",
        },
      },
    ],
    { tailSeconds: 2, spatializationModel: "HRTF" },
    {
      headroomGain: 1,
      monitorGain: MAX_MONITOR_GAIN,
      limiterEnabled: true,
      outputSafetyClip: true,
      lateReverb: { enabled: true, decaySeconds: 1.2, wetGain: 0.15, seed: 1746 },
    },
    jobId,
  );
  const masterRequest = preset.job.outputs.find(
    (output) => output.tap === "master" && output.sources.kind === "allRecordedSources",
  );
  if (!masterRequest) throw new Error("PAIRED_MASTER_REQUEST_MISSING");
  const job: RenderJob = {
    ...preset.job,
    outputs: [masterRequest],
    window: { ...preset.job.window, startTick: 2, endTickExclusive: 3602, preRollFrames: 800 },
  };
  const storedHash = await hashRenderBytes(new TextEncoder().encode(canonicalStringify(recording)));
  if (
    storedHash !== job.recording.sha256 ||
    preset.input.configuration.recordingConfigurationSha256 !==
      PAIRED_RECORDING_CONFIGURATION_SHA256 ||
    job.renderConfiguration.sha256 !== PAIRED_RENDER_CONFIGURATION_SHA256 ||
    (await sha256Canonical(preset.input.configuration)) !== PAIRED_RENDER_CONFIGURATION_SHA256 ||
    job.spatialization.kind !== "nativePanner" ||
    job.spatialization.model !== "HRTF" ||
    job.spatialization.profileIdentity !== "browserManagedUnspecified"
  )
    throw new Error("PAIRED_INPUT_CONFIGURATION_PIN_MISMATCH");
  const expectedControlSamples = recording.frames
    .slice(1)
    .map((frame) => Math.floor(((frame.tick - 1) * 800) / 128) * 128);
  const emissionEnd = (3602 - 1) * 800;
  expectedControlSamples.push(
    Math.floor(emissionEnd / 128) * 128,
    Math.floor((emissionEnd + 4800) / 128) * 128,
  );
  if (
    expectedControlSamples.length !== 3602 ||
    (await sha256Canonical(expectedControlSamples)) !== PAIRED_CONTROL_SHA256
  )
    throw new Error("PAIRED_EXPECTED_CONTROL_GRID_IDENTITY");
  return {
    input: preset.input,
    job,
    configuration: preset.input.configuration,
    identity: {
      recordingSha256: recording.artifactSha256,
      recordingStoredSha256: storedHash,
      recordingConfigurationSha256: preset.input.configuration.recordingConfigurationSha256,
      renderConfigurationSha256: job.renderConfiguration.sha256,
      recording: {
        schemaVersion: recording.schemaVersion,
        runId: recording.runId,
        runEpoch: recording.runEpoch,
        status: recording.status,
        frameCount: recording.frameCount,
        startTick: recording.startTick,
        endTick: recording.endTick,
        traceBytes: recording.traceBytes,
      },
      assetSha256: sourceHash,
      asset: {
        assetId: pin.assetId,
        revision: 1,
        sha256: sourceHash,
        bytes: originalWave.byteLength,
        frames: 96000,
        channels: 1,
        rate: 48000,
        origin: "Original generated fixture",
        license: "ORIGINAL_TEST_FIXTURE",
      },
      spatialization: job.spatialization,
      clock: job.clock,
      window: { startTick: 2, endTickExclusive: 3602, preRollFrames: 800, emissionFrames: 2880000 },
    },
    pathTransitions,
    expectedControlSamples,
    preparationMs: performance.now() - started,
  };
}
