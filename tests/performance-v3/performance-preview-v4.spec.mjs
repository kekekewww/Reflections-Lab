// Owned preview readiness: no native browser or build is started by these tests.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
const url = new URL("../browser/performance-profile-v4.mjs", import.meta.url);
const profile = existsSync(url) ? await import(url.href) : {};
const expectedURL = "http://127.0.0.1:5194/";
const alive = () => ({ exitCode: null, signalCode: null });

test("V4 exposes a separately testable owned preview readiness predicate", () => {
  assert.equal(typeof profile.isOwnedPreviewReadyV4, "function");
});
test("only the expected ready URL from a still-live owned child is ready", () => {
  if (typeof profile.isOwnedPreviewReadyV4 !== "function") return;
  assert.equal(
    profile.isOwnedPreviewReadyV4(alive(), `Local: ${expectedURL}\n`, expectedURL),
    true,
  );
});
for (const [name, child, log] of [
  ["EADDRINUSE containing the port", alive(), "Error: Port5194 is already in use"],
  ["another host on the same port", alive(), "Local: http://localhost:5194/"],
  ["a port with the same numeric prefix", alive(), "Local: http://127.0.0.1:51940/"],
  ["already exited owned child", { exitCode: 1, signalCode: null }, `Local: ${expectedURL}`],
  ["terminated owned child", { exitCode: null, signalCode: "SIGTERM" }, `Local: ${expectedURL}`],
  ["unknown exit state", { signalCode: null }, `Local: ${expectedURL}`],
  ["unknown signal state", { exitCode: null }, `Local: ${expectedURL}`],
]) {
  test(`V4 does not treat ${name} as a ready owned server`, () => {
    if (typeof profile.isOwnedPreviewReadyV4 !== "function") return;
    assert.equal(profile.isOwnedPreviewReadyV4(child, log, expectedURL), false);
  });
}

// Additional exact-readiness RED cases. A URL token in an alive process log is
// neither a success announcement nor proof that the owned root URL is served.
for (const [name, log] of [
  ["an error sentence merely contains the expected root URL", `Error: failed for ${expectedURL}`],
  ["a Local announcement points below the expected root URL", `Local: ${expectedURL}extra-path`],
]) {
  test(`additional V4 owned-preview rejection: ${name}`, () => {
    if (typeof profile.isOwnedPreviewReadyV4 !== "function") return;
    assert.equal(profile.isOwnedPreviewReadyV4(alive(), log, expectedURL), false);
  });
}
