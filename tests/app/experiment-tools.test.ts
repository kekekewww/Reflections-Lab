import test from "node:test";
import assert from "node:assert/strict";
import { Ajv2020 } from "ajv/dist/2020.js";
import requestSchema from "../../schemas/ai-tool-request.schema.json" with { type: "json" };
import resultSchema from "../../schemas/ai-tool-result.schema.json" with { type: "json" };
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import type {
  ExperimentToolOptions,
  ExperimentToolResult,
} from "../../src/app/experiment-tools.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import { canonicalStringify, verifyRecording } from "../../src/experiments/index.js";
import type { ExperimentRecorderOptions, RecordingArtifact } from "../../src/experiments/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { ToolRequest } from "../../src/ai/types.js";
import type { AudioEvent } from "../../schemas/sound-behavior/types.js";
import { SOLVER_VERSION } from "../../src/acoustics/index.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";

const ajv = new Ajv2020({ strict: true, allErrors: true, ownProperties: true });
ajv.addSchema(requestSchema);
const validResult = ajv.compile(resultSchema);
function config(scene = createDefaultScene()): ExperimentRecorderOptions {
  const behavior = createDefaultBehaviors(scene);
  return {
    runId: "run.host",
    runEpoch: "epoch.host",
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: behavior,
    generatorConfig: behavior.profiles.map((profile) =>
      profile.rules.map((rule) => rule.generator),
    ),
    solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      temperatureC: 20,
      bandAbsorptionDbPerM: [0, 0, 0, 0, 0, 0, 0],
      dataClass: "Synthetic",
    },
    materialRegistry: DEFAULT_MATERIALS,
    assetManifest: [],
    physicsVersion: "rapier-0.21.0",
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}
function host(options: Partial<ExperimentToolOptions> = {}): ExperimentToolHost {
  return new ExperimentToolHost({ getConfiguration: config, getAssets: () => [], ...options });
}
function request(
  requestId: string,
  tool: ToolRequest["tool"] = "RunSimulation",
  args: Record<string, unknown> = {},
): ToolRequest {
  return {
    schemaVersion: "1.0.0",
    requestId,
    tool,
    sceneId: "scene.reflection-lab",
    expectedSceneRevision: 0,
    transactionId: tool === "PreviewSceneChanges" ? "transaction.test" : null,
    arguments:
      tool === "RunSimulation"
        ? {
            backendId: "custom-web",
            durationS: 0.2,
            timeStepS: 1 / 60,
            seed: 1746,
            replayTraceId: null,
            maxReflectionOrder: 1,
            sampleRateHz: 48000,
            ...args,
          }
        : args,
  };
}
function envelope(result: ExperimentToolResult): void {
  assert.equal(validResult(result), true, JSON.stringify(validResult.errors));
  assert.ok(new TextEncoder().encode(JSON.stringify(result)).byteLength <= 64 * 1024);
}
async function run(
  target: ExperimentToolHost,
  requestId = "request.run",
): Promise<RecordingArtifact> {
  const result = await target.execute(request(requestId));
  envelope(result);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const recording = target.getRun(result.runId!)!;
  await verifyRecording(recording);
  return recording;
}
test("actual isolated Rapier run records tick0 through the exact duration and leaves authored Scene unchanged", async () => {
  const baseline = config(),
    before = canonicalStringify(baseline);
  const target = host({ getConfiguration: () => baseline });
  const result = await target.execute(request("request.actual", "RunSimulation", { seed: 999 }));
  envelope(result);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  assert.equal(result.usage.solverSteps, 12);
  assert.equal(result.usage.inputTokens, null);
  assert.equal(result.usage.actualCostUsd, 0);
  const recording = target.getRun(result.runId!)!;
  assert.equal(recording.startTick, 0);
  assert.equal(recording.endTick, 12);
  assert.equal(recording.frameCount, 13);
  assert.equal(recording.configuration.sceneSnapshot.seed, 999);
  assert.equal((recording.endTick! - recording.startTick!) * recording.configuration.fixedDtS, 0.2);
  assert.ok(
    recording.frames.at(-1)!.poses.find((pose) => pose.objectId === "ball")!.positionM[1] < 1.85,
  );
  assert.ok(
    recording.frames[0]!.audioEvents.length > 0,
    "AlwaysOn genuinely emits at initial tick0",
  );
  const direct = recording.frames[0]!.acousticFrames.flatMap((frame) => frame.paths).find(
    (path) => path.order === 0,
  )!;
  assert.ok(Math.abs(direct.absoluteDelayS - Math.hypot(1.5, 0.3, 6) / 343) < 1e-8);
  assert.equal(canonicalStringify(baseline), before);
  assert.equal(result.metrics.length, 0);
  await verifyRecording(recording);
});
test("zero-order query retains real occlusion and never returns reflections", async () => {
  const scene = createDefaultScene();
  scene.objects.push({
    ...scene.objects.find((object) => object.id === "speaker")!,
    id: "blocker",
    dimensionsM: [3, 3, 0.2],
    positionM: [0.8, 1.5, 1],
    acousticRole: "staticSurface",
    acousticMaterialId: "material.hard",
  });
  const target = host({ getConfiguration: () => config(scene) });
  const result = await target.execute(
    request("request.direct", "RunSimulation", { maxReflectionOrder: 0 }),
  );
  envelope(result);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const recording = target.getRun(result.runId!)!;
  assert.equal(
    (recording.configuration.solverConfig as { maxReflectionOrder: number }).maxReflectionOrder,
    0,
  );
  assert.ok(
    recording.frames.every((frame) =>
      frame.acousticFrames.every((acoustic) => acoustic.paths.every((path) => path.order === 0)),
    ),
  );
  assert.ok(recording.frames[0]!.acousticFrames.length > 0);
  assert.ok(
    recording.frames[0]!.acousticFrames.every((acoustic) => acoustic.paths.length === 0),
    "actual opaque blocker removes the direct path",
  );
});
test("the actual three-second planner run captures physical impacts through behavior into the same acoustic route", async () => {
  const target = host();
  const result = await target.execute(
    request("request.three-seconds", "RunSimulation", { durationS: 3 }),
  );
  envelope(result);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const recording = target.getRun(result.runId!)!;
  assert.equal(recording.startTick, 0);
  assert.equal(recording.endTick, 180);
  assert.equal(recording.frameCount, 181);
  assert.equal(result.usage.solverSteps, 180);
  const frames = recording.frames.filter((frame) =>
    frame.physicsEvents.some((event) => (event as { type: string }).type === "OnImpact"),
  );
  assert.ok(frames.length > 0, "real Rapier contact impulses emit accepted impact events");
  let routed = 0;
  for (const frame of frames)
    for (const event of frame.audioEvents as AudioEvent[]) {
      if (event.trigger.type !== "OnImpact" || event.action !== "start") continue;
      assert.ok(
        frame.physicsEvents.some(
          (raw) => (raw as { eventId: string }).eventId === event.parentPhysicsEventId,
        ),
      );
      assert.ok(event.contact);
      const acoustic = frame.acousticFrames.find((value) => value.sourceId === event.instanceId);
      assert.ok(acoustic, "the actual event instance ID identifies its computed propagation frame");
      assert.equal(acoustic.poseTick, frame.tick);
      const direct = acoustic.paths.find((path) => path.order === 0);
      assert.ok(
        direct,
        "support-boundary contact emitter has a valid direct route, without midpoint self-occlusion",
      );
      assert.deepEqual(direct.verticesM[0], event.positionMetres);
      routed++;
    }
  assert.ok(routed > 0);
});
test("unsupported timestep/order/backend and fractional-step duration are rejected without publishing runs", async () => {
  const target = host();
  for (const [index, args] of [
    { timeStepS: 1 / 120 },
    { maxReflectionOrder: 2 },
    { backendId: "unavailable" },
    { durationS: 0.11 },
  ].entries()) {
    const result = await target.execute(
      request(`request.unsupported.${index}`, "RunSimulation", args),
    );
    envelope(result);
    assert.equal(result.state, "failed");
    assert.ok(["CAPABILITY_UNSUPPORTED", "DOMAIN_INVALID"].includes(result.error!.code));
    assert.deepEqual(result.artifactIds, []);
    assert.deepEqual(result.metrics, []);
  }
  assert.deepEqual(target.getRuns(), []);
});
test("closed request schema rejects extra properties and NaN before allocating a simulation", async () => {
  const target = host();
  await assert.rejects(async () => target.execute({ ...request("request.extra"), extra: true }), {
    code: "SCHEMA_INVALID",
  });
  await assert.rejects(
    async () => target.execute(request("request.nan", "RunSimulation", { durationS: NaN })),
    { code: "SCHEMA_INVALID" },
  );
  assert.equal(target.getUsage().runs, 0);
});
test("scene identity and stale revision fail and never run the current document silently", async () => {
  const target = host();
  for (const input of [
    { ...request("request.stale"), expectedSceneRevision: 3 },
    { ...request("request.scene"), sceneId: "scene.other" },
  ]) {
    const result = await target.execute(input);
    envelope(result);
    assert.equal(result.error!.code, "REVISION_CONFLICT");
  }
  assert.equal(target.getUsage().runs, 0);
});
test("same request id is idempotent while pending and after completion; changed payload is rejected", async () => {
  let saves = 0;
  const target = host({
    persistRecording: async () => {
      saves++;
    },
  });
  const input = request("request.once");
  const [a, b] = await Promise.all([target.execute(input), target.execute(input)]);
  assert.deepEqual(a, b);
  assert.equal(saves, 1);
  assert.equal(target.getRuns().length, 1);
  assert.deepEqual(await target.execute(input), a);
  await assert.rejects(target.execute(request("request.once", "RunSimulation", { seed: 11 })), {
    code: "DOMAIN_INVALID",
  });
});
test("simulation concurrency is one and cancellation is acknowledged only after the loop exits", async () => {
  let release!: () => void, reached!: () => void;
  const waiting = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saves = 0;
  const target = host({
    limits: { yieldEverySteps: 1 },
    yieldControl: async () => {
      reached();
      await gate;
    },
    persistRecording: async () => {
      saves++;
    },
  });
  const pending = target.execute(request("request.cancel"));
  await waiting;
  const other = await target.execute(request("request.concurrent"));
  envelope(other);
  assert.equal(other.state, "budgetExceeded");
  assert.equal(target.cancel("request.other"), false);
  assert.equal(target.cancel("request.cancel"), true);
  assert.equal(
    target.getLedger().find((entry) => entry.requestId === "request.cancel")!.state,
    "cancelRequested",
  );
  assert.equal(target.getUsage().activeRequestId, "request.cancel");
  release();
  const result = await pending;
  envelope(result);
  assert.equal(result.state, "canceled");
  assert.equal(result.error!.code, "CANCELED");
  assert.equal(target.getUsage().activeRequestId, null);
  assert.equal(saves, 0);
  assert.deepEqual(target.getRuns(), []);
});
test("deadline and trace/storage budgets stop without publishing a captured artifact", async () => {
  let now = 0;
  const timed = host({
    now: () => now,
    limits: { wallTimeMs: 10, yieldEverySteps: 1 },
    yieldControl: async () => {
      now = 10;
    },
  });
  const timedResult = await timed.execute(request("request.timeout"));
  envelope(timedResult);
  assert.equal(timedResult.state, "timedOut");
  assert.deepEqual(timed.getRuns(), []);
  for (const [index, limits] of [{ maxTraceBytes: 128 }, { maxStoredBytes: 128 }].entries()) {
    const target = host({ limits });
    const result = await target.execute(request(`request.budget.${index}`));
    envelope(result);
    assert.equal(result.state, "budgetExceeded");
    assert.deepEqual(target.getRuns(), []);
  }
});
test("fresh world explicitly projects binding generations without mutating the live Behavior document", async () => {
  const current = config();
  const document = current.behaviorConfig as ReturnType<typeof createDefaultBehaviors>;
  for (const binding of document.bindings) binding.objectGeneration = 7;
  const before = canonicalStringify(document),
    target = host({ getConfiguration: () => current });
  const recording = await run(target);
  assert.ok(
    (recording.configuration.behaviorConfig as typeof document).bindings.every(
      (binding) => binding.objectGeneration === 1,
    ),
  );
  assert.equal(canonicalStringify(document), before);
});
test("capture and analysis cite immutable real artifacts; unsupported decay metrics remain null", async () => {
  const target = host(),
    recording = await run(target);
  assert.equal(recording.configuration.backendVersion, SOLVER_VERSION);
  assert.ok(
    recording.frames
      .flatMap((frame) => frame.acousticFrames)
      .every(
        (frame) =>
          frame.backendId === recording.configuration.backendId &&
          frame.backendVersion === recording.configuration.backendVersion,
      ),
  );
  const capture = await target.execute(
    request("request.capture", "CaptureExperiment", {
      runId: recording.runId,
      label: "真實計算 baseline",
    }),
  );
  envelope(capture);
  assert.equal(capture.state, "succeeded");
  const reference = target.getArtifact(capture.artifactIds[0]!)!;
  assert.equal(reference.kind, "capture");
  assert.equal(
    (reference.data as { recordingSha256: string }).recordingSha256,
    recording.artifactSha256,
  );
  assert.equal(Object.isFrozen(target.getRun(recording.runId)), true);
  const analysis = await target.execute(
    request("request.analysis", "AnalyzeAcousticResults", {
      runId: recording.runId,
      metrics: ["directArrivalTimeS", "rt60S", "edtS", "t20S", "t30S", "drrDb", "c50Db", "c80Db"],
      bandCentersHz: [125, 250, 500, 1000, 2000, 4000],
    }),
  );
  envelope(analysis);
  assert.equal(analysis.metrics.length, 48);
  for (const metric of analysis.metrics) {
    assert.equal(metric.backendVersion, SOLVER_VERSION);
    assert.ok(
      recording.frames
        .flatMap((frame) => frame.acousticFrames)
        .every((frame) => frame.backendVersion === metric.backendVersion),
    );
    assert.equal(metric.provenance, "computed");
    assert.ok(target.getArtifact(metric.evidenceArtifactId));
    if (metric.metricId === "directArrivalTimeS") {
      assert.equal(metric.availability, "available");
      assert.ok(Math.abs(metric.value! - Math.hypot(1.5, 0.3, 6) / 343) < 1e-8);
    } else {
      assert.equal(metric.availability, "unsupported");
      assert.equal(metric.value, null);
    }
  }
});
test("historical mislabeled backend versions remain intact and cannot produce fresh analysis or replay claims", async () => {
  const maker = host(),
    original = await run(maker, "request.version.original");
  const recorder = new ExperimentRecorder({
    ...original.configuration,
    runId: "run.historical.mislabeled",
    runEpoch: original.runEpoch,
    backendVersion: "1.0.0",
  });
  for (const frame of original.frames) recorder.appendFrame(frame);
  const historical = await recorder.finish(),
    before = canonicalStringify(historical);
  assert.equal(historical.configuration.backendVersion, "1.0.0");
  assert.ok(
    historical.frames
      .flatMap((frame) => frame.acousticFrames)
      .every((frame) => frame.backendVersion === SOLVER_VERSION),
  );
  const target = host({
    getRecording: (runId) => (runId === historical.runId ? historical : null),
  });
  const analysis = await target.execute(
    request("request.version.analysis", "AnalyzeAcousticResults", {
      runId: historical.runId,
      metrics: ["directArrivalTimeS"],
      bandCentersHz: [1000],
    }),
  );
  envelope(analysis);
  assert.equal(analysis.state, "failed");
  assert.equal(analysis.error!.code, "CAPABILITY_UNSUPPORTED");
  assert.deepEqual(analysis.metrics, []);
  const replay = await target.execute(
    request("request.version.replay", "RunSimulation", { replayTraceId: historical.runId }),
  );
  envelope(replay);
  assert.equal(replay.state, "failed");
  assert.equal(replay.error!.code, "CAPABILITY_UNSUPPORTED");
  assert.deepEqual(target.getRuns(), []);
  assert.equal(canonicalStringify(historical), before);
});
test("missing or tampered external artifact cannot be analyzed or captured", async () => {
  const maker = host(),
    original = await run(maker);
  const broken = structuredClone(original);
  broken.frames[0]!.poses[0]!.positionM = [99, 99, 99];
  const target = host({ getRecording: (runId) => (runId === original.runId ? broken : null) });
  for (const [index, runId] of [original.runId, "run.missing"].entries()) {
    const result = await target.execute(
      request(`request.badref.${index}`, "AnalyzeAcousticResults", {
        runId,
        metrics: ["directArrivalTimeS"],
        bandCentersHz: [1000],
      }),
    );
    envelope(result);
    assert.equal(result.state, "failed");
    assert.deepEqual(result.metrics, []);
  }
});
test("comparison requires completed captured experiments and preserves actual paired delta artifact", async () => {
  const target = host(),
    recording = await run(target);
  const first = await target.execute(
    request("request.capture.a", "CaptureExperiment", { runId: recording.runId, label: "A" }),
  );
  const second = await target.execute(
    request("request.capture.b", "CaptureExperiment", { runId: recording.runId, label: "B" }),
  );
  const result = await target.execute(
    request("request.compare", "CompareExperiments", {
      baselineExperimentId: first.artifactIds[0],
      candidateExperimentId: second.artifactIds[0],
      metrics: ["directArrivalTimeS", "rt60S"],
      requireMatchedMotionTrace: true,
    }),
  );
  envelope(result);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const comparison = target.getArtifact(result.artifactIds[0]!)!;
  const pairs = (comparison.data as { pairs: { metricId: string; delta: number | null }[] }).pairs;
  assert.ok(
    pairs
      .filter((pair) => pair.metricId === "directArrivalTimeS")
      .every((pair) => pair.delta === 0),
  );
  assert.ok(pairs.filter((pair) => pair.metricId === "rt60S").every((pair) => pair.delta === null));
  const missing = await target.execute(
    request("request.compare.missing", "CompareExperiments", {
      baselineExperimentId: recording.runId,
      candidateExperimentId: recording.runId,
      metrics: ["rt60S"],
      requireMatchedMotionTrace: true,
    }),
  );
  assert.equal(missing.error!.code, "UNKNOWN_ID");
});
test("unmatched fresh physics or listener experiments are rejected rather than fabricating paired improvements", async () => {
  let current = config();
  const target = host({ getConfiguration: () => current });
  const a = await run(target, "request.run.a");
  const first = await target.execute(
    request("request.cap.a", "CaptureExperiment", { runId: a.runId, label: "A" }),
  );
  const alteredScene = structuredClone(current.sceneSnapshot);
  alteredScene.listener.positionM = [1, 1.6, 4];
  current = config(alteredScene);
  const b = await run(target, "request.run.b");
  const second = await target.execute(
    request("request.cap.b", "CaptureExperiment", { runId: b.runId, label: "B" }),
  );
  const result = await target.execute(
    request("request.unmatched", "CompareExperiments", {
      baselineExperimentId: first.artifactIds[0],
      candidateExperimentId: second.artifactIds[0],
      metrics: ["directArrivalTimeS"],
      requireMatchedMotionTrace: true,
    }),
  );
  envelope(result);
  assert.equal(result.error!.code, "INCOMPATIBLE_EXPERIMENTS");
  assert.deepEqual(result.metrics, []);
});
test("fresh run then authoritative same-motion material reprocessing produces a genuinely comparable candidate", async () => {
  let current = config();
  current.sourceConfig = {
    sources: current.sceneSnapshot.sources,
    phasePolicy: "preserve-authored-epoch",
    frequencyHz: 220,
  };
  const target = host({ getConfiguration: () => current });
  const original = await run(target, "request.trace.a");
  assert.deepEqual(original.configuration.sourceConfig, current.sourceConfig);
  const captureA = await target.execute(
    request("request.trace.capture.a", "CaptureExperiment", { runId: original.runId, label: "A" }),
  );
  const candidateScene = structuredClone(current.sceneSnapshot);
  for (const object of candidateScene.objects)
    if (object.acousticRole === "staticSurface") object.acousticMaterialId = "material.soft";
  current = { ...current, sceneSnapshot: candidateScene };
  const candidateResult = await target.execute(
    request("request.trace.b", "RunSimulation", { replayTraceId: original.runId }),
  );
  envelope(candidateResult);
  assert.equal(candidateResult.state, "succeeded", JSON.stringify(candidateResult.error));
  const candidate = target.getRun(candidateResult.runId!)!;
  assert.equal(candidate.fingerprints.motionTraceHash, original.fingerprints.motionTraceHash);
  assert.equal(
    candidate.fingerprints.physicsEventTraceHash,
    original.fingerprints.physicsEventTraceHash,
  );
  assert.equal(candidate.fingerprints.sourceSignalHash, original.fingerprints.sourceSignalHash);
  assert.equal(candidate.fingerprints.profileHash, original.fingerprints.profileHash);
  assert.notEqual(
    candidate.fingerprints.propagationMaterialHash,
    original.fingerprints.propagationMaterialHash,
  );
  const energy = (recording: RecordingArtifact) =>
    recording.frames[0]!.acousticFrames.flatMap((frame) => frame.paths).reduce(
      (sum, path) => sum + path.bandGains.reduce((bands, gain) => bands + gain ** 2, 0),
      0,
    );
  assert.ok(
    energy(candidate) < energy(original),
    "actual changed material lowers reflected path pressure-ratio-square sum, not an invented RT value",
  );
  const captureB = await target.execute(
    request("request.trace.capture.b", "CaptureExperiment", { runId: candidate.runId, label: "B" }),
  );
  const comparison = await target.execute(
    request("request.trace.compare", "CompareExperiments", {
      baselineExperimentId: captureA.artifactIds[0],
      candidateExperimentId: captureB.artifactIds[0],
      metrics: ["directArrivalTimeS", "rt60S"],
      requireMatchedMotionTrace: true,
    }),
  );
  envelope(comparison);
  assert.equal(comparison.state, "succeeded", JSON.stringify(comparison.error));
  assert.ok(
    comparison.metrics
      .filter((metric) => metric.metricId === "rt60S")
      .every((metric) => metric.value === null),
  );
});
test("preview needs the real staged candidate and reports real collision query data without a commit", async () => {
  const missing = await host().execute(
    request("request.preview.missing", "PreviewSceneChanges", {
      includeCollisionCheck: true,
      includeAcousticCostEstimate: true,
    }),
  );
  envelope(missing);
  assert.equal(missing.error!.code, "PREVIEW_REQUIRED");
  const candidate: SceneSpec = createDefaultScene();
  candidate.sceneRevision = 1;
  candidate.objects.find((object) => object.id === "ball")!.positionM = [1.5, 1.3, -2];
  const before = canonicalStringify(candidate),
    target = host({
      getPreviewScene: (transactionId) => (transactionId === "transaction.test" ? candidate : null),
    });
  const result = await target.execute(
    request("request.preview", "PreviewSceneChanges", {
      includeCollisionCheck: true,
      includeAcousticCostEstimate: true,
    }),
  );
  envelope(result);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const data = target.getArtifact(result.artifactIds[0]!)!.data as {
    collisionCheck: {
      objects: { objectId: string; valid: boolean; blockingObjectIds: string[] }[];
    };
  };
  assert.equal(
    data.collisionCheck.objects.find((value) => value.objectId === "ball")!.valid,
    false,
  );
  assert.ok(
    data.collisionCheck.objects
      .find((value) => value.objectId === "ball")!
      .blockingObjectIds.includes("speaker"),
  );
  assert.equal(canonicalStringify(candidate), before);
  assert.deepEqual(target.getRuns(), []);
});
