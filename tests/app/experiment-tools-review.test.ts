import test from "node:test";
import assert from "node:assert/strict";
import { SOLVER_VERSION } from "../../src/acoustics/index.js";
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import type { ExperimentToolResult } from "../../src/app/experiment-tools.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import {
  canonicalBytes,
  ExperimentRecorder,
  sha256Canonical,
  verifyRecording,
} from "../../src/experiments/index.js";
import type { ExperimentRecorderOptions, RecordingArtifact } from "../../src/experiments/types.js";
import type { ToolRequest } from "../../src/ai/types.js";

function configuration(): ExperimentRecorderOptions {
  const scene = createDefaultScene(),
    behavior = createDefaultBehaviors(scene);
  return {
    runId: "run.review",
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: behavior,
    generatorConfig: behavior.profiles.map((profile) =>
      profile.rules.map((rule) => rule.generator),
    ),
    solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
    materialRegistry: DEFAULT_MATERIALS,
    atmosphere: { medium: "air", speedOfSoundMps: 343, temperatureC: 20, dataClass: "Synthetic" },
    physicsVersion: "rapier-0.21.0",
    backendId: "custom-web-geometric",
    backendVersion: SOLVER_VERSION,
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}
function runRequest(requestId: string): ToolRequest {
  const scene = createDefaultScene();
  return {
    schemaVersion: "1.0.0",
    requestId,
    tool: "RunSimulation",
    sceneId: scene.sceneId,
    expectedSceneRevision: scene.sceneRevision,
    transactionId: null,
    arguments: {
      backendId: "custom-web",
      durationS: 0.1,
      timeStepS: 1 / 60,
      seed: scene.seed,
      replayTraceId: null,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  };
}
function analyzeRequest(requestId: string, runId: string): ToolRequest {
  return {
    ...runRequest(requestId),
    tool: "AnalyzeAcousticResults",
    arguments: { runId, metrics: ["directArrivalTimeS"], bandCentersHz: [1000] },
  };
}
async function actualRecording(requestId: string): Promise<RecordingArtifact> {
  const maker = new ExperimentToolHost({ getConfiguration: configuration, getAssets: () => [] });
  const result = await maker.execute(runRequest(requestId));
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  return maker.getRun(result.runId!)!;
}

test("independent review: synchronous status subscribers cannot reenter an unregistered request", async () => {
  const input = runRequest("request.review.reentrant");
  let entered = false,
    saves = 0,
    nested: Promise<ExperimentToolResult> | null = null;
  const target = new ExperimentToolHost({
    getConfiguration: configuration,
    getAssets: () => [],
    persistRecording: async () => {
      saves++;
    },
    onChange: () => {
      if (!entered) {
        entered = true;
        nested = target.execute(input);
      }
    },
  });
  const result = await target.execute(input);
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  assert.ok(nested);
  assert.deepEqual(await nested, result);
  assert.equal(saves, 1);
  assert.equal(target.getUsage().runs, 1);
  assert.equal(target.getUsage().toolCalls, 1);
});

test("independent review: asynchronous persistence cannot race the final aggregate artifact budget", async () => {
  const external = await actualRecording("request.review.external");
  const wrapper = {
    id: `artifact.${external.artifactSha256.slice(0, 40)}`,
    sha256: await sha256Canonical(external),
    kind: "recording",
    data: external,
  };
  const maximum = Math.floor(canonicalBytes(wrapper) * 1.6);
  let arrive!: () => void, release!: () => void;
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const target = new ExperimentToolHost({
    getConfiguration: configuration,
    getAssets: () => [],
    getRecording: (id) => (id === external.runId ? external : null),
    limits: { maxStoredBytes: maximum },
    persistRecording: async () => {
      arrive();
      await gate;
    },
  });
  const pending = target.execute(runRequest("request.review.waiting"));
  await arrived;
  const analysis = await target.execute(
    analyzeRequest("request.review.concurrent-analysis", external.runId),
  );
  assert.equal(analysis.state, "succeeded", JSON.stringify(analysis.error));
  release();
  const result = await pending;
  assert.equal(result.state, "budgetExceeded");
  assert.equal(result.error?.code, "BUDGET_EXCEEDED");
  assert.ok(target.getUsage().storedBytes <= maximum);
  assert.equal(target.getRuns().length, 0, "the second commit must not publish an over-budget run");
  assert.ok(
    target.getArtifact(analysis.artifactIds[0]!),
    "the prior verified result remains accessible",
  );
});

test("independent review: external recordings are copied before asynchronous verification", async () => {
  const original = await actualRecording("request.review.snapshot");
  const mutable = structuredClone(original);
  let supplied = false;
  const target = new ExperimentToolHost({
    getConfiguration: configuration,
    getAssets: () => [],
    getRecording: (runId) => {
      if (runId !== mutable.runId) return null;
      if (!supplied) {
        supplied = true;
        queueMicrotask(() => {
          mutable.frames[0]!.poses[0]!.positionM = [99, 99, 99];
        });
      }
      return mutable;
    },
  });
  const result = await target.execute(
    analyzeRequest("request.review.analyze-snapshot", mutable.runId),
  );
  assert.equal(result.state, "succeeded", JSON.stringify(result.error));
  const stored = target.getArtifact(result.artifactIds[0]!)!.data as RecordingArtifact;
  await verifyRecording(stored);
  assert.deepEqual(stored.frames[0]!.poses[0]!.positionM, original.frames[0]!.poses[0]!.positionM);
  assert.notDeepEqual(
    mutable.frames[0]!.poses[0]!.positionM,
    stored.frames[0]!.poses[0]!.positionM,
  );
});

test("independent review: equal Scene source hashes cannot hide different captured native source phases", async () => {
  const original = await actualRecording("request.review.native-phase");
  const withPhase = async (
    runId: string,
    offset: number,
    model = "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer",
  ) => {
    const recorder = new ExperimentRecorder({
      ...original.configuration,
      runId,
      runEpoch: original.runEpoch,
    });
    for (const frame of original.frames) {
      const snapshot = structuredClone(frame.behaviorSnapshot) as {
        preStepSnapshot: {
          state: { tick: number; instances: { instanceId: string; startedAtTick: number }[] };
        };
        runtimeSnapshot: {
          state: { tick: number; instances: { instanceId: string; startedAtTick: number }[] };
        };
        preStepVoiceCursors?: unknown;
        voiceCursors?: unknown;
        cursorModel: string;
      };
      const cursor = (state: typeof snapshot.runtimeSnapshot.state) =>
        Object.fromEntries(
          state.instances.map((instance) => {
            const elapsed = (state.tick - instance.startedAtTick) * original.configuration.fixedDtS;
            return [
              instance.instanceId,
              {
                playheadSeconds: Math.max(0, elapsed - offset),
                elapsedSinceEmissionSeconds: elapsed,
                remainingDurationSeconds: null,
              },
            ];
          }),
        );
      // Synthetic recording metadata models late native admission. This is an
      // integrity/grounding regression, never native playback validation.
      snapshot.cursorModel = model;
      snapshot.preStepVoiceCursors = cursor(snapshot.preStepSnapshot.state);
      snapshot.voiceCursors = cursor(snapshot.runtimeSnapshot.state);
      recorder.appendFrame({ ...frame, behaviorSnapshot: snapshot });
    }
    return recorder.finish();
  };
  const a = await withPhase("run.review.phase-a", 0),
    b = await withPhase("run.review.phase-b", 0.004);
  assert.equal(a.fingerprintVersion, "content-and-cursors-v2");
  assert.equal(b.fingerprintVersion, "content-and-cursors-v2");
  assert.notEqual(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  assert.equal(a.fingerprints.motionTraceHash, b.fingerprints.motionTraceHash);
  const recordings = new Map([
    [a.runId, a],
    [b.runId, b],
  ]);
  const target = new ExperimentToolHost({
    getConfiguration: configuration,
    getAssets: () => [],
    getRecording: (runId) => recordings.get(runId) ?? null,
  });
  const capture = async (requestId: string, runId: string) =>
    target.execute({
      ...runRequest(requestId),
      tool: "CaptureExperiment",
      arguments: { runId, label: runId },
    });
  const capturedA = await capture("request.review.capture-phase-a", a.runId),
    capturedB = await capture("request.review.capture-phase-b", b.runId);
  assert.equal(capturedA.state, "succeeded");
  assert.equal(capturedB.state, "succeeded");
  const result = await target.execute({
    ...runRequest("request.review.compare-phase"),
    tool: "CompareExperiments",
    arguments: {
      baselineExperimentId: capturedA.artifactIds[0],
      candidateExperimentId: capturedB.artifactIds[0],
      metrics: ["directArrivalTimeS"],
      requireMatchedMotionTrace: true,
    },
  });
  assert.equal(result.state, "failed");
  assert.ok(["INCOMPATIBLE_EXPERIMENTS", "CAPABILITY_UNSUPPORTED"].includes(result.error!.code));
  assert.deepEqual(result.metrics, []);
  const unknownA = await withPhase("run.review.unknown-a", 0, "UNKNOWN_CURSOR_PROTOCOL"),
    unknownB = await withPhase("run.review.unknown-b", 0, "UNKNOWN_CURSOR_PROTOCOL");
  recordings.set(unknownA.runId, unknownA);
  recordings.set(unknownB.runId, unknownB);
  const capturedUnknownA = await capture("request.review.capture-unknown-a", unknownA.runId),
    capturedUnknownB = await capture("request.review.capture-unknown-b", unknownB.runId);
  const unknown = await target.execute({
    ...runRequest("request.review.compare-unknown"),
    tool: "CompareExperiments",
    arguments: {
      baselineExperimentId: capturedUnknownA.artifactIds[0],
      candidateExperimentId: capturedUnknownB.artifactIds[0],
      metrics: ["directArrivalTimeS"],
      requireMatchedMotionTrace: true,
    },
  });
  assert.equal(
    unknown.state,
    "failed",
    "matching unknown cursor metadata does not establish source phase equality",
  );
  assert.ok(["INCOMPATIBLE_EXPERIMENTS", "CAPABILITY_UNSUPPORTED"].includes(unknown.error!.code));
  assert.deepEqual(unknown.metrics, []);
});

test("independent review: authoritative replay rejects changed physics rather than labelling old motion as a new physical run", async () => {
  let current = configuration();
  const originalConfiguration = structuredClone(current);
  const target = new ExperimentToolHost({ getConfiguration: () => current, getAssets: () => [] });
  const first = await target.execute(runRequest("request.review.physical-baseline"));
  assert.equal(first.state, "succeeded", JSON.stringify(first.error));
  const changes = [
    (configuration: ExperimentRecorderOptions) => {
      configuration.sceneSnapshot.objects.find((object) => object.id === "ball")!.massKg *= 2;
    },
    (configuration: ExperimentRecorderOptions) => {
      configuration.sceneSnapshot.gravityMps2 = [0, 0, 0];
    },
    (configuration: ExperimentRecorderOptions) => {
      configuration.sceneSnapshot.objects.find((object) => object.id === "ball")!.positionM[1] += 1;
    },
  ];
  for (const [index, change] of changes.entries()) {
    current = structuredClone(originalConfiguration);
    change(current);
    const input = runRequest(`request.review.physics-replay.${index}`);
    input.arguments.replayTraceId = first.runId;
    const result = await target.execute(input);
    assert.equal(result.state, "failed");
    assert.equal(result.error?.code, "INCOMPATIBLE_EXPERIMENTS");
    assert.deepEqual(result.artifactIds, []);
  }
  assert.equal(target.getRuns().length, 1, "the original actual simulation remains available");
});
