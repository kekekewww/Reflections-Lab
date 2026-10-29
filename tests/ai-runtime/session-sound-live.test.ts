import test from "node:test";
import assert from "node:assert/strict";
import { AgentSession } from "../../src/app/agent-session.js";
import { OfflineSoundPlanner } from "../../src/ai/offline-sound-planner.js";
import { getProviderStatus } from "../../src/ai/client.js";
import { createScene } from "../../src/scene/index.js";
import type { SoundHostState } from "../../src/ai/sound-host.js";

// HTTP responses are local protocol fixtures. These tests never invoke Meta.
function fixture() {
  const scene = createScene({
    schemaVersion: "1.0.0",
    sceneId: "scene.sound-live-session",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 7,
    gravityMps2: [0, -9.81, 0],
    sources: [],
    objects: [
      {
        id: "object.ball",
        shape: "sphere",
        dimensionsM: [0.5, 0.5, 0.5],
        positionM: [0, 2, 0],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "dynamicGravity",
        massKg: 1,
        friction: 0.5,
        restitution: 0.3,
        physicsMaterialId: "material.metal",
        acousticMaterialId: "material.metal",
        acousticRole: "dynamicOccluder",
      },
    ],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 4],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
  const state: SoundHostState = {
    sceneId: scene.sceneId,
    sceneRevision: 0,
    document: {
      schemaVersion: "1.0.0",
      documentId: "behavior.live-session",
      revision: 0,
      assets: [],
      profiles: [],
      bindings: [],
    },
    context: {
      sceneRevision: 0,
      objects: [{ objectId: "object.ball", generation: 1 }],
      materialIds: ["material.metal"],
      zoneIds: [],
      assetRegistry: [],
    },
  };
  let commits = 0;
  const session = new AgentSession({
    getScene: () => structuredClone(scene),
    getBehaviorState: () => structuredClone(state),
    getRegistries: () => ({
      materials: [{ id: "material.metal", label: "合成金屬" }],
      signals: [],
      materialRegistryRevision: 1,
      selectedObjectId: "object.ball",
    }),
    commitScene() {
      throw new Error("A sound proposal must not commit a Scene mutation");
    },
    commitBehavior(document, expectedDocumentRevision, expectedSceneRevision) {
      assert.equal(state.document.revision, expectedDocumentRevision);
      assert.equal(state.sceneRevision, expectedSceneRevision);
      state.document = structuredClone(document);
      commits++;
      return structuredClone(document);
    },
  });
  const plan = new OfflineSoundPlanner().plan("碰撞電子音效", state, {
    selectedObjectId: "object.ball",
  });
  plan.provenance = {
    provider: "metaModelApi",
    modelId: "model.protocol-fixture",
    requestId: "response.protocol-fixture",
    label: "META_LIVE",
  };
  return { session, state, plan, commits: () => commits };
}

test("live Sound intent uses the sound endpoint, stages locally, and requires Apply before committing", async (t) => {
  const f = fixture();
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests++;
    assert.equal(input, "/api/agent/propose-sound");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.mode, "meta");
    assert.equal(body.state.document.revision, 0);
    assert.equal(body.options.selectedObjectId, "object.ball");
    assert.equal("apiKey" in body, false);
    return new Response(JSON.stringify(f.plan), { status: 200 });
  });
  await f.session.submitLive("球的碰撞電子音效");
  assert.equal(requests, 1);
  assert.equal(f.session.getView().mode, "live");
  assert.equal(f.session.getView().status, "preview");
  assert.equal(f.session.getView().canApply, true);
  assert.equal(f.commits(), 0);
  await f.session.apply();
  assert.equal(f.commits(), 1);
  assert.equal(f.state.document.revision, 1);
  assert.equal(f.state.document.profiles.length, 1);
  assert.equal(f.state.document.bindings.length, 1);
  assert.equal(f.session.getAudit().sound[0]?.provenance.requestId, "response.protocol-fixture");
  await f.session.undo();
  assert.equal(f.state.document.revision, 2);
  assert.equal(f.state.document.profiles.length, 0);
});

test("explicit live Sound entry rejects stale revisions, forged assets, and incomplete provenance", async (t) => {
  for (const problem of ["revision", "asset", "provenance"] as const) {
    const f = fixture();
    if (problem === "revision") f.plan.proposal.expectedBehaviorRevision = 9;
    if (problem === "provenance") f.plan.provenance.requestId = null;
    if (problem === "asset") {
      const operation = f.plan.proposal.operations.find((item) => item.type === "CreateProfile");
      assert.ok(operation?.type === "CreateProfile");
      operation.profile.rules[0]!.generator = {
        kind: "sample",
        asset: { assetId: "asset.forged", revision: 1, sha256: "a".repeat(64) },
        loop: false,
        startOffsetSeconds: 0,
      };
    }
    const mock = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify(f.plan), { status: 200 }),
    );
    await f.session.submitLiveSound("改成更柔和");
    assert.equal(f.session.getView().status, "error");
    assert.equal(f.session.getView().canApply, false);
    assert.match(
      f.session.getView().message,
      /REVISION_CONFLICT|UNKNOWN_ASSET|PROVIDER_UNVERIFIED/,
    );
    assert.equal(f.commits(), 0);
    mock.mock.restore();
  }
});

test("a blocked Sound provider remains unavailable and never falls back to an offline proposal", async (t) => {
  const f = fixture();
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          error: { code: "PROVIDER_UNVERIFIED", message: "ZERO_OR_INVALID_BUDGET" },
        }),
        { status: 503 },
      ),
  );
  await f.session.submitLiveSound("碰撞音效");
  assert.equal(f.session.getView().mode, "unavailable");
  assert.equal(f.session.getView().status, "error");
  assert.equal(f.session.getView().canApply, false);
  assert.match(f.session.getView().message, /ZERO_OR_INVALID_BUDGET/);
  assert.equal(f.commits(), 0);
});

test("a Sound response cannot stage after the local document or object generation changes during transport", async (t) => {
  for (const change of ["document", "generation"] as const) {
    const f = fixture();
    const mock = t.mock.method(globalThis, "fetch", async () => {
      if (change === "document") f.state.document.revision++;
      else f.state.context.objects[0]!.generation++;
      return new Response(JSON.stringify(f.plan), { status: 200 });
    });
    await f.session.submitLiveSound("碰撞音效");
    assert.equal(f.session.getView().status, "error");
    assert.equal(f.session.getView().canApply, false);
    assert.match(f.session.getView().message, /REVISION_CONFLICT|STALE_OBJECT_GENERATION/);
    assert.equal(f.commits(), 0);
    mock.mock.restore();
  }
});

test("provider status helper uses the same-origin endpoint and retains the explicit blocked gate", async (t) => {
  const value = {
    offline: {
      state: "AVAILABLE",
      provenance: "OFFLINE_DETERMINISTIC",
      modelId: null,
      cloudCostUsd: 0,
    },
    meta: {
      provider: "metaModelApi",
      state: "BLOCKED",
      reason: "NETWORK_DISABLED",
      modelId: null,
      remainingQuota: null,
      liveValidation: "NOT_RUN",
      estimatedCostCeilingUsd: 0,
    },
  };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.equal(input, "/api/agent/status");
    return new Response(JSON.stringify(value), { status: 200 });
  });
  assert.deepEqual(await getProviderStatus(), value);
});

test("client rejects malformed status and classifies empty API errors without claiming a live result", async (t) => {
  let mock = t.mock.method(globalThis, "fetch", async () => new Response("null", { status: 200 }));
  await assert.rejects(getProviderStatus(), { code: "SCHEMA_INVALID" });
  mock.mock.restore();
  mock = t.mock.method(globalThis, "fetch", async () => new Response("null", { status: 503 }));
  const f = fixture();
  await f.session.submitLiveSound("碰撞音效");
  assert.equal(f.session.getView().mode, "unavailable");
  assert.equal(f.session.getView().status, "error");
  assert.match(f.session.getView().message, /PROVIDER_REQUEST_FAILED/);
  assert.equal(f.commits(), 0);
});
