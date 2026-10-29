import { createHash } from "node:crypto";
import childProcess from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export const ORIGINAL_DRIVER_SHA256 =
  "ee1c4347feb6916f30efc985d52584dc664ed28e7b4d798c5fc6b8994d14bbbc";
const HELPER_PATH = "tests/audio-runtime/prepared-static-fixture-v2.mjs";
const FROZEN_MANIFEST_PATH =
  "artifacts/v1/audio-qualification-original25-observed-20261027151352235/verification.json";
const FROZEN_MANIFEST_SHA256 = "968e56921ee0c4b8f0f67b57f61fd70bfe79cc346d96ff8cf0aa9dd98aa2f78a";
const OBSERVER_PATH = ".cache/v1/audio-qualification-observer.mjs";
const OBSERVER_SHA256 = "238d9f60b20eee83aa5eb82a03baaef41850d0c130cba3f5fdba82c8b13043c5";
const VERSION = "ORIGINAL25_VIA_PREPARED_STATIC_V2";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const LEGACY_SOURCES_SHA256 = "0c66e6e5aa98450c5f3b3b4f3759d4a20c496d083e93457059b10d20d39b91d8";
const STATIC_HELPER_SHA256 = "d6acb640f0f034863daf7ab79273ac41c4ab980961a29932bd3ad40f5afef1a7";
const PREFIX_REGISTRATION = {
  id: "prefix-f3e5",
  baselineId: "audio-prefix-f3e5",
  recordPath: "artifacts/v1/audio-prefix-approved-baseline-20261028.json",
  recordSha256: "281c75ecf575ffdef27aa99e6bf7c053d9c2c595a0dd176235ea997a1a160bd2",
  legacyBaseline: { path: FROZEN_MANIFEST_PATH, sha256: FROZEN_MANIFEST_SHA256 },
  approvedDelta: [
    {
      path: "src/audio/band-filter.ts",
      from: "ce7012f442aa292e672ab24e442b0a84964a7afddcf6ebad92cbe4552bd1bb2a",
      to: "f3e5cb2b6d1ad0301d44cd4f7092b0a4d4c621826484c5ed0588549c611f2693",
    },
  ],
  approvalEvidence: {
    path: "artifacts/v1/audio-prefix-sourceend-20261027170233273/sourceend-receipt.json",
    sha256: "57240da1fb2e0b6bc54f57a89e66a604addc09d0f827051382ed76e45e4b9603",
  },
};
function frozenClone(value) {
  const copy = structuredClone(value);
  const freeze = (entry) => {
    if (entry && typeof entry === "object") {
      for (const child of Object.values(entry)) freeze(child);
      Object.freeze(entry);
    }
    return entry;
  };
  return freeze(copy);
}
export function resolvePreparedBaselineProfile(id = "legacy") {
  if (id === "legacy")
    return frozenClone({
      id,
      baselineId: "legacy",
      recordPath: FROZEN_MANIFEST_PATH,
      recordSha256: FROZEN_MANIFEST_SHA256,
      legacyBaseline: { path: FROZEN_MANIFEST_PATH, sha256: FROZEN_MANIFEST_SHA256 },
      approvedDelta: [],
      approvalEvidence: null,
    });
  if (id === "prefix-f3e5") return frozenClone(PREFIX_REGISTRATION);
  throw new Error("Unknown prepared baseline enum; choose legacy or prefix-f3e5");
}
export function validatePreparedBaselineRecord(record, legacySources, id = "prefix-f3e5") {
  const profile = resolvePreparedBaselineProfile(id);
  const keys = Object.keys(legacySources ?? {});
  if (
    keys.length !== 23 ||
    JSON.stringify(keys) !== JSON.stringify([...keys].sort()) ||
    digest(JSON.stringify(legacySources)) !== LEGACY_SOURCES_SHA256
  )
    throw new Error("Legacy source23 map is not the pinned archived map");
  if (id === "legacy") {
    if (
      record?.sourceStable !== true ||
      JSON.stringify(record.sourcesBefore) !== JSON.stringify(legacySources) ||
      JSON.stringify(record.sourcesAfter) !== JSON.stringify(legacySources)
    )
      throw new Error("Legacy source23 record changed");
    return frozenClone({
      baselineId: profile.baselineId,
      sources: legacySources,
      approvedDelta: [],
      approvalEvidence: null,
    });
  }
  const expectedKeys = [
    "schemaVersion",
    "baselineId",
    "legacyBaseline",
    "approvedDelta",
    "sources",
    "approvalEvidence",
  ].sort();
  if (
    !record ||
    JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(expectedKeys) ||
    record.schemaVersion !== 1 ||
    record.baselineId !== profile.baselineId ||
    JSON.stringify(record.legacyBaseline) !== JSON.stringify(profile.legacyBaseline) ||
    JSON.stringify(record.approvedDelta) !== JSON.stringify(profile.approvedDelta) ||
    JSON.stringify(record.approvalEvidence) !== JSON.stringify(profile.approvalEvidence) ||
    JSON.stringify(Object.keys(record.sources ?? {})) !== JSON.stringify(keys)
  )
    throw new Error("Registered baseline record metadata, approval, delta or source keys mismatch");
  const delta = profile.approvedDelta[0];
  if (
    legacySources[delta.path] !== delta.from ||
    keys.some(
      (path) => record.sources[path] !== (path === delta.path ? delta.to : legacySources[path]),
    )
  )
    throw new Error("Registered baseline permits only the exact approved band-filter delta");
  return frozenClone({
    baselineId: profile.baselineId,
    sources: record.sources,
    approvedDelta: profile.approvedDelta,
    approvalEvidence: profile.approvalEvidence,
  });
}
export async function loadPreparedBaseline(root, id = "legacy") {
  const directory = bootstrap(root).directory,
    profile = resolvePreparedBaselineProfile(id);
  const legacyPath = resolve(directory, FROZEN_MANIFEST_PATH),
    legacyBytes = await readFile(legacyPath);
  if (digest(legacyBytes) !== FROZEN_MANIFEST_SHA256)
    throw new Error("Pinned legacy baseline file hash mismatch");
  const legacy = JSON.parse(legacyBytes.toString("utf8"));
  validatePreparedBaselineRecord(legacy, legacy.sourcesBefore, "legacy");
  const recordPath = resolve(directory, profile.recordPath),
    bytes = id === "legacy" ? legacyBytes : await readFile(recordPath);
  if (digest(bytes) !== profile.recordSha256)
    throw new Error("Registered baseline record file hash mismatch");
  const checked = validatePreparedBaselineRecord(
    JSON.parse(bytes.toString("utf8")),
    legacy.sourcesBefore,
    id,
  );
  if (
    profile.approvalEvidence &&
    digest(await readFile(resolve(directory, profile.approvalEvidence.path))) !==
      profile.approvalEvidence.sha256
  )
    throw new Error("Registered baseline approval evidence file hash mismatch");
  if (digest(await readFile(resolve(directory, HELPER_PATH))) !== STATIC_HELPER_SHA256)
    throw new Error("Qualified prepared25 static helper changed");
  return frozenClone({
    profile,
    sources: checked.sources,
    recordPath,
    recordSha256: profile.recordSha256,
    legacyPath,
    legacySha256: FROZEN_MANIFEST_SHA256,
  });
}

function bootstrap(root) {
  if (typeof root !== "string" || !isAbsolute(root) || root.includes("\0"))
    throw new Error("Prepared driver root must be an absolute workspace path");
  const directory = resolve(root);
  return {
    directory,
    config: pathToFileURL(resolve(directory, "tests/audio-runtime/cross-engine.config.mjs")).href,
    report: pathToFileURL(resolve(directory, "tests/audio-runtime/cross-engine-report.mjs")).href,
    helper: pathToFileURL(resolve(directory, HELPER_PATH)).href,
  };
}

function replacements(root) {
  const paths = bootstrap(root);
  return [
    {
      name: "root",
      from: 'const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));',
      to: `const root = ${JSON.stringify(paths.directory)};`,
    },
    {
      name: "configImport",
      from: 'from "./cross-engine.config.mjs";',
      to: `from ${JSON.stringify(paths.config)};`,
    },
    {
      name: "reportImport",
      from: 'from "./cross-engine-report.mjs";',
      to: `from ${JSON.stringify(paths.report)};`,
    },
    {
      name: "createServerImport",
      from: 'const { createServer } = await import("vite");',
      to: `const { createServer } = await import(${JSON.stringify(paths.helper)});`,
    },
  ];
}

/** Four exact bootstrap substitutions; no stage body is copied or regenerated. */
export function buildPreparedDriverSource(originalSource, root) {
  if (typeof originalSource !== "string" || digest(originalSource) !== ORIGINAL_DRIVER_SHA256)
    throw new Error("Original runner bytes do not match the pinned driver SHA-256");
  let generated = originalSource;
  for (const replacement of replacements(root)) {
    const first = generated.indexOf(replacement.from);
    if (first < 0 || generated.lastIndexOf(replacement.from) !== first)
      throw new Error(`Expected exactly one ${replacement.name} bootstrap replacement`);
    generated =
      generated.slice(0, first) + replacement.to + generated.slice(first + replacement.from.length);
  }
  return generated;
}

function normalizedAst(source, root, generated) {
  const paths = bootstrap(root);
  const file = ts.createSourceFile(
    "driver.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (file.parseDiagnostics.length) throw new Error("Driver has a JavaScript parse diagnostic");
  const normalized = new Map();
  const counts = { root: 0, configImport: 0, reportImport: 0, createServerImport: 0 };
  const mark = (node, label) => {
    counts[label]++;
    normalized.set(node, label);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text === (generated ? paths.config : "./cross-engine.config.mjs"))
        mark(node.moduleSpecifier, "configImport");
      if (node.moduleSpecifier.text === (generated ? paths.report : "./cross-engine-report.mjs"))
        mark(node.moduleSpecifier, "reportImport");
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name) && node.name.text === "root") mark(node.initializer, "root");
      if (
        ts.isObjectBindingPattern(node.name) &&
        node.name.elements.length === 1 &&
        ts.isIdentifier(node.name.elements[0].name) &&
        node.name.elements[0].name.text === "createServer" &&
        ts.isAwaitExpression(node.initializer) &&
        ts.isCallExpression(node.initializer.expression)
      ) {
        const call = node.initializer.expression;
        if (
          call.expression.kind === ts.SyntaxKind.ImportKeyword &&
          call.arguments.length === 1 &&
          ts.isStringLiteral(call.arguments[0]) &&
          call.arguments[0].text === (generated ? paths.helper : "vite")
        )
          mark(call.arguments[0], "createServerImport");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  for (const [label, count] of Object.entries(counts))
    if (count !== 1) throw new Error(`AST requires exactly one ${label} bootstrap node`);
  const canonical = (node) => {
    if (normalized.has(node)) return ["ALLOWED_BOOTSTRAP", normalized.get(node)];
    const children = [];
    ts.forEachChild(node, (child) => {
      children.push(canonical(child));
    });
    return [node.kind, children.length ? null : node.getText(file), children];
  };
  return { ast: JSON.stringify(canonical(file)), counts };
}

/** Both byte equality outside the four edits and a full normalized AST are required. */
export function assertPreparedDriverConformance(originalSource, generatedSource, root) {
  const expected = buildPreparedDriverSource(originalSource, root);
  if (typeof generatedSource !== "string" || generatedSource !== expected)
    throw new Error("Prepared driver has changes beyond the four exact bootstrap replacements");
  const original = normalizedAst(originalSource, root, false);
  const generated = normalizedAst(generatedSource, root, true);
  if (original.ast !== generated.ast)
    throw new Error("Prepared driver full AST differs outside the four bootstrap nodes");
  return {
    conformant: true,
    originalSha256: digest(originalSource),
    generatedSha256: digest(generatedSource),
    replacementCounts: generated.counts,
    normalizedAstSha256: digest(original.ast),
  };
}

async function main() {
  const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const argumentsList = process.argv.slice(2);
  const options = { run: false, output: null, preparedManifest: null, baseline: "legacy" };
  for (let index = 0; index < argumentsList.length; index++) {
    const argument = argumentsList[index];
    if (argument === "--prepare") continue;
    if (argument === "--run") {
      options.run = true;
      continue;
    }
    const key = {
      "--output": "output",
      "--prepared-manifest": "preparedManifest",
      "--baseline": "baseline",
    }[argument];
    if (!key) throw new Error(`Unknown argument: ${argument}`);
    const value = argumentsList[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing ${argument} value`);
    options[key] = value;
  }
  const within = (value) => {
    const path = resolve(root, value);
    if (path === root || !path.startsWith(root + sep))
      throw new Error("Prepared V2 paths must stay within the workspace");
    return path;
  };
  const output = within(
    options.output ??
      `artifacts/v1/prepared-native-v2-${options.run ? "run" : "prepare"}-${new Date().toISOString().replace(/[^0-9]/g, "")}`,
  );
  resolvePreparedBaselineProfile(options.baseline);
  if (existsSync(output)) throw new Error("Prepared V2 requires a fresh evidence directory");
  await mkdir(output, { recursive: true });
  const write = (name, value) =>
    writeFile(
      resolve(output, name),
      typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    );
  const shaFile = async (path) => digest(await readFile(path));
  const snapshot = async (paths) =>
    Object.fromEntries(
      await Promise.all(paths.map(async (path) => [path, await shaFile(within(path))])),
    );
  const errors = [];
  let stage = "frozen-source-preflight";
  let receipt = null,
    childResult = null,
    actualChild = null,
    actualClose = null,
    originalVerification = null,
    originalVerificationSha256 = null,
    originalSources = null,
    sourcesAfter = null,
    supplementalSources = null,
    supplementalSourcesAfter = null,
    manifestPath = null,
    manifestSha256 = null,
    manifestSha256After = null,
    preparationProcess = null,
    executable = null,
    executableSha256 = null,
    executableSha256After = null,
    browserProcess = null,
    conformance = null;
  const startedAt = new Date().toISOString();
  try {
    const baseline = await loadPreparedBaseline(root, options.baseline);
    const frozenPath = baseline.recordPath;
    originalSources = baseline.sources;
    const sourcePaths = Object.keys(originalSources);
    if (JSON.stringify(await snapshot(sourcePaths)) !== JSON.stringify(originalSources))
      throw new Error("Current checkout differs from Root-frozen original23 before preparation");
    const originalPath = within("tests/audio-runtime/run-cross-engine.mjs");
    const originalSource = await readFile(originalPath, "utf8");
    const generatedSource = buildPreparedDriverSource(originalSource, root);
    conformance = assertPreparedDriverConformance(originalSource, generatedSource, root);
    const driverPath = resolve(output, "original-driver-v2.mjs");
    await writeFile(driverPath, generatedSource);
    await write("driver-conformance-v2.json", conformance);
    supplementalSources = await snapshot([
      "tests/audio-runtime/run-prepared-native-v2.mjs",
      HELPER_PATH,
      "tests/audio-runtime/prepared-native-v2.test.mjs",
      OBSERVER_PATH,
      "scripts/agents/process-runner.mjs",
      "tsconfig.json",
    ]);
    if (supplementalSources[OBSERVER_PATH] !== OBSERVER_SHA256)
      throw new Error("Approved passive observer SHA-256 mismatch");
    const helper = await import(bootstrap(root).helper);
    stage = "node-only-static-preparation";
    if (options.preparedManifest) {
      manifestPath = within(options.preparedManifest);
      await helper.verifyPreparedStaticFixtureV2(manifestPath, {
        root,
        expectedOriginalSources: originalSources,
      });
    } else {
      const prepared = await helper.prepareStaticFixtureV2(output, {
        root,
        timeoutMs: 60000,
        originalSources,
      });
      manifestPath = prepared.manifestPath;
    }
    preparationProcess = JSON.parse(
      await readFile(resolve(dirname(manifestPath), "build-process.json"), "utf8"),
    );
    if (
      preparationProcess.exit_code !== 0 ||
      preparationProcess.signal ||
      preparationProcess.timed_out ||
      preparationProcess.cancelled ||
      preparationProcess.output_limit ||
      preparationProcess.spawn_error ||
      preparationProcess.process_stopped !== true
    )
      throw new Error("Prepared build lacks a successful retained native Node close receipt");
    const manifest = await helper.verifyPreparedStaticFixtureV2(manifestPath, {
      root,
      expectedOriginalSources: originalSources,
    });
    manifestSha256 = await shaFile(manifestPath);
    const browserManifest = JSON.parse(
      await readFile(within("node_modules/playwright-core/browsers.json"), "utf8"),
    );
    const shell = browserManifest.browsers.find(
      (browser) => browser.name === "chromium-headless-shell",
    );
    if (process.platform !== "win32" || process.arch !== "x64" || !shell?.revision)
      throw new Error("This qualification binds the approved Windows x64 Chromium headless shell");
    const cache = "C:\\Users\\kevin\\AppData\\Local\\ms-playwright";
    executable = resolve(
      cache,
      `chromium_headless_shell-${shell.revision}`,
      "chrome-headless-shell-win64",
      "chrome-headless-shell.exe",
    );
    if (!existsSync(executable))
      throw new Error("Approved cached headless shell missing; no installation authorized");
    executableSha256 = await shaFile(executable);
    receipt = {
      version: VERSION,
      mode: options.run ? "RUN_REQUESTED" : "PREPARED_NO_BROWSER_LAUNCH",
      createdAt: new Date().toISOString(),
      browserLaunched: false,
      root,
      output,
      frozenManifestPath: frozenPath,
      frozenManifestSha256: baseline.recordSha256,
      baselineId: baseline.profile.baselineId,
      baselineProfile: options.baseline,
      approvedDelta: baseline.profile.approvedDelta,
      approvalEvidence: baseline.profile.approvalEvidence,
      originalSources,
      supplementalSources,
      driverPath,
      conformance,
      manifestPath,
      manifestSha256,
      reusedPreparedManifest: Boolean(options.preparedManifest),
      preparationProcess,
      preparedEntries: manifest.entries.map((entry) => ({
        url: entry.url,
        sha256: entry.sha256,
        bytes: entry.bytes,
      })),
      expectedBrowser: {
        name: shell.name,
        revision: shell.revision,
        version: shell.browserVersion,
        executable,
        executableSha256,
      },
      observerSha256: OBSERVER_SHA256,
      limitations: [
        "Prepared static transport only; original stage order/deadlines/oracles retained",
        "No original Firefox FAIL is overturned; no App/hearing/device/Worklet/API acceptance",
      ],
    };
    await write("wrapper-preparation-v2.json", receipt);
    if (options.run) {
      stage = "unchanged-original25-driver";
      const args = [
        "--import",
        pathToFileURL(within(OBSERVER_PATH)).href,
        driverPath,
        "--run",
        "--engines",
        "chromium",
        "--output",
        relative(root, output),
      ];
      const nativeSpawn = childProcess.spawn;
      childProcess.spawn = function (...spawnArgs) {
        const child = Reflect.apply(nativeSpawn, this, spawnArgs);
        if (
          spawnArgs[0] === process.execPath &&
          Array.isArray(spawnArgs[1]) &&
          spawnArgs[1].includes(driverPath)
        ) {
          actualChild = {
            pid: child.pid,
            file: spawnArgs[0],
            args: spawnArgs[1],
            spawnedAt: new Date().toISOString(),
          };
          writeFileSync(
            resolve(output, "actual-node-start.json"),
            JSON.stringify(actualChild, null, 2) + "\n",
          );
          process.stdout.write(
            JSON.stringify({
              event: "ACTUAL_PREPARED_V2_NODE_START",
              version: VERSION,
              output,
              ...actualChild,
            }) + "\n",
          );
          child.once("close", (exitCode, signal) => {
            actualClose = {
              exitCode,
              signal,
              observedAt: new Date().toISOString(),
              provenance: "Retained Node ChildProcess close event",
            };
            writeFileSync(
              resolve(output, "actual-node-close.json"),
              JSON.stringify(actualClose, null, 2) + "\n",
            );
          });
        }
        return child;
      };
      syncBuiltinESMExports();
      const controller = new AbortController();
      const cancel = () => controller.abort();
      process.once("SIGINT", cancel);
      process.once("SIGTERM", cancel);
      try {
        const { runProcess } = await import(
          pathToFileURL(within("scripts/agents/process-runner.mjs")).href
        );
        childResult = await runProcess({
          file: process.execPath,
          args,
          cwd: root,
          timeoutMs: 600000,
          maxOutputBytes: 4 * 1024 * 1024,
          signal: controller.signal,
          env: {
            PREPARED_STATIC_FIXTURE_MANIFEST: manifestPath,
            PLAYWRIGHT_BROWSERS_PATH: cache,
            DEBUG: "pw:browser*",
            AUDIO_QUALIFICATION_OBSERVER_DIR: output,
          },
        });
      } finally {
        childProcess.spawn = nativeSpawn;
        syncBuiltinESMExports();
        process.removeListener("SIGINT", cancel);
        process.removeListener("SIGTERM", cancel);
      }
      await write("stdout.txt", childResult.stdout);
      await write("stderr.txt", childResult.stderr);
      await write("actual-process-result-v2.json", {
        command: [process.execPath, ...args],
        actualChild,
        actualClose,
        ...childResult,
      });
      const observerBytes = await readFile(resolve(output, "observer.jsonl"));
      if (observerBytes.length > 256 * 1024)
        throw new Error("Passive observer output exceeded its pinned byte cap");
      const events = observerBytes
        .toString("utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      if (events.length > 512)
        throw new Error("Passive observer output exceeded its pinned record cap");
      const processes = events.filter((event) => event.event === "owned-browser-server-process");
      if (processes.length !== 1 || !Number.isSafeInteger(processes[0].browserPid))
        throw new Error("Expected exactly one observed original BrowserServer process");
      browserProcess = processes[0];
      if (resolve(browserProcess.spawnfile).toLowerCase() !== executable.toLowerCase())
        throw new Error(
          "Observed BrowserServer executable is not the approved cached headless shell",
        );
      const originalVerificationPath = resolve(output, "verification.json");
      const originalVerificationBytes = await readFile(originalVerificationPath);
      originalVerificationSha256 = digest(originalVerificationBytes);
      originalVerification = JSON.parse(originalVerificationBytes.toString("utf8"));
    }
    stage = "post-source-and-bundle-verification";
    sourcesAfter = await snapshot(Object.keys(originalSources));
    supplementalSourcesAfter = await snapshot(Object.keys(supplementalSources));
    manifestSha256After = await shaFile(manifestPath);
    executableSha256After = await shaFile(executable);
    await helper.verifyPreparedStaticFixtureV2(manifestPath, {
      root,
      expectedOriginalSources: originalSources,
    });
    await loadPreparedBaseline(root, options.baseline);
    assertPreparedDriverConformance(originalSource, await readFile(driverPath, "utf8"), root);
    if (JSON.stringify(sourcesAfter) !== JSON.stringify(originalSources))
      throw new Error("Root-frozen original23 changed during V2 qualification");
    if (JSON.stringify(supplementalSourcesAfter) !== JSON.stringify(supplementalSources))
      throw new Error("Prepared wrapper/helper/conformance/observer closure changed");
    if (manifestSha256After !== manifestSha256) throw new Error("Prepared manifest bytes changed");
    if (executableSha256After !== executableSha256)
      throw new Error("Expected native executable bytes changed");
  } catch (error) {
    errors.push({
      stage,
      name: error?.name ?? "Error",
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
    });
  }
  const retainedExitMatches = Boolean(
    actualChild &&
      actualClose &&
      childResult &&
      actualClose.exitCode === childResult.exit_code &&
      actualClose.signal === childResult.signal,
  );
  let original25Passed = false;
  if (originalVerification) {
    const engine = originalVerification.engines?.[0];
    const suites = Array.isArray(engine?.suites) ? engine.suites : [];
    const cases = suites.flatMap((suite) => suite.cases ?? []);
    const { NATIVE_AUDIO_SUITES } = await import(
      pathToFileURL(within("tests/audio-runtime/cross-engine.config.mjs")).href
    );
    const expectedSuiteIds = NATIVE_AUDIO_SUITES.map((suite) => suite.id);
    const expectedCaseIds = NATIVE_AUDIO_SUITES.flatMap((suite) =>
      suite.cases.map((entry) => entry.id),
    );
    original25Passed =
      originalVerification.status === "PASS" &&
      originalVerification.exitCode === 0 &&
      originalVerification.passedChecks === 25 &&
      originalVerification.expectedChecks === 25 &&
      originalVerification.sourceStable === true &&
      !originalVerification.runnerError &&
      !originalVerification.interrupted &&
      originalVerification.engines.length === 1 &&
      engine.engine === "chromium" &&
      suites.length === 6 &&
      new Set(suites.map((suite) => suite.suite)).size === 6 &&
      expectedSuiteIds.every((id) =>
        suites.some((suite) => suite.suite === id && suite.status === "PASS"),
      ) &&
      cases.length === 25 &&
      new Set(cases.map((entry) => entry.id)).size === 25 &&
      expectedCaseIds.every((id) =>
        cases.some((entry) => entry.id === id && entry.status === "PASS"),
      ) &&
      Array.isArray(originalVerification.cleanup) &&
      originalVerification.cleanup.length >= 2 &&
      originalVerification.cleanup.every((entry) => entry.ok === true) &&
      originalVerification.cleanup.some(
        (entry) =>
          entry.resource === "browser" &&
          entry.pid === browserProcess?.browserPid &&
          entry.method === "close",
      ) &&
      originalVerification.cleanup.some((entry) => entry.resource === "source-server");
  }
  const nativeProcessPassed = Boolean(
    retainedExitMatches &&
      childResult.exit_code === 0 &&
      !childResult.signal &&
      !childResult.timed_out &&
      !childResult.cancelled &&
      !childResult.output_limit &&
      !childResult.spawn_error &&
      childResult.process_stopped === true,
  );
  const status = errors.length
    ? "ERROR"
    : !options.run
      ? "PREPARED_NO_BROWSER_LAUNCH"
      : original25Passed && nativeProcessPassed
        ? "PASS"
        : originalVerification?.status === "FAIL"
          ? "FAIL"
          : "ERROR";
  const verification = {
    version: VERSION,
    baselineProfile: options.baseline,
    baseline: resolvePreparedBaselineProfile(options.baseline),
    status,
    exitCode: status === "PASS" || status === "PREPARED_NO_BROWSER_LAUNCH" ? 0 : 1,
    startedAt,
    endedAt: new Date().toISOString(),
    browserLaunched: Boolean(browserProcess),
    original25Passed,
    nativeProcessPassed,
    originalStatus: originalVerification?.status ?? null,
    originalVerificationSha256,
    actualChild,
    actualClose,
    browserProcess,
    retainedExitMatches,
    originalSources,
    sourcesAfter,
    source23Stable: Boolean(
      originalSources &&
        sourcesAfter &&
        JSON.stringify(originalSources) === JSON.stringify(sourcesAfter),
    ),
    supplementalSources,
    supplementalSourcesAfter,
    manifestPath,
    manifestSha256,
    manifestSha256After,
    bundlesAndManifestStable: Boolean(
      manifestSha256 &&
        manifestSha256 === manifestSha256After &&
        !errors.some((error) => error.stage === "post-source-and-bundle-verification"),
    ),
    executable,
    executableSha256,
    executableSha256After,
    conformance,
    preparationProcess,
    errors,
    limitations: receipt?.limitations ?? ["Preparation failed; no native acceptance is inferred"],
  };
  await write("wrapper-verification-v2.json", verification);
  process.stdout.write(`${relative(root, output)}: ${status}\n`);
  process.exitCode = verification.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
