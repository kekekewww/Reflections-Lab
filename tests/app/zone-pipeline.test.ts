import { acousticSceneSolverVersion } from "../../src/capabilities/acoustic-geometry.js";
import { emitterGeometryPolicyPin } from "../../src/capabilities/emitter-geometry-policy.js";
import { Worker } from "node:worker_threads";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultScene,
  makeBehaviorContext,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { toBehaviorFrame } from "../../src/app/physics-behavior.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { createProfileRegistry } from "../../src/audio-behavior/profile-registry.js";
import {
  ExperimentRecorder,
  MotionReplay,
  recordingFingerprints,
  verifyRecording,
  reprocessRecording,
} from "../../src/experiments/index.js";
import { normalizeSourcePhase } from "../../src/experiments/source-phase.js";
import { RecordingProcessor } from "../../src/app/recording-processor.js";
import { RecordingEvaluationClient } from "../../src/app/recording-evaluation-client.js";
import { replayEventViews } from "../../src/app/replay-view.js";
import { OfflineSoundPlanner } from "../../src/ai/offline-sound-planner.js";
import { document, rule } from "../audio-behavior/fixtures.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import type { SceneSpec, SceneZone } from "../../src/scene/types.js";
import type { RecordingArtifact, RecordingFrame } from "../../src/experiments/types.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import type { ReprocessConfiguration } from "../../src/experiments/reprocess.js";
const zone: SceneZone = {
  id: "zone.crossing",
  name: "Crossing",
  enabled: true,
  shape: "aabb",
  centerM: [0, 1, 0],
  halfExtentsM: [0.5, 0.5, 0.5],
  hysteresisM: 0.05,
};
function fixture(): { scene: SceneSpec; doc: SoundBehaviorDocument } {
  const scene = createDefaultScene();
  const ball = scene.objects.find((o) => o.id === "ball")!;
  scene.objects = [{ ...ball, mode: "dynamicNoGravity", positionM: [-1.5, 1, 0] }];
  scene.sources = [];
  scene.zones = [zone, { ...zone, id: "zone.other", centerM: [10, 1, 0] }];
  const doc = document([
    rule({
      ruleId: "rule.zone",
      trigger: { kind: "discrete", type: "OnEnterZone", zoneId: zone.id },
      oneShotDurationSeconds: 0.2,
    }),
  ]);
  doc.bindings[0]!.objectId = "ball";
  return { scene, doc };
}
async function capture(): Promise<RecordingArtifact> {
  const { scene, doc } = fixture();
  const world = await PhysicsWorld.create(scene);
  const behavior = createBehaviorRuntime(doc, makeBehaviorContext(scene, world.snapshot().poses), {
    experimentId: "run.zone-a",
    runEpoch: "epoch.zone-a",
    maxVoices: 16,
    maxVoicesPerObject: 8,
  });
  const recorder = new ExperimentRecorder({
    sceneSnapshot: scene,
    behaviorConfig: doc,
    sourceConfig: [],
    generatorConfig: [],
    solverConfig: { maxReflectionOrder: 1, maxPaths: 8, ...emitterGeometryPolicyPin() },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: DEFAULT_MATERIALS,
    runId: "run.zone-a",
    runEpoch: "epoch.zone-a",
    physicsVersion: "Rapier-Zone-reference",
    backendId: "custom-web-geometric",
    backendVersion: acousticSceneSolverVersion(scene),
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  });
  try {
    world.setVelocity("ball", [2, 0, 0]);
    world.resume();
    for (let i = 0; i < 85; i++) {
      const snapshot = world.step(),
        input = toBehaviorFrame(snapshot, "epoch.zone-a"),
        preStepSnapshot = behavior.snapshot(),
        output = behavior.step(input);
      recorder.appendFrame({
        tick: snapshot.tick,
        sceneRevision: scene.sceneRevision,
        runEpoch: "epoch.zone-a",
        poses: snapshot.poses.map((p) => ({
          objectId: p.objectId,
          positionM: p.positionMetres,
          orientationQuaternion: p.rotation,
          linearVelocityMps: p.linearVelocityMetresPerSecond,
          angularVelocityRadps: p.angularVelocityRadiansPerSecond,
          sleeping: p.sleeping,
        })),
        listener: scene.listener,
        physicsEvents: snapshot.events,
        behaviorDecisions: output.decisions,
        audioEvents: output.events,
        acousticFrames: [],
        acousticResultRefs: [],
        behaviorSnapshot: {
          inputFrame: input,
          preStepSnapshot,
          runtimeSnapshot: behavior.snapshot(),
          voiceIntents: output.voices,
        },
      });
    }
    return await recorder.finish();
  } finally {
    world.dispose();
  }
}
const changes = (a: RecordingArtifact): ReprocessConfiguration => ({
  runId: "run.zone-b",
  sceneSnapshot: a.configuration.sceneSnapshot,
  behaviorConfig: a.configuration.behaviorConfig,
  sourceConfig: a.configuration.sourceConfig,
  solverConfig: a.configuration.solverConfig,
  atmosphere: a.configuration.atmosphere,
  materialRegistry: a.configuration.materialRegistry,
  assetManifest: a.configuration.assetManifest,
  generatorConfig: a.configuration.generatorConfig,
});
let sharedCapture: Promise<RecordingArtifact> | undefined;
const captured = () => (sharedCapture ??= capture());
test("Zone source context and explicit trigger prevent cross-zone or forged producer events", () => {
  const { scene, doc } = fixture();
  const context = makeBehaviorContext(scene, [{ objectId: "ball", generation: 1 }]);
  assert.deepEqual(context.zoneIds, ["zone.crossing", "zone.other"]);
  assert.deepEqual(context.zonePositions?.[zone.id], [0, 1, 0]);
  createProfileRegistry(doc, context);
  const invalid = structuredClone(doc);
  invalid.profiles[0]!.rules[0]!.trigger = {
    kind: "discrete",
    type: "OnEnterZone",
    zoneId: "zone.missing",
  };
  assert.throws(() => createProfileRegistry(invalid, context));
  const absent = structuredClone(doc);
  absent.profiles[0]!.rules[0]!.trigger = { kind: "discrete", type: "OnEnterZone" };
  assert.throws(() => createProfileRegistry(absent, context));
  const planner = new OfflineSoundPlanner();
  assert.throws(() =>
    planner.plan("進入區域時發出聲音", {
      sceneId: scene.sceneId,
      sceneRevision: scene.sceneRevision,
      document: doc,
      context,
    }),
  );
  const plan = planner.plan("進入區域zone.crossing時發出聲音", {
    sceneId: scene.sceneId,
    sceneRevision: scene.sceneRevision,
    document: doc,
    context,
  });
  assert.ok(plan.proposal.operations.length);
});
test("real Zone trace records, serializes, verifies and replays without re-running producer", async () => {
  const a = await captured();
  assert.notEqual(
    a.sourcePhaseEvidence?.evidenceClass,
    "missing",
    a.sourcePhaseEvidence?.reason ?? "",
  );
  await verifyRecording(JSON.parse(JSON.stringify(a)));
  const raw = a.frames
    .flatMap((f) => f.physicsEvents)
    .filter(
      (e): e is { type: string; zoneId: string } =>
        typeof e === "object" && e !== null && "zoneId" in e,
    );
  assert.deepEqual(
    raw.map((e) => [e.type, e.zoneId]),
    [
      ["OnEnterZone", zone.id],
      ["OnExitZone", zone.id],
    ],
  );
  const starts = a.frames
    .flatMap((f) => f.audioEvents)
    .filter(
      (e): e is { trigger: { zoneId: string }; action: string; positionMetres: number[] } =>
        typeof e === "object" &&
        e !== null &&
        "action" in e &&
        (e as { action: string }).action === "start",
    );
  assert.equal(starts.length, 1);
  assert.equal(starts[0]!.trigger.zoneId, zone.id);
  assert.notDeepEqual(
    starts[0]!.positionMetres,
    zone.centerM,
    "object emitter must stay at actual moving object position",
  );
  const replay = await MotionReplay.create(a);
  const events: unknown[] = [];
  for (let frame = replay.next(); frame; frame = replay.next()) events.push(...frame.physicsEvents);
  assert.deepEqual(
    events,
    a.frames.flatMap((f) => f.physicsEvents),
  );
  assert.ok(replayEventViews(a).some((e) => e.detail?.includes("Zone " + zone.id)));
});
test("changing normalized zoneId is detected against raw producer provenance", async () => {
  const a = await captured(),
    frames = structuredClone(a.frames) as RecordingFrame[];
  const containing = frames.find((f) =>
    (f.physicsEvents as { zoneId?: string }[]).some((e) => e.zoneId),
  );
  const snapshot = containing!.behaviorSnapshot as RecordedBehaviorSnapshot;
  snapshot.inputFrame.events.find((e) => e.zoneId)!.zoneId = "zone.other";
  const normalized = normalizeSourcePhase(a.configuration, frames);
  assert.equal(normalized.evidence.evidenceClass, "missing");
  assert.equal(normalized.evidence.reason, "SOURCE_INPUT_EVENTS_MISMATCH");
});
test("Zone registry affects physics producer fingerprint, never acoustic geometry, and cannot be replaced under replay", async () => {
  const a = await captured();
  const changed = structuredClone(a.configuration);
  changed.sceneSnapshot.zones![0]!.hysteresisM = 0.1;
  const before = await recordingFingerprints(a.configuration, [], "run.same"),
    after = await recordingFingerprints(changed, [], "run.same");
  assert.equal(before.sceneGeometryHash, after.sceneGeometryHash);
  assert.notEqual(before.physicsConfigHash, after.physicsConfigHash);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  await assert.rejects(
    () =>
      processor.process(
        a.frames[0]!,
        { ...changes(a), sceneSnapshot: changed.sceneSnapshot },
        a.configuration,
      ),
    { code: "ZONE_REGISTRY_CHANGED" },
  );
  const legacy = structuredClone(a.configuration);
  delete legacy.sceneSnapshot.zones;
  const explicitEmpty = structuredClone(legacy);
  explicitEmpty.sceneSnapshot.zones = [];
  assert.equal(
    (await recordingFingerprints(legacy, [], "run.legacy")).physicsConfigHash,
    (await recordingFingerprints(explicitEmpty, [], "run.legacy")).physicsConfigHash,
  );
});
test("same Zone registry permits bounded evaluation-client reprocessing with preserved raw events and sound phase", async () => {
  const a = await captured();
  const client = new RecordingEvaluationClient({
    useWorker: false,
    yieldTask: async () => {},
    getAssets: () => [],
  });
  try {
    const b = await reprocessRecording(a, changes(a), (frame, configuration) =>
      client.reprocess(frame, configuration, a.configuration),
    );
    assert.notEqual(
      b.sourcePhaseEvidence?.evidenceClass,
      "missing",
      b.sourcePhaseEvidence?.reason ?? "",
    );
    assert.deepEqual(
      b.frames.flatMap((f) => f.physicsEvents),
      a.frames.flatMap((f) => f.physicsEvents),
    );
    assert.equal(
      b.frames
        .flatMap((f) => f.audioEvents)
        .filter((e) => typeof e === "object" && e !== null && "action" in e && e.action === "start")
        .length,
      1,
    );
    await verifyRecording(b);
  } finally {
    client.dispose();
  }
});

test("actual Node worker protocol preserves Zone metadata through independent evaluation realm", async () => {
  const a = await captured();
  const workerUrl = new URL("../../src/app/recording-evaluation.worker.ts", import.meta.url).href;
  const worker = new Worker(
    "const {parentPort}=require('node:worker_threads');globalThis.postMessage=data=>parentPort.postMessage(data);" +
      "import('tsx/esm/api').then(async({tsImport})=>{await tsImport(" +
      JSON.stringify(workerUrl) +
      "," +
      JSON.stringify(import.meta.url) +
      ");parentPort.on('message',data=>globalThis.onmessage({data}));parentPort.postMessage({ready:true});}).catch(error=>{throw error;});",
    { eval: true },
  );
  const port = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    onerror: null as ((event: unknown) => void) | null,
    onmessageerror: null as ((event: unknown) => void) | null,
    postMessage: (value: unknown) => worker.postMessage(value),
    terminate: () => {
      void worker.terminate();
    },
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("worker init timeout")), 10000);
      worker.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.on("message", (data) => {
        if (data?.ready) {
          clearTimeout(timer);
          resolve();
        } else port.onmessage?.({ data });
      });
      worker.on("error", (error) => port.onerror?.(error));
      worker.on("messageerror", (error) => port.onmessageerror?.(error));
    });
    const client = new RecordingEvaluationClient({
      workerFactory: () => port,
      getAssets: () => [],
    });
    try {
      const b = await reprocessRecording(
        a,
        { ...changes(a), runId: "run.zone-worker" },
        (frame, config) => client.reprocess(frame, config, a.configuration),
      );
      assert.equal(client.mode, "worker");
      assert.notEqual(
        b.sourcePhaseEvidence?.evidenceClass,
        "missing",
        b.sourcePhaseEvidence?.reason ?? "",
      );
      assert.deepEqual(
        b.frames.flatMap((f) => f.physicsEvents),
        a.frames.flatMap((f) => f.physicsEvents),
      );
      assert.equal(
        b.frames
          .flatMap((f) => f.audioEvents)
          .filter(
            (e) => typeof e === "object" && e !== null && "action" in e && e.action === "start",
          ).length,
        1,
      );
      await verifyRecording(b);
    } finally {
      client.dispose();
    }
  } finally {
    await worker.terminate();
  }
});

test("deleting both raw and normalized Zone IDs cannot bypass producer provenance", async () => {
  const a = await captured(),
    frames = structuredClone(a.frames) as RecordingFrame[];
  const exit = frames.find((f) =>
    (f.physicsEvents as { type?: string }[]).some((e) => e.type === "OnExitZone"),
  )!;
  for (const event of exit.physicsEvents as { type?: string; zoneId?: string }[])
    if (event.type === "OnExitZone") delete event.zoneId;
  const normalized = exit.behaviorSnapshot as RecordedBehaviorSnapshot;
  for (const event of normalized.inputFrame.events)
    if (event.type === "OnExitZone") delete event.zoneId;
  assert.equal(normalizeSourcePhase(a.configuration, frames).evidence.evidenceClass, "missing");
});
test("registered Zone events require actual zone producer provenance and explicit target identity", async () => {
  const a = await captured();
  const frame = a.frames.find((f) =>
    (f.physicsEvents as { type?: string }[]).some((e) => e.type === "OnEnterZone"),
  )!;
  const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
  for (const mutation of ["source", "missingId", "unknownId"] as const) {
    const input = structuredClone(snapshot.inputFrame),
      event = input.events.find((e) => e.type === "OnEnterZone")!;
    if (mutation === "source") event.source = "physics";
    if (mutation === "missingId") delete event.zoneId;
    if (mutation === "unknownId") event.zoneId = "zone.unknown";
    const runtime = createBehaviorRuntime(
      a.configuration.behaviorConfig as SoundBehaviorDocument,
      makeBehaviorContext(a.configuration.sceneSnapshot, input.objects),
      { experimentId: "run.forged", runEpoch: input.runEpoch },
    );
    assert.throws(
      () => runtime.step(input),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "ZONE_PROVENANCE",
    );
  }
  const processor = new RecordingProcessor({ getAssets: () => [] });
  await assert.rejects(() => processor.process(frame, changes(a)), {
    code: "ZONE_BASELINE_REQUIRED",
  });
});
