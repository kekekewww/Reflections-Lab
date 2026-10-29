import { createHash } from "node:crypto";
import childProcess from "node:child_process";
import { createReadStream, existsSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { loadPreparedBaseline, resolvePreparedBaselineProfile } from "./run-prepared-native-v2.mjs";
import { NATIVE_AUDIO_SUITES } from "./cross-engine.config.mjs";

export const ORIGINAL_IR_DRIVER_SHA256 =
  "aa4dd31d11833a4b8bff0414ec1b4db08f621ff2e502ca09afd7bf8ffce249eb";
const HELPER_PATH = "tests/audio-runtime/prepared-ir-static-v1.mjs";
const QUALIFIED_V2_PATH =
  "artifacts/v1/audio-prepared-native-v2-20261027154159861/wrapper-verification-v2.json";
const QUALIFIED_V2_SHA256 = "b5e6914c13c6ee826a80ebe93dd3869498608ff31121b7e780f5548c7feec63d";
const VERSION = "NATIVE_IR_STATE_VIA_PREPARED_STATIC_V1";
const FIXED_IR_SOURCES = {
  "tests/audio-runtime/native-ir-state-reference-v1.ts":
    "ea3dfb59556d5ee58877d7d807854d5881f87c80fb10038fc2af9a158b43c607",
  "tests/audio-runtime/ir-state-reference-v1-data.ts":
    "0e8d748019448d5a7ac19bd1dbfa085f946ab8875c8bc765c10db4078a56b171",
  "tests/audio-runtime/ir-state-reference-v1.test.ts":
    "080038408a4078f9d5ab33d4ba13e57641af08dd17e07bc8814fc6eefcff05a7",
  "tests/audio-runtime/run-ir-state-reference-v1.mjs": ORIGINAL_IR_DRIVER_SHA256,
};
const OLD_SUITE_PATHS = [
  "browser.ts",
  "native-pause.ts",
  "native-reverb.ts",
  "native-continuity.ts",
  "native-restore.ts",
  "native-wave.ts",
].map((name) => `tests/audio-runtime/${name}`);
const EXPECTED_CHECK_IDS = [
  "native-identical-ir-impulse-tail",
  "native-identical-ir-continuous-tone-scale-20ms",
  "native-changed-ir-bank-reverse",
];
const EXPECTED_RENDER_IDS = EXPECTED_CHECK_IDS.flatMap((id) => [`${id}:actual`, `${id}:reference`]);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const IR_V2_SHA256 = "05b7940ca4b16f77e3ef20861429529a7e6b39e7466b49e64f356e4b897a778e";
const CURRENT_25_UTILITY_PATHS = [
  "tests/audio-runtime/run-prepared-native-v2.mjs",
  "tests/audio-runtime/prepared-static-fixture-v2.mjs",
  "tests/audio-runtime/prepared-native-v2.test.mjs",
  ".cache/v1/audio-qualification-observer.mjs",
  "scripts/agents/process-runner.mjs",
  "tsconfig.json",
];
export function validatePreparedIrQualificationReceipt(
  receipt,
  originalVerification,
  expectedSources,
  baselineId = "prefix-f3e5",
) {
  const profile = resolvePreparedBaselineProfile(baselineId);
  const expectedMapSha =
    baselineId === "legacy"
      ? "0c66e6e5aa98450c5f3b3b4f3759d4a20c496d083e93457059b10d20d39b91d8"
      : "77bf0c02ee699c7a1b9cffce3a61ee5f08b155ddec1efdb46f471d1d482fa74a";
  if (digest(JSON.stringify(expectedSources)) !== expectedMapSha)
    throw new Error("Qualification expected sources are not the registered Root map");
  if (
    receipt?.version !== "ORIGINAL25_VIA_PREPARED_STATIC_V2" ||
    receipt.status !== "PASS" ||
    receipt.exitCode !== 0 ||
    receipt.original25Passed !== true ||
    receipt.nativeProcessPassed !== true ||
    receipt.source23Stable !== true ||
    receipt.bundlesAndManifestStable !== true ||
    receipt.errors?.length !== 0 ||
    JSON.stringify(receipt.originalSources) !== JSON.stringify(expectedSources) ||
    JSON.stringify(receipt.sourcesAfter) !== JSON.stringify(expectedSources) ||
    receipt.retainedExitMatches !== true ||
    receipt.actualClose?.exitCode !== 0 ||
    receipt.actualClose?.signal !== null ||
    !Number.isSafeInteger(receipt.actualChild?.pid) ||
    receipt.actualChild.pid <= 0 ||
    JSON.stringify(receipt.supplementalSources) !==
      JSON.stringify(receipt.supplementalSourcesAfter) ||
    JSON.stringify(Object.keys(receipt.supplementalSources ?? {}).sort()) !==
      JSON.stringify([...CURRENT_25_UTILITY_PATHS].sort())
  )
    throw new Error(
      "Qualified25 receipt lacks successful current source/native-close/bundle proof",
    );
  if (
    baselineId === "prefix-f3e5" &&
    (receipt.baselineProfile !== baselineId ||
      JSON.stringify(receipt.baseline) !== JSON.stringify(profile))
  )
    throw new Error("Fresh qualification baseline registration mismatch");
  const engines = originalVerification?.engines,
    engine = engines?.[0],
    suites = engine?.suites,
    cases = Array.isArray(suites) ? suites.flatMap((suite) => suite.cases ?? []) : [];
  const ids = NATIVE_AUDIO_SUITES.flatMap((suite) => suite.cases.map((entry) => entry.id));
  if (
    originalVerification?.status !== "PASS" ||
    originalVerification.exitCode !== 0 ||
    originalVerification.expectedChecks !== 25 ||
    originalVerification.passedChecks !== 25 ||
    originalVerification.sourceStable !== true ||
    originalVerification.runnerError ||
    originalVerification.interrupted ||
    JSON.stringify(originalVerification.sourcesBefore) !== JSON.stringify(expectedSources) ||
    JSON.stringify(originalVerification.sourcesAfter) !== JSON.stringify(expectedSources) ||
    !Array.isArray(engines) ||
    engines.length !== 1 ||
    engine.engine !== "chromium" ||
    !Array.isArray(suites) ||
    suites.length !== 6 ||
    new Set(suites.map((suite) => suite.suite)).size !== 6 ||
    !NATIVE_AUDIO_SUITES.every((suite) =>
      suites.some((entry) => entry.suite === suite.id && entry.status === "PASS"),
    ) ||
    cases.length !== 25 ||
    new Set(cases.map((entry) => entry.id)).size !== 25 ||
    !ids.every((id) => cases.some((entry) => entry.id === id && entry.status === "PASS")) ||
    !Array.isArray(originalVerification.cleanup) ||
    originalVerification.cleanup.length < 2 ||
    !originalVerification.cleanup.every((entry) => entry.ok === true) ||
    !originalVerification.cleanup.some(
      (entry) =>
        entry.resource === "browser" &&
        entry.method === "close" &&
        entry.pid === receipt.browserProcess?.browserPid,
    ) ||
    !originalVerification.cleanup.some((entry) => entry.resource === "source-server")
  )
    throw new Error(
      "Adjacent original25 verification lacks all IDs, cleanup or registered source proof",
    );
  return Object.freeze({ valid: true, baselineId: profile.baselineId, originalCaseCount: 25 });
}
export function resolvePreparedIrProfile(id = "v1") {
  if (id !== "v1" && id !== "v2") throw new Error("Unknown prepared IR profile enum");
  return Object.freeze({
    id,
    preparedVersion: id === "v1" ? VERSION : "NATIVE_IR_STATE_VIA_PREPARED_STATIC_V2",
    referenceVersion: `native-ir-state-reference-${id}`,
    entryUrl: `/tests/audio-runtime/native-ir-state-reference-${id}.ts`,
    exportName: "runNativeIrStateReferenceV1",
    fixtureSha256:
      id === "v1"
        ? FIXED_IR_SOURCES["tests/audio-runtime/native-ir-state-reference-v1.ts"]
        : IR_V2_SHA256,
  });
}
export function assertPreparedIrFixtureConformance(v1Source, v2Source) {
  if (
    typeof v1Source !== "string" ||
    digest(v1Source) !== FIXED_IR_SOURCES["tests/audio-runtime/native-ir-state-reference-v1.ts"]
  )
    throw new Error("Pinned original IR V1 fixture changed");
  let expected = v1Source;
  const edits = [
    ["  IR_STATE_REFERENCE_VERSION,\n", ""],
    [
      '} from "./ir-state-reference-v1-data.js";\n\n',
      '} from "./ir-state-reference-v1-data.js";\n\nconst IR_STATE_REFERENCE_VERSION = "native-ir-state-reference-v2";\n\n',
    ],
    [
      "levels[i]!.gain.setValueAtTime(i === 0 ? 1 : 0, 0);",
      "levels[i]!.gain.value = i === 0 ? 1 : 0;",
    ],
  ];
  for (const [from, to] of edits) {
    const index = expected.indexOf(from);
    if (index < 0 || expected.lastIndexOf(from) !== index)
      throw new Error("IR V2 derivation anchor changed");
    expected = expected.slice(0, index) + to + expected.slice(index + from.length);
  }
  if (v2Source !== expected || digest(v2Source) !== IR_V2_SHA256)
    throw new Error("IR V2 differs beyond fixed version metadata and inactive bank initialization");
  return {
    conformant: true,
    v1Sha256: digest(v1Source),
    v2Sha256: digest(v2Source),
    changes: ["referenceVersionMetadata", "inactiveBankGainInitialization"],
  };
}

function bootstrap(root) {
  if (typeof root !== "string" || !isAbsolute(root) || root.includes("\0"))
    throw new Error("Prepared IR root must be an absolute workspace path");
  const directory = resolve(root);
  return { directory, helper: pathToFileURL(resolve(directory, HELPER_PATH)).href };
}
function replacements(root, profileId = "v1") {
  const paths = bootstrap(root);
  const profile = resolvePreparedIrProfile(profileId);
  const edits = [
    {
      name: "root",
      from: 'const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));',
      to: `const root = ${JSON.stringify(paths.directory)};`,
    },
    {
      name: "createServerImport",
      from: 'const { createServer } = await import("vite");',
      to: `const { createServer } = await import(${JSON.stringify(paths.helper)});`,
    },
  ];
  if (profileId === "v2")
    edits.push(
      {
        name: "expectedReferenceVersion",
        from: 'const referenceVersion = "native-ir-state-reference-v1";',
        to: `const referenceVersion = ${JSON.stringify(profile.referenceVersion)};`,
      },
      {
        name: "sourceEntry",
        from: '"tests/audio-runtime/native-ir-state-reference-v1.ts"',
        to: JSON.stringify(profile.entryUrl.slice(1)),
      },
      {
        name: "moduleUrl",
        from: '"/tests/audio-runtime/native-ir-state-reference-v1.ts"',
        to: JSON.stringify(profile.entryUrl),
      },
    );
  return edits;
}
export function buildPreparedIrDriverSource(originalSource, root, profileId = "v1") {
  if (typeof originalSource !== "string" || digest(originalSource) !== ORIGINAL_IR_DRIVER_SHA256)
    throw new Error("Original IR runner bytes do not match pinned SHA-256");
  let generated = originalSource;
  for (const replacement of replacements(root, profileId)) {
    const first = generated.indexOf(replacement.from);
    if (first < 0 || generated.lastIndexOf(replacement.from) !== first)
      throw new Error(`Expected exactly one ${replacement.name} bootstrap replacement`);
    generated =
      generated.slice(0, first) + replacement.to + generated.slice(first + replacement.from.length);
  }
  return generated;
}
function normalizedAst(source, root, generated, profileId = "v1") {
  const paths = bootstrap(root);
  const profile = resolvePreparedIrProfile(profileId);
  const file = ts.createSourceFile(
    "ir-driver.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (file.parseDiagnostics.length) throw new Error("IR driver has a JavaScript parse diagnostic");
  const normalized = new Map(),
    counts = {
      root: 0,
      createServerImport: 0,
      ...(profileId === "v2" ? { expectedReferenceVersion: 0, sourceEntry: 0, moduleUrl: 0 } : {}),
    };
  const mark = (node, label) => {
    counts[label]++;
    normalized.set(node, label);
  };
  const visit = (node) => {
    if (profileId === "v2" && ts.isStringLiteral(node)) {
      if (
        node.text ===
        (generated
          ? profile.entryUrl.slice(1)
          : "tests/audio-runtime/native-ir-state-reference-v1.ts")
      )
        mark(node, "sourceEntry");
      if (
        node.text ===
        (generated ? profile.entryUrl : "/tests/audio-runtime/native-ir-state-reference-v1.ts")
      )
        mark(node, "moduleUrl");
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name) && node.name.text === "root") mark(node.initializer, "root");
      if (
        profileId === "v2" &&
        ts.isIdentifier(node.name) &&
        node.name.text === "referenceVersion" &&
        ts.isStringLiteral(node.initializer) &&
        node.initializer.text ===
          (generated ? profile.referenceVersion : "native-ir-state-reference-v1")
      )
        mark(node.initializer, "expectedReferenceVersion");
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
export function assertPreparedIrDriverConformance(
  originalSource,
  generatedSource,
  root,
  profileId = "v1",
) {
  if (
    typeof generatedSource !== "string" ||
    generatedSource !== buildPreparedIrDriverSource(originalSource, root, profileId)
  )
    throw new Error("Prepared IR driver has changes beyond two exact bootstrap replacements");
  const original = normalizedAst(originalSource, root, false, profileId),
    generated = normalizedAst(generatedSource, root, true, profileId);
  if (original.ast !== generated.ast)
    throw new Error("Prepared IR full AST differs outside two bootstrap nodes");
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
  const options = {
    run: false,
    output: null,
    preparedManifest: null,
    baseline: "legacy",
    irProfile: "v1",
    qualifiedV2: null,
    qualifiedV2Sha256: null,
  };
  const argumentsList = process.argv.slice(2);
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
      "--ir-profile": "irProfile",
      "--qualified-v2": "qualifiedV2",
      "--qualified-v2-sha256": "qualifiedV2Sha256",
    }[argument];
    if (!key) throw new Error(`Unknown argument: ${argument}`);
    const value = argumentsList[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing ${argument} value`);
    options[key] = value;
  }
  const within = (value) => {
    const path = resolve(root, value);
    if (path === root || !path.startsWith(root + sep))
      throw new Error("Prepared IR paths must remain within workspace");
    return path;
  };
  const irProfile = resolvePreparedIrProfile(options.irProfile);
  resolvePreparedBaselineProfile(options.baseline);
  if (options.baseline === "legacy" && (options.qualifiedV2 || options.qualifiedV2Sha256))
    throw new Error("Legacy qualification uses only its fixed historical receipt");
  if (
    Boolean(options.qualifiedV2) !== Boolean(options.qualifiedV2Sha256) ||
    (options.qualifiedV2Sha256 && !/^[a-f0-9]{64}$/.test(options.qualifiedV2Sha256))
  )
    throw new Error("Qualified25 receipt identity requires a complete path/SHA-256 tuple");
  if (options.baseline === "prefix-f3e5" && options.run && !options.qualifiedV2)
    throw new Error("Prefix IR RUN requires Root-provided fresh qualified25 receipt identity");
  const output = within(
    options.output ??
      `artifacts/v1/prepared-ir-v1-${options.run ? "run" : "prepare"}-${new Date().toISOString().replace(/[^0-9]/g, "")}`,
  );
  if (existsSync(output)) throw new Error("Prepared IR requires a fresh evidence directory");
  await mkdir(output, { recursive: true });
  const write = (name, value) =>
    writeFile(
      resolve(output, name),
      typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    );
  const shaFile = async (path) => {
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(path)) hash.update(bytes);
    return hash.digest("hex");
  };
  const snapshot = async (paths) =>
    Object.fromEntries(
      await Promise.all(paths.map(async (path) => [path, await shaFile(within(path))])),
    );
  const errors = [];
  let stage = "qualified-v2-and-original-ir-preflight";
  let originalSources = null,
    sourcesAfter = null,
    supplementalSources = null,
    supplementalSourcesAfter = null,
    qualifiedBindings = null,
    qualifiedBindingsAfter = null,
    qualifiedReceiptAfterSha = null,
    conformance = null,
    manifestPath = null,
    manifestSha256 = null,
    manifestSha256After = null,
    preparationProcess = null,
    childResult = null,
    actualChild = null,
    actualClose = null,
    originalVerification = null,
    originalVerificationSha256 = null,
    rawResult = null,
    rawResultSha256 = null,
    executable = null,
    executableSha256 = null,
    executableSha256After = null,
    driverPath = null;
  const qualifiedPath =
    options.baseline === "legacy"
      ? within(QUALIFIED_V2_PATH)
      : options.qualifiedV2
        ? within(options.qualifiedV2)
        : null;
  const qualificationSha256 =
    options.baseline === "legacy" ? QUALIFIED_V2_SHA256 : options.qualifiedV2Sha256;
  if (qualifiedPath && !qualifiedPath.startsWith(resolve(root, "artifacts/v1") + sep))
    throw new Error("Qualified25 identity must name a workspace artifact receipt");
  const startedAt = new Date().toISOString();
  try {
    const baseline = await loadPreparedBaseline(root, options.baseline);
    const liveUtility = await snapshot(CURRENT_25_UTILITY_PATHS);
    if (qualifiedPath) {
      const qualifiedBytes = await readFile(qualifiedPath);
      if (digest(qualifiedBytes) !== qualificationSha256)
        throw new Error("Root-provided qualified25 receipt artifact SHA-256 mismatch");
      const qualified = JSON.parse(qualifiedBytes.toString("utf8"));
      const adjacentBytes = await readFile(resolve(dirname(qualifiedPath), "verification.json"));
      if (digest(adjacentBytes) !== qualified.originalVerificationSha256)
        throw new Error("Adjacent original25 verification file hash mismatch");
      validatePreparedIrQualificationReceipt(
        qualified,
        JSON.parse(adjacentBytes.toString("utf8")),
        baseline.sources,
        options.baseline,
      );
      if (
        options.baseline === "prefix-f3e5" &&
        JSON.stringify(liveUtility) !== JSON.stringify(qualified.supplementalSources)
      )
        throw new Error("Fresh qualified25 utility snapshot differs from current revision");
    }
    qualifiedBindings = { ...baseline.sources, ...liveUtility };
    if (
      JSON.stringify(await snapshot(Object.keys(qualifiedBindings))) !==
      JSON.stringify(qualifiedBindings)
    )
      throw new Error("Qualified V2 source/helper/wrapper closure changed");
    const audioPaths = Object.keys(baseline.sources).filter((path) =>
      /^src\/audio\/[^/]+\.ts$/.test(path),
    );
    if (audioPaths.length !== 9)
      throw new Error("Qualified V2 must bind exactly nine audio source files");
    const protectedPaths = [
      ...audioPaths,
      ...OLD_SUITE_PATHS,
      "package-lock.json",
      "node_modules/playwright-core/browsers.json",
    ];
    if (
      protectedPaths.length !== 17 ||
      protectedPaths.some((path) => typeof baseline.sources[path] !== "string")
    )
      throw new Error("Qualified V2 protected original17 closure incomplete");
    if (
      JSON.stringify(await snapshot(Object.keys(FIXED_IR_SOURCES))) !==
      JSON.stringify(FIXED_IR_SOURCES)
    )
      throw new Error("Protected original IR V1/data/test/runner changed");
    const fixtureSources = { ...FIXED_IR_SOURCES };
    let fixtureConformance = null;
    if (options.irProfile === "v2") {
      fixtureConformance = assertPreparedIrFixtureConformance(
        await readFile(within("tests/audio-runtime/native-ir-state-reference-v1.ts"), "utf8"),
        await readFile(within(irProfile.entryUrl.slice(1)), "utf8"),
      );
      delete fixtureSources["tests/audio-runtime/native-ir-state-reference-v1.ts"];
      fixtureSources[irProfile.entryUrl.slice(1)] = irProfile.fixtureSha256;
    }
    originalSources = Object.fromEntries(
      [
        ...protectedPaths.map((path) => [path, baseline.sources[path]]),
        ...Object.entries(fixtureSources),
      ].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    );
    if (
      Object.keys(originalSources).length !== 21 ||
      JSON.stringify(await snapshot(Object.keys(originalSources))) !==
        JSON.stringify(originalSources)
    )
      throw new Error("Root-frozen original IR21 differs before preparation");
    const originalSource = await readFile(
      within("tests/audio-runtime/run-ir-state-reference-v1.mjs"),
      "utf8",
    );
    const generatedSource = buildPreparedIrDriverSource(originalSource, root, options.irProfile);
    conformance = assertPreparedIrDriverConformance(
      originalSource,
      generatedSource,
      root,
      options.irProfile,
    );
    driverPath = resolve(output, "original-ir-driver-v1.mjs");
    await writeFile(driverPath, generatedSource);
    await write("driver-conformance-ir-v1.json", conformance);
    supplementalSources = await snapshot([
      "tests/audio-runtime/run-prepared-ir-v1.mjs",
      HELPER_PATH,
      "tests/audio-runtime/prepared-ir-v1.test.mjs",
      "scripts/agents/process-runner.mjs",
      "tsconfig.json",
      ...Object.keys(FIXED_IR_SOURCES),
    ]);
    const helper = await import(bootstrap(root).helper);
    stage = "node-only-ir-static-preparation";
    if (options.preparedManifest) {
      manifestPath = within(options.preparedManifest);
      await helper.verifyIrStaticFixtureV1(manifestPath, {
        root,
        expectedOriginalSources: originalSources,
        irProfile: options.irProfile,
      });
    } else {
      const prepared = await helper.prepareIrStaticFixtureV1(output, {
        root,
        timeoutMs: 60000,
        originalSources,
        irProfile: options.irProfile,
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
      throw new Error("IR prepared build lacks successful retained native Node close receipt");
    const manifest = await helper.verifyIrStaticFixtureV1(manifestPath, {
      root,
      expectedOriginalSources: originalSources,
      irProfile: options.irProfile,
    });
    manifestSha256 = await shaFile(manifestPath);
    const browserManifest = JSON.parse(
      await readFile(within("node_modules/playwright-core/browsers.json"), "utf8"),
    );
    const shell = browserManifest.browsers.find(
      (entry) => entry.name === "chromium-headless-shell",
    );
    if (process.platform !== "win32" || process.arch !== "x64" || !shell?.revision)
      throw new Error("IR qualification binds approved Windows x64 headless shell only");
    const cache = "C:\\Users\\kevin\\AppData\\Local\\ms-playwright";
    executable = resolve(
      cache,
      `chromium_headless_shell-${shell.revision}`,
      "chrome-headless-shell-win64",
      "chrome-headless-shell.exe",
    );
    if (!existsSync(executable))
      throw new Error("Approved cached headless shell missing; no install authorized");
    executableSha256 = await shaFile(executable);
    await write("wrapper-preparation-ir-v1.json", {
      version: irProfile.preparedVersion,
      baselineProfile: options.baseline,
      baseline: baseline.profile,
      irProfile,
      fixtureConformance,
      mode: options.run ? "RUN_REQUESTED" : "PREPARED_NO_BROWSER_LAUNCH",
      browserLaunched: false,
      root,
      output,
      qualifiedV2Receipt: qualifiedPath,
      qualifiedV2ReceiptSha256: qualificationSha256,
      originalSources,
      supplementalSources,
      conformance,
      driverPath,
      manifestPath,
      manifestSha256,
      reusedPreparedManifest: Boolean(options.preparedManifest),
      preparationProcess,
      preparedManifestVersion: manifest.version,
      expectedBrowser: {
        name: shell.name,
        revision: shell.revision,
        version: shell.browserVersion,
        executable,
        executableSha256,
      },
      expectedCheckIds: EXPECTED_CHECK_IDS,
      expectedRenderIds: EXPECTED_RENDER_IDS,
      originalIrSuiteAndOraclesRetained: true,
    });
    if (options.run) {
      stage = "unchanged-original-ir-driver";
      const args = [driverPath, "--run", "--output", relative(root, output)];
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
              event: "ACTUAL_PREPARED_IR_V1_NODE_START",
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
      const controller = new AbortController(),
        cancel = () => controller.abort();
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
            PREPARED_IR_STATIC_MANIFEST: manifestPath,
            PREPARED_IR_STATIC_PROFILE: options.irProfile,
            PLAYWRIGHT_BROWSERS_PATH: cache,
            DEBUG: "pw:browser*",
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
      await write("actual-process-result-ir-v1.json", {
        command: [process.execPath, ...args],
        actualChild,
        actualClose,
        ...childResult,
      });
      const originalBytes = await readFile(resolve(output, "verification.json"));
      originalVerificationSha256 = digest(originalBytes);
      originalVerification = JSON.parse(originalBytes.toString("utf8"));
      const rawBytes = await readFile(resolve(output, "reference-result.json"));
      rawResultSha256 = digest(rawBytes);
      rawResult = JSON.parse(rawBytes.toString("utf8"));
    }
    stage = "post-source-and-ir-bundle-verification";
    sourcesAfter = await snapshot(Object.keys(originalSources));
    supplementalSourcesAfter = await snapshot(Object.keys(supplementalSources));
    qualifiedBindingsAfter = await snapshot(Object.keys(qualifiedBindings));
    qualifiedReceiptAfterSha = qualifiedPath ? await shaFile(qualifiedPath) : null;
    manifestSha256After = await shaFile(manifestPath);
    executableSha256After = await shaFile(executable);
    await helper.verifyIrStaticFixtureV1(manifestPath, {
      root,
      expectedOriginalSources: originalSources,
      irProfile: options.irProfile,
    });
    assertPreparedIrDriverConformance(
      originalSource,
      await readFile(driverPath, "utf8"),
      root,
      options.irProfile,
    );
    await loadPreparedBaseline(root, options.baseline);
    if (
      JSON.stringify(originalSources) !== JSON.stringify(sourcesAfter) ||
      JSON.stringify(supplementalSources) !== JSON.stringify(supplementalSourcesAfter)
    )
      throw new Error("IR source/runner/helper/conformance closure changed");
    if (
      (qualifiedPath && qualifiedReceiptAfterSha !== qualificationSha256) ||
      JSON.stringify(qualifiedBindings) !== JSON.stringify(qualifiedBindingsAfter)
    )
      throw new Error("Prior qualified V2 receipt or frozen closure changed");
    if (manifestSha256After !== manifestSha256 || executableSha256After !== executableSha256)
      throw new Error("IR manifest or expected native executable changed");
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
  const checks = Array.isArray(rawResult?.checks) ? rawResult.checks : [],
    renders = Array.isArray(rawResult?.renders) ? rawResult.renders : [];
  const checksComplete =
    checks.length === 3 &&
    new Set(checks.map((entry) => entry?.id)).size === 3 &&
    EXPECTED_CHECK_IDS.every((id) => checks.some((entry) => entry?.id === id)) &&
    checks.every((entry) => typeof entry?.pass === "boolean");
  const checksAllPassed = checksComplete && checks.every((entry) => entry.pass === true);
  const rawPcmComplete =
    renders.length === 6 &&
    new Set(renders.map((entry) => entry?.id)).size === 6 &&
    EXPECTED_RENDER_IDS.every((id) => renders.some((entry) => entry?.id === id)) &&
    renders.every(
      (entry) =>
        Array.isArray(entry?.rawPcm) &&
        entry.rawPcm.length === 2 &&
        Array.from(entry.rawPcm).every(
          (channel) =>
            Array.isArray(channel) &&
            channel.length === 12000 &&
            Array.from(channel).every(Number.isFinite),
        ),
    );
  const originalIrPassed = Boolean(
    originalVerification &&
      originalVerification.status === "PASS" &&
      originalVerification.exitCode === 0 &&
      originalVerification.referenceVersion === irProfile.referenceVersion &&
      originalVerification.checksComplete === true &&
      originalVerification.rawPcmComplete === true &&
      originalVerification.rawPcmBytes === 576000 &&
      originalVerification.sourceStable === true &&
      originalVerification.executableStable === true &&
      originalVerification.interrupted === false &&
      !originalVerification.runnerError &&
      !originalVerification.runnerBlockReason &&
      rawResult?.status === "PASS" &&
      rawResult.referenceVersion === irProfile.referenceVersion &&
      checksAllPassed &&
      rawPcmComplete &&
      JSON.stringify(originalVerification.sourcesBefore) === JSON.stringify(originalSources) &&
      JSON.stringify(originalVerification.sourcesAfter) === JSON.stringify(originalSources) &&
      originalVerification.executableSha256 === executableSha256 &&
      originalVerification.executableSha256After === executableSha256 &&
      typeof originalVerification.actualExecutablePath === "string" &&
      resolve(originalVerification.actualExecutablePath).toLowerCase() ===
        executable?.toLowerCase() &&
      Number.isSafeInteger(originalVerification.browserPid) &&
      Array.isArray(originalVerification.cleanup) &&
      originalVerification.cleanup.length >= 4 &&
      originalVerification.cleanup.every((entry) => entry.ok === true) &&
      originalVerification.cleanup.some(
        (entry) =>
          entry.resource === "browser" &&
          entry.pid === originalVerification.browserPid &&
          entry.method === "close",
      ) &&
      originalVerification.cleanup.some((entry) => entry.resource === "source-server"),
  );
  const status = errors.length
    ? "ERROR"
    : !options.run
      ? "PREPARED_NO_BROWSER_LAUNCH"
      : originalIrPassed && nativeProcessPassed
        ? "PASS"
        : originalVerification?.status === "FAIL"
          ? "FAIL"
          : originalVerification?.status === "BLOCKED"
            ? "BLOCKED"
            : "ERROR";
  const verification = {
    version: irProfile.preparedVersion,
    baselineProfile: options.baseline,
    baseline: resolvePreparedBaselineProfile(options.baseline),
    irProfile,
    status,
    exitCode:
      status === "PASS" || status === "PREPARED_NO_BROWSER_LAUNCH"
        ? 0
        : status === "BLOCKED"
          ? 2
          : 1,
    startedAt,
    endedAt: new Date().toISOString(),
    browserLaunched: Boolean(originalVerification?.browserLaunched),
    originalIrPassed,
    nativeProcessPassed,
    checksComplete,
    checksAllPassed,
    rawPcmComplete,
    rawPcmBytes: rawPcmComplete ? 576000 : null,
    originalStatus: originalVerification?.status ?? null,
    originalVerificationSha256,
    rawResultSha256,
    actualChild,
    actualClose,
    retainedExitMatches,
    browserProcess: originalVerification
      ? {
          pid: originalVerification.browserPid,
          spawnfile: originalVerification.actualExecutablePath,
          userAgent: originalVerification.userAgent,
          actualVersion: originalVerification.actualVersion,
        }
      : null,
    qualifiedV2Receipt: qualifiedPath,
    qualifiedV2ReceiptSha256: qualificationSha256,
    qualifiedReceiptAfterSha,
    qualifiedV2ClosureStable: Boolean(
      qualifiedBindings &&
        qualifiedBindingsAfter &&
        JSON.stringify(qualifiedBindings) === JSON.stringify(qualifiedBindingsAfter) &&
        (!qualifiedPath || qualifiedReceiptAfterSha === qualificationSha256),
    ),
    originalSources,
    sourcesAfter,
    source21Stable: Boolean(
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
        manifestSha256After === manifestSha256 &&
        !errors.some((error) => error.stage === "post-source-and-ir-bundle-verification"),
    ),
    executable,
    executableSha256,
    executableSha256After,
    conformance,
    preparationProcess,
    errors,
    limitations: [
      "Only the separately qualified three-check native IR state reference; original IR/original25 suites and oracles unchanged",
      "Prepared static transport does not establish cold Vite loading, all engines, real-time capacity, hearing, device/SPL/Worklet or API acceptance",
      "Actual Node close and original BrowserServer close receipts are retained; coordinator performs independent OS process cleanup verification",
    ],
  };
  await write("wrapper-verification-ir-v1.json", verification);
  process.stdout.write(`${relative(root, output)}: ${status}\n`);
  process.exitCode = verification.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
