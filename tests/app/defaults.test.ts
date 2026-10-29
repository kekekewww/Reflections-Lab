import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import { toBehaviorFrame } from "../../src/app/physics-behavior.js";
import { createScene } from "../../src/scene/index.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { stableHash } from "../../src/physics/math.js";
import type { BodyPose, PhysicsEvent, PhysicsSnapshot } from "../../src/physics/types.js";
import type { ContactData } from "../../schemas/sound-behavior/types.js";

function snapshot(): PhysicsSnapshot {
  const scene = createDefaultScene();
  const poses: BodyPose[] = scene.objects.map((object) => ({
    objectId: object.id,
    generation: 1,
    positionMetres: [...object.positionM],
    rotation: [...object.orientationQuaternion],
    linearVelocityMetresPerSecond: [0, 0, 0],
    angularVelocityRadiansPerSecond: [0, 0, 0],
    mode: object.mode,
    sleeping: false,
    moving: false,
    airborne: object.mode === "dynamicGravity",
    held: false,
    rolling: null,
    sliding: null,
    spinning: false,
    enabled: true,
    lifecycle: "active",
    discontinuity: false,
  }));
  return {
    tick: 1,
    simulationTimeSeconds: 1 / 60,
    fixedDtSeconds: 1 / 60,
    sceneRevision: scene.sceneRevision,
    epoch: 1,
    paused: false,
    poses,
    events: [],
    heldObjectId: null,
    grabDiagnostics: null,
    player: null,
  };
}

function ballPose(input: PhysicsSnapshot): BodyPose {
  return input.poses.find((pose) => pose.mode === "dynamicGravity")!;
}

function contact(input: PhysicsSnapshot): ContactData {
  const scene = createDefaultScene();
  const ball = ballPose(input);
  const surface = scene.objects.find(
    (object) => object.mode === "fixed" && object.shape === "box",
  )!;
  return {
    pairKey: "pair.ball-floor",
    episodeId: "episode.ball-floor.1",
    objectA: ball.objectId,
    objectB: surface.id,
    colliderA: `col-${stableHash(ball.objectId)}`,
    colliderB: `col-${stableHash(surface.id)}`,
    materialA: scene.objects.find((object) => object.id === ball.objectId)!.physicsMaterialId,
    materialB: surface.physicsMaterialId,
    pointWorldMetres: [0.2, 0.05, -0.3],
    normalAtoB: [0, -1, 0],
    normalImpulseNewtonSeconds: 3,
    impulseMethod: "RapierContactImpulse",
    closingSpeedMetresPerSecond: 2,
    tangentSpeedMetresPerSecond: 1,
    velocityMethod: "PreStepRigidBodyEstimate",
  };
}

function event(input: PhysicsSnapshot, patch: Partial<PhysicsEvent> = {}): PhysicsEvent {
  return {
    eventId: "physics.impact.1",
    tick: input.tick,
    sequence: 7,
    sceneRevision: input.sceneRevision,
    simulationTimeSeconds: input.simulationTimeSeconds,
    fixedDtSeconds: input.fixedDtSeconds,
    objectId: ballPose(input).objectId,
    generation: ballPose(input).generation,
    type: "OnImpact",
    source: "physics",
    accepted: true,
    positionMetres: [...contact(input).pointWorldMetres],
    contact: contact(input),
    ...patch,
  };
}

test("default SceneSpec passes the production validator with linked sources and independent listener", () => {
  const scene = createDefaultScene();
  assert.deepEqual(createScene(scene), scene);
  assert.equal(scene.listener.attachment, "independent");
  assert.deepEqual(scene.listener.positionM, [0, 1.6, 4]);
  assert.deepEqual(scene.listener.orientationQuaternion, [0, 0, 0, 1]);
  assert.ok(
    scene.objects.some((object) => object.shape === "sphere" && object.mode === "dynamicGravity"),
  );
  assert.ok(
    scene.objects.filter((object) => object.shape === "box" && object.mode === "fixed").length >= 4,
  );
  assert.ok(
    scene.sources.some(
      (source) =>
        source.mode === "continuous" &&
        scene.objects.some((object) => object.id === source.objectId && object.mode === "fixed"),
    ),
  );
  const copy = createDefaultScene();
  scene.objects[0]!.positionM[0] = 123;
  assert.notEqual(copy.objects[0]!.positionM[0], 123);
});

test("default material bands conserve A/R/T and retain explicit Synthetic provenance", () => {
  for (const id of ["material.hard", "material.soft", "material.wood", "material.metal"]) {
    const material = DEFAULT_MATERIALS.find((candidate) => candidate.id === id);
    assert.ok(material, `missing ${id}`);
    assert.equal(material.dataClass, "Synthetic");
    assert.ok(material.conditions.trim().length > 0);
    assert.equal(material.bands.length, 7);
    for (const band of material.bands) {
      assert.ok(
        Math.abs(band.absorptionEnergy + band.reflectionEnergy + band.transmissionEnergy - 1) <
          1e-12,
      );
      assert.ok(
        band.absorptionEnergy >= 0 && band.reflectionEnergy >= 0 && band.transmissionEnergy >= 0,
      );
      assert.ok(band.scatteringFraction >= 0 && band.scatteringFraction <= 1);
    }
  }
});

test("oscillator defaults create a real behavior runtime without fixture or missing assets", () => {
  const scene = createDefaultScene();
  const input = snapshot();
  const document = createDefaultBehaviors(scene);
  assert.deepEqual(document.assets, []);
  assert.ok(
    document.profiles
      .flatMap((profile) => profile.rules)
      .every((rule) => rule.generator.kind === "oscillator"),
  );
  const context = makeBehaviorContext(scene, input.poses, []);
  const runtime = createBehaviorRuntime(document, context, {
    experimentId: "experiment.defaults",
    runEpoch: "epoch.defaults",
  });
  const result = runtime.step(toBehaviorFrame(input, "epoch.defaults"));
  const continuous = result.events.filter(
    (item) => item.action === "start" && item.trigger.type === "AlwaysOn",
  );
  assert.ok(continuous.length >= 1);
  for (const emitted of continuous) {
    assert.ok(
      scene.sources.some(
        (source) => source.objectId === emitted.objectId && source.mode === "continuous",
      ),
    );
  }
  for (const rule of document.profiles.flatMap((profile) => profile.rules)) {
    if (rule.trigger.kind === "discrete" && rule.generator.kind === "oscillator") {
      assert.ok(Number.isFinite(rule.oneShotDurationSeconds) && rule.oneShotDurationSeconds! > 0);
      assert.ok(rule.fadeInSeconds + rule.fadeOutSeconds <= rule.oneShotDurationSeconds!);
    }
  }
  const second = createDefaultBehaviors(scene);
  document.profiles[0]!.rules[0]!.enabled = false;
  assert.equal(second.profiles[0]!.rules[0]!.enabled, true);
});

test("behavior context uses actual body generations and trusted registry without aliases", () => {
  const scene = createDefaultScene();
  const input = snapshot();
  input.poses[0]!.generation = 7;
  const assets = [
    {
      assetId: "asset.ready",
      revision: 1,
      sha256: "a".repeat(64),
      availability: "READY" as const,
      rightsStatus: "APPROVED" as const,
      durationSeconds: 1,
    },
  ];
  const context = makeBehaviorContext(scene, input.poses, assets);
  assert.equal(context.sceneRevision, scene.sceneRevision);
  assert.equal(
    context.objects.find((object) => object.objectId === input.poses[0]!.objectId)!.generation,
    7,
  );
  assert.equal(context.assetRegistry[0]!.availability, "READY");
  for (const object of scene.objects) {
    assert.ok(context.materialIds.includes(object.physicsMaterialId));
    assert.ok(context.materialIds.includes(object.acousticMaterialId));
  }
  context.assetRegistry[0]!.sha256 = "b".repeat(64);
  assert.equal(assets[0]!.sha256, "a".repeat(64));
});

test("physics adapter derives SI speed magnitudes and keeps unknown contact states unknown", () => {
  const input = snapshot();
  const ball = ballPose(input);
  ball.linearVelocityMetresPerSecond = [3, 4, 0];
  ball.angularVelocityRadiansPerSecond = [0, 0, 2];
  const frame = toBehaviorFrame(input, "epoch.adapter");
  const output = frame.objects.find((object) => object.objectId === ball.objectId)!;
  assert.equal(output.metrics.sourceSpeedMetresPerSecond, 5);
  assert.equal(output.metrics.angularSpeedRadiansPerSecond, 2);
  assert.equal(output.states.rolling, null);
  assert.equal(output.states.sliding, null);
  assert.ok(
    output.metrics.contactSupportForceNewtons === null ||
      output.metrics.contactSupportForceNewtons === undefined,
  );
  assert.ok(
    output.metrics.normalImpulseNewtonSeconds === null ||
      output.metrics.normalImpulseNewtonSeconds === undefined,
  );
  assert.equal(frame.runEpoch, "epoch.adapter");
  assert.equal(frame.tick, input.tick);
  assert.equal(frame.sceneRevision, input.sceneRevision);
  output.positionMetres[0] = 99;
  assert.notEqual(ball.positionMetres[0], 99);
});

test("contact begins and fast motion never fabricate an impact or throw", () => {
  const input = snapshot();
  ballPose(input).linearVelocityMetresPerSecond = [0, 0, -30];
  input.events = [
    event(input, { type: "ContactBegin" }),
    event(input, { eventId: "physics.mode", type: "BodyModeChanged" }),
  ];
  assert.deepEqual(toBehaviorFrame(input, "epoch.adapter").events, []);
});

test("accepted discrete physics inputs preserve provenance, contact location and impulse units", () => {
  const input = snapshot();
  const thrown = event(input, {
    eventId: "interaction.throw",
    sequence: 8,
    type: "OnThrow",
    source: "interaction",
    commandId: "command.throw",
  });
  delete thrown.contact;
  input.events = [event(input), thrown];
  const output = toBehaviorFrame(input, "epoch.adapter");
  const impact = output.events.find((item) => item.type === "OnImpact")!;
  assert.equal(impact.eventId, input.events[0]!.eventId);
  assert.equal(impact.sequence, 7);
  assert.equal(impact.generation, ballPose(input).generation);
  assert.equal(impact.source, "physics");
  assert.equal(impact.accepted, true);
  assert.equal(impact.metrics!.normalImpulseNewtonSeconds, 3);
  assert.equal(impact.metrics!.closingSpeedMetresPerSecond, 2);
  assert.equal(impact.metrics!.tangentSpeedMetresPerSecond, 1);
  assert.ok(
    impact.metrics!.contactSupportForceNewtons === null ||
      impact.metrics!.contactSupportForceNewtons === undefined,
  );
  assert.deepEqual(impact.contact!.pointWorldMetres, [0.2, 0.05, -0.3]);
  assert.equal(output.events.find((item) => item.type === "OnThrow")!.commandId, "command.throw");
  impact.contact!.pointWorldMetres[0] = 99;
  assert.equal(input.events[0]!.contact!.pointWorldMetres[0], 0.2);
});

test("unavailable contact data stay unknown and rejected commands are never marked accepted", () => {
  const input = snapshot();
  const unknown = contact(input);
  unknown.normalImpulseNewtonSeconds = null;
  unknown.impulseMethod = "Unavailable";
  unknown.closingSpeedMetresPerSecond = null;
  unknown.tangentSpeedMetresPerSecond = null;
  unknown.velocityMethod = "Unavailable";
  const rejected = event(input, {
    eventId: "interaction.rejected",
    sequence: 9,
    type: "OnThrow",
    source: "interaction",
    commandId: "command.rejected",
    accepted: false,
  });
  delete rejected.contact;
  input.events = [event(input, { contact: unknown }), rejected];
  const output = toBehaviorFrame(input, "epoch.adapter");
  const impact = output.events.find((item) => item.type === "OnImpact")!;
  assert.ok(
    impact.metrics?.normalImpulseNewtonSeconds === null ||
      impact.metrics?.normalImpulseNewtonSeconds === undefined,
  );
  assert.ok(
    impact.metrics?.closingSpeedMetresPerSecond === null ||
      impact.metrics?.closingSpeedMetresPerSecond === undefined,
  );
  assert.ok(
    impact.metrics?.tangentSpeedMetresPerSecond === null ||
      impact.metrics?.tangentSpeedMetresPerSecond === undefined,
  );
  assert.ok(
    impact.metrics?.contactSupportForceNewtons === null ||
      impact.metrics?.contactSupportForceNewtons === undefined,
  );
  const carried = output.events.find((item) => item.eventId === rejected.eventId);
  if (carried) assert.equal(carried.accepted, false);
});

test("default impact emits at the contact and does not stop its independent continuous source", () => {
  const scene = createDefaultScene();
  const input = snapshot();
  const runtime = createBehaviorRuntime(
    createDefaultBehaviors(scene),
    makeBehaviorContext(scene, input.poses, []),
    { experimentId: "experiment.integration", runEpoch: "epoch.integration" },
  );
  const first = runtime.step(toBehaviorFrame(input, "epoch.integration"));
  const continuousId = first.events.find(
    (item) => item.action === "start" && item.trigger.type === "AlwaysOn",
  )!.instanceId;
  input.tick = 2;
  input.simulationTimeSeconds = 2 / 60;
  input.events = [event(input)];
  const result = runtime.step(toBehaviorFrame(input, "epoch.integration"));
  const impact = result.events.find(
    (item) => item.action === "start" && item.trigger.type === "OnImpact",
  );
  assert.ok(impact);
  assert.deepEqual(impact.positionMetres, [0.2, 0.05, -0.3]);
  assert.equal(
    result.events.some((item) => item.instanceId === continuousId && item.action === "stop"),
    false,
  );
});

test("Scene source playing and dBFS gain control their default continuous binding", () => {
  const silentScene = createDefaultScene();
  silentScene.sources[0]!.playing = false;
  const input = snapshot();
  const silent = createBehaviorRuntime(
    createDefaultBehaviors(silentScene),
    makeBehaviorContext(silentScene, input.poses, []),
    { experimentId: "experiment.source-silent", runEpoch: "epoch.source-silent" },
  );
  assert.equal(
    silent
      .step(toBehaviorFrame(input, "epoch.source-silent"))
      .events.some((item) => item.action === "start" && item.trigger.type === "AlwaysOn"),
    false,
  );
  const quietScene = createDefaultScene();
  quietScene.sources[0]!.gainDbfs = -30;
  const quiet = createBehaviorRuntime(
    createDefaultBehaviors(quietScene),
    makeBehaviorContext(quietScene, input.poses, []),
    { experimentId: "experiment.source-gain", runEpoch: "epoch.source-gain" },
  );
  const emitted = quiet
    .step(toBehaviorFrame(input, "epoch.source-gain"))
    .events.find((item) => item.action === "start" && item.trigger.type === "AlwaysOn");
  assert.ok(emitted);
  assert.ok(Math.abs(emitted.gainLinear - 10 ** (-30 / 20)) < 1e-12);
});

test("real Rapier falling-ball contact reaches the default behavior with canonical collider ownership", async () => {
  const scene = createDefaultScene();
  const world = await PhysicsWorld.create(scene);
  try {
    const context = makeBehaviorContext(scene, world.snapshot().poses, []);
    const runtime = createBehaviorRuntime(createDefaultBehaviors(scene), context, {
      experimentId: "experiment.real-contact",
      runEpoch: "epoch.real-contact",
    });
    world.resume();
    let observed = false;
    for (let tick = 0; tick < 180 && !observed; tick++) {
      const physics = world.step();
      const frame = toBehaviorFrame(physics, "epoch.real-contact");
      const output = runtime.step(frame);
      const impact = physics.events.find((item) => item.type === "OnImpact" && item.accepted);
      if (!impact) continue;
      assert.equal(impact.generation, 1);
      assert.ok(impact.contact);
      assert.ok(
        context.colliders!.some(
          (item) =>
            item.colliderId === impact.contact!.colliderA &&
            item.objectId === impact.contact!.objectA,
        ),
      );
      assert.ok(
        context.colliders!.some(
          (item) =>
            item.colliderId === impact.contact!.colliderB &&
            item.objectId === impact.contact!.objectB,
        ),
      );
      const audio = output.events.find(
        (item) =>
          item.action === "start" &&
          item.trigger.type === "OnImpact" &&
          item.parentPhysicsEventId === impact.eventId,
      );
      assert.ok(audio, "Accepted physical contact must produce the configured impact intent");
      assert.deepEqual(audio.positionMetres, impact.contact.pointWorldMetres);
      assert.notDeepEqual(
        audio.positionMetres,
        physics.poses.find((pose) => pose.objectId === impact.objectId)!.positionMetres,
      );
      assert.equal(audio.generation, impact.generation);
      assert.equal(audio.sceneRevision, physics.sceneRevision);
      observed = true;
    }
    assert.ok(
      observed,
      "Gravity-driven ball must reach an accepted floor impact within three simulated seconds",
    );
  } finally {
    world.dispose();
  }
});

test("producer support contact stays the continuous anchor when a stronger impact occurs elsewhere", () => {
  const scene = createDefaultScene();
  const input = snapshot();
  const support = contact(input);
  support.normalImpulseNewtonSeconds = 0.8;
  support.pointWorldMetres = [-0.8, 0, 0];
  const wall = scene.objects.find(
    (object) => object.mode === "fixed" && object.shape === "box" && object.id !== support.objectB,
  )!;
  const wallImpact: ContactData = {
    ...structuredClone(support),
    pairKey: "pair.ball-wall",
    episodeId: "episode.ball-wall.1",
    objectB: wall.id,
    colliderB: `col-${stableHash(wall.id)}`,
    materialB: wall.physicsMaterialId,
    pointWorldMetres: [-0.55, 0.35, 0],
    normalAtoB: [1, 0, 0],
    normalImpulseNewtonSeconds: 12,
    closingSpeedMetresPerSecond: 4,
  };
  const ball = ballPose(input) as BodyPose & { contact?: ContactData };
  ball.contact = support;
  ball.rolling = true;
  ball.sliding = false;
  input.events = [
    event(input, { contact: wallImpact, positionMetres: [...wallImpact.pointWorldMetres] }),
  ];
  const frame = toBehaviorFrame(input, "epoch.support-contact");
  const normalizedBall = frame.objects.find((object) => object.objectId === ball.objectId)!;
  assert.equal(normalizedBall.states.rolling, true);
  assert.deepEqual(normalizedBall.contact!.pointWorldMetres, support.pointWorldMetres);
  assert.equal(normalizedBall.contact!.pairKey, support.pairKey);
  assert.equal(normalizedBall.metrics.normalImpulseNewtonSeconds, 0.8);
  assert.deepEqual(frame.events[0]!.contact!.pointWorldMetres, wallImpact.pointWorldMetres);
  assert.equal(frame.events[0]!.metrics!.normalImpulseNewtonSeconds, 12);
});
