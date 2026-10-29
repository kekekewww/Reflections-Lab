import assert from "node:assert/strict";
import test from "node:test";
import {
  activateOwnedWindow,
  activationIsReady,
  ownedActivationBinding,
  requireNativeActivation,
} from "./native-accessibility-window-preflight.mjs";

const url = "http://127.0.0.1:5174/";
const title = "Reflection Lab Native Reachability Mock-only fixture";
const tab = { id: 3, windowId: 7, url, title, active: true };
const binding = ownedActivationBinding([tab], url, title);
const ready = () => ({
  tab: { ...tab },
  window: { id: 7, focused: true, state: "normal" },
  document: { url, title, hidden: false, visibilityState: "visible", hasFocus: true },
});

test("Mock-only worker rechecks its immutable deadline after ownership reads and before each mutation", async () => {
  for (const stalledStage of ["tab-read", "window-read", "window-update"]) {
    let elapsed = 0;
    const mutations = [];
    const api = {
      tabs: {
        get: async () => {
          if (stalledStage === "tab-read") elapsed = 20;
          return { ...tab };
        },
        update: async () => {
          mutations.push("tab-update");
        },
      },
      windows: {
        get: async () => {
          if (stalledStage === "window-read") elapsed = 20;
          return { id: 7 };
        },
        update: async () => {
          mutations.push("window-update");
          if (stalledStage === "window-update") elapsed = 20;
          return { id: 7, state: "normal", focused: true };
        },
      },
    };
    await assert.rejects(
      activateOwnedWindow({ binding, expiresAt: 20 }, api, () => elapsed),
      /deadline expired/,
    );
    assert.deepEqual(mutations, stalledStage === "window-update" ? ["window-update"] : []);
  }
});

test("Mock-only ownership rejects ambiguity, remote origins and invalid window IDs before activation", () => {
  assert.throws(() => ownedActivationBinding([tab, tab], url, title));
  assert.throws(() => ownedActivationBinding([{ ...tab, windowId: -1 }], url, title));
  assert.throws(() => ownedActivationBinding([tab], "https://example.com/", title));
  assert.throws(() => ownedActivationBinding([{ ...tab, url: url + "other" }], url, title));
});

test("Mock-only focused:true cannot substitute for actual visible document, active tab or focused normal window", () => {
  for (const patch of [
    { document: { ...ready().document, hidden: true } },
    { document: { ...ready().document, visibilityState: "hidden" } },
    { document: { ...ready().document, hasFocus: false } },
    { tab: { ...tab, active: false } },
    { window: { id: 7, focused: false, state: "normal" } },
    { window: { id: 7, focused: true, state: "minimized" } },
  ])
    assert.equal(activationIsReady(binding, { ...ready(), ...patch }), false);
});

test("Mock-only target identity changes fail instead of activating a different window", () => {
  assert.throws(() => activationIsReady(binding, { ...ready(), tab: { ...tab, windowId: 8 } }));
  assert.throws(() =>
    activationIsReady(binding, { ...ready(), window: { id: 8, focused: true, state: "normal" } }),
  );
  assert.throws(() =>
    activationIsReady(binding, { ...ready(), document: { ...ready().document, title: "other" } }),
  );
});

test("Mock-only one activation plus later read-only gates observes readiness before caller input", async () => {
  let activations = 0,
    reads = 0,
    elapsed = 0;
  const settings = {
    binding,
    stage: "before-baseline",
    timeoutMs: 80,
    intervalMs: 10,
    now: () => elapsed,
    sleep: async (ms) => {
      elapsed += ms;
    },
    read: async () =>
      ++reads === 1 ? { ...ready(), document: { ...ready().document, hidden: true } } : ready(),
  };
  const first = await requireNativeActivation({
    ...settings,
    activate: async () => {
      activations++;
      return { windowId: 7, tabId: 3 };
    },
  });
  const later = await requireNativeActivation({ ...settings, stage: "before-initial-tab" });
  assert.equal(activations, 1);
  assert.equal(first.status, "PASS");
  assert.equal(first.samples.length, 2);
  assert.equal(later.activationAttempts, 0);
});

test("Mock-only persistent hidden observation reaches bounded failure and caller sends zero input", async () => {
  let elapsed = 0,
    inputCount = 0,
    cleanupCount = 0;
  try {
    await assert.rejects(
      async () => {
        await requireNativeActivation({
          binding,
          stage: "before-initial-tab",
          timeoutMs: 20,
          intervalMs: 10,
          now: () => elapsed,
          sleep: async (ms) => {
            elapsed += ms;
          },
          read: async () => ({ ...ready(), document: { ...ready().document, hidden: true } }),
        });
        inputCount++;
      },
      (error) =>
        error.activationEvidence.failureCategory === "NATIVE_WINDOW_PREFLIGHT" &&
        error.activationEvidence.samples.length === 2,
    );
  } finally {
    cleanupCount++;
  }
  assert.equal(inputCount, 0);
  assert.equal(cleanupCount, 1);
});

test("Mock-only activation error and stalled observation are bounded failures without caller input", async () => {
  let inputs = 0;
  for (const adapters of [
    {
      activate: async () => {
        throw new Error("API unavailable");
      },
      read: async () => ready(),
    },
    { read: () => new Promise(() => {}) },
  ]) {
    await assert.rejects(
      async () => {
        await requireNativeActivation({
          binding,
          stage: "before-baseline",
          timeoutMs: 20,
          ...adapters,
        });
        inputs++;
      },
      (error) => error.activationEvidence.status === "FAIL",
    );
  }
  assert.equal(inputs, 0);
});
