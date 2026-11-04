import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticRequest, AcousticSolution } from "../../src/acoustics/types.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("latest-valid replacement remains per-source and does not discard an older complete batch", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const runtime = app as any;
  try {
    runtime.scene.sources.push({ ...runtime.scene.sources[0], id: "source.second", playing: true });
    runtime.latest.tick = 10;
    const requests: AcousticRequest[] = runtime.requests();
    const results = requests.map(solveAcoustics);
    assert.equal(results.length, 2);
    const newest = structuredClone(results[0]!);
    newest.frame.poseTick = 8;
    const replaceable = structuredClone(results[1]!);
    replaceable.frame.poseTick = 2;
    runtime.solutions.set(newest.frame.sourceId, newest);
    runtime.solutions.set(replaceable.frame.sourceId, replaceable);
    results[0]!.frame.poseTick = 5;
    results[1]!.frame.poseTick = 4;
    runtime.acoustics.solve = async () => results;
    await runtime.solveCurrent();
    assert.strictEqual(runtime.solutions.get(newest.frame.sourceId), newest);
    assert.strictEqual(runtime.solutions.get(replaceable.frame.sourceId), results[1]);
    assert.equal(
      runtime.solutions.get(replaceable.frame.sourceId).frame.poseTick,
      4,
      "six-tick-old but current-epoch/revision data is retained as an explicit approximation",
    );
  } finally {
    app.dispose();
  }
});

for (const changed of ["epoch", "revision", "dispose"] as const) {
  test(`late preview data after ${changed} change cannot publish into a new lifecycle`, async () => {
    const app = await LabRuntime.create({ useWorker: false });
    const runtime = app as any;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const before = new Map(runtime.solutions);
      runtime.acoustics.solve = async (requests: AcousticRequest[]) => {
        const solutions = requests.map(solveAcoustics);
        await gate;
        return solutions;
      };
      const pending = runtime.solveCurrent();
      if (changed === "epoch") runtime.runEpoch = "epoch.replaced";
      else if (changed === "revision") runtime.scene.sceneRevision++;
      else app.dispose();
      release();
      await pending;
      assert.deepEqual(new Map(runtime.solutions), before);
    } finally {
      release();
      app.dispose();
    }
  });
}

test("source removal during an in-flight preview leaves no published orphan solution", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const runtime = app as any;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    runtime.acoustics.solve = async (requests: AcousticRequest[]) => {
      const solutions = requests.map(solveAcoustics);
      await gate;
      return solutions;
    };
    const pending = runtime.solveCurrent();
    for (const source of runtime.scene.sources) source.playing = false;
    release();
    await pending;
    assert.equal(runtime.solutions.size, 0);
  } finally {
    release();
    app.dispose();
  }
});

test("preview backpressure retains two distinct same-owner emissions and original times until one native admission each", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const runtime = app as any;
  const engine = new AudioEngine({ context: new FakeAudioContext().asContext() });
  try {
    runtime.audio = engine;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    runtime.lastSolve = Infinity;
    await turn();
    const template = [...runtime.activeVoices.values()][0] as any;
    assert.ok(template, "fixture uses an actual behavior-generated emission");
    runtime.solutions.clear();
    runtime.cachedEmitterFrames.clear();
    runtime.cachedEmitterPositions.clear();
    const emissions: { sourceId: string; emissionTimeSeconds: number }[] = [];
    const nativePlay = engine.playVoice.bind(engine);
    engine.playVoice = (input, frame, stale) => {
      emissions.push({ sourceId: input.sourceId, emissionTimeSeconds: input.emissionTimeSeconds });
      const admission = nativePlay(input, frame, stale);
      assert.equal(admission.accepted, true, "real native engine accepts each pending emission");
      return admission;
    };
    const originalVoices = engine.getTelemetry().activeVoices;
    const expected: typeof emissions = [];
    const solutions: AcousticSolution[] = [];
    for (let index = 0; index < 2; index++) {
      const intent = structuredClone(template);
      intent.event.instanceId = `pending.impact.${index}`;
      intent.event.eventId = `pending.event.${index}`;
      intent.event.simulationTimeSeconds = runtime.latest.simulationTimeSeconds - index / 120;
      const input = { ...runtime.voiceInput(intent), continuous: false, durationSeconds: 0.2 };
      expected.push({ sourceId: input.sourceId, emissionTimeSeconds: input.emissionTimeSeconds });
      runtime.pendingAudio.set(input.instanceId, {
        input,
        intent,
        behaviorDocumentRevision: runtime.document.revision,
      });
      runtime.activeVoices.set(input.instanceId, intent);
      const request = runtime.requests(runtime.latest.poses, [intent.event])[0] as AcousticRequest;
      solutions.push(solveAcoustics(request));
    }
    Object.defineProperty(runtime.acoustics, "busy", { value: true, configurable: true });
    await runtime.solveCurrent();
    runtime.admitPendingAudio(false);
    assert.equal(runtime.pendingAudio.size, 2);
    assert.deepEqual(emissions, []);
    delete runtime.acoustics.busy;
    for (const solution of solutions) runtime.solutions.set(solution.frame.sourceId, solution);
    runtime.admitPendingAudio(false);
    assert.equal(runtime.pendingAudio.size, 0);
    assert.equal(engine.getTelemetry().activeVoices, originalVoices + 2);
    assert.deepEqual(emissions, expected, "admission does not rewrite emission to reply time");
    runtime.admitPendingAudio(false);
    assert.deepEqual(emissions, expected, "completed emissions are never dispatched twice");
  } finally {
    app.dispose();
  }
});
