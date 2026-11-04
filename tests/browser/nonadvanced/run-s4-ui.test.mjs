import assert from "node:assert/strict";
import test from "node:test";
import { shouldBlockS4Request } from "./s4-browser-guard.mjs";
import {
  parseArguments,
  laneRegistry,
  validateFreeze,
  resolveWithinWorkspace,
} from "./run-s4-ui.mjs";
const valid = () => ({
  schemaVersion: 1,
  baseURL: "http://127.0.0.1:4173",
  leaseId: "root-exclusive",
  serverMode: "offline-only",
  paidApiBudgetUsd: 0,
  sourceCommit: "a".repeat(40),
  htmlSha256: "1".repeat(64),
  browserExecutable: process.execPath,
  browserExecutableSha256: "b".repeat(64),
  browserVersion: "131.fixture",
  sourcePins: [{ path: "src/main.tsx", sha256: "c".repeat(64) }],
  entry: { path: "/assets/index-current.js", sha256: "d".repeat(64) },
  assets: [{ path: "/assets/index-current.css", sha256: "e".repeat(64) }],
});

test("S4 runner defaults to planning and requires explicit freeze, unique lanes, attempt and lease for execution", () => {
  assert.equal(parseArguments([]).execute, false);
  assert.equal(laneRegistry.length, 22);
  assert.equal(parseArguments(["--lanes", "all"]).selectedLanes.length, 22);
  assert.throws(() => parseArguments(["--execute"]), /attempt/);
  assert.throws(() => parseArguments(["--execute", "--attempt", "new-attempt"]), /freeze/);
  assert.throws(() => parseArguments(["--lanes", "recovery,recovery"]), /unique/);
  assert.throws(() => parseArguments(["--lanes", "unknown"]), /unique/);
  assert.throws(() => parseArguments(["--lane-timeout-ms", "0"]), /timeout/);
});

test("freeze validation fails closed for paid/API/baseURL/identity/path/asset conflicts", () => {
  assert.equal(validateFreeze(valid(), "root-exclusive").sourceCommit, "a".repeat(40));
  for (const change of [
    { paidApiBudgetUsd: 1 },
    { baseURL: "https://example.com" },
    { serverMode: "live" },
    { leaseId: "other" },
    { browserExecutableSha256: "bad" },
    { sourceCommit: "bad" },
    { sourcePins: [{ path: "../outside", sha256: "c".repeat(64) }] },
    { sourcePins: [{ path: ".env", sha256: "c".repeat(64) }] },
  ])
    assert.throws(() => validateFreeze({ ...valid(), ...change }, "root-exclusive"));
  assert.throws(
    () =>
      validateFreeze(
        { ...valid(), assets: [{ path: "/assets/index-current.js", sha256: "f".repeat(64) }] },
        "root-exclusive",
      ),
    /Conflicting/,
  );
});

test("the S4 network guard allows local reads and blocks external origins and model writes", () => {
  assert.equal(shouldBlockS4Request("http://127.0.0.1:4173/assets/index.js"), false);
  assert.equal(shouldBlockS4Request("http://127.0.0.1:4173/api/agent/provider", "GET"), false);
  assert.equal(shouldBlockS4Request("http://127.0.0.1:4173/api/agent/propose", "POST"), true);
  assert.equal(shouldBlockS4Request("https://example.com/script.js"), true);
});

test("artifact paths reject Windows cross-drive absolute paths as well as parent traversal", async () => {
  const { win32 } = await import("node:path");
  assert.equal(
    resolveWithinWorkspace("D:\\assigned\\ui", "docs/receipt.json", win32),
    "D:\\assigned\\ui\\docs\\receipt.json",
  );
  assert.throws(
    () => resolveWithinWorkspace("D:\\assigned\\ui", "C:\\outside\\receipt.json", win32),
    /inside/,
  );
  assert.throws(() => resolveWithinWorkspace("D:\\assigned\\ui", "..\\other", win32), /inside/);
});

test("freeze capture is explicit and cannot also execute lanes", () => {
  assert.throws(() => parseArguments(["--capture-freeze"]), /identity/);
  const args = [
    "--capture-freeze",
    "--freeze",
    "docs/freeze.json",
    "--lease",
    "root",
    "--browser-executable",
    process.execPath,
    "--browser-version",
    "fixture.1",
  ];
  assert.equal(parseArguments(args).captureFreeze, true);
  assert.equal(parseArguments(args).execute, false);
  assert.throws(() => parseArguments([...args, "--execute"]), /separate/);
});
