// Acceptance adapter: executes actual fixture prefix, clockState and finishUI text.
// It does not import the DOM/product fixture or launch a browser.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const base = path.resolve(process.env.V3_CANDIDATE_ROOT ?? ".");
const fixtureFile = path.join(base, "tests/browser/performance-fixture-v3.mjs");
const proofFile = path.resolve("tests/browser/performance-proof-v3.mjs");
const source = await readFile(fixtureFile, "utf8");
const proofModule = await import(pathToFileURL(proofFile).href);
const { quiesceProfile, runProfileTail } = await import(
  pathToFileURL(path.join(base, "tests/browser/performance-quiescence-v3.mjs")).href
);
function between(begin, end) {
  const start = source.indexOf(begin),
    stop = source.indexOf(end, start);
  if (start < 0 || stop < start) throw Error(`ACCEPTANCE_EXTRACTION_BOUNDARY:${begin}`);
  return source.slice(start, stop);
}
const prefix = between("const previousRAF =", "\nconst makeBody =");
const clockState = between("function clockState()", "\nfunction artifactSummary()");
const finish = between("let closedUIRaw =", "\n// BEGIN_TESTABLE_PHYSICS_MAINTENANCE");
const build = new Function(
  "dependencies",
  `
  const {window, requestAnimationFrame, cancelAnimationFrame, performance,
    createProofCollector, PerformanceObserver, setTimeout, quiesceProfile,runProfileTail} = dependencies;
  ${prefix}
  ${source.slice(source.indexOf("let activeProfileAction ="), source.indexOf(";", source.indexOf("let activeProfileAction =")) + 1)}
  ${clockState}
  ${finish}
  return {
    proof: v3Proof, samples, close: closeUIWindow, tail: getUIFinishTail, finish: (options) => finishUI(options), restore: () => restoreRAFObserver(),
    state: () => ({measuring, mounted, runtime, scriptFrameHandle}),
    setState(value) {
      if ('measuring' in value) measuring = value.measuring;
      if ('runtime' in value) runtime = value.runtime;
      if ('mounted' in value) mounted = value.mounted;
      if ('observer' in value) observer = value.observer;
      if ('scriptFrameHandle' in value) scriptFrameHandle = value.scriptFrameHandle;
      collectionWindow = value.collectionWindow ?? collectionWindow;
      interpolationObservation = value.interpolationObservation ?? interpolationObservation;
      measurementStartedClock = value.measurementStartedClock ?? measurementStartedClock;
      startedAt = value.startedAt ?? startedAt;
    }
  };
`,
);

export const { createProofCollector, float64Bits, observationName, V3_LIMITS } = proofModule;
export function makeFixtureHost(options = {}) {
  const pending = new Map(),
    nativeCalls = {
      requests: [],
      cancellations: [],
      fires: [],
      marks: [],
      dispose: 0,
      disconnect: 0,
    };
  let handle = 100,
    time = 10;
  const previousRAF = function (callback) {
    const id = handle++;
    pending.set(id, callback);
    nativeCalls.requests.push(id);
    return id;
  };
  const previousCancelRAF = function (id) {
    nativeCalls.cancellations.push(id);
    pending.delete(id);
    if (options.cancelError) throw options.cancelError;
    return options.cancelValue ?? "native-cancel-value";
  };
  const window = { requestAnimationFrame: previousRAF, cancelAnimationFrame: previousCancelRAF };
  const performance = {
    now: () => ++time,
    mark(name) {
      nativeCalls.marks.push(name);
      if (name.startsWith("reflection-profile.end.") && options.endMarkError)
        throw options.endMarkError;
      if (name.startsWith("rlab-v3.observe.") && options.proofMarkError)
        throw options.proofMarkError;
      return { startTime: ++time };
    },
  };
  let proof;
  const create = (args) => {
    proof = proofModule.createProofCollector({
      ...args,
      ...(options.limits ? { limits: options.limits } : {}),
    });
    for (const method of ["register", "callback", "cancel"]) {
      if (!options[`${method}ObserverError`]) continue;
      proof = {
        ...proof,
        [method]() {
          throw options[`${method}ObserverError`];
        },
      };
    }
    return proof;
  };
  const harness = build({
    quiesceProfile,
    runProfileTail,
    window,
    requestAnimationFrame: previousRAF,
    cancelAnimationFrame: previousCancelRAF,
    performance,
    createProofCollector: create,
    PerformanceObserver: { supportedEntryTypes: [] },
    setTimeout: (callback) => {
      queueMicrotask(callback);
      return 0;
    },
  });
  const runtime = {
    world: {
      paused: false,
      tick: 7,
      clock: { mode: "interactive", accumulatorSeconds: 0, totalDroppedWallTimeSeconds: 0 },
    },
    busy: false,
    audio: null,
    recorder: { getView: () => ({ pending: false, recording: { state: "idle" } }) },
    dispatch: async () => {
      if (options.dispatchError) throw options.dispatchError;
    },
    getSnapshot: () => {
      if (options.snapshotError) throw options.snapshotError;
      return { pauseReason: null, error: null, simulationState: "paused" };
    },
    getSceneDocument: () => {
      if (options.collectError) throw options.collectError;
      return { id: "synthetic-scene" };
    },
    getRecordingArtifact: () => null,
  };
  const mounted = {
    dispose() {
      nativeCalls.dispose++;
      if (options.disposeError) throw options.disposeError;
    },
  };
  const observer = {
    disconnect() {
      nativeCalls.disconnect++;
      if (options.disconnectError) throw options.disconnectError;
    },
  };
  if (!options.deferBegin) proof.begin("fixture-lifecycle");
  harness.setState({
    measuring: !options.deferBegin,
    runtime,
    mounted,
    observer,
    startedAt: 0,
    collectionWindow: {
      collectionId: "fixture-lifecycle",
      beginPerformanceMs: 0,
      endPerformanceMs: null,
      endMarkName: "reflection-profile.end.fixture-lifecycle",
    },
    interpolationObservation: {
      ms: [],
      calls: 0,
      requiredMethod: "interpolatedTransforms",
      observedMethods: ["interpolatedTransforms"],
      successfulCalls: 0,
      failedCalls: 0,
      byMethod: {},
      aggregateScope: "synthetic",
    },
    measurementStartedClock: { totalDroppedWallTimeSeconds: 0 },
  });
  return {
    ...harness,
    window,
    pending,
    nativeCalls,
    runtime,
    mounted,
    observer,
    previousRAF,
    previousCancelRAF,
    nativeRequest: (callback) => previousRAF(callback),
    fire(id, raw = 17.000000000000004) {
      const callback = pending.get(id);
      if (!callback) throw Error("FAKE_NATIVE_NOT_PENDING");
      pending.delete(id);
      nativeCalls.fires.push(id);
      return callback(raw);
    },
  };
}
export function allErrors(error, output = [], seen = new Set()) {
  if (!error || seen.has(error)) return output;
  seen.add(error);
  output.push(error);
  if (Array.isArray(error.errors))
    for (const nested of error.errors) allErrors(nested, output, seen);
  if (error.cause) allErrors(error.cause, output, seen);
  if (Array.isArray(error.cleanupErrors))
    for (const nested of error.cleanupErrors) allErrors(nested, output, seen);
  return output;
}
