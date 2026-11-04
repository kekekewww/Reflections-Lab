import test from "node:test";
import assert from "node:assert/strict";
import { solveAcoustics, SOLVER_VERSION } from "../../src/acoustics/index.js";
import type { AcousticFrame, AcousticRequest } from "../../src/acoustics/types.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import {
  RecordingEvaluationLane,
  recordingEvaluationReplyBudget,
} from "../../src/app/recording-evaluation-lane.js";
import type { RecordingEvaluationInput } from "../../src/app/recording-evaluation-lane.js";
import { RecordingHost } from "../../src/app/recording-host.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { canonicalBytes, canonicalStringify } from "../../src/experiments/hash.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, failed) => {
    resolve = done;
    reject = failed;
  });
  return { promise, resolve, reject };
}

const atmosphere = { medium: "air" as const, speedOfSoundMps: 343 };

function input(tick: number, withRequests = false): RecordingEvaluationInput {
  const scene = createDefaultScene();
  const frame: RecordingFrameInput = {
    tick,
    sceneRevision: scene.sceneRevision,
    runEpoch: "epoch.evaluation",
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: [...object.positionM] as [number, number, number],
      orientationQuaternion: [...object.orientationQuaternion] as [number, number, number, number],
      linearVelocityMps: [0, 0, 0],
      angularVelocityRadps: [0, 0, 0],
    })),
    listener: structuredClone(scene.listener),
    physicsEvents:
      tick === 1
        ? [{ eventId: "impact.evaluation", tick, sequence: 0, objectId: "ball", type: "OnImpact" }]
        : [],
    behaviorDecisions: [{ tick, label: "聲音🧪", ordered: { z: 0, a: [true, null] } }],
    audioEvents: [],
    behaviorSnapshot: {
      preStepSnapshot: { diagnostic: { cursor: tick / 60 } },
      runtimeSnapshot: { diagnostic: { cursor: (tick + 1) / 60 } },
      voiceCursors: { "voice.test": { playheadSeconds: tick / 60 } },
    },
  };
  const requests = withRequests
    ? buildAcousticRequests({
        scene,
        poses: frame.poses,
        sources: [{ id: "source.speaker", objectId: "speaker", positionM: [1.5, 1.3, -2] }],
        listener: frame.listener,
        tick,
        materials: DEFAULT_MATERIALS,
        atmosphere,
      })
    : [];
  return { frame, requests };
}

function options(): ExperimentRecorderOptions {
  return {
    runId: "run.evaluation-equivalence",
    runEpoch: "epoch.evaluation",
    createdAt: "2026-11-02T00:00:00.000Z",
    sceneSnapshot: createDefaultScene(),
    sourceConfig: { signal: "tone", label: "原始聲源🧪" },
    behaviorConfig: {},
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere,
    materialRegistry: DEFAULT_MATERIALS,
    physicsVersion: "rapier-0.21.0",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}

function capture(tick: number, count: number): RecordingEvaluationInput {
  const captured = input(tick, true);
  const request = captured.requests[0]!;
  return {
    frame: captured.frame,
    requests: Array.from({ length: count }, (_, index) => ({
      ...request,
      requestId: `request.batch.${tick}.${index}`,
      surfaces: [],
      budget: { maxPaths: 1 },
    })),
  };
}

const solve = ({ requests }: RecordingEvaluationInput) =>
  requests.map((request) => solveAcoustics(request).frame);

test("two capture slots overlap evaluation with commits without dispatching a third batch", async () => {
  const jobs: RecordingEvaluationInput[] = [];
  const replies = Array.from({ length: 3 }, () => deferred<readonly AcousticFrame[]>());
  const committing = deferred<void>();
  const committed: RecordingFrameInput[] = [];
  const entries = Array.from({ length: 6 }, (_, tick) => capture(tick, tick % 3));
  const lane = new RecordingEvaluationLane({
    evaluate: (job) => {
      jobs.push(job);
      return replies[jobs.length - 1]!.promise;
    },
    commit: async (frame) => {
      if (frame.tick === 0) await committing.promise;
      committed.push(frame);
    },
  });
  try {
    entries.slice(0, 3).forEach((entry) => lane.enqueue(entry));
    await settleUntil(() => jobs.length === 2);
    assert.deepEqual(
      jobs.map((job) => job.frame.tick),
      [0, 1],
    );
    entries.slice(3).forEach((entry) => lane.enqueue(entry));
    const draining = lane.drain();
    replies[1]!.resolve(solve(jobs[1]!)); // Deliberately reply out of order.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(committed, []);
    replies[0]!.resolve(solve(jobs[0]!));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.equal(jobs.length, 2, "the committing batch still owns its slot");
    assert.equal(lane.getTelemetry().pendingFrames, 6);
    committing.resolve();
    await settleUntil(() => jobs.length === 3);
    replies[2]!.resolve(solve(jobs[2]!));
    await draining;

    const serial: RecordingFrameInput[] = [];
    const reference = new RecordingEvaluationLane({
      batchCapture: false,
      evaluate: async (job) => solve(job),
      commit: (frame) => serial.push(frame),
    });
    entries.forEach((entry) => reference.enqueue(entry));
    await reference.drain();
    assert.deepEqual(committed, serial);
    assert.equal(lane.getTelemetry().reservedBytes, 0);
    reference.dispose();
  } finally {
    committing.resolve();
    lane.dispose();
  }
});

for (const failingJob of [0, 1]) {
  test(`capture job ${failingJob} failure stops both slots and ignores the other reply`, async () => {
    const replies = [deferred<readonly AcousticFrame[]>(), deferred<readonly AcousticFrame[]>()];
    const committed: number[] = [];
    let posted = 0;
    let cancelled = 0;
    const lane = new RecordingEvaluationLane({
      evaluate: () => replies[posted++]!.promise,
      commit: (frame) => committed.push(frame.tick),
      cancelEvaluation: () => cancelled++,
    });
    try {
      lane.enqueue(input(0));
      lane.enqueue(input(1));
      await settleUntil(() => posted === 2);
      const rejected = assert.rejects(lane.drain(), /job failed/);
      replies[failingJob]!.reject(new Error("job failed"));
      await rejected;
      replies[1 - failingJob]!.resolve([]);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(committed, []);
      assert.equal(lane.getTelemetry().pendingFrames, 0);
      assert.equal(lane.getTelemetry().reservedBytes, 0);
      assert.equal(cancelled, 1);
    } finally {
      lane.dispose();
    }
  });
}

for (const completedJob of [0, 1]) {
  test(`lane cancellation with capture ${completedJob} replied ignores both retired slots`, async () => {
    const replies = [deferred<readonly AcousticFrame[]>(), deferred<readonly AcousticFrame[]>()];
    const commitGate = deferred<void>();
    const attempts: number[] = [];
    let posted = 0;
    const lane = new RecordingEvaluationLane({
      evaluate: () => replies[posted++]!.promise,
      commit: async (frame) => {
        attempts.push(frame.tick);
        await commitGate.promise;
      },
    });
    try {
      lane.enqueue(input(0));
      lane.enqueue(input(1));
      await settleUntil(() => posted === 2);
      const rejected = assert.rejects(lane.drain(), { code: "EVALUATION_CANCELLED" });
      replies[completedJob]!.resolve([]);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      lane.cancel("generation changed");
      await rejected;
      replies[1 - completedJob]!.resolve([]);
      commitGate.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(attempts, completedJob === 0 ? [0] : []);
      assert.equal(lane.getTelemetry().committedFrames, 0);
      assert.equal(lane.getTelemetry().pendingFrames, 0);
      assert.equal(lane.getTelemetry().reservedBytes, 0);
    } finally {
      commitGate.resolve();
      lane.dispose();
    }
  });
}

test("batch commits yield after four milliseconds and retain exact ordered contents and watermarks", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "scheduler");
  const gate = deferred<void>();
  const entries = [1, 0, 2, 0, 1, 1].map((count, tick) => capture(tick, count));
  const committed: RecordingFrameInput[] = [];
  const yields: number[] = [];
  const scheduler = {
    async yield() {
      assert.equal(this, scheduler, "the native scheduler receiver is retained");
      yields.push(committed.length);
      assert.equal(lane.getTelemetry().committedFrames, committed.length);
      assert.equal(lane.getTelemetry().pendingFrames, entries.length - committed.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      now += 100; // Time outside the task must not consume the next slice's budget.
    },
  };
  Object.defineProperty(globalThis, "scheduler", { configurable: true, value: scheduler });
  const lane = new RecordingEvaluationLane({
    evaluate: async (job) => {
      if (job.frame.tick === 0) await gate.promise;
      return solve(job);
    },
    commit: (frame) => {
      committed.push(frame);
      now += 2.1;
    },
  });
  try {
    for (const entry of entries) lane.enqueue(entry);
    gate.resolve();
    await lane.drain();
    assert.deepEqual(
      yields,
      [3, 5],
      "cheap entries share a task; each new task gets a fresh budget",
    );
    assert.deepEqual(
      committed,
      entries.map((entry) => {
        const frames = solve(entry);
        return {
          ...entry.frame,
          acousticFrames: frames,
          acousticResultRefs: frames.map((frame) => frame.requestId),
        };
      }),
    );
    assert.equal(lane.getTelemetry().reservedBytes, 0);
  } finally {
    lane.dispose();
    if (previous) Object.defineProperty(globalThis, "scheduler", previous);
    else Reflect.deleteProperty(globalThis, "scheduler");
  }
});

for (const stop of ["cancel", "dispose"] as const) {
  test(`a generation change during scheduler.yield (${stop}) prevents all later batch commits`, async (t) => {
    let now = 0;
    t.mock.method(performance, "now", () => now);
    const previous = Object.getOwnPropertyDescriptor(globalThis, "scheduler");
    const gate = deferred<void>();
    const yielded = deferred<void>();
    const resume = deferred<void>();
    const committed: number[] = [];
    Object.defineProperty(globalThis, "scheduler", {
      configurable: true,
      value: {
        yield: () => {
          yielded.resolve();
          return resume.promise;
        },
      },
    });
    const lane = new RecordingEvaluationLane({
      evaluate: async (job) => {
        if (job.frame.tick === 0) await gate.promise;
        return solve(job);
      },
      commit: (frame) => {
        committed.push(frame.tick);
        now += 5;
      },
    });
    try {
      for (let tick = 0; tick < 4; tick++) lane.enqueue(capture(tick, 1));
      const draining = lane.drain();
      gate.resolve();
      // Completion also bounds this wait against the pre-yield implementation.
      await Promise.race([yielded.promise, draining]);
      assert.deepEqual(committed, [0, 1], "the batch must pause before validating its next entry");
      const rejected = assert.rejects(draining, { code: "EVALUATION_CANCELLED" });
      lane[stop]();
      resume.resolve();
      await rejected;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(committed, [0, 1]);
      assert.equal(lane.getTelemetry().committedTick, 1);
      assert.equal(lane.getTelemetry().pendingFrames, 0);
      assert.equal(lane.getTelemetry().reservedBytes, 0);
    } finally {
      resume.resolve();
      lane.dispose();
      if (previous) Object.defineProperty(globalThis, "scheduler", previous);
      else Reflect.deleteProperty(globalThis, "scheduler");
    }
  });
}

for (const clock of ["throwing", "nonfinite"] as const) {
  test(`a ${clock} scheduling clock retains ordered commits and yields between entries`, async (t) => {
    t.mock.method(performance, "now", () => {
      if (clock === "throwing") throw new Error("clock");
      return NaN;
    });
    const previous = Object.getOwnPropertyDescriptor(globalThis, "scheduler");
    const gate = deferred<void>();
    const committed: number[] = [];
    const yields: number[] = [];
    Object.defineProperty(globalThis, "scheduler", {
      configurable: true,
      value: {
        yield: async () => {
          yields.push(committed.length);
        },
      },
    });
    const lane = new RecordingEvaluationLane({
      evaluate: async (job) => {
        if (job.frame.tick === 0) await gate.promise;
        return solve(job);
      },
      commit: (frame) => committed.push(frame.tick),
    });
    try {
      for (let tick = 0; tick < 4; tick++) lane.enqueue(capture(tick, 1));
      gate.resolve();
      await lane.drain();
      assert.deepEqual(committed, [0, 1, 2, 3]);
      assert.deepEqual(yields, [2, 3]);
      assert.equal(lane.getTelemetry().reservedBytes, 0);
    } finally {
      lane.dispose();
      if (previous) Object.defineProperty(globalThis, "scheduler", previous);
      else Reflect.deleteProperty(globalThis, "scheduler");
    }
  });
}

test("without scheduler.yield a macrotask runs between costly batch entries", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "scheduler");
  Object.defineProperty(globalThis, "scheduler", { configurable: true, value: {} });
  const gate = deferred<void>();
  const committed: number[] = [];
  let prefixAtTask: number[] | undefined;
  const lane = new RecordingEvaluationLane({
    evaluate: async (job) => {
      if (job.frame.tick === 0) await gate.promise;
      return solve(job);
    },
    commit: (frame) => {
      committed.push(frame.tick);
      now += 5;
      if (frame.tick === 1)
        setTimeout(() => {
          prefixAtTask = [...committed];
        }, 0);
    },
  });
  try {
    for (let tick = 0; tick < 4; tick++) lane.enqueue(capture(tick, 1));
    gate.resolve();
    await lane.drain();
    assert.deepEqual(
      prefixAtTask,
      [0, 1],
      "a microtask-only yield would commit the entire batch first",
    );
    assert.deepEqual(committed, [0, 1, 2, 3]);
  } finally {
    lane.dispose();
    if (previous) Object.defineProperty(globalThis, "scheduler", previous);
    else Reflect.deleteProperty(globalThis, "scheduler");
  }
});

test("one queued batch splits mixed request counts into exactly the sequential committed frames", async () => {
  const entries = [1, 0, 2, 0, 1, 3, 0].map((count, tick) => capture(tick, count));
  const gate = deferred<void>();
  const jobs: RecordingEvaluationInput[] = [];
  const committed: RecordingFrameInput[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async (job) => {
      jobs.push(job);
      if (jobs.length === 1) await gate.promise;
      return solve(job);
    },
    commit: (frame) => committed.push(frame),
  });
  for (const entry of entries) lane.enqueue(entry);
  gate.resolve();
  await lane.drain();
  assert.deepEqual(
    jobs.map((job) => job.requests.length),
    [1, 6],
  );
  assert.deepEqual(
    jobs[1]!.requests,
    entries.slice(1).flatMap((entry) => entry.requests),
  );
  assert.equal(Object.isFrozen(jobs[1]), true);
  assert.equal(Object.isFrozen(jobs[1]!.requests), true);
  assert.deepEqual(
    committed,
    entries.map((entry) => {
      const frames = solve(entry);
      return {
        ...entry.frame,
        acousticFrames: frames,
        acousticResultRefs: frames.map((f) => f.requestId),
      };
    }),
  );
});

test("arrivals during an in-flight batch belong to the next ordered batch", async () => {
  const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
  const jobs: number[][] = [];
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async (job) => {
      jobs.push(job.requests.map((request) => request.poseTick));
      await gates[jobs.length - 1]!.promise;
      return solve(job);
    },
    commit: (frame) => committed.push(frame.tick),
  });
  for (let tick = 0; tick < 3; tick++) lane.enqueue(capture(tick, 1));
  gates[0]!.resolve();
  await settleUntil(() => jobs.length === 2);
  lane.enqueue(capture(3, 1));
  lane.enqueue(capture(4, 1));
  const draining = lane.drain();
  gates[1]!.resolve();
  await settleUntil(() => jobs.length === 3);
  assert.deepEqual(committed, [0, 1, 2]);
  gates[2]!.resolve();
  await draining;
  assert.deepEqual(jobs, [[0], [1, 2], [3, 4]]);
  assert.deepEqual(committed, [0, 1, 2, 3, 4]);
});

test("batch ownership keeps the eight-frame cap and releases bytes and low-water pressure per commit", async () => {
  const entries = Array.from({ length: 8 }, (_, tick) => capture(tick, 1));
  const reservations = entries.map(
    (entry) => canonicalBytes(entry) + recordingEvaluationReplyBudget(entry.requests),
  );
  const gates = [deferred<void>(), deferred<void>()];
  const commitGate = deferred<void>();
  const jobs: number[] = [];
  const changes: ReturnType<RecordingEvaluationLane["getTelemetry"]>[] = [];
  let pressure = 0;
  const lane = new RecordingEvaluationLane({
    evaluate: async (job) => {
      jobs.push(job.requests.length);
      await gates[jobs.length - 1]!.promise;
      return solve(job);
    },
    commit: async (frame) => {
      if (frame.tick === 1) await commitGate.promise;
    },
    onChanged: () => changes.push(lane.getTelemetry()),
    onBackpressure: () => pressure++,
  });
  for (const entry of entries) lane.enqueue(entry);
  assert.throws(() => lane.enqueue(capture(8, 1)), { code: "EVALUATION_CAPACITY" });
  const draining = lane.drain();
  gates[0]!.resolve();
  await settleUntil(() => jobs.length === 2);
  assert.deepEqual(jobs, [1, 7]);
  gates[1]!.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(
    lane.getTelemetry().pendingFrames,
    7,
    "an awaiting commit still owns its entire batch",
  );
  assert.equal(
    lane.getTelemetry().reservedBytes,
    reservations.slice(1).reduce((a, b) => a + b, 0),
  );
  commitGate.resolve();
  await draining;
  const commits = changes.filter(
    (change, index) => change.committedFrames > (changes[index - 1]?.committedFrames ?? 0),
  );
  assert.deepEqual(
    commits.map((change) => change.pendingFrames),
    [7, 6, 5, 4, 3, 2, 1, 0],
  );
  assert.deepEqual(
    commits.map((change) => change.backpressured),
    [true, true, true, true, true, false, false, false],
  );
  for (let index = 0; index < commits.length; index++) {
    assert.equal(commits[index]!.committedTick, index);
    assert.equal(
      commits[index]!.reservedBytes,
      reservations.slice(index + 1).reduce((a, b) => a + b, 0),
    );
  }
  assert.equal(pressure, 1);
  assert.equal(lane.getTelemetry().acceptedFrames, 8);
});

for (const failure of ["validation", "reply budget", "commit"] as const) {
  test(`mid-batch ${failure} failure preserves only the committed prefix`, async () => {
    const gate = deferred<void>();
    const batchGate = deferred<void>();
    const successorGate = deferred<void>();
    const committed: number[] = [];
    const attempts: number[] = [];
    let jobs = 0;
    let failures = 0;
    let cancellations = 0;
    const lane = new RecordingEvaluationLane({
      evaluate: async (job) => {
        const jobNumber = ++jobs;
        if (jobNumber === 1) await gate.promise;
        if (jobNumber === 2) await batchGate.promise;
        if (jobNumber === 3) await successorGate.promise;
        const frames = solve(job);
        if (jobNumber === 2 && failure === "validation") frames[1]!.poseTick++;
        if (jobNumber === 2 && failure === "reply budget")
          frames[1]!.limitations = ["x".repeat(recordingEvaluationReplyBudget([job.requests[1]!]))];
        return frames;
      },
      commit: (frame) => {
        attempts.push(frame.tick);
        if (frame.tick === 2 && failure === "commit") throw new Error("commit failed");
        committed.push(frame.tick);
      },
      onFailure: () => failures++,
      cancelEvaluation: () => cancellations++,
    });
    for (let tick = 0; tick < 4; tick++) lane.enqueue(capture(tick, 1));
    await settleUntil(() => jobs === 2);
    lane.enqueue(capture(4, 1));
    lane.enqueue(capture(5, 1));
    const expected =
      failure === "commit"
        ? /commit failed/
        : {
            code:
              failure === "validation" ? "EVALUATION_REPLY_IDENTITY" : "EVALUATION_REPLY_BUDGET",
          };
    const flushed = assert.rejects(lane.flush(), expected);
    const drained = assert.rejects(lane.drain(), expected);
    gate.resolve();
    await settleUntil(() => jobs === 3);
    batchGate.resolve();
    await Promise.all([flushed, drained]);
    successorGate.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.equal(jobs, 3);
    assert.deepEqual(committed, [0, 1]);
    assert.deepEqual(attempts, failure === "commit" ? [0, 1, 2] : [0, 1]);
    assert.equal(lane.getTelemetry().state, "failed");
    assert.equal(lane.getTelemetry().committedTick, 1);
    assert.equal(lane.getTelemetry().committedFrames, 2);
    assert.equal(lane.getTelemetry().pendingFrames, 0);
    assert.equal(lane.getTelemetry().reservedBytes, 0);
    assert.throws(() => lane.enqueue(capture(4, 1)), expected);
    lane.cancel();
    assert.equal(failures, 1);
    assert.equal(cancellations, 1);
  });
}

test("queued batches stop at 2048 requests without skipping the next entry", async () => {
  const gate = deferred<void>();
  const sizes: number[] = [];
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async (job) => {
      sizes.push(job.requests.length);
      if (sizes.length === 1) await gate.promise;
      assert.ok(job.requests.length <= 2048);
      assert.ok(canonicalBytes({ kind: "capture", requests: job.requests }) <= 32 * 1024 * 1024);
      return solve(job);
    },
    commit: (frame) => committed.push(frame.tick),
    budget: { maxBytes: 128 * 1024 * 1024 },
  });
  for (const [tick, count] of [0, 1024, 1024, 1].entries()) lane.enqueue(capture(tick, count));
  gate.resolve();
  await lane.drain();
  assert.deepEqual(sizes, [0, 2048, 1]);
  assert.deepEqual(committed, [0, 1, 2, 3]);
});

test("reference scheduling can retain one evaluation per queued entry", async () => {
  const gate = deferred<void>();
  const jobs: number[] = [];
  const lane = new RecordingEvaluationLane({
    batchCapture: false,
    evaluate: async (job) => {
      jobs.push(job.frame.tick);
      if (jobs.length === 1) await gate.promise;
      return solve(job);
    },
    commit: () => {},
  });
  for (let tick = 0; tick < 4; tick++) lane.enqueue(capture(tick, 1));
  gate.resolve();
  await lane.drain();
  assert.deepEqual(jobs, [0, 1, 2, 3]);
});

for (const batchCaptureEvaluation of [true, false]) {
  test(`host batching=${batchCaptureEvaluation} retains one diagnostic row per committed entry`, async () => {
    const gate = deferred<void>();
    const jobs: number[] = [];
    const host = new RecordingHost({
      getConfig: options,
      batchCaptureEvaluation,
      evaluateCapture: async (requests) => {
        jobs.push(requests.length);
        if (jobs.length === 1) await gate.promise;
        return requests.map((request) => solveAcoustics(request).frame);
      },
    });
    try {
      host.start();
      for (const [tick, count] of [1, 0, 2, 1, 0].entries()) {
        const entry = capture(tick, count);
        assert.equal(host.appendEvaluationFrame(entry.frame, entry.requests), true);
      }
      const stopping = host.stop();
      gate.resolve();
      const artifact = await stopping;
      assert.deepEqual(jobs, batchCaptureEvaluation ? [1, 3] : [1, 0, 2, 1, 0]);
      assert.equal(artifact.status, "captured");
      const diagnostics = host.getCommitDiagnostics()!;
      assert.equal(diagnostics.evaluation.count, 5);
      assert.deepEqual(
        diagnostics.evaluation.first.map((row) => row.tick),
        [0, 1, 2, 3, 4],
      );
      assert.ok(diagnostics.evaluation.first.every((row) => row.completed));
    } finally {
      host.dispose();
    }
  });
}

test("cancelling from a committed entry's change callback cannot commit the rest of its batch", async () => {
  const gate = deferred<void>();
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async (job) => {
      if (job.frame.tick === 0) await gate.promise;
      return solve(job);
    },
    commit: (frame) => committed.push(frame.tick),
    onChanged: () => {
      if (lane.getTelemetry().committedTick === 1) lane.cancel("AFTER_PREFIX");
    },
  });
  for (let tick = 0; tick < 4; tick++) lane.enqueue(capture(tick, 1));
  const rejected = assert.rejects(lane.drain(), { code: "EVALUATION_CANCELLED" });
  gate.resolve();
  await rejected;
  assert.deepEqual(committed, [0, 1]);
  assert.equal(lane.getTelemetry().committedTick, 1);
  assert.equal(lane.getTelemetry().reservedBytes, 0);
});

for (const delta of [-1, 1]) {
  test(`a batch reply with ${delta < 0 ? "missing" : "extra"} frames fails with the existing count error`, async () => {
    const gate = deferred<void>();
    const committed: number[] = [];
    const lane = new RecordingEvaluationLane({
      evaluate: async (job) => {
        if (job.frame.tick === 0) await gate.promise;
        const frames = solve(job);
        if (job.frame.tick === 1) {
          if (delta < 0) frames.pop();
          else frames.push(frames[0]!);
        }
        return frames;
      },
      commit: (frame) => committed.push(frame.tick),
    });
    for (let tick = 0; tick < 3; tick++) lane.enqueue(capture(tick, 1));
    const rejected = assert.rejects(lane.drain(), { code: "EVALUATION_REPLY" });
    gate.resolve();
    await rejected;
    assert.deepEqual(committed, [0]);
    assert.equal(lane.getTelemetry().reservedBytes, 0);
  });
}

async function settleUntil(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30 && !check(); attempt++)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(check(), true, "the bounded evaluation must settle");
}

test("queued acoustic evaluation seals an artifact identical to the synchronous solver reference", async () => {
  const reference = new ExperimentRecorder(options());
  const asynchronous = new ExperimentRecorder(options());
  const lane = new RecordingEvaluationLane({
    evaluate: async ({ requests }) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return requests.map((request) => solveAcoustics(request).frame);
    },
    commit: (frame) => asynchronous.appendFrame(frame),
  });
  for (let tick = 0; tick < 3; tick++) {
    const captured = input(tick, true);
    const frames = captured.requests.map((request) => solveAcoustics(request).frame);
    reference.appendFrame({
      ...captured.frame,
      acousticFrames: frames,
      acousticResultRefs: frames.map((frame) => frame.requestId),
    });
    lane.enqueue(captured);
  }
  await lane.drain();
  assert.deepEqual(await asynchronous.finish(), await reference.finish());
  assert.equal(lane.getTelemetry().acceptedTick, 2);
  assert.equal(lane.getTelemetry().committedTick, 2);
  assert.equal(lane.getTelemetry().reservedBytes, 0);
});

test("flush waits for its accepted watermark and leaves subsequent admission open", async () => {
  const first = deferred<readonly AcousticFrame[]>();
  const second = deferred<readonly AcousticFrame[]>();
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: ({ frame }) => (frame.tick === 0 ? first.promise : second.promise),
    commit: (frame) => {
      committed.push(frame.tick);
    },
  });
  lane.enqueue(input(0));
  const watermark = lane.flush();
  lane.enqueue(input(1));
  first.resolve([]);
  await watermark;
  assert.deepEqual(committed, [0]);
  assert.equal(lane.getTelemetry().state, "accepting");
  assert.equal(lane.getTelemetry().pendingFrames, 1);
  second.resolve([]);
  await lane.drain();
  assert.deepEqual(committed, [0, 1]);
});

test("admission owns immutable event, source cursor and geometry snapshots", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  const original = input(1, true);
  const saved = structuredClone(original);
  let evaluated: RecordingEvaluationInput | null = null;
  const committed: RecordingFrameInput[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async (owned) => {
      evaluated = owned;
      return gate.promise;
    },
    commit: (frame) => committed.push(frame),
  });
  lane.enqueue(original);
  assert.equal(Reflect.set(original.frame.poses[0]!.positionM, "0", 123), true);
  (original.frame.physicsEvents[0] as { sequence: number }).sequence = 77;
  const snapshot = original.frame.behaviorSnapshot as {
    voiceCursors: { "voice.test": { playheadSeconds: number } };
  };
  snapshot.voiceCursors["voice.test"].playheadSeconds = 99;
  assert.equal(Reflect.set(original.requests[0]!.source.positionM, "0", 999), true);
  assert.equal(Reflect.set(original.requests[0]!.surfaces[0]!.verticesM[0]!, "0", 999), true);
  assert.deepEqual(evaluated, saved);
  assert.equal(Object.isFrozen(evaluated), true);
  gate.resolve(saved.requests.map((request) => solveAcoustics(request).frame));
  await lane.drain();
  assert.deepEqual(committed[0]!.poses, saved.frame.poses);
  assert.deepEqual(committed[0]!.physicsEvents, saved.frame.physicsEvents);
  assert.deepEqual(committed[0]!.behaviorSnapshot, saved.frame.behaviorSnapshot);
});

test("frame capacity includes the in-flight owner and preserves sequential watermarks", async () => {
  const gates = [deferred<readonly AcousticFrame[]>(), deferred<readonly AcousticFrame[]>()];
  const committed: number[] = [];
  let calls = 0;
  let pressure = 0;
  const lane = new RecordingEvaluationLane({
    evaluate: () => gates[calls++]?.promise ?? Promise.resolve([]),
    commit: (frame) => committed.push(frame.tick),
    onBackpressure: () => pressure++,
    budget: { maxFrames: 2, lowWaterFrames: 0 },
  });
  lane.enqueue(input(0));
  lane.enqueue(input(1));
  assert.equal(calls, 1, "only one evaluator may own a running item");
  assert.equal(lane.getTelemetry().pendingFrames, 2);
  assert.equal(lane.getTelemetry().backpressured, true);
  assert.equal(pressure, 1);
  assert.throws(() => lane.enqueue(input(2)), { code: "EVALUATION_CAPACITY" });
  assert.equal(lane.getTelemetry().acceptedTick, 1);
  gates[0]!.resolve([]);
  await settleUntil(() => calls === 2);
  assert.equal(lane.getTelemetry().backpressured, true);
  assert.deepEqual(committed, [0]);
  gates[1]!.resolve([]);
  await settleUntil(() => lane.getTelemetry().pendingFrames === 0);
  assert.equal(lane.getTelemetry().backpressured, false);
  lane.enqueue(input(2));
  await lane.drain();
  assert.deepEqual(committed, [0, 1, 2]);
});

test("exact UTF-8 input and reserved reply bytes determine the admission boundary", async () => {
  const captured = input(0);
  const required =
    Buffer.byteLength(canonicalStringify(captured), "utf8") +
    recordingEvaluationReplyBudget(captured.requests);
  for (const maximum of [required - 1, required]) {
    const gate = deferred<readonly AcousticFrame[]>();
    const lane = new RecordingEvaluationLane({
      evaluate: () => gate.promise,
      commit: () => {},
      budget: { maxFrames: 1, lowWaterFrames: 0, maxBytes: maximum, lowWaterBytes: 0 },
    });
    if (maximum < required) {
      assert.throws(() => lane.enqueue(captured), { code: "EVALUATION_CAPACITY" });
      assert.equal(lane.getTelemetry().acceptedFrames, 0);
      assert.equal(lane.getTelemetry().reservedBytes, 0);
    } else {
      lane.enqueue(captured);
      assert.equal(lane.getTelemetry().reservedBytes, required);
      gate.resolve([]);
      await lane.drain();
      assert.equal(lane.getTelemetry().peakReservedBytes, required);
    }
  }
});

test("duplicate, skipped and wrong-epoch ticks are rejected without consuming admission", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async () => gate.promise,
    commit: (frame) => committed.push(frame.tick),
  });
  lane.enqueue(input(0));
  for (const invalid of [
    input(0),
    input(2),
    { ...input(1), frame: { ...input(1).frame, runEpoch: "epoch.other" } },
    { ...input(1), frame: { ...input(1).frame, sceneRevision: 7 } },
  ])
    assert.throws(() => lane.enqueue(invalid), { code: "EVALUATION_INPUT_IDENTITY" });
  assert.equal(lane.getTelemetry().acceptedFrames, 1);
  lane.enqueue(input(1));
  gate.resolve([]);
  await lane.drain();
  assert.deepEqual(committed, [0, 1]);
});

test("drain freezes admission and waits for every accepted item before publication", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async () => gate.promise,
    commit: (frame) => committed.push(frame.tick),
  });
  lane.enqueue(input(0));
  lane.enqueue(input(1));
  let drained = false;
  const done = lane.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  assert.equal(drained, false);
  assert.throws(() => lane.enqueue(input(2)), { code: "EVALUATION_CLOSED" });
  gate.resolve([]);
  await done;
  await lane.drain();
  assert.deepEqual(committed, [0, 1]);
  assert.equal(lane.getTelemetry().committedFrames, 2);
});

test("a wrong worker reply identity fails without committing the mismatched frame", async () => {
  const captured = input(0, true);
  const wrong = captured.requests.map((request) => solveAcoustics(request).frame);
  wrong[0]!.requestId = "request.wrong";
  let commits = 0;
  let failed = 0;
  const lane = new RecordingEvaluationLane({
    evaluate: async () => wrong,
    commit: () => commits++,
    onFailure: () => failed++,
  });
  lane.enqueue(captured);
  await assert.rejects(lane.drain(), { code: "EVALUATION_REPLY_IDENTITY" });
  assert.equal(commits, 0);
  assert.equal(failed, 1);
  assert.equal(lane.getTelemetry().committedTick, null);
  assert.equal(lane.getTelemetry().pendingFrames, 0);
});

test("cancellation rejects drain, releases ownership once and ignores a late result", async () => {
  const gate = deferred<readonly AcousticFrame[]>();
  let commits = 0;
  let cancelled = 0;
  let failed = 0;
  const lane = new RecordingEvaluationLane({
    evaluate: () => gate.promise,
    commit: () => commits++,
    cancelEvaluation: () => cancelled++,
    onFailure: () => failed++,
  });
  lane.enqueue(input(0));
  lane.enqueue(input(1));
  const draining = lane.drain();
  const rejected = assert.rejects(draining, { code: "EVALUATION_CANCELLED" });
  lane.cancel("USER_RESET");
  await rejected;
  lane.cancel("REPEATED_CANCEL");
  gate.resolve([]);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(commits, 0);
  assert.equal(cancelled, 1);
  assert.equal(failed, 1);
  assert.equal(lane.getTelemetry().pendingFrames, 0);
  assert.equal(lane.getTelemetry().reservedBytes, 0);
  lane.dispose();
  lane.dispose();
  assert.equal(cancelled, 1);
  assert.equal(lane.getTelemetry().state, "disposed");
});

test("evaluator failure preserves only the last contiguous committed tick", async () => {
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: async ({ frame }) => {
      if (frame.tick === 1) throw new Error("worker crashed");
      return [];
    },
    commit: (frame) => committed.push(frame.tick),
  });
  lane.enqueue(input(0));
  await lane.flush();
  lane.enqueue(input(1));
  lane.enqueue(input(2));
  await assert.rejects(lane.drain(), /worker crashed/);
  assert.deepEqual(committed, [0]);
  assert.equal(lane.getTelemetry().acceptedTick, 2);
  assert.equal(lane.getTelemetry().committedTick, 0);
  assert.equal(lane.getTelemetry().reservedBytes, 0);
});

test("commit failure is terminal and never advances the committed watermark", async () => {
  const lane = new RecordingEvaluationLane({
    evaluate: async () => [],
    commit: () => {
      throw new Error("recorder rejected the frame");
    },
  });
  lane.enqueue(input(0));
  await assert.rejects(lane.drain(), /recorder rejected/);
  assert.equal(lane.getTelemetry().acceptedTick, 0);
  assert.equal(lane.getTelemetry().committedTick, null);
  assert.equal(lane.getTelemetry().committedFrames, 0);
  assert.throws(() => lane.enqueue(input(1)), /recorder rejected/);
});

test("invalid queue watermarks and request budgets fail before admission", async () => {
  for (const budget of [
    { maxFrames: 0 },
    { maxFrames: 2, lowWaterFrames: 2 },
    { maxBytes: 128, lowWaterBytes: 128 },
  ])
    assert.throws(
      () => new RecordingEvaluationLane({ evaluate: async () => [], commit: () => {}, budget }),
      { code: "EVALUATION_BUDGET" },
    );
  const request = input(0, true).requests[0]!;
  assert.throws(() => recordingEvaluationReplyBudget([{ ...request, budget: { maxPaths: 0 } }]), {
    code: "EVALUATION_REQUEST_BUDGET",
  });
  const mismatch: AcousticRequest = { ...request, poseTick: 99 };
  const lane = new RecordingEvaluationLane({ evaluate: async () => [], commit: () => {} });
  assert.throws(() => lane.enqueue({ frame: input(0).frame, requests: [mismatch] }), {
    code: "EVALUATION_INPUT_IDENTITY",
  });
  assert.equal(lane.getTelemetry().acceptedFrames, 0);
});
