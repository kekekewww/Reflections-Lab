import test from "node:test";
import assert from "node:assert/strict";
import { createAgentServer } from "../../server/app.js";
import { DEFAULT_META_CONFIG, MetaProvider } from "../../server/meta-provider.js";
import { OfflineSoundPlanner } from "../../src/ai/offline-sound-planner.js";
import type { SoundHostState } from "../../src/ai/sound-host.js";
import type { Server } from "node:http";

// All model transport is injected; native fetch below talks only to an ephemeral loopback server.
const state = (): SoundHostState => ({
  sceneId: "scene.sound-api",
  sceneRevision: 0,
  document: {
    schemaVersion: "1.0.0",
    documentId: "behavior.sound-api",
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
});
async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
const input = () => ({
  mode: "meta",
  prompt: "碰撞電子音效",
  state: state(),
  options: { selectedObjectId: "object.ball" },
});
const post = (url: string, value: unknown, origin = "http://localhost:5173") =>
  fetch(`${url}/api/agent/propose-sound`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(value),
  });

test("Sound route with the default zero-budget gate returns blocked and performs zero model fetches", async () => {
  let modelFetches = 0;
  const provider = new MetaProvider(DEFAULT_META_CONFIG, {
    fetch: async () => {
      modelFetches++;
      throw new Error("No model call is authorized");
    },
  });
  const server = createAgentServer({ provider });
  const base = await listen(server);
  try {
    const response = await post(base, input());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "PROVIDER_UNVERIFIED");
    assert.equal(modelFetches, 0);
  } finally {
    await close(server);
  }
});

test("Sound route rejects extra authority, invalid documents, and cross-origin requests before model transport", async () => {
  let modelFetches = 0;
  const provider = new MetaProvider(DEFAULT_META_CONFIG, {
    fetch: async () => {
      modelFetches++;
      throw new Error("Not authorized");
    },
  });
  const server = createAgentServer({ provider });
  const base = await listen(server);
  try {
    for (const value of [
      { ...input(), budget: 1 },
      { ...input(), options: { selectedObjectId: "object.ball", apiKey: "injected" } },
      { ...input(), state: { ...state(), document: { ...state().document, approval: true } } },
    ]) {
      const response = await post(base, value);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "SCHEMA_INVALID");
    }
    const response = await post(base, input(), "https://untrusted.invalid");
    assert.equal(response.status, 403);
    assert.equal(modelFetches, 0);
  } finally {
    await close(server);
  }
});

test("Sound endpoint uses an actual function-call fixture and returns host-fixed proposal metadata", async () => {
  const initial = state();
  const fixturePlan = new OfflineSoundPlanner().plan("碰撞電子音效", initial, {
    selectedObjectId: "object.ball",
  });
  const operations = fixturePlan.proposal.operations.map((operation) => {
    if (operation.type === "CreateProfile" || operation.type === "ReplaceProfile")
      return {
        ...operation,
        profile: {
          ...operation.profile,
          rules: operation.profile.rules.map((rule) => ({
            ...rule,
            lifecycle: rule.lifecycle ?? null,
            oneShotDurationSeconds: rule.oneShotDurationSeconds ?? null,
          })),
        },
      };
    return operation;
  });
  let modelFetches = 0;
  const provider = new MetaProvider(
    {
      ...DEFAULT_META_CONFIG,
      apiKey: "fixture-not-a-real-key",
      networkEnabled: true,
      modelId: "model.fixture",
      verificationStatus: "verified",
      verifiedAt: "2026-10-27T00:00:00.000Z",
      verificationArtifactId: "artifact.fixture",
      maxEstimatedCostUsd: 1,
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 1,
      pricingSource: "MOCK_ONLY",
    },
    {
      fetch: async (_url, init) => {
        modelFetches++;
        const body = JSON.parse(String(init?.body));
        assert.equal(body.tools.length, 1);
        assert.equal(body.tools[0].function.name, "ProposeSoundBehavior");
        assert.equal(body.parallel_tool_calls, false);
        assert.equal(body.tool_choice, "auto");
        assert.ok(Buffer.byteLength(String(init?.body)) <= 32000);
        return new Response(
          JSON.stringify({
            id: "response.sound-tool-fixture",
            model: "model.fixture",
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call.sound-fixture",
                      type: "function",
                      function: {
                        name: "ProposeSoundBehavior",
                        arguments: JSON.stringify({ operations }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      },
    },
  );
  const server = createAgentServer({ provider });
  const base = await listen(server);
  try {
    const response = await post(base, input());
    const plan = await response.json();
    assert.equal(response.status, 200, JSON.stringify(plan));
    assert.equal(modelFetches, 1);
    assert.equal(plan.proposal.sceneId, initial.sceneId);
    assert.equal(plan.proposal.expectedSceneRevision, initial.sceneRevision);
    assert.equal(plan.proposal.expectedBehaviorRevision, initial.document.revision);
    assert.equal(plan.proposal.operations.length, 2);
    assert.equal(plan.provenance.requestId, "response.sound-tool-fixture");
    assert.equal(initial.document.revision, 0, "API planning must not commit");
    assert.equal(JSON.stringify(plan).includes("fixture-not-a-real-key"), false);
  } finally {
    await close(server);
  }
});
