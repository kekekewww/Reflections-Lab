import test from "node:test";
import assert from "node:assert/strict";
import type { ContactData } from "../../schemas/sound-behavior/types.js";
import { toBehaviorFrame } from "../../src/app/physics-behavior.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import type { BodyPose, PhysicsEvent, PhysicsSnapshot } from "../../src/physics/types.js";
import { context, document, impactRule, rule } from "../audio-behavior/fixtures.js";

// Synthetic SI fixture: vCOM=[2,0,0], omega=[0,0,-2], r=[0,-1,0].
// At the floor vCOM+omega cross r=[0,0,0]; the wall point has slip 1.6 m/s.
function supportContact(): ContactData {
  return {
    pairKey: "pair.ball-floor",
    episodeId: "episode.floor.7",
    objectA: "object.ball",
    objectB: "object.floor",
    colliderA: "collider.ball",
    colliderB: "collider.floor",
    materialA: "material.metal",
    materialB: "material.wood",
    pointWorldMetres: [0, 0, 0],
    normalAtoB: [0, -1, 0],
    normalImpulseNewtonSeconds: 0.8,
    impulseMethod: "RapierContactImpulse",
    closingSpeedMetresPerSecond: 0,
    tangentSpeedMetresPerSecond: 0,
    velocityMethod: "PreStepRigidBodyEstimate",
  };
}

function wallContact(): ContactData {
  return {
    ...supportContact(),
    pairKey: "pair.ball-wall",
    episodeId: "episode.wall.1",
    objectB: "object.wall",
    colliderB: "collider.wall",
    materialB: "material.metal",
    pointWorldMetres: [0.8, 1, 0],
    normalAtoB: [1, 0, 0],
    normalImpulseNewtonSeconds: 12,
    closingSpeedMetresPerSecond: 2,
    tangentSpeedMetresPerSecond: 1.6,
  };
}

function pose(objectId: string): BodyPose {
  const ball = objectId === "object.ball";
  return {
    objectId,
    generation: 1,
    positionMetres: ball ? [0, 1, 0] : [0, 0, 0],
    rotation: [0, 0, 0, 1],
    linearVelocityMetresPerSecond: ball ? [2, 0, 0] : [0, 0, 0],
    angularVelocityRadiansPerSecond: ball ? [0, 0, -2] : [0, 0, 0],
    mode: ball ? "dynamicGravity" : "fixed",
    sleeping: false,
    moving: ball,
    airborne: false,
    held: false,
    rolling: ball,
    sliding: false,
    spinning: ball,
    enabled: true,
    lifecycle: "active",
    discontinuity: false,
  };
}

function snapshot(): PhysicsSnapshot {
  return {
    tick: 1,
    simulationTimeSeconds: 1 / 60,
    fixedDtSeconds: 1 / 60,
    sceneRevision: 4,
    epoch: 1,
    paused: false,
    poses: [pose("object.ball"), pose("object.floor"), pose("object.wall")],
    events: [],
    heldObjectId: null,
    grabDiagnostics: null,
    player: null,
  };
}

function impact(contact: ContactData): PhysicsEvent {
  return {
    eventId: `physics.${contact.pairKey}`,
    tick: 1,
    sequence: 0,
    sceneRevision: 4,
    simulationTimeSeconds: 1 / 60,
    fixedDtSeconds: 1 / 60,
    objectId: "object.ball",
    generation: 1,
    type: "OnImpact",
    source: "physics",
    accepted: true,
    positionMetres: [...contact.pointWorldMetres],
    contact,
  };
}

for (const impulse of [0.8, null]) {
  test(`producer support contact owns continuous metrics despite stronger impact (support J=${impulse})`, () => {
    const input = snapshot();
    const support = supportContact();
    support.normalImpulseNewtonSeconds = impulse;
    support.impulseMethod = impulse === null ? "Unavailable" : "RapierContactImpulse";
    input.poses[0]!.contact = support;
    input.events = [impact(wallContact())];
    const frame = toBehaviorFrame(input, "epoch.test");
    const ball = frame.objects.find((object) => object.objectId === "object.ball")!;
    assert.deepEqual(ball.contact, support);
    assert.equal(ball.states.rolling, true);
    assert.deepEqual(ball.metrics, {
      sourceSpeedMetresPerSecond: 2,
      angularSpeedRadiansPerSecond: 2,
      normalImpulseNewtonSeconds: impulse,
      closingSpeedMetresPerSecond: 0,
      tangentSpeedMetresPerSecond: 0,
      slipSpeedMetresPerSecond: 0,
      contactSupportForceNewtons: null,
    });
    assert.deepEqual(frame.events[0]!.contact!.pointWorldMetres, [0.8, 1, 0]);
    assert.equal(frame.events[0]!.metrics!.normalImpulseNewtonSeconds, 12);
    assert.equal(frame.events[0]!.metrics!.tangentSpeedMetresPerSecond, 1.6);
    ball.contact!.pointWorldMetres[0] = 77;
    frame.events[0]!.contact!.pointWorldMetres[0] = 88;
    assert.deepEqual(support.pointWorldMetres, [0, 0, 0]);
    assert.deepEqual(input.events[0]!.contact!.pointWorldMetres, [0.8, 1, 0]);
  });
}

test("another participant's pose contact cannot replace the object's own producer contact", () => {
  const input = snapshot();
  input.poses[0]!.contact = supportContact();
  input.poses[2]!.contact = wallContact();
  for (const poses of [input.poses, [...input.poses].reverse()]) {
    const frame = toBehaviorFrame({ ...input, poses }, "epoch.test");
    assert.deepEqual(
      frame.objects.find((object) => object.objectId === "object.ball")!.contact!.pointWorldMetres,
      [0, 0, 0],
    );
    assert.deepEqual(
      frame.objects.find((object) => object.objectId === "object.wall")!.contact!.pointWorldMetres,
      [0.8, 1, 0],
    );
  }
});

test("event-only contact fallback keeps its deterministic impulse and pair ordering", () => {
  const input = snapshot();
  const strongest = { ...wallContact(), pairKey: "pair.a-wall" };
  const tied = {
    ...wallContact(),
    pairKey: "pair.z-wall",
    pointWorldMetres: [0.8, 2, 0] as [number, number, number],
  };
  const events = [impact(supportContact()), impact(tied), impact(strongest)];
  for (const ordered of [events, [...events].reverse()]) {
    const frame = toBehaviorFrame({ ...input, events: ordered }, "epoch.test");
    const ball = frame.objects.find((object) => object.objectId === "object.ball")!;
    assert.equal(ball.contact!.pairKey, "pair.a-wall");
    assert.deepEqual(ball.contact!.pointWorldMetres, [0.8, 1, 0]);
    assert.equal(ball.metrics.normalImpulseNewtonSeconds, 12);
  }
});

test("rolling and impact intents keep distinct emitter, material and parent-event provenance", () => {
  const input = snapshot();
  input.poses[0]!.contact = supportContact();
  input.events = [impact(wallContact())];
  const behaviorContext = context();
  behaviorContext.objects.push({ objectId: "object.wall", generation: 1 });
  behaviorContext.colliders!.push({ colliderId: "collider.wall", objectId: "object.wall" });
  const behaviorDocument = document([
    rule({
      ruleId: "rule.rolling",
      trigger: { kind: "continuous", type: "WhileRolling" },
      emitter: { attachment: "contact", aggregation: "representative" },
    }),
    impactRule(),
  ]);
  behaviorDocument.profiles[0]!.materialPairOverrides = [
    {
      overrideId: "override.floor-rolling",
      ruleId: "rule.rolling",
      materialA: "material.metal",
      materialB: "material.wood",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 330 },
    },
    {
      overrideId: "override.wall-rolling",
      ruleId: "rule.rolling",
      materialA: "material.metal",
      materialB: "material.metal",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 660 },
    },
    {
      overrideId: "override.wall-impact",
      ruleId: "rule.impact",
      materialA: "material.metal",
      materialB: "material.metal",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 880 },
    },
  ];
  const runtime = createBehaviorRuntime(behaviorDocument, behaviorContext, {
    experimentId: "experiment.support-anchor",
    runEpoch: "epoch.test",
  });
  const first = runtime.step(toBehaviorFrame(input, "epoch.test"));
  const rolling = first.voices.find((voice) => voice.event.ruleId === "rule.rolling")!;
  const hit = first.voices.find((voice) => voice.event.ruleId === "rule.impact")!;
  assert.deepEqual(rolling.event.positionMetres, [0, 0, 0]);
  assert.equal(rolling.event.contact!.pairKey, "pair.ball-floor");
  assert.equal(rolling.event.contact!.episodeId, "episode.floor.7");
  assert.equal(rolling.event.parentPhysicsEventId, undefined);
  assert.deepEqual(rolling.generator, { kind: "oscillator", waveform: "sine", frequencyHz: 330 });
  assert.deepEqual(hit.event.positionMetres, [0.8, 1, 0]);
  assert.equal(hit.event.contact!.pairKey, "pair.ball-wall");
  assert.equal(hit.event.parentPhysicsEventId, "physics.pair.ball-wall");
  assert.deepEqual(hit.generator, { kind: "oscillator", waveform: "sine", frequencyHz: 880 });
  input.tick = 2;
  input.simulationTimeSeconds = 2 / 60;
  input.events = [];
  input.poses[0]!.contact!.pointWorldMetres = [0.1, 0, 0];
  const second = runtime.step(toBehaviorFrame(input, "epoch.test"));
  const retained = second.events.find((event) => event.ruleId === "rule.rolling")!;
  assert.equal(retained.action, "update");
  assert.equal(retained.instanceId, rolling.event.instanceId);
  assert.deepEqual(retained.positionMetres, [0.1, 0, 0]);
  assert.equal(
    second.events.some((event) => event.action === "stop"),
    false,
  );
});
