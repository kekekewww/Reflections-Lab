import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash as nodeHash } from "node:crypto";
import { META_CHAT_ENDPOINT } from "../../server/meta-provider.js";
import { BROWSER_AGENT_CONFIG, createBrowserAgent } from "../../src/ai/browser-agent.js";
import { createHash, randomUUID } from "../../src/ai/browser-crypto.js";
import {
  forgetBrowserKey,
  getBrowserKey,
  hasBrowserKey,
  setBrowserKey,
  subscribeBrowserKey,
} from "../../src/ai/browser-key.js";
import type { SoundHostState } from "../../src/ai/sound-host.js";
import type { PlannerContext } from "../../src/ai/types.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";

// Every transport below is injected. No Meta request is sent, and the key is a fixture.
const KEY = "fixture-not-a-real-browser-key";
const IDENTITY = [0, 0, 0, 1];
const context: PlannerContext = {
  scene: createDefaultScene(),
  materials: DEFAULT_MATERIALS.map(({ id, label }) => ({ id, label })),
  signals: [{ id: "signal.tone-220", label: "220 Hz sine", frequencyHz: 220 }],
  materialRegistryRevision: 1,
};
type Call = [string, Record<string, unknown>];
let replies = 0;
function reply(calls: Call[], text: string | null = "Adding it.") {
  replies++;
  return new Response(
    JSON.stringify({
      id: `response.browser-${replies}`,
      model: "muse-spark-1.3",
      choices: [
        {
          finish_reason: calls.length ? "tool_calls" : "stop",
          message: {
            role: "assistant",
            content: text,
            ...(calls.length
              ? {
                  tool_calls: calls.map(([name, args], index) => ({
                    id: `call.${replies}-${index}`,
                    type: "function",
                    function: { name, arguments: JSON.stringify(args) },
                  })),
                }
              : {}),
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
function box(id: string, materialId = "material.wood"): Call {
  return [
    "AddObject",
    {
      objectId: id,
      label: id,
      shape: "box",
      dimensionsM: [0.5, 0.5, 0.5],
      positionM: [2, 0.25, 2],
      orientationQuaternion: IDENTITY,
      materialId,
      mode: "fixed",
      massKg: 5,
    },
  ];
}
interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  credentials: string | undefined;
  referrerPolicy: string | undefined;
}
function recording(respond: (index: number) => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    sent.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      credentials: init?.credentials,
      referrerPolicy: init?.referrerPolicy,
    });
    return respond(sent.length - 1);
  };
  return { sent, fetcher };
}
function agentWith(fetcher: typeof fetch, config = {}, key: string | null = KEY) {
  return createBrowserAgent({ getKey: () => key, fetch: fetcher, config });
}
const hanging: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError")),
    );
  });
async function rejects(action: Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => {
    assert.equal((error as { code?: unknown }).code, code);
    assert.ok(!String((error as Error).message).includes(KEY), "an error must not repeat the key");
    return true;
  });
}

beforeEach(() => forgetBrowserKey());

test("the browser hash matches Node's SHA-256 on ASCII, Unicode and long input", () => {
  for (const value of ["", "abc", "聲音 Reflection Lab 🎧", "x".repeat(100_000), "é".repeat(4097)])
    assert.equal(
      createHash("sha256").update(value).digest("hex"),
      nodeHash("sha256").update(value).digest("hex"),
    );
  assert.equal(
    createHash("sha256").update("ab").update("c").digest("hex"),
    nodeHash("sha256").update("abc").digest("hex"),
  );
  assert.throws(() => createHash("md5"), /sha256/);
});

test("the browser UUID has the standard shape", () => {
  assert.match(
    randomUUID(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("the key store trims, refuses malformed input and forgets", () => {
  let changes = 0;
  const stop = subscribeBrowserKey(() => changes++);
  assert.equal(hasBrowserKey(), false);
  setBrowserKey(`  ${KEY}\n`);
  assert.equal(getBrowserKey(), KEY);
  assert.equal(hasBrowserKey(), true);
  for (const bad of ["", "   ", "two words", `Bearer ${KEY}`, "x".repeat(1025), "line\nbreak"])
    assert.throws(() => setBrowserKey(bad), /key/i);
  assert.equal(getBrowserKey(), KEY, "a refused value leaves the earlier key in place");
  forgetBrowserKey();
  assert.equal(getBrowserKey(), null);
  assert.equal(changes, 2);
  stop();
  setBrowserKey(KEY);
  assert.equal(changes, 2);
});

test("without a key the agent is blocked and calls nothing", async () => {
  const { sent, fetcher } = recording(() => reply([box("box.none")]));
  const agent = agentWith(fetcher, {}, null);
  const status = agent.status();
  assert.equal(status.meta.state, "BLOCKED");
  assert.equal(status.meta.reason, "KEY_NOT_ENTERED");
  assert.equal(status.offline.state, "AVAILABLE");
  await rejects(agent.propose("Add a box", context, "meta"), "KEY_NOT_ENTERED");
  assert.equal(sent.length, 0);
});

test("with a key the agent is ready and has a real spending ceiling", () => {
  const status = agentWith(recording(() => reply([])).fetcher).status();
  assert.equal(status.meta.state, "READY");
  assert.equal(status.meta.modelId, "muse-spark-1.3");
  assert.ok(status.meta.estimatedCostCeilingUsd > 0);
  assert.ok(BROWSER_AGENT_CONFIG.maxEstimatedCostUsd <= 3);
  assert.ok(BROWSER_AGENT_CONFIG.maxRequests <= 40);
  assert.equal(BROWSER_AGENT_CONFIG.apiKey, null, "the shared config never holds a key");
});

test("a proposal goes only to Meta, with the key, and the plan never carries it", async () => {
  const { sent, fetcher } = recording(() => reply([box("box.one")]));
  const plan = await agentWith(fetcher).propose("Add a box", context, "meta");
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.url, META_CHAT_ENDPOINT);
  assert.equal(new URL(sent[0]!.url).hostname, "api.meta.ai");
  assert.equal(sent[0]!.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(sent[0]!.credentials, "omit", "site cookies are never sent to Meta");
  assert.equal(sent[0]!.referrerPolicy, "no-referrer");
  assert.equal(sent[0]!.body.model, "muse-spark-1.3");
  assert.equal(sent[0]!.body.parallel_tool_calls, true);
  assert.equal(sent[0]!.body.reasoning_effort, "medium");
  assert.ok(!JSON.stringify(sent[0]!.body).includes(KEY), "the prompt body must not hold the key");
  assert.deepEqual(
    plan.requests.map((request) => request.tool),
    ["AddObject"],
  );
  assert.equal(plan.provenance.label, "META_LIVE");
  assert.ok(!JSON.stringify(plan).includes(KEY));
});

test("the page's own fetch is called in a way browsers accept", async () => {
  // Browsers throw "Illegal invocation" if fetch is called as a method of another object.
  const original = globalThis.fetch;
  let receiver: unknown = "not called";
  globalThis.fetch = function (this: unknown) {
    receiver = this;
    return Promise.resolve(reply([box("box.bound")]));
  } as typeof fetch;
  try {
    await createBrowserAgent({ getKey: () => KEY }).propose("Add a box", context, "meta");
  } finally {
    globalThis.fetch = original;
  }
  assert.ok(receiver === undefined || receiver === globalThis, "fetch keeps its own receiver");
});

test("a failed check goes back to Muse, which corrects it in a second round", async () => {
  const { sent, fetcher } = recording((index) =>
    reply(index === 0 ? [box("box.two", "material.missing")] : [box("box.two")]),
  );
  const plan = await agentWith(fetcher).propose("Add a box", context, "meta");
  assert.equal(sent.length, 2);
  assert.match(JSON.stringify(sent[1]!.body.messages), /material\.missing|MATERIAL|UNKNOWN/i);
  assert.equal(plan.requests.length, 1);
});

test("Meta refusing the key is a plain error that doesn't repeat it", async () => {
  const fetcher: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { code: "invalid_api_key", message: "Unauthorized" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  await rejects(agentWith(fetcher).propose("Add a box", context, "meta"), "AUTHENTICATION_ERROR");
});

test("a new key replaces the old one, and forgetting it stops requests", async () => {
  let key: string | null = KEY;
  const { sent, fetcher } = recording(() => reply([box(`box.key-${sent.length}`)]));
  const agent = createBrowserAgent({ getKey: () => key, fetch: fetcher });
  await agent.propose("Add a box", context, "meta");
  key = "fixture-second-key";
  await agent.propose("Add a box", context, "meta");
  assert.equal(sent[1]!.headers.Authorization, "Bearer fixture-second-key");
  key = null;
  assert.equal(agent.status().meta.reason, "KEY_NOT_ENTERED");
  await rejects(agent.propose("Add a box", context, "meta"), "KEY_NOT_ENTERED");
  assert.equal(sent.length, 2);
});

test("forgetting the key stops a request that's already running", async () => {
  let key: string | null = KEY;
  const agent = createBrowserAgent({ getKey: () => key, fetch: hanging });
  const running = agent.propose("Add a box", context, "meta");
  await new Promise((resolve) => setTimeout(resolve, 0));
  key = null;
  agent.status();
  await rejects(running, "CANCELED");
});

test("a request can be cancelled, and only one runs at a time", async () => {
  const agent = agentWith(hanging);
  const running = agent.propose("Add a box", context, "meta", undefined, "request.cancel-1");
  await rejects(agent.propose("Add a box", context, "meta"), "TRANSACTION_BUSY");
  const receipt = await agent.cancel("request.cancel-1");
  assert.equal(receipt.state, "cancelRequested");
  assert.equal(receipt.outcomeConfirmed, false);
  await rejects(running, "CANCELED");
  await rejects(agent.cancel("request.unknown"), "UNKNOWN_ID");
});

test("the caller's own abort signal also stops the request", async () => {
  const controller = new AbortController();
  const running = agentWith(hanging).propose("Add a box", context, "meta", controller.signal);
  controller.abort();
  await rejects(running, "CANCELED");
});

test("the per-tab request limit blocks further calls", async () => {
  const { sent, fetcher } = recording(() => reply([box(`box.limit-${sent.length}`)]));
  const agent = agentWith(fetcher, { maxRequests: 1 });
  await agent.propose("Add a box", context, "meta");
  assert.equal(agent.status().meta.state, "BLOCKED");
  await assert.rejects(agent.propose("Add a box", context, "meta"));
  assert.equal(sent.length, 1);
});

test("sound rules go through the same key handling", async () => {
  const state: SoundHostState = {
    sceneId: "scene.browser",
    sceneRevision: 4,
    document: {
      schemaVersion: "1.0.0",
      documentId: "behavior.browser",
      revision: 2,
      assets: [],
      profiles: [],
      bindings: [],
    },
    context: {
      sceneRevision: 4,
      objects: [{ objectId: "object.ball", generation: 3 }],
      materialIds: ["material.synthetic"],
      zoneIds: [],
      assetRegistry: [],
    },
  };
  const profile = {
    profileId: "profile.browser",
    revision: 1,
    name: "Synthetic creative impact",
    presetKind: "creative",
    materialPairOverrides: [],
    rules: [
      {
        ruleId: "rule.impact",
        enabled: true,
        trigger: { kind: "discrete", type: "OnImpact", zoneId: null },
        conditions: [],
        generator: { kind: "oscillator", waveform: "sine", frequencyHz: 440 },
        emitter: { attachment: "contact", aggregation: "representative" },
        gainLinear: 0.4,
        pitchSemitones: 7,
        fadeInSeconds: 0.01,
        fadeOutSeconds: 0.03,
        cooldownSeconds: 0.08,
        priority: 50,
        voiceLimit: 2,
        layerGroup: "layer.creative",
        mappings: [],
        lifecycle: null,
        oneShotDurationSeconds: 0.2,
      },
    ],
  };
  const { sent, fetcher } = recording(() =>
    reply([
      [
        "ProposeSoundBehavior",
        {
          operations: [
            { type: "CreateProfile", profile },
            {
              type: "AssignBinding",
              binding: {
                bindingId: "binding.ball",
                objectId: "object.ball",
                objectGeneration: 3,
                profileId: "profile.browser",
                profileRevision: 1,
                enabled: true,
                overrides: [],
              },
            },
          ],
        },
      ],
    ]),
  );
  const plan = await agentWith(fetcher).proposeSound("Raise the pitch", state, {});
  assert.equal(sent[0]!.url, META_CHAT_ENDPOINT);
  assert.equal(sent[0]!.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(plan.proposal.operations.length, 2);
  assert.ok(!JSON.stringify(plan).includes(KEY));
  await rejects(
    agentWith(fetcher, {}, null).proposeSound("Raise the pitch", state, {}),
    "KEY_NOT_ENTERED",
  );
});
