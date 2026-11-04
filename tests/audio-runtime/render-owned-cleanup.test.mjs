import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  closeOwnedBrowserServer,
  drainOwnedPendingActions,
} from "../browser/nonadvanced/long-render/owned-cleanup.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

test("graceful cleanup targets the owned BrowserServer and preserves its error before the original kill fallback", async () => {
  const calls = [],
    steps = [];
  let exited = false;
  const connection = {
    close: () => {
      calls.push("connection-disconnect");
    },
  };
  const server = {
    async close() {
      calls.push("owner-close");
      throw new Error("OWNER_CLOSE_DEADLINE");
    },
    async kill() {
      calls.push("owner-kill");
      exited = true;
    },
  };
  await closeOwnedBrowserServer({
    browserServer: server,
    browser: connection,
    closeBudgetMs: 1000,
    observedExit: () => exited,
    async step(name, budgetMs, action) {
      const row = { name, budgetMs, status: "RUNNING" };
      steps.push(row);
      try {
        await action();
        row.status = "settled";
      } catch (error) {
        row.status = "error";
        row.error = String(error);
      }
    },
  });
  assert.deepEqual(calls, ["owner-close", "owner-kill"]);
  assert.deepEqual(
    steps.map(({ name, budgetMs, status }) => ({ name, budgetMs, status })),
    [
      { name: "owned-browser-server-close", budgetMs: 1000, status: "error" },
      { name: "owned-browser-server-kill", budgetMs: 2000, status: "settled" },
    ],
  );
  assert.match(steps[0].error, /OWNER_CLOSE_DEADLINE/);
  assert.equal(
    steps.every((step) => step.status === "settled"),
    false,
    "successful fallback must not erase original ERROR",
  );
});

test("remaining cleanup drains the already timed-out action and its newly issued owned work without erasing the failed step", async () => {
  const first = deferred(),
    child = deferred();
  const row = { name: "owned-browser-server-kill", budgetMs: 2000 };
  const originalStep = { status: "RUNNING" };
  const pendingActions = new Map([[first.promise, row]]);
  try {
    await Promise.race([
      first.promise,
      delay(1).then(() => {
        throw new Error("ORIGINAL_KILL_DEADLINE");
      }),
    ]);
    assert.fail("the test-owned kill must reach its short wall deadline");
  } catch (error) {
    originalStep.status = "error";
    originalStep.error = String(error);
  }
  assert.match(originalStep.error, /ORIGINAL_KILL_DEADLINE/);
  first.promise.then(() => pendingActions.set(child.promise, { name: "owned-profile-cleanup" }));
  const began = performance.now();
  const draining = drainOwnedPendingActions(pendingActions, {
    remainingMs: () => 250 - (performance.now() - began),
  });
  await delay(5);
  assert.equal(
    pendingActions.get(first.promise),
    row,
    "a pending action cannot be removed before actual settlement",
  );
  first.resolve();
  await delay(5);
  assert.equal(pendingActions.size, 1, "newly issued child work remains pending");
  child.resolve();
  const result = await draining;
  assert.equal(result.status, "settled");
  assert.equal(result.pendingActionCount, 0);
  assert.equal(result.settledCount, 2);
  assert.equal(pendingActions.size, 0);
  assert.equal(originalStep.status, "error");
  assert.match(originalStep.error, /ORIGINAL_KILL_DEADLINE/);
});

test("the drain excludes its caller, times out truthfully, and cannot delete a replaced tracking row", async () => {
  const active = deferred(),
    excluded = deferred(),
    replaced = deferred();
  const oldRow = { name: "old-generation" },
    newRow = { name: "new-generation" };
  const pendingActions = new Map([
    [active.promise, { name: "never-settles" }],
    [excluded.promise, { name: "caller" }],
    [replaced.promise, oldRow],
  ]);
  const began = performance.now();
  const draining = drainOwnedPendingActions(pendingActions, {
    remainingMs: () => 25 - (performance.now() - began),
    exclude: [excluded.promise],
  });
  pendingActions.set(replaced.promise, newRow);
  replaced.resolve();
  const result = await draining;
  assert.equal(result.status, "deadline");
  assert.equal(result.excludedActionCount, 1);
  assert.equal(
    pendingActions.get(replaced.promise),
    newRow,
    "a settlement handler must not delete a newer tracking row",
  );
  assert.equal(pendingActions.has(active.promise), true, "timeout is not settlement");
  assert.equal(pendingActions.has(excluded.promise), true, "caller is outside drain ownership");
  assert.equal(result.pendingActionCount, 2);
  assert.ok(result.elapsedMs < 200, "a never-settling action must not strand the closure");
  active.resolve();
  excluded.resolve();
});
