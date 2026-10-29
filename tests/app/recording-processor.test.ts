import test from "node:test";
import assert from "node:assert/strict";
import type {
  AudioEvent,
  ContactData,
  SoundBehaviorDocument,
} from "../../schemas/sound-behavior/types.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticMaterial } from "../../src/acoustics/types.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { AudioEngine } from "../../src/audio/index.js";
import type { VoiceCursor } from "../../src/audio/types.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import type {
  BehaviorFrame,
  BehaviorRuntime,
  BehaviorSnapshot,
} from "../../src/audio-behavior/types.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import {
  createDefaultBehaviors,
  createDefaultScene,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import { RecordingProcessor } from "../../src/app/recording-processor.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import { ExperimentRecorder, reprocessRecording } from "../../src/experiments/index.js";
import type { ReprocessConfiguration } from "../../src/experiments/reprocess.js";
import type { RecordingConfiguration, RecordingFrame } from "../../src/experiments/types.js";
import { stableHash } from "../../src/physics/math.js";
import { createScene } from "../../src/scene/index.js";
import type { SceneSpec } from "../../src/scene/types.js";

const atmosphere = { medium: "air" as const, speedOfSoundMps: 343 };
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);
function scene(): SceneSpec {
  const base = createDefaultScene();
  const floor = {
    ...base.objects[0]!,
    positionM: [0, -0.5, 0] as [number, number, number],
    dimensionsM: [20, 1, 20] as [number, number, number],
    acousticMaterialId: "material.hard",
  };
  const emitter = {
    ...base.objects.find((object) => object.id === "speaker")!,
    positionM: [1, 1, 0] as [number, number, number],
    acousticRole: "staticSurface" as const,
  };
  return createScene({
    ...base,
    sceneRevision: 4,
    objects: [floor, emitter],
    sources: [],
    listener: { ...base.listener, positionM: [5, 1, 0] },
  });
}
function materials(reflectionEnergy = 1): AcousticMaterial[] {
  const hard = structuredClone(DEFAULT_MATERIALS[0]!);
  hard.bands = hard.bands.map((band) => ({
    ...band,
    reflectionEnergy,
    absorptionEnergy: 1 - reflectionEnergy,
    scatteringFraction: 0,
  }));
  return [hard, ...structuredClone(DEFAULT_MATERIALS.slice(1))];
}
function document(inputScene: SceneSpec): SoundBehaviorDocument {
  const doc = createDefaultBehaviors(createDefaultScene());
  doc.bindings = [
    { ...doc.bindings.find((binding) => binding.objectId === "speaker")!, objectGeneration: 7 },
  ];
  doc.profiles = [doc.profiles.find((profile) => profile.profileId === "profile.continuous-tone")!];
  assert.ok(inputScene.objects.some((object) => object.id === "speaker"));
  return doc;
}
function input(scene: SceneSpec, tick = 1): BehaviorFrame {
  return {
    tick,
    sceneRevision: scene.sceneRevision,
    runEpoch: "epoch.original",
    objects: scene.objects.map((object) => ({
      objectId: object.id,
      generation: object.id === "speaker" ? 7 : 3,
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
      metrics: {
        sourceSpeedMetresPerSecond: 0,
        angularSpeedRadiansPerSecond: 0,
        contactSupportForceNewtons: null,
      },
    })),
    events: [],
  };
}
function capture(
  scene: SceneSpec,
  input: BehaviorFrame,
  runtime?: BehaviorRuntime,
): RecordingFrame {
  const evaluator =
    runtime ??
    createBehaviorRuntime(document(scene), makeBehaviorContext(scene, input.objects), {
      experimentId: "run.original",
      runEpoch: input.runEpoch,
    });
  const preStepSnapshot = evaluator.snapshot();
  const result = evaluator.step(input);
  return {
    tick: input.tick,
    sceneRevision: input.sceneRevision,
    runEpoch: input.runEpoch,
    poses: input.objects.map((object) => ({
      objectId: object.objectId,
      positionM: object.positionMetres,
      orientationQuaternion: object.rotation!,
    })),
    listener: structuredClone(scene.listener),
    physicsEvents: input.events,
    behaviorDecisions: result.decisions,
    audioEvents: result.events,
    acousticFrames: [],
    acousticResultRefs: [],
    behaviorSnapshot: {
      inputFrame: structuredClone(input),
      preStepSnapshot,
      runtimeSnapshot: evaluator.snapshot(),
      voiceIntents: result.voices,
    },
  };
}
function baselineConfiguration(scene: SceneSpec, doc = document(scene)): RecordingConfiguration {
  return {
    sceneSnapshot: scene,
    sourceConfig: [],
    behaviorConfig: doc,
    solverConfig: { maxReflectionOrder: 1, maxPaths: 8 },
    atmosphere,
    materialRegistry: materials(),
    assetManifest: [],
    generatorConfig: [],
    physicsConfig: {},
    geometrySnapshot: {},
    physicsVersion: "test-reference",
    backendId: "custom-web-geometric",
    backendVersion: "1.0.0",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}

test("late acoustic reevaluation restores the true pre-step continuous instance and phase", async () => {
  const initial = scene();
  const doc = document(initial);
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
    maxVoices: 16,
  });
  const baseline = baselineConfiguration(initial, doc);
  const recorder = new ExperimentRecorder({
    ...baseline,
    runId: "run.original",
    runEpoch: "epoch.original",
  });
  for (let tick = 1; tick <= 25; tick++) {
    const frame = capture(initial, input(initial, tick), runtime);
    if (tick >= 21) recorder.appendFrame(frame);
  }
  const a = await recorder.finish();
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const b = await reprocessRecording(a, configuration(initial), (frame, changes) =>
    processor.process(frame, changes, a.configuration),
  );
  for (let index = 0; index < a.frames.length; index++) {
    const before = a.frames[index]!.behaviorSnapshot as RecordedBehaviorSnapshot;
    const after = b.frames[index]!.behaviorSnapshot as RecordedBehaviorSnapshot;
    assert.equal(before.voiceIntents[0]!.action, "update");
    assert.equal(
      after.voiceIntents[0]!.action,
      "update",
      "an already audible source cannot restart at the capture boundary",
    );
    assert.equal(after.voiceIntents[0]!.event.instanceId, before.voiceIntents[0]!.event.instanceId);
    assert.deepEqual(after.runtimeSnapshot.state.instances, before.runtimeSnapshot.state.instances);
    assert.equal(after.stateInitializationPolicy, "restoredPreStepSnapshot");
    assert.deepEqual(after.sourceInstanceMapping, [
      {
        baselineInstanceId: before.runtimeSnapshot.state.instances[0]!.instanceId,
        candidateInstanceId: before.runtimeSnapshot.state.instances[0]!.instanceId,
      },
    ]);
    assert.equal(after.runtimeSnapshot.state.runEpoch, "run.candidate");
    assert.equal(after.preStepSnapshot!.state.tick, 20 + index);
    close(after.runtimeSnapshot.state.instances[0]!.playheadSeconds, (20 + index) / 60);
  }
  assert.equal(b.fingerprints.sourceSignalHash, a.fingerprints.sourceSignalHash);
  assert.equal(b.fingerprints.motionTraceHash, a.fingerprints.motionTraceHash);
});

test("late acoustic reevaluation retains an already emitted contact one-shot without another start", async () => {
  const initial = scene();
  const doc = document(initial);
  const impact = structuredClone(
    createDefaultBehaviors(createDefaultScene()).profiles[1]!.rules[0]!,
  );
  doc.profiles[0]!.rules = [impact];
  doc.bindings[0]!.overrides = [];
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
    maxVoices: 16,
  });
  const contact: ContactData = {
    pairKey: "pair.floor-speaker",
    episodeId: "episode.impact",
    objectA: "floor",
    objectB: "speaker",
    colliderA: `col-${stableHash("floor")}`,
    colliderB: `col-${stableHash("speaker")}`,
    materialA: "material.hard",
    materialB: "material.soft",
    pointWorldMetres: [3, 0.01, 0],
    normalAtoB: [0, 1, 0],
    normalImpulseNewtonSeconds: 4,
    impulseMethod: "RapierContactImpulse",
    closingSpeedMetresPerSecond: 3,
    tangentSpeedMetresPerSecond: null,
    velocityMethod: "PreStepRigidBodyEstimate",
  };
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const baseline = baselineConfiguration(initial, doc);
  for (let tick = 1; tick <= 23; tick++) {
    const current = input(initial, tick);
    if (tick === 19)
      current.events = [
        {
          eventId: "event.pre-capture-impact",
          tick,
          sequence: 1,
          objectId: "speaker",
          generation: 7,
          type: "OnImpact",
          source: "physics",
          accepted: true,
          contact,
          metrics: { closingSpeedMetresPerSecond: 3 },
        },
      ];
    const frame = capture(initial, current, runtime);
    if (tick < 21) continue;
    const result = await processor.process(frame, configuration(initial, doc), baseline);
    assert.equal(result.audioEvents.length, 0);
    assert.equal((result.behaviorSnapshot as RecordedBehaviorSnapshot).voiceIntents.length, 0);
    const a = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
    const b = result.behaviorSnapshot as RecordedBehaviorSnapshot;
    assert.deepEqual(b.runtimeSnapshot.state.instances, a.runtimeSnapshot.state.instances);
    assert.deepEqual(b.runtimeSnapshot.inputCursor, a.runtimeSnapshot.inputCursor);
    assert.ok(b.runtimeSnapshot.state.processedEventIds.includes("event.pre-capture-impact"));
    assert.equal(
      result.acousticFrames![0]!.sourceId,
      a.runtimeSnapshot.state.instances[0]!.instanceId,
    );
    assert.deepEqual(result.acousticFrames![0]!.paths[0]!.verticesM[0], contact.pointWorldMetres);
  }
});

test("late acoustic reevaluation rejects absent pre-state and post-step reuse; changed behavior declares a fresh policy", async () => {
  const initial = scene();
  const doc = document(initial);
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
    maxVoices: 16,
  });
  let frame: RecordingFrame;
  let earlier: BehaviorSnapshot;
  for (let tick = 1; tick <= 21; tick++) {
    frame = capture(initial, input(initial, tick), runtime);
    if (tick === 1) earlier = (frame.behaviorSnapshot as RecordedBehaviorSnapshot).runtimeSnapshot;
  }
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const config = configuration(initial, doc);
  const baseline = baselineConfiguration(initial, doc);
  const absent = structuredClone(frame!);
  delete (absent.behaviorSnapshot as RecordedBehaviorSnapshot).preStepSnapshot;
  await assert.rejects(processor.process(absent, config, baseline), {
    code: "CAPABILITY_UNSUPPORTED",
  });
  await assert.rejects(processor.process(frame!, config), { code: "CAPABILITY_UNSUPPORTED" });
  const post = structuredClone(frame!);
  const snapshot = post.behaviorSnapshot as RecordedBehaviorSnapshot;
  snapshot.preStepSnapshot = structuredClone(snapshot.runtimeSnapshot);
  await assert.rejects(processor.process(post, config, baseline), {
    code: "INPUT_PROVENANCE_MISMATCH",
  });
  const stale = structuredClone(frame!);
  (stale.behaviorSnapshot as RecordedBehaviorSnapshot).preStepSnapshot = structuredClone(earlier!);
  await assert.rejects(processor.process(stale, config, baseline), {
    code: "SOURCE_STATE_MISMATCH",
  });
  const wrongPhase = structuredClone(frame!);
  (
    wrongPhase.behaviorSnapshot as RecordedBehaviorSnapshot
  ).preStepSnapshot!.state.instances[0]!.playheadSeconds = 0;
  await assert.rejects(processor.process(wrongPhase, config, baseline), {
    code: "SOURCE_STATE_MISMATCH",
  });
  const changed = structuredClone(doc);
  changed.profiles[0]!.rules[0]!.enabled = false;
  const result = await processor.process(absent, configuration(initial, changed), baseline);
  assert.equal(result.audioEvents.length, 0);
  assert.equal(
    (result.behaviorSnapshot as RecordedBehaviorSnapshot).stateInitializationPolicy,
    "freshBehaviorReevaluation",
  );
});
test("a genuine behavior-clock reset before a late physics tick maps new sources once and preserves subsequent phase", async () => {
  const initial = scene();
  const doc = document(initial);
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
    maxVoices: 16,
  });
  const baseline = baselineConfiguration(initial, doc);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  let previousMapping: RecordedBehaviorSnapshot["sourceInstanceMapping"];
  for (let tick = 21; tick <= 23; tick++) {
    const frame = capture(initial, input(initial, tick), runtime);
    const original = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
    if (tick === 21)
      assert.equal(
        original.preStepSnapshot!.state.tick,
        0,
        "authoring may reset behavior while physics keeps its tick",
      );
    const result = await processor.process(frame, configuration(initial), baseline);
    const candidate = result.behaviorSnapshot as RecordedBehaviorSnapshot;
    const a = original.runtimeSnapshot.state.instances[0]!,
      b = candidate.runtimeSnapshot.state.instances[0]!;
    assert.equal(b.startedAtTick, a.startedAtTick);
    assert.equal(b.playheadSeconds, a.playheadSeconds);
    assert.equal(candidate.voiceIntents[0]!.action, tick === 21 ? "start" : "update");
    assert.deepEqual(candidate.sourceInstanceMapping, [
      { baselineInstanceId: a.instanceId, candidateInstanceId: b.instanceId },
    ]);
    if (previousMapping) assert.deepEqual(candidate.sourceInstanceMapping, previousMapping);
    previousMapping = candidate.sourceInstanceMapping;
  }
});

const cursorModel = "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer";

test("same-content B preserves AudioEngine pitch-history cursors rather than unpitched Behavior playheads", async () => {
  const initial = scene();
  const doc = document(initial);
  doc.profiles[0]!.rules[0]!.mappings = [
    {
      mappingId: "mapping.native-pitch",
      input: "sourceSpeedMetresPerSecond",
      target: "pitchSemitones",
      inputMin: 0,
      inputMax: 1,
      outputMin: 0,
      outputMax: 12,
      curve: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      interpolation: "linear",
      clamp: true,
      smoothingSeconds: 0.02,
    },
  ];
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
    maxVoices: 16,
  });
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  await engine.enable(0);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const baseline = baselineConfiguration(initial, doc);
  try {
    for (let tick = 1; tick <= 23; tick++) {
      context.currentTime = tick / 60;
      const current = input(initial, tick);
      current.objects.find(
        (object) => object.objectId === "speaker",
      )!.metrics.sourceSpeedMetresPerSecond = tick >= 7 ? 1 : 0;
      const frame = capture(initial, current, runtime);
      const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
      const captureCursors = (state: BehaviorSnapshot) =>
        Object.fromEntries(
          state.state.instances.flatMap((instance) => {
            const cursor = engine.getVoiceCursor(instance.instanceId, state.state.tick / 60);
            return cursor ? [[instance.instanceId, cursor]] : [];
          }),
        );
      snapshot.preStepVoiceCursors = captureCursors(snapshot.preStepSnapshot!);
      snapshot.voiceCursors = captureCursors(snapshot.runtimeSnapshot);
      snapshot.cursorModel = cursorModel;
      if (tick >= 21) {
        const pinned = structuredClone(snapshot);
        const result = await processor.process(frame, configuration(initial, doc), baseline);
        const candidate = result.behaviorSnapshot as RecordedBehaviorSnapshot;
        const id = snapshot.runtimeSnapshot.state.instances[0]!.instanceId;
        assert.ok(
          snapshot.voiceCursors[id]!.playheadSeconds >
            snapshot.runtimeSnapshot.state.instances[0]!.playheadSeconds + 0.1,
          "native source seconds must include the authored octave pitch history",
        );
        assert.deepEqual(candidate.preStepVoiceCursors, snapshot.preStepVoiceCursors);
        assert.deepEqual(candidate.voiceCursors, snapshot.voiceCursors);
        assert.equal(candidate.cursorModel, cursorModel);
        assert.deepEqual(snapshot, pinned, "cursor transfer cannot mutate A");
      }
      for (const voice of snapshot.voiceIntents) {
        if (voice.action === "start") {
          const event = voice.event;
          const acoustic = solveAcoustics(
            buildAcousticRequests({
              scene: initial,
              poses: frame.poses,
              sources: [
                { id: event.instanceId, objectId: event.objectId, positionM: event.positionMetres },
              ],
              listener: frame.listener,
              tick,
              materials: materials(),
              atmosphere,
            })[0]!,
          ).frame;
          assert.equal(
            engine.playVoice(
              {
                instanceId: event.instanceId,
                sourceId: event.instanceId,
                generator: voice.generator,
                gainLinear: event.gainLinear,
                pitchSemitones: event.pitchSemitones,
                emissionTimeSeconds: event.simulationTimeSeconds,
                continuous: true,
                fadeInSeconds: voice.fadeInSeconds,
                fadeOutSeconds: voice.fadeOutSeconds,
              },
              acoustic,
            ).accepted,
            true,
          );
        } else if (voice.action === "update") {
          engine.updateVoice(voice.event.instanceId, {
            pitchSemitones: voice.event.pitchSemitones,
            smoothingSeconds: voice.smoothingSeconds,
          });
        }
      }
    }
  } finally {
    engine.dispose();
  }
});

test("native pre/post cursors follow new-source mappings and survive pre-only expiration without invented fallback", async () => {
  const initial = scene();
  const doc = document(initial);
  const grab = structuredClone(createDefaultBehaviors(createDefaultScene()).profiles[1]!.rules[1]!);
  grab.oneShotDurationSeconds = 0.02;
  grab.fadeInSeconds = 0.005;
  grab.fadeOutSeconds = 0;
  doc.profiles[0]!.rules = [grab];
  doc.bindings[0]!.overrides = [];
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
    maxVoices: 16,
  });
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const baseline = baselineConfiguration(initial, doc);
  let baselineId = "",
    candidateId = "";
  for (let tick = 1; tick <= 3; tick++) {
    const current = input(initial, tick);
    if (tick === 1)
      current.events = [
        {
          eventId: "event.grab",
          tick,
          sequence: 1,
          objectId: "speaker",
          generation: 7,
          type: "OnGrab",
          source: "interaction",
          accepted: true,
          commandId: "command.grab",
        },
      ];
    const frame = capture(initial, current, runtime);
    const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
    if (tick === 1) baselineId = snapshot.runtimeSnapshot.state.instances[0]!.instanceId;
    const cursor: VoiceCursor = {
      playheadSeconds: 0.02,
      elapsedSinceEmissionSeconds: 1 / 60,
      remainingDurationSeconds: 0,
      emissionEndElapsedSeconds: 0.01,
    };
    snapshot.cursorModel = cursorModel;
    snapshot.preStepVoiceCursors = tick === 3 ? { [baselineId]: cursor } : {};
    snapshot.voiceCursors =
      tick === 2
        ? {
            [baselineId]: {
              ...cursor,
              remainingDurationSeconds: 0.02 - 1 / 60,
              emissionEndElapsedSeconds: 0.02,
            },
          }
        : {};
    const result = await processor.process(frame, configuration(initial, doc), baseline);
    const candidate = result.behaviorSnapshot as RecordedBehaviorSnapshot;
    if (tick === 1) {
      candidateId = candidate.runtimeSnapshot.state.instances[0]!.instanceId;
      assert.notEqual(
        candidateId,
        baselineId,
        "new candidate emission has an explicit stable source mapping",
      );
      assert.deepEqual(candidate.preStepVoiceCursors, {});
      assert.deepEqual(candidate.voiceCursors, {});
    } else if (tick === 2) {
      assert.deepEqual(candidate.voiceCursors, {
        [candidateId]: snapshot.voiceCursors[baselineId],
      });
    } else {
      assert.equal(candidate.runtimeSnapshot.state.instances.length, 0);
      assert.deepEqual(candidate.sourceInstanceMapping, []);
      assert.deepEqual(
        candidate.preStepVoiceCursors,
        { [candidateId]: cursor },
        "an expiring source uses the pre mapping even when no post voice survives",
      );
      assert.deepEqual(candidate.voiceCursors, {});
      const changed = structuredClone(doc);
      changed.profiles[0]!.rules[0]!.enabled = false;
      const fresh = (
        await processor.process(frame, configuration(initial, changed, "run.changed"), baseline)
      ).behaviorSnapshot as RecordedBehaviorSnapshot;
      for (const key of ["preStepVoiceCursors", "voiceCursors", "cursorModel"])
        assert.equal(
          Object.hasOwn(fresh, key),
          false,
          "changed behavior cannot inherit A phase metadata",
        );
    }
  }
});

test("native cursors reject unknown models, orphan IDs and invalid clocks, while absent cursor evidence stays absent", async () => {
  const initial = scene();
  const doc = document(initial);
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
    maxVoices: 16,
  });
  let frame: RecordingFrame;
  for (let tick = 1; tick <= 21; tick++) frame = capture(initial, input(initial, tick), runtime);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const baseline = baselineConfiguration(initial, doc);
  const cursor: VoiceCursor = {
    playheadSeconds: 0.6,
    elapsedSinceEmissionSeconds: 1 / 3,
    remainingDurationSeconds: null,
  };
  const id = (frame!.behaviorSnapshot as RecordedBehaviorSnapshot).runtimeSnapshot.state
    .instances[0]!.instanceId;
  for (const mutation of [
    (snapshot: RecordedBehaviorSnapshot) => {
      delete snapshot.cursorModel;
    },
    (snapshot: RecordedBehaviorSnapshot) => {
      snapshot.voiceCursors = { orphan: cursor };
    },
    (snapshot: RecordedBehaviorSnapshot) => {
      snapshot.voiceCursors![id]!.playheadSeconds = NaN;
    },
    (snapshot: RecordedBehaviorSnapshot) => {
      snapshot.voiceCursors![id]!.elapsedSinceEmissionSeconds = 10;
    },
  ]) {
    const corrupt = structuredClone(frame!);
    const snapshot = corrupt.behaviorSnapshot as RecordedBehaviorSnapshot;
    snapshot.cursorModel = cursorModel;
    snapshot.voiceCursors = { [id]: structuredClone(cursor) };
    mutation(snapshot);
    await assert.rejects(processor.process(corrupt, configuration(initial, doc), baseline), {
      code: "INVALID_AUDIO_CURSOR",
    });
  }
  const candidate = (await processor.process(frame!, configuration(initial, doc), baseline))
    .behaviorSnapshot as RecordedBehaviorSnapshot;
  for (const key of ["preStepVoiceCursors", "voiceCursors", "cursorModel"])
    assert.equal(Object.hasOwn(candidate, key), false);
});

test("same-content fresh tick zero accepts only the genuine unstepped initial prestate", async () => {
  const initial = scene();
  const doc = document(initial);
  const runtime = createBehaviorRuntime(
    doc,
    makeBehaviorContext(initial, input(initial, 0).objects),
    { experimentId: "run.original", runEpoch: "epoch.original", maxVoices: 16 },
  );
  const frame = capture(initial, input(initial, 0), runtime);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const baseline = baselineConfiguration(initial, doc);
  const candidate = (await processor.process(frame, configuration(initial, doc), baseline))
    .behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.equal(candidate.preStepSnapshot!.state.tick, 0);
  assert.equal(candidate.voiceIntents[0]!.event.simulationTimeSeconds, 0);
  assert.equal(candidate.voiceIntents[0]!.action, "start");
  assert.equal(candidate.stateInitializationPolicy, "restoredPreStepSnapshot");
  const corrupt = structuredClone(frame);
  (corrupt.behaviorSnapshot as RecordedBehaviorSnapshot).preStepSnapshot!.state.sequence = 1;
  await assert.rejects(
    processor.process(corrupt, configuration(initial, doc, "run.bad-zero"), baseline),
    { code: "INPUT_PROVENANCE_MISMATCH" },
  );
});

function configuration(
  scene: SceneSpec,
  doc = document(scene),
  runId = "run.candidate",
): ReprocessConfiguration {
  return {
    runId,
    sceneSnapshot: scene,
    behaviorConfig: doc,
    materialRegistry: materials(),
    atmosphere,
    solverConfig: { maxReflectionOrder: 1, maxPaths: 8 },
  };
}

test("B disables a real evaluated A rule while preserving authoritative trace fingerprints", async () => {
  const initial = scene();
  const doc = document(initial);
  const runtime = createBehaviorRuntime(doc, makeBehaviorContext(initial, input(initial).objects), {
    experimentId: "run.original",
    runEpoch: "epoch.original",
  });
  const recorder = new ExperimentRecorder({
    ...configuration(initial, doc, "run.original"),
    runEpoch: "epoch.original",
    sceneSnapshot: initial,
    sourceConfig: [],
    behaviorConfig: doc,
    materialRegistry: materials(),
    atmosphere,
    solverConfig: { maxReflectionOrder: 1, maxPaths: 8 },
    physicsVersion: "test-reference",
    backendVersion: "1.0.0",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  });
  for (let tick = 1; tick <= 3; tick++)
    recorder.appendFrame(capture(initial, input(initial, tick), runtime));
  const a = await recorder.finish();
  const pinned = structuredClone(a);
  assert.equal((a.frames[0]!.audioEvents[0] as AudioEvent).action, "start");
  const changed = structuredClone(doc);
  changed.revision++;
  changed.profiles[0]!.revision++;
  changed.profiles[0]!.rules[0]!.enabled = false;
  changed.bindings[0]!.profileRevision++;
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const b = await reprocessRecording(a, configuration(initial, changed), (frame, config) =>
    processor.process(frame, config),
  );
  assert.equal(b.fingerprints.motionTraceHash, a.fingerprints.motionTraceHash);
  assert.equal(b.fingerprints.physicsEventTraceHash, a.fingerprints.physicsEventTraceHash);
  assert.notEqual(b.fingerprints.profileHash, a.fingerprints.profileHash);
  assert.ok(
    b.frames.every((frame) => frame.audioEvents.length === 0 && frame.acousticFrames.length === 0),
  );
  assert.notDeepEqual(
    b.frames.map((frame) => frame.behaviorDecisions),
    a.frames.map((frame) => frame.behaviorDecisions),
  );
  const snapshot = b.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.equal(
    snapshot.inputFrame.objects.find((object) => object.objectId === "speaker")!.generation,
    7,
  );
  assert.equal(snapshot.runtimeSnapshot.state.runEpoch, "run.candidate");
  assert.deepEqual(a, pinned, "reevaluation cannot mutate baseline artifacts");
});

test("fresh run state starts once, updates with recorded motion and is reset by a new run ID", async () => {
  const initial = scene();
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const config = configuration(initial);
  const first = await processor.process(capture(initial, input(initial)), config);
  assert.equal(
    (first.behaviorSnapshot as RecordedBehaviorSnapshot).runtimeSnapshot.state.randomSeed,
    initial.seed,
    "fresh evaluation uses the explicitly pinned Scene seed",
  );
  const moved = input(initial, 2);
  moved.objects.find((object) => object.objectId === "speaker")!.positionMetres = [2, 1, 0];
  const second = await processor.process(capture(initial, moved), config);
  assert.equal((first.audioEvents[0] as AudioEvent).action, "start");
  assert.equal((second.audioEvents[0] as AudioEvent).action, "update");
  assert.equal(
    (second.audioEvents[0] as AudioEvent).instanceId,
    (first.audioEvents[0] as AudioEvent).instanceId,
  );
  close(second.acousticFrames![0]!.paths.find((path) => path.order === 0)!.lengthM, 3);
  const third = await processor.process(capture(initial, input(initial)), {
    ...config,
    runId: "run.next",
  });
  assert.equal((third.audioEvents[0] as AudioEvent).action, "start");
  assert.notEqual(
    (third.audioEvents[0] as AudioEvent).instanceId,
    (first.audioEvents[0] as AudioEvent).instanceId,
  );
  await assert.rejects(
    processor.process(capture(initial, input(initial, 2)), {
      ...config,
      runId: "run.next",
      atmosphere: { ...atmosphere, speedOfSoundMps: 300 },
    }),
    { code: "REPROCESS_CONFIGURATION_CHANGED" },
  );
});

test("contact emission reuses exact collider provenance, metrics and anchor until logical expiry", async () => {
  const initial = scene();
  const doc = document(initial);
  const impact = structuredClone(
    createDefaultBehaviors(createDefaultScene()).profiles[1]!.rules[0]!,
  );
  impact.oneShotDurationSeconds = 0.02;
  impact.fadeInSeconds = 0.005;
  impact.fadeOutSeconds = 0.005;
  doc.profiles[0]!.rules = [impact];
  doc.bindings[0]!.overrides = [];
  const firstInput = input(initial);
  const contact: ContactData = {
    pairKey: "pair.floor-speaker",
    episodeId: "episode.impact",
    objectA: "floor",
    objectB: "speaker",
    colliderA: `col-${stableHash("floor")}`,
    colliderB: `col-${stableHash("speaker")}`,
    materialA: "material.hard",
    materialB: "material.soft",
    pointWorldMetres: [3, 0.01, 0],
    normalAtoB: [0, 1, 0],
    normalImpulseNewtonSeconds: 4,
    impulseMethod: "RapierContactImpulse",
    closingSpeedMetresPerSecond: 3,
    tangentSpeedMetresPerSecond: null,
    velocityMethod: "PreStepRigidBodyEstimate",
  };
  firstInput.events = [
    {
      eventId: "event.impact",
      tick: 1,
      sequence: 5,
      objectId: "speaker",
      generation: 7,
      type: "OnImpact",
      source: "physics",
      accepted: true,
      contact,
      metrics: { closingSpeedMetresPerSecond: 3, contactSupportForceNewtons: null },
    },
  ];
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const config = configuration(initial, doc);
  const first = await processor.process(capture(initial, firstInput), config);
  const event = first.audioEvents[0] as AudioEvent;
  assert.equal(event.generation, 7);
  assert.deepEqual(event.contact, contact);
  assert.deepEqual(event.positionMetres, [3, 0.01, 0]);
  close(event.gainLinear, 0.025 + (0.25 - 0.025) * 0.3);
  assert.deepEqual(first.acousticFrames![0]!.paths[0]!.verticesM[0], event.positionMetres);
  const second = await processor.process(capture(initial, input(initial, 2)), config);
  assert.equal(
    second.audioEvents.length,
    0,
    "contact one-shot does not invent a second impact or object attachment",
  );
  assert.deepEqual(second.acousticFrames![0]!.paths[0]!.verticesM[0], event.positionMetres);
  const third = await processor.process(capture(initial, input(initial, 3)), config);
  assert.equal((third.audioEvents[0] as AudioEvent).action, "stop");
  assert.equal(
    third.acousticFrames!.length,
    0,
    "expired voice cannot leave an acoustic source behind",
  );
});

test("missing input, stale generation, mismatched motion and repeated ticks reject explicitly", async () => {
  const initial = scene();
  const config = configuration(initial);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const absent = capture(initial, input(initial));
  delete absent.behaviorSnapshot;
  await assert.rejects(processor.process(absent, config), { code: "CAPABILITY_UNSUPPORTED" });
  const missingClock = capture(initial, input(initial));
  missingClock.behaviorSnapshot = { inputFrame: input(initial) };
  await assert.rejects(processor.process(missingClock, config), { code: "CAPABILITY_UNSUPPORTED" });
  const stale = structuredClone(document(initial));
  stale.bindings[0]!.objectGeneration = 8;
  await assert.rejects(
    processor.process(capture(initial, input(initial)), configuration(initial, stale)),
    { code: "STALE_OBJECT_GENERATION" },
  );
  const corrupt = capture(initial, input(initial));
  corrupt.poses = corrupt.poses.map((pose) => ({ ...pose, positionM: [0, 0, 0] }));
  await assert.rejects(processor.process(corrupt, config), { code: "INPUT_MOTION_MISMATCH" });
  await processor.process(capture(initial, input(initial)), config);
  await assert.rejects(processor.process(capture(initial, input(initial)), config), {
    code: "REPROCESS_TICK_ORDER",
  });
});

test("reevaluation uses the requested scene material assignment and registry with original motion and listener", async () => {
  const initial = scene();
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const frame = capture(initial, input(initial));
  const hard = await processor.process(frame, configuration(initial));
  const changed = structuredClone(initial);
  changed.sceneRevision++;
  changed.objects[0]!.acousticMaterialId = "material.soft";
  const registry = materials();
  registry.find((material) => material.id === "material.soft")!.bands = registry[0]!.bands.map(
    (band) => ({
      ...band,
      reflectionEnergy: 0.25,
      absorptionEnergy: 0.75,
    }),
  );
  const soft = await processor.process(frame, {
    ...configuration(changed, document(changed), "run.material"),
    materialRegistry: registry,
  });
  const path = (result: typeof soft) =>
    result.acousticFrames![0]!.paths.find((value) => value.surfaceIds[0] === "floor.py")!;
  close(path(soft).bandGains[0]! / path(hard).bandGains[0]!, 0.5);
  assert.deepEqual(path(soft).verticesM, path(hard).verticesM);
  const snapshot = soft.behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.equal(snapshot.inputFrame.sceneRevision, changed.sceneRevision);
  assert.equal(snapshot.inputFrame.runEpoch, "run.material");
  assert.deepEqual(
    snapshot.inputFrame.objects,
    (frame.behaviorSnapshot as RecordedBehaviorSnapshot).inputFrame.objects,
  );
  assert.equal(soft.acousticFrames![0]!.listenerId, frame.listener.id);
});

test("solver failure rolls back the evaluator so retrying the same tick preserves logical sequence", async () => {
  const initial = scene();
  const config = configuration(initial);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  await processor.process(capture(initial, input(initial)), config);
  const outside = input(initial, 2);
  outside.objects.find((object) => object.objectId === "floor")!.positionMetres = [199, -0.5, 0];
  await assert.rejects(processor.process(capture(initial, outside), config), {
    code: "INVALID_GEOMETRY",
  });
  const retried = await processor.process(capture(initial, input(initial, 2)), config);
  const reference = new RecordingProcessor({ getAssets: () => [] });
  await reference.process(capture(initial, input(initial)), config);
  assert.deepEqual(retried, await reference.process(capture(initial, input(initial, 2)), config));
});

test("shared acoustic input matches finite-plane geometry and independent pressure reflection ratios", () => {
  const initial = scene();
  const solve = (materialRegistry = materials()) =>
    solveAcoustics(
      buildAcousticRequests({
        scene: initial,
        poses: [],
        sources: [{ id: "voice.reference", objectId: "speaker", positionM: [1, 1, 0] }],
        listener: initial.listener,
        tick: 7,
        materials: materialRegistry,
        atmosphere,
      })[0]!,
    );
  const hard = solve();
  const direct = hard.frame.paths.find((path) => path.order === 0)!;
  const reflected = hard.frame.paths.find((path) => path.surfaceIds[0] === "floor.py")!;
  close(direct.lengthM, 4);
  close(reflected.lengthM, Math.sqrt(20));
  close(reflected.absoluteDelayS, Math.sqrt(20) / 343);
  assert.deepEqual(reflected.verticesM[1], [3, 0, 0]);
  const soft = solve(materials(0.25)).frame.paths.find(
    (path) => path.surfaceIds[0] === "floor.py",
  )!;
  close(soft.bandGains[0]! / reflected.bandGains[0]!, 0.5);
  assert.deepEqual(soft.verticesM, reflected.verticesM);
  close(soft.absoluteDelayS, reflected.absoluteDelayS);
  initial.objects[0]!.dimensionsM = [2, 1, 2];
  assert.equal(
    solve().frame.paths.filter((path) => path.order > 0).length,
    0,
    "reflection point outside the finite face must disappear",
  );
});

test("shared acoustic input excludes owner, preserves dynamic occlusion and does not invent curved reflectors or preview voices", () => {
  const initial = scene();
  initial.objects[0]!.acousticRole = "none";
  const blocker = {
    ...structuredClone(initial.objects[1]!),
    id: "blocker",
    mode: "dynamicNoGravity" as const,
    positionM: [3, 1, 0] as [number, number, number],
    dimensionsM: [1, 2, 2] as [number, number, number],
    acousticRole: "dynamicReflector" as const,
  };
  const sphere = {
    ...structuredClone(blocker),
    id: "sphere",
    shape: "sphere" as const,
    dimensionsM: [1, 1, 1] as [number, number, number],
    acousticRole: "staticSurface" as const,
  };
  const capsule = {
    ...structuredClone(blocker),
    id: "capsule",
    shape: "capsule" as const,
    dimensionsM: [1, 2, 1] as [number, number, number],
    acousticRole: "staticSurface" as const,
  };
  initial.objects.push(blocker, sphere, capsule);
  const args = {
    scene: initial,
    poses: [
      {
        objectId: "blocker",
        positionM: blocker.positionM,
        orientationQuaternion: blocker.orientationQuaternion,
      },
    ],
    listener: initial.listener,
    tick: 2,
    materials: materials(),
    atmosphere,
  };
  assert.deepEqual(buildAcousticRequests({ ...args, sources: [] }), []);
  const request = buildAcousticRequests({
    ...args,
    sources: [{ id: "voice.reference", objectId: "speaker", positionM: [1, 1, 0] }],
  })[0]!;
  assert.equal(request.surfaces.length, 6);
  assert.ok(
    request.surfaces.every(
      (surface) => surface.id.startsWith("blocker.") && surface.role === "dynamicOccluder",
    ),
  );
  const solution = solveAcoustics(request);
  assert.equal(solution.diagnostics.directOccluded, true);
  assert.equal(solution.frame.paths.length, 0);
  assert.throws(
    () =>
      buildAcousticRequests({
        ...args,
        budget: { maxSurfaces: 5 },
        sources: [{ id: "voice.reference", objectId: "speaker", positionM: [1, 1, 0] }],
      }),
    { code: "SURFACE_BUDGET" },
  );
});
