import type { AudioEvent, SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import type { NormalizedBehaviorEvent, VoiceIntent } from "../audio-behavior/types.js";
import { effectiveRule } from "../audio-behavior/profile-registry.js";
import { solveAcoustics } from "../acoustics/index.js";
import type { AcousticMaterial, AcousticSolution, Atmosphere, Vec3 } from "../acoustics/types.js";
import { AudioEngine } from "../audio/engine.js";
import type { AudioEngineOptions, VoiceInput } from "../audio/types.js";
import type { SceneListener, SceneSpec } from "../scene/types.js";
import { canonicalJson } from "../ai/validation.js";
import { buildAcousticRequests, type AcousticPose } from "./acoustic-input.js";

/** Host-captured accepted output and its real physics input, never a UI position projection. */
export interface CapturedPreviewContact {
  runId: string;
  runEpoch: string;
  sceneRevision: number;
  /** Exact accepted authoring snapshot, including binding overrides. */
  behaviorDocument: SoundBehaviorDocument;
  inputEvent: NormalizedBehaviorEvent;
  voice: VoiceIntent;
}

export interface StaticPreviewInput {
  state: "ready" | "paused" | "running" | "recording" | "replaying";
  scene: SceneSpec;
  document: SoundBehaviorDocument;
  poses: readonly AcousticPose[];
  objectId: string;
  generation: number;
  bindingId: string;
  ruleId: string;
  tick: number;
  listener: SceneListener;
  materials: readonly AcousticMaterial[];
  atmosphere: Atmosphere;
  contact?: CapturedPreviewContact;
  /** Emission window only; solver propagation and the renderer tail remain separate. */
  durationSeconds?: number;
}

export interface StaticPreviewMetadata {
  previewId: string;
  sceneId: string;
  sceneRevision: number;
  documentId: string;
  documentRevision: number;
  objectId: string;
  generation: number;
  bindingId: string;
  profileId: string;
  profileRevision: number;
  ruleId: string;
  poseTick: number;
  durationSeconds: number;
  emissionEpochSeconds: 0;
  excludedFromExperiment: true;
  source: { id: string; origin: "objectOffset" | "fixed" | "capturedContact"; positionM: Vec3 };
  listener: SceneListener;
  contact: {
    runId: string;
    runEpoch: string;
    inputEventId: string;
    audioEventId: string;
    tick: number;
    pairKey: string;
    episodeId: string;
    documentId: string;
    documentRevision: number;
  } | null;
  solver: {
    requestId: string;
    backendId: string;
    backendVersion: string;
    sceneRevision: number;
    geometryRevision: number;
    poseTick: number;
    capabilities: string[];
    pathCount: number;
    directDelaySeconds: number | null;
  };
  spatializationOwner: "AudioEngine.PathRoute; HRTF once in simulated monitoring";
  rendererBudget: { voices: 1; individualPaths: 8; lateSends: 1; totalPaths: 9 };
  limitations: string[];
}

export interface StaticPreviewPlan {
  metadata: StaticPreviewMetadata;
  voice: VoiceInput;
  listener: { positionM: Vec3; forward: Vec3; up: Vec3 };
  solution: AcousticSolution;
}

function fail(code: string): never {
  throw new Error(code);
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const finitePosition = (value: Vec3): boolean => value.length === 3 && value.every(Number.isFinite);

/** Pure static snapshot preparation. It does not evaluate triggers, advance clocks or write a run. */
export function prepareStaticPreview(
  input: StaticPreviewInput,
  previewId: string,
): StaticPreviewPlan {
  if (input.state !== "ready" && input.state !== "paused") fail("PREVIEW_REQUIRES_PAUSE");
  const duration = input.durationSeconds ?? 2;
  if (!Number.isFinite(duration) || duration < 0.02 || duration > 3) fail("PREVIEW_DURATION");
  const { scene, document } = input;
  const object = scene.objects.find((value) => value.id === input.objectId);
  const binding = document.bindings.find((value) => value.bindingId === input.bindingId);
  const profile = document.profiles.find((value) => value.profileId === binding?.profileId);
  const authoredRule = profile?.rules.find((value) => value.ruleId === input.ruleId);
  if (
    !object ||
    !binding ||
    !profile ||
    !authoredRule ||
    binding.objectId !== input.objectId ||
    binding.objectGeneration !== input.generation ||
    binding.profileRevision !== profile.revision
  )
    fail("PREVIEW_SELECTION_MISMATCH");
  const rule = effectiveRule(binding, authoredRule);
  const pose = input.poses.find((value) => value.objectId === input.objectId);
  if (!pose && object.mode !== "fixed") fail("PREVIEW_POSE_REQUIRED");
  let generator = structuredClone(rule.generator);
  let gain = rule.gainLinear;
  let pitch = rule.pitchSemitones;
  let filterCutoffHz: number | undefined;
  let position: Vec3;
  let origin: StaticPreviewMetadata["source"]["origin"];
  let contact: StaticPreviewMetadata["contact"] = null;
  if (rule.emitter.attachment === "contact") {
    const captured = input.contact;
    if (!captured) fail("CONTACT_EVENT_REQUIRED");
    const event: AudioEvent = captured.voice.event;
    const normalized = captured.inputEvent;
    const data = event.contact;
    const override = profile.materialPairOverrides.find(
      (value) =>
        value.ruleId === rule.ruleId &&
        data &&
        ((value.materialA === data.materialA && value.materialB === data.materialB) ||
          (value.materialA === data.materialB && value.materialB === data.materialA)),
    );
    if (
      !data ||
      !normalized.contact ||
      !normalized.accepted ||
      normalized.source !== "physics" ||
      normalized.type !== rule.trigger.type ||
      normalized.tick !== event.tick ||
      normalized.objectId !== input.objectId ||
      normalized.generation !== input.generation ||
      !captured.runId ||
      !captured.runEpoch ||
      captured.runEpoch !== event.runEpoch ||
      captured.sceneRevision !== scene.sceneRevision ||
      captured.behaviorDocument.documentId !== document.documentId ||
      captured.behaviorDocument.revision !== document.revision ||
      canonicalJson(captured.behaviorDocument) !== canonicalJson(document) ||
      event.sceneRevision !== scene.sceneRevision ||
      event.objectId !== input.objectId ||
      event.generation !== input.generation ||
      event.bindingId !== binding.bindingId ||
      event.profileId !== profile.profileId ||
      event.profileRevision !== profile.revision ||
      event.ruleId !== rule.ruleId ||
      event.parentPhysicsEventId !== normalized.eventId ||
      event.action !== "start" ||
      captured.voice.action !== "start" ||
      !same(event.trigger, rule.trigger) ||
      !same(data, normalized.contact) ||
      !same(event.positionMetres, data.pointWorldMetres) ||
      !same(captured.voice.generator, override?.generator ?? rule.generator) ||
      ![data.objectA, data.objectB].includes(input.objectId) ||
      !finitePosition(data.pointWorldMetres)
    )
      fail("CONTACT_PROVENANCE_MISMATCH");
    position = [...data.pointWorldMetres];
    origin = "capturedContact";
    generator = structuredClone(captured.voice.generator);
    gain = event.gainLinear;
    pitch = event.pitchSemitones;
    filterCutoffHz = captured.voice.filterCutoffHz;
    contact = {
      runId: captured.runId,
      runEpoch: captured.runEpoch,
      inputEventId: normalized.eventId,
      audioEventId: event.eventId,
      tick: event.tick,
      pairKey: data.pairKey,
      episodeId: data.episodeId,
      documentId: captured.behaviorDocument.documentId,
      documentRevision: captured.behaviorDocument.revision,
    };
  } else {
    if (rule.mappings.length) fail("MAPPING_INPUT_UNAVAILABLE");
    if (rule.emitter.attachment === "object") {
      const base = pose
        ? "positionMetres" in pose
          ? pose.positionMetres
          : pose.positionM
        : object.positionM;
      const [x, y, z, w] = pose
        ? "rotation" in pose
          ? pose.rotation
          : pose.orientationQuaternion
        : object.orientationQuaternion;
      const [ox, oy, oz] = rule.emitter.offsetMetres;
      // Quaternion-vector rotation, matching the Behavior object-anchor convention.
      const tx = 2 * (y * oz - z * oy),
        ty = 2 * (z * ox - x * oz),
        tz = 2 * (x * oy - y * ox);
      position = [
        base[0] + ox + w * tx + y * tz - z * ty,
        base[1] + oy + w * ty + z * tx - x * tz,
        base[2] + oz + w * tz + x * ty - y * tx,
      ];
      origin = "objectOffset";
    } else if (rule.emitter.attachment === "fixed") {
      position = [...rule.emitter.positionMetres];
      origin = "fixed";
    } else fail("EMITTER_UNSUPPORTED");
  }
  const sourceId = `${previewId}.source`;
  const request = buildAcousticRequests({
    scene,
    poses: input.poses,
    sources: [{ id: sourceId, objectId: input.objectId, positionM: position }],
    listener: input.listener,
    tick: input.tick,
    materials: input.materials,
    atmosphere: input.atmosphere,
    budget: { maxPaths: 8, maxSurfaces: 256, maxSegmentTests: 10000 },
  })[0]!;
  const solution = solveAcoustics(request);
  if (solution.frame.pathAvailability !== "available" || solution.frame.stale)
    fail("PREVIEW_ACOUSTICS_UNAVAILABLE");
  const emissionDuration = Math.min(
    duration,
    rule.oneShotDurationSeconds ?? duration,
    rule.lifecycle?.maxDurationSeconds ?? duration,
  );
  const [x, y, z, w] = input.listener.orientationQuaternion;
  const frame = solution.frame;
  return {
    voice: {
      instanceId: `${previewId}.voice`,
      sourceId,
      generator,
      gainLinear: gain,
      pitchSemitones: pitch,
      emissionTimeSeconds: 0,
      continuous: false,
      fadeInSeconds: Math.min(rule.fadeInSeconds, 0.1),
      fadeOutSeconds: Math.min(rule.fadeOutSeconds, 0.1),
      durationSeconds: emissionDuration,
      priority: rule.priority,
      ...(filterCutoffHz === undefined ? {} : { filterCutoffHz }),
    },
    listener: {
      positionM: [...input.listener.positionM],
      forward: [-2 * (x * z + w * y), -2 * (y * z - w * x), 2 * (x * x + y * y) - 1],
      up: [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)],
    },
    solution,
    metadata: {
      previewId,
      sceneId: scene.sceneId,
      sceneRevision: scene.sceneRevision,
      documentId: document.documentId,
      documentRevision: document.revision,
      objectId: input.objectId,
      generation: input.generation,
      bindingId: binding.bindingId,
      profileId: profile.profileId,
      profileRevision: profile.revision,
      ruleId: rule.ruleId,
      poseTick: input.tick,
      durationSeconds: emissionDuration,
      emissionEpochSeconds: 0,
      excludedFromExperiment: true,
      source: { id: sourceId, origin, positionM: [...position] },
      listener: structuredClone(input.listener),
      contact,
      solver: {
        requestId: frame.requestId,
        backendId: frame.backendId,
        backendVersion: frame.backendVersion,
        sceneRevision: frame.sceneRevision,
        geometryRevision: frame.geometryRevision,
        poseTick: frame.poseTick,
        capabilities: [...frame.capabilities],
        pathCount: frame.paths.length,
        directDelaySeconds: frame.directDelayS,
      },
      spatializationOwner: "AudioEngine.PathRoute; HRTF once in simulated monitoring",
      rendererBudget: { voices: 1, individualPaths: 8, lateSends: 1, totalPaths: 9 },
      limitations: [
        "STATIC_PREVIEW; excluded from original run, recording and metrics",
        "Explicit rule preview; trigger and conditions are not evaluated",
        ...(contact
          ? [
              "Captured contact and accepted content parameters; current supplied static geometry/listener snapshot",
            ]
          : []),
        "Emission duration and fades are bounded for preview",
        ...frame.limitations,
      ],
    },
  };
}

export interface StaticPreviewView {
  status: "idle" | "starting" | "playing" | "stopped" | "error";
  metadata: StaticPreviewMetadata | null;
  monitorMode: "raw" | "simulated";
  muted: boolean;
  monitorGain: number;
  error: string | null;
}
export interface StaticPreviewHostOptions {
  getEngine: () => AudioEngine | null;
  createEngine?: (options: AudioEngineOptions) => AudioEngine;
  onChanged?: () => void;
}

/** One independent bounded preview. Native render callbacks never change the original run. */
export class StaticPreviewHost {
  private engine: AudioEngine | null = null;
  private retiring: AudioEngine | null = null;
  private serial = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private view: StaticPreviewView = {
    status: "idle",
    metadata: null,
    monitorMode: "simulated",
    muted: true,
    monitorGain: 0,
    error: null,
  };
  constructor(private readonly options: StaticPreviewHostOptions) {}

  getView(): StaticPreviewView {
    return structuredClone(this.view);
  }

  syncMonitor(): void {
    const monitor = this.options.getEngine()?.getTelemetry();
    if (!monitor) return;
    this.engine?.setMuted(monitor.muted);
    this.engine?.setMonitorGain(monitor.monitorGain);
    this.engine?.setMonitorMode(monitor.monitorMode);
    this.view.monitorMode = monitor.monitorMode;
    this.view.muted = monitor.muted;
    this.view.monitorGain = monitor.monitorGain;
  }

  async start(input: StaticPreviewInput): Promise<StaticPreviewView | null> {
    if (this.disposed) fail("PREVIEW_DISPOSED");
    const plan = prepareStaticPreview(input, `preview.${crypto.randomUUID()}`);
    const source = this.options.getEngine();
    if (!source) fail("AUDIO_NOT_ENABLED");
    this.stop();
    const serial = this.serial;
    const engine = (this.options.createEngine ?? ((options) => new AudioEngine(options)))({
      budget: {
        maxVoices: 1,
        maxSources: 1,
        maxSourceFrames: 1,
        maxPathsPerVoice: 8,
        maxTotalPaths: 9,
        maxLateSends: 1,
      },
      monitorGain: source.getTelemetry().monitorGain,
      spatializationModel: "HRTF",
    });
    this.engine = engine;
    this.view = { ...this.view, status: "starting", metadata: plan.metadata, error: null };
    // Activate the independent device context synchronously from the explicit UI action.
    const enabling = engine.enable(0);
    this.syncMonitor();
    this.options.onChanged?.();
    try {
      await enabling;
      if (this.disposed || serial !== this.serial || this.engine !== engine) return null;
      if (plan.voice.generator.kind === "sample") {
        const reference = plan.voice.generator.asset;
        const descriptor = source
          .getAssets()
          .find(
            (value) =>
              value.assetId === reference.assetId &&
              value.revision === reference.revision &&
              value.sha256 === reference.sha256,
          );
        const buffer = descriptor && source.getAssetBuffer(reference.assetId);
        if (!descriptor || !buffer) fail("ASSET_NOT_READY");
        engine.registerBuffer(reference.assetId, buffer, {
          name: descriptor.name,
          origin: descriptor.origin,
          license: descriptor.license,
          revision: descriptor.revision,
          sha256: reference.sha256,
        });
      }
      const reverb = source.getTelemetry().lateReverb;
      if (reverb.enabled) engine.setLateReverb(reverb);
      engine.updateListener(plan.listener);
      engine.setEpoch(0);
      const admission = engine.playVoice(plan.voice, plan.solution.frame);
      if (!admission.accepted) fail(admission.reason ?? "PREVIEW_ADMISSION_FAILED");
      this.syncMonitor();
      this.view.status = "playing";
      const maximumDelay = Math.max(
        0,
        ...plan.solution.frame.paths.map((path) => path.absoluteDelayS),
      );
      const tail = reverb.enabled ? reverb.decaySeconds : 0;
      this.timer = setTimeout(
        () => {
          if (serial === this.serial) this.stop();
        },
        ((plan.voice.durationSeconds ?? 2) + maximumDelay + tail + 0.15) * 1000,
      );
      this.options.onChanged?.();
      return this.getView();
    } catch (error) {
      if (serial !== this.serial || this.disposed) return null;
      this.stop();
      this.view.status = "error";
      this.view.error = error instanceof Error ? error.message : String(error);
      this.options.onChanged?.();
      throw error;
    }
  }

  stop(): Promise<void> {
    ++this.serial;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const engine = this.engine;
    this.engine = null;
    // At most one fading engine may remain even during rapid start/stop gestures.
    this.retiring?.dispose();
    this.retiring = null;
    let completion = Promise.resolve();
    if (engine) {
      engine.setMuted(true);
      this.retiring = engine;
      completion = engine.drainVoices().finally(() => {
        engine.dispose();
        if (this.retiring === engine) this.retiring = null;
      });
    }
    if (this.view.status !== "idle") this.view.status = "stopped";
    this.options.onChanged?.();
    return completion;
  }

  dispose(): void {
    this.stop();
    this.retiring?.dispose();
    this.retiring = null;
    this.disposed = true;
  }
}
