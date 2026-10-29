import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { ExperimentToolHost } from "../../src/app/experiment-tools.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { compareRecordings, verifyRecording } from "../../src/experiments/index.js";
import type { LabAction } from "../../src/ui/contracts.js";
import type { ToolRequest } from "../../src/ai/types.js";

test("root bridge: offline capture and real same-motion material B use the central logical phase proof for AI Capture/Compare", async () => {
  const values = new Map<string, string>();
  const blobs = new BlobStore({ indexedDB: null });
  const app = await LabRuntime.create({
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    },
    useWorker: false,
    blobStore: blobs,
  });
  const command = async (action: LabAction): Promise<void> => {
    await app.dispatch(action);
    assert.equal(
      app.getSnapshot().error,
      "",
      `${action.type} must use the actual root composition`,
    );
  };
  const steps = async (count: number): Promise<void> => {
    for (let index = 0; index < count; index++) {
      app.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  };
  try {
    // No enableAudio, AudioContext adapter or provider fixture is used. This is
    // genuine logical source content and propagation, never native playback.
    await command({ type: "run" });
    await steps(20);
    await command({ type: "recordToggle" });
    await steps(8);
    await command({ type: "recordToggle" });
    await command({ type: "captureComparison", slot: "A" });
    const a = app.getComparisonArtifacts().A!;
    assert.equal(a.sourcePhaseEvidence!.evidenceClass, "logicalIntent");
    assert.ok(
      a.frames.every((frame) => {
        const source = frame.behaviorSnapshot as {
          preStepVoiceCursors: unknown;
          voiceCursors: unknown;
          voiceIntents: unknown[];
        };
        assert.deepEqual(source.preStepVoiceCursors, {});
        assert.deepEqual(source.voiceCursors, {});
        return source.voiceIntents.length > 0;
      }),
      "root actually captures continuous logical intents with empty native-cursor maps before device activation",
    );
    await command({
      type: "patchObject",
      objectId: "wall.back",
      patch: { acousticMaterialId: "material.soft" },
    });
    await command({ type: "captureComparison", slot: "B" });
    const b = app.getComparisonArtifacts().B!;
    await Promise.all([verifyRecording(a), verifyRecording(b)]);
    assert.equal(b.sourcePhaseEvidence!.evidenceClass, "logicalIntent");
    assert.equal(a.fingerprints.motionTraceHash, b.fingerprints.motionTraceHash);
    assert.equal(a.fingerprints.physicsEventTraceHash, b.fingerprints.physicsEventTraceHash);
    assert.equal(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
    assert.notEqual(a.fingerprints.propagationMaterialHash, b.fingerprints.propagationMaterialHash);
    const baselineEnergy = a.frames[0]!.acousticFrames.flatMap((frame) => frame.paths).reduce(
      (sum, path) => sum + path.bandGains.reduce((bands, gain) => bands + gain * gain, 0),
      0,
    );
    const candidateEnergy = b.frames[0]!.acousticFrames.flatMap((frame) => frame.paths).reduce(
      (sum, path) => sum + path.bandGains.reduce((bands, gain) => bands + gain * gain, 0),
      0,
    );
    assert.ok(
      candidateEnergy < baselineEnergy,
      "B really solves the new material, rather than copying A acoustic frames",
    );
    const central = await compareRecordings(a, b, {
      kind: "acoustic",
      independentVariables: ["acousticMaterial"],
    });
    assert.equal(central.matched, true, JSON.stringify(central.mismatches));
    assert.equal(app.getSnapshot().monitor.state, "blocked", "no device activation is fabricated");

    // Test seam reaches the existing root-owned trusted router, not a second host
    // with a caller-invented recording registry or a mocked model response.
    const tools = (app as unknown as { experimentTools: ExperimentToolHost }).experimentTools;
    const scene = app.getSceneDocument();
    const request = (
      requestId: string,
      tool: ToolRequest["tool"],
      args: Record<string, unknown>,
    ): ToolRequest => ({
      schemaVersion: "1.0.0",
      requestId,
      tool,
      sceneId: scene.sceneId,
      expectedSceneRevision: scene.sceneRevision,
      transactionId: null,
      arguments: args,
    });
    const capturedA = await tools.execute(
      request("request.root.capture-a", "CaptureExperiment", { runId: a.runId, label: "Root A" }),
    );
    const capturedB = await tools.execute(
      request("request.root.capture-b", "CaptureExperiment", { runId: b.runId, label: "Root B" }),
    );
    assert.equal(capturedA.state, "succeeded", JSON.stringify(capturedA.error));
    assert.equal(capturedB.state, "succeeded", JSON.stringify(capturedB.error));
    const comparison = await tools.execute(
      request("request.root.compare", "CompareExperiments", {
        baselineExperimentId: capturedA.artifactIds[0],
        candidateExperimentId: capturedB.artifactIds[0],
        metrics: ["directArrivalTimeS", "rt60S"],
        requireMatchedMotionTrace: true,
      }),
    );
    assert.equal(comparison.state, "succeeded", JSON.stringify(comparison.error));
    assert.ok(
      comparison.metrics
        .filter((metric) => metric.metricId === "directArrivalTimeS")
        .every((metric) => metric.value !== null),
    );
    assert.ok(
      comparison.metrics
        .filter((metric) => metric.metricId === "rt60S")
        .every((metric) => metric.value === null && metric.availability === "unsupported"),
    );
    assert.equal(tools.getArtifact(comparison.artifactIds[0]!)!.kind, "comparison");
    assert.equal(comparison.usage.actualCostUsd, 0);
  } finally {
    app.dispose();
    blobs.close();
  }
});
