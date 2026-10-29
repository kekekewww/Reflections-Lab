import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { openMetaLiveBudget } from "../../server/meta-live-budget.js";

// Persistent accounting tests use temporary, secret-free fixtures only.
async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "reflection-meta-budget-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  return join(directory, "ledger.json");
}
const summary = { modelId: "muse-spark-1.3" as const, maxCompletionTokens: 1000 };
const known = {
  httpStatus: 200,
  responseId: "response.synthetic-budget",
  modelId: "muse-spark-1.3",
  usage: { promptTokens: 1000, completionTokens: 100, cachedInputTokens: 500, reasoningTokens: 50 },
  status: "completed" as const,
};

test("three fixed reservations survive reopen without refunds and a fourth request is refused", async (t) => {
  const file = await fixture(t);
  for (let i = 0; i < 3; i++) {
    const ledger = await openMetaLiveBudget(file);
    try {
      const id = await ledger.reserve(`phase-${i}`, summary);
      const durable = JSON.parse(await readFile(file, "utf8"));
      assert.equal(durable.attempts.at(-1).status, "reserved");
      await ledger.settle(id, known);
      const snapshot = ledger.snapshot();
      assert.equal(snapshot.reservedUsd, (i + 1) * 0.25);
      assert.equal(snapshot.attempts.at(-1)?.estimatedCostUsd, 0.001675);
      assert.equal(snapshot.actualBillingCostUsd, null);
      assert.equal(snapshot.remainingCreditUsd, null);
    } finally {
      await ledger.close();
    }
  }
  const exhausted = await openMetaLiveBudget(file);
  try {
    assert.equal(exhausted.snapshot().reservedUsd, 0.75);
    assert.equal(exhausted.snapshot().unreservedAuthorizedUsd, 0.25);
    await assert.rejects(exhausted.reserve("fourth", summary), { code: "REQUEST_LIMIT_REACHED" });
  } finally {
    await exhausted.close();
  }
});

test("an unresolved reservation survives restart and cannot be erased or dispatched around", async (t) => {
  const file = await fixture(t);
  const first = await openMetaLiveBudget(file);
  const id = await first.reserve("pending", summary);
  await first.close();
  const reopened = await openMetaLiveBudget(file);
  try {
    assert.equal(reopened.snapshot().attempts[0]?.attemptId, id);
    await assert.rejects(reopened.reserve("retry", summary), { code: "PENDING_ATTEMPT" });
    await assert.rejects(reopened.settle(id, known), { code: "RESULT_UNKNOWN" });
  } finally {
    await reopened.close();
  }
});

test("unknown usage and unknown outcomes block later dispatch durably", async (t) => {
  for (const [outcome, expected] of [
    [{ ...known, usage: null }, "UNKNOWN_USAGE"],
    [{ ...known, status: "unknown" as const }, "UNKNOWN_OUTCOME"],
    [
      {
        ...known,
        responseId: null,
        modelId: null,
        httpStatus: null,
        usage: null,
        status: "unknown" as const,
      },
      "MISSING_RESPONSE_METADATA",
    ],
  ] as const) {
    const file = await fixture(t);
    const ledger = await openMetaLiveBudget(file);
    const id = await ledger.reserve("unknown", summary);
    await assert.rejects(ledger.settle(id, outcome), { code: expected });
    assert.equal(ledger.snapshot().reservedUsd, 0.25);
    await ledger.close();
    const reopened = await openMetaLiveBudget(file);
    try {
      await assert.rejects(reopened.reserve("next", summary), { code: expected });
    } finally {
      await reopened.close();
    }
  }
});

test("wrong response models never receive Spark pricing and prevent further paid requests", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  try {
    const id = await ledger.reserve("wrong-model", summary);
    await assert.rejects(ledger.settle(id, { ...known, modelId: "muse-wonder-1.0" }), {
      code: "MODEL_MISMATCH",
    });
    assert.equal(ledger.snapshot().attempts[0]?.estimatedCostUsd, null);
    await assert.rejects(ledger.reserve("repair", summary), { code: "MODEL_MISMATCH" });
  } finally {
    await ledger.close();
  }
});

test("invalid token usage and costs above the fixed reservation are recorded then stop the ledger", async (t) => {
  for (const input of [
    { promptTokens: -1, completionTokens: 1 },
    { promptTokens: 1.5, completionTokens: 1 },
    { promptTokens: 1, completionTokens: 1001 },
    { promptTokens: 1, completionTokens: 1, cachedInputTokens: 2 },
    { promptTokens: 1, completionTokens: 1, reasoningTokens: 2 },
    { promptTokens: Infinity, completionTokens: 1 },
    { promptTokens: NaN, completionTokens: 1 },
  ]) {
    const file = await fixture(t),
      ledger = await openMetaLiveBudget(file);
    const id = await ledger.reserve("invalid-usage", summary);
    await assert.rejects(ledger.settle(id, { ...known, usage: input }));
    assert.notEqual(ledger.snapshot().blockedReason, null);
    await ledger.close();
    const reopened = await openMetaLiveBudget(file);
    try {
      await assert.rejects(reopened.reserve("next", summary));
    } finally {
      await reopened.close();
    }
  }
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  try {
    const id = await ledger.reserve("oversize", summary);
    await assert.rejects(
      ledger.settle(id, { ...known, usage: { promptTokens: 200000, completionTokens: 100 } }),
      { code: "COST_RESERVE_EXCEEDED" },
    );
    assert.equal(ledger.snapshot().attempts[0]?.estimatedCostUsd, 0.250425);
    await assert.rejects(ledger.reserve("next", summary), { code: "COST_RESERVE_EXCEEDED" });
  } finally {
    await ledger.close();
  }
});

test("request summaries reject key material, raw prompts and policy changes before persistence", async (t) => {
  const secret = "LLM_123_fake_secret_for_test_only";
  for (const [phase, request] of [
    ["scene", { ...summary, apiKey: secret }],
    ["scene", { ...summary, prompt: "private raw prompt" }],
    ["scene", { ...summary, headers: { Authorization: secret } }],
    ["scene", { ...summary, modelId: "muse-wonder-1.0" }],
    ["scene", { ...summary, maxCompletionTokens: 1001 }],
    [secret, summary],
    ["scene", { ...summary, toolNames: [secret] }],
  ] as const) {
    const file = await fixture(t),
      ledger = await openMetaLiveBudget(file);
    try {
      await assert.rejects(ledger.reserve(phase, request as never), {
        code: "REQUEST_SUMMARY_INVALID",
      });
      assert.equal(ledger.snapshot().attempts.length, 0);
      assert.equal((await readFile(file, "utf8")).includes(secret), false);
    } finally {
      await ledger.close();
    }
  }
});

test("exclusive and stale locks are never silently deleted", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  const lockBefore = await readFile(file + ".lock", "utf8");
  await assert.rejects(openMetaLiveBudget(file), { code: "LEDGER_LOCKED" });
  assert.equal(await readFile(file + ".lock", "utf8"), lockBefore);
  await ledger.close();
  await writeFile(file + ".lock", "stale fixture lock", "utf8");
  await assert.rejects(openMetaLiveBudget(file), { code: "LEDGER_LOCKED" });
  assert.equal(await readFile(file + ".lock", "utf8"), "stale fixture lock");
});

test("close refuses to remove a lock whose ownership was replaced", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  await writeFile(file + ".lock", "foreign fixture lock", "utf8");
  await assert.rejects(ledger.close(), { code: "LOCK_OWNERSHIP_LOST" });
  assert.equal(await readFile(file + ".lock", "utf8"), "foreign fixture lock");
});

test("existing corruption, changed policy and duplicate attempts fail without resetting their bytes", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  const id = await ledger.reserve("baseline", summary);
  await ledger.settle(id, known);
  await ledger.close();
  const baseline = JSON.parse(await readFile(file, "utf8"));
  const changedPolicy = structuredClone(baseline);
  changedPolicy.policy.budgetUsd = 2;
  const duplicate = structuredClone(baseline);
  duplicate.attempts.push(structuredClone(duplicate.attempts[0]));
  const missingHttp = structuredClone(baseline);
  missingHttp.attempts[0].httpStatus = null;
  const failedHttp = structuredClone(baseline);
  failedHttp.attempts[0].httpStatus = 500;
  for (const invalid of [
    "{incomplete",
    JSON.stringify(changedPolicy),
    JSON.stringify(duplicate),
    JSON.stringify(missingHttp),
    JSON.stringify(failedHttp),
  ]) {
    await writeFile(file, invalid, "utf8");
    await assert.rejects(openMetaLiveBudget(file), { code: "LEDGER_INVALID" });
    assert.equal(await readFile(file, "utf8"), invalid);
  }
});

test("secret-shaped settlement metadata is rejected without persisting it in artifacts or snapshots", async (t) => {
  for (const field of ["responseId", "modelId"] as const) {
    const file = await fixture(t),
      ledger = await openMetaLiveBudget(file);
    const secret = "llm_not_numeric_fake_secret";
    try {
      const id = await ledger.reserve("metadata", summary);
      await assert.rejects(ledger.settle(id, { ...known, [field]: secret }), {
        code: "INVALID_SETTLEMENT",
      });
      assert.equal(JSON.stringify(ledger.snapshot()).includes(secret), false);
      assert.equal((await readFile(file, "utf8")).includes(secret), false);
    } finally {
      await ledger.close();
    }
  }
});

test("foreign ledger edits poison the instance and are preserved unchanged", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  try {
    const foreign = "foreign bytes must not be overwritten";
    await writeFile(file, foreign, "utf8");
    await assert.rejects(ledger.reserve("scene", summary), { code: "LEDGER_CHANGED" });
    await assert.rejects(ledger.reserve("scene", summary), { code: "LEDGER_IO_UNCERTAIN" });
    assert.equal(await readFile(file, "utf8"), foreign);
  } finally {
    await ledger.close();
  }
});

test("concurrent reservations serialize and close drains an already accepted settlement", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  const attempts = await Promise.allSettled([
    ledger.reserve("first", summary),
    ledger.reserve("second", summary),
  ]);
  assert.equal(attempts.filter((entry) => entry.status === "fulfilled").length, 1);
  const id = (
    attempts.find((entry) => entry.status === "fulfilled") as PromiseFulfilledResult<string>
  ).value;
  const settlement = ledger.settle(id, known);
  const closing = ledger.close();
  await settlement;
  await closing;
  const reopened = await openMetaLiveBudget(file);
  try {
    assert.equal(reopened.snapshot().attempts[0]?.status, "completed");
  } finally {
    await reopened.close();
  }
});

test("known failed transport usage consumes its reservation and snapshots cannot modify the ledger", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  try {
    const id = await ledger.reserve("known-failure", summary);
    await ledger.settle(id, { ...known, status: "failed", httpStatus: 503 });
    const copy = ledger.snapshot();
    copy.attempts.length = 0;
    assert.equal(ledger.snapshot().attempts.length, 1);
    await assert.rejects(ledger.settle(id, known), { code: "SETTLEMENT_ALREADY_RECORDED" });
    const second = await ledger.reserve("repair", summary);
    assert.notEqual(second, id);
    assert.equal(ledger.snapshot().reservedUsd, 0.5);
  } finally {
    await ledger.close();
  }
});

const rejection400 = {
  httpStatus: 400,
  responseId: null,
  modelId: null,
  usage: null,
  status: "failed" as const,
};
const reviewReason =
  "Root reviewed the HTTP 400 request rejection; original unknown billing and reservation remain.";
const authorization = "ROOT-20261027-HTTP400-ENGINEERING-REPAIR";

test("explicit HTTP400 review migrates an old ledger without changing the original attempt or reserved quarter", async (t) => {
  const file = await fixture(t);
  const original = await openMetaLiveBudget(file);
  const id = await original.reserve("sound", summary);
  await assert.rejects(original.settle(id, rejection400), { code: "HTTP_400_REQUEST_REJECTED" });
  await original.close();
  const legacy = JSON.parse(await readFile(file, "utf8"));
  delete legacy.reconciliations;
  legacy.attempts[0].validationError = "MISSING_RESPONSE_METADATA";
  const legacyBytes = JSON.stringify(legacy, null, 2) + "\n";
  await writeFile(file, legacyBytes, "utf8");
  const reopened = await openMetaLiveBudget(file);
  assert.equal(
    await readFile(file, "utf8"),
    legacyBytes,
    "opening alone must never rewrite the old artifact",
  );
  assert.deepEqual(reopened.snapshot().reconciliations, []);
  await reopened.reconcileHttp400(id, reviewReason, authorization);
  const reviewed = reopened.snapshot();
  assert.deepEqual(reviewed.attempts, legacy.attempts);
  assert.equal(reviewed.reservedUsd, 0.25);
  assert.equal(reviewed.remainingRequestSlots, 2);
  assert.equal(reviewed.actualBillingCostUsd, null);
  assert.equal(reviewed.remainingCreditUsd, null);
  assert.equal(reviewed.blockedReason, null);
  assert.equal(reviewed.reconciliations[0]?.attemptId, id);
  assert.equal(reviewed.reconciliations[0]?.kind, "HTTP_400_REQUEST_REJECTION");
  await reopened.close();
  const final = await openMetaLiveBudget(file);
  try {
    for (const phase of ["repair-sound", "repair-scene"]) {
      const attempt = await final.reserve(phase, summary);
      await final.settle(attempt, known);
    }
    assert.equal(final.snapshot().reservedUsd, 0.75);
    assert.deepEqual(final.snapshot().attempts[0], legacy.attempts[0]);
    await assert.rejects(final.reserve("fourth", summary), { code: "REQUEST_LIMIT_REACHED" });
  } finally {
    await final.close();
  }
});

test("HTTP400 acknowledgement never clears network unknowns, other HTTP failures, or known metadata", async (t) => {
  for (const result of [
    { ...rejection400, httpStatus: null, status: "unknown" as const },
    { ...rejection400, status: "unknown" as const },
    { ...rejection400, httpStatus: 401 },
    { ...rejection400, httpStatus: 403 },
    { ...rejection400, httpStatus: 429 },
    { ...rejection400, modelId: "muse-spark-1.3" },
    { ...rejection400, usage: known.usage },
  ]) {
    const file = await fixture(t),
      ledger = await openMetaLiveBudget(file);
    try {
      const id = await ledger.reserve("failure", summary);
      await assert.rejects(ledger.settle(id, result));
      const before = ledger.snapshot();
      await assert.rejects(ledger.reconcileHttp400(id, reviewReason, authorization), {
        code: "HTTP400_RECONCILIATION_DENIED",
      });
      assert.deepEqual(ledger.snapshot(), before);
      await assert.rejects(ledger.reserve("next", summary));
    } finally {
      await ledger.close();
    }
  }
});

test("every new HTTP400 blocks independently and review cannot exceed the three paid request cap", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  try {
    const first = await ledger.reserve("first", summary);
    await assert.rejects(ledger.settle(first, rejection400));
    await ledger.reconcileHttp400(first, reviewReason, authorization);
    await assert.rejects(ledger.reconcileHttp400(first, reviewReason, authorization), {
      code: "RECONCILIATION_ALREADY_RECORDED",
    });
    const second = await ledger.reserve("second", summary);
    await assert.rejects(ledger.settle(second, rejection400));
    await assert.rejects(ledger.reserve("blocked-again", summary), {
      code: "HTTP_400_REQUEST_REJECTED",
    });
    await ledger.reconcileHttp400(second, reviewReason, authorization + "-SECOND");
    const third = await ledger.reserve("third", summary);
    await assert.rejects(ledger.settle(third, rejection400));
    await assert.rejects(ledger.reconcileHttp400(third, reviewReason, authorization + "-THIRD"), {
      code: "REQUEST_LIMIT_REACHED",
    });
    assert.equal(ledger.snapshot().attempts.length, 3);
    assert.equal(ledger.snapshot().reservedUsd, 0.75);
    assert.equal(ledger.snapshot().reconciliations.length, 2);
  } finally {
    await ledger.close();
  }
});

test("review metadata is bounded, credential-free, and tied to an eligible unchanged attempt on reopen", async (t) => {
  const file = await fixture(t),
    ledger = await openMetaLiveBudget(file);
  const id = await ledger.reserve("sound", summary);
  await assert.rejects(ledger.settle(id, rejection400));
  for (const [reason, ref] of [
    ["", authorization],
    ["x".repeat(513), authorization],
    ["LLM_not_numeric_secret", authorization],
    [reviewReason, "LLM_fake_secret"],
    ["authorization: Bearer hidden", authorization],
  ])
    await assert.rejects(ledger.reconcileHttp400(id, reason!, ref!), {
      code: "RECONCILIATION_METADATA_INVALID",
    });
  assert.equal(ledger.snapshot().reconciliations.length, 0);
  await ledger.reconcileHttp400(id, reviewReason, authorization);
  await ledger.close();
  const raw = JSON.parse(await readFile(file, "utf8"));
  const changed = structuredClone(raw);
  changed.attempts[0].httpStatus = 401;
  await writeFile(file, JSON.stringify(changed), "utf8");
  await assert.rejects(openMetaLiveBudget(file), { code: "LEDGER_INVALID" });
  assert.equal(await readFile(file, "utf8"), JSON.stringify(changed));
});
