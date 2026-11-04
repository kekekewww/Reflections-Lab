import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createAgentServer } from "../../server/app.js";
import { DEFAULT_META_CONFIG, MetaProvider } from "../../server/meta-provider.js";
import type { MetaProviderConfig } from "../../server/meta-provider.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import type { AgentPlan, PlannerContext } from "../../src/ai/types.js";

const IDENTITY = [0, 0, 0, 1];
const context: PlannerContext = {
  scene: createDefaultScene(),
  materials: DEFAULT_MATERIALS.map(({ id, label }) => ({ id, label })),
  signals: [{ id: "signal.tone-220", label: "220 Hz sine", frequencyHz: 220 }],
  materialRegistryRevision: 1,
};
function config(overrides: Partial<MetaProviderConfig> = {}): MetaProviderConfig {
  return {
    ...DEFAULT_META_CONFIG,
    apiKey: "fixture-key",
    networkEnabled: true,
    modelId: "muse-spark-1.3",
    verificationStatus: "verified",
    verifiedAt: "2026-11-04T00:00:00.000Z",
    verificationArtifactId: "artifact.meta-limits-20261104",
    maxEstimatedCostUsd: 5,
    inputUsdPerMillionTokens: 1.25,
    outputUsdPerMillionTokens: 4.25,
    pricingSource: "https://dev.meta.ai/docs/pricing-rate-limits",
    maxRetries: 0,
    timeoutMs: 120000,
    maxCompletionTokens: 16000,
    maxRequests: 200,
    maxInputBytes: 128000,
    parallelToolCalls: true,
    reasoningEffort: "medium",
    ...overrides,
  };
}
type Call = [string, Record<string, unknown>];
function reply(calls: Call[], text: string | null, finish = calls.length ? "tool_calls" : "stop") {
  reply.count++;
  return new Response(
    JSON.stringify({
      id: `response.route-${reply.count}`,
      model: "muse-spark-1.3",
      choices: [
        {
          finish_reason: finish,
          message: {
            role: "assistant",
            content: text,
            ...(calls.length
              ? {
                  tool_calls: calls.map(([name, args], index) => ({
                    id: `call.${reply.count}-${index}`,
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
  );
}
reply.count = 0;
function box(id: string): Call {
  return [
    "AddObject",
    {
      objectId: id,
      label: id,
      shape: "box",
      dimensionsM: [0.5, 0.5, 0.5],
      positionM: [2, 0.25, 2],
      orientationQuaternion: IDENTITY,
      materialId: "material.wood",
      mode: "fixed",
      massKg: 5,
    },
  ];
}
function ballPath(start: number[]): Call {
  return [
    "SetTrajectory",
    {
      objectId: "ball",
      interpolation: "linearSlerp",
      samples: [
        { timeS: 0, positionM: start, orientationQuaternion: IDENTITY },
        {
          timeS: 1,
          positionM: [start[0]! + 0.1, start[1], start[2]],
          orientationQuaternion: IDENTITY,
        },
      ],
    },
  ];
}
async function withServer(
  replies: (Response | Promise<Response>)[],
  overrides: Partial<MetaProviderConfig>,
  body: (url: string, sent: Record<string, unknown>[]) => Promise<void>,
): Promise<void> {
  const sent: Record<string, unknown>[] = [];
  const provider = new MetaProvider(config(overrides), {
    fetch: async (_url, init) => {
      sent.push(JSON.parse(String(init!.body)));
      const next = replies.shift();
      assert.ok(next, "the planner asked for more responses than the test expected");
      return next;
    },
  });
  const server = createAgentServer({ provider });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await body(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, sent);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
async function propose(url: string, prompt = "Build it") {
  const response = await fetch(`${url}/api/agent/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, context, mode: "meta" }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

test("a builder server returns every step as one plan, with Muse's note", async () => {
  await withServer(
    [reply([box("box.one"), box("box.two"), ["RemoveObject", { objectId: "ball" }]], "Done soon.")],
    {},
    async (url, sent) => {
      const { status, body } = await propose(url);
      assert.equal(status, 200);
      const plan = body as unknown as AgentPlan;
      assert.deepEqual(
        plan.requests.map((request) => request.tool),
        ["AddObject", "AddObject", "RemoveObject"],
      );
      assert.equal(plan.note, "Done soon.");
      assert.equal(plan.provenance.label, "META_LIVE");
      assert.equal(sent.length, 1);
      assert.equal(sent[0]!.parallel_tool_calls, true);
    },
  );
});

test("a list the app would reject goes back to Muse with the reason, and the fix is returned", async () => {
  const start = context.scene.objects.find((object) => object.id === "ball")!.positionM;
  await withServer(
    [
      // The ball isn't kinematic, which only the real Motion check can catch.
      reply([ballPath(start)], "First try."),
      reply(
        [
          ["SetRigidBodyMode", { objectId: "ball", mode: "kinematic", velocityPolicy: "zero" }],
          ballPath(start),
        ],
        "Fixed.",
      ),
    ],
    {},
    async (url, sent) => {
      const { status, body } = await propose(url);
      assert.equal(status, 200);
      assert.equal(sent.length, 2);
      const messages = sent[1]!.messages as { role: string; content?: string }[];
      const toolMessage = messages.find((message) => message.role === "tool")!;
      assert.match(toolMessage.content!, /MOTION_NOT_KINEMATIC/);
      const plan = body as unknown as AgentPlan;
      assert.equal(plan.requests.length, 2);
      assert.equal(plan.note, "Fixed.");
    },
  );
});

test("the real Host rules run before a list is returned", async () => {
  await withServer(
    [
      reply([["RemoveObject", { objectId: "missing" }]], "One."),
      reply([["RemoveObject", { objectId: "missing" }]], "Two."),
      reply([["RemoveObject", { objectId: "missing" }]], "Three."),
    ],
    {},
    async (url, sent) => {
      const { status, body } = await propose(url);
      assert.equal(status, 400);
      const error = body.error as { code: string; message: string };
      assert.equal(error.code, "PROPOSAL_REJECTED");
      assert.match(error.message, /missing/);
      assert.equal(sent.length, 3, "three rounds, then stop spending");
    },
  );
});

test("when Muse makes no calls, the plan is empty and carries what it said", async () => {
  await withServer([reply([], "There's no velvet in this project.")], {}, async (url) => {
    const { status, body } = await propose(url);
    assert.equal(status, 200);
    const plan = body as unknown as AgentPlan;
    assert.deepEqual(plan.requests, []);
    assert.equal(plan.note, "There's no velvet in this project.");
    assert.equal(plan.provenance.label, "META_LIVE");
  });
});

test("a cut-off response is reported plainly and isn't retried", async () => {
  await withServer([reply([], "Partial.", "length")], {}, async (url, sent) => {
    const { status, body } = await propose(url);
    assert.equal(status, 400);
    assert.equal((body.error as { code: string }).code, "PROPOSAL_TOO_LONG");
    assert.equal(sent.length, 1);
  });
});

test("a server without the builder setting still uses the one-step planner", async () => {
  await withServer(
    [reply([box("box.one")], null)],
    { parallelToolCalls: false },
    async (url, sent) => {
      const { status, body } = await propose(url);
      assert.equal(status, 200);
      assert.equal((body as unknown as AgentPlan).requests.length, 1);
      assert.equal((body as unknown as AgentPlan).note, undefined);
      assert.equal(sent[0]!.parallel_tool_calls, false);
      assert.equal((sent[0]!.tools as unknown[]).length, 11);
    },
  );
});
