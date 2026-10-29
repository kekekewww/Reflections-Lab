import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

/** Pure ownership checks. This module never starts a browser or sends input. */
export function ownedActivationBinding(tabs, expectedURL, expectedTitle) {
  const url = new URL(expectedURL);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/");
  assert.equal(url.username + url.password + url.search + url.hash, "");
  assert.equal(typeof expectedTitle, "string");
  assert.ok(expectedTitle.startsWith("Reflection Lab Native Reachability "));
  assert.equal(tabs.length, 1, "Require exactly one owned localhost task tab");
  const tab = tabs[0];
  assert.equal(tab.url, url.href, "Owned tab URL changed");
  assert.equal(tab.title, expectedTitle, "Owned tab title changed");
  assert.ok(Number.isSafeInteger(tab.id) && tab.id > 0, "Require an explicit owned tab ID");
  assert.ok(
    Number.isSafeInteger(tab.windowId) && tab.windowId > 0,
    "Require an explicit owned window ID",
  );
  return { tabId: tab.id, windowId: tab.windowId, url: url.href, title: expectedTitle };
}

function assertSameOwnedTarget(binding, sample) {
  assert.equal(sample.tab.id, binding.tabId, "Owned tab ID changed");
  assert.equal(sample.tab.windowId, binding.windowId, "Owned tab moved to another window");
  assert.equal(sample.tab.url, binding.url, "Owned tab URL changed");
  assert.equal(sample.tab.title, binding.title, "Owned tab title changed");
  assert.equal(sample.window.id, binding.windowId, "Owned window ID changed");
  assert.equal(sample.document.url, binding.url, "Observed document URL changed");
  assert.equal(sample.document.title, binding.title, "Observed document title changed");
}

/** Self-contained for serialization into the isolated extension worker. */
export async function activateOwnedWindow(
  { binding: owned, expiresAt },
  api = globalThis.chrome,
  now = Date.now,
) {
  const checkDeadline = () => {
    if (!Number.isFinite(expiresAt) || now() >= expiresAt)
      throw new Error("Owned window activation deadline expired; no further mutation permitted");
  };
  checkDeadline();
  const tab = await api.tabs.get(owned.tabId);
  if (
    tab.id !== owned.tabId ||
    tab.windowId !== owned.windowId ||
    tab.url !== owned.url ||
    tab.title !== owned.title
  )
    throw new Error("Owned task tab binding changed before window activation");
  checkDeadline();
  const before = await api.windows.get(owned.windowId);
  if (before.id !== owned.windowId) throw new Error("Owned window binding changed");
  checkDeadline();
  const updated = await api.windows.update(owned.windowId, { focused: true, state: "normal" });
  checkDeadline();
  await api.tabs.update(owned.tabId, { active: true });
  return {
    tabId: owned.tabId,
    windowId: updated.id,
    focused: updated.focused,
    state: updated.state,
  };
}

export function activationIsReady(binding, sample) {
  assertSameOwnedTarget(binding, sample);
  return (
    sample.tab.active === true &&
    sample.window.focused === true &&
    sample.window.state === "normal" &&
    sample.document.visibilityState === "visible" &&
    sample.document.hidden === false &&
    sample.document.hasFocus === true
  );
}

/** A bounded real-observation gate; injected adapters in unit tests are Mock only. */
export async function requireNativeActivation({
  binding,
  stage,
  activate,
  read,
  timeoutMs = 8000,
  intervalMs = 100,
  now = Date.now,
  sleep = delay,
}) {
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 8000);
  assert.ok(Number.isFinite(intervalMs) && intervalMs > 0);
  const started = now();
  const evidence = {
    stage,
    status: "IN_PROGRESS",
    method: activate ? "ChromeWindowsUpdateAndTabsUpdate" : "ReadOnlyActualVisibilityGate",
    binding,
    timeoutMs,
    activationAttempts: 0,
    samples: [],
    deadlineEpochMs: started + timeoutMs,
  };
  const pendingTimers = new Set();
  const bounded = async (operation) => {
    const remaining = timeoutMs - (now() - started);
    assert.ok(remaining > 0, "Native window activation preflight exceeded its time budget");
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Native window activation preflight timed out")),
            remaining,
          );
          pendingTimers.add(timer);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      pendingTimers.delete(timer);
    }
  };
  try {
    if (activate) {
      evidence.activationAttempts = 1;
      evidence.activationResult = await bounded(() => activate(binding, evidence.deadlineEpochMs));
    }
    for (let attempt = 0; attempt < 81; attempt++) {
      const sample = await bounded(read);
      evidence.samples.push({ elapsedMs: now() - started, ...sample });
      if (activationIsReady(binding, sample)) {
        evidence.status = "PASS";
        evidence.elapsedMs = now() - started;
        return evidence;
      }
      await bounded(() => sleep(intervalMs));
    }
    throw new Error("Native window activation preflight exhausted its bounded sample budget");
  } catch (error) {
    evidence.status = "FAIL";
    evidence.failureCategory = "NATIVE_WINDOW_PREFLIGHT";
    evidence.elapsedMs = now() - started;
    evidence.error = error instanceof Error ? error.message : String(error);
    const failure = new Error(`Native window preflight ${stage} failed: ${evidence.error}`, {
      cause: error,
    });
    failure.activationEvidence = evidence;
    throw failure;
  } finally {
    for (const timer of pendingTimers) clearTimeout(timer);
  }
}
