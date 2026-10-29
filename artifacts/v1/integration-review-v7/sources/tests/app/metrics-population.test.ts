import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import {
  collectRecordingPathSamples,
  compareRecordings,
  computeRecordingMetrics,
  canonicalStringify,
} from "../../src/experiments/index.js";
import type { LabAction } from "../../src/ui/contracts.js";
import type { ExperimentToolHost } from "../../src/app/experiment-tools.js";

test("actual Root impact/expiry capture compares identical and material-only B using the same playing query population", async () => {
  const values = new Map<string, string>(),
    blobs = new BlobStore({ indexedDB: null });
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
  const command = async (action: LabAction) => {
    await app.dispatch(action);
    assert.equal(app.getSnapshot().error, "", action.type);
  };
  try {
    await command({ type: "recordToggle" });
    for (let step = 0; step < 180; step++) {
      app.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await command({ type: "recordToggle" });
    await command({ type: "captureComparison", slot: "A" });
    const a = app.getComparisonArtifacts().A!,
      rawBefore = canonicalStringify(a);
    assert.ok(
      a.frames.some((frame) => frame.audioEvents.some((event) => event.action === "stop")),
      "the actual recording must contain a real one-shot expiry/stop",
    );
    const rawRouteCount = a.frames.reduce((sum, frame) => sum + frame.acousticFrames.length, 0);
    const populationA = collectRecordingPathSamples(a);
    assert.ok(
      populationA.population.excludedNonPlayingQueryCount > 0,
      "retained raw stop diagnostics are excluded from emission-conditioned samples",
    );
    assert.ok(rawRouteCount > populationA.pathEnergy.length);
    await command({ type: "captureComparison", slot: "B" });
    const same = app.getComparisonArtifacts().B!;
    const sameComparison = await compareRecordings(a, same, {
      kind: "acoustic",
      independentVariables: ["acousticMaterial"],
    });
    assert.equal(sameComparison.matched, true, JSON.stringify(sameComparison.mismatches));
    for (const id of ["meanDirectDelay", "meanPathEnergy"]) {
      const metric = sameComparison.metrics.find((value) => value.id === id)!;
      assert.equal(
        metric.delta,
        0,
        `same material ${id} must not change because the baseline retains stop diagnostics`,
      );
      assert.equal(metric.population!.compatible, true);
      assert.equal(metric.population!.a.sampleCount, metric.population!.b.sampleCount);
      assert.equal(metric.population!.a.kind, "logicalPlayingSourceQueries");
    }
    await command({
      type: "patchObject",
      objectId: "wall.back",
      patch: { acousticMaterialId: "material.soft" },
    });
    await command({ type: "captureComparison", slot: "B" });
    const material = app.getComparisonArtifacts().B!;
    const changed = await compareRecordings(a, material, {
      kind: "acoustic",
      independentVariables: ["acousticMaterial"],
    });
    assert.equal(changed.matched, true, JSON.stringify(changed.mismatches));
    assert.equal(changed.metrics.find((value) => value.id === "meanDirectDelay")!.delta, 0);
    assert.ok(
      changed.metrics.find((value) => value.id === "meanPathEnergy")!.delta! < 0,
      "the actual changed absorption lowers modeled path-pressure-ratio-square sum",
    );
    assert.equal(changed.metrics.find((value) => value.id === "rt60")!.delta, null);
    assert.equal(
      canonicalStringify(a),
      rawBefore,
      "metric eligibility never deletes or rewrites the raw recording",
    );

    const tools = (app as unknown as { experimentTools: ExperimentToolHost }).experimentTools;
    const scene = app.getSceneDocument();
    const analysis = await tools.execute({
      schemaVersion: "1.0.0",
      requestId: "request.metrics.root-analysis",
      tool: "AnalyzeAcousticResults",
      sceneId: scene.sceneId,
      expectedSceneRevision: scene.sceneRevision,
      transactionId: null,
      arguments: { runId: a.runId, metrics: ["directArrivalTimeS"], bandCentersHz: [1000] },
    });
    assert.equal(analysis.state, "succeeded", JSON.stringify(analysis.error));
    assert.equal(
      analysis.metrics[0]!.value,
      computeRecordingMetrics(a).find((value) => value.id === "meanDirectDelay")!.value,
    );
    assert.equal(analysis.metrics[0]!.methodId, "analysis.mean-playing-direct-delay.v2");
    assert.ok(
      analysis.metrics[0]!.limitations.some(
        (value) =>
          value.includes(`samples=${populationA.directDelay.length}`) &&
          value.includes("logicalPlayingSourceQueries"),
      ),
    );
  } finally {
    app.dispose();
    blobs.close();
  }
});
