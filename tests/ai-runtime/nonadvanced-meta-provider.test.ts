import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_META_CONFIG, MetaProvider } from "../../server/meta-provider.js";
import type { MetaProviderConfig } from "../../server/meta-provider.js";
import { inspectBoundedMetaResponse } from "../../server/meta-response-body.js";
import { openMetaBudgetLedger } from "../../server/meta-budget-ledger.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import type { PlannerContext } from "../../src/ai/types.js";

// Injected synthetic transports only: no catalog, credentials, or inference.
const fixtureKey = "LLM_0_NONADVANCED_FAKE_KEY";
const config: MetaProviderConfig = {
  ...DEFAULT_META_CONFIG,
  apiKey: fixtureKey,
  networkEnabled: true,
  modelId: "model.fixture",
  verificationStatus: "verified",
  verifiedAt: "2026-11-03T00:00:00.000Z",
  verificationArtifactId: "artifact.synthetic-nonadvanced",
  maxEstimatedCostUsd: 1,
  inputUsdPerMillionTokens: 1,
  outputUsdPerMillionTokens: 2,
  pricingSource: "SYNTHETIC_FIXTURE_ONLY",
  maxRetries: 0,
};
const context = (): PlannerContext => ({
  scene: createDefaultScene(),
  materials: DEFAULT_MATERIALS.map(({ id, label }) => ({ id, label })),
  signals: [],
  materialRegistryRevision: 1,
});
function responseBody() {
  return {
    id: "response.nonadvanced",
    model: "model.fixture",
    choices: [
      {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call.nonadvanced",
              type: "function",
              function: {
                name: "AddObject",
                arguments: JSON.stringify({
                  objectId: "object.nonadvanced",
                  label: "串流球🎵",
                  shape: "sphere",
                  dimensionsM: [0.4, 0.4, 0.4],
                  positionM: [0, 2, 0],
                  orientationQuaternion: [0, 0, 0, 1],
                  materialId: "material.metal",
                  mode: "dynamicNoGravity",
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
function providerWith(value: unknown): MetaProvider {
  return new MetaProvider(config, {
    fetch: async () => new Response(JSON.stringify(value)),
  });
}

for (const fault of [
  "null",
  "two-choices",
  "user-role",
  "refusal",
  "stop-with-tool",
  "filter-with-tool",
] as const) {
  test(`scene planner rejects ${fault} response before a proposal`, async () => {
    const body = responseBody();
    if (fault === "two-choices") body.choices.push(structuredClone(body.choices[0]!));
    if (fault === "user-role") body.choices[0]!.message.role = "user";
    if (fault === "refusal")
      Object.assign(body.choices[0]!.message, { refusal: "Synthetic refusal" });
    if (fault === "stop-with-tool") body.choices[0]!.finish_reason = "stop";
    if (fault === "filter-with-tool") body.choices[0]!.finish_reason = "content_filter";
    const current = context();
    const before = structuredClone(current);
    await assert.rejects(providerWith(fault === "null" ? null : body).plan("新增球", current), {
      code: "PROVIDER_REQUEST_FAILED",
    });
    assert.deepEqual(current, before);
  });
}

test("assistant stop without a tool remains an explicit no-change response", async () => {
  const body = responseBody();
  body.choices[0]!.finish_reason = "stop";
  body.choices[0]!.message.tool_calls = [];
  const plan = await providerWith(body).plan("缺資料就說明", context());
  assert.deepEqual(plan.requests, []);
  assert.equal(plan.warnings.length, 1);
});

test("fixed Meta endpoint refuses redirects on the main provider transport", async () => {
  const provider = new MetaProvider(config, {
    fetch: async (_url, init) => {
      assert.equal(init?.redirect, "error");
      return new Response(JSON.stringify(responseBody()));
    },
  });
  assert.equal((await provider.plan("新增球", context())).requests.length, 1);
});

for (const bufferKind of ["Uint8Array", "Buffer"] as const) {
  test(`bounded response reader owns reused ${bufferKind} chunks before the next pull`, async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(responseBody()));
    const scratch = bufferKind === "Buffer" ? Buffer.alloc(19) : new Uint8Array(19);
    let offset = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (offset === bytes.length) {
            controller.close();
            return;
          }
          const length = Math.min(scratch.length, bytes.length - offset);
          scratch.fill(0);
          scratch.set(bytes.subarray(offset, offset + length));
          offset += length;
          controller.enqueue(scratch.subarray(0, length));
        },
      },
      { highWaterMark: 0 },
    );
    const provider = new MetaProvider(config, { fetch: async () => new Response(stream) });
    const plan = await provider.plan("新增球", context());
    assert.equal((plan.requests[0]!.arguments as { label: string }).label, "串流球🎵");
    assert.equal(stream.locked, false);
  });
}

test("oversize response cancels and unlocks its reader without retrying", async () => {
  let canceled = 0;
  let calls = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        controller.enqueue(new Uint8Array(256 * 1024 + 1));
      },
      cancel() {
        canceled++;
      },
    },
    { highWaterMark: 0 },
  );
  const provider = new MetaProvider(config, {
    fetch: async () => {
      calls++;
      return new Response(stream);
    },
  });
  await assert.rejects(provider.plan("新增球", context()), { code: "INPUT_LIMIT" });
  assert.equal(calls, 1);
  assert.equal(canceled, 1);
  assert.equal(stream.locked, false);
});

test("provider credential echoes are rejected before persistent response caching or browser provenance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reflection-meta-redaction-"));
  const path = join(directory, "budget.json");
  const ledger = await openMetaBudgetLedger(path, {
    authorizationId: "authorization.synthetic",
    modelId: config.modelId!,
    dataMode: "standard",
    budgetUsd: 1,
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 2,
    pricingSource: config.pricingSource!,
    maxRequests: 12,
    maxAttemptsPerRequest: 1,
  });
  try {
    const body = responseBody();
    body.id = fixtureKey;
    const provider = new MetaProvider(config, {
      budget: ledger,
      fetch: async () => new Response(JSON.stringify(body)),
    });
    await assert.rejects(provider.plan("新增球", context()), (error: unknown) => {
      assert.ok(error && typeof error === "object" && "code" in error);
      assert.equal(error.code, "POLICY_DENIED");
      assert.equal(String(error).includes(fixtureKey), false);
      return true;
    });
    assert.equal((await readFile(path, "utf8")).includes(fixtureKey), false);
    const held = ledger.snapshot();
    assert.equal(held.attempts, 1);
    assert.ok(held.reservedUsd > 0);
    assert.equal(held.blockedReason, "REQUEST_OUTCOME_UNCONFIRMED");
    await ledger.close();
    const reopened = await openMetaBudgetLedger(path, held.policy);
    let restartedDispatches = 0;
    try {
      const restarted = new MetaProvider(config, {
        budget: reopened,
        fetch: async () => {
          restartedDispatches++;
          return new Response(JSON.stringify(responseBody()));
        },
      });
      await assert.rejects(restarted.plan("新增球", context()), {
        code: "REQUEST_OUTCOME_UNCONFIRMED",
      });
      assert.equal(restartedDispatches, 0);
      assert.equal(reopened.snapshot().reservedUsd, held.reservedUsd);
    } finally {
      await reopened.close();
    }
  } finally {
    await ledger.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("inspection and provider consumption preserve the same bytes with a reused producer buffer", async () => {
  const encoded = JSON.stringify(responseBody());
  const bytes = new TextEncoder().encode(encoded);
  const scratch = new Uint8Array(19);
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (offset === bytes.length) {
          controller.close();
          return;
        }
        const length = Math.min(scratch.length, bytes.length - offset);
        scratch.fill(0);
        scratch.set(bytes.subarray(offset, offset + length));
        offset += length;
        controller.enqueue(scratch.subarray(0, length));
      },
    },
    { highWaterMark: 0 },
  );
  const inspected = await inspectBoundedMetaResponse(
    new Response(stream, { headers: { "x-request-id": "fixture.inspection" } }),
  );
  assert.equal(inspected.text, encoded);
  assert.equal(inspected.response.headers.get("x-request-id"), "fixture.inspection");
  const provider = new MetaProvider(config, { fetch: async () => inspected.response });
  const plan = await provider.plan("新增球", context());
  assert.equal((plan.requests[0]!.arguments as { label: string }).label, "串流球🎵");
});

test("invalid UTF-8 is a provider-format error, keeps its cost reserve and never retries", async () => {
  let calls = 0;
  const provider = new MetaProvider(config, {
    fetch: async () => {
      calls++;
      return new Response(new Uint8Array([0xc3, 0x28]));
    },
  });
  await assert.rejects(provider.plan("新增球", context()), { code: "PROVIDER_REQUEST_FAILED" });
  assert.equal(calls, 1);
  assert.ok(provider.usage().reservedCostUsd > 0);
});

test("a configured credential without a Meta prefix cannot escape through provenance", async () => {
  const fakeCredential = "fixture-nonadvanced-do-not-expose";
  const body = responseBody();
  body.id = fakeCredential;
  const provider = new MetaProvider(
    { ...config, apiKey: fakeCredential },
    {
      fetch: async () => new Response(JSON.stringify(body)),
    },
  );
  await assert.rejects(provider.plan("新增球", context()), (error: unknown) => {
    assert.ok(error && typeof error === "object" && "code" in error);
    assert.equal(error.code, "POLICY_DENIED");
    assert.equal(String(error).includes(fakeCredential), false);
    return true;
  });
});
