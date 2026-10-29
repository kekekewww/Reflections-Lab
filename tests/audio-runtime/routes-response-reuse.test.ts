import assert from "node:assert/strict";
import test from "node:test";
import type { AcousticFrame } from "../../src/acoustics/types.js";
import { PathRoute } from "../../src/audio/routes.js";
import { createBandFilterKernel } from "../../src/audio/band-filter.js";
import { FakeAudioContext, type FakeNode, type FakeAudioParam } from "./fake-context.js";

/** Control/resource assertions only: these record genuine requests, never pretend to render DSP. */
class CountedContext extends FakeAudioContext {
  buffersCreated = 0;
  readonly uploads: { buffer: AudioBuffer | null; time: number }[] = [];
  override createBuffer(channels: number, length: number, sampleRate: number) {
    this.buffersCreated++;
    return super.createBuffer(channels, length, sampleRate);
  }
  override createConvolver() {
    const node = super.createConvolver();
    let stored = node.buffer;
    Object.defineProperty(node, "buffer", {
      configurable: true,
      get: () => stored,
      set: (buffer: AudioBuffer | null) => {
        stored = buffer;
        this.uploads.push({ buffer, time: this.currentTime });
      },
    });
    return node;
  }
}
const bands = [1000, 4000, 12000];
const responseA = [0.25, 0.5, 1];
const responseB = [1, 0.5, 0.25];
function frame(gains: number[], centers = bands, delay = 0.075): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "route-reuse-fixture",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "literal-control-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: centers,
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delay,
    paths: [
      {
        id: "direct",
        sourceId: "source",
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [0, 0, -1],
          [0, 0, 0],
        ],
        lengthM: delay * 343,
        absoluteDelayS: delay,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: gains,
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["Control-only fixture, not a geometry solution or native PCM result"],
  };
}
function fixture(gains = responseA, fadeIn = false, centers = bands) {
  const context = new CountedContext();
  const input = context.createGain(),
    output = context.createGain();
  const initial = frame(gains, centers);
  const route = new PathRoute(
    context.asContext(),
    input as unknown as AudioNode,
    output as unknown as AudioNode,
    initial,
    initial.paths[0]!,
    "equalpower",
    [0, 0, 0],
    fadeIn,
  );
  return { context, input, route };
}
function update(f: ReturnType<typeof fixture>, time: number, gains: number[], centers = bands) {
  f.context.currentTime = time;
  const next = frame(gains, centers);
  f.route.update(next, next.paths[0]!, [0, 0, 0]);
}
const param = (value: AudioParam) => value as unknown as FakeAudioParam;
const node = (value: AudioNode) => value as unknown as FakeNode;
const targetBank = (route: PathRoute) => (route.bankGains[0].gain.value === 1 ? 0 : 1);

for (const [name, gains, centers] of [
  ["uniform identity", [0.5], [1000]],
  ["nonuniform FIR", responseA, bands],
] as const)
  test(`scalar-only ${name} updates keep one native IR upload while retaining ramps`, () => {
    const f = fixture([...gains], false, [...centers]);
    const first = f.route.convolvers[0].buffer;
    const delayEvents = param(f.route.delay.delayTime).automation.length;
    const positionEvents = param(f.route.panner.positionX).automation.length;
    for (let i = 1; i <= 4; i++)
      update(
        f,
        i * 0.1,
        gains.map((value) => value * 2 ** i),
        [...centers],
      );
    assert.equal(
      f.context.buffersCreated,
      1,
      "unchanged requested IR must not allocate replacement PCM",
    );
    assert.equal(f.context.uploads.length, 1, "unchanged requested IR must not be reuploaded");
    assert.equal(f.route.convolvers[targetBank(f.route)].buffer, first);
    assert.equal(param(f.route.delay.delayTime).automation.length - delayEvents, 12);
    assert.equal(param(f.route.panner.positionX).automation.length - positionEvents, 12);
    const last = param(f.route.gain.gain).automation.at(-1)!;
    assert.equal(last.method, "linearRampToValueAtTime");
    assert.equal(last.value, Math.max(...gains) * 16);
    assert.equal(last.time, 0.4 + 0.02);
  });

test("reused IR still accepts the original20ms scale ramp and gates in-progress changes", () => {
  const f = fixture();
  update(
    f,
    0.1,
    responseA.map((value) => value * 2),
  );
  const accepted = [...param(f.route.gain.gain).automation];
  update(
    f,
    0.11,
    responseA.map((value) => value * 4),
  );
  assert.deepEqual(param(f.route.gain.gain).automation, accepted);
  update(
    f,
    0.121,
    responseA.map((value) => value * 4),
  );
  assert.equal(f.context.uploads.length, 1);
  assert.deepEqual(param(f.route.gain.gain).automation.at(-1), {
    method: "linearRampToValueAtTime",
    value: 4,
    time: 0.121 + 0.02,
  });
});

test("A to B to A compares the active TARGET IR, never the completed retiring bank", () => {
  const f = fixture();
  const originalA = f.route.convolvers[0].buffer!;
  update(f, 0.1, responseB);
  assert.equal(targetBank(f.route), 1);
  assert.equal(f.context.uploads.length, 2);
  update(f, 0.11, responseA); // Deferred until the B transition finishes.
  assert.equal(f.context.uploads.length, 2);
  update(f, 0.121, responseA);
  assert.equal(
    f.context.uploads.length,
    3,
    "A must replace targetB even though retiringA still had equal bytes",
  );
  assert.equal(targetBank(f.route), 0);
  assert.notEqual(f.route.convolvers[0].buffer, originalA);
  assert.deepEqual(f.route.convolvers[0].buffer!.getChannelData(0), originalA.getChannelData(0));
});

test("same targetB with changed scale cleans retiringA without swapping back", () => {
  const f = fixture();
  update(f, 0.1, responseB);
  const targetB = f.route.convolvers[1].buffer;
  const bankEvents = param(f.route.bankGains[1].gain).automation.length;
  update(
    f,
    0.121,
    responseB.map((value) => value * 2),
  );
  assert.equal(f.context.uploads.length, 2);
  assert.equal(targetBank(f.route), 1);
  assert.equal(f.route.convolvers[1].buffer, targetB);
  assert.equal(param(f.route.bankGains[1].gain).automation.length, bankEvents);
  assert.deepEqual(node(f.route.delay).connections, [node(f.route.convolvers[1])]);
  assert.equal(param(f.route.gain.gain).automation.at(-1)!.time, 0.121 + 0.02);
});

test("a small but byte-distinct response is not hidden by an epsilon or quantized key", () => {
  const f = fixture();
  const changed = [0.2500001, 0.5, 1];
  assert.notDeepEqual(
    createBandFilterKernel(bands, responseA, 48000)!.kernel,
    createBandFilterKernel(bands, changed, 48000)!.kernel,
  );
  update(f, 0.1, changed);
  assert.equal(f.context.uploads.length, 2);
  assert.equal(targetBank(f.route), 1);
});

test("identity reuse survives a changed exact band layout and a silent scale", () => {
  const f = fixture([0.5], false, [1000]);
  update(f, 0.1, [0.25, 0.25, 0.25], [125, 1000, 8000]);
  update(f, 0.2, [0, 0, 0], [125, 1000, 8000]);
  assert.equal(f.context.uploads.length, 1);
  assert.equal(f.route.groupDelaySeconds, 0);
  assert.equal(param(f.route.gain.gain).automation.at(-1)!.value, 0);
});

test("arrival fade and retirement/disconnect retain their existing audio-clock commands", () => {
  const f = fixture(responseA, true);
  const arrival = 0.075 + 64 / 48000;
  assert.deepEqual(param(f.route.gain.gain).automation.slice(-3), [
    { method: "setValueAtTime", value: 0, time: 0 },
    { method: "setValueAtTime", value: 0, time: arrival },
    { method: "linearRampToValueAtTime", value: 1, time: arrival + 0.02 },
  ]);
  update(
    f,
    0.1,
    responseA.map((value) => value * 2),
  );
  f.context.currentTime = 0.15;
  f.route.fadeOut();
  assert.deepEqual(param(f.route.gain.gain).automation.at(-1), {
    method: "linearRampToValueAtTime",
    value: 0,
    time: 0.15 + 0.02,
  });
  const uploads = f.context.uploads.length;
  f.route.disconnect();
  f.route.disconnect();
  assert.equal(f.context.uploads.length, uploads);
  assert.equal(f.input.connections.length, 0);
  for (const connected of [
    f.route.delay,
    f.route.gain,
    f.route.panner,
    ...f.route.convolvers,
    ...f.route.bankGains,
  ])
    assert.equal(node(connected).connections.length, 0);
});
