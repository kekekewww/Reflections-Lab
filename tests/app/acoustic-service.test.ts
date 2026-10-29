import test from "node:test";
import assert from "node:assert/strict";
import { AcousticService, ACOUSTIC_DELIVERY_LIMITS } from "../../src/app/acoustic-service.js";
import type { AcousticServiceOptions } from "../../src/app/acoustic-service.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";

type WorkerPort = ReturnType<NonNullable<AcousticServiceOptions["workerFactory"]>>;
interface Batch {
  batchId: number;
  requests: AcousticRequest[];
}
class FakeWorker implements WorkerPort {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  messages: Batch[] = [];
  terminated = 0;
  throwOnPost = false;
  postMessage(value: unknown): void {
    if (this.throwOnPost) throw new Error("DataCloneError");
    this.messages.push(structuredClone(value as Batch));
  }
  terminate(): void {
    this.terminated++;
  }
  emit(value: unknown): void {
    this.onmessage?.call(this as unknown as Worker, new MessageEvent("message", { data: value }));
  }
  reply(batch = this.messages.at(-1)!) {
    return {
      batchId: batch.batchId,
      computeMs: 0.5,
      results: batch.requests.map((request) => ({
        sourceId: request.source.id,
        solution: solveAcoustics(request),
      })),
    };
  }
}
const request = (index = 0): AcousticRequest => ({
  requestId: `request.${index}`,
  sceneRevision: 7,
  geometryRevision: 3,
  poseTick: 120,
  source: { id: `source.${index}`, positionM: [0, 0, 0] },
  listener: { id: "listener", positionM: [3, 4, 0] },
  surfaces: [],
  materials: [],
  atmosphere: { medium: "air", speedOfSoundMps: 343 },
  budget: { maxPaths: 8 },
});
function fixture(options: Omit<AcousticServiceOptions, "workerFactory"> = {}) {
  const workers: FakeWorker[] = [];
  const service = new AcousticService(true, {
    ...options,
    workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { service, workers };
}

test("one in-flight batch rejects backpressure without a hidden Worker queue", async () => {
  const { service, workers } = fixture();
  const input = request();
  const promise = service.solve([input]);
  input.poseTick = 999;
  assert.equal(service.busy, true);
  await assert.rejects(service.solve([request(1)]), /SOLVER_BUSY/);
  assert.equal(workers[0]!.messages.length, 1);
  workers[0]!.emit(workers[0]!.reply());
  const result = await promise;
  assert.equal(result[0]!.frame.poseTick, 120, "identity pins cannot be changed after dispatch");
  assert.equal(result[0]!.frame.directDelayS, 5 / 343);
  assert.equal(service.getTelemetry().backpressureRejections, 1);
  assert.equal(service.getTelemetry().completedBatches, 1);
  service.dispose();
});

test("active cancellation terminates obsolete work; old replies cannot settle the new Worker", async () => {
  let clock = 100;
  const { service, workers } = fixture({ now: () => clock });
  const old = service.solve([request()]);
  const oldRejected = assert.rejects(old, /AUTHOR_EDIT/);
  clock += 25;
  assert.equal(service.getTelemetry().pendingAgeMs, 25);
  assert.equal(service.cancel("AUTHOR_EDIT"), true);
  await oldRejected;
  assert.equal(workers[0]!.terminated, 1);
  assert.equal(service.cancel(), false);
  const next = service.solve([request(1)]);
  assert.equal(workers.length, 2);
  const late = workers[0]!.reply();
  late.batchId = workers[1]!.messages[0]!.batchId;
  workers[0]!.emit(late);
  assert.equal(service.busy, true, "even a matching forged ID from old port is ignored");
  clock += 10;
  workers[1]!.emit(workers[1]!.reply());
  await next;
  const telemetry = service.getTelemetry();
  assert.equal(telemetry.cancelledBatches, 1);
  assert.equal(telemetry.ignoredLateReplies, 1);
  assert.equal(telemetry.workerRestarts, 1);
  assert.equal(telemetry.lastRoundTripMs, 10);
  service.dispose();
});

test("timeout terminates the Worker and a later solve creates a fresh transport", async () => {
  const { service, workers } = fixture({ timeoutMs: 10 });
  await assert.rejects(service.solve([request()]), /ACOUSTIC_TIMEOUT/);
  assert.equal(service.busy, false);
  assert.equal(workers[0]!.terminated, 1);
  const next = service.solve([request(1)]);
  workers[1]!.emit(workers[1]!.reply());
  await next;
  assert.equal(service.getTelemetry().timedOutBatches, 1);
  assert.equal(service.getTelemetry().failedBatches, 0);
  service.dispose();
});

for (const event of ["onerror", "onmessageerror"] as const) {
  test(`${event} rejects exactly one batch and clears its timer/transport`, async () => {
    const { service, workers } = fixture();
    const current = service.solve([request()]);
    const rejected = assert.rejects(current, /ACOUSTIC_WORKER|ACOUSTIC_MESSAGE_ERROR/);
    if (event === "onerror")
      workers[0]!.onerror?.call(
        workers[0] as unknown as Worker,
        { message: "fixture error" } as ErrorEvent,
      );
    else
      workers[0]!.onmessageerror?.call(
        workers[0] as unknown as Worker,
        new MessageEvent("messageerror"),
      );
    await rejected;
    assert.equal(service.busy, false);
    assert.equal(workers[0]!.terminated, 1);
    assert.equal(service.getTelemetry().failedBatches, 1);
    service.dispose();
  });
}

test("a synchronous postMessage failure does not leave pending work or a timeout", async () => {
  const { service, workers } = fixture({ timeoutMs: 10 });
  workers[0]!.throwOnPost = true;
  await assert.rejects(service.solve([request()]), /DataCloneError/);
  assert.equal(service.busy, false);
  assert.equal(workers[0]!.terminated, 1);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(service.getTelemetry().failedBatches, 1);
  assert.equal(service.getTelemetry().timedOutBatches, 0);
  service.dispose();
});

for (const key of [
  "requestId",
  "sourceId",
  "listenerId",
  "sceneRevision",
  "geometryRevision",
  "poseTick",
] as const) {
  test(`a reply with stale/wrong ${key} never reaches the caller`, async () => {
    const { service, workers } = fixture();
    const current = service.solve([request()]);
    const rejected = assert.rejects(current, /ACOUSTIC_REPLY_IDENTITY/);
    const reply = workers[0]!.reply();
    const frame = reply.results[0]!.solution.frame;
    if (key === "sceneRevision" || key === "geometryRevision" || key === "poseTick") frame[key]++;
    else frame[key] = "incorrect";
    workers[0]!.emit(reply);
    await rejected;
    assert.equal(workers[0]!.terminated, 1);
    service.dispose();
  });
}

test("malformed/partial/error batches reject as a whole, without publishing partial results", async () => {
  const mutations: ((value: ReturnType<FakeWorker["reply"]>) => unknown)[] = [
    (value) => ({ ...value, results: [] }),
    (value) => ({ ...value, results: [{}] }),
    (value) => ({ ...value, results: [{ error: "ACTUAL_SOLVER_FAILURE" }] }),
    (value) => ({ ...value, computeMs: NaN }),
    (value) => ({ ...value, unexpectedPayload: new Array(10000).fill(0) }),
    (value) => ({ ...value, results: new Array(1) }),
    (value) => {
      Object.assign(value.results[0]!.solution.frame.paths, {
        hiddenPayload: new Array(10000).fill(0),
      });
      return value;
    },
    (value) => {
      value.results[0]!.solution.frame.paths[0]!.bandGains = new Array(7);
      return value;
    },
    (value) => ({ ...value, error: "ACTUAL_BATCH_FAILURE" }),
    (value) => ({
      ...value,
      results: [
        {
          ...value.results[0],
          solution: {
            ...value.results[0]!.solution,
            frame: { ...value.results[0]!.solution.frame, paths: [null] },
          },
        },
      ],
    }),
    (value) => ({
      ...value,
      results: [{ ...value.results[0], solution: { frame: value.results[0]!.solution.frame } }],
    }),
  ];
  for (const mutate of mutations) {
    const { service, workers } = fixture();
    const promise = service.solve([request()]);
    const rejected = assert.rejects(promise);
    workers[0]!.emit(mutate(workers[0]!.reply()));
    await rejected;
    assert.equal(service.getTelemetry().completedBatches, 0);
    assert.equal(service.getTelemetry().failedBatches, 1);
    service.dispose();
  }
});

test("source/path/geometry/payload budgets reject before posting, with no unbounded stringify", async () => {
  const { service, workers } = fixture();
  await assert.rejects(
    service.solve(Array.from({ length: 33 }, (_, i) => request(i))),
    /SOURCE_BUDGET/,
  );
  await assert.rejects(
    service.solve(
      Array.from({ length: 9 }, (_, i) => ({ ...request(i), budget: { maxPaths: 32 } })),
    ),
    /PATH_BUDGET/,
  );
  const huge = request();
  huge.surfaces = new Array(257).fill({ verticesM: [], materialId: "unused", id: "unused" });
  await assert.rejects(service.solve([huge]), /PAYLOAD_BUDGET/);
  const long = request();
  long.requestId = "x".repeat(8193);
  await assert.rejects(service.solve([long]), /PAYLOAD_BUDGET/);
  await assert.rejects(service.solve([request(), request()]), /BATCH_IDENTITY/);
  const hidden = request() as AcousticRequest & { unknownArray: unknown[] };
  hidden.unknownArray = new Array(1);
  Object.assign(hidden.unknownArray, { extra: new Array(10000).fill(0) });
  await assert.rejects(service.solve([hidden]), /PAYLOAD_INVALID/);
  assert.equal(workers[0]!.messages.length, 0);
  assert.equal(service.getTelemetry().budgetRejections, 6);
  assert.equal(service.getTelemetry().submittedBatches, 0);
  service.dispose();
});

test("timing retention is bounded and returned telemetry cannot mutate service history", async () => {
  let clock = 0;
  const { service, workers } = fixture({ now: () => clock });
  for (let index = 0; index < 150; index++) {
    const promise = service.solve([request(index)]);
    clock += index === 149 ? 200 : 2;
    workers[0]!.emit(workers[0]!.reply());
    await promise;
  }
  const telemetry = service.getTelemetry();
  assert.equal(telemetry.retainedTimingSamples, ACOUSTIC_DELIVERY_LIMITS.maxTimingSamples);
  assert.equal(telemetry.lastRoundTripMs, 200);
  assert.equal(telemetry.roundTripP95Ms, 2);
  assert.equal(telemetry.lastWorkerComputeMs, 0.5);
  assert.equal(telemetry.pendingAgeMs, null);
  assert.ok(Object.isFrozen(telemetry));
  assert.throws(() => Object.assign(telemetry, { completedBatches: -1 }));
  assert.equal(service.getTelemetry().completedBatches, 150);
  service.dispose();
});

test("nonprimitive or fractional identities cannot enter the owned scalar handoff", async () => {
  const { service, workers } = fixture();
  const objectId = request() as unknown as Record<string, unknown>;
  objectId.requestId = { mutable: "not a string" };
  await assert.rejects(service.solve([objectId as unknown as AcousticRequest]), /BATCH_IDENTITY/);
  await assert.rejects(service.solve([{ ...request(), poseTick: 1.5 }]), /BATCH_IDENTITY/);
  assert.equal(workers[0]!.messages.length, 0);
  service.dispose();
});

test("dispose is terminal and idempotent for Worker and synchronous modes", async () => {
  const { service, workers } = fixture();
  const current = service.solve([request()]);
  const rejected = assert.rejects(current, /DISPOSED/);
  service.dispose();
  service.dispose();
  await rejected;
  assert.equal(workers[0]!.terminated, 1);
  await assert.rejects(service.solve([request()]), /DISPOSED/);
  const inline = new AcousticService(false);
  assert.equal((await inline.solve([request()]))[0]!.frame.paths[0]!.lengthM, 5);
  const invalid = request();
  invalid.atmosphere.speedOfSoundMps = -1;
  await assert.rejects(inline.solve([invalid]));
  assert.equal(inline.getTelemetry().mode, "synchronous");
  inline.dispose();
  await assert.rejects(inline.solve([]), /DISPOSED/);
});
