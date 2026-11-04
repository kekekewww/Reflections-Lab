import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import * as profile from "../browser/performance-profile-v4.mjs";
import * as contract from "../browser/performance-profile-contract-v4.mjs";
import { readCurrentSemanticPinsV4 } from "../browser/run-performance-v4.mjs";

test("probe-on awaits Tracing.start resolution before before-CPU and beginUI", async () => {
  assert.equal(typeof profile.beginUIWithCpuEndpointV4, "function");
  const calls = [];
  let resolveStart;
  const pending = profile.beginUIWithCpuEndpointV4({
    probesEnabled: true,
    startTracing: async () => {
      calls.push("Tracing.start");
      await new Promise((resolve) => {
        resolveStart = resolve;
      });
      calls.push("Tracing.start resolved");
    },
    captureBefore: async () => {
      calls.push("before");
    },
    beginUI: async () => {
      calls.push("beginUI");
      return "environment";
    },
  });
  assert.deepEqual(calls, ["Tracing.start"]);
  resolveStart();
  assert.equal(await pending, "environment");
  assert.deepEqual(calls, ["Tracing.start", "Tracing.start resolved", "before", "beginUI"]);
});

test("probe-off keeps before-CPU then beginUI without tracing", async () => {
  assert.equal(typeof profile.beginUIWithCpuEndpointV4, "function");
  const calls = [];
  await profile.beginUIWithCpuEndpointV4({
    probesEnabled: false,
    startTracing: () => assert.fail("probe-off tracing"),
    captureBefore: async () => {
      calls.push("before");
    },
    beginUI: async () => {
      calls.push("beginUI");
    },
  });
  assert.deepEqual(calls, ["before", "beginUI"]);
});

test("Tracing.start failure cannot fabricate a before endpoint or begin the window", async () => {
  assert.equal(typeof profile.beginUIWithCpuEndpointV4, "function");
  const failure = new Error("controlled Tracing.start rejection");
  await assert.rejects(
    profile.beginUIWithCpuEndpointV4({
      probesEnabled: true,
      startTracing: async () => {
        throw failure;
      },
      captureBefore: () => assert.fail("fabricated before"),
      beginUI: () => assert.fail("began after failure"),
    }),
    (error) => error === failure,
  );
});

test("beginUI waits for the before endpoint to finish and cannot run after its failure", async () => {
  const calls = [];
  let finishBefore;
  const failure = new Error("controlled endpoint failure");
  const pending = profile.beginUIWithCpuEndpointV4({
    probesEnabled: false,
    captureBefore: async () => {
      calls.push("before");
      await new Promise((resolve) => {
        finishBefore = resolve;
      });
      throw failure;
    },
    beginUI: () => assert.fail("began without a completed endpoint"),
  });
  assert.deepEqual(calls, ["before"]);
  finishBefore();
  await assert.rejects(pending, (error) => error === failure);
});

for (const probeMode of ["on", "off"]) {
  test(`new ${probeMode} reports require the versioned endpoint declaration`, () => {
    const beforeEndpointOrder =
      probeMode === "on" ? "after-tracing-start-before-beginUI" : "before-beginUI-no-tracing";
    const report = {
      methodVersion: "4.1.0",
      schemaVersion: 2,
      probeMode,
      processCpu: { beforeEndpointOrder, excludesTracingStartPreparationCost: true },
    };
    assert.deepEqual(contract.readProfileMethodV4(report), {
      methodVersion: "4.1.0",
      schemaVersion: 2,
      beforeEndpointOrder,
    });
    for (const patch of [
      { methodVersion: "4.2.0" },
      { schemaVersion: 1 },
      { processCpu: {} },
      {
        processCpu: {
          beforeEndpointOrder: "before-tracing-start-before-beginUI",
          excludesTracingStartPreparationCost: false,
        },
      },
    ]) {
      assert.equal(contract.readProfileMethodV4({ ...report, ...patch }), null);
    }
  });
}

test("the collector uses the tested lifecycle and declares the new endpoint scope", () => {
  const source = readFileSync(
    new URL("../browser/performance-profile-v4.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /await beginUIWithCpuEndpointV4\(\{/u);
  assert.match(source, /captureBefore:.*captureSharedCpuEndpoint\("before"\)/u);
  assert.equal(contract.PROFILE_METHOD_VERSION_V4, "4.1.0");
  assert.equal(contract.PROFILE_SCHEMA_VERSION_V4, 2);
  assert.match(source, /beforeEndpointOrder:/u);
  assert.match(source, /excludesTracingStartPreparationCost: true/u);
});

test("every reachable relative import of both V4 entry modules is pinned", async () => {
  const pins = new Set((await readCurrentSemanticPinsV4()).map((row) => row.path));
  const seen = new Set();
  function walk(file) {
    if (seen.has(file)) return;
    seen.add(file);
    assert.ok(pins.has(file), `unpinned reachable module: ${file}`);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
        specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier) && specifier.text.startsWith("."))
        walk(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier.text)));
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  walk("tests/browser/run-performance-v4.mjs");
  walk("tests/browser/performance-profile-v4.mjs");
  assert.ok(seen.has("tests/browser/performance-attribution-metrics-v1.mjs"));
  for (const file of ["performance-profile-v4.mjs", "run-performance-v4.mjs"]) {
    const source = readFileSync(new URL(`../browser/${file}`, import.meta.url), "utf8");
    assert.match(
      source,
      /\.\.\.V4_METHOD_SOURCE_PATHS/u,
      `${file} must capture the shared pin inventory`,
    );
  }
});

test("old WIRING-01 stays readable at its original version with partial/null CPU", () => {
  assert.equal(typeof contract.readProfileMethodV4, "function");
  const report = JSON.parse(
    readFileSync(
      new URL(
        "../../docs/16-nonadvanced-completion/lanes/performance/v4-wiring-01-evidence/native/verification.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const before = structuredClone(report);
  assert.deepEqual(contract.readProfileMethodV4(report), {
    methodVersion: "4.0.0",
    schemaVersion: 1,
    beforeEndpointOrder: "before-tracing-start-before-beginUI",
  });
  const classification = contract.classifyProfileEvidenceV4(report);
  assert.equal(classification.formalQualified, false);
  assert.equal(classification.status, report.status);
  assert.equal(report.processCpu.cdpSummary.status, "PARTIAL_PROCESS_COVERAGE");
  assert.equal(report.processCpu.cdpSummary.totalCpuSeconds, null);
  assert.equal(report.processCpu.cdpSummary.cpuToWallRatio, null);
  assert.deepEqual(report, before);
});
