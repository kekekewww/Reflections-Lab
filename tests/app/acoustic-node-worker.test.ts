import { mkdir, writeFile } from "node:fs/promises";
import type { Worker as NativeWorker } from "node:worker_threads";
import test from "node:test";
import assert from "node:assert/strict";
import { NodeAcousticWorkerPort } from "../../benchmarks/acoustic-transport/node-port.js";
import {
  loadFormal100Scene,
  initialFormalInput,
} from "../../benchmarks/acoustic-transport/fixture.js";
import { AcousticService } from "../../src/app/acoustic-service.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { solveAcoustics } from "../../src/acoustics/index.js";

async function fullGeometryRequests() {
  const { scene } = await loadFormal100Scene();
  const input = initialFormalInput(scene);
  // A second query tests actual compaction/deduplication. This is a transport fixture,
  // not a claim that the formal scene has a second authored continuous source.
  const ball = scene.objects.find((object) => object.id === "ball")!;
  input.sources = [
    ...input.sources,
    { id: "node.voice.ball", objectId: ball.id, positionM: [...ball.positionM] },
  ];
  return buildAcousticRequests(input);
}

for (const transport of ["clone", "deduplicated"] as const) {
  test(
    `real Node ${transport} transport keeps full geometry and snapshots before startup completes`,
    { timeout: 15000 },
    async () => {
      const requests = await fullGeometryRequests();
      assert.equal(requests.length, 2);
      assert.ok(requests.every((request) => request.surfaces.length === 24));
      assert.ok(requests.every((request) => (request.primitives?.length ?? 0) >= 66));
      assert.ok(requests.every((request) => request.boxOccluders?.length === 33));
      const expected = structuredClone(requests).map(solveAcoustics);
      let port!: NodeAcousticWorkerPort;
      const service = new AcousticService(true, {
        transport,
        workerFactory: () => (port = new NodeAcousticWorkerPort()),
      });
      try {
        const pending = service.solve(requests);
        // There is deliberately no await ready: native Node postMessage must clone now.
        requests[0]!.source.positionM = [99, 99, 99];
        Reflect.set(requests[0]!.surfaces[0]!.verticesM[0]!, "0", 99);
        requests[0]!.materials[0]!.label = "caller mutation after native post";
        assert.deepEqual(await pending, expected);
        await port.ready;
        const telemetry = service.getTelemetry();
        assert.equal(telemetry.lastTransport, transport);
        assert.equal(telemetry.ignoredLateReplies, 0, "bootstrap readiness is not a solver reply");
        assert.equal(telemetry.failedBatches, 0);
        const native = port.getTelemetry();
        assert.equal(native.postCalls, 1);
        assert.ok(native.bootMs !== null && native.bootMs >= 0);
        assert.ok(native.lastPostMs !== null && native.lastPostMs >= 0);
        assert.equal(native.actualWireBytes, null);
        assert.equal(native.backend, "node:worker_threads");
        assert.ok(Object.isFrozen(native));
      } finally {
        service.dispose();
        service.dispose();
        await port.closed;
      }
      assert.equal(port.getTelemetry().state, "closed");
      assert.equal(port.getTelemetry().terminationRequests, 1);
      assert.throws(
        () => port.postMessage({ batchId: 999, requests: [] }),
        /NODE_ACOUSTIC_PORT_CLOSED/,
      );
    },
  );
}

test(
  "real Node cancellation closes the old worker and the next solve uses a fresh port",
  { timeout: 15000 },
  async () => {
    const requests = await fullGeometryRequests();
    const expected = requests.map(solveAcoustics);
    const ports: NodeAcousticWorkerPort[] = [];
    const service = new AcousticService(true, {
      transport: "deduplicated",
      workerFactory: () => {
        const port = new NodeAcousticWorkerPort();
        ports.push(port);
        return port;
      },
    });
    try {
      const cancelled = service.solve(requests);
      const rejected = assert.rejects(cancelled, /BENCHMARK_CANCEL/);
      assert.equal(service.cancel("BENCHMARK_CANCEL"), true);
      await rejected;
      await ports[0]!.closed;
      assert.equal(ports[0]!.getTelemetry().state, "closed");
      assert.deepEqual(await service.solve(requests), expected);
      assert.equal(ports.length, 2);
      assert.equal(service.getTelemetry().workerRestarts, 1);
      assert.equal(service.getTelemetry().cancelledBatches, 1);
    } finally {
      service.dispose();
      await Promise.all(ports.map((port) => port.closed));
    }
  },
);

test(
  "startup import failure settles ready, forwards one error and acknowledges actual exit",
  { timeout: 15000 },
  async () => {
    const port = new NodeAcousticWorkerPort({
      workerModuleUrl: new URL("./missing-acoustic-worker.ts", import.meta.url),
    });
    let errors = 0;
    port.onerror = () => {
      errors++;
      port.terminate();
    };
    try {
      await assert.rejects(port.ready, /Cannot find module|ERR_MODULE_NOT_FOUND|NODE_ACOUSTIC/);
      assert.ok(Number.isInteger(await port.closed));
      assert.equal(errors, 1);
      assert.equal(port.getTelemetry().state, "closed");
      assert.ok(port.getTelemetry().lastError);
    } finally {
      port.terminate();
      await port.closed;
    }
  },
);

test("readiness bounds reject before starting a worker", () => {
  for (const readyTimeoutMs of [0, 5001, 1.5, NaN])
    assert.throws(
      () => new NodeAcousticWorkerPort({ readyTimeoutMs }),
      /NODE_ACOUSTIC_READY_BOUNDS/,
    );
});

test(
  "throwing error callback still terminates the owned native worker and acknowledges its real exit",
  { timeout: 5000 },
  async () => {
    const port = new NodeAcousticWorkerPort();
    await port.ready;
    const native = (port as unknown as { native: NativeWorker }).native;
    port.onerror = () => {
      throw new Error("CALLER_ERROR_CALLBACK");
    };
    try {
      assert.throws(
        () => native.emit("error", new Error("injected native error")),
        /CALLER_ERROR_CALLBACK/,
      );
      const exited = await Promise.race([
        port.closed.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 150)),
      ]);
      assert.equal(exited, true, "callback exception must not skip native termination");
      assert.equal(native.threadId, -1);
    } finally {
      port.onerror = null;
      port.terminate();
      await port.closed;
    }
  },
);

test(
  "a callback exception on an actual unexpected exit cannot strand the closed promise",
  { timeout: 5000 },
  async () => {
    // The ignored cache directory does not exist in a fresh checkout.
    await mkdir(new URL("../../.cache/nonadvanced-acoustic/", import.meta.url), {
      recursive: true,
    });
    const exitSource = new URL(
      "../../.cache/nonadvanced-acoustic/owned-node-exit.mjs",
      import.meta.url,
    );
    await writeFile(exitSource, "process.exit(0);\n");
    const port = new NodeAcousticWorkerPort({ workerModuleUrl: exitSource });
    const native = (port as unknown as { native: NativeWorker }).native;
    const emit = native.emit;
    let resolveActualExit!: (code: number) => void, callbackError: unknown;
    const actualExit = new Promise<number>((resolve) => {
      resolveActualExit = resolve;
    });
    native.emit = function (this: NativeWorker, event: string | symbol, ...args: unknown[]) {
      if (event === "exit") resolveActualExit(args[0] as number);
      try {
        return Reflect.apply(emit, this, [event, ...args]) as boolean;
      } catch (error) {
        if (event !== "exit") throw error;
        callbackError = error;
        return false;
      }
    } as NativeWorker["emit"];
    port.onerror = () => {
      throw new Error("CALLER_EXIT_CALLBACK");
    };
    try {
      assert.equal(
        await actualExit,
        0,
        "only the owned worker module requests its real physical exit",
      );
      const closed = await Promise.race([
        port.closed.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 150)),
      ]);
      assert.equal(closed, true, "actual exit settles ownership before calling the user callback");
      assert.equal(native.threadId, -1);
      assert.match(String(callbackError), /CALLER_EXIT_CALLBACK/);
    } finally {
      port.onerror = null;
      port.terminate();
    }
  },
);
