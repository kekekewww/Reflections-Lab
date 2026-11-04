import test from "node:test";
import assert from "node:assert/strict";
import {
  behaviorAcousticSource,
  acousticEmitterMetadata,
} from "../../src/app/behavior-acoustic-source.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { prepareStaticPreview } from "../../src/app/static-preview.js";
import {
  createDefaultScene,
  makeBehaviorContext,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { solveAcoustics, SOLVER_VERSION } from "../../src/acoustics/index.js";
import {
  createProject,
  serializeProject,
  deserializeProject,
} from "../../src/persistence/index.js";
import { LabRuntime } from "../../src/app/runtime.js";
import { RecordingProcessor } from "../../src/app/recording-processor.js";
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import { reprocessRecording, verifyRecording } from "../../src/experiments/index.js";
import { document, rule, frame, object, options } from "../audio-behavior/fixtures.js";
import type { SpatialEmitter } from "../../schemas/sound-behavior/types.js";
import type { RecordingConfiguration } from "../../src/experiments/types.js";
import type { ReprocessConfiguration } from "../../src/experiments/reprocess.js";
const atmosphere = { medium: "air" as const, speedOfSoundMps: 343 };
function fixture(emitter: SpatialEmitter = { attachment: "zone", zoneId: "zone.detached" }) {
  const scene = createDefaultScene(),
    owner = scene.objects.find((o) => o.id === "speaker")!;
  scene.objects = [
    { ...owner, positionM: [0, 1, 0], dimensionsM: [0.5, 2, 2], acousticRole: "dynamicOccluder" },
  ];
  scene.sources = [];
  scene.listener.positionM = [2, 1, 0];
  scene.zones = [
    {
      id: "zone.detached",
      name: "Detached",
      enabled: true,
      centerM: [-2, 1, 0],
      shape: "sphere",
      radiusM: 0.5,
      hysteresisM: 0.02,
    },
  ];
  const doc = document([rule({ emitter })]);
  doc.bindings[0]!.objectId = "speaker";
  const poses = scene.objects.map((o) => ({
    objectId: o.id,
    positionM: o.positionM,
    orientationQuaternion: o.orientationQuaternion,
  }));
  const behavior = createBehaviorRuntime(
    doc,
    makeBehaviorContext(scene, [{ objectId: "speaker", generation: 1 }]),
    { ...options, fixedDtSeconds: 1 / 60 },
  );
  const input = frame(1, [], [object({ objectId: "speaker", positionMetres: [0, 1, 0] })]);
  input.sceneRevision = scene.sceneRevision;
  const output = behavior.step(input),
    emission = output.events[0]!;
  const config: RecordingConfiguration = {
    sceneSnapshot: scene,
    behaviorConfig: doc,
    sourceConfig: [],
    generatorConfig: [],
    solverConfig: { maxReflectionOrder: 1, maxPaths: 8 },
    atmosphere,
    materialRegistry: DEFAULT_MATERIALS,
    runId: "run.detached",
    runEpoch: "epoch.detached",
    physicsVersion: "Rapier detached reference",
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
  return { scene, doc, poses, emission, output, config };
}
test("detached metadata is projected from accepted rule without changing logical voice ownership or bytes", () => {
  for (const emitter of [
    { attachment: "zone", zoneId: "zone.detached" },
    { attachment: "fixed", positionMetres: [-2, 1, 0] },
  ] as SpatialEmitter[]) {
    const f = fixture(emitter),
      before = structuredClone(f.output);
    const source = behaviorAcousticSource(f.doc, f.emission);
    assert.equal(source.objectId, "speaker");
    assert.equal(source.id, f.emission.instanceId);
    assert.equal(source.emitterObjectId, null);
    assert.deepEqual(source.positionM, [-2, 1, 0]);
    assert.deepEqual(f.output, before);
    assert.equal(Object.hasOwn(f.output.voices[0]!, "emitterObjectId"), false);
    assert.equal(Object.hasOwn(f.emission, "emitterObjectId"), false);
  }
  const objectAttached = fixture({ attachment: "object", offsetMetres: [0, 0, 0] });
  assert.equal(
    Object.hasOwn(
      behaviorAcousticSource(objectAttached.doc, objectAttached.emission),
      "emitterObjectId",
    ),
    false,
  );
  assert.deepEqual(
    acousticEmitterMetadata({ attachment: "contact", aggregation: "representative" }),
    {},
  );
  assert.throws(
    () =>
      behaviorAcousticSource(objectAttached.doc, {
        ...objectAttached.emission,
        objectId: "wall.back",
      }),
    { code: "SOURCE_RULE_IDENTITY" },
  );
  assert.throws(
    () =>
      behaviorAcousticSource(objectAttached.doc, {
        ...objectAttached.emission,
        ruleId: "rule.unknown",
      }),
    { code: "SOURCE_RULE_IDENTITY" },
  );
});
test("a real solver retains the distant owner as an occluder for a detached source", () => {
  const f = fixture(),
    source = behaviorAcousticSource(f.doc, f.emission);
  const args = {
    scene: f.scene,
    poses: f.poses,
    listener: f.scene.listener,
    tick: 1,
    materials: DEFAULT_MATERIALS,
    atmosphere,
  };
  const detached = buildAcousticRequests({ ...args, sources: [source] })[0]!;
  assert.equal(detached.surfaces.length, 6);
  const blocked = solveAcoustics(detached);
  assert.equal(blocked.diagnostics.directOccluded, true);
  assert.equal(blocked.frame.paths.length, 0);
  const { emitterObjectId: _detached, ...legacy } = source;
  const legacyRequest = buildAcousticRequests({ ...args, sources: [legacy] })[0]!;
  assert.equal(legacyRequest.surfaces.length, 0);
  assert.equal(solveAcoustics(legacyRequest).diagnostics.directOccluded, false);
  assert.throws(
    () => buildAcousticRequests({ ...args, sources: [{ ...source, emitterObjectId: "missing" }] }),
    { code: "SOURCE_EMITTER_IDENTITY" },
  );
  const attached = fixture({ attachment: "object", offsetMetres: [0, 0, 0] });
  const request = buildAcousticRequests({
    ...args,
    sources: [behaviorAcousticSource(attached.doc, attached.emission)],
  })[0]!;
  assert.equal(request.surfaces.length, 0);
  assert.equal(solveAcoustics(request).diagnostics.directOccluded, false);
});
test("StaticPreview uses the same detached geometry policy for zone and fixed anchors", () => {
  for (const emitter of [
    { attachment: "zone", zoneId: "zone.detached" },
    { attachment: "fixed", positionMetres: [-2, 1, 0] },
  ] as SpatialEmitter[]) {
    const f = fixture(emitter);
    const plan = prepareStaticPreview(
      {
        state: "paused",
        scene: f.scene,
        document: f.doc,
        poses: f.poses,
        objectId: "speaker",
        generation: 1,
        bindingId: f.emission.bindingId,
        ruleId: f.emission.ruleId,
        tick: 1,
        listener: f.scene.listener,
        materials: DEFAULT_MATERIALS,
        atmosphere,
      },
      "preview.detached",
    );
    assert.equal(plan.solution.diagnostics.directOccluded, true);
    assert.equal(plan.metadata.objectId, "speaker");
    assert.deepEqual(plan.metadata.source.positionM, [-2, 1, 0]);
  }
});
test("real Live capture, same-motion reevaluation and ExperimentToolHost preserve owner occlusion for detached anchors", async () => {
  const f = fixture();
  const values = new Map<string, string>();
  const app = await LabRuntime.create({
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    },
    useWorker: false,
  });
  try {
    await app.importProject(
      serializeProject(
        createProject({
          projectId: "project.detached",
          name: "Detached",
          scene: f.scene,
          soundBehaviors: f.doc,
          assets: [],
        }),
      ),
    );
    await app.captureShortTake(3 / 60);
    const a = app.getRecordingArtifact()!;
    await verifyRecording(a);
    assert.ok(a.frames.length >= 3);
    const acoustic = a.frames.flatMap((frame) => frame.acousticFrames);
    assert.ok(acoustic.length > 0);
    assert.ok(acoustic.every((frame) => frame.paths.length === 0));
    assert.ok(
      a.frames
        .flatMap((frame) => frame.audioEvents)
        .every((event) => (event as { objectId: string }).objectId === "speaker"),
    );
    const processor = new RecordingProcessor({ getAssets: () => [] });
    const changes: ReprocessConfiguration = {
      runId: "run.detached-b",
      sceneSnapshot: a.configuration.sceneSnapshot,
      behaviorConfig: a.configuration.behaviorConfig,
      sourceConfig: a.configuration.sourceConfig,
      generatorConfig: a.configuration.generatorConfig,
      solverConfig: a.configuration.solverConfig,
      atmosphere: a.configuration.atmosphere,
      materialRegistry: a.configuration.materialRegistry,
    };
    const b = await reprocessRecording(a, changes, (frame) =>
      processor.process(frame, changes, a.configuration),
    );
    assert.ok(
      b.frames.flatMap((frame) => frame.acousticFrames).every((frame) => frame.paths.length === 0),
    );
    assert.equal(b.sourcePhaseEvidence?.evidenceClass, "logicalIntent");
  } finally {
    app.dispose();
  }
  const host = new ExperimentToolHost({ getConfiguration: () => f.config, getAssets: () => [] });
  const result = await host.execute({
    schemaVersion: "1.0.0",
    requestId: "request.detached",
    tool: "RunSimulation",
    sceneId: f.scene.sceneId,
    expectedSceneRevision: 0,
    transactionId: null,
    arguments: {
      backendId: "custom-web",
      durationS: 0.1,
      timeStepS: 1 / 60,
      seed: f.scene.seed,
      replayTraceId: null,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  });
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const run = host.getRun(result.runId!)!;
  assert.ok(run.frames.flatMap((frame) => frame.acousticFrames).length > 0);
  assert.ok(
    run.frames.flatMap((frame) => frame.acousticFrames).every((frame) => frame.paths.length === 0),
  );
});

test("Projects roundtrip explicit zone triggers and anchors, while missing references and absent IDs are refused", () => {
  const f = fixture();
  f.doc.profiles[0]!.rules.push(
    rule({
      ruleId: "rule.zone-enter",
      trigger: { kind: "discrete", type: "OnEnterZone", zoneId: "zone.detached" },
      oneShotDurationSeconds: 0.2,
    }),
  );
  const project = createProject({
    projectId: "project.zone-roundtrip",
    name: "Zones",
    scene: f.scene,
    soundBehaviors: f.doc,
    assets: [],
  });
  assert.deepEqual(deserializeProject(serializeProject(project)), project);
  const disabled = structuredClone(project);
  disabled.scene.zones![0]!.enabled = false;
  assert.deepEqual(deserializeProject(serializeProject(disabled)), disabled);
  const missing = structuredClone(project);
  missing.scene.zones = [];
  assert.throws(() => serializeProject(missing), { code: "BEHAVIOR_INVALID" });
  const absent = structuredClone(project);
  const trigger = absent.soundBehaviors.profiles[0]!.rules[1]!.trigger;
  if (trigger.kind !== "discrete") throw Error("fixture");
  delete trigger.zoneId;
  assert.throws(() => serializeProject(absent), { code: "BEHAVIOR_INVALID" });
});
