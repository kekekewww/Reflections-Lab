import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openMetaBudgetLedger } from "../../server/meta-budget-ledger.js";
import type { MetaBudgetPolicy, MetaBudgetSettlement } from "../../server/meta-budget-ledger.js";

// Secret-free accounting fixtures. This suite performs no provider/network requests.
const policy: MetaBudgetPolicy = {
  authorizationId: "authorization.synthetic-session",
  modelId: "model.fixture",
  dataMode: "standard",
  budgetUsd: 0.1,
  inputUsdPerMillionTokens: 1,
  outputUsdPerMillionTokens: 2,
  pricingSource: "SYNTHETIC_TEST_PRICING",
  maxRequests: 12,
  maxAttemptsPerRequest: 3,
};
const fingerprint = (value = "fixture body") => createHash("sha256").update(value).digest("hex");
const completed: MetaBudgetSettlement = {
  status: "completed",
  httpStatus: 200,
  responseId: "response.fixture",
  modelId: policy.modelId,
  usage: { promptTokens: 10, completionTokens: 20 },
};
const rejected: MetaBudgetSettlement = {
  status: "failed",
  httpStatus: 503,
  responseId: null,
  modelId: null,
  usage: null,
};
const response = {
  id: "response.fixture",
  model: policy.modelId,
  choices: [
    { finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [] } },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 20 },
};
async function fixture(t: test.TestContext): Promise<string> {
  // The restricted Windows temp directory denies replacing an existing file with rename.
  // Use the explicitly writable workspace for the real atomic-rename storage contract.
  const root = resolve(fileURLToPath(new URL("../../.cache/meta-budget-tests/", import.meta.url)));
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "reflection-meta-request-ledger-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), root);
    assert.ok(directory.includes("reflection-meta-request-ledger-"));
    await rm(directory, { recursive: true, force: true });
  });
  return join(directory, "ledger.json");
}
async function finish(file: string, requestId = "request.one", reserve = 0.02) {
  const ledger = await openMetaBudgetLedger(file, policy);
  await ledger.begin(requestId, fingerprint(requestId));
  await ledger.reserve(requestId, "attempt.one", reserve);
  await ledger.settleAttempt(requestId, "attempt.one", completed);
  await ledger.complete(requestId, response);
  await ledger.close();
}

test("reservation is durable before dispatch and completed output survives a restart without refund", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  assert.deepEqual(await ledger.begin("request.one", fingerprint()), { kind: "new" });
  await ledger.reserve("request.one", "attempt.one", 0.02);
  const durable = JSON.parse(await readFile(file, "utf8"));
  assert.equal(durable.requests[0].attempts[0].status, "reserved");
  assert.equal(durable.requests[0].attempts[0].reservedUnits, 20_000_000);
  await ledger.settleAttempt("request.one", "attempt.one", completed);
  await ledger.complete("request.one", response);
  assert.equal(ledger.snapshot().actualBillingCostUsd, null);
  assert.equal(ledger.snapshot().remainingCreditUsd, null);
  await ledger.close();
  const reopened = await openMetaBudgetLedger(file, policy);
  t.after(() => reopened.close());
  assert.deepEqual(await reopened.begin("request.one", fingerprint()), {
    kind: "completed",
    response,
  });
  assert.equal(reopened.snapshot().reservedUsd, 0.02);
  assert.equal(reopened.snapshot().requests, 1);
});

test("completed response is immutable to callers and transport-only fields are not retained", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  t.after(() => ledger.close());
  await ledger.begin("request.one", fingerprint());
  await ledger.reserve("request.one", "attempt.one", 0.01);
  await ledger.settleAttempt("request.one", "attempt.one", completed);
  await ledger.complete("request.one", {
    ...response,
    messages: ["PRIVATE_INPUT_NOT_RETAINED"],
    headers: { Authorization: "SECRET_HEADER_NOT_RETAINED" },
  });
  const first = await ledger.begin("request.one", fingerprint());
  assert.equal(first.kind, "completed");
  if (first.kind === "completed") (first.response as typeof response).model = "caller.changed";
  assert.deepEqual(await ledger.begin("request.one", fingerprint()), {
    kind: "completed",
    response,
  });
  const text = await readFile(file, "utf8");
  assert.equal(text.includes("PRIVATE_INPUT_NOT_RETAINED"), false);
  assert.equal(text.includes("SECRET_HEADER_NOT_RETAINED"), false);
});

test("same request ID with a different fingerprint cannot reuse or dispatch a request", async (t) => {
  const file = await fixture(t);
  await finish(file);
  const ledger = await openMetaBudgetLedger(file, policy);
  t.after(() => ledger.close());
  await assert.rejects(ledger.begin("request.one", fingerprint("different")), {
    code: "REQUEST_ID_CONFLICT",
  });
  assert.equal(ledger.snapshot().reservedUsd, 0.02);
});

test("reserved or active identity after restart blocks both resending and dispatching around it", async (t) => {
  for (const reserve of [false, true]) {
    const file = await fixture(t);
    const first = await openMetaBudgetLedger(file, policy);
    await first.begin("request.pending", fingerprint());
    if (reserve) await first.reserve("request.pending", "attempt.pending", 0.02);
    await first.close();
    const reopened = await openMetaBudgetLedger(file, policy);
    await assert.rejects(reopened.begin("request.pending", fingerprint()), {
      code: "REQUEST_OUTCOME_UNCONFIRMED",
    });
    await assert.rejects(reopened.begin("request.new", fingerprint("new")), {
      code: "REQUEST_OUTCOME_UNCONFIRMED",
    });
    await assert.rejects(reopened.settleAttempt("request.pending", "attempt.pending", completed), {
      code: "REQUEST_NOT_OWNED",
    });
    assert.equal(reopened.snapshot().reservedUsd, reserve ? 0.02 : 0);
    await reopened.close();
  }
});

test("uncertain transport keeps its reserve and blocks later dispatch durably", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  await ledger.begin("request.one", fingerprint());
  await ledger.reserve("request.one", "attempt.one", 0.04);
  await ledger.settleAttempt("request.one", "attempt.one", {
    status: "uncertain",
    httpStatus: null,
    responseId: null,
    modelId: null,
  });
  await ledger.fail("request.one", "TIMEOUT");
  assert.equal(ledger.snapshot().reservedUsd, 0.04);
  assert.equal(ledger.snapshot().blockedReason, "REQUEST_OUTCOME_UNCONFIRMED");
  await ledger.close();
  const reopened = await openMetaBudgetLedger(file, policy);
  t.after(() => reopened.close());
  await assert.rejects(reopened.begin("request.two", fingerprint("second")), {
    code: "REQUEST_OUTCOME_UNCONFIRMED",
  });
  const durable = JSON.parse(await readFile(file, "utf8"));
  assert.equal(durable.requests[0].state, "uncertain");
});

test("known HTTP rejection allows only a new request and never refunds the rejected attempt", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  t.after(() => ledger.close());
  await ledger.begin("request.one", fingerprint());
  await ledger.reserve("request.one", "attempt.one", 0.06);
  await ledger.settleAttempt("request.one", "attempt.one", rejected);
  await ledger.fail("request.one", "SERVICE_UNAVAILABLE");
  await assert.rejects(ledger.begin("request.one", fingerprint()), {
    code: "REQUEST_ALREADY_FAILED",
  });
  await ledger.begin("request.two", fingerprint("second"));
  await assert.rejects(ledger.reserve("request.two", "attempt.two", 0.041), {
    code: "BUDGET_EXCEEDED",
  });
  assert.equal(ledger.snapshot().reservedUsd, 0.06);
  await ledger.reserve("request.two", "attempt.two", 0.04);
  assert.equal(ledger.snapshot().reservedUsd, 0.1);
});

test("retries each require a new reservation and cannot exceed their attempt ceiling", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  t.after(() => ledger.close());
  await ledger.begin("request.one", fingerprint());
  for (let index = 1; index <= 3; index++) {
    await ledger.reserve("request.one", `attempt.${index}`, 0.01);
    await assert.rejects(ledger.reserve("request.one", `attempt.${index}`, 0.01), {
      code: "ATTEMPT_ALREADY_RESERVED",
    });
    await ledger.settleAttempt("request.one", `attempt.${index}`, rejected);
  }
  await assert.rejects(ledger.reserve("request.one", "attempt.four", 0.01), {
    code: "ATTEMPT_LIMIT_REACHED",
  });
  assert.equal(ledger.snapshot().reservedUsd, 0.03);
});

test("concurrent mutations on one handle serialize and cannot overspend", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  t.after(() => ledger.close());
  await ledger.begin("request.one", fingerprint());
  const results = await Promise.allSettled([
    ledger.reserve("request.one", "attempt.one", 0.06),
    ledger.reserve("request.one", "attempt.two", 0.06),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(ledger.snapshot().reservedUsd, 0.06);
});

test("two independent handles cannot acquire separate active requests", async (t) => {
  const file = await fixture(t);
  const first = await openMetaBudgetLedger(file, policy);
  const second = await openMetaBudgetLedger(file, policy);
  t.after(async () => {
    await first.close();
    await second.close();
  });
  const results = await Promise.allSettled([
    first.begin("request.one", fingerprint("one")),
    second.begin("request.two", fingerprint("two")),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const durable = JSON.parse(await readFile(file, "utf8"));
  assert.equal(durable.requests.length, 1);
  assert.equal(durable.requests[0].state, "active");
});

test("an unknown external lock is neither stolen nor deleted", async (t) => {
  const file = await fixture(t);
  const owner = "unknown-process-lock";
  await writeFile(file + ".lock", owner);
  await assert.rejects(openMetaBudgetLedger(file, policy), { code: "LEDGER_LOCKED" });
  assert.equal(await readFile(file + ".lock", "utf8"), owner);
});

test("policy identity, model, rates and budget are pinned across reopen", async (t) => {
  for (const change of [
    { authorizationId: "authorization.changed" },
    { modelId: "model.changed" },
    { budgetUsd: 0.2 },
    { inputUsdPerMillionTokens: 5 },
    { maxRequests: 11 },
  ]) {
    const file = await fixture(t);
    await finish(file);
    const before = await readFile(file, "utf8");
    await assert.rejects(openMetaBudgetLedger(file, { ...policy, ...change }), {
      code: "LEDGER_INVALID",
    });
    assert.equal(await readFile(file, "utf8"), before);
  }
});

test("invalid settlement does not clear the durable pending reserve", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  t.after(() => ledger.close());
  await ledger.begin("request.one", fingerprint());
  await ledger.reserve("request.one", "attempt.one", 0.01);
  await assert.rejects(
    ledger.settleAttempt("request.one", "attempt.one", {
      ...completed,
      usage: { promptTokens: -1, completionTokens: 1 },
    }),
    { code: "INVALID_SETTLEMENT" },
  );
  assert.equal(ledger.snapshot().reservedUsd, 0.01);
  await assert.rejects(ledger.complete("request.one", response), { code: "ATTEMPT_NOT_COMPLETED" });
});

test("request count, response bytes and fractional reservations are bounded", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, { ...policy, maxRequests: 1 });
  t.after(() => ledger.close());
  await ledger.begin("request.one", fingerprint());
  await ledger.reserve("request.one", "attempt.one", 0.0000000001);
  assert.equal(ledger.snapshot().reservedUsd, 0.000000001);
  await ledger.settleAttempt("request.one", "attempt.one", completed);
  await assert.rejects(ledger.complete("request.one", { choices: ["x".repeat(256 * 1024)] }), {
    code: "INVALID_RESPONSE",
  });
  await ledger.complete("request.one", response);
  await assert.rejects(ledger.begin("request.two", fingerprint("second")), {
    code: "REQUEST_LIMIT_REACHED",
  });
});

test("wrong model, absent response identity and non-success HTTP never become completed accounting", async (t) => {
  for (const invalid of [
    { modelId: "model.different" },
    { responseId: null },
    { httpStatus: 503 },
  ]) {
    const file = await fixture(t);
    const ledger = await openMetaBudgetLedger(file, policy);
    await ledger.begin("request.one", fingerprint());
    await ledger.reserve("request.one", "attempt.one", 0.01);
    await ledger.settleAttempt("request.one", "attempt.one", { ...completed, ...invalid });
    await assert.rejects(ledger.complete("request.one", response), {
      code: "ATTEMPT_NOT_COMPLETED",
    });
    await ledger.fail("request.one", "PROVIDER_METADATA_INVALID");
    assert.equal(ledger.snapshot().reservedUsd, 0.01);
    assert.equal(ledger.snapshot().blockedReason, "REQUEST_OUTCOME_UNCONFIRMED");
    await ledger.close();
  }
});

test("cached response identity must match the already settled HTTP response", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  t.after(() => ledger.close());
  await ledger.begin("request.one", fingerprint());
  await ledger.reserve("request.one", "attempt.one", 0.01);
  await ledger.settleAttempt("request.one", "attempt.one", completed);
  await assert.rejects(ledger.complete("request.one", { ...response, id: "response.swapped" }), {
    code: "RESPONSE_IDENTITY_MISMATCH",
  });
  await ledger.complete("request.one", response);
});

test("malformed or oversized ledgers are rejected without overwriting their bytes", async (t) => {
  for (const input of [
    "{broken",
    JSON.stringify({ schemaVersion: "1.0.0" }),
    "x".repeat(4 * 1024 * 1024 + 1),
  ]) {
    const file = await fixture(t);
    await writeFile(file, input);
    await assert.rejects(openMetaBudgetLedger(file, policy));
    assert.equal(await readFile(file, "utf8"), input);
  }
});

test("symlink ledgers cannot redirect accounting to another file", async (t) => {
  const file = await fixture(t),
    target = file + ".target";
  await writeFile(target, "untouched");
  try {
    await symlink(target, file, "file");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes((error as NodeJS.ErrnoException).code ?? "")) {
      t.skip("Host does not permit creating symlink fixtures");
      return;
    }
    throw error;
  }
  await assert.rejects(openMetaBudgetLedger(file, policy), { code: "LEDGER_INVALID" });
  assert.equal(await readFile(target, "utf8"), "untouched");
});

test("closed handles cannot dispatch and external reserve rollback is detected", async (t) => {
  const file = await fixture(t);
  const ledger = await openMetaBudgetLedger(file, policy);
  const initial = await readFile(file, "utf8");
  await ledger.begin("request.one", fingerprint());
  await ledger.reserve("request.one", "attempt.one", 0.02);
  await writeFile(file, initial);
  await assert.rejects(ledger.fail("request.one", "CANCELED"), { code: "LEDGER_CHANGED" });
  await ledger.close();
  await assert.rejects(ledger.begin("request.two", fingerprint()), { code: "LEDGER_CLOSED" });
});
