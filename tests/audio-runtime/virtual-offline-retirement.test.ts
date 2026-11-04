import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext, type FakeNode } from "./fake-context.js";
import { ROUTE_FADE_SECONDS, ROUTE_RETIRE_TAIL_SECONDS } from "../../src/audio/routes.js";

const routeRelease = ROUTE_FADE_SECONDS + ROUTE_RETIRE_TAIL_SECONDS;

// Control-graph/lifecycle oracle only. This fixture never renders native PCM.
class FakeOfflineContext extends FakeAudioContext {
  readonly renderQuantumSize = 128;
  async startRendering(): Promise<AudioBuffer> {
    return this.createBuffer(1, 1, this.sampleRate) as unknown as AudioBuffer;
  }
}

function frame(hasPath = true): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: hasPath ? "offline-path-present" : "offline-path-removed",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "offline-retirement-control-oracle",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0,
    paths: hasPath
      ? [
          {
            id: "direct",
            sourceId: "source",
            listenerId: "listener",
            surfaceIds: [],
            order: 0,
            verticesM: [
              [1, 0, 0],
              [0, 0, 0],
            ],
            lengthM: 1,
            absoluteDelayS: 0,
            relativeDelayS: 0,
            arrivalDirection: [1, 0, 0],
            bandGains: [1],
          },
        ]
      : [],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_GRAPH_ONLY_NOT_NATIVE_PCM_OR_HEARING"],
  };
}

function voice(finite = false): VoiceInput {
  return {
    instanceId: "voice",
    sourceId: "source",
    generator: { kind: "oscillator", waveform: "sine", frequencyHz: 220 },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
    continuous: !finite,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    ...(finite ? { durationSeconds: 0.1 } : {}),
  };
}

async function setup(context: FakeAudioContext = new FakeOfflineContext(), maxVoices?: number) {
  const ended: string[] = [];
  const engine = new AudioEngine({
    context: context.asContext(),
    limiterEnabled: false,
    ...(maxVoices === undefined ? {} : { budget: { maxVoices } }),
    onVoiceEnded: (id) => ended.push(id),
  });
  await engine.enable(0);
  return { context, engine, ended };
}

function connections(nodes: readonly FakeNode[]): number {
  return nodes.reduce((count, node) => count + node.connections.length, 0);
}

// Install only after enable(), and only for synchronous engine calls. Thus every
// observed timer belongs to runtime graph work, with no test/framework timer noise.
function runtimeTimersDuring(action: () => void): number[] {
  const original = globalThis.setTimeout;
  const delays: number[] = [];
  globalThis.setTimeout = new Proxy(original, {
    apply(target, thisArg, args) {
      delays.push(Number(args[1] ?? 0));
      return Reflect.apply(target, thisArg, args);
    },
  });
  try {
    action();
  } finally {
    globalThis.setTimeout = original;
  }
  return delays;
}

test("offline route retirement releases graph at its audio deadline in the same task", async () => {
  const { context, engine, ended } = await setup();
  try {
    assert.equal(engine.playVoice(voice(), frame()).accepted, true);
    const panner = context.panners()[0]!;
    const delay = context.delays()[0]!;
    assert.ok(panner.connections.length > 0);
    assert.ok(delay.connections.length > 0);
    engine.updateFrame(frame(false));

    // No await or wall-clock turn may be needed between retirement and cleanup.
    context.currentTime = routeRelease - 1 / context.sampleRate;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activePaths, 1, "retain the fading route before deadline");
    assert.ok(panner.connections.length > 0);
    context.currentTime = routeRelease;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(panner.connections.length, 0);
    assert.equal(delay.connections.length, 0);
    assert.equal(engine.getTelemetry().activeVoices, 1, "route retirement must retain its source");
    assert.deepEqual(ended, []);
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activePaths, 0, "cleanup is idempotent");
  } finally {
    engine.dispose();
  }
});

test("offline finite source expires and releases its tail without a native ended callback", async () => {
  const { context, engine, ended } = await setup();
  try {
    const firstVoiceNode = context.nodes.length;
    assert.equal(engine.playVoice(voice(true), frame()).accepted, true);
    const source = context.sources()[0]!;
    const voiceNodes = context.nodes.slice(firstVoiceNode);
    assert.deepEqual(source.stops, [0.1], "the native stop must already be scheduled");
    assert.ok(connections(voiceNodes) > 0);

    context.currentTime = 0.1 - 1 / context.sampleRate;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.deepEqual(ended, []);
    context.currentTime = 0.1;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().retiringVoices, 1);
    assert.equal(engine.getTelemetry().activePaths, 1, "preserve the scheduled propagation tail");
    assert.deepEqual(ended, ["voice"]);

    context.currentTime = 0.12 - 1 / context.sampleRate;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().retiringVoices, 1);
    assert.ok(connections(voiceNodes) > 0);
    context.currentTime = 0.12;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().retiringVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(connections(voiceNodes), 0);
    assert.equal(source.onended, null);
    assert.deepEqual(ended, ["voice"]);
  } finally {
    engine.dispose();
  }
});

test("late offline native ended cannot extend a fixed tail deadline or duplicate notification", async () => {
  const { context, engine, ended } = await setup();
  try {
    const firstVoiceNode = context.nodes.length;
    assert.equal(engine.playVoice(voice(true), frame()).accepted, true);
    const source = context.sources()[0]!;
    const voiceNodes = context.nodes.slice(firstVoiceNode);
    context.currentTime = 0.1;
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["voice"]);
    context.currentTime = 0.119;
    source.finish();
    source.finish();
    assert.deepEqual(ended, ["voice"]);
    context.currentTime = 0.12;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().retiringVoices, 0, "late ended must not restart the tail");
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(connections(voiceNodes), 0);
    context.currentTime = 1;
    source.finish();
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().retiringVoices, 0);
    assert.deepEqual(ended, ["voice"]);
  } finally {
    engine.dispose();
  }
});

test("offline route births and deaths schedule no wall-clock cleanup timer", async () => {
  const { context, engine } = await setup();
  try {
    const timers = runtimeTimersDuring(() => {
      assert.equal(engine.playVoice(voice(), frame(false)).accepted, true);
      engine.updateFrame(frame());
      assert.equal(engine.getTelemetry().activePaths, 1);
      engine.updateFrame(frame(false));
      context.currentTime = routeRelease;
      engine.flushControlUpdates();
    });
    assert.deepEqual(timers, [], "offline route ownership must use audio-clock checkpoints");
    assert.equal(engine.getTelemetry().activePaths, 0);
  } finally {
    engine.dispose();
  }
});

test("offline scheduled source death and tail cleanup schedule no wall-clock timer", async () => {
  const { context, engine, ended } = await setup();
  try {
    const timers = runtimeTimersDuring(() => {
      assert.equal(engine.playVoice(voice(true), frame()).accepted, true);
      context.currentTime = 0.1;
      engine.flushControlUpdates();
      context.currentTime = 0.119;
      context.sources()[0]!.finish();
      context.currentTime = 0.12;
      engine.flushControlUpdates();
    });
    assert.deepEqual(timers, [], "offline source ownership must use audio-clock checkpoints");
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().retiringVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.deepEqual(ended, ["voice"]);
  } finally {
    engine.dispose();
  }
});

test("offline future source retains its scheduled onset and finite end boundary", async () => {
  const { context, engine, ended } = await setup();
  try {
    assert.equal(
      engine.playVoice({ ...voice(true), emissionTimeSeconds: 0.5 }, frame()).accepted,
      true,
    );
    const source = context.sources()[0]!;
    assert.deepEqual(source.starts, [{ when: 0.5 }]);
    assert.deepEqual(source.stops, [0.6]);
    for (const time of [0.49, 0.5, 0.6 - 1 / context.sampleRate]) {
      context.currentTime = time;
      engine.flushControlUpdates();
      assert.equal(engine.getTelemetry().activeVoices, 1, `source still owns graph at ${time}`);
      assert.deepEqual(ended, []);
    }
    context.currentTime = 0.6;
    engine.flushControlUpdates();
    assert.deepEqual(ended, ["voice"]);
    assert.equal(engine.getTelemetry().retiringVoices, 1);
    context.currentTime = 0.62;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(engine.getTelemetry().retiringVoices, 0);
  } finally {
    engine.dispose();
  }
});

test("offline arrival-only restoration retires without creating another logical completion", async () => {
  const { context, engine, ended } = await setup();
  try {
    const delayed = frame();
    delayed.directDelayS = 0.5;
    delayed.paths[0]!.absoluteDelayS = 0.5;
    const firstVoiceNode = context.nodes.length;
    assert.equal(
      engine.restoreVoiceAtCursor(voice(true), delayed, {
        playheadSeconds: 0.1,
        elapsedSinceEmissionSeconds: 0.25,
        remainingDurationSeconds: 0,
        restorePendingArrivals: true,
      }).accepted,
      true,
    );
    const voiceNodes = context.nodes.slice(firstVoiceNode);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().retiringVoices, 1);
    assert.equal(context.sources().length, 1);
    assert.equal(context.delays()[0]!.delayTime.value, 0.25);
    // First checkpoint may be after both native end and propagation tail.
    context.currentTime = 0.37;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().retiringVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(connections(voiceNodes), 0);
    assert.deepEqual(
      ended,
      [],
      "arrival-only native retirement must not end a logical event again",
    );
  } finally {
    engine.dispose();
  }
});

test("offline disposed source ignores an already-queued native ended delivery", async () => {
  const { context, engine, ended } = await setup();
  const firstVoiceNode = context.nodes.length;
  assert.equal(engine.playVoice(voice(true), frame()).accepted, true);
  const queuedEnded = context.sources()[0]!.onended!;
  engine.dispose();
  context.currentTime = 1;
  const timers = runtimeTimersDuring(() => {
    queuedEnded(new Event("ended"));
    engine.flushControlUpdates();
  });
  assert.deepEqual(timers, []);
  assert.equal(engine.getTelemetry().activeVoices, 0);
  assert.equal(engine.getTelemetry().retiringVoices, 0);
  assert.equal(engine.getTelemetry().activePaths, 0);
  assert.equal(connections(context.nodes.slice(firstVoiceNode)), 0);
  assert.deepEqual(ended, []);
});

test("live reference keeps native-ended delivery and bounded wall-clock cleanup", async () => {
  const { context, engine, ended } = await setup(new FakeAudioContext());
  try {
    assert.equal(engine.playVoice(voice(true), frame()).accepted, true);
    context.currentTime = 0.1;
    engine.flushControlUpdates();
    assert.equal(
      engine.getTelemetry().activeVoices,
      1,
      "offline sweep must not change live delivery",
    );
    assert.deepEqual(ended, []);
    const timers = runtimeTimersDuring(() => context.sources()[0]!.finish());
    assert.deepEqual(ended, ["voice"]);
    assert.equal(timers.length, 1);
    assert.ok(timers.every((delay) => delay >= 10 && delay <= 1000));
    context.currentTime = 0.12;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().retiringVoices, 1, "live timer continues owning cleanup");
  } finally {
    engine.dispose();
  }
});

test("live reference route death still waits for its bounded timer", async () => {
  const { context, engine } = await setup(new FakeAudioContext());
  try {
    assert.equal(engine.playVoice(voice(), frame()).accepted, true);
    const timers = runtimeTimersDuring(() => engine.updateFrame(frame(false)));
    assert.equal(timers.length, 1);
    assert.ok(timers.every((delay) => delay >= 10 && delay <= 1000));
    context.currentTime = 0.02;
    engine.flushControlUpdates();
    assert.equal(engine.getTelemetry().activePaths, 1);
  } finally {
    engine.dispose();
  }
});

test("live route timer cannot retire a graph while its audio clock is frozen", async () => {
  const { context, engine } = await setup(new FakeAudioContext());
  try {
    assert.equal(engine.playVoice(voice(), frame()).accepted, true);
    engine.updateFrame(frame(false));
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    assert.equal(engine.getTelemetry().activePaths, 1);
    assert.ok(context.panners()[0]!.connections.length > 0);
    context.currentTime = routeRelease;
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(context.panners()[0]!.connections.length, 0);
  } finally {
    engine.dispose();
  }
});

test("live source timer retains its propagation tail while its audio clock is frozen", async () => {
  const { context, engine, ended } = await setup(new FakeAudioContext());
  try {
    const firstVoiceNode = context.nodes.length;
    assert.equal(engine.playVoice(voice(true), frame()).accepted, true);
    context.currentTime = 0.1;
    context.sources()[0]!.finish();
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    assert.equal(engine.getTelemetry().retiringVoices, 1);
    assert.ok(connections(context.nodes.slice(firstVoiceNode)) > 0);
    assert.deepEqual(ended, ["voice"]);
    context.currentTime = 0.12;
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    assert.equal(engine.getTelemetry().retiringVoices, 0);
    assert.equal(connections(context.nodes.slice(firstVoiceNode)), 0);
    assert.deepEqual(ended, ["voice"]);
  } finally {
    engine.dispose();
  }
});

test("offline scheduled ended delivery cannot change same-checkpoint voice admission", async () => {
  async function run(deliverEnded: boolean) {
    const { context, engine, ended } = await setup(new FakeOfflineContext(), 1);
    try {
      assert.equal(engine.playVoice({ ...voice(true), priority: 0 }, frame()).accepted, true);
      context.currentTime = 0.1;
      if (deliverEnded) context.sources()[0]!.finish();
      const admission = engine.playVoice({ ...voice(), instanceId: "next", priority: 2 }, frame());
      const beforeFlush = {
        active: engine.getTelemetry().activeVoices,
        retiring: engine.getTelemetry().retiringVoices,
        paths: engine.getTelemetry().activePaths,
        ended: [...ended],
        nodes: context.nodes.length,
      };
      engine.flushControlUpdates();
      return {
        admission,
        beforeFlush,
        afterFlush: {
          active: engine.getTelemetry().activeVoices,
          retiring: engine.getTelemetry().retiringVoices,
          paths: engine.getTelemetry().activePaths,
          ended: [...ended],
        },
      };
    } finally {
      engine.dispose();
    }
  }
  const deferred = await run(false);
  const delivered = await run(true);
  assert.equal(deferred.admission.accepted, true);
  assert.deepEqual(delivered, deferred, "native event delivery timing cannot change admission");
});

test("offline scheduled ended delivery cannot change same-checkpoint route controls", async () => {
  async function run(deliverEnded: boolean) {
    const { context, engine, ended } = await setup();
    try {
      const delayed = frame();
      delayed.directDelayS = 0.2;
      delayed.paths[0]!.absoluteDelayS = 0.2;
      assert.equal(engine.playVoice(voice(true), delayed).accepted, true);
      context.currentTime = 0.1;
      if (deliverEnded) context.sources()[0]!.finish();
      const endedBeforeFlush = [...ended];
      engine.updateFrame(frame(false));
      engine.flushControlUpdates();
      context.currentTime = 0.1 + routeRelease;
      engine.flushControlUpdates();
      return {
        endedBeforeFlush,
        ended: [...ended],
        active: engine.getTelemetry().activeVoices,
        retiring: engine.getTelemetry().retiringVoices,
        paths: engine.getTelemetry().activePaths,
        pannerConnections: context.panners()[0]!.connections.length,
      };
    } finally {
      engine.dispose();
    }
  }
  const deferred = await run(false);
  const delivered = await run(true);
  assert.deepEqual(deferred.endedBeforeFlush, []);
  assert.equal(deferred.paths, 0);
  assert.deepEqual(
    delivered,
    deferred,
    "native event delivery timing cannot change route lifetime",
  );
});
