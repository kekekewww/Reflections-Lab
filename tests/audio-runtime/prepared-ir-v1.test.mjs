import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const originalPath = resolve(root, "tests/audio-runtime/run-ir-state-reference-v1.mjs");
const original = readFileSync(originalPath, "utf8");
const pinnedOriginal = "aa4dd31d11833a4b8bff0414ec1b4db08f621ff2e502ca09afd7bf8ffce249eb";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const driverUrl = new URL("./run-prepared-ir-v1.mjs", import.meta.url);
const helperUrl = new URL("./prepared-ir-static-v1.mjs", import.meta.url);

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
      for (const name of ['buildPreparedIrDriverSource','assertPreparedIrDriverConformance'])
        assert.equal(typeof driver[name], 'function');
      for (const name of ['validateIrStaticFixtureMetadataV1','verifyIrStaticFixtureV1','prepareIrStaticFixtureV1'])
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

function replaceAsyncPreparation(
  source,
  moduleUrl = "/tests/audio-runtime/native-ir-state-reference-v1.ts",
) {
  const file = ts.createSourceFile(
    "negative.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const callbacks = [];
  const importLine = `const module = await import(${JSON.stringify(moduleUrl)});`;
  function visit(node) {
    if (ts.isArrowFunction(node) && node.body.getText(file).includes(importLine))
      callbacks.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(callbacks.length, 1);
  const callback = callbacks[0];
  const body = replaceOnce(callback.body.getText(file), importLine, "");
  const replacement = `() => import(${JSON.stringify(moduleUrl)}).then((module) => ${body})`;
  return source.slice(0, callback.getStart(file)) + replacement + source.slice(callback.end);
}
function removeCleanupFinally(source) {
  const file = ts.createSourceFile(
    "negative.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const blocks = [];
  function visit(node) {
    if (
      ts.isTryStatement(node) &&
      node.finallyBlock?.getText(file).includes('"owned context close"')
    )
      blocks.push(node.finallyBlock);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(blocks.length, 1);
  const block = blocks[0];
  const keyword = source.lastIndexOf("finally", block.getStart(file));
  assert.ok(keyword >= 0);
  return source.slice(0, keyword) + source.slice(block.end);
}

test("IR modules expose pure APIs without starting CLI, artifacts, build, network or browser resources", async () => {
  const { driver } = await api();
  assert.equal(driver.ORIGINAL_IR_DRIVER_SHA256, pinnedOriginal);
});
test("the pinned IR driver permits exactly two deterministic bootstrap edits with full AST evidence", async () => {
  const { driver } = await api();
  assert.equal(digest(original), pinnedOriginal);
  const generated = driver.buildPreparedIrDriverSource(original, root);
  assert.equal(driver.buildPreparedIrDriverSource(original, root), generated);
  const proof = driver.assertPreparedIrDriverConformance(original, generated, root);
  assert.equal(proof.conformant, true);
  assert.equal(proof.originalSha256, pinnedOriginal);
  assert.equal(proof.generatedSha256, digest(generated));
  assert.match(proof.normalizedAstSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(proof.replacementCounts, { root: 1, createServerImport: 1 });
  assert.equal(readFileSync(originalPath, "utf8"), original);
});
const mutations = [
  [
    "callback body",
    (s) =>
      replaceOnce(
        s,
        "module.runNativeIrStateReferenceV1(),",
        "Promise.resolve({ status: 'PASS' }),",
      ),
  ],
  [
    "callback parameter",
    (s) => replaceOnce(s, "page.evaluate(async () => {", "page.evaluate(async (injected) => {"),
  ],
  ["callback async flag", replaceAsyncPreparation],
  [
    "trusted activation command",
    (s) =>
      replaceOnce(
        s,
        'page.getByRole("button", { name: "Run native IR reference" }).click()',
        'page.getByRole("button", { name: "Run native IR reference" }).click({ force: true })',
      ),
  ],
  [
    "15-second preparation deadline",
    (s) =>
      replaceOnce(
        s,
        '15_000,\n        "standalone IR reference module preparation",',
        '16_000,\n        "standalone IR reference module preparation",',
      ),
  ],
  [
    "45-second native deadline",
    (s) =>
      replaceOnce(
        s,
        '45_000,\n        "single native IR state reference batch",',
        '46_000,\n        "single native IR state reference batch",',
      ),
  ],
  ["required check IDs", (s) => replaceOnce(s, '  "native-changed-ir-bank-reverse",\n', "")],
  [
    "six render IDs",
    (s) =>
      replaceOnce(
        s,
        "expectedCheckIds.flatMap((id) => [`${id}:actual`, `${id}:reference`])",
        "expectedCheckIds.map((id) => `${id}:actual`)",
      ),
  ],
  [
    "PCM channel shape",
    (s) => replaceOnce(s, "entry.rawPcm.length === 2", "entry.rawPcm.length === 1"),
  ],
  ["PCM frame shape", (s) => replaceOnce(s, "channel.length === 12000", "channel.length === 1")],
  [
    "PCM finite predicate",
    (s) =>
      replaceOnce(
        s,
        "Array.from(channel).every(Number.isFinite)",
        "Array.from(channel).every(() => true)",
      ),
  ],
  [
    "check uniqueness",
    (s) =>
      replaceOnce(
        s,
        "new Set(checks.map((entry) => entry?.id)).size === expectedCheckIds.length",
        "true",
      ),
  ],
  [
    "all-check PASS predicate",
    (s) =>
      replaceOnce(
        s,
        "checks.every((entry) => entry.pass === true)",
        "checks.some((entry) => entry.pass === true)",
      ),
  ],
  ["owned cleanup finally", removeCleanupFinally],
  ["source stability gate", (s) => replaceOnce(s, "!sourceStable ||", "false ||")],
  ["extra bytes", (s) => s + "\n// unapproved IR driver change\n"],
];
for (const [name, mutate] of mutations)
  test(`IR conformance rejects altered ${name}`, async () => {
    const { driver } = await api();
    const generated = driver.buildPreparedIrDriverSource(original, root);
    const changed = mutate(generated);
    assert.notEqual(changed, generated);
    assert.throws(() => driver.assertPreparedIrDriverConformance(original, changed, root), Error);
  });
test("a changed IR original and candidate cannot jointly rebase the pinned oracle", async () => {
  const { driver } = await api();
  const changedOriginal = original + "\n// changed baseline\n";
  assert.throws(() => driver.buildPreparedIrDriverSource(changedOriginal, root), Error);
  assert.throws(
    () =>
      driver.assertPreparedIrDriverConformance(
        changedOriginal,
        driver.buildPreparedIrDriverSource(original, root) + "\n// changed baseline\n",
        root,
      ),
    Error,
  );
});
const options = {
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
  const entrySource = "tests/audio-runtime/native-ir-state-reference-v1.ts";
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
  const suites = [
    "browser",
    "native-pause",
    "native-reverb",
    "native-continuity",
    "native-restore",
    "native-wave",
  ].map((name) => `tests/audio-runtime/${name}.ts`);
  const ir = [
    entrySource,
    "tests/audio-runtime/ir-state-reference-v1-data.ts",
    "tests/audio-runtime/ir-state-reference-v1.test.ts",
    "tests/audio-runtime/run-ir-state-reference-v1.mjs",
  ];
  const paths = [
    ...audio,
    ...suites,
    ...ir,
    "package-lock.json",
    "node_modules/playwright-core/browsers.json",
  ];
  assert.equal(paths.length, 21);
  const originalSources = Object.fromEntries(paths.map((path) => [path, digest(`source:${path}`)]));
  const actual = [
    "src/audio/band-filter.ts",
    "src/audio/control.ts",
    "src/audio/routes.ts",
    "src/audio/types.ts",
    "tests/audio-runtime/ir-state-reference-v1-data.ts",
    entrySource,
  ].sort();
  return {
    version: "NATIVE_IR_STATE_VIA_PREPARED_STATIC_V1",
    esbuildVersion: "0.28.2",
    v2HelperSha256: "d6acb640f0f034863daf7ab79273ac41c4ab980961a29932bd3ad40f5afef1a7",
    buildOptions: { ...options },
    originalSources,
    actualBuildInputs: Object.fromEntries(actual.map((path) => [path, originalSources[path]])),
    entries: [
      {
        url: `/${entrySource}`,
        source: entrySource,
        file: "bundles/native-ir-state-reference-v1.js",
        bytes: 10,
        sha256: digest("bundle"),
        mapFile: "bundles/native-ir-state-reference-v1.js.map",
        mapSha256: digest("map"),
        exports: ["runNativeIrStateReferenceV1"],
        imports: [],
      },
    ],
  };
}
test("IR static metadata binds one original URL/export, frozen compiler settings and six captured inputs", async () => {
  const { helper } = await api();
  assert.equal(helper.validateIrStaticFixtureMetadataV1(manifestFixture()), true);
});
const metadataMutations = [
  ["missing entry", (m) => m.entries.pop()],
  ["additional entry", (m) => m.entries.push({ ...m.entries[0] })],
  [
    "different entry URL",
    (m) => {
      m.entries[0].url = "/tests/audio-runtime/browser.ts";
    },
  ],
  [
    "different export",
    (m) => {
      m.entries[0].exports = ["inventedPass"];
    },
  ],
  [
    "external runtime import",
    (m) => {
      m.entries[0].imports = [{ path: "/src/app/runtime.ts", external: true }];
    },
  ],
  [
    "different compiler",
    (m) => {
      m.esbuildVersion = "0.0.0";
    },
  ],
  [
    "different compilation options",
    (m) => {
      m.buildOptions.minify = true;
    },
  ],
  [
    "unrelated input closure",
    (m) => {
      delete m.actualBuildInputs[Object.keys(m.actualBuildInputs)[0]];
      m.actualBuildInputs["src/app/runtime.ts"] = digest("unexpected");
    },
  ],
  [
    "different captured source hash",
    (m) => {
      m.actualBuildInputs[Object.keys(m.actualBuildInputs)[0]] = "0".repeat(64);
    },
  ],
];
for (const [name, mutate] of metadataMutations)
  test(`IR metadata rejects ${name}`, async () => {
    const { helper } = await api();
    const fixture = manifestFixture();
    mutate(fixture);
    assert.throws(() => helper.validateIrStaticFixtureMetadataV1(fixture), Error);
  });
test("IR source, bundle and map tampering fails the reused qualified byte verifier", async () => {
  await api();
  const { verifyPreparedBytesV2 } = await import("./prepared-static-fixture-v2.mjs");
  for (const label of ["IR source", "IR bundle", "IR map"]) {
    const bytes = Buffer.from(`frozen ${label}`),
      hash = digest(bytes),
      changed = Buffer.from(bytes);
    assert.equal(verifyPreparedBytesV2(bytes, hash, label), true);
    changed[0] ^= 1;
    assert.throws(() => verifyPreparedBytesV2(changed, hash, label), Error);
    assert.throws(() => verifyPreparedBytesV2(bytes, "0".repeat(64), label), Error);
  }
});

const v1FixturePath = "tests/audio-runtime/native-ir-state-reference-v1.ts";
const v2FixturePath = "tests/audio-runtime/native-ir-state-reference-v2.ts";
const v1FixtureSha256 = "ea3dfb59556d5ee58877d7d807854d5881f87c80fb10038fc2af9a158b43c607";
const v2FixtureSha256 = "05b7940ca4b16f77e3ef20861429529a7e6b39e7466b49e64f356e4b897a778e";
function irFixtureSources() {
  const v1 = readFileSync(resolve(root, v1FixturePath), "utf8");
  const v2 = readFileSync(resolve(root, v2FixturePath), "utf8");
  assert.equal(digest(v1), v1FixtureSha256);
  assert.equal(digest(v2), v2FixtureSha256);
  return { v1, v2 };
}
function v2ManifestFixture() {
  const fixture = manifestFixture();
  fixture.irProfile = "v2";
  fixture.version = "NATIVE_IR_STATE_VIA_PREPARED_STATIC_V2";
  const hash = fixture.originalSources[v1FixturePath];
  delete fixture.originalSources[v1FixturePath];
  fixture.originalSources[v2FixturePath] = hash;
  delete fixture.actualBuildInputs[v1FixturePath];
  fixture.actualBuildInputs[v2FixturePath] = hash;
  fixture.entries[0].url = `/${v2FixturePath}`;
  fixture.entries[0].source = v2FixturePath;
  fixture.entries[0].file = "bundles/native-ir-state-reference-v2.js";
  fixture.entries[0].mapFile = "bundles/native-ir-state-reference-v2.js.map";
  return fixture;
}

test("IR profile registries retain v1 by default and bind v2 to the fixed new module with the unchanged export", async () => {
  const { driver, helper } = await api();
  assert.deepEqual(driver.resolvePreparedIrProfile(), driver.resolvePreparedIrProfile("v1"));
  assert.deepEqual(helper.resolveIrStaticProfile(), helper.resolveIrStaticProfile("v1"));
  for (const resolveProfile of [driver.resolvePreparedIrProfile, helper.resolveIrStaticProfile]) {
    const profile = resolveProfile("v2");
    assert.equal(profile.id, "v2");
    assert.equal(profile.referenceVersion, "native-ir-state-reference-v2");
    assert.equal(profile.entryUrl, `/${v2FixturePath}`);
    assert.equal(profile.exportName, "runNativeIrStateReferenceV1");
    assert.equal(profile.fixtureSha256, v2FixtureSha256);
    assert.ok(Object.isFrozen(profile));
    assert.throws(() => (profile.fixtureSha256 = "0".repeat(64)), TypeError);
  }
});

test("IR registries reject unknown versions, free module URLs and coercible object profiles", async () => {
  const { driver, helper } = await api();
  for (const resolveProfile of [driver.resolvePreparedIrProfile, helper.resolveIrStaticProfile])
    for (const profile of [
      "default",
      "v3",
      `/${v2FixturePath}`,
      v2FixtureSha256,
      { toString: () => "v2" },
      null,
    ])
      assert.throws(() => resolveProfile(profile), Error);
});

test("the v2 fixture is exactly the pinned v1 version metadata plus intrinsic bank initialization repair", async () => {
  const { driver } = await api();
  const { v1, v2 } = irFixtureSources();
  assert.doesNotThrow(() => driver.assertPreparedIrFixtureConformance(v1, v2));
  assert.equal(readFileSync(resolve(root, v1FixturePath), "utf8"), v1);
});

const fixtureMutations = [
  [
    "maximum absolute error threshold",
    (s) =>
      replaceOnce(
        s,
        "const maximumSampleErrorBound = 1e-5;",
        "const maximumSampleErrorBound = 1e-3;",
      ),
  ],
  [
    "RMS threshold",
    (s) => replaceOnce(s, "const rmsErrorBound = 0.001;", "const rmsErrorBound = 0.1;"),
  ],
  [
    "native schedule",
    (s) =>
      replaceOnce(
        s,
        '{ atFrame: 4096, response: "B", scale: 1, accepted: true }',
        '{ atFrame: 4224, response: "B", scale: 1, accepted: true }',
      ),
  ],
  [
    "FIR response selection",
    (s) => replaceOnce(s, "fixedIrStateKernel(response)", 'fixedIrStateKernel("A")'),
  ],
  [
    "source start time",
    (s) =>
      replaceOnce(
        s,
        "source.start(impulse ? 0.05 : 0.01);",
        "source.start(impulse ? 0.05 : 0.02);",
      ),
  ],
  [
    "bank repair reversion",
    (s) =>
      replaceOnce(
        s,
        "levels[i]!.gain.value = i === 0 ? 1 : 0;",
        "levels[i]!.gain.setValueAtTime(i === 0 ? 1 : 0, 0);",
      ),
  ],
  ["result predicate", (s) => replaceOnce(s, "channel.rmsError < rmsErrorBound &&", "true &&")],
  ["extra fixture bytes", (s) => s + "\n// unapproved extra change\n"],
];
for (const [name, mutate] of fixtureMutations)
  test(`IR v2 derivation rejects altered ${name}`, async () => {
    const { driver } = await api();
    const { v1, v2 } = irFixtureSources();
    const changed = mutate(v2);
    assert.notEqual(changed, v2);
    assert.throws(() => driver.assertPreparedIrFixtureConformance(v1, changed), Error);
  });

test("changing both reference fixtures cannot rebase the trusted v1 derivation", async () => {
  const { driver } = await api();
  const { v1, v2 } = irFixtureSources();
  assert.throws(
    () => driver.assertPreparedIrFixtureConformance(v1 + "\n// rebase\n", v2 + "\n// rebase\n"),
    Error,
  );
});

test("v2 static metadata binds its one new URL and six inputs while v1 remains the default", async () => {
  const { helper } = await api();
  assert.equal(helper.validateIrStaticFixtureMetadataV1(manifestFixture()), true);
  assert.equal(
    helper.validateIrStaticFixtureMetadataV1(v2ManifestFixture(), { irProfile: "v2" }),
    true,
  );
  assert.throws(
    () => helper.validateIrStaticFixtureMetadataV1(v2ManifestFixture(), { irProfile: "v1" }),
    Error,
  );
  assert.throws(
    () => helper.validateIrStaticFixtureMetadataV1(manifestFixture(), { irProfile: "v2" }),
    Error,
  );
});

test("v2 static metadata rejects a relabelled v1 URL, export change and mixed source closure", async () => {
  const { helper } = await api();
  for (const mutate of [
    (m) => (m.entries[0].url = `/${v1FixturePath}`),
    (m) => (m.entries[0].exports = ["runNativeIrStateReferenceV2"]),
    (m) => {
      m.actualBuildInputs[v1FixturePath] = m.actualBuildInputs[v2FixturePath];
      delete m.actualBuildInputs[v2FixturePath];
    },
  ]) {
    const fixture = v2ManifestFixture();
    mutate(fixture);
    assert.throws(
      () => helper.validateIrStaticFixtureMetadataV1(fixture, { irProfile: "v2" }),
      Error,
    );
  }
});

test("v2 driver generation retains the pinned old runner and rejects every existing stage mutation", async () => {
  const { driver } = await api();
  const generated = driver.buildPreparedIrDriverSource(original, root, "v2");
  assert.notEqual(generated, driver.buildPreparedIrDriverSource(original, root));
  const proof = driver.assertPreparedIrDriverConformance(original, generated, root, "v2");
  assert.equal(proof.conformant, true);
  assert.equal(proof.originalSha256, pinnedOriginal);
  assert.equal(proof.generatedSha256, digest(generated));
  assert.match(proof.normalizedAstSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(proof.replacementCounts, {
    root: 1,
    createServerImport: 1,
    expectedReferenceVersion: 1,
    sourceEntry: 1,
    moduleUrl: 1,
  });
  assert.throws(() => driver.assertPreparedIrDriverConformance(original, generated, root), Error);
  for (const [, mutate] of mutations) {
    const changed =
      mutate === replaceAsyncPreparation
        ? replaceAsyncPreparation(generated, `/${v2FixturePath}`)
        : mutate(generated);
    assert.notEqual(changed, generated);
    assert.throws(
      () => driver.assertPreparedIrDriverConformance(original, changed, root, "v2"),
      Error,
    );
  }
  assert.throws(() => driver.buildPreparedIrDriverSource(original, root, "v3"), Error);
  assert.equal(readFileSync(originalPath, "utf8"), original);
});

function qualified25Fixture() {
  const directory = resolve(root, "artifacts/v1/audio-prepared-native-v2-20261027154159861");
  const receiptBytes = readFileSync(resolve(directory, "wrapper-verification-v2.json"));
  const verificationBytes = readFileSync(resolve(directory, "verification.json"));
  assert.equal(
    digest(receiptBytes),
    "b5e6914c13c6ee826a80ebe93dd3869498608ff31121b7e780f5548c7feec63d",
  );
  assert.equal(
    digest(verificationBytes),
    "5ef7208089912ede6c9373bdf67c7ef46d7cea84057447580ffa5423049a7cff",
  );
  const receipt = JSON.parse(receiptBytes);
  return {
    receipt,
    verification: JSON.parse(verificationBytes),
    sources: { ...receipt.originalSources },
  };
}

test("IR qualification validator accepts the immutable successful legacy25 receipt and adjacent raw verification", async () => {
  const { driver } = await api();
  const fixture = qualified25Fixture();
  assert.deepEqual(
    driver.validatePreparedIrQualificationReceipt(
      fixture.receipt,
      fixture.verification,
      fixture.sources,
      "legacy",
    ),
    { valid: true, baselineId: "legacy", originalCaseCount: 25 },
  );
});

const qualificationMutations = [
  ["retained Node close", (f) => (f.receipt.actualClose.exitCode = 1)],
  ["bundle integrity", (f) => (f.receipt.bundlesAndManifestStable = false)],
  ["full25 count", (f) => (f.verification.passedChecks = 24)],
  [
    "unique original case IDs",
    (f) =>
      (f.verification.engines[0].suites[0].cases[0].id =
        f.verification.engines[0].suites[0].cases[1].id),
  ],
  ["registered source", (f) => (f.receipt.originalSources["src/audio/engine.ts"] = "0".repeat(64))],
  ["cleanup", (f) => (f.verification.cleanup[0].ok = false)],
];
for (const [name, mutate] of qualificationMutations)
  test(`IR qualification rejects altered ${name}`, async () => {
    const { driver } = await api();
    const fixture = qualified25Fixture();
    mutate(fixture);
    assert.throws(
      () =>
        driver.validatePreparedIrQualificationReceipt(
          fixture.receipt,
          fixture.verification,
          fixture.sources,
          "legacy",
        ),
      Error,
    );
  });

test("qualification receipts and expected maps cannot jointly rebase a protected source or relabel legacy as prefix", async () => {
  const { driver } = await api();
  const fixture = qualified25Fixture();
  assert.throws(
    () =>
      driver.validatePreparedIrQualificationReceipt(
        fixture.receipt,
        fixture.verification,
        fixture.sources,
        "prefix-f3e5",
      ),
    Error,
  );
  const path = "tests/audio-runtime/browser.ts";
  fixture.sources[path] =
    fixture.receipt.originalSources[path] =
    fixture.receipt.sourcesAfter[path] =
    fixture.verification.sourcesBefore[path] =
    fixture.verification.sourcesAfter[path] =
      "0".repeat(64);
  assert.throws(
    () =>
      driver.validatePreparedIrQualificationReceipt(
        fixture.receipt,
        fixture.verification,
        fixture.sources,
        "legacy",
      ),
    Error,
  );
});
