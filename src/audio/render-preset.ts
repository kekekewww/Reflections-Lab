import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { canonicalStringify, sha256Canonical } from "../experiments/hash.js";
import type { RecordingArtifact } from "../experiments/types.js";
import type { RenderJob, RenderOutputRequest } from "./render-contract.js";
import { RenderError, hashRenderBytes } from "./render-pcm.js";
import type { RenderConfiguration, RenderInput, RenderMasterSettings } from "./render-types.js";
import { DEFAULT_RENDER_MASTER } from "./render-types.js";
import { NATIVE_RENDER_IDENTITY, RENDER_LIMITS } from "./render-validation.js";
import type { AudioAssetBankEntry } from "./types.js";

export interface RenderPresetOptions {
  includeSourceStems?: boolean;
  tailSeconds?: number;
  spatializationModel?: PanningModelType;
}
export interface RenderSourceGroup {
  objectId: string;
  sourceIds: string[];
}

/** Group captured voice identities by their authored object, without removing physics bodies. */
export function recordedRenderSources(recording: RecordingArtifact): RenderSourceGroup[] {
  const groups = new Map<string, Set<string>>();
  const known = new Set(
    recording.frames.flatMap((frame) => frame.acousticFrames.map((item) => item.sourceId)),
  );
  for (const frame of recording.frames) {
    const snapshot = frame.behaviorSnapshot as
      | {
          voiceIntents?: { event: { instanceId: string; objectId: string } }[];
          runtimeSnapshot?: { state: { instances: { instanceId: string; objectId: string }[] } };
          preStepSnapshot?: { state: { instances: { instanceId: string; objectId: string }[] } };
        }
      | undefined;
    const values = [
      ...(snapshot?.voiceIntents?.map((intent) => intent.event) ?? []),
      ...(snapshot?.runtimeSnapshot?.state.instances ?? []),
      ...(snapshot?.preStepSnapshot?.state.instances ?? []),
    ];
    for (const value of values) {
      if (!known.has(value.instanceId)) continue;
      const group = groups.get(value.objectId) ?? new Set<string>();
      group.add(value.instanceId);
      groups.set(value.objectId, group);
    }
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([objectId, sources]) => ({ objectId, sourceIds: [...sources].sort() }));
}

export async function createRenderPreset(
  recording: RecordingArtifact,
  bank: readonly AudioAssetBankEntry[],
  options: RenderPresetOptions = {},
  master: RenderMasterSettings = structuredClone(DEFAULT_RENDER_MASTER),
  jobId = `render-${globalThis.crypto.randomUUID()}`,
): Promise<{ job: RenderJob; input: RenderInput }> {
  if (recording.startTick === null || recording.endTick === null || !recording.frames.length)
    throw new RenderError(
      "RENDER_RECORDING_INCOMPLETE",
      "Capture a complete take of up to 60 seconds before rendering.",
    );
  const rate = recording.configuration.sampleRateHz;
  const configuration: RenderConfiguration = {
    schemaVersion: "native-offline-render-config-v1",
    recordingConfigurationSha256: await sha256Canonical(recording.configuration),
    assets: bank
      .map((asset) => ({
        assetId: asset.assetId,
        revision: asset.metadata.revision ?? 1,
        sha256: asset.metadata.sha256 ?? null,
      }))
      .sort((a, b) => a.assetId.localeCompare(b.assetId)),
    master: structuredClone(master),
    controlQuantumFrames: 128,
  };
  const output = (
    id: string,
    tap: RenderOutputRequest["tap"],
    sourceIds?: string[],
  ): RenderOutputRequest => ({
    id,
    tap,
    sources: sourceIds
      ? { kind: "includeRecordedSourceIds", sourceIds }
      : { kind: "allRecordedSources" },
    mixPolicy: "independentGraphPerSelection",
    channels: 2,
    encoding: "float32Pcm",
  });
  const outputs = [
    output("mix", "simulatedMix"),
    output("master", "master"),
    output("dry", "dryContent"),
  ];
  if (options.includeSourceStems !== false) {
    for (const group of recordedRenderSources(recording))
      outputs.push(
        output(
          `stem-${(await sha256Canonical(group.objectId)).slice(0, 12)}-${group.objectId.replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 64)}`,
          "simulatedMix",
          group.sourceIds,
        ),
      );
  }
  if (outputs.length > RENDER_LIMITS.maxOutputs)
    throw new RenderError(
      "RENDER_OUTPUTS",
      "This take has too many object stems for a single bounded job; render the mix without stems or select fewer owners.",
    );
  const tailSeconds = options.tailSeconds ?? 2;
  if (!Number.isFinite(tailSeconds) || tailSeconds < 0 || tailSeconds > 10)
    throw new RenderError("RENDER_TAIL", "Tail must be between zero and ten seconds.");
  const fixedDt = recording.configuration.fixedDtS;
  const denominator = 1000000;
  const numerator = Math.round(fixedDt * denominator);
  const common = (a: number, b: number): number => (b ? common(b, a % b) : a);
  // Preserve the production 60 Hz clock exactly, rather than decimal-rounding 1/60.
  const rational =
    Math.abs(fixedDt - 1 / 60) < 1e-12
      ? [1, 60]
      : [numerator / common(numerator, denominator), denominator / common(numerator, denominator)];
  const configHash = await sha256Canonical(configuration);
  const document = recording.configuration.behaviorConfig as SoundBehaviorDocument;
  if (!document || !Array.isArray(document.profiles))
    throw new RenderError(
      "RENDER_BEHAVIOR_UNAVAILABLE",
      "The take lacks the original behavior document.",
    );
  const job: RenderJob = {
    schemaVersion: "render-job-plan-v1",
    jobId,
    recording: {
      id: recording.runId,
      sha256: await hashRenderBytes(new TextEncoder().encode(canonicalStringify(recording))),
    },
    recordingContentSha256: recording.artifactSha256,
    sceneRevision: recording.configuration.sceneSnapshot.sceneRevision,
    backend: { ...NATIVE_RENDER_IDENTITY },
    requiredCapabilities: ["offlinePcm", "emissionSelection"],
    clock: {
      policy: "tick-to-sample-rational-v1",
      tickOrigin: recording.startTick,
      fixedDtNumerator: rational[0]!,
      fixedDtDenominator: rational[1]!,
      sampleRateHz: rate,
      rounding: "nearestTiesToPositiveInfinity",
    },
    window: {
      startTick: recording.startTick,
      endTickExclusive: recording.endTick + 1,
      preRollFrames: 0,
      tailFrames: Math.round(tailSeconds * rate),
      boundaryPolicy: "reportUnresolvedHistoryAndTruncatedTail",
      outputOrigin: "windowStart",
    },
    listener: { kind: "recorded" },
    spatialization: {
      kind: "nativePanner",
      model: options.spatializationModel ?? "HRTF",
      profileIdentity: "browserManagedUnspecified",
    },
    renderConfiguration: { id: `render-config-${configHash.slice(0, 24)}`, sha256: configHash },
    selectionPolicy: "preserveRecordedPhysicsBehaviorAndAdmission",
    normalization: "none",
    outputs,
    budget: {
      maxOutputFrames: RENDER_LIMITS.maxContextSeconds * rate,
      maxWorkingBytes: RENDER_LIMITS.maxWorkingBytes,
      maxOutputBytes: RENDER_LIMITS.maxOutputBytes,
    },
  };
  return { job, input: { recording, configuration, assetBank: bank } };
}
