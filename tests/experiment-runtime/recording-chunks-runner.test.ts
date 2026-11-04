import assert from "node:assert/strict";
import test from "node:test";

async function guard() {
  const module = await import("../browser/recording-chunks/server-identity.mjs").catch(() => null);
  assert.ok(
    module?.assertOwnedRecordingServer,
    "fixture runner checks this exact server generation",
  );
  return module.assertOwnedRecordingServer;
}
test("fixture source cannot be attributed to an old server with a different nonce", async () => {
  const check = await guard();
  const child = { pid: 1200, exitCode: null, signalCode: null };
  assert.throws(() => check("ab9a282a-9ba1-49e0-82f5-2cf6018bf0db", "old-server", child), {
    code: "RECORDING_SERVER_IDENTITY",
  });
});
test("matching response cannot authenticate an exited or unstarted child process", async () => {
  const check = await guard();
  const nonce = "ab9a282a-9ba1-49e0-82f5-2cf6018bf0db";
  assert.throws(() => check(nonce, nonce, { pid: 1200, exitCode: 0, signalCode: null }), {
    code: "RECORDING_SERVER_IDENTITY",
  });
  assert.throws(() => check(nonce, nonce, { pid: undefined, exitCode: null, signalCode: null }), {
    code: "RECORDING_SERVER_IDENTITY",
  });
  assert.doesNotThrow(() => check(nonce, nonce, { pid: 1200, exitCode: null, signalCode: null }));
});
