import test from "node:test";
import assert from "node:assert/strict";
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import {
  RecordingEvaluationClient,
  type RecordingEvaluationWorkerPort,
} from "../../src/app/recording-evaluation-client.js";
import {
  RecordingEvaluationLane,
  type RecordingEvaluationInput,
} from "../../src/app/recording-evaluation-lane.js";
import {
  canonicalBytes,
  immutableClone,
  immutableCloneWithByteLength,
} from "../../src/experiments/hash.js";
import type {
  RecordingConfiguration,
  RecordingFrame,
  RecordingFrameInput,
} from "../../src/experiments/types.js";

class FakePort implements RecordingEvaluationWorkerPort {
  onmessage: RecordingEvaluationWorkerPort["onmessage"] = null;
  onerror: RecordingEvaluationWorkerPort["onerror"] = null;
  onmessageerror: RecordingEvaluationWorkerPort["onmessageerror"] = null;
  messages: { id: number; input: { kind: "capture"; requests: AcousticRequest[] } }[] = [];
  terminated = 0;
  postMessage(value: unknown): void {
    this.messages.push(value as (typeof this.messages)[number]);
  }
  terminate(): void {
    this.terminated++;
  }
  succeed(index = this.messages.length - 1): void {
    const message = this.messages[index]!;
    this.onmessage?.({
      data: {
        id: message.id,
        ok: true,
        output: message.input.requests.map((request) => solveAcoustics(request).frame),
      },
    });
  }
}

test("Worker replies size and freeze the same output as the old pair with one canonical walk", async () => {
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  try {
    const input = requests();
    const raw = input.map((request) => solveAcoustics(request).frame);
    raw[0]!.limitations.push('聲音🎧\n"');
    const expected = { byteLength: canonicalBytes(raw), value: immutableClone(raw) };
    let enumerations = 0;
    const output = [
      new Proxy(raw[0]!, {
        ownKeys(target) {
          enumerations++;
          return Reflect.ownKeys(target);
        },
      }),
    ];
    const measured = immutableCloneWithByteLength(output);
    const oneWalk = enumerations;
    assert.deepEqual(measured, expected);
    enumerations = 0;
    const pending = client.capture(input);
    port.onmessage?.({ data: { id: port.messages[0]!.id, ok: true, output } });
    const result = await pending;
    assert.equal(enumerations, oneWalk, "reply must reuse the size walk's canonical clone");
    assert.deepEqual(result, expected.value);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result[0]!.limitations), true);
    assert.equal(Object.isFrozen(result[0]!.paths), true);
    raw[0]!.limitations.push("later mutation");
    assert.deepEqual(result, expected.value);
  } finally {
    client.dispose();
  }
});

test("oversize Worker replies retain the EVALUATION_PROTOCOL code and message", async () => {
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  try {
    const pending = client.capture(requests());
    const rejected = assert.rejects(pending, {
      code: "EVALUATION_PROTOCOL",
      message: "錄製評估回覆超過容量或協定無效。",
    });
    const output = Array.from({ length: 32 }, () => "界".repeat(350000));
    assert.ok(canonicalBytes(output) > 32 * 1024 * 1024);
    port.onmessage?.({ data: { id: port.messages[0]!.id, ok: true, output } });
    await rejected;
    assert.equal(port.terminated, 1);
  } finally {
    client.dispose();
  }
});
function requests(): AcousticRequest[] {
  const scene = createDefaultScene();
  return buildAcousticRequests({
    scene,
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: object.positionM,
      orientationQuaternion: object.orientationQuaternion,
    })),
    sources: [{ id: "source.evaluation", objectId: "speaker", positionM: [1.5, 1.3, -2] }],
    listener: scene.listener,
    tick: 2,
    materials: DEFAULT_MATERIALS,
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
  });
}

function captureInput(tick: number, count = 1): RecordingEvaluationInput {
  const scene = createDefaultScene();
  const request = requests()[0]!;
  return {
    frame: {
      tick,
      sceneRevision: scene.sceneRevision,
      runEpoch: "epoch.client-batch",
      poses: [],
      listener: scene.listener,
      physicsEvents: [],
      behaviorDecisions: [],
      audioEvents: [],
    },
    requests: Array.from({ length: count }, (_, index) => ({
      ...request,
      poseTick: tick,
      requestId: `request.client-batch.${tick}.${index}`,
    })),
  };
}

async function until(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !check(); attempt++)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(check(), true, "the bounded client request must become observable");
}

/** Pad valid material source URLs without exceeding solver field/count bounds. */
function captureWithJobBytes(tick: number, bytes: number): RecordingEvaluationInput {
  const entry = captureInput(tick, 4);
  const padded = entry.requests.map((request) => ({
    ...request,
    materials: Array.from({ length: 256 }, (_, index) => ({
      ...(request.materials[index] ?? request.materials[0]!),
      id: request.materials[index]?.id ?? `material.padding.${index}`,
      conditions: '界\n"',
      sourceUrls: Array.from({ length: 20 }, () => "https://example.com/"),
    })),
  }));
  let remaining = bytes - canonicalBytes({ kind: "capture", requests: padded });
  for (const request of padded) {
    for (const material of request.materials) {
      for (let index = 0; index < material.sourceUrls.length; index++) {
        const length = Math.min(remaining, 2048 - material.sourceUrls[index]!.length);
        material.sourceUrls[index] += "x".repeat(length);
        remaining -= length;
      }
    }
  }
  assert.equal(remaining, 0);
  return { frame: entry.frame, requests: padded };
}

test("the Worker capture protocol commits batched results identical to separate client requests", async () => {
  const entries = [1, 0, 2, 1, 0].map((count, tick) => captureInput(tick, count));
  const port = new FakePort();
  const referencePort = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  const reference = new RecordingEvaluationClient({ workerFactory: () => referencePort });
  const committed: RecordingFrameInput[] = [];
  const expected: RecordingFrameInput[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: (entry) => client.capture(entry.requests),
    commit: (frame) => committed.push(frame),
    cancelEvaluation: (reason) => client.cancel(reason),
  });
  try {
    for (const entry of entries) {
      const pending = reference.capture(entry.requests);
      referencePort.succeed();
      const frames = await pending;
      expected.push({
        ...entry.frame,
        acousticFrames: frames,
        acousticResultRefs: frames.map((frame) => frame.requestId),
      });
    }
    for (const entry of entries) lane.enqueue(entry);
    const draining = lane.drain();
    port.succeed();
    await until(() => port.messages.length === 2);
    assert.deepEqual(
      port.messages.map((message) => message.input.kind),
      ["capture", "capture"],
    );
    assert.deepEqual(
      port.messages[1]!.input.requests.map((request) => request.poseTick),
      [2, 2, 3],
    );
    port.succeed();
    await draining;
    assert.deepEqual(committed, expected);
  } finally {
    lane.dispose();
    client.dispose();
    reference.dispose();
  }
});

test("lane-owned single and batched jobs reuse frozen requests without client sizing or cloning", async (t) => {
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  const originalEncode = TextEncoder.prototype.encode;
  let encodes = 0;
  t.mock.method(TextEncoder.prototype, "encode", function (this: TextEncoder, value) {
    encodes++;
    return originalEncode.call(this, value);
  });
  const committed: RecordingFrameInput[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: (input) => {
      const before = encodes;
      const pending = client.capture(input.requests);
      assert.equal(encodes, before, "the lane already measured the immutable job");
      assert.equal(port.messages.at(-1)!.input.requests, input.requests);
      assert.equal(Object.isFrozen(port.messages.at(-1)!.input), true);
      assert.equal(Reflect.set(input.requests[0]!.source.positionM, "0", 999), false);
      return pending;
    },
    commit: (value) => committed.push(value),
  });
  try {
    const entries = [0, 1, 2].map((tick) => captureInput(tick));
    for (const entry of entries) lane.enqueue(entry);
    entries[1]!.requests[0]!.source.positionM[0] = 999;
    const draining = lane.drain();
    port.succeed();
    await until(() => port.messages.length === 2);
    port.succeed();
    await draining;
    assert.deepEqual(
      committed.map((value) => value.tick),
      [0, 1, 2],
    );
    assert.notEqual(port.messages[1]!.input.requests[0]!.source.positionM[0], 999);
  } finally {
    lane.dispose();
    client.dispose();
  }
});

test("caller-frozen requests retain the clone path and match lane-owned output", async () => {
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  try {
    const mutable = requests();
    const pending = client.capture(Object.freeze(mutable));
    assert.notEqual(port.messages[0]!.input.requests, mutable);
    assert.notEqual(port.messages[0]!.input.requests[0]!.source, mutable[0]!.source);
    const expected = port.messages[0]!.input.requests.map(
      (request) => solveAcoustics(request).frame,
    );
    mutable[0]!.source.positionM[0] = 999;
    port.succeed();
    const fallback = await pending;
    assert.deepEqual(fallback, expected);

    const entry = captureInput(2);
    entry.requests = port.messages[0]!.input.requests;
    let ownedOutput: readonly unknown[] = [];
    const lane = new RecordingEvaluationLane({
      evaluate: async (input) => {
        const result = client.capture(input.requests);
        port.succeed();
        return result;
      },
      commit: (value) => {
        ownedOutput = value.acousticFrames!;
      },
    });
    lane.enqueue(entry);
    await lane.drain();
    assert.deepEqual(ownedOutput, fallback);
    lane.dispose();
  } finally {
    client.dispose();
  }
});

test("a batch can reach exactly 32 MiB, includes zero-request entries, and leaves overflow queued", async () => {
  const limit = 32 * 1024 * 1024;
  const emptyJobBytes = canonicalBytes({ kind: "capture", requests: [] });
  const entries = [
    captureInput(0, 0),
    captureWithJobBytes(1, limit / 2),
    captureWithJobBytes(2, limit / 2 + emptyJobBytes - 1),
    captureInput(3, 0),
    captureInput(4),
  ];
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: (entry) => client.capture(entry.requests),
    commit: (frame) => committed.push(frame.tick),
    cancelEvaluation: (reason) => client.cancel(reason),
    budget: { maxBytes: 128 * 1024 * 1024 },
  });
  try {
    for (const entry of entries) lane.enqueue(entry);
    const draining = lane.drain();
    port.succeed(0);
    await until(() => port.messages.length >= 2);
    assert.equal(canonicalBytes(port.messages[1]!.input), limit);
    assert.deepEqual(
      port.messages[1]!.input.requests.map((request) => request.poseTick),
      [1, 1, 1, 1, 2, 2, 2, 2],
    );
    port.succeed(1);
    await until(() => committed.length === 4);
    assert.deepEqual(committed, [0, 1, 2, 3]);
    assert.deepEqual(
      port.messages[2]!.input.requests.map((request) => request.poseTick),
      [4],
    );
    port.succeed(2);
    await draining;
    assert.deepEqual(committed, [0, 1, 2, 3, 4]);
    for (const message of port.messages) {
      assert.ok(canonicalBytes(message.input) <= limit);
      assert.ok(message.input.requests.length <= 2048);
    }
  } finally {
    lane.dispose();
    client.dispose();
  }
});

test("a lone oversize entry retains the client's payload error and cannot commit a later entry", async () => {
  const entry = captureWithJobBytes(0, 32 * 1024 * 1024 + 1);
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  const committed: number[] = [];
  const lane = new RecordingEvaluationLane({
    evaluate: (input) => client.capture(input.requests),
    commit: (frame) => committed.push(frame.tick),
    cancelEvaluation: (reason) => client.cancel(reason),
    budget: { maxBytes: 128 * 1024 * 1024 },
  });
  try {
    await assert.rejects(client.capture(entry.requests), { code: "EVALUATION_PAYLOAD" });
    lane.enqueue(entry);
    lane.enqueue(captureInput(1));
    await assert.rejects(lane.drain(), { code: "EVALUATION_PAYLOAD" });
    assert.deepEqual(committed, []);
    assert.ok(port.messages.length <= 1, "only the prefetched successor may have posted");
    assert.equal(lane.getTelemetry().state, "failed");
    assert.equal(lane.getTelemetry().reservedBytes, 0);
  } finally {
    lane.dispose();
    client.dispose();
  }
});

for (const failure of ["crash", "timeout", "worker error", "identity"] as const) {
  test(`in-flight batch ${failure} fails the lane and ignores late replies`, async () => {
    const port = new FakePort();
    const client = new RecordingEvaluationClient({
      workerFactory: () => port,
      timeoutMs: failure === "timeout" ? 50 : 10000,
    });
    const committed: number[] = [];
    const lane = new RecordingEvaluationLane({
      evaluate: (entry) => client.capture(entry.requests),
      commit: (frame) => committed.push(frame.tick),
      cancelEvaluation: (reason) => client.cancel(reason),
    });
    try {
      for (let tick = 0; tick < 4; tick++) lane.enqueue(captureInput(tick));
      const code =
        failure === "crash"
          ? "EVALUATION_WORKER_ERROR"
          : failure === "timeout"
            ? "EVALUATION_TIMEOUT"
            : failure === "identity"
              ? "EVALUATION_REPLY_IDENTITY"
              : "SOLVER_TEST_ERROR";
      const rejected = assert.rejects(lane.drain(), { code });
      port.succeed();
      await until(() => port.messages.length === 2);
      const message = port.messages[1]!;
      assert.deepEqual(
        message.input.requests.map((request) => request.poseTick),
        [1, 2, 3],
      );
      const handler = port.onmessage!;
      if (failure === "crash") port.onerror?.({});
      if (failure === "worker error")
        handler({ data: { id: message.id, ok: false, error: { code, message: "solver failed" } } });
      if (failure === "identity") {
        const output = message.input.requests.map((request) => solveAcoustics(request).frame);
        output[1]!.poseTick++;
        handler({ data: { id: message.id, ok: true, output } });
      }
      await rejected;
      handler({
        data: {
          id: message.id,
          ok: true,
          output: message.input.requests.map((request) => solveAcoustics(request).frame),
        },
      });
      assert.deepEqual(committed, [0]);
      assert.equal(lane.getTelemetry().committedTick, 0);
      assert.equal(lane.getTelemetry().state, "failed");
      assert.equal(lane.getTelemetry().pendingFrames, 0);
      assert.equal(lane.getTelemetry().reservedBytes, 0);
      assert.equal(port.terminated, 1);
    } finally {
      lane.dispose();
      client.dispose();
    }
  });
}

test("yielding reference owns its input and equals the independent synchronous solver", async () => {
  let release!: () => void;
  let yielded = 0;
  const input = requests();
  const expected = input.map((request) => solveAcoustics(request).frame);
  const client = new RecordingEvaluationClient({
    useWorker: false,
    yieldTask: () => {
      yielded++;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  });
  const pending = client.capture(input);
  input[0]!.poseTick = 99;
  (input[0]!.source as { id: string }).id = "source.changed";
  release();
  assert.deepEqual(await pending, expected);
  assert.equal(yielded, 1);
  assert.equal(client.mode, "yieldingReference");
  client.dispose();
});

test("worker capture protocol admits two jobs, correlates reversed replies and refuses a third", async () => {
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  const input = requests();
  const pending = client.capture(input);
  const nextInput = requests().map((request) => ({ ...request, requestId: "request.next" }));
  const next = client.capture(nextInput);
  await assert.rejects(client.capture(input), { code: "EVALUATION_BUSY" });
  assert.equal(port.messages.length, 2);
  port.succeed(1);
  assert.deepEqual(
    await next,
    nextInput.map((request) => solveAcoustics(request).frame),
  );
  const third = client.capture(input);
  await assert.rejects(client.capture(input), { code: "EVALUATION_BUSY" });
  assert.equal(port.messages.length, 3, "one completed job frees exactly one slot");
  port.succeed(0);
  assert.deepEqual(
    await pending,
    input.map((request) => solveAcoustics(request).frame),
  );
  port.succeed(2);
  assert.deepEqual(
    await third,
    input.map((request) => solveAcoustics(request).frame),
  );
  assert.equal(client.mode, "worker");
  client.dispose();
  assert.equal(port.terminated, 1);
});

for (const failingJob of [0, 1]) {
  test(`Worker error for capture ${failingJob} rejects both pending client jobs with the original code`, async () => {
    const port = new FakePort();
    const client = new RecordingEvaluationClient({ workerFactory: () => port });
    try {
      const rejected = [client.capture(requests()), client.capture(requests())].map((job) =>
        assert.rejects(job, { code: "TEST_WORKER_FAILED", message: "solver failed" }),
      );
      port.onmessage!({
        data: {
          id: port.messages[failingJob]!.id,
          ok: false,
          error: { code: "TEST_WORKER_FAILED", message: "solver failed" },
        },
      });
      await Promise.all(rejected);
      assert.equal(port.terminated, 1);
    } finally {
      client.dispose();
    }
  });
}

for (const failingJob of [0, 1]) {
  for (const failure of ["worker error", "timeout"] as const) {
    test(`two-slot lane ignores late replies after job ${failingJob} ${failure}`, async () => {
      const port = new FakePort();
      // On a loaded runner the job timer must not outrun the injected worker error or the
      // first job's reply; only the timeout cases wait for a timer.
      const timeoutMs = failure === "timeout" ? 1000 : 60000;
      const client = new RecordingEvaluationClient({ workerFactory: () => port, timeoutMs });
      const committed: number[] = [];
      const lane = new RecordingEvaluationLane({
        evaluate: (entry) => client.capture(entry.requests),
        commit: (frame) => committed.push(frame.tick),
        cancelEvaluation: (reason) => client.cancel(reason),
      });
      try {
        for (let tick = 0; tick < 4; tick++) lane.enqueue(captureInput(tick));
        const code = failure === "timeout" ? "EVALUATION_TIMEOUT" : "TEST_SOLVER_FAILED";
        const rejected = assert.rejects(lane.drain(), { code });
        await until(() => port.messages.length === 2);
        const handler = port.onmessage!;
        if (failingJob === 1) {
          port.succeed(0);
          await until(() => committed.length === 1);
        }
        if (failure === "worker error")
          handler({
            data: {
              id: port.messages[failingJob]!.id,
              ok: false,
              error: { code, message: "solver failed" },
            },
          });
        await rejected;
        for (const message of port.messages)
          handler({
            data: {
              id: message.id,
              ok: true,
              output: message.input.requests.map((request) => solveAcoustics(request).frame),
            },
          });
        await Promise.resolve();
        assert.deepEqual(committed, failingJob === 0 ? [] : [0]);
        assert.equal(lane.getTelemetry().pendingFrames, 0);
        assert.equal(lane.getTelemetry().reservedBytes, 0);
        assert.equal(port.terminated, 1);
      } finally {
        lane.dispose();
        client.dispose();
      }
    });
  }
}

for (const completedJob of [null, 0, 1]) {
  test(`generation bump with capture ${completedJob} completed rejects remaining jobs and ignores old replies`, async () => {
    const ports = [new FakePort(), new FakePort()];
    let created = 0;
    const client = new RecordingEvaluationClient({ workerFactory: () => ports[created++]! });
    try {
      const pending = [client.capture(requests()), client.capture(requests())];
      const handler = ports[0]!.onmessage!;
      if (completedJob !== null) {
        ports[0]!.succeed(completedJob);
        await pending[completedJob];
      }
      const rejected = pending
        .filter((_, index) => index !== completedJob)
        .map((job) => assert.rejects(job, { code: "EVALUATION_CANCELLED" }));
      client.cancel("new generation");
      // Replacement work starts before retired async execute calls unwind.
      const current = [client.capture(requests()), client.capture(requests())];
      await assert.rejects(client.capture(requests()), { code: "EVALUATION_BUSY" });
      for (const message of ports[0]!.messages)
        handler({ data: { id: message.id, ok: true, output: [] } });
      ports[1]!.succeed(1);
      ports[1]!.succeed(0);
      await Promise.all(rejected);
      assert.ok((await Promise.all(current)).every((frames) => frames.length === 1));
      assert.equal(ports[0]!.terminated, 1);
    } finally {
      client.dispose();
    }
  });
}

test("reprocess is exclusive against both captures and another reprocess", async () => {
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  const frame: RecordingFrame = {
    ...captureInput(0).frame,
    runEpoch: "epoch.reprocess",
    acousticFrames: [],
    acousticResultRefs: [],
  };
  const baseline: RecordingConfiguration = {
    sceneSnapshot: createDefaultScene(),
    sourceConfig: {},
    behaviorConfig: {},
    solverConfig: {},
    atmosphere: {},
    materialRegistry: [],
    assetManifest: [],
    generatorConfig: {},
    physicsConfig: {},
    geometrySnapshot: {},
    physicsVersion: "test",
    backendId: "test",
    backendVersion: "test",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
  try {
    const captures = [client.capture([]), client.capture([])];
    await assert.rejects(client.reprocess(frame, { runId: "run.test" }, baseline), {
      code: "EVALUATION_BUSY",
    });
    await assert.rejects(client.prepare(), { code: "EVALUATION_BUSY" });
    port.succeed(0);
    port.succeed(1);
    await Promise.all(captures);
    const reprocess = client.reprocess(frame, { runId: "run.test" }, baseline);
    const rejected = assert.rejects(reprocess, { code: "EVALUATION_CANCELLED" });
    await assert.rejects(client.capture([]), { code: "EVALUATION_BUSY" });
    await assert.rejects(client.reprocess(frame, { runId: "run.test" }, baseline), {
      code: "EVALUATION_BUSY",
    });
    client.cancel();
    await rejected;
    assert.equal(port.messages.length, 3);
    assert.equal(port.messages[2]!.input.kind, "reprocess");
  } finally {
    client.dispose();
  }
});

test("yieldingReference retains single-job admission", async () => {
  const client = new RecordingEvaluationClient({
    useWorker: false,
    yieldTask: () => new Promise(() => {}),
  });
  const first = client.capture([]);
  const rejected = assert.rejects(first, { code: "EVALUATION_CANCELLED" });
  try {
    await assert.rejects(client.capture([]), { code: "EVALUATION_BUSY" });
  } finally {
    client.dispose();
  }
  await rejected;
});

test("malformed or identity-shifted worker output terminates the transport", async () => {
  const port = new FakePort();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  const pending = client.capture(requests());
  const message = port.messages[0]!;
  const frame = solveAcoustics(message.input.requests[0]!).frame;
  frame.poseTick++;
  port.onmessage?.({ data: { id: message.id, ok: true, output: [frame] } });
  await assert.rejects(pending, { code: "EVALUATION_REPLY_IDENTITY" });
  assert.equal(port.terminated, 1);
  client.dispose();
});

test("cancel rejects pending work, ignores late generation replies and permits a fresh worker", async () => {
  const first = new FakePort();
  const second = new FakePort();
  let constructions = 0;
  const client = new RecordingEvaluationClient({
    workerFactory: () => (constructions++ === 0 ? first : second),
  });
  const old = client.capture(requests());
  const oldHandler = first.onmessage!;
  client.cancel("reset");
  await assert.rejects(old, { code: "EVALUATION_CANCELLED" });
  const current = client.capture(requests());
  oldHandler({ data: { id: first.messages[0]!.id, ok: true, output: [] } });
  second.succeed();
  assert.equal((await current).length, 1);
  assert.equal(first.terminated, 1);
  client.dispose();
});

test("worker crash, timeout, send failure and disposal reject without partial success", async () => {
  for (const kind of ["crash", "timeout", "send", "dispose"] as const) {
    const port = new FakePort();
    if (kind === "send")
      port.postMessage = () => {
        throw new Error("SEND_FAILED");
      };
    const client = new RecordingEvaluationClient({ workerFactory: () => port, timeoutMs: 10 });
    const pending = client.capture(requests());
    if (kind === "crash") port.onerror?.({});
    if (kind === "dispose") client.dispose();
    await assert.rejects(
      pending,
      kind === "send"
        ? /SEND_FAILED/
        : {
            code:
              kind === "crash"
                ? "EVALUATION_WORKER_ERROR"
                : kind === "timeout"
                  ? "EVALUATION_TIMEOUT"
                  : "EVALUATION_CANCELLED",
          },
    );
    assert.equal(port.terminated, 1);
    client.dispose();
  }
});

test("cancelling a yielding reference prevents solver execution and future use after dispose", async () => {
  let release!: () => void;
  const client = new RecordingEvaluationClient({
    useWorker: false,
    yieldTask: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  });
  const pending = client.capture(requests());
  client.dispose();
  release();
  await assert.rejects(pending, { code: "EVALUATION_CANCELLED" });
  await assert.rejects(client.capture(requests()), { code: "EVALUATION_DISPOSED" });
});

test("a stalled reference scheduler can be cancelled or timed out without blocking the next capture", async () => {
  for (const stop of ["cancel", "timeout"] as const) {
    let calls = 0;
    const client = new RecordingEvaluationClient({
      useWorker: false,
      timeoutMs: 10,
      yieldTask: () => (++calls === 1 ? new Promise<void>(() => {}) : Promise.resolve()),
    });
    const pending = client.capture(requests());
    if (stop === "cancel") client.cancel("cancel stalled scheduler");
    await assert.rejects(pending, {
      code: stop === "cancel" ? "EVALUATION_CANCELLED" : "EVALUATION_TIMEOUT",
    });
    assert.equal((await client.capture(requests())).length, 1);
    client.dispose();
  }
});
