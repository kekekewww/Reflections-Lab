import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import type { AcousticService as AcousticServiceClass } from "../../src/app/acoustic-service.js";
declare global {
  interface Window {
    acousticDeliveryHarness: {
      AcousticService: typeof AcousticServiceClass;
      createWorker(): Worker;
    };
  }
}

// No application or Vite HMR client is loaded. All production modules and native Workers are real.
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/acoustic-delivery-harness.html");
  await page.waitForFunction(() => Boolean(window.acousticDeliveryHarness));
});

test("native production Worker preserves pinned identities and independent 3-4-5 delay", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { AcousticService } = window.acousticDeliveryHarness;
    const service = new AcousticService();
    const request = {
      requestId: "native.direct",
      sceneRevision: 3,
      geometryRevision: 2,
      poseTick: 50,
      source: { id: "source", positionM: [0, 0, 0] },
      listener: { id: "listener", positionM: [3, 4, 0] },
      surfaces: [],
      materials: [],
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
    };
    const pending = service.solve([request]);
    let backpressure = "";
    try {
      await service.solve([request]);
    } catch (error) {
      backpressure = String(error);
    }
    request.poseTick = 999;
    const [solution] = await pending;
    const telemetry = service.getTelemetry();
    service.dispose();
    let terminal = "";
    try {
      await service.solve([]);
    } catch (error) {
      terminal = String(error);
    }
    return { frame: solution.frame, telemetry, backpressure, terminal };
  });
  expect(result.frame.poseTick).toBe(50);
  expect(result.frame.paths[0].lengthM).toBe(5);
  expect(result.frame.directDelayS).toBeCloseTo(5 / 343, 12);
  expect(result.frame.paths[0].bandGains[0]).toBeCloseTo(0.2, 12);
  expect(result.telemetry.mode).toBe("worker");
  expect(result.telemetry.completedBatches).toBe(1);
  expect(result.telemetry.backpressureRejections).toBe(1);
  expect(result.telemetry.lastWorkerComputeMs).toBeGreaterThanOrEqual(0);
  expect(result.backpressure).toContain("SOLVER_BUSY");
  expect(result.terminal).toContain("DISPOSED");
});

test("native delayed transport cancellation and timeout terminate obsolete Workers safely", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { AcousticService, createWorker } = window.acousticDeliveryHarness;
    let created = 0,
      terminated = 0;
    const factory = () => {
      created++;
      const worker = createWorker();
      const timers = new Set<ReturnType<typeof setTimeout>>();
      // Controlled delivery delay around the actual production Worker. Solver results
      // and compute timing come from the real native Worker, never from a mock solver.
      const port: Pick<
        Worker,
        "onmessage" | "onerror" | "onmessageerror" | "postMessage" | "terminate"
      > = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        postMessage: (value) => worker.postMessage(value),
        terminate() {
          terminated++;
          for (const timer of timers) clearTimeout(timer);
          timers.clear();
          worker.terminate();
        },
      };
      worker.onmessage = (event) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          port.onmessage?.call(worker, event);
        }, 150);
        timers.add(timer);
      };
      worker.onerror = (event) => port.onerror?.call(worker, event);
      worker.onmessageerror = (event) => port.onmessageerror?.call(worker, event);
      return port;
    };
    const request = {
      requestId: "delayed",
      sceneRevision: 1,
      geometryRevision: 1,
      poseTick: 1,
      source: { id: "source", positionM: [0, 0, 0] },
      listener: { id: "listener", positionM: [3, 4, 0] },
      surfaces: [],
      materials: [],
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
    };
    const service = new AcousticService(true, { workerFactory: factory });
    const old = service.solve([request]).then(
      () => "unexpected-success",
      (error) => String(error),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    const age = service.getTelemetry().pendingAgeMs;
    const cancelled = service.cancel("AUTHOR_EDIT");
    const cancellation = await old;
    request.requestId = "new";
    request.poseTick = 2;
    const next = await service.solve([request]);
    const afterCancel = service.getTelemetry();
    service.dispose();
    const timed = new AcousticService(true, { workerFactory: factory, timeoutMs: 30 });
    const timeout = await timed.solve([request]).then(
      () => "unexpected-success",
      (error) => String(error),
    );
    const afterTimeout = timed.getTelemetry();
    timed.dispose();
    return {
      age,
      cancelled,
      cancellation,
      nextTick: next[0].frame.poseTick,
      afterCancel,
      timeout,
      afterTimeout,
      created,
      terminated,
    };
  });
  expect(result.age).toBeGreaterThanOrEqual(15);
  expect(result.cancelled).toBe(true);
  expect(result.cancellation).toContain("AUTHOR_EDIT");
  expect(result.nextTick).toBe(2);
  expect(result.afterCancel.cancelledBatches).toBe(1);
  expect(result.afterCancel.completedBatches).toBe(1);
  expect(result.afterCancel.workerRestarts).toBe(1);
  expect(result.timeout).toContain("ACOUSTIC_TIMEOUT");
  expect(result.afterTimeout.timedOutBatches).toBe(1);
  expect(result.created).toBe(3);
  expect(result.terminated).toBe(3);
});

test("native production Worker returns bounded solver failures and remains recoverable", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { AcousticService } = window.acousticDeliveryHarness;
    const service = new AcousticService();
    const request = {
      requestId: "invalid",
      sceneRevision: 0,
      geometryRevision: 0,
      poseTick: 1,
      source: { id: "source", positionM: [0, 0, 0] },
      listener: { id: "listener", positionM: [1, 0, 0] },
      surfaces: [],
      materials: [],
      atmosphere: { medium: "air", speedOfSoundMps: -1 },
    };
    const error = await service.solve([request]).then(
      () => "unexpected-success",
      (error) => String(error),
    );
    request.atmosphere.speedOfSoundMps = 343;
    const next = await service.solve([request]);
    const telemetry = service.getTelemetry();
    service.dispose();
    return { error, nextDelay: next[0].frame.directDelayS, telemetry };
  });
  expect(result.error).not.toBe("unexpected-success");
  expect(result.nextDelay).toBeCloseTo(1 / 343, 12);
  expect(result.telemetry.failedBatches).toBe(1);
  expect(result.telemetry.completedBatches).toBe(1);
  expect(result.telemetry.workerRestarts).toBe(1);
});

test("20Hz 8-source/32-surface order1 Worker profile records actual tail and payload costs", async ({
  page,
  browser,
}) => {
  const profile = await page.evaluate(async () => {
    const { AcousticService } = window.acousticDeliveryHarness;
    const service = new AcousticService();
    const bands = [125, 250, 500, 1000, 2000, 4000, 8000];
    const material = {
      schemaVersion: "1.0.0",
      id: "synthetic",
      revision: 1,
      label: "Synthetic profile only",
      dataClass: "Synthetic",
      sourceUrls: [],
      conditions: "zero phase unmeasured benchmark fixture",
      phaseModel: "zeroPhaseMagnitudeOnly",
      bands: bands.map((centerHz) => ({
        centerHz,
        absorptionEnergy: 0.2,
        reflectionEnergy: 0.8,
        transmissionEnergy: 0,
        scatteringFraction: 0,
      })),
    };
    const surfaces = [];
    for (const y of [0, 4])
      for (let x = -8; x < 8; x += 4)
        for (let z = -8; z < 8; z += 4)
          surfaces.push({
            id: `plane.${y}.${x}.${z}`,
            materialId: "synthetic",
            twoSided: true,
            role: "staticReflector",
            verticesM: [
              [x, y, z],
              [x, y, z + 4],
              [x + 4, y, z + 4],
              [x + 4, y, z],
            ],
          });
    const requests = Array.from({ length: 8 }, (_, index) => ({
      requestId: `profile.${index}`,
      sceneRevision: 1,
      geometryRevision: 1,
      poseTick: 0,
      source: { id: `source.${index}`, positionM: [index - 3.3, 1.2, -2] },
      listener: { id: "listener", positionM: [3, 1.6, 2] },
      surfaces,
      materials: [material],
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
      budget: { maxPaths: 32, maxSurfaces: 32, maxSegmentTests: 10000 },
    }));
    const samples = [];
    for (let index = 0; index < 130; index++) {
      for (const request of requests) {
        request.poseTick = index;
        request.requestId = `profile.${index}.${request.source.id}`;
      }
      const started = performance.now();
      const results = await service.solve(requests);
      const finished = performance.now();
      if (index >= 10)
        samples.push({
          roundTripWithDispatchMs: finished - started,
          telemetry: service.getTelemetry(),
          totalPaths: results.reduce((sum, result) => sum + result.frame.paths.length, 0),
          reflections: results.reduce(
            (sum, result) => sum + result.frame.paths.filter((path) => path.order === 1).length,
            0,
          ),
        });
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 50 - (performance.now() - started))),
      );
    }
    const percentile = (values) =>
      [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
    const final = service.getTelemetry();
    service.dispose();
    return {
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemoryGiB: navigator.deviceMemory ?? null,
        viewport: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
      },
      fixture: {
        deliveryEnvironment: "production bundle; no Vite transform/HMR during measurement",
        sources: 8,
        listener: 1,
        surfaces: 32,
        reflectionOrder: 1,
        warmupJobs: 10,
        measuredJobs: samples.length,
        cadenceHz: 20,
      },
      p95: {
        roundTripIncludingDispatchMs: percentile(
          samples.map((value) => value.roundTripWithDispatchMs),
        ),
        workerComputeMs: percentile(samples.map((value) => value.telemetry.lastWorkerComputeMs)),
        serviceDeliveryHandlerMs: percentile(
          samples.map((value) => value.telemetry.lastDeliveryHandlerMs),
        ),
      },
      minPaths: Math.min(...samples.map((value) => value.totalPaths)),
      maxPaths: Math.max(...samples.map((value) => value.totalPaths)),
      minReflections: Math.min(...samples.map((value) => value.reflections)),
      finalTelemetry: final,
      samples,
      limitations: [
        "Order1 only; order2 is not implemented by this product solver.",
        "Service handler excludes runtime audio/UI consumers.",
        "This is an isolated 6-second measured Worker profile, not the required 10-minute whole-product UI/audio soak.",
        "No hardware hearing or AudioWorklet deadline evidence.",
      ],
    };
  });
  const artifact = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    evidenceClass: "REAL_CHROME_WORKER",
    browserVersion: browser.version(),
    host: {
      platform: os.platform(),
      release: os.release(),
      cpu: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
    },
    ...profile,
  };
  await writeFile(
    "tests/acoustics-runtime/delivery-browser-20261027.json",
    JSON.stringify(artifact, null, 2),
  );
  expect(profile.fixture.measuredJobs).toBe(120);
  expect(profile.finalTelemetry.completedBatches).toBe(130);
  expect(profile.finalTelemetry.retainedTimingSamples).toBe(128);
  expect(profile.maxPaths).toBeLessThanOrEqual(256);
  expect(profile.minPaths).toBeGreaterThanOrEqual(8);
  expect(profile.minReflections).toBeGreaterThan(0);
  expect(profile.finalTelemetry.lastRequestBytes).toBeLessThanOrEqual(
    profile.finalTelemetry.maxPayloadBytes,
  );
  expect(profile.p95.roundTripIncludingDispatchMs).toBeLessThan(20);
  expect(profile.p95.serviceDeliveryHandlerMs).toBeLessThan(1);
});
