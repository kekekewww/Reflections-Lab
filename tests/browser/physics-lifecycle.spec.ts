import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const measurements: Record<string, unknown>[] = [];
const physicsPaths = [
  "src/physics/physics-world.ts",
  "src/physics/fixed-clock.ts",
  "src/scene/validate-scene.ts",
];
async function sourceHashes(paths: string[]) {
  return Promise.all(
    paths.map(async (path) => ({
      path,
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    })),
  );
}

test.beforeEach(async ({ context }) => {
  // A same-origin empty document lets each case select its actual production modules and
  // instrument resources before creation. It neither imports the app's main twice nor mocks physics.
  await context.route("**/physics-lifecycle-harness", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      // Installed plugin-react preamble also permits this same-origin case in the normal
      // development test suite; it is harmless when the dedicated server disables refresh.
      body: "<!doctype html><html><head><title>Real physics lifecycle</title><script type='module'>import { injectIntoGlobalHook } from '/@react-refresh';injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;</script></head><body><div id='root'></div></body></html>",
    }),
  );
});

test("real Chrome/WASM fixed 60 Hz and four body modes preserve their physical semantics", async ({
  page,
}, info) => {
  const beforeHashes = await sourceHashes(physicsPaths);
  await page.goto("/physics-lifecycle-harness");
  const result = await page.evaluate(async () => {
    const { PhysicsWorld } = await import("/src/physics/index.ts");
    const makeObject = (id: string, mode: string, x: number) => ({
      id,
      shape: "sphere",
      dimensionsM: [0.2, 0.2, 0.2],
      positionM: [x, 5, 0],
      orientationQuaternion: [0, 0, 0, 1],
      mode,
      massKg: 2,
      friction: 0.5,
      restitution: 0,
      physicsMaterialId: "physics.test",
      acousticMaterialId: "acoustic.test",
      acousticRole: "none",
    });
    const scene = {
      schemaVersion: "1.0.0",
      sceneId: "browser-four-modes",
      sceneRevision: 0,
      units: "SI",
      coordinateSystem: "right-handed-y-up-minus-z-forward",
      seed: 42,
      gravityMps2: [0, -9.81, 0],
      objects: [
        makeObject("gravity", "dynamicGravity", 0),
        makeObject("inertial", "dynamicNoGravity", 3),
        makeObject("locked", "fixed", 6),
        makeObject("driven", "kinematic", 9),
        { ...makeObject("wall", "fixed", 9.35), shape: "box", dimensionsM: [0.02, 2, 2] },
      ],
      sources: [],
      listener: {
        id: "listener.test",
        positionM: [0, 1.6, 3],
        orientationQuaternion: [0, 0, 0, 1],
        attachment: "independent",
      },
    };
    const world = await PhysicsWorld.create(scene);
    try {
      const initial = world.snapshot();
      world.setVelocity("inertial", [2, 0, 0], [0, 0.2, 0]);
      world.applyImpulse("locked", [100, 20, 0]);
      world.setKinematicTarget("driven", [9.05, 5, 0]);
      world.resume();
      const first = world.step();
      world.applyImpulse("inertial", [2, 0, 0]);
      const impulseVelocity = world.getPose("inertial").linearVelocityMetresPerSecond;
      const beforeGravityOn = world.getPose("inertial");
      world.setMode("inertial", "dynamicGravity");
      const afterGravityOn = world.getPose("inertial");
      world.step();
      const beforeGravityOff = world.getPose("inertial");
      world.setMode("inertial", "dynamicNoGravity");
      const afterGravityOff = world.getPose("inertial");
      world.step();
      const afterNoGravityStep = world.getPose("inertial");
      world.setMode("inertial", "fixed");
      const locked = world.getPose("inertial");
      world.applyImpulse("inertial", [100, 0, 0]);
      world.step();
      const lockedAfterImpulse = world.getPose("inertial");
      world.setMode("inertial", "dynamicNoGravity");
      const unlocked = world.getPose("inertial");
      let blockedCode: string | null = null;
      for (let index = 0; index < 10; index++) {
        const pose = world.getPose("driven");
        try {
          world.setKinematicTarget("driven", [pose.positionMetres[0] + 0.05, 5, 0]);
        } catch (error) {
          blockedCode = String((error as { code: string }).code);
          break;
        }
        world.step();
      }
      const beforeBlockedStep = world.getPose("driven");
      world.step();
      const afterBlockedStep = world.getPose("driven");
      world.pause();
      const paused = world.snapshot();
      const pausedAdvance = world.advance(1);
      world.step();
      const pausedAfter = world.snapshot();
      return {
        userAgent: navigator.userAgent,
        initial,
        first,
        impulseVelocity,
        beforeGravityOn,
        afterGravityOn,
        beforeGravityOff,
        afterGravityOff,
        afterNoGravityStep,
        locked,
        lockedAfterImpulse,
        unlocked,
        blockedCode,
        beforeBlockedStep,
        afterBlockedStep,
        paused,
        pausedAfter,
        pausedAdvanceSteps: pausedAdvance.steps,
      };
    } finally {
      world.dispose();
    }
  });
  const pose = (id: string) =>
    result.first.poses.find((value: { objectId: string }) => value.objectId === id)!;
  expect(result.first.fixedDtSeconds).toBe(1 / 60);
  expect(result.first.tick).toBe(1);
  expect(pose("gravity").positionMetres[1]).toBeLessThan(5);
  expect(
    Math.abs(pose("gravity").linearVelocityMetresPerSecond[1] + 9.81 / 60),
  ).toBeLessThanOrEqual(0.001);
  expect(Math.abs(pose("inertial").positionMetres[1] - 5)).toBeLessThanOrEqual(1e-5);
  expect(Math.abs(pose("inertial").positionMetres[0] - (3 + 2 / 60))).toBeLessThanOrEqual(1e-5);
  expect(Math.abs(result.impulseVelocity[0] - 3)).toBeLessThanOrEqual(1e-5);
  expect(pose("locked").positionMetres).toEqual([6, 5, 0]);
  expect(Math.abs(pose("driven").positionMetres[0] - 9.05)).toBeLessThanOrEqual(1e-5);
  expect(result.afterGravityOn.linearVelocityMetresPerSecond).toEqual(
    result.beforeGravityOn.linearVelocityMetresPerSecond,
  );
  expect(result.afterGravityOn.angularVelocityRadiansPerSecond).toEqual(
    result.beforeGravityOn.angularVelocityRadiansPerSecond,
  );
  expect(result.afterGravityOff.linearVelocityMetresPerSecond).toEqual(
    result.beforeGravityOff.linearVelocityMetresPerSecond,
  );
  expect(result.afterGravityOff.angularVelocityRadiansPerSecond).toEqual(
    result.beforeGravityOff.angularVelocityRadiansPerSecond,
  );
  expect(
    Math.abs(
      result.afterNoGravityStep.linearVelocityMetresPerSecond[1] -
        result.afterGravityOff.linearVelocityMetresPerSecond[1],
    ),
  ).toBeLessThanOrEqual(1e-5);
  expect(result.lockedAfterImpulse.positionMetres).toEqual(result.locked.positionMetres);
  expect(result.unlocked.linearVelocityMetresPerSecond).toEqual([0, 0, 0]);
  expect(result.unlocked.angularVelocityRadiansPerSecond).toEqual([0, 0, 0]);
  expect(result.blockedCode).toBe("KINEMATIC_BLOCKED");
  expect(result.afterBlockedStep.positionMetres).toEqual(result.beforeBlockedStep.positionMetres);
  expect(result.pausedAdvanceSteps).toBe(0);
  expect(result.pausedAfter).toEqual(result.paused);
  const afterHashes = await sourceHashes(physicsPaths);
  expect(afterHashes).toEqual(beforeHashes);
  const record = {
    requirement: ["V1-PHY-01", "V1-PHY-02", "RLAB-TASK-0006.AC-02"],
    sourceHashes: beforeHashes,
    sourceStable: true,
    browser: result.userAgent,
    method: "actual browser-hosted PhysicsWorld methods, not Inspector click coverage",
    result,
  };
  measurements.push(record);
  await info.attach("four-modes-measurements", {
    body: JSON.stringify(record, null, 2),
    contentType: "application/json",
  });
});

test("actual app bootstrap: ten reset/import cycles preserve one world/queue/worker and disposal stops RAF and GPU resources", async ({
  page,
}, info) => {
  const paths = [
    ...physicsPaths,
    "src/app/bootstrap.ts",
    "src/app/runtime.ts",
    "src/main.tsx",
    "src/app/acoustic-service.ts",
    "src/ui/Viewport.tsx",
    "src/ui/viewport/CameraRig.tsx",
    "src/ui/styles.css",
    "src/ui/viewport/SceneEntities.tsx",
  ];
  const beforeHashes = await sourceHashes(paths);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/physics-lifecycle-harness");
  const result = await page.evaluate(async () => {
    const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const waitUntil = async (predicate: () => boolean, description: string, timeoutMs = 10_000) => {
      const deadline = performance.now() + timeoutMs;
      while (!predicate()) {
        if (performance.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
        await pause(25);
      }
    };
    const globals = new Set([window, document]);
    const observedTypes = new Set([
      "keydown",
      "keyup",
      "pointerlockchange",
      "pointerlockerror",
      "pointerdown",
      "pointerup",
      "mousemove",
      "mousedown",
      "mouseup",
      "wheel",
      "blur",
      "contextmenu",
      "visibilitychange",
      "compositionstart",
      "compositionend",
      "focusin",
    ]);
    const listeners: {
      target: EventTarget;
      type: string;
      listener: EventListenerOrEventListenerObject | null;
      capture: boolean;
      signal?: AbortSignal;
    }[] = [];
    const nativeAdd = EventTarget.prototype.addEventListener,
      nativeRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      nativeAdd.call(this, type, listener, options);
      const capture = typeof options === "boolean" ? options : (options?.capture ?? false);
      if (
        globals.has(this as Window | Document) &&
        observedTypes.has(type) &&
        !listeners.some(
          (value) =>
            value.target === this &&
            value.type === type &&
            value.listener === listener &&
            value.capture === capture,
        )
      )
        listeners.push({
          target: this,
          type,
          listener,
          capture,
          ...(typeof options === "object" && options.signal ? { signal: options.signal } : {}),
        });
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      nativeRemove.call(this, type, listener, options);
      const capture = typeof options === "boolean" ? options : (options?.capture ?? false);
      const index = listeners.findIndex(
        (value) =>
          value.target === this &&
          value.type === type &&
          value.listener === listener &&
          value.capture === capture,
      );
      if (index >= 0) listeners.splice(index, 1);
    };
    const { PhysicsWorld } = await import("/src/physics/index.ts");
    const worlds = new Set<object>(),
      queues = new Set<object>(),
      watched = new WeakSet<object>();
    const counts = {
      createdWorlds: 0,
      freedWorlds: 0,
      createdQueues: 0,
      freedQueues: 0,
      workerCreated: 0,
      workerTerminated: 0,
      rafCallbacks: 0,
    };
    const watchRaw = (host: unknown) => {
      const internal = host as { world: { free(): void }; queue: { free(): void } };
      for (const [raw, set, created, freed] of [
        [internal.world, worlds, "createdWorlds", "freedWorlds"],
        [internal.queue, queues, "createdQueues", "freedQueues"],
      ] as const) {
        if (watched.has(raw)) continue;
        watched.add(raw);
        set.add(raw);
        counts[created]++;
        const free = raw.free;
        raw.free = function () {
          free.call(this);
          if (set.delete(raw)) counts[freed]++;
        };
      }
    };
    const originalCreate = PhysicsWorld.create;
    PhysicsWorld.create = async (...args: Parameters<typeof originalCreate>) => {
      const host = await originalCreate(...args);
      watchRaw(host);
      return host;
    };
    const originalReset = PhysicsWorld.prototype.reset;
    PhysicsWorld.prototype.reset = function (...args: Parameters<typeof originalReset>) {
      originalReset.apply(this, args);
      watchRaw(this);
    };
    const workers = new Set<Worker>();
    const NativeWorker = Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        workers.add(this);
        counts.workerCreated++;
      }
      terminate() {
        if (workers.delete(this)) counts.workerTerminated++;
        super.terminate();
      }
    };
    const rafs = new Set<number>();
    const request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const handle = request((time) => {
        rafs.delete(handle);
        counts.rafCallbacks++;
        callback(time);
      });
      rafs.add(handle);
      return handle;
    };
    window.cancelAnimationFrame = (handle) => {
      rafs.delete(handle);
      cancel(handle);
    };
    const contexts: {
      canvas: HTMLCanvasElement;
      lost: boolean;
      resources: Map<string, Set<object>>;
    }[] = [];
    const seenContexts = new WeakSet<object>();
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof getContext>) {
      const context = getContext.apply(this, args);
      if (
        context &&
        (args[0] === "webgl" || args[0] === "webgl2" || args[0] === "experimental-webgl") &&
        !seenContexts.has(context)
      ) {
        seenContexts.add(context);
        const gl = context as WebGLRenderingContext;
        const entry = { canvas: this, lost: false, resources: new Map<string, Set<object>>() };
        contexts.push(entry);
        this.addEventListener("webglcontextlost", () => {
          entry.lost = true;
          for (const values of entry.resources.values()) values.clear();
        });
        for (const suffix of [
          "Buffer",
          "Texture",
          "Program",
          "Shader",
          "Framebuffer",
          "Renderbuffer",
          "VertexArray",
        ]) {
          const table = gl as unknown as Record<
            string,
            (...values: unknown[]) => object | null | void
          >;
          const create = table[`create${suffix}`],
            remove = table[`delete${suffix}`];
          if (!create || !remove) continue;
          const live = new Set<object>();
          entry.resources.set(suffix, live);
          table[`create${suffix}`] = function (...values) {
            const value = create.apply(gl, values);
            if (value) live.add(value);
            return value;
          };
          table[`delete${suffix}`] = function (...values) {
            const result = remove.apply(gl, values);
            if (values[0]) live.delete(values[0] as object);
            return result;
          };
        }
      }
      return context;
    } as typeof getContext;
    const { mountReflectionLab } = await import("/src/app/bootstrap.ts");
    const element = document.getElementById("root")!;
    const handle = await mountReflectionLab(element);
    const runtime = handle.runtime;
    const observe = () => ({
      liveWorlds: worlds.size,
      liveQueues: queues.size,
      liveWorkers: workers.size,
      pendingRaf: rafs.size,
      canvasCount: element.querySelectorAll("canvas").length,
      globalListeners: listeners
        .filter((value) => !value.signal?.aborted)
        .map((value) => ({
          target: value.target === document ? "document" : "window",
          type: value.type,
          capture: value.capture,
        })),
      contexts: contexts.map((context) => ({
        lost: context.lost,
        resources: Object.fromEntries(
          [...context.resources].map(([name, live]) => [name, live.size]),
        ),
      })),
      counts: { ...counts },
    });
    const rendererReady = () =>
      contexts.some(
        (context) => !context.lost && (context.resources.get("Buffer")?.size ?? 0) > 0,
      ) &&
      listeners.some(
        (value) => value.target === document && value.type === "keydown" && value.capture,
      );
    // Canvas insertion precedes R3F's separate async WebGL configuration. Wait for a real
    // draw's GPU buffers and OrbitControls registration, rather than assuming a one-second sleep.
    await waitUntil(rendererReady, "real WebGL buffers and document OrbitControls listener");
    const baseline = observe();
    const cycles: {
      index: number;
      afterReset: ReturnType<typeof observe>;
      afterImport: ReturnType<typeof observe>;
      error: string;
      revision: number;
      resetTick: number;
      roundtripPreserved: boolean;
    }[] = [];
    for (let index = 0; index < 10; index++) {
      await runtime.dispatch({ type: "run" });
      await pause(35);
      await runtime.dispatch({ type: "pause" });
      await runtime.dispatch({ type: "reset" });
      await pause(25);
      const afterReset = observe();
      const resetTick = runtime.getSnapshot().tick;
      const expectedScene = runtime.getSceneDocument();
      // Roundtrip the current real exported document, including post-reset generation pins.
      await runtime.importProject(runtime.exportProject());
      await pause(60);
      cycles.push({
        index,
        afterReset,
        afterImport: observe(),
        error: runtime.getSnapshot().error ?? "",
        revision: runtime.getSnapshot().sceneRevision,
        resetTick,
        roundtripPreserved:
          JSON.stringify(runtime.getSceneDocument()) === JSON.stringify(expectedScene),
      });
    }
    const sceneBeforeInvalid = JSON.stringify(runtime.getSceneDocument());
    let illegalImportError: string | null = null;
    try {
      await runtime.importProject("{invalid JSON}");
    } catch (error) {
      illegalImportError = error instanceof Error ? error.message : String(error);
    }
    const illegalImportPreserved =
      JSON.stringify(runtime.getSceneDocument()) === sceneBeforeInvalid;
    const beforeDispose = observe();
    handle.dispose();
    handle.dispose();
    await pause(1500);
    const teardownCycles: {
      index: number;
      mounted: ReturnType<typeof observe>;
      disposed: ReturnType<typeof observe>;
    }[] = [{ index: 0, mounted: beforeDispose, disposed: observe() }];
    for (let index = 1; index < 10; index++) {
      const next = await mountReflectionLab(element);
      await waitUntil(rendererReady, "remounted real renderer");
      await next.runtime.dispatch({ type: "run" });
      await pause(35);
      await next.runtime.dispatch({ type: "pause" });
      await next.runtime.dispatch({ type: "reset" });
      await next.runtime.importProject(next.runtime.exportProject());
      await pause(75);
      const mounted = observe();
      next.dispose();
      next.dispose();
      await pause(900);
      teardownCycles.push({ index, mounted, disposed: observe() });
    }
    const disposed = observe();
    const callbacksAtDispose = counts.rafCallbacks;
    await pause(200);
    const callbacksAfterWait = counts.rafCallbacks;
    return {
      userAgent: navigator.userAgent,
      baseline,
      cycles,
      beforeDispose,
      disposed,
      callbacksAtDispose,
      callbacksAfterWait,
      htmlAfterDispose: element.innerHTML,
      illegalImportError,
      illegalImportPreserved,
      teardownCycles,
    };
  });
  await info.attach("lifecycle-observations", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
  expect(result.baseline.canvasCount).toBe(1);
  expect(result.baseline.liveWorlds).toBe(1);
  expect(result.baseline.liveQueues).toBe(1);
  expect(result.baseline.liveWorkers).toBe(1);
  expect(result.baseline.pendingRaf).toBeGreaterThan(0);
  expect(result.baseline.contexts.length).toBeGreaterThan(0);
  expect(
    result.baseline.globalListeners.some(
      (value) => value.target === "document" && value.type === "keydown" && value.capture,
    ),
  ).toBe(true);
  for (const cycle of result.cycles) {
    expect(cycle.error).toBe("");
    expect(cycle.resetTick).toBe(0);
    expect(cycle.roundtripPreserved).toBe(true);
    expect(cycle.afterReset.liveWorlds).toBe(1);
    expect(cycle.afterReset.liveQueues).toBe(1);
    expect(cycle.afterReset.liveWorkers).toBe(1);
    expect(cycle.afterImport.liveWorlds).toBe(1);
    expect(cycle.afterImport.liveQueues).toBe(1);
    expect(cycle.afterImport.liveWorkers).toBe(1);
    expect(cycle.afterImport.canvasCount).toBe(1);
  }
  expect(result.disposed.liveWorlds).toBe(0);
  expect(result.disposed.liveQueues).toBe(0);
  expect(result.disposed.liveWorkers).toBe(0);
  expect(result.disposed.pendingRaf).toBe(0);
  expect(result.disposed.canvasCount).toBe(0);
  expect(result.disposed.globalListeners).toEqual([]);
  expect(result.teardownCycles).toHaveLength(10);
  for (const cycle of result.teardownCycles) {
    expect(cycle.mounted.canvasCount).toBe(1);
    expect(cycle.mounted.liveWorlds).toBe(1);
    expect(cycle.mounted.liveQueues).toBe(1);
    expect(cycle.mounted.liveWorkers).toBe(1);
    expect(cycle.disposed.canvasCount).toBe(0);
    expect(cycle.disposed.liveWorlds).toBe(0);
    expect(cycle.disposed.liveQueues).toBe(0);
    expect(cycle.disposed.liveWorkers).toBe(0);
    expect(cycle.disposed.pendingRaf).toBe(0);
    expect(cycle.disposed.globalListeners).toEqual([]);
  }
  expect(result.disposed.counts.createdWorlds).toBe(result.disposed.counts.freedWorlds);
  expect(result.disposed.counts.createdQueues).toBe(result.disposed.counts.freedQueues);
  expect(result.disposed.counts.workerCreated).toBe(result.disposed.counts.workerTerminated);
  for (const context of result.disposed.contexts)
    for (const count of Object.values(context.resources)) expect(count).toBe(0);
  expect(result.callbacksAfterWait).toBe(result.callbacksAtDispose);
  expect(result.htmlAfterDispose).toBe("");
  expect(result.illegalImportError).toBeTruthy();
  expect(result.illegalImportPreserved).toBe(true);
  const afterHashes = await sourceHashes(paths);
  expect(afterHashes).toEqual(beforeHashes);
  const record = {
    requirement: "V1-SCN-03",
    sourceHashes: beforeHashes,
    sourceStable: true,
    browser: result.userAgent,
    method:
      "real React/R3F app via production bootstrap; transparent native RAF/Worker/WebGL and Rapier free instrumentation",
    result,
  };
  measurements.push(record);
  await info.attach("lifecycle-measurements", {
    body: JSON.stringify(record, null, 2),
    contentType: "application/json",
  });
});

test.afterAll(async () => {
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/v1-physics-browser-measurements.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        recordedAt: new Date().toISOString(),
        measurements,
        limitations: [
          "Chrome on this machine; not a cross-browser proof",
          "graphics exercised via software ANGLE/SwiftShader",
          "no human hearing or audio-device deadline evidence",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});
