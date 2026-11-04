/** The caller's step records its original deadline/error and must not erase it. */
export async function closeOwnedBrowserServer({
  browserServer,
  observedExit,
  step,
  closeBudgetMs = 1500,
}) {
  if (!browserServer) return;
  if (
    typeof browserServer.close !== "function" ||
    typeof browserServer.kill !== "function" ||
    typeof observedExit !== "function" ||
    typeof step !== "function" ||
    !Number.isSafeInteger(closeBudgetMs) ||
    closeBudgetMs < 1 ||
    closeBudgetMs > 1500
  )
    throw new Error("OWNED_BROWSER_CLOSE_OPTIONS");
  // A connected Browser.close() only disconnects the client. The BrowserServer
  // owns the process and profile, so graceful close must target this handle.
  await step("owned-browser-server-close", closeBudgetMs, () => browserServer.close());
  if (observedExit() === false)
    await step("owned-browser-server-kill", 2000, () => browserServer.kill());
}

/**
 * Waits only for work already issued by the owning runner. Call directly, outside
 * the runner's bounded()/step(): adding this drain to the Map would await itself.
 * This never extends the initial remaining budget or treats timeout as settlement.
 */
export async function drainOwnedPendingActions(pendingActions, { remainingMs, exclude = [] } = {}) {
  if (!(pendingActions instanceof Map) || typeof remainingMs !== "function")
    throw new Error("OWNED_PENDING_ACTIONS_OPTIONS");
  const excluded = new Set(exclude);
  const initialRemaining = remainingMs();
  if (!Number.isFinite(initialRemaining)) throw new Error("OWNED_PENDING_ACTIONS_BUDGET");
  const budgetMs = Math.max(0, Math.floor(initialRemaining));
  const began = performance.now();
  const deadline = began + budgetMs;
  const observed = new Map();
  let rounds = 0;
  let settledCount = 0;
  const eligibleEntries = () => [...pendingActions].filter(([promise]) => !excluded.has(promise));
  function result(status) {
    const entries = eligibleEntries();
    return {
      status,
      budgetMs,
      elapsedMs: performance.now() - began,
      rounds,
      settledCount,
      pendingActionCount: entries.length,
      pendingActions: entries.map(([, row]) => row),
      excludedActionCount: [...pendingActions.keys()].filter((promise) => excluded.has(promise))
        .length,
    };
  }
  while (true) {
    const entries = eligibleEntries();
    if (!entries.length) return result(performance.now() <= deadline ? "settled" : "deadline");
    const remaining = remainingMs();
    if (!Number.isFinite(remaining)) throw new Error("OWNED_PENDING_ACTIONS_BUDGET");
    const waitMs = Math.floor(Math.min(deadline - performance.now(), remaining));
    if (waitMs < 1) return result("deadline");
    rounds++;
    for (const [promise, row] of entries) {
      if (observed.has(promise)) continue;
      if (!promise || typeof promise.then !== "function")
        throw new Error("OWNED_PENDING_ACTION_NOT_PROMISE");
      const observation = { settled: false, done: null };
      const onSettled = () => {
        observation.settled = true;
        settledCount++;
        // A late completion cannot delete a newer generation of tracking data.
        if (pendingActions.get(promise) === row) pendingActions.delete(promise);
      };
      observation.done = Promise.resolve(promise).then(onSettled, onSettled);
      observed.set(promise, observation);
    }
    const waiting = entries
      .map(([promise]) => observed.get(promise))
      .filter((observation) => !observation.settled)
      .map((observation) => observation.done);
    let timer;
    const completed = await Promise.race([
      ...(waiting.length ? [Promise.all(waiting).then(() => true)] : []),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), waitMs);
      }),
    ]).finally(() => clearTimeout(timer));
    if (!completed || performance.now() >= deadline) return result("deadline");
    // A settled batch may have issued more owned work; inspect the Map again.
  }
}
