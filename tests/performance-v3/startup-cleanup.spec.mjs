import test from "node:test";
import assert from "node:assert/strict";
import * as helper from "../browser/performance-owned-cleanup-v3.mjs";
const flatten = (error) => [error, ...(error?.errors ?? []).flatMap(flatten)];
test("owned startup failures at each stage close all acquired resources and preserve errors", async () => {
  assert.equal(typeof helper.runOwnedStartup, "function");
  for (const stage of ["context", "page", "version", "host", "report"]) {
    const primary = new Error(`primary-${stage}`),
      secondary = new Error(`close-${stage}`),
      calls = [];
    const resources = [
      {
        label: "context",
        close: async () => {
          calls.push("context");
        },
      },
      {
        label: "browser",
        close: async () => {
          calls.push("browser");
          throw secondary;
        },
      },
      {
        label: "preview",
        close: async () => {
          calls.push("preview");
        },
      },
    ];
    let caught;
    try {
      await helper.runOwnedStartup(
        async () => {
          for (const current of ["context", "page", "version", "host", "report"]) {
            if (current === stage) throw primary;
          }
        },
        resources,
        { operationMs: 5, budgetMs: 20 },
      );
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(calls, ["context", "browser", "preview"]);
    assert.ok(flatten(caught).includes(primary));
    assert.ok(flatten(caught).includes(secondary));
  }
});
test("never-settling startup cleanup is bounded and does not skip preview", async () => {
  assert.equal(typeof helper.runOwnedStartup, "function");
  const primary = new Error("host failure");
  let closed = false;
  await assert.rejects(
    helper.runOwnedStartup(
      () => {
        throw primary;
      },
      [
        { label: "browser", close: () => new Promise(() => {}) },
        {
          label: "preview",
          close: () => {
            closed = true;
          },
        },
      ],
      { operationMs: 5, budgetMs: 15 },
    ),
    (error) => flatten(error).includes(primary),
  );
  assert.equal(closed, true);
});
