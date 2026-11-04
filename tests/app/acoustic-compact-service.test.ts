import test from "node:test";
import assert from "node:assert/strict";
import { AcousticService } from "../../src/app/acoustic-service.js";
import type { AcousticServiceOptions } from "../../src/app/acoustic-service.js";
import { packAcousticBatch, unpackAcousticBatch } from "../../src/app/acoustic-transport.js";
import type { AcousticBatchPacket } from "../../src/app/acoustic-transport.js";
import { solveAcoustics, createBoxSurfaces } from "../../src/acoustics/index.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";
import { DEFAULT_MATERIALS } from "../../src/app/defaults.js";

type WorkerPort = ReturnType<NonNullable<AcousticServiceOptions["workerFactory"]>>;
interface Message {
  batchId: number;
  requests?: AcousticRequest[];
  packet?: AcousticBatchPacket;
}
class WorkerFixture implements WorkerPort {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  onmessageerror: Worker["onmessageerror"] = null;
  messages: Message[] = [];
  terminated = 0;
  postMessage(value: unknown): void {
    this.messages.push(structuredClone(value as Message));
  }
  terminate(): void {
    this.terminated++;
  }
  emit(value: unknown): void {
    this.onmessage?.call(this as unknown as Worker, new MessageEvent("message", { data: value }));
  }
  reply(message = this.messages.at(-1)!) {
    const requests = message.packet ? unpackAcousticBatch(message.packet) : message.requests!;
    return {
      batchId: message.batchId,
      computeMs: 0.5,
      results: requests.map((request) => ({
        sourceId: request.source.id,
        solution: solveAcoustics(request),
      })),
    };
  }
}
function input(): AcousticRequest[] {
  const surfaces = createBoxSurfaces({
    id: "floor",
    positionM: [0, -0.5, 0],
    dimensionsM: [10, 1, 10],
    materialId: DEFAULT_MATERIALS[0]!.id,
  });
  return Array.from({ length: 8 }, (_, i) => ({
    requestId: `request.${i}`,
    sceneRevision: 7,
    geometryRevision: 7,
    poseTick: 120,
    source: { id: `voice.${i}`, positionM: [0, 1, 0] },
    listener: { id: "listener", positionM: [3, 1, 0] },
    surfaces: structuredClone(surfaces),
    materials: structuredClone(DEFAULT_MATERIALS),
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    budget: { maxPaths: 8 },
  }));
}
function fixture(transport: "clone" | "deduplicated", timeoutMs = 5000) {
  const workers: WorkerFixture[] = [];
  const service = new AcousticService(true, {
    transport,
    timeoutMs,
    workerFactory: () => {
      const worker = new WorkerFixture();
      workers.push(worker);
      return worker;
    },
  });
  return { service, workers };
}

test("deduplicated service sends a smaller owned packet with exactly the clone-reference solution", async () => {
  const { service, workers } = fixture("deduplicated");
  const requests = input();
  const expected = requests.map(solveAcoustics);
  const pending = service.solve(requests);
  const message = workers[0]!.messages[0]!;
  assert.equal(message.requests, undefined);
  assert.equal(message.packet?.protocol, "acoustic-batch/1");
  requests[0]!.source.positionM = [99, 99, 99];
  requests[0]!.materials[0]!.label = "mutated after dispatch";
  workers[0]!.emit(workers[0]!.reply());
  assert.deepEqual(await pending, expected);
  const telemetry = service.getTelemetry();
  assert.equal(telemetry.transport, "deduplicated");
  assert.equal(telemetry.lastTransport, "deduplicated");
  assert.ok(telemetry.lastWireRequestBytes < telemetry.lastRequestBytes / 2);
  assert.ok(telemetry.lastEncodeMs! >= 0);
  assert.equal(telemetry.inFlight, false);
  service.dispose();
});

for (const transport of ["clone", "deduplicated"] as const) {
  test(`${transport}: one in-flight and cancellation cannot let an old transport settle a new generation`, async () => {
    const { service, workers } = fixture(transport);
    const first = service.solve(input());
    const rejected = assert.rejects(first, /SCENE_RESET/);
    await assert.rejects(service.solve(input()), /SOLVER_BUSY/);
    assert.equal(workers[0]!.messages.length, 1);
    service.cancel("SCENE_RESET");
    await rejected;
    assert.equal(workers[0]!.terminated, 1);
    const next = service.solve(input());
    const forged = workers[0]!.reply();
    forged.batchId = workers[1]!.messages[0]!.batchId;
    workers[0]!.emit(forged);
    assert.equal(service.busy, true);
    workers[1]!.emit(workers[1]!.reply());
    await next;
    assert.equal(service.getTelemetry().ignoredLateReplies, 1);
    service.dispose();
  });

  test(`${transport}: timeout drops all batch ownership and new worker data cannot reuse the old packet`, async () => {
    const { service, workers } = fixture(transport, 10);
    await assert.rejects(service.solve(input()), /ACOUSTIC_TIMEOUT/);
    assert.equal(service.busy, false);
    assert.equal(workers[0]!.terminated, 1);
    const changed = input();
    changed[0]!.source.positionM = [1, 2, 3];
    changed[0]!.poseTick++;
    const next = service.solve(changed);
    workers[1]!.emit(workers[1]!.reply());
    assert.deepEqual(await next, changed.map(solveAcoustics));
    assert.equal(service.getTelemetry().timedOutBatches, 1);
    service.dispose();
  });

  test(`${transport}: crash rejects the batch, keeps caller data owned and safely recreates the worker`, async () => {
    const { service, workers } = fixture(transport);
    const requests = input(),
      before = structuredClone(requests);
    const pending = service.solve(requests);
    const rejected = assert.rejects(pending, /ACOUSTIC_WORKER/);
    workers[0]!.onerror?.call(
      workers[0] as unknown as Worker,
      { message: "fixture crash" } as ErrorEvent,
    );
    await rejected;
    assert.deepEqual(requests, before);
    const next = service.solve(requests);
    workers[1]!.emit(workers[1]!.reply());
    await next;
    assert.equal(service.getTelemetry().failedBatches, 1);
    service.dispose();
  });
}

test("bounded request metadata accepted by clone retains the clone path in candidate mode", async () => {
  const { service, workers } = fixture("deduplicated");
  const requests = input();
  Reflect.set(requests[0]!, "callerMetadata", { label: "bounded caller field" });
  const expected = requests.map(solveAcoustics);
  const pending = service.solve(requests);
  assert.equal(workers[0]!.messages[0]!.packet, undefined);
  assert.equal(service.getTelemetry().lastTransport, "clone");
  assert.deepEqual(workers[0]!.messages[0]!.requests, requests);
  workers[0]!.emit(workers[0]!.reply());
  assert.deepEqual(await pending, expected);
  assert.equal(
    service.getTelemetry().lastWireRequestBytes,
    service.getTelemetry().lastRequestBytes,
  );
  service.dispose();
});

test("packet wrapper depth overhead falls back to clone for a legal logical source snapshot", async () => {
  const { service, workers } = fixture("deduplicated");
  const requests = input();
  let note: unknown = "ok";
  for (let depth = 0; depth < 13; depth++) note = { nested: note };
  Reflect.set(requests[0]!.source, "boundedNote", note);
  const expected = requests.map(solveAcoustics);
  const pending = service.solve(requests);
  // A failed assertion below must not leave the deliberately active test transport pending.
  void pending.catch(() => undefined);
  try {
    const message = workers[0]!.messages[0]!;
    assert.equal(
      service.getTelemetry().lastTransport,
      "clone",
      "extra packet wrapper depth cannot turn clone-legal source metadata into a rejected batch",
    );
    assert.equal(message.packet, undefined);
    workers[0]!.emit(workers[0]!.reply());
    assert.deepEqual(await pending, expected);
    assert.equal(service.getTelemetry().failedBatches, 0);
    assert.equal(
      service.getTelemetry().lastWireRequestBytes,
      service.getTelemetry().lastRequestBytes,
    );
  } finally {
    service.dispose();
    await pending.catch(() => undefined);
  }
});

test("nonenumerable caller array methods cannot remove geometry during actual compact dispatch", async () => {
  const { service, workers } = fixture("deduplicated");
  const requests = input();
  let callerMethodCalls = 0;
  Object.defineProperty(requests[0]!.surfaces, "map", {
    value: () => {
      callerMethodCalls++;
      return [];
    },
    enumerable: false,
  });
  const expected = structuredClone(requests).map(solveAcoustics);
  try {
    const pending = service.solve(requests);
    assert.equal(service.getTelemetry().lastTransport, "deduplicated");
    workers[0]!.emit(workers[0]!.reply());
    assert.deepEqual(
      await pending,
      expected,
      "all six original surfaces retain their full solver effect",
    );
    assert.equal(callerMethodCalls, 0, "transport never executes a caller's array methods");
  } finally {
    service.dispose();
  }
});

test("enumerable accessors retain the clone snapshot rather than aliasing key and stored table values", async () => {
  const reference = fixture("clone"),
    candidate = fixture("deduplicated");
  const make = () => {
    const requests = input();
    for (const request of requests)
      request.surfaces = [
        structuredClone(request.surfaces.find((surface) => surface.id.endsWith(".nx"))!),
      ];
    let reads = 0;
    Object.defineProperty(requests[0]!.surfaces[0]!, "normal", {
      enumerable: true,
      get() {
        return ++reads % 2 ? [-1, 0, 0] : [1, 0, 0];
      },
    });
    return requests;
  };
  let candidatePending: Promise<unknown> | undefined;
  try {
    const original = reference.service.solve(make());
    const referenceMessage = reference.workers[0]!.messages[0]!;
    const expectedSnapshot = referenceMessage.requests!;
    reference.workers[0]!.emit(reference.workers[0]!.reply());
    const expected = await original;
    candidatePending = candidate.service.solve(make());
    void candidatePending.catch(() => undefined);
    const candidateMessage = candidate.workers[0]!.messages[0]!;
    const actualSnapshot = candidateMessage.packet
      ? unpackAcousticBatch(candidateMessage.packet)
      : candidateMessage.requests!;
    assert.deepEqual(
      actualSnapshot,
      expectedSnapshot,
      "table identity and owned data must describe the same native clone snapshot",
    );
    assert.equal(candidate.service.getTelemetry().lastTransport, "clone");
    candidate.workers[0]!.emit(candidate.workers[0]!.reply());
    assert.deepEqual(await candidatePending, expected);
  } finally {
    reference.service.dispose();
    candidate.service.dispose();
    await candidatePending?.catch(() => undefined);
  }
});

test("packet refs cannot exceed the original node cap for a legal exact-boundary logical batch", async () => {
  const { service, workers } = fixture("deduplicated");
  const template = input()[0]!;
  const face = template.surfaces.find((surface) => surface.id.endsWith(".nx"))!;
  const requests = Array.from({ length: 32 }, (_, sourceIndex): AcousticRequest => {
    const request = structuredClone(template);
    request.requestId = `request.boundary.${sourceIndex}`;
    request.source.id = `voice.boundary.${sourceIndex}`;
    request.materials = [
      { ...structuredClone(DEFAULT_MATERIALS[0]!), conditions: `source ${sourceIndex}` },
    ];
    request.surfaces = Array.from({ length: 10 }, (_, faceIndex) => {
      const surface = structuredClone(face);
      surface.id = `wall.s${sourceIndex}.face${faceIndex}`;
      if (sourceIndex < 2 && faceIndex === 0) {
        surface.id = "wall.shared";
        Reflect.set(surface, "boundedText", "x".repeat(8192));
      }
      return surface;
    });
    return request;
  });
  const nodeCount = (root: unknown) => {
    const stack: unknown[] = [root];
    let count = 0;
    while (stack.length) {
      const value = stack.pop();
      count++;
      if (value !== null && typeof value === "object") stack.push(...Object.values(value));
    }
    return count;
  };
  const note: unknown[] = [];
  Reflect.set(requests[0]!.source, "boundedNote", note);
  let remaining = 200_000 - nodeCount(requests);
  while (remaining > 0) {
    if (remaining === 1) {
      note.push(0);
      remaining--;
    } else {
      const length = Math.min(4096, remaining - 1);
      note.push(new Array(length).fill(0));
      remaining -= length + 1;
    }
  }
  assert.equal(nodeCount(requests), 200_000);
  const packet = packAcousticBatch(requests);
  assert.ok(
    nodeCount(packet) > 200_000,
    "packet refs add nodes even though logical data is within its exact cap",
  );
  assert.ok(
    JSON.stringify(packet).length < JSON.stringify(requests).length,
    "compression alone would select this packet",
  );
  const expected = structuredClone(requests).map(solveAcoustics);
  const pending = service.solve(requests);
  void pending.catch(() => undefined);
  try {
    assert.equal(service.getTelemetry().lastTransport, "clone");
    workers[0]!.emit(workers[0]!.reply());
    assert.deepEqual(await pending, expected);
    assert.equal(service.getTelemetry().failedBatches, 0);
  } finally {
    service.dispose();
    await pending.catch(() => undefined);
  }
});
