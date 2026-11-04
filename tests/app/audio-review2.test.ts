import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { AcousticService } from "../../src/app/acoustic-service.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import { formatMessage } from "../../src/ui/locale-model.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
async function rig(fps = false) {
  const app = await LabRuntime.create({ useWorker: false });
  const r = app as any;
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), bufferPreset: "playback" });
  r.audio = engine;
  await engine.enable(0);
  if (fps) {
    await app.dispatch({ type: "enterFPS" });
    await app.dispatch({ type: "pointerLockChanged", locked: true });
  }
  await app.dispatch({ type: "run" });
  return { app, r, engine, context, host: r.interaction };
}

test("review2 4: a half-second interactive stall shifts the epoch and keeps cursors aligned with heard audio", async () => {
  const { app, r, engine, context } = await rig();
  try {
    app.advance(1 / 60);
    await turn();
    const voice = [...r.activeVoices.values()][0] as any;
    const before = engine.getVoiceCursor(voice.event.instanceId, r.latest.simulationTimeSeconds)!;
    const epoch = (engine as any).audioEpoch;
    const sim = r.latest.simulationTimeSeconds;
    context.currentTime += 0.5;
    app.advance(0.5);
    const dt = r.latest.simulationTimeSeconds - sim;
    assert.ok(Math.abs((engine as any).audioEpoch - epoch - (0.5 - dt)) < 1e-12);
    const after = engine.getVoiceCursor(voice.event.instanceId, r.latest.simulationTimeSeconds)!;
    assert.ok(Math.abs(after.playheadSeconds - before.playheadSeconds - 0.5) < 1e-12);
    const input = {
      ...r.voiceInput(voice),
      instanceId: "after-drop",
      emissionTimeSeconds: r.latest.simulationTimeSeconds,
    };
    assert.equal(engine.playVoice(input).accepted, true);
    assert.equal(engine.getTelemetry().lateEvents, 0);
    assert.ok(context.sources().at(-1)!.starts[0]!.when > context.currentTime);
  } finally {
    app.dispose();
  }
});

test("review2 5: pending device rebuild gates audio admission while simulation and input advance", async () => {
  const { app, r, engine } = await rig();
  let release!: () => void;
  engine.setBufferPreset = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  try {
    const changing = app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
    await turn();
    assert.equal(r.audioRestarting, true);
    const tick = r.latest.tick;
    app.advance(0.05);
    assert.equal(r.latest.tick, tick + 3);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.ok(r.pendingAudio.size > 0);
    release();
    await changing;
    assert.equal(r.audioRestarting, false);
    assert.equal(r.busy, false);
  } finally {
    release?.();
    app.dispose();
  }
});

test("review2 2: Pause during rebuild is checked before restoring any native voice", async () => {
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
  const engine = new AudioEngine();
  let release!: () => void;
  try {
    r.audio = engine;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    contexts[0]!.currentTime = 0.5;
    contexts[0]!.close = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const changing = app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
    for (let i = 0; i < 100 && !release; i++)
      await new Promise((resolve) => setTimeout(resolve, 1));
    assert.ok(release);
    const frozen = [...(engine as any).frozenOnResume.values()].map(
      (saved: any) => saved.positionSeconds,
    );
    await app.dispatch({ type: "pause" });
    release();
    await changing;
    assert.equal(contexts[1]!.sources().length, 0, "paused restart never briefly resumes sources");
    assert.deepEqual(
      [...(engine as any).frozenOnResume.values()].map((saved: any) => saved.positionSeconds),
      frozen,
    );
    assert.equal(engine.getTelemetry().paused, true);
    await app.dispatch({ type: "run" });
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    release?.();
    app.dispose();
    globalThis.AudioContext = original;
  }
});

test("review2 8: failed restart remains audio-disabled through frames and Run until explicit listening enable", async () => {
  const original = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  let attempts = 0;
  globalThis.AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      attempts++;
      if (attempts === 2) throw new Error("DEVICE_REOPEN_TEST_FAILURE");
      contexts.push(this);
    }
  } as unknown as typeof AudioContext;
  const app = await LabRuntime.create({ useWorker: false });
  const r = app as any;
  try {
    // This case uses only the default oscillator. PCM qualification belongs to
    // the existing offline/native asset suites, not this control-context fake.
    r.assetHost.ensureBuiltinDescriptors = async () => {};
    await app.dispatch({ type: "enableAudio" });
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    await app.dispatch({ type: "setAudioBufferPreset", preset: "balanced" });
    assert.equal(app.getSnapshot().error, "AUDIO_BUFFER_RESTART_FAILED");
    assert.equal(r.audio.getTelemetry().enabled, false);
    for (let i = 0; i < 10; i++) app.advance(1 / 60);
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    await turn();
    assert.equal(attempts, 2);
    assert.equal(r.audio.getTelemetry().enabled, false);
    await app.dispatch({ type: "enableAudio" });
    assert.equal(attempts, 3);
    assert.equal(r.audio.getTelemetry().enabled, true);
    app.advance(1 / 60);
    await turn();
    assert.equal(app.getSnapshot().error, "");
    assert.equal(r.audio.getTelemetry().activeVoices, 1);
  } finally {
    app.dispose();
    globalThis.AudioContext = original;
  }
});

for (const invalid of ["age", "displacement"])
  test(`review2 6: emitter cache rejects excessive ${invalid}`, async () => {
    const { app, r, engine } = await rig();
    try {
      r.cachedEmitterFrames.clear();
      app.advance(1 / 60);
      const pending = [...r.pendingAudio.values()][0] as any;
      assert.ok(pending);
      await turn();
      const solution = r.solutions.get(pending.input.sourceId);
      assert.ok(solution.frame.paths.length > 0);
      const cached = structuredClone(solution.frame);
      r.cachedEmitterFrames.set(
        `${pending.intent.event.objectId}/${pending.intent.event.bindingId}/${pending.intent.event.ruleId}`,
        cached,
      );
      assert.ok(r.cachedVoiceFrame(pending), "fresh colocated cache is usable");
      if (invalid === "age") cached.poseTick = r.latest.tick - 4;
      else pending.intent.event.positionMetres[0] += 3;
      assert.equal(r.cachedVoiceFrame(pending), undefined);
      assert.equal(engine.getTelemetry().activeVoices, 1);
    } finally {
      app.dispose();
    }
  });

test("review2 8: listener failure stays inside the runtime error boundary", async () => {
  const { app, r, engine } = await rig();
  try {
    r.lastSolve = Infinity;
    engine.updateListener = () => {
      throw new Error("LISTENER_TEST_FAILURE");
    };
    assert.doesNotThrow(() => app.advance(1 / 60));
    assert.equal(app.getSnapshot().simulationState, "paused");
    assert.match(app.getSnapshot().error, /LISTENER_TEST_FAILURE/);
    assert.equal(r.disposed, false);
  } finally {
    app.dispose();
  }
});

test("review2 9: a paused-engine admission keeps its intent for the next frame", async () => {
  const { app, r, engine } = await rig();
  try {
    await engine.pause(0);
    r.lastSolve = Infinity;
    app.advance(1 / 60);
    assert.equal(r.pendingAudio.size, 1);
    assert.doesNotMatch(app.getSnapshot().notice ?? "", /SIMULATION_PAUSED/);
    await engine.resume(r.latest.simulationTimeSeconds);
    r.admitPendingAudio(true);
    assert.equal(r.pendingAudio.size, 0);
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    app.dispose();
  }
});

test("review2 10: rebuild refuses right-button placement with a bilingual reason", async () => {
  const { app, r, host } = await rig(true);
  try {
    host.handlePointer(2, false);
    assert.equal(host.startPreview(), true);
    r.audioRestarting = true;
    const revision = r.scene.sceneRevision;
    assert.equal(host.startPreview(), false);
    assert.match(host.snapshot().notice ?? "", /PLACEMENT_AUDIO_RESTART/);
    assert.match(formatMessage("en", host.snapshot().notice), /audio.*restart/i);
    assert.match(formatMessage("zh-TW", host.snapshot().notice), /音訊/);
    host.handlePointer(2, false);
    assert.equal(await host.place(true), false);
    assert.equal(host.snapshot().notice, "PLACEMENT_AUDIO_RESTART");
    assert.equal(r.scene.sceneRevision, revision);
    assert.equal(host.snapshot().pending, false);
  } finally {
    r.audioRestarting = false;
    app.dispose();
  }
});

for (const cause of ["cancel", "timeout"])
  test(`review2 11: placement ${cause} cancels its isolated acoustic job and permits immediate retry`, async () => {
    const { app, r, host } = await rig(true);
    r.placementAcoustics.dispose();
    let terminated = 0;
    r.placementAcoustics = new AcousticService(true, {
      workerFactory: () => ({
        postMessage() {},
        terminate() {
          terminated++;
        },
        onmessage: null,
        onerror: null,
        onmessageerror: null,
      }),
    });
    try {
      host.options.placementTimeoutMs = cause === "timeout" ? 10 : 5000;
      assert.equal(host.startPreview(), true);
      const placing = host.place();
      assert.equal(r.placementAcoustics.busy, true);
      if (cause === "cancel") host.abortPlacement();
      assert.equal(await placing, false);
      assert.equal(r.placementAcoustics.busy, false);
      assert.equal(terminated, 1);
      assert.equal(host.startPreview(), true);
      const retry = host.place();
      assert.equal(r.placementAcoustics.busy, true);
      assert.equal(r.placementAcoustics.getTelemetry().backpressureRejections, 0);
      host.abortPlacement();
      await retry;
    } finally {
      app.dispose();
    }
  });

test("review2 11: geometry acknowledgement is bounded at the legal 32 playing source limit", async () => {
  const { app, r, host } = await rig(true);
  try {
    const source = r.scene.sources[0];
    r.scene.sources = Array.from({ length: 32 }, (_, i) => ({
      ...source,
      id: `budget-source-${i}`,
      playing: true,
    }));
    const solve = r.placementAcoustics.solve.bind(r.placementAcoustics);
    let count = 0;
    r.placementAcoustics.solve = (requests: unknown[]) => {
      count = requests.length;
      return solve(requests);
    };
    const draft = r.newObject(r.buildShape);
    assert.equal(
      await host.options.confirmGeometry(draft.id, r.scene.sceneRevision + 1, draft),
      true,
    );
    assert.equal(count, 1, "one representative source acknowledges the shared geometry");
  } finally {
    app.dispose();
  }
});

test("review2 12: a stopped source's preview paths are evicted when the next solve is empty", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const r = app as any;
  try {
    assert.ok([...r.solutions.keys()].some((key: string) => key.startsWith("preview.")));
    for (const source of r.scene.sources) source.playing = false;
    await r.solveCurrent();
    assert.equal(r.solutions.size, 0);
    assert.equal(app.getSnapshot().acousticPaths?.length ?? 0, 0);
  } finally {
    app.dispose();
  }
});
