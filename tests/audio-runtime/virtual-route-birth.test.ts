import assert from "node:assert/strict";
import test from "node:test";
import { PathRoute, ROUTE_DIRECTION_RAMP_SECONDS } from "../../src/audio/routes.js";
import type { AcousticFrame } from "../../src/audio/types.js";
import { FakeAudioContext, type Automation, type FakeAudioParam } from "./fake-context.js";

const sampleRate = 48000;
const birthFadeSeconds = 0.02;
const delayDeadbandSeconds = 1e-6;
const directionCoordinateDeadbandM = 1e-4;

function frame(scale = 1, delaySeconds = 0.075): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "virtual-route-birth-control-reference",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "literal-control-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000, 4000, 12000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delaySeconds,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_REQUESTS_ONLY; no native PCM, gap or hearing evidence"],
    paths: [
      {
        id: "born-reflection",
        sourceId: "source",
        listenerId: "listener",
        surfaceIds: ["wall"],
        order: 1,
        verticesM: [
          [0, 0, -1],
          [0, 0, 0],
        ],
        lengthM: delaySeconds * 343,
        absoluteDelayS: delaySeconds,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: [0.25 * scale, 0.5 * scale, scale],
      },
    ],
  };
}

function fixture(fadeIn = true, delaySeconds = 0.075) {
  const context = new FakeAudioContext();
  const initial = frame(1, delaySeconds);
  const route = new PathRoute(
    context.asContext(),
    context.createGain() as unknown as AudioNode,
    context.createGain() as unknown as AudioNode,
    initial,
    initial.paths[0]!,
    "equalpower",
    [0, 0, 0],
    fadeIn,
    birthFadeSeconds,
  );
  const gain = route.gain.gain as unknown as FakeAudioParam;
  const arrivalSeconds = delaySeconds + 64 / sampleRate;
  function update(time: number, scale = 1, delay = delaySeconds) {
    context.currentTime = time;
    const next = frame(scale, delay);
    route.update(next, next.paths[0]!, [0, 0, 0]);
  }
  return { context, route, gain, update, arrivalSeconds };
}

function assertBirthHold(events: readonly Automation[], arrival: number, target: number) {
  // Cancellation removes scheduled future events. A historical hold in the
  // recorder is insufficient: it must remain after the last cancellation.
  let cancellation = -1;
  for (let index = 0; index < events.length; index++)
    if (events[index]!.method.startsWith("cancel")) cancellation = index;
  const remaining = events.slice(cancellation + 1);
  assert.ok(
    remaining.some(
      (event) => event.method === "setValueAtTime" && event.time === arrival && event.value === 0,
    ),
    "gain must remain zero through the acoustic plus FIR arrival after any reschedule",
  );
  assert.deepEqual(remaining.at(-1), {
    method: "linearRampToValueAtTime",
    value: target,
    time: arrival + birthFadeSeconds,
  });
}

test("a same scalar target before path arrival cannot cancel its scheduled birth fade", () => {
  const f = fixture();
  try {
    const scheduled = structuredClone(f.gain.automation);
    // FakeAudioParam stores the final ramp target. Deliberately restore the
    // value observable at currentTime by a real AudioParam before arrival.
    f.gain.value = 0;
    f.update(0.01);
    assert.deepEqual(f.gain.automation, scheduled);
    assertBirthHold(f.gain.automation, f.arrivalSeconds, 1);
  } finally {
    f.route.disconnect();
  }
});

test("a changed scalar before path arrival preserves the hold and uses the latest birth target", () => {
  const f = fixture();
  try {
    f.gain.value = 0;
    f.update(0.01, 2);
    assertBirthHold(f.gain.automation, f.arrivalSeconds, 2);
    f.gain.value = 0;
    f.update(0.02, 4);
    assertBirthHold(f.gain.automation, f.arrivalSeconds, 4);
    const latest = structuredClone(f.gain.automation);
    f.gain.value = 0;
    f.update(0.03, 4);
    assert.deepEqual(f.gain.automation, latest, "same queued target cannot replace the birth hold");
  } finally {
    f.route.disconnect();
  }
});

test("a same scalar target during the birth fade retains the already scheduled endpoint", () => {
  const f = fixture();
  try {
    const scheduled = structuredClone(f.gain.automation);
    f.gain.value = 0.5;
    f.update(f.arrivalSeconds + birthFadeSeconds / 2);
    assert.deepEqual(f.gain.automation, scheduled);
    assertBirthHold(f.gain.automation, f.arrivalSeconds, 1);
  } finally {
    f.route.disconnect();
  }
});

test("after birth each changed scalar wins while same-target mid-ramp observations are suppressed", () => {
  const f = fixture();
  try {
    f.gain.value = 1;
    f.update(0.2, 2);
    f.gain.value = 1.25;
    f.update(0.205, 3);
    const latest = structuredClone(f.gain.automation);
    f.gain.value = 1.5;
    f.update(0.21, 3);
    assert.deepEqual(f.gain.automation, latest);
    assert.deepEqual(f.gain.automation.at(-1), {
      method: "linearRampToValueAtTime",
      value: 3,
      time: 0.205 + birthFadeSeconds,
    });
  } finally {
    f.route.disconnect();
  }
});

test("delay deadband is inclusive and compares accumulated drift with the last sent target", () => {
  // Zero establishes an exactly representable boundary without subtracting two
  // nearby nonzero doubles; this oracle tests the declared 1us control policy.
  const f = fixture(false, 0);
  try {
    const delay = f.route.delay.delayTime as unknown as FakeAudioParam;
    const initialEvents = delay.automation.length;
    f.update(0.01, 1, delayDeadbandSeconds / 2);
    f.update(0.02, 1, delayDeadbandSeconds);
    assert.equal(delay.automation.length, initialEvents, "inside and at the bound are skipped");
    const firstSent = delayDeadbandSeconds * 1.1;
    f.update(0.03, 1, firstSent);
    assert.equal(delay.automation.length, initialEvents + 3);
    assert.equal(delay.automation.at(-1)!.value, firstSent);
    assert.equal(delay.automation.at(-1)!.time, 0.03 + 0.03);
    const afterFirst = delay.automation.length;
    f.update(0.04, 1, delayDeadbandSeconds * 1.6);
    assert.equal(delay.automation.length, afterFirst, "drift is measured from sent 1.1us");
    const secondSent = delayDeadbandSeconds * 2.2;
    f.update(0.05, 1, secondSent);
    assert.equal(delay.automation.length, afterFirst + 3);
    assert.equal(delay.automation.at(-1)!.value, secondSent);
  } finally {
    f.route.disconnect();
  }
});

test("direction-coordinate deadband is inclusive and accumulated drift cannot be forgotten", () => {
  const f = fixture(false);
  try {
    // A listener translation isolates the exact panner x-coordinate threshold
    // from unit-vector normalization; arrival direction remains [0,0,-1].
    const x = f.route.panner.positionX as unknown as FakeAudioParam;
    const initialEvents = x.automation.length;
    f.route.updateListener([directionCoordinateDeadbandM / 2, 0, 0]);
    f.route.updateListener([directionCoordinateDeadbandM, 0, 0]);
    assert.equal(x.automation.length, initialEvents, "inside and at the bound are skipped");
    const firstSent = directionCoordinateDeadbandM * 1.1;
    f.route.updateListener([firstSent, 0, 0]);
    assert.equal(x.automation.length, initialEvents + 3);
    assert.equal(x.automation.at(-1)!.value, firstSent);
    assert.equal(x.automation.at(-1)!.time, ROUTE_DIRECTION_RAMP_SECONDS);
    const afterFirst = x.automation.length;
    f.route.updateListener([directionCoordinateDeadbandM * 1.6, 0, 0]);
    assert.equal(
      x.automation.length,
      afterFirst,
      "drift is measured from the last sent coordinate",
    );
    const secondSent = directionCoordinateDeadbandM * 2.2;
    f.route.updateListener([secondSent, 0, 0]);
    assert.equal(x.automation.length, afterFirst + 3);
    assert.equal(x.automation.at(-1)!.value, secondSent);
  } finally {
    f.route.disconnect();
  }
});
