import test from "node:test";
import assert from "node:assert/strict";
import { AgentHost } from "../../src/ai/host.js";
import { explainMetrics } from "../../src/ai/grounding.js";
import type {
  AgentAdapter,
  PlannerProvenance,
  ToolRequest,
  MetricEvidence,
} from "../../src/ai/types.js";
import type { SceneSpec } from "../../src/scene/types.js";

// The adapter is a deliberate isolated host-policy fixture. These tests make no
// claim that this fixture validates real Scene commands, physics or acoustics.
const provenance: PlannerProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
};
function baseScene(): SceneSpec {
  return {
    schemaVersion: "1.0.0",
    sceneId: "scene.host-fixture",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects: [],
    sources: [],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  };
}
function addRequest(id = "request.add-1", objectId = "object.add-1"): ToolRequest {
  return {
    schemaVersion: "1.0.0",
    requestId: id,
    tool: "AddObject",
    sceneId: "scene.host-fixture",
    expectedSceneRevision: 0,
    transactionId: "transaction.fixture",
    arguments: {
      objectId,
      label: "隔離測試球",
      shape: "sphere",
      dimensionsM: [0.5, 0.5, 0.5],
      positionM: [0, 1, 0],
      orientationQuaternion: [0, 0, 0, 1],
      materialId: "material.synthetic",
      mode: "dynamicGravity",
      massKg: 1,
    },
  };
}
function simulationRequest(id: string): ToolRequest {
  return {
    schemaVersion: "1.0.0",
    requestId: id,
    tool: "RunSimulation",
    sceneId: "scene.host-fixture",
    expectedSceneRevision: 0,
    transactionId: null,
    arguments: {
      backendId: "custom-web",
      durationS: 1,
      timeStepS: 1 / 60,
      seed: 1,
      replayTraceId: null,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    },
  };
}
function fixture() {
  let state = baseScene();
  let commits = 0;
  let restores = 0;
  let reads = 0;
  const adapter: AgentAdapter = {
    getScene: () => structuredClone(state),
    preview: (requests) => {
      const candidate = structuredClone(state);
      for (const request of requests) {
        if (request.tool !== "AddObject")
          throw Object.assign(new Error("unsupported fixture tool"), {
            code: "CAPABILITY_UNSUPPORTED",
          });
        const a = request.arguments;
        candidate.objects.push({
          id: a.objectId as string,
          shape: "sphere",
          dimensionsM: [0.5, 0.5, 0.5],
          positionM: [0, 1, 0],
          orientationQuaternion: [0, 0, 0, 1],
          mode: "dynamicGravity",
          massKg: 1,
          friction: 0.5,
          restitution: 0.3,
          physicsMaterialId: "material.synthetic",
          acousticMaterialId: "material.synthetic",
          acousticRole: "dynamicOccluder",
        });
      }
      candidate.sceneRevision = state.sceneRevision + 1;
      return { candidate, changes: ["Add fixture sphere"], warnings: ["HOST_POLICY_FIXTURE_ONLY"] };
    },
    commit: async (candidate, expectedRevision) => {
      // Yield once so two concurrent applies can actually race without a host lock.
      await Promise.resolve();
      assert.equal(state.sceneRevision, expectedRevision);
      commits++;
      state = structuredClone(candidate);
      state.sceneRevision = expectedRevision + 1;
      return structuredClone(state);
    },
    restore: async (snapshot, expectedRevision) => {
      assert.equal(state.sceneRevision, expectedRevision);
      restores++;
      state = structuredClone(snapshot);
      state.sceneRevision = expectedRevision + 1;
      return structuredClone(state);
    },
    runTool: async (request) => {
      reads++;
      return { runId: "run." + request.requestId, state: "succeeded", metrics: [] };
    },
  };
  return {
    adapter,
    scene: () => structuredClone(state),
    counts: () => ({ commits, restores, reads }),
    externalEdit: () => {
      state.sceneRevision++;
    },
  };
}
async function rejectsCode(operation: Promise<unknown>, codes: string | string[]) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(
      error && typeof error === "object" && "code" in error,
      "explicit domain error required",
    );
    assert.ok(
      (Array.isArray(codes) ? codes : [codes]).includes(String(error.code)),
      String(error.code),
    );
    return true;
  });
}

test("stage is a real isolated preview; only explicit human Apply commits, Undo creates a new revision", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter);
  const before = f.scene();
  const preview = await host.stage([addRequest()], provenance);
  assert.deepEqual(f.scene(), before);
  assert.equal(preview.state, "awaitingApproval");
  assert.equal(preview.baseRevision, 0);
  assert.equal(preview.candidate.objects.length, 1);
  assert.equal(preview.provenance.label, "OFFLINE_DETERMINISTIC");
  const committed = await host.apply(preview.previewId, preview.digest);
  assert.equal(committed.sceneRevision, 1);
  assert.equal(f.scene().objects.length, 1);
  assert.equal(f.counts().commits, 1);
  const restored = await host.undo(preview.previewId);
  assert.equal(restored.sceneRevision, 2);
  assert.deepEqual(restored.objects, []);
  assert.equal(f.counts().restores, 1);
});

test("unknown tools and model-supplied approval/provider fields cannot cross the strict request schema", async () => {
  for (const request of [
    { ...addRequest(), tool: "ExecuteJavaScript" },
    { ...addRequest(), approvedBy: "human" },
    { ...addRequest(), provider: "metaModelApi" },
    { ...addRequest(), arguments: { ...addRequest().arguments, script: "fetch('/private')" } },
  ]) {
    const f = fixture(),
      host = new AgentHost(f.adapter);
    await rejectsCode(host.stage([request], provenance), "SCHEMA_INVALID");
    assert.equal(f.scene().sceneRevision, 0);
    assert.equal(f.counts().commits, 0);
  }
});

test("stale or foreign-scene proposals are refused before any commit", async () => {
  for (const request of [
    { ...addRequest(), expectedSceneRevision: 1 },
    { ...addRequest(), sceneId: "scene.other" },
  ]) {
    const f = fixture(),
      host = new AgentHost(f.adapter);
    await rejectsCode(host.stage([request], provenance), [
      "REVISION_CONFLICT",
      "UNKNOWN_ID",
      "POLICY_DENIED",
    ]);
    assert.equal(f.counts().commits, 0);
  }
});

test("Apply requires the exact approved digest and rejects a preview after a concurrent scene edit", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter);
  const preview = await host.stage([addRequest()], provenance);
  await rejectsCode(host.apply(preview.previewId, "sha256:" + "0".repeat(64)), "APPROVAL_REQUIRED");
  assert.equal(f.counts().commits, 0);
  f.externalEdit();
  await rejectsCode(host.apply(preview.previewId, preview.digest), "REVISION_CONFLICT");
  assert.equal(f.counts().commits, 0);
});

test("returned preview objects do not expose mutable host-owned candidate or request storage", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter);
  const request = addRequest();
  const preview = await host.stage([request], provenance);
  preview.candidate.objects[0]!.id = "object.tampered";
  preview.requests[0]!.arguments.objectId = "object.tampered";
  request.arguments.objectId = "object.tampered-again";
  const applied = await host.apply(preview.previewId, preview.digest);
  assert.equal(applied.objects[0]?.id, "object.add-1");
});

test("expired previews and canceled previews cannot be committed", async () => {
  let now = 1_000;
  const f = fixture(),
    host = new AgentHost(f.adapter, { now: () => now, previewTtlMs: 1_000 });
  const preview = await host.stage([addRequest()], provenance);
  now = 2_001;
  await rejectsCode(host.apply(preview.previewId, preview.digest), [
    "PREVIEW_REQUIRED",
    "TIMEOUT",
    "POLICY_DENIED",
  ]);
  assert.equal(f.counts().commits, 0);
  const next = await host.stage([addRequest("request.add-2", "object.add-2")], provenance);
  host.cancel(next.previewId);
  await rejectsCode(host.apply(next.previewId, next.digest), ["PREVIEW_REQUIRED", "POLICY_DENIED"]);
  assert.equal(f.counts().commits, 0);
});

test("exact request retries return the same preview and Apply retries never double-commit", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter);
  const a = await host.stage([addRequest()], provenance);
  const b = await host.stage([addRequest()], provenance);
  assert.equal(a.previewId, b.previewId);
  await host.apply(a.previewId, a.digest);
  await host.apply(a.previewId, a.digest);
  assert.equal(f.counts().commits, 1);
  assert.equal(f.scene().objects.length, 1);
});

test("reusing a request ID with changed payload is rejected rather than silently replacing the original", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter);
  await host.stage([addRequest()], provenance);
  const changed = addRequest();
  changed.arguments.massKg = 4;
  await rejectsCode(host.stage([changed], provenance), "DOMAIN_INVALID");
  assert.equal(f.counts().commits, 0);
});

test("concurrent Apply attempts cannot commit twice", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter);
  const preview = await host.stage([addRequest()], provenance);
  await Promise.allSettled([
    host.apply(preview.previewId, preview.digest),
    host.apply(preview.previewId, preview.digest),
  ]);
  assert.equal(f.counts().commits, 1);
  assert.equal(f.scene().objects.length, 1);
});

test("Undo refuses to erase an edit made after the applied AI transaction", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter);
  const preview = await host.stage([addRequest()], provenance);
  await host.apply(preview.previewId, preview.digest);
  f.externalEdit();
  await rejectsCode(host.undo(preview.previewId), "REVISION_CONFLICT");
  assert.equal(f.counts().restores, 0);
  assert.equal(f.scene().objects.length, 1);
});

test("host tool budget is enforced and exact retries do not consume an additional call", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter, { maxToolCalls: 1 });
  const first = await host.stage([addRequest()], provenance);
  assert.equal((await host.stage([addRequest()], provenance)).previewId, first.previewId);
  await rejectsCode(
    host.stage([addRequest("request.add-2", "object.add-2")], provenance),
    "BUDGET_EXCEEDED",
  );
  assert.equal(f.counts().commits, 0);
});

test("simulation budget is separate from tool count and model tools cannot Apply a mutation", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter, { maxToolCalls: 5, maxSimulations: 1 });
  const result = await host.executeRead(simulationRequest("request.run-1"));
  assert.equal((result as { state: string }).state, "succeeded");
  await rejectsCode(host.executeRead(simulationRequest("request.run-2")), "BUDGET_EXCEEDED");
  await rejectsCode(host.executeRead(addRequest()), [
    "POLICY_DENIED",
    "DOMAIN_INVALID",
    "PREVIEW_REQUIRED",
  ]);
  assert.equal(f.counts().reads, 1);
  assert.equal(f.counts().commits, 0);
});

test("bounded audit records retain actual provenance and cannot be edited through returned arrays", async () => {
  const f = fixture(),
    host = new AgentHost(f.adapter, { maxAuditEntries: 2 });
  const preview = await host.stage([addRequest()], provenance);
  await host.apply(preview.previewId, preview.digest);
  await host.undo(preview.previewId);
  const audit = host.getAudit();
  assert.ok(audit.length <= 2);
  assert.equal(audit.at(-1)?.action, "undo");
  assert.equal(audit.at(-1)?.provenance?.label, "OFFLINE_DETERMINISTIC");
  audit.length = 0;
  assert.ok(host.getAudit().length > 0);
});

function metric(overrides: Partial<MetricEvidence> = {}): MetricEvidence {
  return {
    metricRecordId: "metric.direct-arrival",
    evidenceArtifactId: "artifact.solver-1",
    runId: "run.solver-1",
    metricId: "directArrivalTimeS",
    value: 0,
    unit: "s",
    availability: "available",
    provenance: "Computed",
    methodId: "method.direct-distance-over-c",
    limitations: ["Analytical fixture only"],
    ...overrides,
  };
}

test("grounded explanation preserves a real zero and includes record/artifact references", () => {
  const explanation = JSON.stringify(explainMetrics([metric()]));
  assert.ok(explanation.includes("metric.direct-arrival"));
  assert.ok(explanation.includes("artifact.solver-1"));
  assert.ok(explanation.includes("Computed"));
  assert.ok(explanation.includes("0"));
});

test("numerical explanation rejects missing artifacts, non-finite values and unavailable non-null values", () => {
  for (const record of [
    metric({ evidenceArtifactId: "" }),
    metric({ value: Number.NaN }),
    metric({ availability: "unavailable", value: 0 }),
  ])
    assert.throws(() => explainMetrics([record]));
});

test("Cancel cannot misreport a transaction as canceled while its commit is in flight", async () => {
  const f = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const commit = f.adapter.commit;
  f.adapter.commit = async (...args) => {
    await gate;
    return commit(...args);
  };
  const host = new AgentHost(f.adapter);
  const preview = await host.stage([addRequest()], provenance);
  const applying = host.apply(preview.previewId, preview.digest);
  try {
    assert.throws(
      () => host.cancel(preview.previewId),
      (error: unknown) => {
        assert.ok(error && typeof error === "object" && "code" in error);
        assert.equal(error.code, "TRANSACTION_BUSY");
        return true;
      },
    );
  } finally {
    release();
  }
  await applying;
  assert.equal(f.counts().commits, 1);
  assert.deepEqual(
    host.getAudit().map((item) => item.action),
    ["stage", "apply"],
  );
});

test("a dispatched simulation with an unknown timeout result is not blindly dispatched again on retry", async () => {
  const f = fixture();
  let dispatches = 0;
  f.adapter.runTool = async () => {
    dispatches++;
    throw Object.assign(new Error("worker acknowledgment missing after dispatch"), {
      code: "TIMEOUT",
    });
  };
  const host = new AgentHost(f.adapter, { maxToolCalls: 5, maxSimulations: 3 });
  const request = simulationRequest("request.uncertain-run");
  await assert.rejects(host.executeRead(request));
  await assert.rejects(host.executeRead(request));
  assert.equal(dispatches, 1, "the request ledger must retain failed/unknown dispatches");
});
