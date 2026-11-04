import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { PathRoute } from "../../src/audio/routes.js";
import { FakeAudioContext, type FakeAudioParam } from "./fake-context.js";

// Measured in Brave on 2026-11-04 (artifacts/v1/audio-path-clicks-20261104). With a moving source, a
// 20 ms direction ramp gave 5-8 louder clicks per 10 s and 40 ms gave none, with no clear rise in
// dropouts; 100 ms brought more dropouts. Longer ramps did not help turning, so turning stays at 20 ms.
// Disconnecting a retired route right after its 20 ms fade clicked on every path change until the
// route stayed connected for 100 ms more, because the panner still outputs after its input stops.
const FADE_SECONDS = 0.02;
const TAIL_SECONDS = 0.1;
const DIRECTION_RAMP_SECONDS = 0.04;
const TURN_RAMP_SECONDS = 0.02;

function frame(pathId: string, poseTick = 0, arrivalDirection = [1, 0, 0]): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: `click-guard-${poseTick}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick,
    backendId: "fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.01,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_GRAPH_ONLY"],
    paths: [
      {
        id: pathId,
        sourceId: "source",
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: 3.43,
        absoluteDelayS: 0.01,
        relativeDelayS: 0,
        arrivalDirection,
        bandGains: [0.5],
      },
    ],
  };
}

const voice = (): VoiceInput => ({
  instanceId: "voice",
  sourceId: "source",
  generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
  gainLinear: 0.1,
  pitchSemitones: 0,
  emissionTimeSeconds: 0,
  continuous: true,
  fadeInSeconds: 0.01,
  fadeOutSeconds: 0.02,
});

function routeFixture() {
  const context = new FakeAudioContext();
  const initial = frame("direct");
  const route = new PathRoute(
    context.asContext(),
    context.createGain() as unknown as AudioNode,
    context.createGain() as unknown as AudioNode,
    initial,
    initial.paths[0]!,
    "HRTF",
    [0, 0, 0],
  );
  return { context, route, x: route.panner.positionX as unknown as FakeAudioParam };
}

test("a retired route stays connected until the panner has finished after the fade", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame("old"));
    const oldPanner = context.panners()[0]!;
    assert.ok(oldPanner.connections.length > 0);
    context.currentTime = 0.2;
    engine.updateFrame(frame("new", 1));
    context.currentTime = 0.2 + FADE_SECONDS + 0.03;
    await wait(160);
    assert.ok(
      oldPanner.connections.length > 0,
      "still connected 30 ms after the fade: the panner has not finished",
    );
    context.currentTime = 0.2 + FADE_SECONDS + TAIL_SECONDS + 0.001;
    await wait(120);
    assert.equal(oldPanner.connections.length, 0, "released once the tail has passed");
  } finally {
    engine.dispose();
  }
});

test("offline rendering keeps a retired route for the same tail", async () => {
  const context = new FakeAudioContext();
  Object.assign(context, { startRendering: async () => null });
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame("old"));
    const oldPanner = context.panners()[0]!;
    context.currentTime = 0.2;
    engine.updateFrame(frame("new", 1));
    context.currentTime = 0.2 + FADE_SECONDS + 0.03;
    engine.flushControlUpdates();
    assert.ok(oldPanner.connections.length > 0, "an offline export must not clip the tail either");
    context.currentTime = 0.2 + FADE_SECONDS + TAIL_SECONDS + 0.001;
    engine.flushControlUpdates();
    assert.equal(oldPanner.connections.length, 0);
  } finally {
    engine.dispose();
  }
});

test("a new arrival direction reaches the panner over 40 ms", () => {
  const { context, route, x } = routeFixture();
  context.currentTime = 1;
  const next = frame("direct", 1, [0.6, 0, -0.8]);
  route.update(next, next.paths[0]!, [0, 0, 0]);
  const last = x.automation.at(-1)!;
  assert.equal(last.method, "linearRampToValueAtTime");
  assert.equal(last.value, 0.6);
  assert.ok(Math.abs(last.time - (1 + DIRECTION_RAMP_SECONDS)) < 1e-9);
});

test("listener translation moves the panner over the same 40 ms", () => {
  const { context, route, x } = routeFixture();
  context.currentTime = 1;
  route.updateListener([0.5, 0, 0]);
  const last = x.automation.at(-1)!;
  assert.equal(last.method, "linearRampToValueAtTime");
  assert.ok(Math.abs(last.time - (1 + DIRECTION_RAMP_SECONDS)) < 1e-9);
});

test("a retired route's fade is still 20 ms, so a removed path does not linger audibly", () => {
  const { context, route } = routeFixture();
  context.currentTime = 1;
  route.fadeOut();
  const last = (route.gain.gain as unknown as FakeAudioParam).automation.at(-1)!;
  assert.equal(last.value, 0);
  assert.ok(Math.abs(last.time - (1 + FADE_SECONDS)) < 1e-9);
});

test("a listener move and its panners change together, so the arrival direction stays right", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    engine.playVoice(voice(), frame("direct"));
    context.currentTime = 1;
    engine.updateListener({ positionM: [0.5, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] });
    const listenerEnd = context.listener.positionX.automation.at(-1)!;
    const pannerEnd = (context.panners()[0]!.positionX as unknown as FakeAudioParam).automation.at(
      -1,
    )!;
    assert.equal(listenerEnd.method, "linearRampToValueAtTime");
    assert.equal(
      listenerEnd.time,
      pannerEnd.time,
      "a different ramp would skew the direction while walking",
    );
    assert.ok(Math.abs(listenerEnd.time - (1 + DIRECTION_RAMP_SECONDS)) < 1e-9);
  } finally {
    engine.dispose();
  }
});

test("turning stays at 20 ms, because a longer ramp brought dropouts without fewer clicks", async () => {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  try {
    await engine.enable(0);
    context.currentTime = 1;
    engine.updateListener({ positionM: [0, 0, 0], forward: [1, 0, 0], up: [0, 1, 0] });
    const last = context.listener.forwardX.automation.at(-1)!;
    assert.equal(last.method, "linearRampToValueAtTime");
    assert.ok(Math.abs(last.time - (1 + TURN_RAMP_SECONDS)) < 1e-9);
  } finally {
    engine.dispose();
  }
});
