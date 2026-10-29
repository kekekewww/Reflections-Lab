import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const originalPath = resolve(root, "tests/audio-runtime/run-cross-engine.mjs");
const original = readFileSync(originalPath, "utf8");
const pinnedOriginal = "ee1c4347feb6916f30efc985d52584dc664ed28e7b4d798c5fc6b8994d14bbbc";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const driverUrl = new URL("./run-prepared-native-v2.mjs", import.meta.url);
const helperUrl = new URL("./prepared-static-fixture-v2.mjs", import.meta.url);

// Probe before importing either implementation in this test process. Accidental
// CLI activation cannot create a build, artifact, watcher, server or browser.
let modules;
async function api() {
  modules ??= (async () => {
    const probe = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import http from 'node:http';
      import https from 'node:https';
      import net from 'node:net';
      import childProcess from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      process.argv = [process.execPath, ${JSON.stringify(fileURLToPath(import.meta.url))}];
      const forbid = (name) => () => { throw new Error('Import performed side effect: ' + name); };
      for (const name of ['writeFileSync','appendFileSync','mkdirSync','mkdtempSync','renameSync','rmSync','rmdirSync','unlinkSync','copyFileSync','createWriteStream','watch','watchFile'])
        fs[name] = forbid('fs.' + name);
      for (const name of ['writeFile','appendFile','mkdir','mkdtemp','rename','rm','rmdir','unlink','copyFile'])
        fs.promises[name] = forbid('fs.promises.' + name);
      for (const [module, label] of [[http,'http'],[https,'https'],[net,'net']])
        module.createServer = forbid(label + '.createServer');
      for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])
        childProcess[name] = forbid('child_process.' + name);
      syncBuiltinESMExports();
      const driver = await import(${JSON.stringify(driverUrl.href)});
      const helper = await import(${JSON.stringify(helperUrl.href)});
      for (const name of ['buildPreparedDriverSource','assertPreparedDriverConformance'])
        assert.equal(typeof driver[name], 'function');
      for (const name of ['validatePreparedFixtureMetadataV2','verifyPreparedBytesV2','verifyPreparedStaticFixtureV2','prepareStaticFixtureV2'])
        assert.equal(typeof helper[name], 'function');
      process.stdout.write('PURE_IMPORT_OK');
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: root,
      encoding: "utf8",
      timeout: 20000,
      maxBuffer: 65536,
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "PURE_IMPORT_OK");
    assert.equal(result.stderr, "");
    return { driver: await import(driverUrl.href), helper: await import(helperUrl.href) };
  })();
  return modules;
}

function replaceOnce(source, before, after) {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `Mutation anchor is absent: ${before}`);
  assert.equal(source.lastIndexOf(before), first, `Mutation anchor is ambiguous: ${before}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function removeSuiteFinally(source) {
  const file = ts.createSourceFile(
    "negative.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const matches = [];
  function visit(node) {
    if (
      ts.isTryStatement(node) &&
      node.finallyBlock?.getText(file).includes('"diagnostic capture"')
    )
      matches.push(node.finallyBlock);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(matches.length, 1);
  const block = matches[0];
  const keyword = source.lastIndexOf("finally", block.getStart(file));
  assert.ok(keyword >= 0);
  return source.slice(0, keyword) + source.slice(block.end);
}

function replaceAsyncPreparation(source) {
  const file = ts.createSourceFile(
    "negative.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const callbacks = [];
  function visit(node) {
    if (
      ts.isArrowFunction(node) &&
      node.body.getText(file).includes("return harness.prepareNativeSuite(suite);")
    )
      callbacks.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(callbacks.length, 1);
  const callback = callbacks[0];
  const nonAsync =
    '(suite) => import("/tests/audio-runtime/cross-engine-harness.ts").then((harness) => harness.prepareNativeSuite(suite))';
  return source.slice(0, callback.getStart(file)) + nonAsync + source.slice(callback.end);
}

test("imports expose pure APIs without starting CLI, build, filesystem writes or network resources", async () => {
  const { driver } = await api();
  assert.equal(driver.ORIGINAL_DRIVER_SHA256, pinnedOriginal);
});

test("the byte-pinned original generates deterministic four-bootstrap-only conformance evidence", async () => {
  const { driver } = await api();
  assert.equal(digest(original), pinnedOriginal);
  const generated = driver.buildPreparedDriverSource(original, root);
  assert.equal(driver.buildPreparedDriverSource(original, root), generated);
  const proof = driver.assertPreparedDriverConformance(original, generated, root);
  assert.equal(proof.conformant, true);
  assert.equal(proof.originalSha256, pinnedOriginal);
  assert.equal(proof.generatedSha256, digest(generated));
  assert.match(proof.normalizedAstSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(proof.replacementCounts, {
    root: 1,
    configImport: 1,
    reportImport: 1,
    createServerImport: 1,
  });
  assert.equal(
    readFileSync(originalPath, "utf8"),
    original,
    "Pure generation must not edit the old runner",
  );
});

const mutations = [
  [
    "callback body",
    (source) => replaceOnce(source, "return harness.nativeCapabilities();", "return {};"),
  ],
  [
    "callback parameters",
    (source) =>
      replaceOnce(
        source,
        "page.evaluate(async (suite) => {",
        "page.evaluate(async (suite, injected) => {",
      ),
  ],
  [
    "callback async/form",
    (source) =>
      replaceOnce(
        source,
        "page.evaluate(async (suite) => {",
        "page.evaluate(async function (suite) {",
      ),
  ],
  ["callback async flag", replaceAsyncPreparation],
  [
    "capability gate",
    (source) =>
      replaceOnce(
        source,
        "if (!missingSuiteCapabilities(suite, capabilities).length) {",
        "if (true) {",
      ),
  ],
  ["suite finally cleanup", removeSuiteFinally],
  [
    "classifier call",
    (source) =>
      replaceOnce(
        source,
        "const result = classifySuiteOutcome(suite, { ...observation, capabilities, diagnostics });",
        "const result = { status: 'PASS', cases: [] };",
      ),
  ],
  [
    "preparation deadline",
    (source) =>
      replaceOnce(
        source,
        '15_000,\n                "original suite import and preparation",',
        '16_000,\n                "original suite import and preparation",',
      ),
  ],
  [
    "suite order",
    (source) =>
      replaceOnce(
        source,
        "for (const suite of NATIVE_AUDIO_SUITES) {",
        "for (const suite of [...NATIVE_AUDIO_SUITES].reverse()) {",
      ),
  ],
  [
    "suite removal",
    (source) =>
      replaceOnce(
        source,
        "for (const suite of NATIVE_AUDIO_SUITES) {",
        "for (const suite of NATIVE_AUDIO_SUITES.slice(1)) {",
      ),
  ],
  [
    "source-closure mapping",
    (source) =>
      replaceOnce(
        source,
        "...NATIVE_AUDIO_SUITES.map((suite) => suite.module.slice(1)),",
        "...NATIVE_AUDIO_SUITES.slice(1).map((suite) => suite.module.slice(1)),",
      ),
  ],
  ["extra comment outside the allowed edits", (source) => source + "\n// unapproved extra bytes\n"],
];
for (const [name, mutate] of mutations)
  test(`conformance rejects an otherwise generated driver with altered ${name}`, async () => {
    const { driver } = await api();
    const generated = driver.buildPreparedDriverSource(original, root);
    const changed = mutate(generated);
    assert.notEqual(changed, generated);
    assert.throws(() => driver.assertPreparedDriverConformance(original, changed, root), Error);
  });

test("changing both the original and candidate cannot rebase the trusted driver oracle", async () => {
  const { driver } = await api();
  const changedOriginal = original + "\n// changed baseline\n";
  const changedGenerated =
    driver.buildPreparedDriverSource(original, root) + "\n// changed baseline\n";
  assert.throws(() => driver.buildPreparedDriverSource(changedOriginal, root), Error);
  assert.throws(
    () => driver.assertPreparedDriverConformance(changedOriginal, changedGenerated, root),
    Error,
  );
});

const suites = [
  ["browser", "runAudioBrowserValidation"],
  ["native-pause", "runAudioPauseBrowserValidation"],
  ["native-reverb", "runAudioLateBrowserValidation"],
  ["native-continuity", "runAudioContinuityBrowserValidation"],
  ["native-restore", "runAudioRestoreBrowserValidation"],
  ["native-wave", "runAudioWaveBrowserValidation"],
];
const buildOptions = {
  bundle: true,
  splitting: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: false,
  treeShaking: false,
  keepNames: true,
  sourcemap: "external",
  sourcesContent: true,
};
function manifestFixture() {
  const definitions = [
    [
      "cross-engine-harness",
      ["awaitNativeSuite", "nativeCapabilities", "nativeDiagnostics", "prepareNativeSuite"],
    ],
    ...suites.map(([name, exported]) => [name, [exported]]),
  ];
  const entries = definitions.map(([name, exports]) => ({
    url: `/tests/audio-runtime/${name}.ts`,
    source: `tests/audio-runtime/${name}.ts`,
    file: `bundles/${name}.js`,
    bytes: 10,
    sha256: digest(`bundle:${name}`),
    mapFile: `bundles/${name}.js.map`,
    mapSha256: digest(`map:${name}`),
    exports,
    imports: [],
  }));
  const audio = [
    "assets",
    "band-filter",
    "control",
    "engine",
    "index",
    "late-reverb",
    "routes",
    "types",
    "wav",
  ].map((name) => `src/audio/${name}.ts`);
  const inputs = [...audio, ...entries.map((entry) => entry.source)];
  const paths = [
    ...inputs,
    "tests/audio-runtime/cross-engine.config.mjs",
    "tests/audio-runtime/cross-engine-report.mjs",
    "tests/audio-runtime/run-cross-engine.mjs",
    "tests/audio-runtime/cross-engine-runner.test.mjs",
    "tests/audio-runtime/CROSS_ENGINE.md",
    "package-lock.json",
    "node_modules/playwright-core/browsers.json",
  ];
  const originalSources = Object.fromEntries(paths.map((path) => [path, digest(`source:${path}`)]));
  assert.equal(paths.length, 23);
  return {
    version: "ORIGINAL25_VIA_PREPARED_STATIC_V2",
    esbuildVersion: "0.28.2",
    buildOptions: { ...buildOptions },
    entries,
    originalSources,
    actualBuildInputs: Object.fromEntries(inputs.map((path) => [path, originalSources[path]])),
  };
}

test("pure prepared metadata accepts exactly seven original entry URLs, exports and captured local inputs", async () => {
  const { helper } = await api();
  assert.deepEqual(helper.PREPARED_STATIC_BUILD_OPTIONS, buildOptions);
  assert.equal(helper.validatePreparedFixtureMetadataV2(manifestFixture()), true);
});

const metadataMutations = [
  ["missing entry", (value) => value.entries.pop()],
  ["extra entry", (value) => value.entries.push({ ...value.entries[0], url: "/extra.ts" })],
  [
    "duplicate URL",
    (value) => {
      value.entries[1].url = value.entries[0].url;
    },
  ],
  [
    "swapped entries",
    (value) => {
      [value.entries[1], value.entries[2]] = [value.entries[2], value.entries[1]];
    },
  ],
  [
    "wrong export",
    (value) => {
      value.entries[1].exports = ["inventedPass"];
    },
  ],
  [
    "wrong source mapping",
    (value) => {
      value.entries[1].source = "tests/audio-runtime/other.ts";
    },
  ],
  [
    "external runtime import",
    (value) => {
      value.entries[1].imports = [{ path: "/src/app/runtime.ts", external: true }];
    },
  ],
  [
    "changed compiler",
    (value) => {
      value.esbuildVersion = "0.0.0";
    },
  ],
  [
    "changed build option",
    (value) => {
      value.buildOptions.minify = true;
    },
  ],
  [
    "missing original input",
    (value) => {
      delete value.originalSources[Object.keys(value.originalSources)[0]];
    },
  ],
  [
    "empty actual closure",
    (value) => {
      value.actualBuildInputs = {};
    },
  ],
  [
    "unrelated App input",
    (value) => {
      value.actualBuildInputs["src/app/runtime.ts"] = digest("unexpected");
    },
  ],
  [
    "mismatched actual source hash",
    (value) => {
      value.actualBuildInputs[Object.keys(value.actualBuildInputs)[0]] = "0".repeat(64);
    },
  ],
];
for (const [name, mutate] of metadataMutations)
  test(`prepared metadata rejects ${name}`, async () => {
    const { helper } = await api();
    const manifest = manifestFixture();
    mutate(manifest);
    assert.throws(() => helper.validatePreparedFixtureMetadataV2(manifest), Error);
  });

test("source, bundle and map byte tampering cannot retain the prepared hash binding", async () => {
  const { helper } = await api();
  for (const label of ["source", "bundle", "map"]) {
    const bytes = Buffer.from(`frozen ${label} bytes`);
    const expected = digest(bytes);
    assert.equal(helper.verifyPreparedBytesV2(bytes, expected, label), true);
    const altered = Buffer.from(bytes);
    altered[0] ^= 1;
    assert.throws(() => helper.verifyPreparedBytesV2(altered, expected, label), Error);
    assert.throws(() => helper.verifyPreparedBytesV2(bytes, "0".repeat(64), label), Error);
  }
});

const approvedBaselinePath = "artifacts/v1/audio-prefix-approved-baseline-20261028.json";
const approvedBaselineSha256 = "281c75ecf575ffdef27aa99e6bf7c053d9c2c595a0dd176235ea997a1a160bd2";
const legacyBaselinePath =
  "artifacts/v1/audio-qualification-original25-observed-20261027151352235/verification.json";
const legacyBaselineSha256 = "968e56921ee0c4b8f0f67b57f61fd70bfe79cc346d96ff8cf0aa9dd98aa2f78a";
const approvedBandDelta = {
  path: "src/audio/band-filter.ts",
  from: "ce7012f442aa292e672ab24e442b0a84964a7afddcf6ebad92cbe4552bd1bb2a",
  to: "f3e5cb2b6d1ad0301d44cd4f7092b0a4d4c621826484c5ed0588549c611f2693",
};
function approvedBaselineFixture() {
  const bytes = readFileSync(resolve(root, approvedBaselinePath));
  assert.equal(digest(bytes), approvedBaselineSha256);
  return JSON.parse(bytes);
}
function legacySourceFixture() {
  const bytes = readFileSync(resolve(root, legacyBaselinePath));
  assert.equal(digest(bytes), legacyBaselineSha256);
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.sourceStable, true);
  assert.deepEqual(receipt.sourcesBefore, receipt.sourcesAfter);
  assert.equal(Object.keys(receipt.sourcesAfter).length, 23);
  return receipt.sourcesAfter;
}

test("baseline registry preserves the legacy default and names the exact Root-approved prefix record", async () => {
  const { driver } = await api();
  const legacy = driver.resolvePreparedBaselineProfile();
  assert.deepEqual(legacy, driver.resolvePreparedBaselineProfile("legacy"));
  assert.equal(legacy.id, "legacy");
  assert.equal(legacy.recordPath, legacyBaselinePath);
  assert.equal(legacy.recordSha256, legacyBaselineSha256);
  assert.deepEqual(legacy.approvedDelta, []);
  const prefix = driver.resolvePreparedBaselineProfile("prefix-f3e5");
  assert.equal(prefix.id, "prefix-f3e5");
  assert.equal(prefix.baselineId, "audio-prefix-f3e5");
  assert.equal(prefix.recordPath, approvedBaselinePath);
  assert.equal(prefix.recordSha256, approvedBaselineSha256);
  assert.deepEqual(prefix.legacyBaseline, {
    path: legacyBaselinePath,
    sha256: legacyBaselineSha256,
  });
  assert.deepEqual(prefix.approvedDelta, [approvedBandDelta]);
  assert.deepEqual(prefix.approvalEvidence, approvedBaselineFixture().approvalEvidence);
  assert.ok(Object.isFrozen(prefix));
  assert.ok(Object.isFrozen(prefix.approvedDelta[0]));
  assert.throws(() => (prefix.approvedDelta[0].to = "0".repeat(64)), TypeError);
  assert.deepEqual(driver.resolvePreparedBaselineProfile("prefix-f3e5"), prefix);
});

test("baseline registry rejects free paths, free hashes, object profiles and unknown aliases", async () => {
  const { driver } = await api();
  for (const id of [
    "default",
    "prefix",
    "../../approval.json",
    approvedBaselinePath,
    approvedBaselineSha256,
    { id: "prefix-f3e5", recordPath: approvedBaselinePath },
    null,
  ])
    assert.throws(() => driver.resolvePreparedBaselineProfile(id), Error);
});

test("approved baseline admits exactly the one registered product delta and preserves all 22 other inputs", async () => {
  const { driver } = await api();
  const record = approvedBaselineFixture();
  const legacy = legacySourceFixture();
  const result = driver.validatePreparedBaselineRecord(record, legacy);
  assert.equal(result.baselineId, "audio-prefix-f3e5");
  assert.deepEqual(result.approvedDelta, [approvedBandDelta]);
  assert.deepEqual(result.sources, { ...legacy, [approvedBandDelta.path]: approvedBandDelta.to });
  assert.deepEqual(result.approvalEvidence, record.approvalEvidence);
  assert.ok(Object.isFrozen(result.sources));
  assert.notEqual(result.sources, record.sources);
  assert.throws(() => (result.sources[approvedBandDelta.path] = approvedBandDelta.from), TypeError);
});

const approvalMutations = [
  ["schema", (r) => (r.schemaVersion = 2)],
  ["baseline identity", (r) => (r.baselineId = "legacy")],
  ["legacy hash", (r) => (r.legacyBaseline.sha256 = "0".repeat(64))],
  ["approval evidence path", (r) => (r.approvalEvidence.path = "artifacts/fake.json")],
  ["approval evidence hash", (r) => (r.approvalEvidence.sha256 = "0".repeat(64))],
  ["delta origin", (r) => (r.approvedDelta[0].from = approvedBandDelta.to)],
  ["delta destination", (r) => (r.approvedDelta[0].to = "0".repeat(64))],
  [
    "extra product delta",
    (r) => r.approvedDelta.push({ ...approvedBandDelta, path: "src/audio/engine.ts" }),
  ],
  ["unapproved engine source", (r) => (r.sources["src/audio/engine.ts"] = "0".repeat(64))],
  [
    "unapproved oracle source",
    (r) => (r.sources["tests/audio-runtime/browser.ts"] = "0".repeat(64)),
  ],
  [
    "rebased source set",
    (r) => {
      delete r.sources["tests/audio-runtime/browser.ts"];
      r.sources["tests/audio-runtime/invented.ts"] = "0".repeat(64);
    },
  ],
  ["extra approval field", (r) => (r.ignoreOracleChanges = true)],
];
for (const [name, mutate] of approvalMutations)
  test(`approved baseline rejects altered ${name}`, async () => {
    const { driver } = await api();
    const record = approvedBaselineFixture();
    mutate(record);
    assert.throws(
      () => driver.validatePreparedBaselineRecord(record, legacySourceFixture()),
      Error,
    );
  });

test("caller-controlled source maps cannot jointly rebase an unapproved oracle", async () => {
  const { driver } = await api();
  const legacy = legacySourceFixture();
  const record = approvedBaselineFixture();
  const path = "tests/audio-runtime/browser.ts";
  legacy[path] = record.sources[path] = "0".repeat(64);
  assert.throws(() => driver.validatePreparedBaselineRecord(record, legacy), Error);
});

test("baseline loader binds the registered record, immutable legacy receipt and approval evidence bytes", async () => {
  const { driver } = await api();
  const prefix = await driver.loadPreparedBaseline(root, "prefix-f3e5");
  assert.equal(prefix.profile.id, "prefix-f3e5");
  assert.equal(prefix.recordSha256, approvedBaselineSha256);
  assert.equal(prefix.legacySha256, legacyBaselineSha256);
  assert.deepEqual(prefix.sources, approvedBaselineFixture().sources);
  const legacy = await driver.loadPreparedBaseline(root);
  assert.equal(legacy.profile.id, "legacy");
  assert.deepEqual(legacy.sources, legacySourceFixture());
});
