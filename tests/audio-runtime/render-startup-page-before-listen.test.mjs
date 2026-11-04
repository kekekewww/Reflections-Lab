import assert from "node:assert/strict";
import test from "node:test";
import { acquireOwnedPageBeforeListen } from "../browser/nonadvanced/long-render/startup-page-before-listen.mjs";
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
const turn = () => new Promise((resolve) => setImmediate(resolve));

test(
  "startup ordering waits for an owned blank page, never listens after page failure, and retains partial owners for bounded truthful cleanup",
  { timeout: 1000 },
  async () => {
    const pageReady = deferred(),
      listening = deferred(),
      events = [];
    const ownedPage = { kind: "owned-blank-page" };
    let retainedPage;
    const preparing = acquireOwnedPageBeforeListen({
      acquirePage() {
        events.push("page-begin");
        return pageReady.promise;
      },
      retainPage(page) {
        retainedPage = page;
        events.push("page-retained");
      },
      listen() {
        assert.equal(retainedPage, ownedPage);
        events.push("listen-begin");
        return listening.promise;
      },
    });
    await turn();
    assert.deepEqual(
      events,
      ["page-begin"],
      "cold optimizer listen cannot overlap the pending blank-page acquisition",
    );
    assert.equal(retainedPage, undefined);
    pageReady.resolve(ownedPage);
    await turn();
    assert.deepEqual(events, ["page-begin", "page-retained", "listen-begin"]);
    assert.equal(retainedPage, ownedPage);
    listening.resolve();
    assert.equal(await preparing, ownedPage);

    let failedRetentions = 0,
      failedListens = 0;
    const pageFailure = new Error("ORIGINAL_PAGE_DEADLINE");
    await assert.rejects(
      acquireOwnedPageBeforeListen({
        acquirePage: () => Promise.reject(pageFailure),
        retainPage() {
          failedRetentions++;
        },
        listen() {
          failedListens++;
        },
      }),
      (error) => error === pageFailure,
    );
    assert.equal(failedRetentions, 0);
    assert.equal(failedListens, 0, "a page failure must leave Vite unlistened");

    const listenFailure = new Error("ORIGINAL_LISTEN_DEADLINE");
    let partialPage;
    await assert.rejects(
      acquireOwnedPageBeforeListen({
        acquirePage: async () => ownedPage,
        retainPage(page) {
          partialPage = page;
        },
        listen: () => Promise.reject(listenFailure),
      }),
      (error) => error === listenFailure,
    );
    assert.equal(
      partialPage,
      ownedPage,
      "listen rejection cannot hide the page from outer cleanup",
    );

    const ownerClose = deferred(),
      pending = new Map(),
      steps = [];
    let exited = false;
    const server = {
      close: () => ownerClose.promise,
      async kill() {
        exited = true;
      },
    };
    await closeOwnedBrowserServer({
      browserServer: server,
      observedExit: () => exited,
      closeBudgetMs: 1000,
      async step(name, requestedBudgetMs, action) {
        const row = { name, requestedBudgetMs, status: "RUNNING", testWallBudgetMs: 5 };
        steps.push(row);
        const actual = Promise.resolve().then(action);
        pending.set(actual, row);
        void actual.catch(() => undefined);
        void actual.then(
          () => pending.delete(actual),
          () => pending.delete(actual),
        );
        let timer;
        try {
          await Promise.race([
            actual,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error("PURE_STEP_DEADLINE_5MS")), 5);
            }),
          ]);
          row.status = "settled";
        } catch (error) {
          row.status = "error";
          row.error = String(error);
        } finally {
          clearTimeout(timer);
        }
      },
    });
    assert.equal(exited, true);
    assert.deepEqual(
      steps.map(({ name, requestedBudgetMs }) => ({ name, requestedBudgetMs })),
      [
        { name: "owned-browser-server-close", requestedBudgetMs: 1000 },
        { name: "owned-browser-server-kill", requestedBudgetMs: 2000 },
      ],
    );
    assert.equal(steps[0].status, "error");
    assert.match(steps[0].error, /PURE_STEP_DEADLINE/);
    const began = performance.now();
    const firstDrain = await drainOwnedPendingActions(pending, {
      remainingMs: () => 15 - (performance.now() - began),
    });
    assert.equal(firstDrain.status, "deadline");
    assert.equal(pending.size, 1, "deadline is not actual cleanup settlement");
    assert.ok(
      performance.now() - began < 200,
      "partial cleanup must return under its finite test budget",
    );
    ownerClose.resolve();
    const settled = await drainOwnedPendingActions(pending, { remainingMs: () => 50 });
    assert.equal(settled.status, "settled");
    assert.equal(pending.size, 0);
    assert.equal(steps[0].status, "error", "late cleanup cannot erase the original timeout");
    assert.equal(listenFailure.message, "ORIGINAL_LISTEN_DEADLINE");

    let asynchronousRetentionListens = 0;
    await assert.rejects(
      acquireOwnedPageBeforeListen({
        acquirePage: async () => ownedPage,
        retainPage: () => Promise.resolve(),
        listen() {
          asynchronousRetentionListens++;
        },
      }),
      /STARTUP_PAGE_RETENTION_MUST_BE_SYNCHRONOUS/,
    );
    assert.equal(asynchronousRetentionListens, 0);
  },
);
