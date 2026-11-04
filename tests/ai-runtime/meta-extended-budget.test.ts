import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openMetaBudgetLedger } from "../../server/meta-budget-ledger.js";
import {
  MetaProvider,
  getMetaProviderStatus,
  metaConfigFromEnv,
} from "../../server/meta-provider.js";
import { config, policy, context, response, body } from "./muse-limits-fixtures.js";

const file = async () => join(await mkdtemp(join(tmpdir(), "muse-extended-")), "ledger.json");
test("US$5 under another authorization is blocked and the ledger rejects it", async () => {
  assert.equal(
    getMetaProviderStatus({ ...config, verificationArtifactId: "other" }).reason,
    "ZERO_OR_INVALID_BUDGET",
  );
  await assert.rejects(
    openMetaBudgetLedger(await file(), { ...policy, authorizationId: "other" }),
    { code: "LEDGER_POLICY_INVALID" },
  );
  assert.equal(getMetaProviderStatus(config).state, "READY");
});
test("13 requests under another authorization are rejected", async () => {
  assert.equal(
    getMetaProviderStatus({
      ...config,
      verificationArtifactId: "other",
      maxEstimatedCostUsd: 1,
      maxCompletionTokens: 1000,
      maxInputBytes: 32000,
      parallelToolCalls: false,
      reasoningEffort: "minimal",
      maxRequests: 13,
    }).reason,
    "INVALID_HOST_BUDGET",
  );
  await assert.rejects(
    openMetaBudgetLedger(await file(), {
      ...policy,
      budgetUsd: 1,
      authorizationId: "other",
      maxRequests: 13,
    }),
    { code: "LEDGER_POLICY_INVALID" },
  );
});
test("named authorization rejects US$5.01 and 201 requests", async () => {
  assert.equal(
    getMetaProviderStatus({ ...config, maxEstimatedCostUsd: 5.01 }).reason,
    "ZERO_OR_INVALID_BUDGET",
  );
  assert.equal(
    getMetaProviderStatus({ ...config, maxRequests: 201 }).reason,
    "INVALID_HOST_BUDGET",
  );
  for (const change of [{ budgetUsd: 5.01 }, { maxRequests: 201 }])
    await assert.rejects(openMetaBudgetLedger(await file(), { ...policy, ...change }), {
      code: "LEDGER_POLICY_INVALID",
    });
});
test("environment reads explicit extended limits with strict parallel true", () => {
  const env = {
    META_MAX_REQUESTS: "200",
    META_MAX_INPUT_BYTES: "128000",
    META_PARALLEL_TOOL_CALLS: "true",
    META_MAX_COMPLETION_TOKENS: "16000",
    META_REASONING_EFFORT: "xhigh",
  };
  const parsed = metaConfigFromEnv(env);
  assert.equal(parsed.maxRequests, 200);
  assert.equal(parsed.maxInputBytes, 128000);
  assert.equal(parsed.maxCompletionTokens, 16000);
  assert.equal(parsed.parallelToolCalls, true);
  assert.equal(
    metaConfigFromEnv({ ...env, META_PARALLEL_TOOL_CALLS: "TRUE" }).parallelToolCalls,
    false,
  );
});
test("existing ledger policy cannot be raised or changed on reopen", async () => {
  const path = await file();
  await (await openMetaBudgetLedger(path, { ...policy, budgetUsd: 1 })).close();
  await assert.rejects(openMetaBudgetLedger(path, policy), { code: "LEDGER_INVALID" });
});
test("three completed requests use estimates only for named authorization and survive restart", async () => {
  for (const extended of [true, false]) {
    const path = await file();
    const selected = extended
      ? policy
      : { ...policy, authorizationId: "other", budgetUsd: 1, maxRequests: 12 };
    const ledger = await openMetaBudgetLedger(path, selected);
    for (let i = 0; i < 3; i++) {
      const id = `request.${i}`;
      await ledger.begin(id, "a".repeat(64));
      await ledger.reserve(id, `${id}.attempt`, 0.1);
      await ledger.settleAttempt(id, `${id}.attempt`, {
        status: "completed",
        httpStatus: 200,
        responseId: body().id,
        modelId: config.modelId,
        usage: { promptTokens: 100, completionTokens: 50 },
      });
      await ledger.complete(id, body());
    }
    const expected = extended ? 0.0010125 : 0.3;
    assert.ok(Math.abs(ledger.snapshot().reservedUsd - expected) < 1e-8);
    await ledger.close();
    const reopened = await openMetaBudgetLedger(path, selected);
    assert.ok(Math.abs(reopened.snapshot().reservedUsd - expected) < 1e-8);
    await reopened.close();
  }
});
test("failed, uncertain and usage-less attempts keep whole reservations", async () => {
  for (const status of ["failed", "uncertain", "completed"] as const) {
    const ledger = await openMetaBudgetLedger(await file(), policy);
    await ledger.begin("request.one", "b".repeat(64));
    await ledger.reserve("request.one", "attempt.one", 0.1);
    await ledger.settleAttempt("request.one", "attempt.one", {
      status,
      httpStatus: 200,
      responseId: body().id,
      modelId: config.modelId,
      usage: status === "completed" ? null : { promptTokens: 1, completionTokens: 1 },
    });
    assert.equal(ledger.snapshot().reservedUsd, 0.1);
    await ledger.close();
  }
});
test("usage accounting prevents early in-process blocking and cap stops the next fetch", async () => {
  const path = await file();
  const small = { ...policy, budgetUsd: 0.11 };
  const ledger = await openMetaBudgetLedger(path, small);
  let count = 0;
  const provider = new MetaProvider(
    { ...config, maxEstimatedCostUsd: 0.11, parallelToolCalls: false },
    {
      budget: ledger,
      fetch: async () => {
        count++;
        return response();
      },
    },
  );
  for (let i = 0; i < 3; i++)
    await provider.plan("add", context(), { requestId: `request.ok-${i}` });
  assert.equal(count, 3);
  // Reserve almost all remaining credit outside this provider, proving the ledger is authoritative.
  await ledger.begin("request.external", "c".repeat(64));
  await ledger.reserve("request.external", "attempt.external", 0.1);
  await ledger.settleAttempt("request.external", "attempt.external", {
    status: "failed",
    httpStatus: 500,
    responseId: null,
    modelId: null,
    usage: null,
  });
  await ledger.fail("request.external", "SERVICE_UNAVAILABLE");
  await assert.rejects(provider.plan("add", context(), { requestId: "request.stop" }), {
    code: "BUDGET_EXCEEDED",
  });
  assert.equal(count, 3);
  assert.ok((await readFile(path, "utf8")).length > 0);
  await ledger.close();
});
test("named in-process accounting releases completed usage reserves without a ledger", async () => {
  const provider = new MetaProvider(
    { ...config, maxEstimatedCostUsd: 0.11, parallelToolCalls: false },
    { fetch: async () => response() },
  );
  for (let i = 0; i < 3; i++) await provider.plan("add", context());
  assert.ok(Math.abs(provider.usage().reservedCostUsd - 0.0010125) < 1e-8);
});
test("uncertain in-process reservations round up to the same nanodollars as the ledger", async () => {
  let bytes = 0;
  const priced = {
    ...config,
    parallelToolCalls: false,
    inputUsdPerMillionTokens: 0.00001234567,
    outputUsdPerMillionTokens: 0.00007654321,
  };
  const provider = new MetaProvider(priced, {
    fetch: async (_url, init) => {
      bytes = Buffer.byteLength(String(init!.body));
      throw new Error("Synthetic uncertain transport");
    },
  });
  await assert.rejects(provider.plan("text", context()), { code: "TIMEOUT" });
  const estimate =
    (bytes * priced.inputUsdPerMillionTokens +
      priced.maxCompletionTokens * priced.outputUsdPerMillionTokens) /
    1e6;
  assert.equal(provider.usage().reservedCostUsd, Math.ceil(estimate * 1e9) / 1e9);
});
test("all legacy host limits remain blocked outside the named exception", () => {
  const legacy = {
    ...config,
    verificationArtifactId: "other",
    maxEstimatedCostUsd: 1,
    maxRequests: 12,
    maxInputBytes: 32000,
    maxCompletionTokens: 4000,
    parallelToolCalls: false,
    reasoningEffort: "minimal" as const,
  };
  for (const change of [
    { maxInputBytes: 32001 },
    { maxCompletionTokens: 4001 },
    { reasoningEffort: "low" as const },
    { parallelToolCalls: true },
    { maxRequests: 0 },
    { maxInputBytes: NaN },
  ])
    assert.equal(getMetaProviderStatus({ ...legacy, ...change }).reason, "INVALID_HOST_BUDGET");
});
test("extended request records support 200 calls and stop call 201 before fetch", async () => {
  let calls = 0;
  const provider = new MetaProvider(
    { ...config, parallelToolCalls: false },
    {
      fetch: async () => {
        calls++;
        return response(body([], `response.${calls}`, "stop"));
      },
    },
  );
  for (let i = 0; i < 200; i++)
    await provider.plan("text", context(), { requestId: `request.record-${i}` });
  assert.equal(calls, 200);
  await assert.rejects(provider.plan("text", context(), { requestId: "request.record-201" }), {
    code: "BUDGET_EXCEEDED",
  });
  assert.equal(calls, 200);
});
test(
  "ledger allows the full 4 MiB capacity then fails loudly and never fetches again",
  { timeout: 30000 },
  async () => {
    const path = await file();
    let ledger = await openMetaBudgetLedger(path, policy);
    let count = 0;
    const fetcher: typeof globalThis.fetch = async () => {
      count++;
      const b = body([], `response.capacity-${count}`, "stop");
      b.choices[0]!.message.content = "x".repeat(245000);
      return response(b);
    };
    await new MetaProvider(
      { ...config, parallelToolCalls: false },
      { budget: ledger, fetch: fetcher },
    ).plan("text", context(), { requestId: "request.capacity-seed" });
    await ledger.close();
    // Build the large fixture from a real completed record. This avoids 68 redundant
    // fsync cycles during setup while retaining the same near-4-MiB boundary assertions.
    const document = JSON.parse(await readFile(path, "utf8"));
    const seed = document.requests[0];
    document.requests = Array.from({ length: 17 }, (_, i) => {
      const record = structuredClone(seed);
      record.requestId = `request.capacity-${i}`;
      record.attempts[0].attemptId = `request.capacity-${i}.attempt-1`;
      record.response.id = `response.seed-${i}`;
      record.attempts[0].settlement.responseId = record.response.id;
      return record;
    });
    document.revision += 64;
    const fixture = JSON.stringify(document, null, 2) + "\n";
    assert.ok(Buffer.byteLength(fixture) > 4_000_000);
    assert.ok(Buffer.byteLength(fixture) < 4 * 1024 * 1024);
    await writeFile(path, fixture, "utf8");
    ledger = await openMetaBudgetLedger(path, policy);
    assert.equal(ledger.snapshot().requests, 17);
    const provider = new MetaProvider(
      { ...config, parallelToolCalls: false },
      { budget: ledger, fetch: fetcher },
    );
    await assert.rejects(provider.plan("text", context(), { requestId: "request.capacity-full" }), {
      code: "LEDGER_CAPACITY_EXCEEDED",
    });
    const stopped = count;
    await assert.rejects(provider.plan("text", context(), { requestId: "request.after-capacity" }));
    assert.equal(count, stopped);
    await ledger.close();
  },
);
