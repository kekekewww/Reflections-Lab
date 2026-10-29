import test from "node:test";
import assert from "node:assert/strict";
import { AgentSession } from "../../src/app/agent-session.js";
import { AgentHost } from "../../src/ai/host.js";
import { AgentError } from "../../src/ai/types.js";
import type { ToolRequest } from "../../src/ai/types.js";
import type { SoundHostState } from "../../src/ai/sound-host.js";
import { createScene } from "../../src/scene/index.js";
import { PhysicsWorld } from "../../src/physics/physics-world.js";

function fixture(runTool?: (request: ToolRequest) => Promise<unknown>, now?: () => number) {
  let scene = createScene({
    schemaVersion: "1.0.0",
    sceneId: "scene.ai-session",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 7,
    gravityMps2: [0, -9.81, 0],
    objects: [],
    sources: [],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
  let commits = 0;
  const state: SoundHostState = {
    sceneId: scene.sceneId,
    sceneRevision: 0,
    document: {
      schemaVersion: "1.0.0",
      documentId: "behavior.session",
      revision: 0,
      assets: [],
      profiles: [],
      bindings: [],
    },
    context: {
      sceneRevision: 0,
      objects: [],
      materialIds: ["material.metal"],
      zoneIds: [],
      assetRegistry: [],
    },
  };
  const session = new AgentSession({
    getScene: () => structuredClone(scene),
    getBehaviorState: () => structuredClone(state),
    getRegistries: () => ({
      materials: [{ id: "material.metal", label: "合成金屬" }],
      signals: [],
      materialRegistryRevision: 1,
    }),
    commitScene(next, expectedRevision) {
      assert.equal(scene.sceneRevision, expectedRevision);
      scene = createScene(next);
      commits++;
      return structuredClone(scene);
    },
    commitBehavior() {
      throw new Error("This fixture does not commit sound proposals");
    },
    ...(runTool ? { runTool } : {}),
    ...(now ? { now } : {}),
  });
  return { session, getScene: () => scene, getCommits: () => commits };
}

test("session preserves an unsupported host response and never claims experiment completion", async () => {
  const result = { status: "CAPABILITY_UNSUPPORTED", reason: "no executor" };
  const f = fixture(async () => result);
  await f.session.submit("執行模擬");
  const view = f.session.getView();
  assert.equal(view.status, "error");
  assert.equal(view.mode, "offline");
  assert.equal(view.canApply, false);
  assert.match(view.message, /CAPABILITY_UNSUPPORTED/);
  assert.match(view.message, /no executor/);
  assert.equal(f.getCommits(), 0);
  const records = f.session.getToolResults();
  assert.equal(records[0]?.status, "blocked");
  assert.deepEqual(records[0]?.result, result);
  assert.equal(records[0]?.provenance.label, "OFFLINE_DETERMINISTIC");
});

test("session displays exact completed evidence and preserves null unavailable metrics", async () => {
  const result = {
    status: "completed",
    evidence: { runId: "run.session", artifactSha256: "a".repeat(64) },
    metrics: [{ metricId: "rt60S", value: null, availability: "unsupported" }],
    limitations: ["No decay artifact"],
  };
  const f = fixture(async () => result);
  await f.session.submit("執行模擬");
  const view = f.session.getView();
  assert.equal(view.status, "idle");
  assert.equal(view.canApply, false);
  assert.equal(view.toolResults?.[0]?.status, "completed");
  assert.match(view.message, /run.session/);
  assert.match(view.message, /No decay artifact/);
  assert.match(view.message, /"value":null/);
  assert.deepEqual(view.toolResults?.[0]?.result, result);
  (view.toolResults![0]!.result as typeof result).metrics[0]!.value = 999 as never;
  result.evidence.runId = "changed.after.return";
  const stored = f.session.getToolResults()[0]!.result as typeof result;
  assert.equal(stored.evidence.runId, "run.session");
  assert.equal(stored.metrics[0]?.value, null);
});

test("queued host results remain pending and cannot be described as completed", async () => {
  const f = fixture(async () => ({ state: "queued", runId: "run.queued", metrics: [] }));
  await f.session.submit("執行模擬");
  assert.equal(f.session.getToolResults()[0]?.status, "pending");
  assert.match(f.session.getView().message, /queued/);
  assert.match(f.session.getView().message, /尚未完成/);
  assert.equal(f.session.getView().canApply, false);
});

test("unknown and empty tool results produce explicit unknown outcomes", async () => {
  for (const result of [{ status: "mystery" }, { runId: "run.unconfirmed" }, null]) {
    const f = fixture(async () => result);
    await f.session.submit("執行模擬");
    assert.equal(f.session.getView().status, "error");
    assert.equal(f.session.getToolResults()[0]?.status, "unknown");
    assert.match(f.session.getView().message, /RESULT_UNKNOWN/);
  }
});

test("a success status cannot override a failed or pending host state", async () => {
  for (const [state, expected] of [
    ["failed", "failed"],
    ["running", "pending"],
  ] as const) {
    const f = fixture(async () => ({
      status: "completed",
      state,
      reason: "host state takes precedence",
    }));
    await f.session.submit("執行模擬");
    assert.equal(f.session.getToolResults()[0]?.status, expected);
    assert.match(f.session.getView().message, /host state takes precedence/);
    assert.doesNotMatch(f.session.getView().message, /已完成（Host回傳）/);
  }
});

test("rejected and missing executors expose host errors without inventing results", async () => {
  for (const runTool of [
    undefined,
    async () => {
      throw new AgentError("SOLVER_FAILED", "solver stopped before producing artifacts");
    },
  ]) {
    const f = fixture(runTool);
    await f.session.submit("執行模擬");
    assert.equal(f.session.getView().status, "error");
    assert.match(f.session.getView().message, /CAPABILITY_UNSUPPORTED|SOLVER_FAILED/);
    assert.equal(f.session.getToolResults()[0]?.status, "failed");
    assert.equal(f.session.getToolResults()[0]?.result, null);
    assert.equal(f.getCommits(), 0);
  }
});

test("read budget stops the seventh simulation before executing it", async () => {
  let calls = 0;
  const f = fixture(async () => ({ status: "completed", runId: `run.${++calls}` }));
  for (let index = 0; index < 7; index++) await f.session.submit("執行模擬");
  assert.equal(calls, 6);
  assert.equal(f.session.getView().status, "error");
  assert.match(f.session.getView().message, /BUDGET_EXCEEDED/);
  assert.equal(f.session.getToolResults().length, 7);
});

test("offline simulation preserves its parameters and advances the canonical 60Hz physics clock for three seconds", async () => {
  let world!: PhysicsWorld;
  let forwarded: ToolRequest | null = null;
  const f = fixture(async (request) => {
    forwarded = structuredClone(request);
    assert.equal(request.tool, "RunSimulation");
    assert.equal(request.arguments.timeStepS, world.fixedDtSeconds);
    const steps = Number(request.arguments.durationS) / world.fixedDtSeconds;
    assert.equal(Number.isInteger(steps), true);
    world.resume();
    for (let step = 0; step < steps; step++) world.step();
    world.pause();
    return {
      status: "completed",
      evidence: { runId: "run.fixed60-fixture", ticks: world.tick, fixedDtS: world.fixedDtSeconds },
    };
  });
  world = await PhysicsWorld.create(f.getScene());
  try {
    assert.equal(world.fixedDtSeconds, 1 / 60);
    await f.session.submit("執行模擬");
    assert.equal(f.session.getView().status, "idle", f.session.getView().message);
    assert.deepEqual(forwarded?.arguments, {
      backendId: "custom-web",
      durationS: 3,
      timeStepS: 1 / 60,
      seed: 7,
      replayTraceId: null,
      maxReflectionOrder: 1,
      sampleRateHz: 48000,
    });
    assert.equal(world.tick, 180);
    assert.equal(f.getCommits(), 0);
  } finally {
    world.dispose();
  }
});

test("PreviewSceneChanges reaches the read adapter and does not authorize a commit", async () => {
  const f = fixture();
  let calls = 0;
  const host = new AgentHost({
    getScene: f.getScene,
    preview: () => {
      throw new Error("A read preview must not stage a mutation");
    },
    commit: () => {
      throw new Error("A read preview must not commit");
    },
    restore: () => {
      throw new Error("A read preview must not restore");
    },
    runTool: async () => {
      calls++;
      return { status: "completed", limitations: ["Collision check only"] };
    },
  });
  const result = await host.executeRead({
    schemaVersion: "1.0.0",
    requestId: "request.preview",
    sceneId: f.getScene().sceneId,
    expectedSceneRevision: 0,
    transactionId: "transaction.preview",
    tool: "PreviewSceneChanges",
    arguments: { includeCollisionCheck: true, includeAcousticCostEstimate: true },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { status: "completed", limitations: ["Collision check only"] });
  assert.equal(f.getCommits(), 0);
});

test("a session cannot submit a thirteenth planning turn or continue after its wall deadline", async () => {
  const turns = fixture();
  for (let index = 0; index < 12; index++) await turns.session.submit("不修改場景");
  assert.equal(turns.session.getView().status, "idle");
  await turns.session.submit("新增球");
  assert.equal(turns.session.getView().status, "error");
  assert.match(turns.session.getView().message, /BUDGET_EXCEEDED/);
  assert.equal(turns.getCommits(), 0);

  let now = 500000;
  const timed = fixture(undefined, () => now);
  now += 999999; // Idle time before the first turn does not consume a session.
  await timed.session.submit("不修改場景");
  assert.equal(timed.session.getView().status, "idle");
  now += 120000;
  await timed.session.submit("新增球");
  assert.equal(timed.session.getView().status, "error");
  assert.match(timed.session.getView().message, /BUDGET_EXCEEDED/);
  assert.equal(timed.getCommits(), 0);
});

test("live session rejects incomplete and contradictory provider provenance before invoking a host tool", async (t) => {
  for (const provenance of [
    { provider: "metaModelApi", label: "META_LIVE", modelId: "model.test", requestId: null },
    {
      provider: "metaModelApi",
      label: "OFFLINE_DETERMINISTIC",
      modelId: "model.test",
      requestId: "response.test",
    },
    {
      provider: "offlineDeterministic",
      label: "OFFLINE_DETERMINISTIC",
      modelId: null,
      requestId: null,
    },
  ]) {
    const f = fixture(async () => {
      throw new Error("An unverified plan must not invoke the host");
    });
    const mock = t.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            planId: "plan.fixture",
            requests: [],
            summary: "This provider claim is not a real live result",
            assumptions: [],
            warnings: [],
            provenance,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    await f.session.submitLive("執行模擬");
    assert.equal(f.session.getView().status, "error");
    assert.equal(f.session.getView().mode, "unavailable");
    assert.match(f.session.getView().message, /PROVIDER_UNVERIFIED/);
    assert.equal(f.getCommits(), 0);
    mock.mock.restore();
  }
});
