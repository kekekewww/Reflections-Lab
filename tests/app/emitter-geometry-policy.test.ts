import {
  createDefaultBehaviors,
  createDefaultScene,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { toBehaviorFrame } from "../../src/app/physics-behavior.js";
import {
  ExperimentRecorder,
  canonicalStringify,
  compareRecordings,
  verifyRecording,
} from "../../src/experiments/index.js";
import type { RecordingArtifact } from "../../src/experiments/types.js";
import { RecordingProcessor } from "../../src/app/recording-processor.js";
import { ReplayAudioHost } from "../../src/app/replay-audio.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import { LEGACY_ACOUSTIC_MODEL_VERSION } from "../../src/capabilities/acoustic-geometry.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  EMITTER_GEOMETRY_POLICY,
  emitterGeometryPolicyPin,
  hasCurrentEmitterGeometryPolicy,
} from "../../src/capabilities/emitter-geometry-policy.js";

const documentWith = (attachment: string) => ({
  profiles: [{ rules: [{ emitter: { attachment } }] }],
});

test("EMITTER-GEO-01: every new capture pins the same policy before authoring changes", () => {
  assert.deepEqual(emitterGeometryPolicyPin(), {
    emitterGeometryPolicy: "explicit-emitter-body-v1",
  });
  assert.notEqual(emitterGeometryPolicyPin(), emitterGeometryPolicyPin());
  for (const attachment of ["object", "contact", "fixed", "zone"])
    assert.equal(
      hasCurrentEmitterGeometryPolicy(documentWith(attachment), emitterGeometryPolicyPin()),
      true,
    );
});

test("EMITTER-GEO-02: legacy object/contact omission is accepted without inserting metadata", () => {
  for (const attachment of ["object", "contact"]) {
    const document = documentWith(attachment);
    const config = { backendId: "custom-web-geometric", maxReflectionOrder: 1 };
    const before = JSON.stringify({ document, config });
    assert.equal(hasCurrentEmitterGeometryPolicy(document, config), true);
    assert.equal(hasCurrentEmitterGeometryPolicy(document, undefined), true);
    assert.equal(hasCurrentEmitterGeometryPolicy(document, null), true);
    assert.equal(JSON.stringify({ document, config }), before);
    assert.equal("emitterGeometryPolicy" in config, false);
  }
});

test("EMITTER-GEO-03: detached fixed/zone authored in any rule require the current policy", () => {
  for (const attachment of ["fixed", "zone"]) {
    const document = {
      profiles: [
        { rules: [{ emitter: { attachment: "object" } }] },
        { rules: [null, { emitter: { attachment } }] },
      ],
    };
    assert.equal(hasCurrentEmitterGeometryPolicy(document, {}), false);
    assert.equal(hasCurrentEmitterGeometryPolicy(document, undefined), false);
    assert.equal(hasCurrentEmitterGeometryPolicy(document, null), false);
    assert.equal(hasCurrentEmitterGeometryPolicy(document, emitterGeometryPolicyPin()), true);
  }
});

test("EMITTER-GEO-04: unknown or explicitly undefined policy is rejected even for object-only documents", () => {
  for (const attachment of ["object", "contact", "fixed", "zone"]) {
    for (const emitterGeometryPolicy of ["legacy", "", 1, false, null, undefined])
      assert.equal(
        hasCurrentEmitterGeometryPolicy(documentWith(attachment), { emitterGeometryPolicy }),
        false,
      );
    assert.equal(
      hasCurrentEmitterGeometryPolicy(documentWith(attachment), {
        emitterGeometryPolicy: EMITTER_GEOMETRY_POLICY,
      }),
      true,
    );
  }
});

test("EMITTER-GEO-05: malformed shapes do not masquerade as detached authoring or valid config", () => {
  for (const malformed of [
    undefined,
    null,
    [],
    3,
    "fixed",
    {},
    { profiles: null },
    { profiles: [{}] },
  ])
    assert.equal(hasCurrentEmitterGeometryPolicy(malformed, {}), true);
  for (const malformedConfig of [[], 3, "explicit-emitter-body-v1", false])
    assert.equal(hasCurrentEmitterGeometryPolicy(documentWith("object"), malformedConfig), false);
  const inherited = Object.create({ emitterGeometryPolicy: EMITTER_GEOMETRY_POLICY });
  assert.equal(hasCurrentEmitterGeometryPolicy(documentWith("fixed"), inherited), false);
});

test("EMITTER-GEO-06: metadata inspection never executes supplied accessors", () => {
  let executed = 0;
  const config = Object.defineProperty({}, "emitterGeometryPolicy", {
    enumerable: true,
    get() {
      executed++;
      return EMITTER_GEOMETRY_POLICY;
    },
  });
  const document = Object.defineProperty({}, "profiles", {
    enumerable: true,
    get() {
      executed++;
      return [{ rules: [{ emitter: { attachment: "fixed" } }] }];
    },
  });
  assert.equal(hasCurrentEmitterGeometryPolicy(document, config), false);
  assert.equal(executed, 0);
});

/**
 * Original pure-box fixture: actual Rapier poses, Behavior decisions, analytic
 * requests, solver frames and ExperimentRecorder seals. No hand-patched hash.
 * Fixed source null-exclusion is applied through the public acoustic builder.
 */
async function sealedBoxCapture(
  attachment: "object" | "fixed",
  currentPolicy: boolean,
  runId: string,
): Promise<RecordingArtifact> {
  const scene = createDefaultScene();
  scene.objects = scene.objects.filter((object) => ["floor", "speaker"].includes(object.id));
  const floor = scene.objects.find((object) => object.id === "floor")!;
  floor.positionM = [0, -0.125, 0];
  floor.dimensionsM = [12, 0.25, 12];
  const speaker = scene.objects.find((object) => object.id === "speaker")!;
  speaker.positionM = [0, 1.5, -1];
  speaker.mode = "fixed";
  speaker.acousticRole = "none";
  scene.listener.positionM = [0, 1.5, 4];
  const document = createDefaultBehaviors(scene);
  const binding = document.bindings.find((item) => item.objectId === "speaker")!;
  const profile = document.profiles.find((item) => item.profileId === binding.profileId)!;
  profile.rules[0]!.emitter =
    attachment === "fixed"
      ? { attachment: "fixed", positionMetres: [...speaker.positionM] }
      : { attachment: "object", offsetMetres: [0, 0, 0] };
  const world = await PhysicsWorld.create(scene, {
    fixedDtSeconds: 1 / 60,
    clockMode: "recording",
  });
  try {
    const runtime = createBehaviorRuntime(
      document,
      makeBehaviorContext(scene, world.snapshot().poses, []),
      { experimentId: runId, runEpoch: runId, fixedDtSeconds: 1 / 60, randomSeed: scene.seed },
    );
    const recorder = new ExperimentRecorder({
      runId,
      runEpoch: runId,
      sceneSnapshot: scene,
      sourceConfig: scene.sources,
      behaviorConfig: document,
      generatorConfig: document.profiles.map((item) => item.rules.map((rule) => rule.generator)),
      solverConfig: {
        backendId: "custom-web-geometric",
        maxReflectionOrder: 1,
        maxPaths: 8,
        ...(currentPolicy ? emitterGeometryPolicyPin() : {}),
      },
      materialRegistry: DEFAULT_MATERIALS,
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
      physicsConfig: { fixedDtS: 1 / 60, gravityMps2: scene.gravityMps2 },
      physicsVersion: "rapier-0.21.0",
      backendId: "custom-web-geometric",
      backendVersion: LEGACY_ACOUSTIC_MODEL_VERSION,
      fixedDtS: 1 / 60,
      sampleRateHz: 48000,
    });
    world.resume();
    for (let step = 0; step < 4; step++) {
      const snapshot = world.step();
      const inputFrame = toBehaviorFrame(snapshot, runId);
      const preStepSnapshot = runtime.snapshot();
      const result = runtime.step(inputFrame);
      const runtimeSnapshot = runtime.snapshot();
      const sources = runtimeSnapshot.state.instances
        .filter((instance) => instance.playbackState === "playing")
        .map((instance) => ({
          id: instance.instanceId,
          objectId: instance.objectId,
          positionM: instance.positionMetres,
          ...(attachment === "fixed" ? { emitterObjectId: null } : {}),
        }));
      const acousticFrames = buildAcousticRequests({
        scene,
        poses: snapshot.poses,
        sources,
        listener: scene.listener,
        tick: snapshot.tick,
        materials: DEFAULT_MATERIALS,
        atmosphere: { medium: "air", speedOfSoundMps: 343 },
      }).map((request) => solveAcoustics(request).frame);
      recorder.appendFrame({
        tick: snapshot.tick,
        sceneRevision: scene.sceneRevision,
        runEpoch: runId,
        poses: snapshot.poses.map((pose) => ({
          objectId: pose.objectId,
          positionM: pose.positionMetres,
          orientationQuaternion: pose.rotation,
          linearVelocityMps: pose.linearVelocityMetresPerSecond,
          angularVelocityRadps: pose.angularVelocityRadiansPerSecond,
        })),
        listener: scene.listener,
        physicsEvents: snapshot.events,
        behaviorDecisions: result.decisions,
        audioEvents: result.events,
        acousticFrames,
        acousticResultRefs: acousticFrames.map((frame) => frame.requestId),
        behaviorSnapshot: {
          inputFrame,
          preStepSnapshot,
          runtimeSnapshot,
          voiceIntents: result.voices,
        },
      });
    }
    const artifact = await recorder.finish();
    await verifyRecording(artifact);
    return artifact;
  } finally {
    world.dispose();
  }
}

test("EMITTER-GEO-07: pure-box legacy fixed baseline cannot be silently reevaluated under the new caller policy", async () => {
  const original = await sealedBoxCapture("fixed", false, "fixed.legacy-baseline");
  const before = canonicalStringify(original);
  assert.ok(original.configuration.sceneSnapshot.objects.every((object) => object.shape === "box"));
  assert.equal(original.configuration.backendVersion, LEGACY_ACOUSTIC_MODEL_VERSION);
  const processor = new RecordingProcessor({ getAssets: () => [] });
  const config = original.configuration;
  await assert.rejects(
    processor.process(
      original.frames[0]!,
      {
        runId: "fixed.new-candidate",
        sceneSnapshot: config.sceneSnapshot,
        behaviorConfig: config.behaviorConfig,
        atmosphere: config.atmosphere,
        materialRegistry: config.materialRegistry,
        solverConfig: {
          ...(config.solverConfig as Record<string, unknown>),
          ...emitterGeometryPolicyPin(),
        },
      },
      config,
    ),
    { code: "CAPABILITY_UNSUPPORTED" },
  );
  assert.equal(canonicalStringify(original), before);
});

test("EMITTER-GEO-08: legacy detached recording remains playable verbatim without inserting the new policy", async () => {
  const original = await sealedBoxCapture("fixed", false, "fixed.legacy-replay");
  const before = canonicalStringify(original);
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), limiterEnabled: false });
  await engine.enable(0);
  engine.setMuted(false);
  const replay = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
  try {
    await replay.begin(original);
    for (const frame of original.frames) {
      context.currentTime = frame.tick / 60;
      replay.applyFrame(frame);
    }
    assert.ok(engine.getTelemetry().activeVoices >= 1);
    await replay.stop();
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(canonicalStringify(original), before);
    assert.equal(
      "emitterGeometryPolicy" in (original.configuration.solverConfig as Record<string, unknown>),
      false,
    );
  } finally {
    engine.dispose();
  }
});

test("EMITTER-GEO-09: same-new-policy object A to fixed B remains a matched behavior comparison", async () => {
  const a = await sealedBoxCapture("object", true, "policy.object-a");
  const b = await sealedBoxCapture("fixed", true, "policy.fixed-b");
  assert.deepEqual(a.configuration.solverConfig, b.configuration.solverConfig);
  assert.equal(a.fingerprints.solverConfigHash, b.fingerprints.solverConfigHash);
  const comparison = await compareRecordings(a, b, {
    kind: "behavior",
    independentVariables: ["behaviorProfile"],
  });
  assert.equal(comparison.matched, true, JSON.stringify(comparison.mismatches));
});

test("EMITTER-GEO-10: absent-versus-current policy produces a real solver fingerprint mismatch", async () => {
  const legacy = await sealedBoxCapture("fixed", false, "policy.missing");
  const current = await sealedBoxCapture("fixed", true, "policy.current");
  assert.notEqual(legacy.fingerprints.solverConfigHash, current.fingerprints.solverConfigHash);
  const comparison = await compareRecordings(legacy, current, {
    kind: "behavior",
    independentVariables: ["behaviorProfile"],
  });
  assert.equal(comparison.matched, false);
  assert.ok(comparison.mismatches.some((mismatch) => mismatch.field === "solverConfigHash"));
});
