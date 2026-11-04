import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { once } from "node:events";
import { DEFAULT_META_CONFIG, MetaProvider } from "../../server/meta-provider.js";
import type { MetaProviderConfig } from "../../server/meta-provider.js";
import { openMetaBudgetLedger } from "../../server/meta-budget-ledger.js";
import { createAgentServer } from "../../server/app.js";
import { AgentSession } from "../../src/app/agent-session.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  makeBehaviorContext,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import type { PlannerContext } from "../../src/ai/types.js";

// Every Meta transport is injected. HTTP tests contact only a local ephemeral server.
const config: MetaProviderConfig = {
  ...DEFAULT_META_CONFIG,
  apiKey: "fixture-not-a-real-key",
  networkEnabled: true,
  modelId: "model.fixture",
  verificationStatus: "verified",
  verifiedAt: "2026-11-02T00:00:00.000Z",
  verificationArtifactId: "authorization.fixture",
  maxEstimatedCostUsd: 1,
  inputUsdPerMillionTokens: 1,
  outputUsdPerMillionTokens: 2,
  pricingSource: "FIXTURE_PRICING",
  maxRetries: 0,
  timeoutMs: 1000,
  maxCompletionTokens: 128,
};
const policy = {
  authorizationId: "authorization.fixture",
  modelId: config.modelId!,
  dataMode: "standard" as const,
  budgetUsd: 1,
  inputUsdPerMillionTokens: 1,
  outputUsdPerMillionTokens: 2,
  pricingSource: "FIXTURE_PRICING",
  maxRequests: 12,
  maxAttemptsPerRequest: 1,
};
function context(): PlannerContext {
  return {
    scene: createDefaultScene(),
    materials: DEFAULT_MATERIALS.map(({ id, label }) => ({ id, label })),
    signals: [],
    materialRegistryRevision: 1,
  };
}
function responseBody() {
  return {
    id: "response.fixture-persist",
    model: "model.fixture",
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call.fixture",
              type: "function",
              function: {
                name: "AddObject",
                arguments: JSON.stringify({
                  objectId: "object.meta-core",
                  label: "Fixture",
                  shape: "sphere",
                  dimensionsM: [0.5, 0.5, 0.5],
                  positionM: [0, 2, 0],
                  orientationQuaternion: [0, 0, 0, 1],
                  materialId: DEFAULT_MATERIALS[0]!.id,
                  mode: "dynamicGravity",
                  massKg: 1,
                }),
              },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
  };
}
const providerResponse = () => new Response(JSON.stringify(responseBody()), { status: 200 });
const fixtureRoot = resolve(".cache/meta-provider-tests");
async function directoryFixture(prefix: string): Promise<string> {
  await mkdir(fixtureRoot, { recursive: true });
  return mkdtemp(join(fixtureRoot, prefix));
}
async function cleanup(directory: string): Promise<void> {
  assert.equal(dirname(resolve(directory)), fixtureRoot);
  await rm(directory, { recursive: true, force: true });
}

test("persistent provider request reuses one response and one reserve after restart", async () => {
  const directory = await directoryFixture("pipeline-");
  let count = 0;
  try {
    const ledger = await openMetaBudgetLedger(join(directory, "ledger.json"), policy);
    const provider = new MetaProvider(config, {
      budget: ledger,
      fetch: async () => {
        count++;
        return providerResponse();
      },
    });
    const first = await provider.plan("新增球", context(), { requestId: "request.persist" });
    const duplicate = await provider.plan("新增球", context(), { requestId: "request.persist" });
    assert.deepEqual(duplicate, first);
    assert.equal(count, 1);
    await assert.rejects(provider.plan("新增兩顆球", context(), { requestId: "request.persist" }), {
      code: "DOMAIN_INVALID",
    });
    await ledger.close();
    const reopened = await openMetaBudgetLedger(join(directory, "ledger.json"), policy);
    const restarted = new MetaProvider(config, {
      budget: reopened,
      fetch: async () => {
        throw new Error("A completed identity must not dispatch again");
      },
    });
    assert.deepEqual(
      await restarted.plan("新增球", context(), { requestId: "request.persist" }),
      first,
    );
    await reopened.close();
    assert.equal(count, 1);
  } finally {
    await cleanup(directory);
  }
});

test("cancelled paid transport retains uncertain reservation and blocks a restart dispatch", async () => {
  const directory = await directoryFixture("cancel-");
  try {
    const ledger = await openMetaBudgetLedger(join(directory, "ledger.json"), policy);
    const abort = new AbortController();
    let started!: () => void;
    const dispatched = new Promise<void>((resolve) => {
      started = resolve;
    });
    const provider = new MetaProvider(config, {
      budget: ledger,
      fetch: async (_url, init) => {
        started();
        return new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(new Error("transport aborted")), {
            once: true,
          });
        });
      },
    });
    const pending = provider.plan("新增球", context(), {
      requestId: "request.canceled",
      signal: abort.signal,
    });
    await dispatched;
    abort.abort();
    await assert.rejects(pending, { code: "CANCELED" });
    await ledger.close();
    const reopened = await openMetaBudgetLedger(join(directory, "ledger.json"), policy);
    let fetches = 0;
    const restarted = new MetaProvider(config, {
      budget: reopened,
      fetch: async () => {
        fetches++;
        return providerResponse();
      },
    });
    await assert.rejects(restarted.plan("新增球", context(), { requestId: "request.new" }));
    assert.equal(fetches, 0);
    await reopened.close();
  } finally {
    await cleanup(directory);
  }
});

test("HTTP duplicate identity shares an active proposal; conflicting identity cannot dispatch", async () => {
  let finish!: () => void;
  const wait = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let count = 0;
  const provider = new MetaProvider(config, {
    fetch: async () => {
      count++;
      await wait;
      return providerResponse();
    },
  });
  const server = createAgentServer({ provider });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/agent/propose`;
  const send = (prompt: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Reflection-Request-ID": "request.http-dedup",
      },
      body: JSON.stringify({ mode: "meta", prompt, context: context() }),
    });
  try {
    const first = send("新增球");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const duplicate = send("新增球");
    const conflict = await send("新增兩顆球");
    assert.equal(conflict.status, 400);
    assert.equal((await conflict.json()).error.code, "DOMAIN_INVALID");
    finish();
    const [a, b] = await Promise.all([first, duplicate]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(await a.json(), await b.json());
    assert.equal(count, 1);
  } finally {
    finish();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("session cancellation prevents a late live proposal from staging or applying", async (t) => {
  const scene = createDefaultScene();
  const document = createDefaultBehaviors(scene);
  let release!: (response: Response) => void;
  const original = new Promise<Response>((resolve) => {
    release = resolve;
  });
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/cancel"))
      return new Response(JSON.stringify({ state: "cancelRequested" }), { status: 200 });
    return original;
  });
  let commits = 0;
  const session = new AgentSession({
    getScene: () => scene,
    getBehaviorState: () => ({
      sceneId: scene.sceneId,
      sceneRevision: scene.sceneRevision,
      document,
      context: makeBehaviorContext(scene, []),
    }),
    getRegistries: () => ({
      materials: DEFAULT_MATERIALS.map(({ id, label }) => ({ id, label })),
      signals: [],
      materialRegistryRevision: 1,
    }),
    commitScene(next) {
      commits++;
      return next;
    },
    commitBehavior(next) {
      commits++;
      return next;
    },
  });
  const waiting = session.submitLive("新增球");
  session.cancel();
  const plan = await new MetaProvider(config, { fetch: async () => providerResponse() }).plan(
    "新增球",
    context(),
  );
  release(new Response(JSON.stringify(plan), { status: 200 }));
  await waiting;
  assert.equal(session.getView().status, "idle");
  assert.equal(session.getView().canApply, false);
  await session.apply();
  assert.equal(commits, 0);
  assert.deepEqual(session.getAudit().scene, []);
});
