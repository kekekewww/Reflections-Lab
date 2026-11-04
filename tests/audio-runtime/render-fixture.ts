import { emitterGeometryPolicyPin } from "../../src/capabilities/emitter-geometry-policy.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { solveAcoustics, SOLVER_VERSION } from "../../src/acoustics/index.js";
import { acousticSceneSolverVersion } from "../../src/capabilities/acoustic-geometry.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import type {
  BehaviorAsset,
  BehaviorFrame,
  BehaviorSnapshot,
} from "../../src/audio-behavior/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { VoiceCursor } from "../../src/audio/types.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import {
  createDefaultBehaviors,
  createDefaultScene,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import { ExperimentRecorder } from "../../src/experiments/index.js";
import type { RecordingArtifact, RecordingFrame } from "../../src/experiments/types.js";

export interface RenderRecordingFixtureOptions {
  /** Inclusive captured tick range. Earlier ticks are evaluated to preserve source history. */
  start?: number;
  /** Rebuild only retained planar requests to exercise immutable pre-curved-model playback. */
  legacyPlanarOnly?: boolean;
  end?: number;
  /** Explicit finite long-native validation only; default fixture cap remains 600 ticks. */
  allowLongTake?: boolean;
  /** Finite specialized scene; all retained objects still appear in every recorded frame. */
  editScene?(scene: SceneSpec): void;
  /** The default creates an independent ball one-shot alongside the continuous speaker. */
  grabTick?: number | null;
  runId?: string;
  sampleRateHz?: 44100 | 48000;
  assets?: readonly BehaviorAsset[];
  /** Optional exact source-model pin; absent retains the legacy generator array. */
  audioContentModel?: unknown;
  editDocument?(document: SoundBehaviorDocument): void;
  editInput?(input: BehaviorFrame): void;
  editFrame?(frame: RecordingFrame): void;
  /**
   * Optional real AudioEngine cursor observation. The fixture never derives or invents
   * a native cursor from logical age. A caller using this hook owns its audio clock.
   */
  captureCursors?(
    snapshot: BehaviorSnapshot,
    stage: "before" | "after",
    tick: number,
  ): Record<string, VoiceCursor>;
}

const FIXED_DT_SECONDS = 1 / 60;
const ATMOSPHERE = { medium: "air" as const, speedOfSoundMps: 343 };

/**
 * Browser-safe, original fixture: real Behavior evaluation and finite geometric solves,
 * followed by the production recorder. No node:test, fake AudioContext or hardware is
 * imported. The default evidence is logicalIntent, never a claim of captured PCM.
 *
 * Sample fixtures must supply their actual trusted asset pins/decoded duration in
 * options.assets and configure a matching rule with editDocument. PCM remains owned by
 * the test's AudioEngine bank; this helper does not substitute generated sample data.
 */
export async function createRenderRecordingFixture(
  options: RenderRecordingFixtureOptions = {},
): Promise<RecordingArtifact> {
  const start = options.start ?? 1;
  const end = options.end ?? 12;
  const grabTick = options.grabTick === undefined ? 2 : options.grabTick;
  const maximumTick = options.allowLongTake ? 3601 : 600;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 1 ||
    end < start ||
    end > maximumTick ||
    (grabTick !== null && (!Number.isSafeInteger(grabTick) || grabTick < 1 || grabTick > end))
  )
    throw new RangeError(
      `Render fixture requires 1 <= start <= end <= ${maximumTick} and a valid grab tick`,
    );

  const scene = createDefaultScene();
  options.editScene?.(scene);
  const document = createDefaultBehaviors(scene);
  options.editDocument?.(document);
  const assets = structuredClone([...(options.assets ?? [])]);
  const runId = options.runId ?? "run.render-fixture";
  const runEpoch = "epoch.render-fixture";
  const objects: BehaviorFrame["objects"] = scene.objects.map((object) => ({
    objectId: object.id,
    generation: 1,
    lifecycle: "active",
    positionMetres: [...object.positionM],
    rotation: [...object.orientationQuaternion],
    states: {
      moving: false,
      airborne: false,
      held: false,
      sleeping: false,
      rolling: false,
      sliding: false,
      spinning: false,
    },
    metrics: { sourceSpeedMetresPerSecond: 0, angularSpeedRadiansPerSecond: 0 },
  }));
  const runtime = createBehaviorRuntime(document, makeBehaviorContext(scene, objects, assets), {
    experimentId: runId,
    runEpoch,
    fixedDtSeconds: FIXED_DT_SECONDS,
    maxVoices: 16,
    randomSeed: scene.seed,
  });
  const recorder = new ExperimentRecorder({
    runId,
    runEpoch,
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: document,
    generatorConfig:
      options.audioContentModel === undefined
        ? document.profiles.map((profile) => profile.rules.map((rule) => rule.generator))
        : {
            audioContentModel: options.audioContentModel,
            profiles: document.profiles.map((profile) =>
              profile.rules.map((rule) => rule.generator),
            ),
          },
    solverConfig: {
      backendId: "custom-web-geometric",
      maxReflectionOrder: 1,
      maxPaths: 8,
      ...(options.legacyPlanarOnly ? {} : emitterGeometryPolicyPin()),
    },
    atmosphere: ATMOSPHERE,
    materialRegistry: DEFAULT_MATERIALS,
    assetManifest: assets,
    physicsConfig: { fixedDtS: FIXED_DT_SECONDS, gravityMps2: scene.gravityMps2 },
    geometrySnapshot: {},
    physicsVersion: "original-render-fixture-no-resimulation",
    backendId: "custom-web-geometric",
    backendVersion: options.legacyPlanarOnly ? SOLVER_VERSION : acousticSceneSolverVersion(scene),
    fixedDtS: FIXED_DT_SECONDS,
    sampleRateHz: options.sampleRateHz ?? 48000,
    createdAt: "2026-11-02T00:00:00.000Z",
  });

  for (let tick = 1; tick <= end; tick++) {
    const inputFrame: BehaviorFrame = {
      tick,
      sceneRevision: scene.sceneRevision,
      runEpoch,
      objects: structuredClone(objects),
      events:
        tick === grabTick
          ? [
              {
                eventId: `input.render-grab.${tick}`,
                tick,
                sequence: 1,
                objectId: "ball",
                generation: 1,
                type: "OnGrab",
                source: "interaction",
                accepted: true,
                commandId: `command.render-grab.${tick}`,
              },
            ]
          : [],
    };
    options.editInput?.(inputFrame);
    const preStepSnapshot = runtime.snapshot();
    const preStepVoiceCursors = options.captureCursors?.(preStepSnapshot, "before", tick);
    const result = runtime.step(inputFrame);
    const runtimeSnapshot = runtime.snapshot();
    const voiceCursors = options.captureCursors?.(runtimeSnapshot, "after", tick);
    const sources = new Map(
      runtimeSnapshot.state.instances.map((instance) => [
        instance.instanceId,
        {
          id: instance.instanceId,
          objectId: instance.objectId,
          positionM: instance.positionMetres,
        },
      ]),
    );
    for (const event of result.events)
      sources.set(event.instanceId, {
        id: event.instanceId,
        objectId: event.objectId,
        positionM: event.positionMetres,
      });
    const poses = inputFrame.objects.map((object) => ({
      objectId: object.objectId,
      positionM: object.positionMetres,
      orientationQuaternion: object.rotation!,
    }));
    const acousticFrames = buildAcousticRequests({
      scene,
      poses,
      sources: [...sources.values()],
      listener: scene.listener,
      tick,
      materials: DEFAULT_MATERIALS,
      atmosphere: ATMOSPHERE,
    }).map((request) => {
      if (!options.legacyPlanarOnly) return solveAcoustics(request).frame;
      if (request.boxOccluders?.length)
        throw new RangeError("Legacy fixture cannot reinterpret compacted occluders");
      const {
        primitives: _primitives,
        boxOccluders: _boxes,
        modelVersion: _model,
        ...legacy
      } = request;
      return solveAcoustics({
        ...legacy,
        surfaces: legacy.surfaces.map((surface) =>
          surface.role === "dynamicReflector"
            ? { ...surface, role: "dynamicOccluder" as const }
            : surface,
        ),
      }).frame;
    });
    const behaviorSnapshot: RecordedBehaviorSnapshot = {
      inputFrame,
      preStepSnapshot,
      runtimeSnapshot,
      voiceIntents: result.voices,
      ...(preStepVoiceCursors === undefined ? {} : { preStepVoiceCursors }),
      ...(voiceCursors === undefined ? {} : { voiceCursors }),
      ...(options.captureCursors
        ? {
            cursorModel:
              "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer" as const,
          }
        : {}),
    };
    const frame: RecordingFrame = {
      tick,
      sceneRevision: inputFrame.sceneRevision,
      runEpoch,
      poses,
      listener: structuredClone(scene.listener),
      physicsEvents: inputFrame.events,
      behaviorDecisions: result.decisions,
      audioEvents: result.events,
      acousticFrames,
      acousticResultRefs: acousticFrames.map((acoustic) => acoustic.requestId),
      behaviorSnapshot,
    };
    options.editFrame?.(frame);
    if (tick >= start) recorder.appendFrame(frame);
  }
  return recorder.finish();
}
