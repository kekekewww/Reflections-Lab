import test from "node:test";
import assert from "node:assert/strict";
import {
  contactMotion,
  impactCandidates,
  movementTransition,
  interactionEvents,
} from "./physics-policy.mjs";

const contact = (extra = {}) => ({
  pairKey: "ball/floor",
  episodeId: "episode-1",
  regionId: "floor-top",
  contactKey: "one",
  normalImpulseNewtonSeconds: 1,
  closingSpeedMetresPerSecond: 2,
  positionMetres: [0, 0, 0],
  discontinuity: false,
  ...extra,
});

test("pure rolling requires contact, translation and matching angular contact-point velocity", () => {
  const rolling = contactMotion({
    supported: true,
    shape: "sphere",
    linearVelocity: [2, 0, 0],
    angularVelocity: [0, 0, -4],
    contactOffset: [0, -0.5, 0],
    surfaceVelocity: [0, 0, 0],
    surfaceAngularVelocity: [0, 0, 0],
    normal: [0, 1, 0],
  });
  assert.equal(rolling.kind, "ROLLING");
  assert.equal(rolling.slipSpeedMetresPerSecond, 0);
  const sliding = contactMotion({
    supported: true,
    shape: "sphere",
    linearVelocity: [2, 0, 0],
    angularVelocity: [0, 0, 0],
    contactOffset: [0, -0.5, 0],
    surfaceVelocity: [0, 0, 0],
    surfaceAngularVelocity: [0, 0, 0],
    normal: [0, 1, 0],
  });
  assert.equal(sliding.kind, "SLIDING");
  assert.equal(sliding.slipSpeedMetresPerSecond, 2);
});

test("moving surface and unsupported or unknown geometry do not become fake rolling", () => {
  const params = {
    supported: true,
    shape: "sphere",
    linearVelocity: [2, 0, 0],
    angularVelocity: [0, 0, 0],
    contactOffset: [0, -0.5, 0],
    surfaceVelocity: [2, 0, 0],
    surfaceAngularVelocity: [0, 0, 0],
    normal: [0, 1, 0],
  };
  assert.equal(contactMotion(params).kind, "RESTING");
  assert.equal(contactMotion({ ...params, supported: false }).kind, "UNSUPPORTED");
  assert.equal(contactMotion({ ...params, shape: "arbitrary-mesh" }).kind, "UNCLASSIFIED");
});

test("rolling/sliding candidate retains prior state in the slip hysteresis band", () => {
  const params = {
    supported: true,
    shape: "sphere",
    linearVelocity: [2, 0, 0],
    angularVelocity: [0, 0, -3.85],
    contactOffset: [0, -0.5, 0],
    surfaceVelocity: [0, 0, 0],
    surfaceAngularVelocity: [0, 0, 0],
    normal: [0, 1, 0],
  };
  assert.equal(contactMotion({ ...params, previousKind: "ROLLING" }).kind, "ROLLING");
  assert.equal(contactMotion({ ...params, previousKind: "SLIDING" }).kind, "SLIDING");
  assert.equal(contactMotion(params).kind, "UNCLASSIFIED");
});

test("linear start/stop uses hysteresis, retaining state between thresholds", () => {
  assert.equal(movementTransition(false, 0.21).event, "OnStartMoving");
  assert.deepEqual(movementTransition(true, 0.15), { moving: true, event: null });
  assert.equal(movementTransition(true, 0.09).event, "OnStopMoving");
  assert.deepEqual(movementTransition(false, 0.15), { moving: false, event: null });
});

test("multi-point impact sums impulse and uses an impulse-weighted contact position once", () => {
  const trace = [
    contact({ normalImpulseNewtonSeconds: 1, positionMetres: [0, 0, 0] }),
    contact({ contactKey: "two", normalImpulseNewtonSeconds: 3, positionMetres: [4, 0, 0] }),
  ];
  const { events } = impactCandidates({
    runEpoch: "epoch-1",
    tick: 30,
    contacts: trace,
    state: {},
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].normalImpulseNewtonSeconds, 4);
  assert.deepEqual(events[0].positionMetres, [3, 0, 0]);
});

test("support impulses and duplicate contact callbacks cannot retrigger an impact", () => {
  const first = impactCandidates({
    runEpoch: "epoch-1",
    tick: 1,
    contacts: [contact(), contact()],
    state: {},
  });
  assert.equal(first.events.length, 1);
  let state = first.state;
  for (let tick = 2; tick <= 61; tick++) {
    const next = impactCandidates({
      runEpoch: "epoch-1",
      tick,
      contacts: [contact({ closingSpeedMetresPerSecond: 0, normalImpulseNewtonSeconds: 0.1635 })],
      state,
    });
    assert.equal(next.events.length, 0);
    state = next.state;
  }
});

test("persistent episode cannot emit after cooldown merely because a held contact has large closing proxy", () => {
  const first = impactCandidates({
    runEpoch: "epoch-1",
    tick: 1,
    contacts: [contact()],
    state: {},
  });
  const persistent = impactCandidates({
    runEpoch: "epoch-1",
    tick: 20,
    contacts: [contact()],
    state: first.state,
  });
  assert.equal(persistent.events.length, 0);
  const bounce = impactCandidates({
    runEpoch: "epoch-1",
    tick: 2,
    contacts: [contact({ episodeId: "episode-2" })],
    state: first.state,
  });
  assert.equal(bounce.events.length, 0, "new episode still obeys pair-region cooldown");
});

test("two spatial regions remain distinct; per-episode cooldown and discontinuity suppress only audible candidates", () => {
  const a = impactCandidates({
    runEpoch: "epoch-1",
    tick: 10,
    contacts: [
      contact(),
      contact({ regionId: "wall", contactKey: "wall-contact", positionMetres: [1, 0, 0] }),
    ],
    state: {},
  });
  assert.equal(a.events.length, 2);
  const b = impactCandidates({
    runEpoch: "epoch-1",
    tick: 11,
    contacts: [contact()],
    state: a.state,
  });
  assert.equal(b.events.length, 0);
  assert.equal(
    impactCandidates({
      runEpoch: "epoch-1",
      tick: 40,
      contacts: [contact({ discontinuity: true })],
      state: {},
    }).events.length,
    0,
  );
  assert.equal(
    impactCandidates({
      runEpoch: "epoch-2",
      tick: 40,
      contacts: [contact({ normalImpulseNewtonSeconds: null })],
      state: {},
    }).events.length,
    0,
  );
});

test("explicit Throw differs from Drop and freefall; epoch replay keeps normalized event identity", () => {
  assert.deepEqual(
    interactionEvents({ type: "Throw", accepted: true, wasHeld: true, commandId: "command-1" }),
    ["OnRelease", "OnThrow"],
  );
  assert.deepEqual(
    interactionEvents({ type: "Drop", accepted: true, wasHeld: true, commandId: "command-2" }),
    ["OnRelease", "OnDrop"],
  );
  assert.deepEqual(
    interactionEvents({ type: "VelocitySample", accepted: true, wasHeld: false, speed: 100 }),
    [],
  );
  const input = { runEpoch: "epoch-1", tick: 30, contacts: [contact()], state: {} };
  assert.deepEqual(impactCandidates(input), impactCandidates(structuredClone(input)));
  assert.notEqual(
    impactCandidates(input).events[0].eventId,
    impactCandidates({ ...input, runEpoch: "epoch-2" }).events[0].eventId,
  );
});

test("invalid and overflow kinematic data fail closed instead of creating NaN policy decisions", () => {
  const valid = {
    supported: true,
    shape: "sphere",
    linearVelocity: [2, 0, 0],
    angularVelocity: [0, 0, -4],
    contactOffset: [0, -0.5, 0],
    surfaceVelocity: [0, 0, 0],
    surfaceAngularVelocity: [0, 0, 0],
    normal: [0, 1, 0],
  };
  assert.throws(() => contactMotion({ ...valid, normal: [0, 0, 0] }));
  assert.throws(() => contactMotion({ ...valid, linearVelocity: [NaN, 0, 0] }));
  assert.throws(() =>
    contactMotion({
      ...valid,
      angularVelocity: [0, 0, Number.MAX_VALUE],
      contactOffset: [Number.MAX_VALUE, 0, 0],
    }),
  );
  assert.throws(() => movementTransition(false, -1));
});

test("policy state cap cannot be disabled or widened by nonfinite/noninteger tuning", () => {
  const input = { runEpoch: "epoch-1", tick: 1, contacts: [], state: {} };
  for (const maxGroups of [NaN, Infinity, 0, -1, 1.5, 257]) {
    assert.throws(() => impactCandidates(input, { maxGroups }));
  }
});

test("shared rigid rotation with support has no relative rolling despite zero contact slip", () => {
  const result = contactMotion({
    supported: true,
    shape: "sphere",
    linearVelocity: [0, 1, 0],
    angularVelocity: [0, 0, 1],
    contactOffset: [0, -1, 0],
    surfaceVelocity: [1, 1, 0],
    surfaceAngularVelocity: [0, 0, 1],
    normal: [0, 1, 0],
  });
  assert.equal(result.slipSpeedMetresPerSecond, 0);
  assert.equal(result.kind, "RESTING");
});

test("unknown support angular velocity cannot be silently assumed stationary for rolling", () => {
  const result = contactMotion({
    supported: true,
    shape: "sphere",
    linearVelocity: [2, 0, 0],
    angularVelocity: [0, 0, -4],
    contactOffset: [0, -0.5, 0],
    surfaceVelocity: [0, 0, 0],
    normal: [0, 1, 0],
  });
  assert.equal(result.kind, "UNCLASSIFIED");
});
