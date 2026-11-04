import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import { createDefaultScene } from "../../src/app/defaults.js";
import { createScene } from "../../src/scene/validate-scene.js";
import { formatMessage } from "../../src/ui/locale-model.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
async function until(predicate: () => boolean) {
  for (let i = 0; i < 200 && !predicate(); i++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  assert.ok(predicate(), "controlled device boundary reached");
}
async function ownedRig() {
  const original = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const app = await LabRuntime.create({ useWorker: false });
  const r = app as any;
  const engine = new AudioEngine({ bufferPreset: "playback" });
  r.audio = engine;
  await engine.enable(0);
  await app.dispatch({ type: "run" });
  app.advance(1 / 60);
  await turn();
  return {
    app,
    r,
    engine,
    contexts,
    cleanup() {
      app.dispose();
      globalThis.AudioContext = original;
    },
  };
}

test("review3 1: real device rebuild advances frozen cursors and expires gap one-shots", async () => {
  const { app, r, engine, contexts, cleanup } = await ownedRig();
  let release!: () => void;
  try {
    const voice = [...r.activeVoices.values()][0] as any;
    contexts[0]!.currentTime = 0.5;
    contexts[0]!.close = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const changing = app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
    await until(() => !!release);
    const freezeTime = r.latest.simulationTimeSeconds;
    const before = engine.getVoiceCursor(voice.event.instanceId, freezeTime)!;
    assert.ok(before);
    const input = {
      ...r.voiceInput(voice),
      instanceId: "gap-impact",
      sourceId: "gap-impact",
      continuous: false,
      durationSeconds: 0.2,
    };
    const intent = structuredClone(voice);
    intent.event.instanceId = input.instanceId;
    r.pendingAudio.set(input.instanceId, {
      input,
      intent,
      behaviorDocumentRevision: r.document.revision,
    });
    // A real solver frame lets the old implementation admit the stale event.
    const frame = structuredClone([...r.solutions.values()][0].frame);
    frame.sourceId = input.sourceId;
    frame.paths.forEach((path: any) => {
      path.sourceId = input.sourceId;
    });
    r.solutions.set(input.sourceId, { frame });
    for (let i = 0; i < 10; i++) app.advance(0.05);
    const delta = r.latest.simulationTimeSeconds - freezeTime;
    release();
    await changing;
    const after = engine.getVoiceCursor(voice.event.instanceId, r.latest.simulationTimeSeconds)!;
    assert.ok(
      Math.abs(after.elapsedSinceEmissionSeconds - before.elapsedSinceEmissionSeconds - delta) <
        1e-10,
    );
    assert.ok(Math.abs(after.playheadSeconds - before.playheadSeconds - delta) < 1e-10);
    assert.equal(r.pendingAudio.has(input.instanceId), false);
    assert.ok(
      r.nativeAdmissionDiagnostics
        .events()
        .some((row: any) => row.nativeRejection?.reason === "RESTART_GAP"),
    );
    assert.equal(engine.getVoiceCursor(input.instanceId, r.latest.simulationTimeSeconds), null);
    assert.equal(engine.getTelemetry().lateEvents, 0);
  } finally {
    release?.();
    cleanup();
  }
});

test("review3 1: rebuild pauses at the current transport time after audition cleanup", async () => {
  const { app, r, engine, cleanup } = await ownedRig();
  let release!: () => void;
  try {
    engine.stopAudition = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const times: number[] = [];
    const pause = engine.pause.bind(engine);
    engine.pause = (time) => {
      times.push(time);
      return pause(time);
    };
    const changing = engine.setBufferPreset("balanced", r.latest.simulationTimeSeconds, {
      shouldResume: () => !r.world.paused,
      simulationTime: () => r.latest.simulationTimeSeconds,
    });
    await until(() => !!release);
    app.advance(0.05);
    const current = r.latest.simulationTimeSeconds;
    release();
    await changing;
    assert.equal(times[0], current);
  } finally {
    release?.();
    cleanup();
  }
});

test("review3 1: a finite voice exhausted during real device replacement is not restored", async () => {
  const { app, r, engine, contexts, cleanup } = await ownedRig();
  let release!: () => void;
  try {
    const voice = [...r.activeVoices.values()][0] as any;
    assert.equal(
      engine.playVoice({
        ...r.voiceInput(voice),
        instanceId: "finite-restart",
        continuous: false,
        durationSeconds: 0.2,
      }).accepted,
      true,
    );
    contexts[0]!.currentTime = 0.2;
    contexts[0]!.close = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const changing = app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
    await until(() => !!release);
    for (let i = 0; i < 10; i++) app.advance(0.05);
    release();
    await changing;
    assert.equal(engine.getVoiceCursor("finite-restart", r.latest.simulationTimeSeconds), null);
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    release?.();
    cleanup();
  }
});

test("review3 3: catch-up shifts the epoch before emissions inside the stalled frame", async () => {
  const { app, r, engine, contexts, cleanup } = await ownedRig();
  try {
    const observations: number[] = [];
    const tick = r.onTick.bind(r);
    const voice = [...r.activeVoices.values()][0] as any;
    r.onTick = (snapshot: any) => {
      observations.push((engine as any).audioEpoch);
      tick(snapshot);
      assert.equal(
        engine.playVoice({
          ...r.voiceInput(voice),
          instanceId: `stall-${snapshot.tick}`,
          emissionTimeSeconds: snapshot.simulationTimeSeconds,
          continuous: false,
          durationSeconds: 0.05,
        }).accepted,
        true,
      );
    };
    const epoch = (engine as any).audioEpoch;
    contexts[0]!.currentTime += 0.5;
    app.advance(0.5);
    assert.equal(observations.length, 4);
    assert.ok(observations.every((value) => value > epoch + 0.4));
    assert.equal(
      engine.getTelemetry().lateEvents,
      0,
      "emissions in the catch-up steps are on time too",
    );
  } finally {
    cleanup();
  }
});

test("review3 3: a suspended device does not accumulate wall-time epoch shifts", async () => {
  const { engine, contexts, cleanup } = await ownedRig();
  try {
    contexts[0]!.state = "suspended";
    const epoch = (engine as any).audioEpoch;
    engine.shiftEpoch(0.5);
    engine.shiftEpoch(0.5);
    assert.equal((engine as any).audioEpoch, epoch);
  } finally {
    cleanup();
  }
});

test("review3 4: failed restart clears cursors and settings/audition/Run cannot reopen audio", async () => {
  const { app, r, engine, contexts, cleanup } = await ownedRig();
  try {
    const voice = [...r.activeVoices.values()][0] as any;
    const checkpoint = r.captureLiveAudio();
    globalThis.AudioContext = class {
      constructor() {
        throw new Error("DEVICE_UNAVAILABLE");
      }
    } as unknown as typeof AudioContext;
    await app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
    assert.equal(engine.getTelemetry().enabled, false);
    assert.equal(
      engine.getVoiceCursor(voice.event.instanceId, r.latest.simulationTimeSeconds),
      null,
    );
    globalThis.AudioContext = class extends FakeAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    } as unknown as typeof AudioContext;
    engine.setLateReverb({ enabled: true, decaySeconds: 0.3, wetGain: 0.1 });
    const admission = await engine.audition(voice.generator);
    assert.equal(admission.accepted, false);
    r.restoreLiveAudioOnRun = checkpoint;
    await app.dispatch({ type: "run" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(contexts.length, 1, "only explicit Enable can reopen the device");
  } finally {
    cleanup();
  }
});

for (const kind of ["duplicate", "quaternion", "reference", "revision"] as const)
  test(`review3 7: imported scene ${kind} validation has a complete English reason`, () => {
    const scene = createDefaultScene();
    if (kind === "duplicate") scene.sources[0]!.id = scene.objects[0]!.id;
    if (kind === "quaternion") scene.listener.orientationQuaternion = [0, 0, 0, 0.5];
    if (kind === "reference") scene.sources[0]!.objectId = "missing-object";
    if (kind === "revision") scene.sceneRevision = Number.MAX_SAFE_INTEGER + 1;
    assert.throws(
      () => createScene(scene),
      (error: Error) => {
        const translated = formatMessage("en", error.message);
        assert.match(translated, /Scene validation failed/);
        assert.doesNotMatch(translated, /[\u3400-\u9fff]/);
        return true;
      },
    );
  });

test("review3 10: an app owns exactly one acoustic worker including geometry acknowledgement", async () => {
  const original = globalThis.Worker;
  let live = 0;
  let creations = 0;
  globalThis.Worker = class {
    onmessage: ((event: unknown) => void) | null = null;
    onerror = null;
    onmessageerror = null;
    constructor() {
      live++;
      creations++;
    }
    postMessage(data: { batchId: number; requests: AcousticRequest[] }) {
      const results = data.requests.map((request) => ({
        sourceId: request.source.id,
        solution: solveAcoustics(request),
      }));
      queueMicrotask(() =>
        this.onmessage?.({ data: { batchId: data.batchId, computeMs: 0, results } }),
      );
    }
    terminate() {
      live--;
    }
  } as unknown as typeof Worker;
  let app: LabRuntime | undefined;
  try {
    app = await LabRuntime.create({ useWorker: true });
    assert.equal(live, 1);
    assert.equal((app as any).placementAcoustics.getTelemetry().mode, "synchronous");
    const r = app as any;
    for (let i = 0; i < 2; i++) {
      const draft = r.newObject(r.buildShape);
      assert.equal(
        await r.interaction.options.confirmGeometry(draft.id, r.scene.sceneRevision + 1, draft),
        true,
      );
    }
    assert.equal(live, 1);
    assert.equal(creations, 1, "placement must not restart the live worker");
  } finally {
    app?.dispose();
    globalThis.Worker = original;
    assert.equal(live, 0);
  }
});
