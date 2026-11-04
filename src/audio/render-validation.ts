import { canonicalStringify, sha256Canonical } from "../experiments/hash.js";
import { verifyRecording } from "../experiments/recorder.js";
import type { RenderCapability, RenderJob, RenderOutputRequest } from "./render-contract.js";
import { readAudioContentModelPin } from "./content-model.js";
import { RenderError, hashRenderBytes } from "./render-pcm.js";
import type { RenderInput } from "./render-types.js";

export const NATIVE_RENDER_IDENTITY = Object.freeze({
  id: "native-offline-recorded",
  version: "1.0.0",
});
export const NATIVE_RENDER_CAPABILITIES: readonly RenderCapability[] = Object.freeze([
  "offlinePcm",
  "emissionSelection",
]);
export const RENDER_LIMITS = Object.freeze({
  maxTakeSeconds: 60,
  maxContextSeconds: 75,
  maxTailSeconds: 10,
  maxOutputs: 16,
  maxWorkingBytes: 256 * 1024 * 1024,
  maxOutputBytes: 192 * 1024 * 1024,
});
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
function need(condition: unknown, code: string, reason: string): asserts condition {
  if (!condition) throw new RenderError(code, reason);
}
function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return (
    Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum
  );
}
function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value: object, allowed: readonly string[], name: string): void {
  need(
    Object.keys(value).length === allowed.length &&
      Object.keys(value).every((key) => allowed.includes(key)),
    "RENDER_SCHEMA",
    `${name} must contain exactly its declared fields.`,
  );
}
function reference(value: unknown, name: string): void {
  need(plain(value), "RENDER_SCHEMA", `${name} is not an artifact reference.`);
  keys(value, ["id", "sha256"], name);
  need(
    typeof value.id === "string" && idPattern.test(value.id),
    "RENDER_REFERENCE",
    `${name} has an invalid ID.`,
  );
  need(
    typeof value.sha256 === "string" && hashPattern.test(value.sha256),
    "RENDER_REFERENCE",
    `${name} has an invalid SHA-256.`,
  );
}

export function renderTickSample(job: RenderJob, tick: number): number {
  const clock = job.clock;
  const numerator = (tick - clock.tickOrigin) * clock.fixedDtNumerator * clock.sampleRateHz;
  need(
    Number.isSafeInteger(numerator),
    "RENDER_CLOCK_OVERFLOW",
    "Tick-to-sample multiplication overflowed.",
  );
  const sample = Math.round(numerator / clock.fixedDtDenominator);
  need(integer(sample), "RENDER_CLOCK_OVERFLOW", "Tick-to-sample mapping is negative or unsafe.");
  return sample;
}

export interface ValidatedRenderPlan {
  startFrameIndex: number;
  endFrameIndexExclusive: number;
  renderStartTick: number;
  emissionFrames: number;
  outputFrames: number;
  contextFrames: number;
  outputBytes: number;
  estimatedWorkingBytes: number;
}

/** Closed portable schema and integer budgets are checked before any native context allocation. */
export function validateRenderJob(job: RenderJob, input: RenderInput): ValidatedRenderPlan {
  canonicalStringify(job);
  need(plain(job), "RENDER_SCHEMA", "Render job must be a plain object.");
  keys(
    job,
    [
      "schemaVersion",
      "jobId",
      "recording",
      "recordingContentSha256",
      "sceneRevision",
      "backend",
      "requiredCapabilities",
      "clock",
      "window",
      "listener",
      "spatialization",
      "renderConfiguration",
      "selectionPolicy",
      "normalization",
      "outputs",
      "budget",
    ],
    "RenderJob",
  );
  need(
    job.schemaVersion === "render-job-plan-v1" &&
      typeof job.jobId === "string" &&
      idPattern.test(job.jobId),
    "RENDER_SCHEMA",
    "Invalid render version or job ID.",
  );
  reference(job.recording, "recording");
  reference(job.renderConfiguration, "renderConfiguration");
  need(
    typeof job.recordingContentSha256 === "string" &&
      hashPattern.test(job.recordingContentSha256) &&
      integer(job.sceneRevision),
    "RENDER_REFERENCE",
    "Invalid content hash or scene revision.",
  );
  need(plain(job.backend), "RENDER_SCHEMA", "Missing render backend.");
  keys(job.backend, ["id", "version"], "backend");
  need(
    job.backend.id === NATIVE_RENDER_IDENTITY.id &&
      job.backend.version === NATIVE_RENDER_IDENTITY.version,
    "RENDER_BACKEND",
    "The selected render backend/version is unavailable.",
  );
  need(
    Array.isArray(job.requiredCapabilities) &&
      new Set(job.requiredCapabilities).size === job.requiredCapabilities.length &&
      job.requiredCapabilities.every((value) => NATIVE_RENDER_CAPABILITIES.includes(value)),
    "RENDER_CAPABILITY",
    "This backend cannot provide a required capability.",
  );
  need(plain(job.clock), "RENDER_SCHEMA", "Missing render clock.");
  keys(
    job.clock,
    ["policy", "tickOrigin", "fixedDtNumerator", "fixedDtDenominator", "sampleRateHz", "rounding"],
    "clock",
  );
  need(
    job.clock.policy === "tick-to-sample-rational-v1" &&
      job.clock.rounding === "nearestTiesToPositiveInfinity" &&
      integer(job.clock.tickOrigin) &&
      integer(job.clock.fixedDtNumerator, 1, 1000000) &&
      integer(job.clock.fixedDtDenominator, 1, 1000000) &&
      [44100, 48000].includes(job.clock.sampleRateHz),
    "RENDER_CLOCK",
    "Invalid rational render clock.",
  );
  const recording = input.recording;
  need(
    recording.status === "captured" &&
      recording.frames.length > 0 &&
      recording.startTick !== null &&
      recording.endTick !== null,
    "RENDER_RECORDING_INCOMPLETE",
    "Only a complete nonempty captured recording can be rendered.",
  );
  need(
    job.recording.id === recording.runId &&
      job.recordingContentSha256 === recording.artifactSha256 &&
      job.sceneRevision === recording.configuration.sceneSnapshot.sceneRevision &&
      job.clock.tickOrigin === recording.startTick &&
      Math.abs(
        job.clock.fixedDtNumerator / job.clock.fixedDtDenominator -
          recording.configuration.fixedDtS,
      ) < 1e-12 &&
      job.clock.sampleRateHz === recording.configuration.sampleRateHz,
    "RENDER_PROVENANCE",
    "The job clock, content or scene pin differs from the recording.",
  );
  need(plain(job.window), "RENDER_SCHEMA", "Missing render window.");
  keys(
    job.window,
    [
      "startTick",
      "endTickExclusive",
      "preRollFrames",
      "tailFrames",
      "boundaryPolicy",
      "outputOrigin",
    ],
    "window",
  );
  const window = job.window;
  need(
    integer(window.startTick, recording.startTick, recording.endTick) &&
      integer(window.endTickExclusive, window.startTick + 1, recording.endTick + 1) &&
      integer(window.preRollFrames) &&
      integer(window.tailFrames, 0, RENDER_LIMITS.maxTailSeconds * job.clock.sampleRateHz) &&
      window.boundaryPolicy === "reportUnresolvedHistoryAndTruncatedTail" &&
      window.outputOrigin === "windowStart",
    "RENDER_WINDOW",
    "The requested render window or tail is outside the captured trace and finite tail limit.",
  );
  const start = renderTickSample(job, window.startTick);
  const end = renderTickSample(job, window.endTickExclusive);
  const emissionFrames = end - start;
  const contextStart = start - window.preRollFrames;
  need(
    contextStart >= 0 &&
      emissionFrames > 0 &&
      emissionFrames <= RENDER_LIMITS.maxTakeSeconds * job.clock.sampleRateHz,
    "RENDER_DURATION",
    "The emission window exceeds the 60 second finite-take limit.",
  );
  const startFrameIndex = recording.frames.findIndex(
    (frame) => renderTickSample(job, frame.tick) === contextStart,
  );
  need(
    startFrameIndex >= 0,
    "RENDER_PREROLL",
    "Preroll must begin at an available captured tick boundary.",
  );
  const endIndex = recording.frames.findIndex((frame) => frame.tick >= window.endTickExclusive);
  const endFrameIndexExclusive = endIndex < 0 ? recording.frames.length : endIndex;
  const outputFrames = emissionFrames + window.tailFrames;
  const contextFrames = window.preRollFrames + outputFrames;
  need(
    integer(contextFrames, 1, RENDER_LIMITS.maxContextSeconds * job.clock.sampleRateHz),
    "RENDER_DURATION",
    "Preroll, take and tail exceed the 75 second context limit.",
  );
  need(
    plain(job.listener) &&
      job.listener.kind === "recorded" &&
      Object.keys(job.listener).length === 1,
    "RENDER_LISTENER_UNSUPPORTED",
    "Listener replacement requires acoustic reevaluation and is not supported by this backend.",
  );
  need(
    plain(job.spatialization) && job.spatialization.kind === "nativePanner",
    "RENDER_HRTF_UNSUPPORTED",
    "This backend requires the existing native panner graph.",
  );
  keys(job.spatialization, ["kind", "model", "profileIdentity"], "spatialization");
  need(
    ["HRTF", "equalpower"].includes(job.spatialization.model) &&
      job.spatialization.profileIdentity === "browserManagedUnspecified",
    "RENDER_HRTF_UNSUPPORTED",
    "Unsupported native panner model/profile.",
  );
  need(
    job.selectionPolicy === "preserveRecordedPhysicsBehaviorAndAdmission" &&
      job.normalization === "none",
    "RENDER_SELECTION",
    "Render selection cannot change captured physics, behavior or normalization.",
  );
  need(
    Array.isArray(job.outputs) &&
      job.outputs.length > 0 &&
      job.outputs.length <= RENDER_LIMITS.maxOutputs,
    "RENDER_OUTPUTS",
    "Request between one and sixteen outputs.",
  );
  const knownSources = new Set(
    recording.frames.flatMap((frame) => frame.acousticFrames.map((value) => value.sourceId)),
  );
  const outputIds = new Set<string>();
  let outputBytes = 0;
  for (const output of job.outputs as readonly RenderOutputRequest[]) {
    need(plain(output), "RENDER_SCHEMA", "Output must be a portable object.");
    keys(output, ["id", "tap", "sources", "mixPolicy", "channels", "encoding"], "output");
    need(
      typeof output.id === "string" && idPattern.test(output.id) && !outputIds.has(output.id),
      "RENDER_OUTPUTS",
      "Output IDs must be valid and unique.",
    );
    outputIds.add(output.id);
    need(
      ["dryContent", "direct", "early", "simulatedMix", "master"].includes(output.tap),
      "RENDER_TAP_UNSUPPORTED",
      "This backend does not expose a separate late-reverb tap.",
    );
    need(
      output.mixPolicy === "independentGraphPerSelection" &&
        [1, 2].includes(output.channels) &&
        output.encoding === "float32Pcm",
      "RENDER_OUTPUTS",
      "Unsupported output layout or encoding.",
    );
    need(plain(output.sources), "RENDER_SELECTION", "Missing emission selection.");
    if (output.sources.kind === "allRecordedSources") keys(output.sources, ["kind"], "sources");
    else {
      need(
        output.sources.kind === "includeRecordedSourceIds",
        "RENDER_SELECTION",
        "Unsupported source selection.",
      );
      keys(output.sources, ["kind", "sourceIds"], "sources");
      need(
        Array.isArray(output.sources.sourceIds) &&
          output.sources.sourceIds.length > 0 &&
          output.sources.sourceIds.length <= 4096 &&
          new Set(output.sources.sourceIds).size === output.sources.sourceIds.length &&
          output.sources.sourceIds.every((id) => typeof id === "string" && knownSources.has(id)),
        "RENDER_SELECTION",
        "Source selection contains missing or duplicate recorded emissions.",
      );
    }
    outputBytes += 56 + outputFrames * output.channels * 4;
  }
  // These are the declared native graph limits, not solver/scientific limits.
  // Check the actual selection/tap; the post-render diagnostics also catch retiring
  // routes that exceed capacity dynamically between captured frames.
  for (const output of job.outputs) {
    if (output.tap === "dryContent") continue;
    const selected =
      output.sources.kind === "includeRecordedSourceIds" ? new Set(output.sources.sourceIds) : null;
    for (const frame of recording.frames) {
      let paths = 0;
      for (const acoustic of frame.acousticFrames) {
        if (selected && !selected.has(acoustic.sourceId)) continue;
        const count = acoustic.paths.filter((path) =>
          output.tap === "direct"
            ? path.order === 0
            : output.tap === "early"
              ? path.order > 0
              : true,
        ).length;
        need(
          count <= 16,
          "RENDER_NATIVE_PATH_BUDGET",
          "Captured paths exceed the native per-voice path limit.",
        );
        paths += count;
      }
      need(
        paths <= 256,
        "RENDER_NATIVE_PATH_BUDGET",
        "Captured paths exceed the native total-path limit.",
      );
    }
  }
  need(plain(job.budget), "RENDER_SCHEMA", "Missing render budgets.");
  keys(job.budget, ["maxOutputFrames", "maxWorkingBytes", "maxOutputBytes"], "budget");
  const assetBytes = input.assetBank.reduce(
    (sum, asset) => sum + asset.buffer.length * asset.buffer.numberOfChannels * 4,
    0,
  );
  let maximumPathCount = 0;
  let maximumDelay = 0;
  for (const frame of recording.frames) {
    let paths = 0;
    for (const acoustic of frame.acousticFrames) {
      paths += acoustic.paths.length;
      for (const path of acoustic.paths) maximumDelay = Math.max(maximumDelay, path.absoluteDelayS);
    }
    maximumPathCount = Math.max(maximumPathCount, paths);
  }
  // Long files are durable chunks, not resident WAVs. The legacy synchronous
  // <=30s API retains all encoded bytes and remains part of its admission cost.
  const legacyCacheBytes = emissionFrames <= 30 * job.clock.sampleRateHz ? outputBytes : 0;
  const traceBytes = new TextEncoder().encode(canonicalStringify(recording)).byteLength;
  const estimatedWorkingBytes =
    legacyCacheBytes +
    traceBytes * 3 +
    32768 * 2 * 4 * 3 +
    contextFrames * 2 * 4 * 3 +
    assetBytes * 2 +
    Math.ceil(maximumPathCount * Math.max(maximumDelay, 0.1) * job.clock.sampleRateHz * 2 * 4) +
    8 * 1024 * 1024;
  need(
    integer(
      job.budget.maxOutputFrames,
      outputFrames,
      RENDER_LIMITS.maxContextSeconds * job.clock.sampleRateHz,
    ) &&
      integer(job.budget.maxOutputBytes, outputBytes, RENDER_LIMITS.maxOutputBytes) &&
      integer(job.budget.maxWorkingBytes, estimatedWorkingBytes, RENDER_LIMITS.maxWorkingBytes),
    "RENDER_BUDGET",
    "Render frame, output-byte or estimated working-memory budget is exceeded.",
  );
  return {
    startFrameIndex,
    endFrameIndexExclusive,
    renderStartTick: recording.frames[startFrameIndex]!.tick,
    emissionFrames,
    outputFrames,
    contextFrames,
    outputBytes,
    estimatedWorkingBytes,
  };
}

export async function verifyRenderInput(
  job: RenderJob,
  input: RenderInput,
): Promise<ValidatedRenderPlan> {
  const plan = validateRenderJob(job, input);
  await verifyRecording(input.recording);
  try {
    readAudioContentModelPin(input.recording.configuration.generatorConfig);
  } catch (error) {
    throw new RenderError(
      "RENDER_CONTENT_MODEL_PIN",
      error instanceof Error ? error.message : String(error),
    );
  }
  const bytes = new TextEncoder().encode(canonicalStringify(input.recording));
  need(
    (await hashRenderBytes(bytes)) === job.recording.sha256,
    "RENDER_RECORDING_HASH",
    "Canonical stored recording bytes do not match the pinned reference.",
  );
  need(
    (await sha256Canonical(input.configuration)) === job.renderConfiguration.sha256 &&
      input.configuration.recordingConfigurationSha256 ===
        (await sha256Canonical(input.recording.configuration)),
    "RENDER_CONFIGURATION_HASH",
    "Render configuration or captured configuration pin changed.",
  );
  const settings = input.configuration.master;
  need(
    plain(settings) &&
      Number.isFinite(settings.headroomGain) &&
      settings.headroomGain >= 0 &&
      settings.headroomGain <= 1 &&
      Number.isFinite(settings.monitorGain) &&
      settings.monitorGain >= 0 &&
      settings.monitorGain <= 4 &&
      typeof settings.limiterEnabled === "boolean" &&
      typeof settings.outputSafetyClip === "boolean",
    "RENDER_CONFIGURATION",
    "Invalid pinned master gain or processing policy.",
  );
  need(
    plain(settings.lateReverb) &&
      typeof settings.lateReverb.enabled === "boolean" &&
      Number.isFinite(settings.lateReverb.decaySeconds) &&
      settings.lateReverb.decaySeconds >= 0.1 &&
      settings.lateReverb.decaySeconds <= 4 &&
      Number.isFinite(settings.lateReverb.wetGain) &&
      settings.lateReverb.wetGain >= 0 &&
      settings.lateReverb.wetGain <= 1 &&
      integer(settings.lateReverb.seed, 0, 0xffffffff),
    "RENDER_CONFIGURATION",
    "Invalid pinned late-reverb settings.",
  );
  const pins = input.configuration.assets;
  need(
    input.configuration.schemaVersion === "native-offline-render-config-v1" &&
      input.configuration.controlQuantumFrames === 128 &&
      Array.isArray(pins) &&
      pins.length <= 256 &&
      new Set(pins.map((pin) => pin.assetId)).size === pins.length,
    "RENDER_CONFIGURATION",
    "Invalid render configuration or asset pins.",
  );
  for (const pin of pins) {
    const matches = input.assetBank.filter(
      (asset) =>
        asset.assetId === pin.assetId &&
        (asset.metadata.revision ?? 1) === pin.revision &&
        (asset.metadata.sha256 ?? null) === pin.sha256,
    );
    need(
      matches.length === 1,
      "RENDER_ASSET_PIN",
      `Pinned asset ${pin.assetId} is absent or has changed.`,
    );
  }
  return plan;
}
