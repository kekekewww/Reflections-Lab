import test from "node:test";
import assert from "node:assert/strict";
import { PhysicsBounceProducer, type BounceStep } from "../../src/physics/bounce-producer.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import { toBehaviorFrame } from "../../src/app/physics-behavior.js";
import { createDefaultScene, makeBehaviorContext } from "../../src/app/defaults.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { document, impactRule } from "../audio-behavior/fixtures.js";
import type { ContactData } from "../../schemas/sound-behavior/types.js";
import type { BodyPose, PhysicsEvent } from "../../src/physics/types.js";

function pose(objectId: string, mode: BodyPose["mode"]): BodyPose {
  return {
    objectId,
    generation: 1,
    positionMetres: mode === "fixed" ? [0, -0.1, 0] : [0, 0.25, 0],
    rotation: [0, 0, 0, 1],
    linearVelocityMetresPerSecond: mode === "fixed" ? [0, 0, 0] : [0, 1, 0],
    angularVelocityRadiansPerSecond: [0, 0, 0],
    mode,
    sleeping: false,
    moving: mode !== "fixed",
    airborne: mode !== "fixed",
    held: false,
    rolling: false,
    sliding: false,
    spinning: false,
    enabled: true,
    lifecycle: "active",
    discontinuity: false,
  };
}

function contact(): ContactData {
  return {
    pairKey: "pair.ball-floor",
    episodeId: "episode.ball-floor.1",
    objectA: "object.ball",
    objectB: "object.floor",
    colliderA: "collider.ball",
    colliderB: "collider.floor",
    materialA: "material.metal",
    materialB: "material.wood",
    pointWorldMetres: [0, 0, 0],
    normalAtoB: [0, -1, 0],
    normalImpulseNewtonSeconds: 3,
    impulseMethod: "RapierContactImpulse",
    closingSpeedMetresPerSecond: 2,
    tangentSpeedMetresPerSecond: 0,
    velocityMethod: "PreStepRigidBodyEstimate",
  };
}

function event(
  tick: number,
  type: PhysicsEvent["type"],
  patch: Partial<PhysicsEvent> = {},
): PhysicsEvent {
  return {
    eventId: `physics.${type}.${tick}`,
    tick,
    sequence: 0,
    sceneRevision: 4,
    simulationTimeSeconds: tick / 60,
    fixedDtSeconds: 1 / 60,
    objectId: "object.ball",
    generation: 1,
    type,
    source: "physics",
    accepted: true,
    positionMetres: [0, 0, 0],
    otherObjectId: "object.floor",
    ...(type === "OnImpact" ? { contact: contact() } : {}),
    ...patch,
  };
}

function frame(tick: number, events: PhysicsEvent[] = []): BounceStep {
  return {
    tick,
    epoch: 1,
    sceneRevision: 4,
    fixedDtSeconds: 1 / 60,
    poses: [pose("object.ball", "dynamicGravity"), pose("object.floor", "fixed")],
    events,
  };
}

test("bounce needs an accepted parent impact, separation, and outgoing canonical contact velocity", () => {
  const producer = new PhysicsBounceProducer();
  assert.deepEqual(producer.step(frame(1, [event(1, "OnImpact")])), []);
  const ended = frame(2, [event(2, "ContactEnd", { sequence: 7 })]);
  const [bounce] = producer.step(ended);
  assert.equal(bounce?.type, "OnBounce");
  assert.equal(bounce?.sequence, 8);
  assert.equal(bounce?.source, "physics");
  assert.equal(bounce?.generation, 1);
  assert.match(bounce!.reason!, /parentImpact=physics.OnImpact.1/);
  assert.equal(bounce?.contact?.episodeId, contact().episodeId);
  assert.equal(producer.getEvidence()[0]?.outgoingNormalSpeedMetresPerSecond, 1);
  assert.equal(producer.getEvidence()[0]?.parentImpactEventId, "physics.OnImpact.1");
  assert.deepEqual(producer.step(ended), []);
  assert.deepEqual(producer.step(frame(3, [event(3, "ContactEnd")])), []);
  assert.equal(producer.getEvidence().length, 1);
});

test("canonical object order does not change the emitting owner or separation sign", () => {
  const producer = new PhysicsBounceProducer();
  const impact = event(1, "OnImpact");
  impact.contact = {
    ...contact(),
    objectA: "object.floor",
    objectB: "object.ball",
    colliderA: "collider.floor",
    colliderB: "collider.ball",
    materialA: "material.wood",
    materialB: "material.metal",
    normalAtoB: [0, 1, 0],
  };
  producer.step(frame(1, [impact]));
  const [bounce] = producer.step(
    frame(2, [event(2, "ContactEnd", { objectId: "object.floor", otherObjectId: "object.ball" })]),
  );
  assert.equal(bounce?.objectId, "object.ball");
  assert.equal(bounce?.otherObjectId, "object.floor");
});

test("sliding off a ledge or ending contact without a parent is not a bounce", () => {
  const producer = new PhysicsBounceProducer();
  assert.deepEqual(producer.step(frame(1, [event(1, "ContactEnd")])), []);
  producer.step(frame(2, [event(2, "OnImpact")]));
  const sliding = frame(3, [event(3, "ContactEnd")]);
  sliding.poses[0]!.linearVelocityMetresPerSecond = [5, 0, 0];
  assert.deepEqual(producer.step(sliding), []);
  const rejected = new PhysicsBounceProducer();
  rejected.step(frame(1, [event(1, "OnImpact", { accepted: false })]));
  assert.deepEqual(rejected.step(frame(2, [event(2, "ContactEnd")])), []);
});

test("contact point speed transports the impact local anchor through rotation", () => {
  const producer = new PhysicsBounceProducer();
  producer.step(frame(1, [event(1, "OnImpact")]));
  const rotating = frame(2, [event(2, "ContactEnd")]);
  rotating.poses[0]!.rotation = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  rotating.poses[0]!.linearVelocityMetresPerSecond = [0, 0, 0];
  rotating.poses[0]!.angularVelocityRadiansPerSecond = [0, 0, 2];
  assert.equal(producer.step(rotating).length, 1);
  assert.ok(Math.abs(producer.getEvidence()[0]!.outgoingNormalSpeedMetresPerSecond - 0.5) < 1e-12);
});

test("dynamic pairs and changed fixed supports remain unclassified", () => {
  for (const support of ["dynamic", "translated", "rotated"] as const) {
    const producer = new PhysicsBounceProducer();
    const initial = frame(1, [event(1, "OnImpact")]);
    if (support === "dynamic") initial.poses[1]!.mode = "dynamicGravity";
    producer.step(initial);
    const ended = frame(2, [event(2, "ContactEnd")]);
    if (support === "translated") ended.poses[1]!.positionMetres[0] = 0.01;
    if (support === "rotated") ended.poses[1]!.rotation = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    assert.deepEqual(producer.step(ended), [], support);
  }
});

test("mode, generation, held, discontinuity, revision and epoch changes invalidate causality", () => {
  for (const change of [
    "mode",
    "generation",
    "held",
    "discontinuity",
    "revision",
    "epoch",
  ] as const) {
    const producer = new PhysicsBounceProducer();
    producer.step(frame(1, [event(1, "OnImpact")]));
    const ended = frame(2, [event(2, "ContactEnd")]);
    if (change === "mode") ended.poses[0]!.mode = "dynamicNoGravity";
    if (change === "generation") ended.poses[0]!.generation++;
    if (change === "held") ended.poses[0]!.held = true;
    if (change === "discontinuity") ended.poses[0]!.discontinuity = true;
    if (change === "revision") ended.sceneRevision++;
    if (change === "epoch") ended.epoch++;
    assert.deepEqual(producer.step(ended), [], change);
  }
});

test("accepted interaction, command impulse invalidation and new contact episodes clear pending bounce", () => {
  for (const type of [
    "OnGrab",
    "OnThrow",
    "OnDrop",
    "OnRelease",
    "ContactInvalidated",
    "BodyModeChanged",
    "ContactBegin",
  ] as const) {
    const producer = new PhysicsBounceProducer();
    producer.step(frame(1, [event(1, "OnImpact")]));
    producer.step(
      frame(2, [
        event(
          2,
          type,
          type.startsWith("On") ? { source: "interaction", commandId: "command.test" } : {},
        ),
      ]),
    );
    assert.deepEqual(producer.step(frame(3, [event(3, "ContactEnd")])), [], type);
  }
  const producer = new PhysicsBounceProducer();
  producer.step(frame(1, [event(1, "OnImpact")]));
  producer.invalidateObject("object.ball");
  assert.deepEqual(producer.step(frame(2, [event(2, "ContactEnd")])), []);
});

test("window and candidate budget are finite; reset removes old evidence", () => {
  const producer = new PhysicsBounceProducer({ windowSeconds: 1 / 60 });
  producer.step(frame(1, [event(1, "OnImpact")]));
  producer.step(frame(2));
  assert.deepEqual(producer.step(frame(3, [event(3, "ContactEnd")])), []);
  const bounded = new PhysicsBounceProducer({ maxPending: 1 });
  const crowded = frame(1, [
    event(1, "OnImpact"),
    event(1, "OnImpact", {
      eventId: "physics.other",
      objectId: "object.other",
      sequence: 1,
      contact: {
        ...contact(),
        objectA: "object.other",
        pairKey: "pair.other-floor",
        episodeId: "episode.other-floor.1",
      },
    }),
  ]);
  crowded.poses = [...crowded.poses, pose("object.other", "dynamicGravity")];
  assert.throws(
    () => bounded.step(crowded),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "BOUNCE_CANDIDATE_BUDGET",
  );
  producer.reset();
  assert.deepEqual(producer.getEvidence(), []);
  for (const options of [
    { maxPending: 0 },
    { maxPending: 1.2 },
    { windowSeconds: Infinity },
    { minOutgoingSpeedMps: 0 },
  ])
    assert.throws(() => new PhysicsBounceProducer(options));
});

test("Rapier bounce is a raw physics event consumed unchanged by the behavior adapter and evaluator", async () => {
  const scene = createDefaultScene();
  const ball = scene.objects.find((entry) => entry.mode === "dynamicGravity")!;
  ball.positionM = [0, 1.5, 0];
  ball.restitution = 0.85;
  for (const entry of scene.objects) if (entry.mode === "fixed") entry.restitution = 0.85;
  const world = await PhysicsWorld.create(scene);
  const doc = document([
    impactRule({ ruleId: "rule.bounce", trigger: { kind: "discrete", type: "OnBounce" } }),
  ]);
  doc.bindings[0]!.objectId = ball.id;
  const behavior = createBehaviorRuntime(doc, makeBehaviorContext(scene, world.snapshot().poses), {
    experimentId: "experiment.bounce",
    runEpoch: "epoch.bounce",
  });
  const impacts: PhysicsEvent[] = [],
    bounces: PhysicsEvent[] = [];
  let emissions = 0;
  try {
    world.resume();
    for (let i = 0; i < 180; i++) {
      const snapshot = world.step(),
        input = toBehaviorFrame(snapshot, "epoch.bounce");
      const raw = snapshot.events.filter((entry) => entry.type === "OnBounce");
      impacts.push(...snapshot.events.filter((entry) => entry.type === "OnImpact"));
      bounces.push(...raw);
      assert.deepEqual(
        input.events.filter((entry) => entry.type === "OnBounce").map((entry) => entry.eventId),
        raw.map((entry) => entry.eventId),
      );
      emissions += behavior
        .step(input)
        .events.filter(
          (entry) => entry.trigger.type === "OnBounce" && entry.action === "start",
        ).length;
    }
    assert.ok(impacts.length > 0, "fixture must actually impact a surface");
    assert.ok(bounces.length > 0, "fixture must actually separate with outgoing velocity");
    assert.ok(emissions > 0, "real bounce must reach the evaluator");
    assert.equal(new Set(bounces.map((entry) => entry.eventId)).size, bounces.length);
    for (const bounce of bounces) {
      const parent = impacts.find((entry) =>
        bounce.reason?.endsWith(`parentImpact=${entry.eventId}`),
      );
      assert.ok(parent && bounce.tick >= parent.tick);
    }
  } finally {
    world.dispose();
  }
});
