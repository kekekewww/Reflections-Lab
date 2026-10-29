import type { ComparisonRun } from "../../schemas/sound-behavior/types.js";
import { Ajv2020 } from "ajv/dist/2020.js";
import acousticSchema from "../../schemas/acoustic-frame.schema.json" with { type: "json" };
import { createScene } from "../scene/validate-scene.js";
import {
  canonicalBytes,
  canonicalStringify,
  immutableClone,
  immutableCloneWithByteLength,
  sha256Canonical,
} from "./hash.js";
import { normalizeSourcePhase } from "./source-phase.js";
import { RecordingError } from "./types.js";
import type {
  ExperimentManifest,
  ExperimentRecorderOptions,
  RecorderState,
  RecorderTelemetry,
  RecordedPose,
  RecordingArtifact,
  RecordingConfiguration,
  RecordingFrame,
  RecordingFrameInput,
  RecordingStatus,
  RecordingFingerprintVersion,
} from "./types.js";

const idPattern = /^[a-z][a-z0-9._-]{0,63}$/;
const hardLimits = {
  maxFrames: 18000,
  maxBytes: 64 * 1024 * 1024,
  maxObjects: 256,
  maxEvents: 100000,
  maxEventsPerFrame: 2048,
};
const validAcousticShape = new Ajv2020({
  strict: true,
  allErrors: true,
  ownProperties: true,
}).compile(acousticSchema);
function fail(code: string, message: string): never {
  throw new RecordingError(code, message);
}
function validId(value: string): boolean {
  return typeof value === "string" && idPattern.test(value);
}
function integer(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function vector(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1000000)
  );
}
function validatePose(pose: RecordedPose): void {
  if (!validId(pose.objectId) || !vector(pose.positionM, 3)) fail("POSE", "非法物件位置或 ID。");
  if (
    !vector(pose.orientationQuaternion, 4) ||
    Math.abs(Math.hypot(...pose.orientationQuaternion) - 1) > 1e-5
  )
    fail("QUATERNION", "旋轉必須為單位 quaternion。");
  if (pose.linearVelocityMps !== undefined && !vector(pose.linearVelocityMps, 3))
    fail("POSE", "非法線速度。");
  if (pose.angularVelocityRadps !== undefined && !vector(pose.angularVelocityRadps, 3))
    fail("POSE", "非法角速度。");
}
function normalizeConfiguration(options: ExperimentRecorderOptions): RecordingConfiguration {
  const scene = createScene(options.sceneSnapshot);
  if (!validId(options.runId) || !validId(options.runEpoch ?? options.runId))
    fail("RUN_ID", "非法 run／epoch ID。");
  if (!Number.isFinite(options.fixedDtS) || options.fixedDtS <= 0 || options.fixedDtS > 0.1)
    fail("FIXED_DT", "fixedDtS 超出有效範圍。");
  if (![44100, 48000].includes(options.sampleRateHz))
    fail("SAMPLE_RATE", "只支援 44100／48000 Hz。");
  if (
    ![
      options.physicsVersion,
      options.backendVersion,
      options.backendId ?? "custom-web-acoustic-core",
    ].every((s) => typeof s === "string" && s.length > 0 && s.length <= 128)
  )
    fail("VERSION", "版本／backend ID 必須明示。");
  const geometrySnapshot = options.geometrySnapshot ?? {
    units: scene.units,
    coordinateSystem: scene.coordinateSystem,
    objects: scene.objects.map(
      ({ id, shape, dimensionsM, positionM, orientationQuaternion, acousticRole }) => ({
        id,
        shape,
        dimensionsM,
        positionM,
        orientationQuaternion,
        acousticRole,
      }),
    ),
  };
  const physicsConfig = options.physicsConfig ?? {
    gravityMps2: scene.gravityMps2,
    seed: scene.seed,
    objects: scene.objects.map(
      ({ id, mode, massKg, friction, restitution, physicsMaterialId }) => ({
        id,
        mode,
        massKg,
        friction,
        restitution,
        physicsMaterialId,
      }),
    ),
  };
  const configuration: RecordingConfiguration = {
    sceneSnapshot: scene,
    sourceConfig: options.sourceConfig,
    behaviorConfig: options.behaviorConfig,
    solverConfig: options.solverConfig,
    atmosphere: options.atmosphere,
    materialRegistry: options.materialRegistry,
    assetManifest: options.assetManifest ?? [],
    generatorConfig: options.generatorConfig ?? options.sourceConfig,
    physicsConfig,
    geometrySnapshot,
    physicsVersion: options.physicsVersion,
    backendId: options.backendId ?? "custom-web-acoustic-core",
    backendVersion: options.backendVersion,
    fixedDtS: options.fixedDtS,
    sampleRateHz: options.sampleRateHz,
  };
  if (canonicalBytes(configuration) > 2 * 1024 * 1024)
    fail("CONFIGURATION_BUDGET", "實驗配置超過 2 MiB。");
  return immutableClone(configuration);
}

function validateFrame(
  frame: RecordingFrame,
  configuration: RecordingConfiguration,
  epoch: string,
  previousTick: number | null,
  seenEvents: ReadonlySet<string>,
): string[] {
  if (!integer(frame.tick) || (previousTick !== null && frame.tick !== previousTick + 1))
    fail("TICK_GAP", "錄製 tick 必須逐一連續；不靜默補遺失 tick。");
  if (frame.sceneRevision !== configuration.sceneSnapshot.sceneRevision)
    fail("SCENE_REVISION", "錄製中不能混入其他 Scene revision。");
  if (frame.runEpoch !== epoch) fail("RUN_EPOCH", "錄製中不能混入其他 epoch。");
  const objectIds = new Set(configuration.sceneSnapshot.objects.map((object) => object.id));
  const poseIds = new Set<string>();
  if (!Array.isArray(frame.poses) || frame.poses.length !== objectIds.size)
    fail("OBJECT_REFERENCE", "每個 tick 必須包含全部場景物件姿態。");
  for (const pose of frame.poses) {
    validatePose(pose);
    if (!objectIds.has(pose.objectId) || poseIds.has(pose.objectId))
      fail("OBJECT_REFERENCE", "姿態包含不存在或重複的物件。");
    poseIds.add(pose.objectId);
  }
  const listener = frame.listener;
  if (
    !listener ||
    listener.id !== configuration.sceneSnapshot.listener.id ||
    !vector(listener.positionM, 3)
  )
    fail("LISTENER", "Listener 參照或位置無效。");
  if (
    !vector(listener.orientationQuaternion, 4) ||
    Math.abs(Math.hypot(...listener.orientationQuaternion) - 1) > 1e-5
  )
    fail("QUATERNION", "Listener 必須為單位 quaternion。");
  const newEvents: string[] = [];
  const frameIds = new Set<string>();
  for (const [kind, events] of [
    ["physics", frame.physicsEvents],
    ["audio", frame.audioEvents],
  ] as const) {
    if (!Array.isArray(events)) fail("EVENT", "事件 trace 必須為陣列。");
    let lastSequence = -1;
    for (const value of events) {
      if (
        !record(value) ||
        !validId(value.eventId as string) ||
        value.tick !== frame.tick ||
        !integer(value.sequence as number)
      )
        fail("EVENT", "事件必須有合法 ID、同 tick 與 sequence。");
      const sequence = value.sequence as number;
      if (sequence <= lastSequence)
        fail("EVENT_SEQUENCE", "同一 trace tick 的 sequence 必須遞增且不能重複。");
      lastSequence = sequence;
      if (typeof value.objectId === "string" && !objectIds.has(value.objectId))
        fail("OBJECT_REFERENCE", "事件參照不存在的物件。");
      const eventKey = `${kind}:${value.eventId as string}`;
      if (frameIds.has(eventKey) || seenEvents.has(eventKey))
        fail("DUPLICATE_EVENT", "同一 epoch 不接受重複 event ID。");
      frameIds.add(eventKey);
      newEvents.push(eventKey);
    }
  }
  if (!Array.isArray(frame.behaviorDecisions)) fail("DECISION", "Behavior decisions 必須為陣列。");
  for (const decision of frame.behaviorDecisions) {
    if (!record(decision) || decision.tick !== frame.tick)
      fail("DECISION", "Behavior decision 必須來自同一 tick。");
  }
  for (const acoustic of frame.acousticFrames) {
    if (!validAcousticShape(acoustic)) fail("ACOUSTIC_REFERENCE", "聲學 frame 未通過原始 schema。");
    if (
      acoustic.schemaVersion !== "1.0.0" ||
      acoustic.sceneRevision !== frame.sceneRevision ||
      acoustic.poseTick !== frame.tick ||
      acoustic.listenerId !== listener.id
    )
      fail("ACOUSTIC_REFERENCE", "聲學 frame 的 revision／tick／listener 不符。");
    if (acoustic.stale || acoustic.pathAvailability === "failed")
      fail("ACOUSTIC_REFERENCE", "不可將 stale／failed 聲學結果當作有效 capture。");
    if (!Array.isArray(acoustic.paths)) fail("ACOUSTIC_REFERENCE", "聲學 path 資料無效。");
    for (const path of acoustic.paths) {
      if (
        path.id.length > 1024 ||
        !Number.isFinite(path.absoluteDelayS) ||
        path.absoluteDelayS < 0 ||
        path.bandGains.length !== acoustic.bandCentersHz.length ||
        path.bandGains.some((gain) => !Number.isFinite(gain) || gain < 0) ||
        path.sourceId !== acoustic.sourceId ||
        path.listenerId !== acoustic.listenerId
      )
        fail("ACOUSTIC_REFERENCE", "聲學 path 時間、gain、端點或 bands 無效。");
    }
  }
  if (!frame.acousticResultRefs.every((ref) => validId(ref)))
    fail("ARTIFACT_REFERENCE", "聲學 artifact 參照無效。");
  return newEvents;
}

export async function recordingFingerprints(
  configuration: RecordingConfiguration,
  frames: readonly RecordingFrame[],
  runId: string,
  fingerprintVersion?: RecordingFingerprintVersion,
): Promise<ComparisonRun> {
  return computeFingerprints(
    configuration,
    frames,
    runId,
    fingerprintVersion,
    fingerprintVersion === "content-and-cursors-v2"
      ? normalizeSourcePhase(configuration, frames)
      : undefined,
  );
}

async function computeFingerprints(
  configuration: RecordingConfiguration,
  frames: readonly RecordingFrame[],
  runId: string,
  fingerprintVersion: RecordingFingerprintVersion | undefined,
  sourcePhase: ReturnType<typeof normalizeSourcePhase> | undefined,
): Promise<ComparisonRun> {
  if (fingerprintVersion !== undefined && fingerprintVersion !== "content-and-cursors-v2")
    fail("FINGERPRINT_VERSION", "不支援此錄製指紋版本。");
  const scene = configuration.sceneSnapshot;
  const actualGeometry = scene.objects.map(
    ({ id, shape, dimensionsM, positionM, orientationQuaternion, acousticRole }) => ({
      id,
      shape,
      dimensionsM,
      positionM,
      orientationQuaternion,
      acousticRole,
    }),
  );
  const actualPhysics = {
    gravityMps2: scene.gravityMps2,
    seed: scene.seed,
    objects: scene.objects.map(
      ({ id, mode, massKg, friction, restitution, physicsMaterialId }) => ({
        id,
        mode,
        massKg,
        friction,
        restitution,
        physicsMaterialId,
      }),
    ),
  };
  const values = {
    sceneGeometryHash: {
      actualGeometry,
      configuration: configuration.geometrySnapshot,
      units: scene.units,
      coordinateSystem: scene.coordinateSystem,
    },
    physicsConfigHash: {
      actualPhysics,
      configuration: configuration.physicsConfig,
      fixedDtS: configuration.fixedDtS,
      version: configuration.physicsVersion,
    },
    motionTraceHash: frames.map((frame) => ({ tick: frame.tick, poses: frame.poses })),
    physicsEventTraceHash: frames.map((frame) => ({
      tick: frame.tick,
      events: frame.physicsEvents,
    })),
    listenerTraceHash: frames.map((frame) => ({ tick: frame.tick, listener: frame.listener })),
    solverConfigHash: {
      settings: configuration.solverConfig,
      backendId: configuration.backendId,
      backendVersion: configuration.backendVersion,
      sampleRateHz: configuration.sampleRateHz,
    },
    atmosphereHash: configuration.atmosphere,
    propagationMaterialHash: {
      registry: configuration.materialRegistry,
      bindings: scene.objects.map(({ id, acousticMaterialId }) => ({ id, acousticMaterialId })),
    },
    profileHash: configuration.behaviorConfig,
    assetManifestHash: configuration.assetManifest,
    generatorConfigHash: configuration.generatorConfig,
    sourceSignalHash:
      fingerprintVersion === "content-and-cursors-v2"
        ? {
            version: fingerprintVersion,
            sceneSources: scene.sources,
            configuration: configuration.sourceConfig,
            sourcePhase,
          }
        : { sceneSources: scene.sources, configuration: configuration.sourceConfig },
  };
  const hashes = await Promise.all(
    Object.entries(values).map(
      async ([key, value]) => [key, await sha256Canonical(value)] as const,
    ),
  );
  return { runId, ...Object.fromEntries(hashes) } as ComparisonRun;
}

function numberSetting(value: unknown, fallback: number, min: number, max: number): number {
  const result = value === undefined ? fallback : value;
  if (typeof result !== "number" || !Number.isFinite(result) || result < min || result > max)
    fail("SOLVER_SETTINGS", "實驗 solver settings 超出 schema 範圍。");
  return result;
}
async function createManifest(
  artifact: Omit<RecordingArtifact, "artifactSha256" | "manifest" | "manifestUnavailableReason">,
): Promise<{ manifest: ExperimentManifest | null; unavailableReason: string | null }> {
  const config = artifact.configuration;
  const solver = record(config.solverConfig) ? config.solverConfig : {};
  const atmosphere = record(config.atmosphere) ? config.atmosphere : {};
  if (atmosphere.medium === "vacuum")
    return { manifest: null, unavailableReason: "VACUUM_NOT_REPRESENTABLE_IN_EXPERIMENT_V1" };
  const observedSpeeds = artifact.frames.flatMap((frame) =>
    frame.acousticFrames.flatMap((acoustic) =>
      acoustic.paths
        .filter((path) => path.lengthM > 0 && path.absoluteDelayS > 0)
        .map((path) => path.lengthM / path.absoluteDelayS),
    ),
  );
  const configuredSpeed =
    typeof atmosphere.speedOfSoundMps === "number" ? atmosphere.speedOfSoundMps : undefined;
  const speed = configuredSpeed ?? observedSpeeds[0];
  if (speed === undefined)
    return { manifest: null, unavailableReason: "PROPAGATION_SPEED_UNRESOLVED" };
  if (
    !Number.isFinite(speed) ||
    observedSpeeds.some((observed) => Math.abs(observed - speed) > Math.max(1e-6, speed * 1e-9))
  )
    fail("SPEED_PROVENANCE", "Captured paths 與固定 atmosphere 聲速不一致。");
  if (speed < 250 || speed > 400)
    return { manifest: null, unavailableReason: "SPEED_RANGE_NOT_REPRESENTABLE_IN_EXPERIMENT_V1" };
  const maxReflectionOrder = numberSetting(solver.maxReflectionOrder, 1, 0, 2);
  if (!Number.isInteger(maxReflectionOrder))
    fail("SOLVER_SETTINGS", "Reflection order 必須為整數。");
  const manifest: ExperimentManifest = {
    schemaVersion: "1.0.0",
    experimentId: artifact.runId,
    createdAt: artifact.createdAt,
    sceneId: config.sceneSnapshot.sceneId,
    sceneRevision: config.sceneSnapshot.sceneRevision,
    sceneSha256: await sha256Canonical(config.sceneSnapshot),
    motionTraceSha256: artifact.fingerprints.motionTraceHash,
    contactTraceSha256: artifact.fingerprints.physicsEventTraceHash,
    materialRegistrySha256: await sha256Canonical(config.materialRegistry),
    backendId: config.backendId,
    backendVersion: config.backendVersion,
    physicsVersion: config.physicsVersion,
    solverSettings: {
      fixedDtS: config.fixedDtS,
      sampleRateHz: config.sampleRateHz,
      seed: config.sceneSnapshot.seed,
      speedOfSoundMps: speed,
      temperatureC: numberSetting(atmosphere.temperatureC, 20, -20, 50),
      relativeHumidityPercent: numberSetting(atmosphere.relativeHumidityPercent, 50, 0, 100),
      pressurePa: numberSetting(atmosphere.pressurePa, 101325, 80000, 110000),
      maxReflectionOrder,
    },
    recordingMode: "authoritativeMotionTrace",
    validationLevel: "V1",
    resultArtifacts: [
      {
        id: `${artifact.runId.slice(0, 55)}.events`,
        sha256: await sha256Canonical(
          artifact.frames.map((frame) => ({
            tick: frame.tick,
            decisions: frame.behaviorDecisions,
            audio: frame.audioEvents,
          })),
        ),
        kind: "events",
        evidenceClass: "Computed",
      },
      {
        id: `${artifact.runId.slice(0, 56)}.paths`,
        sha256: await sha256Canonical(
          artifact.frames.map((frame) => ({ tick: frame.tick, frames: frame.acousticFrames })),
        ),
        kind: "paths",
        evidenceClass: "Computed",
      },
    ],
  };
  return { manifest, unavailableReason: null };
}

export interface RecordingSealSnapshot {
  configuration: RecordingConfiguration;
  runId: string;
  runEpoch: string;
  createdAt: string;
  budget: typeof hardLimits;
  frames: RecordingFrame[];
  events: string[];
  state: RecorderState;
  reason: string | null;
  traceBytes: number;
}

export class ExperimentRecorder {
  private readonly configuration: RecordingConfiguration;
  private readonly runId: string;
  private readonly runEpoch: string;
  private readonly createdAt: string;
  private readonly budget: typeof hardLimits;
  private readonly frames: RecordingFrame[] = [];
  private readonly events = new Set<string>();
  private state: RecorderState = "recording";
  private reason: string | null = null;
  private traceBytes = 2;
  private finishResult: Promise<RecordingArtifact> | null = null;

  constructor(options: ExperimentRecorderOptions) {
    this.configuration = normalizeConfiguration(options);
    this.runId = options.runId;
    this.runEpoch = options.runEpoch ?? options.runId;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    if (!this.createdAt.endsWith("Z") || !Number.isFinite(Date.parse(this.createdAt)))
      fail("CREATED_AT", "建立時間必須是 UTC ISO8601。");
    this.budget = { ...hardLimits, ...options.budget };
    for (const key of Object.keys(hardLimits) as (keyof typeof hardLimits)[]) {
      const value = this.budget[key];
      if (!Number.isSafeInteger(value) || value < 1 || value > hardLimits[key])
        fail("RECORDING_BUDGET", "錄製預算必須是有效且有上限的整數。");
    }
    if (this.configuration.sceneSnapshot.objects.length > this.budget.maxObjects)
      fail("RECORDING_BUDGET", "物件數超過錄製預算。");
  }

  appendFrame(input: RecordingFrameInput): void {
    if (this.state !== "recording") fail("RECORDER_STATE", "只有 recording 狀態可以加入 frame。");
    const captured = immutableCloneWithByteLength({
      ...input,
      runEpoch: input.runEpoch ?? this.runEpoch,
      acousticFrames: input.acousticFrames ?? [],
      acousticResultRefs: input.acousticResultRefs ?? [],
    });
    const frame: RecordingFrame = captured.value;
    const eventIds = validateFrame(
      frame,
      this.configuration,
      this.runEpoch,
      this.frames.at(-1)?.tick ?? null,
      this.events,
    );
    const frameBytes = captured.byteLength + (this.frames.length > 0 ? 1 : 0);
    if (
      this.frames.length + 1 > this.budget.maxFrames ||
      this.traceBytes + frameBytes > this.budget.maxBytes ||
      this.events.size + eventIds.length > this.budget.maxEvents ||
      eventIds.length > this.budget.maxEventsPerFrame
    ) {
      this.interrupt("RECORDING_BUDGET");
      fail("RECORDING_BUDGET", "錄製預算耗盡；已保留不完整 trace，不標 Captured。");
    }
    this.frames.push(frame);
    this.traceBytes += frameBytes;
    for (const eventId of eventIds) this.events.add(eventId);
  }
  pause(): void {
    if (this.state === "recording") this.state = "paused";
  }
  resume(): void {
    if (this.state === "paused") this.state = "recording";
  }
  interrupt(reason: string): void {
    if (["recording", "paused"].includes(this.state)) {
      this.state = "interrupted";
      this.reason = reason.slice(0, 256);
    }
  }
  cancel(reason = "USER_CANCELLED"): void {
    if (["recording", "paused"].includes(this.state)) {
      this.state = "cancelled";
      this.reason = reason.slice(0, 256);
    }
  }
  getTelemetry(): RecorderTelemetry {
    return {
      state: this.state,
      frameCount: this.frames.length,
      eventCount: this.events.size,
      traceBytes: this.traceBytes,
      durationSeconds:
        this.frames.length < 2
          ? 0
          : (this.frames.at(-1)!.tick - this.frames[0]!.tick) * this.configuration.fixedDtS,
      reason: this.reason,
    };
  }
  captureSealSnapshot(): RecordingSealSnapshot {
    if (this.finishResult || this.state === "finalizing")
      fail("RECORDER_STATE", "錄製封存已開始。");
    return {
      configuration: this.configuration,
      runId: this.runId,
      runEpoch: this.runEpoch,
      createdAt: this.createdAt,
      budget: Object.freeze({ ...this.budget }),
      frames: this.frames.slice(),
      events: [...this.events],
      state: this.state,
      reason: this.reason,
      traceBytes: this.traceBytes,
    };
  }
  finish(
    processor?: (snapshot: RecordingSealSnapshot) => Promise<RecordingArtifact>,
  ): Promise<RecordingArtifact> {
    if (this.finishResult) return this.finishResult;
    const status: RecordingStatus =
      this.state === "cancelled"
        ? "cancelled"
        : this.state === "interrupted"
          ? "interrupted"
          : "captured";
    if (status === "captured" && this.frames.length === 0)
      return Promise.reject(
        new RecordingError("NO_FRAMES", "沒有 frame，不能建立 Captured manifest。"),
      );
    const snapshot = processor ? this.captureSealSnapshot() : null;
    this.state = "finalizing";
    const work = processor
      ? Promise.resolve()
          .then(() => processor(snapshot!))
          .then((artifact) => {
            this.state = status;
            return artifact;
          })
      : this.seal(status);
    this.finishResult = work.catch((error: unknown) => {
      this.state = "interrupted";
      this.reason = "SEAL_FAILED";
      throw error;
    });
    return this.finishResult;
  }
  private async seal(status: RecordingStatus): Promise<RecordingArtifact> {
    const sourcePhase = normalizeSourcePhase(this.configuration, this.frames);
    const body = {
      schemaVersion: "1.0.0" as const,
      fingerprintVersion: "content-and-cursors-v2" as const,
      sourcePhaseEvidence: sourcePhase.evidence,
      runId: this.runId,
      runEpoch: this.runEpoch,
      createdAt: this.createdAt,
      status,
      reason: this.reason,
      configuration: this.configuration,
      frames: immutableClone(this.frames),
      fingerprints: await computeFingerprints(
        this.configuration,
        this.frames,
        this.runId,
        "content-and-cursors-v2",
        sourcePhase,
      ),
      startTick: this.frames[0]?.tick ?? null,
      endTick: this.frames.at(-1)?.tick ?? null,
      frameCount: this.frames.length,
      eventCount: this.events.size,
      traceBytes: this.traceBytes,
      limitations: [
        "Authoritative motion/event replay; not fresh physics resimulation.",
        "V1 manifest/trace validation only; does not prove browser/audio/hearing or cross-platform equivalence.",
        "Source phase proof covers intended logical content and captured AudioEngine epoch cursors; never a hardware PCM read pointer.",
        "No RT60/DRR/C50 without a valid impulse response.",
      ],
    };
    const legacy =
      status === "captured"
        ? await createManifest(body)
        : { manifest: null, unavailableReason: "INCOMPLETE_RECORDING" };
    const sealed = {
      ...body,
      manifest: legacy.manifest,
      manifestUnavailableReason: legacy.unavailableReason,
    };
    const result = immutableClone({ ...sealed, artifactSha256: await sha256Canonical(sealed) });
    this.state = status;
    return result;
  }
}

export async function verifyRecording(artifact: RecordingArtifact): Promise<void> {
  if (
    !record(artifact) ||
    artifact.schemaVersion !== "1.0.0" ||
    !validId(artifact.runId) ||
    !Array.isArray(artifact.frames) ||
    artifact.frames.length > hardLimits.maxFrames ||
    canonicalBytes(artifact) > 70 * 1024 * 1024
  )
    fail("RECORDING_FORMAT", "錄製 artifact 格式或大小不符。");
  if (
    artifact.fingerprintVersion !== undefined &&
    artifact.fingerprintVersion !== "content-and-cursors-v2"
  )
    fail("FINGERPRINT_VERSION", "不支援此錄製指紋版本；不以 legacy 演算法猜測。");
  const { artifactSha256, ...body } = artifact;
  if ((await sha256Canonical(body)) !== artifactSha256)
    fail("ARTIFACT_HASH", "錄製 artifact hash 不符；拒絕重播。");
  const configuration = normalizeConfiguration({
    ...artifact.configuration,
    runId: artifact.runId,
    runEpoch: artifact.runEpoch,
  });
  const seen = new Set<string>();
  let previousTick: number | null = null;
  for (const frame of artifact.frames) {
    const events = validateFrame(frame, configuration, artifact.runEpoch, previousTick, seen);
    for (const event of events) seen.add(event);
    previousTick = frame.tick;
  }
  if (
    artifact.frameCount !== artifact.frames.length ||
    artifact.eventCount !== seen.size ||
    artifact.startTick !== (artifact.frames[0]?.tick ?? null) ||
    artifact.endTick !== (artifact.frames.at(-1)?.tick ?? null) ||
    artifact.traceBytes !== canonicalBytes(artifact.frames)
  )
    fail("RECORDING_COUNTER", "錄製 frame／event／byte／tick 計數不符。");
  const sourcePhase =
    artifact.fingerprintVersion === "content-and-cursors-v2"
      ? normalizeSourcePhase(configuration, artifact.frames)
      : undefined;
  const fingerprints = await computeFingerprints(
    configuration,
    artifact.frames,
    artifact.runId,
    artifact.fingerprintVersion,
    sourcePhase,
  );
  if ((await sha256Canonical(fingerprints)) !== (await sha256Canonical(artifact.fingerprints)))
    fail("TRACE_HASH", "錄製 trace 指紋不符。");
  if (
    artifact.fingerprintVersion === "content-and-cursors-v2" &&
    (!record(artifact.sourcePhaseEvidence) ||
      (await sha256Canonical(artifact.sourcePhaseEvidence)) !==
        (await sha256Canonical(sourcePhase!.evidence)))
  )
    fail("SOURCE_PHASE_EVIDENCE", "錄製的來源相位證據分類與實際 trace 不符。");
  if (artifact.status === "captured") {
    if (artifact.frames.length === 0) fail("RECORDING_FORMAT", "Captured 必須有完整 trace。");
    const expected = await createManifest({ ...body, configuration });
    if (
      (await sha256Canonical(expected.manifest)) !== (await sha256Canonical(artifact.manifest)) ||
      expected.unavailableReason !== artifact.manifestUnavailableReason
    )
      fail("MANIFEST_HASH", "Manifest 或不支援原因與錄製資料不符。");
  } else if (!["interrupted", "cancelled"].includes(artifact.status) || artifact.manifest !== null)
    fail("RECORDING_FORMAT", "不完整錄製不能帶 Captured manifest。");
}

/** Worker-only candidate: repeat the original sealing and independent verifier. */
export async function sealRecordingSnapshot(
  snapshot: RecordingSealSnapshot,
): Promise<{ artifact: RecordingArtifact; bytes: ArrayBuffer; encodedSha256: string }> {
  canonicalStringify(snapshot);
  const expected = [
    "budget",
    "configuration",
    "createdAt",
    "events",
    "frames",
    "reason",
    "runEpoch",
    "runId",
    "state",
    "traceBytes",
  ].sort();
  if (
    !record(snapshot) ||
    canonicalStringify(Object.keys(snapshot).sort()) !== canonicalStringify(expected) ||
    !Array.isArray(snapshot.frames) ||
    snapshot.frames.length > hardLimits.maxFrames ||
    !Array.isArray(snapshot.events) ||
    snapshot.events.length > hardLimits.maxEvents ||
    !Number.isSafeInteger(snapshot.traceBytes) ||
    snapshot.traceBytes < 2 ||
    snapshot.traceBytes > hardLimits.maxBytes ||
    !["recording", "paused", "interrupted", "cancelled"].includes(snapshot.state) ||
    (snapshot.reason !== null &&
      (typeof snapshot.reason !== "string" || snapshot.reason.length > 256)) ||
    ((snapshot.state === "interrupted" || snapshot.state === "cancelled") &&
      snapshot.reason === null) ||
    ((snapshot.state === "recording" || snapshot.state === "paused") && snapshot.reason !== null)
  )
    fail("RECORDING_FORMAT", "錄製封存快照格式或預算不符。");
  if (
    !record(snapshot.budget) ||
    canonicalStringify(Object.keys(snapshot.budget).sort()) !==
      canonicalStringify(Object.keys(hardLimits).sort())
  )
    fail("RECORDING_BUDGET", "錄製封存預算欄位不符。");
  const recorder = new ExperimentRecorder({
    ...snapshot.configuration,
    runId: snapshot.runId,
    runEpoch: snapshot.runEpoch,
    createdAt: snapshot.createdAt,
    budget: snapshot.budget,
  });
  if (
    canonicalStringify(recorder.captureSealSnapshot().configuration) !==
    canonicalStringify(snapshot.configuration)
  )
    fail("RECORDING_FORMAT", "錄製封存設定不符。");
  for (const frame of snapshot.frames) recorder.appendFrame(frame);
  const telemetry = recorder.getTelemetry();
  const actualEvents = new Set(recorder.captureSealSnapshot().events);
  if (
    telemetry.traceBytes !== snapshot.traceBytes ||
    telemetry.eventCount !== snapshot.events.length ||
    new Set(snapshot.events).size !== snapshot.events.length ||
    snapshot.events.some((id) => !actualEvents.has(id))
  )
    fail("RECORDING_COUNTER", "錄製封存快照計數不符。");
  if (snapshot.state === "paused") recorder.pause();
  else if (snapshot.state === "interrupted") recorder.interrupt(snapshot.reason ?? "");
  else if (snapshot.state === "cancelled") recorder.cancel(snapshot.reason ?? "");
  const artifact = await recorder.finish();
  const bytes = new TextEncoder().encode(canonicalStringify(artifact)).buffer;
  const candidate = JSON.parse(new TextDecoder().decode(bytes)) as RecordingArtifact;
  await verifyRecording(candidate);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const encodedSha256 = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return { artifact, bytes, encodedSha256 };
}
