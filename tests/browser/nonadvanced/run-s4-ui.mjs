import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { executeLane } from "./s4-process.mjs";
import { resolve, relative, dirname, basename, join, sep, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  adaptLegacyScript,
  adaptLegacyTestSource,
  combinedFixturePath,
  selectLegacyCases,
} from "./s4-legacy-adapter.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = fileURLToPath(new URL("../../..", import.meta.url));
const registryPath = "docs/16-nonadvanced-completion/lanes/ui/s4/CURRENT_UI_PLAN.json";
const scopeRequestPath =
  "docs/16-nonadvanced-completion/requests/TOP_MONITOR_REQUEST_20261103.json";
const scopeRequestSha256 = "ef5ec791276d668aec3f29877cc77d532d5452e2ebcf614af1d8f9f3efc4b5f2";
const mjs = (id, source, args = () => []) => ({
  id,
  kind: "mjs",
  source: `tests/browser/parameter-audit/${source}.mjs`,
  args,
});
const spec = (id, source, config) => ({
  id,
  kind: "spec",
  source: `tests/browser/parameter-audit/${source}.spec.ts`,
  config,
});
export const laneRegistry = [
  mjs("interaction-main", "interaction-audit"),
  mjs("interaction-completion", "interaction-completion"),
  mjs("interaction-priority", "interaction-priority"),
  mjs("scene-inspector", "scene-inspector-run", ({ output }) => [output]),
  mjs("scene-environment", "scene-environment-final"),
  mjs("scene-curved", "scene-curved-final", () => ["--run"]),
  mjs("behavior-rules", "behavior-run", ({ tag }) => [tag]),
  mjs("behavior-assets", "behavior-assets-run", ({ tag }) => ["", tag]),
  mjs("audio-monitor", "monitor-audit", ({ tag }) => [tag]),
  mjs("audio-monitor-retest", "monitor-retest", ({ tag, freeze }) => [freeze.entry.path, tag]),
  spec("pipeline-agent", "pipeline-agent-audit", "agent"),
  spec("pipeline-dock", "pipeline-dock-paths-comparison", "dock"),
  spec("pipeline-events", "pipeline-events-audit", "events"),
  spec("pipeline-motion", "pipeline-motion-audit", "motion"),
  spec("pipeline-zones", "pipeline-zones-audit", "zones"),
  spec("pipeline-render", "pipeline-render-performance-render", "render"),
  spec("pipeline-tail", "pipeline-render-performance-tail-validation", "tail"),
  spec("pipeline-diagnostics", "pipeline-render-performance-diagnostics", "diagnostics"),
  spec("pipeline-combined", "pipeline-render-performance-combined", "combined"),
  spec("interaction-help", "pipeline-help-sweep-audit", "help"),
  { id: "recovery", kind: "current", source: "tests/browser/nonadvanced/recovery-ui.spec.ts" },
  {
    id: "top-monitor",
    kind: "current",
    source: "tests/browser/nonadvanced/top-monitor-s4.spec.ts",
  },
];

export function parseArguments(args) {
  const result = {
    execute: false,
    captureFreeze: false,
    browserExecutable: null,
    browserVersion: null,
    dist: "dist",
    keepGoing: false,
    lanes: "recovery",
    attempt: null,
    freezePath: null,
    leaseId: null,
    laneTimeoutMs: 1_200_000,
  };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--execute") result.execute = true;
    else if (key === "--capture-freeze") result.captureFreeze = true;
    else if (key === "--keep-going") result.keepGoing = true;
    else {
      const name = {
        "--lanes": "lanes",
        "--attempt": "attempt",
        "--freeze": "freezePath",
        "--lease": "leaseId",
        "--lane-timeout-ms": "laneTimeoutMs",
        "--browser-executable": "browserExecutable",
        "--browser-version": "browserVersion",
        "--dist": "dist",
      }[key];
      assert.ok(
        name && args[index + 1] && !args[index + 1].startsWith("--"),
        `Unknown or missing argument: ${key}`,
      );
      result[name] = name === "laneTimeoutMs" ? Number(args[++index]) : args[++index];
    }
  }
  assert.ok(
    Number.isSafeInteger(result.laneTimeoutMs) &&
      result.laneTimeoutMs >= 1000 &&
      result.laneTimeoutMs <= 3_600_000,
    "Bounded lane timeout required",
  );
  const ids =
    result.lanes === "all" ? laneRegistry.map((lane) => lane.id) : result.lanes.split(",");
  assert.ok(
    ids.length > 0 &&
      new Set(ids).size === ids.length &&
      ids.every((id) => laneRegistry.some((lane) => lane.id === id)),
    "Select known unique lane IDs",
  );
  result.selectedLanes = ids;
  assert.ok(
    !(result.execute && result.captureFreeze),
    "Capture freeze and execute are separate steps",
  );
  if (result.captureFreeze)
    assert.ok(
      result.freezePath && result.leaseId && result.browserExecutable && result.browserVersion,
      "Freeze capture requires explicit browser identity, lease and output path",
    );
  if (result.execute) {
    assert.match(
      result.attempt ?? "",
      /^[a-z0-9][a-z0-9-]{2,79}$/,
      "Fresh explicit attempt required",
    );
    assert.ok(
      result.freezePath && result.leaseId,
      "Root freeze and explicit resource lease are required to execute",
    );
  }
  return result;
}
export function resolveWithinWorkspace(
  base,
  path,
  pathApi = { resolve, relative, isAbsolute, sep },
) {
  const absolute = pathApi.resolve(base, path);
  const local = pathApi.relative(base, absolute);
  assert.ok(
    local !== "" &&
      !pathApi.isAbsolute(local) &&
      local !== ".." &&
      !local.startsWith(".." + pathApi.sep),
    "Artifact/source path must stay inside the assigned workspace",
  );
  return absolute;
}
const insideRoot = (path) => resolveWithinWorkspace(root, path);
export function validateFreeze(freeze, leaseId) {
  assert.equal(freeze.schemaVersion, 1, "S4 freeze version");
  assert.equal(
    freeze.baseURL,
    "http://127.0.0.1:4173",
    "Only Root's production preview is supported",
  );
  assert.equal(freeze.leaseId, leaseId, "Root resource lease identity");
  assert.equal(freeze.serverMode, "offline-only", "S4 must not call a paid model");
  assert.equal(freeze.paidApiBudgetUsd, 0, "S4 paid API budget remains zero");
  assert.match(freeze.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(freeze.htmlSha256, /^[a-f0-9]{64}$/, "Production HTML pin required");
  assert.ok(
    typeof freeze.browserExecutable === "string" && isAbsolute(freeze.browserExecutable),
    "Absolute browser executable required",
  );
  assert.match(freeze.browserExecutableSha256, /^[a-f0-9]{64}$/);
  assert.ok(
    typeof freeze.browserVersion === "string" && freeze.browserVersion.length > 0,
    "Actual browser version pin required",
  );
  assert.ok(
    Array.isArray(freeze.sourcePins) && freeze.sourcePins.length > 0,
    "Complete tracked source pins required",
  );
  const seen = new Set();
  for (const pin of freeze.sourcePins) {
    assert.ok(
      typeof pin.path === "string" &&
        !pin.path.includes("\\") &&
        !pin.path.split("/").includes("..") &&
        !pin.path.startsWith("/"),
      "Repository-relative source pin required",
    );
    assert.ok(
      /^(?:src|server|schemas|public|tests\/browser|docs)\//.test(pin.path) ||
        [
          "package.json",
          "package-lock.json",
          ".node-version",
          "tsconfig.json",
          "vite.config.ts",
          "index.html",
        ].includes(pin.path),
      "Only declared product/test/document inputs may be pinned",
    );
    assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!seen.has(pin.path), "Duplicate source pin");
    seen.add(pin.path);
  }
  assert.ok(
    Array.isArray(freeze.assets) && freeze.assets.length > 0,
    "All production JS/CSS assets must be pinned",
  );
  assert.ok(freeze.entry && /\.js$/.test(freeze.entry.path), "A JavaScript entry is required");
  const assets = [...freeze.assets, freeze.entry];
  const assetPins = new Map();
  for (const asset of assets) {
    assert.match(asset.path, /^\/assets\/[A-Za-z0-9_./-]+\.(?:js|css)$/);
    assert.ok(!asset.path.split("/").includes(".."));
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    if (assetPins.has(asset.path))
      assert.equal(assetPins.get(asset.path), asset.sha256, "Conflicting asset pins");
    assetPins.set(asset.path, asset.sha256);
  }
  return freeze;
}
const sourcePathArguments = [
  "src",
  "server",
  "schemas",
  "public",
  "tests/browser",
  "docs/05-ux/DESIGN_TOKENS.json",
  "docs/05-ux/FPS_INTERACTION_UX.md",
  "docs/04-physics/INPUT_CONTROLS.md",
  registryPath,
  combinedFixturePath,
  scopeRequestPath,
  "package.json",
  "package-lock.json",
  ".node-version",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
];
function trackedSourcePaths() {
  return execFileSync("git", ["ls-files", "--", ...sourcePathArguments], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
}
async function captureFreeze(options) {
  const output = insideRoot(options.freezePath),
    dist = insideRoot(options.dist);
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const dirty = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=normal", "--", ...sourcePathArguments],
    { cwd: root, encoding: "utf8" },
  ).trim();
  assert.equal(
    dirty,
    "",
    "Commit the frozen product/browser-test inputs before capturing their source identity",
  );
  const paths = [
    ...new Set([...trackedSourcePaths(), registryPath, combinedFixturePath, scopeRequestPath]),
  ].sort();
  const sourcePins = [];
  for (const path of paths)
    sourcePins.push({ path, sha256: sha(await readFile(insideRoot(path))) });
  const html = await readFile(join(dist, "index.html"));
  const entry = /<script[^>]+src=["'](\/assets\/[^"']+\.js)["']/.exec(html.toString("utf8"))?.[1];
  assert.ok(entry, "Production build must have a module entry in /assets");
  const assets = [];
  async function visit(directory, prefix = "") {
    for (const value of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!value.isSymbolicLink(), "Built assets must not be links to unbound files");
      const name = prefix + value.name;
      if (value.isDirectory()) await visit(join(directory, value.name), name + "/");
      else if (/\.(?:js|css)$/.test(name)) {
        assert.ok(assets.length < 4096, "Bounded asset manifest");
        assets.push({
          path: "/assets/" + name,
          sha256: sha(await readFile(join(directory, value.name))),
        });
      }
    }
  }
  await visit(join(dist, "assets"));
  const entryAsset = assets.find((value) => value.path === entry);
  assert.ok(entryAsset, "Entry must be in the built asset manifest");
  const browserExecutable = resolve(options.browserExecutable);
  const freeze = {
    schemaVersion: 1,
    baseURL: "http://127.0.0.1:4173",
    leaseId: options.leaseId,
    serverMode: "offline-only",
    paidApiBudgetUsd: 0,
    sourceCommit,
    sourcePins,
    htmlSha256: sha(html),
    entry: entryAsset,
    assets,
    browserExecutable,
    browserExecutableSha256: sha(await readFile(browserExecutable)),
    browserVersion: options.browserVersion,
    buildDirectory: relative(root, dist),
    buildAuthority:
      "Root supplies the already-built production directory and expected browser version. No build or browser is launched by capture; actual browser version is checked during every launch.",
    capturedAt: new Date().toISOString(),
  };
  validateFreeze(freeze, options.leaseId);
  await verifyServer(freeze);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(freeze, null, 2) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      status: "INPUTS_AND_SERVED_BYTES_CAPTURED_BROWSER_NOT_RUN",
      path: relative(root, output),
      sha256: sha(await readFile(output)),
      sourcePins: sourcePins.length,
      assets: assets.length,
    }),
  );
}
async function verifySources(freeze) {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(head, freeze.sourceCommit, "Frozen source HEAD");
  const tracked = trackedSourcePaths();
  const pins = new Map(freeze.sourcePins.map((pin) => [pin.path, pin.sha256]));
  assert.ok(pins.has(registryPath), "Current planned registry must be pinned");
  assert.equal(
    pins.get(scopeRequestPath),
    scopeRequestSha256,
    "Confirmed current scope request must be pinned",
  );
  assert.ok(pins.has(combinedFixturePath), "Immutable legacy combined fixture must be pinned");
  assert.ok(
    tracked.every((path) => pins.has(path)),
    "Freeze must include every tracked product/browser-test input, not a hand-picked subset",
  );
  for (const [path, expected] of pins)
    assert.equal(sha(await readFile(insideRoot(path))), expected, `Source pin ${path}`);
  assert.equal(
    sha(await readFile(freeze.browserExecutable)),
    freeze.browserExecutableSha256,
    "Frozen browser executable bytes",
  );
  return {
    observedHead: head,
    validatedSourcePins: pins.size,
    trackedInputs: tracked.length,
    browserExecutableSha256: freeze.browserExecutableSha256,
  };
}
async function verifyServer(freeze) {
  const response = await fetch(freeze.baseURL, {
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  assert.ok(response.ok, "Frozen production HTML must be served");
  const bytes = Buffer.from(await response.arrayBuffer()),
    html = bytes.toString("utf8");
  assert.equal(sha(bytes), freeze.htmlSha256, "Actual production HTML hash");
  assert.ok(html.includes(freeze.entry.path), "HTML must reference the frozen entry");
  assert.ok(
    !html.includes("/@vite/client") && !html.includes("/src/main"),
    "Development/HMR is not a production source",
  );
  const assets = new Map(
    [...freeze.assets, freeze.entry].map((asset) => [asset.path, asset.sha256]),
  );
  const observed = [];
  for (const [path, expected] of assets) {
    const value = await fetch(new URL(path, freeze.baseURL), {
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
    assert.ok(value.ok, `Production asset ${path}`);
    const data = Buffer.from(await value.arrayBuffer());
    assert.equal(sha(data), expected, `Actual served asset ${path}`);
    observed.push({ path, sha256: expected, bytes: data.length });
  }
  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g))
    assert.ok(assets.has(match[1]), `Unpinned HTML asset ${match[1]}`);
  return { htmlSha256: sha(bytes), htmlBytes: bytes.length, assets: observed };
}
async function stageSource(lane, originalPath, destination, settings, proofs, visited = new Set()) {
  if (visited.has(originalPath)) return;
  visited.add(originalPath);
  const source = await readFile(insideRoot(originalPath), "utf8");
  const result =
    lane.kind === "mjs"
      ? adaptLegacyScript(source, { ...settings, legacySourcePath: originalPath })
      : adaptLegacyTestSource(source, { ...settings, legacySourcePath: originalPath });
  await writeFile(join(destination, basename(originalPath)), result.source, { flag: "wx" });
  proofs.push({
    originalPath,
    adaptedPath: relative(root, join(destination, basename(originalPath))),
    ...result.proof,
  });
  if (lane.kind !== "mjs")
    for (const imported of result.proof.relativeImports) {
      const dependency = resolve(root, dirname(originalPath), imported.replace(/\.js$/, ".ts"));
      assert.ok(
        relative(resolve(root, "tests/browser/parameter-audit"), dependency).split(sep)[0] !== "..",
        "Legacy relative import must stay in the audit utility directory",
      );
      await stageSource(
        lane,
        relative(root, dependency).replaceAll("\\", "/"),
        destination,
        settings,
        proofs,
        visited,
      );
    }
}
function inheritedEnvironment() {
  return Object.fromEntries(
    [
      "PATH",
      "Path",
      "PATHEXT",
      "SystemRoot",
      "SYSTEMROOT",
      "WINDIR",
      "COMSPEC",
      "TEMP",
      "TMP",
      "USERPROFILE",
      "LOCALAPPDATA",
      "APPDATA",
      "ProgramFiles",
      "ProgramFiles(x86)",
      "HOME",
      "CI",
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
}
async function jsonArtifacts(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await jsonArtifacts(path)));
    else if (entry.name.endsWith(".json")) result.push(path);
  }
  return result;
}
function passCaseIds(value, result = new Set()) {
  if (!value || typeof value !== "object") return result;
  if (["PASS", "SCOPED_CASE_PASS"].includes(value.status))
    for (const key of ["id", "caseId", "case", "name"])
      if (typeof value[key] === "string") result.add(value[key]);
  if (Array.isArray(value)) value.forEach((item) => passCaseIds(item, result));
  else
    for (const child of Object.values(value))
      if (child && typeof child === "object") passCaseIds(child, result);
  return result;
}
async function joinCurrentEvidence(plan, outputRoot, freeze) {
  const rows = plan.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    relatedSemanticFamilyIds: row.relatedSemanticFamilyIds,
    currentBrowserStatus:
      row.currentBrowserStatus === "SUPERSEDED_REMOVED" ? "SUPERSEDED_REMOVED" : "NOT_RUN",
    currentNativeStatus:
      row.currentNativeStatus === "SUPERSEDED_REMOVED" ? "SUPERSEDED_REMOVED" : "NOT_RUN",
    currentEvidence: [],
  }));
  const artifacts = await jsonArtifacts(outputRoot);
  for (const path of artifacts.filter(
    (path) =>
      /receipt|summary|audit-|retest-|priority-held/.test(basename(path)) &&
      !/run-receipt|current-results|freeze|adapter-proof|actual-exit|playwright-results/.test(
        basename(path),
      ),
  )) {
    const bytes = await readFile(path);
    let value;
    try {
      value = JSON.parse(bytes.toString("utf8"));
    } catch {
      continue;
    }
    const caseIds = passCaseIds(value);
    for (const row of rows) {
      if (row.currentBrowserStatus === "SUPERSEDED_REMOVED") continue;
      const original = plan.rows.find((item) => item.id === row.id);
      const directSteps =
        value.status === "SCOPED_CASE_PASS"
          ? (value.scenarioSteps ?? []).filter((step) => step.scenarioId === row.id)
          : [];
      const matching = directSteps.length
        ? directSteps
        : row.kind === "scenario"
          ? []
          : (original.historicalEvidence?.referencesPreserved ?? []).filter((reference) =>
              caseIds.has(reference.caseId),
            );
      if (matching.length) {
        row.currentBrowserStatus = "SCOPED_CURRENT_EVIDENCE_PENDING_REVIEW";
        row.currentEvidence.push({
          path: relative(root, path),
          sha256: sha(bytes),
          sourceCommit: freeze.sourceCommit,
          matchedCaseIdsOrSteps: matching,
          qualification:
            "Frozen source/served-byte window and actual receipt; independent family completeness review remains required.",
        });
      }
    }
  }
  return {
    schemaVersion: 1,
    status: "CURRENT_EVIDENCE_REQUIRES_INDEPENDENT_REVIEW",
    sourceCommit: freeze.sourceCommit,
    countingPolicy:
      "217historicalsemantic (1supersededremoved)+21overlapscenarios+11newtopmonitorsemantic=249plannedrows; not249independentcontrols",
    rows,
    scope:
      "No whole-family/native/hearing/performance PASS is inferred from a suite exit or a matching scenario step.",
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.captureFreeze) {
    await captureFreeze(options);
    return;
  }
  if (!options.execute) {
    console.log(
      JSON.stringify(
        {
          status: "PREPARED_NOT_RUN",
          registryPath,
          selectedLanes: options.selectedLanes,
          routes: laneRegistry.map(({ id, source, kind }) => ({ id, source, kind })),
          next: "Root must supply final source/assets/browser freeze, a fresh attempt, --lease and --execute. No server/build/browser is started by this planning mode.",
        },
        null,
        2,
      ),
    );
    return;
  }
  const outputRoot = insideRoot(
      `docs/16-nonadvanced-completion/lanes/ui/s4/attempts/${options.attempt}`,
    ),
    cacheRoot = insideRoot(`.cache/nonadvanced-s4/${options.attempt}`);
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot, { recursive: false });
  const receipt = {
    schemaVersion: 1,
    status: "PRECHECK_RUNNING",
    attempt: options.attempt,
    leaseId: options.leaseId,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lanes: [],
    failures: [],
    method:
      "Serial frozen production DOM. No build/devserver, no paid API, no private runtime bridge, no historical PASS upgrade.",
  };
  const save = () =>
    writeFile(join(outputRoot, "run-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  await save();
  try {
    const freezeBytes = await readFile(resolve(options.freezePath));
    const freeze = validateFreeze(JSON.parse(freezeBytes.toString("utf8")), options.leaseId);
    await writeFile(join(outputRoot, "freeze.json"), freezeBytes, { flag: "wx" });
    receipt.freezeSha256 = sha(freezeBytes);
    receipt.sourcePreflight = await verifySources(freeze);
    const plan = JSON.parse(await readFile(insideRoot(registryPath), "utf8"));
    const scopeAmendment = plan.currentScopeAmendments.find(
      (item) => item.source.path === scopeRequestPath,
    );
    assert.equal(
      scopeAmendment?.source.sha256,
      scopeRequestSha256,
      "Planned scope amendment must match confirmed user request",
    );
    receipt.servedPreflight = await verifyServer(freeze);
    await mkdir(dirname(cacheRoot), { recursive: true });
    await mkdir(cacheRoot, { recursive: false });
    await mkdir(join(outputRoot, "cases"));
    const tag = `s4-${options.attempt}`;
    const common = {
      ...inheritedEnvironment(),
      S4_FREEZE_PATH: join(outputRoot, "freeze.json"),
      S4_OUTPUT_ROOT: outputRoot,
      S4_BROWSER_EXECUTABLE: freeze.browserExecutable,
      INTERACTION_RUN_LABEL: tag,
      INTERACTION_HEADED: "0",
      SCENE_AUDIT_SOURCE_COMMIT: freeze.sourceCommit,
      CURVED_UI_SOURCE_COMMIT: freeze.sourceCommit,
      CURVED_UI_ENTRY: basename(freeze.entry.path),
      PIPELINE_AGENT_SOURCE_HINT: freeze.sourceCommit,
      PIPELINE_EVENTS_CANDIDATE: freeze.sourceCommit,
      PIPELINE_HELP_CANDIDATE: freeze.sourceCommit,
      PIPELINE_HELP_EXPECTED_ENTRY_SHA: freeze.entry.sha256,
      PIPELINE_RENDER_EXPECTED_ENTRY: basename(freeze.entry.path),
      PIPELINE_RENDER_EXPECTED_SHA256: freeze.entry.sha256,
      PIPELINE_HELP_BROWSER_LEASE: "granted",
      PIPELINE_ZONES_BROWSER_LEASE: "granted",
    };
    for (const key of [
      "PIPELINE_AGENT_ATTEMPT",
      "PIPELINE_DOCK_ATTEMPT",
      "PIPELINE_EVENTS_ATTEMPT",
      "MOTION_AUDIT_ATTEMPT",
      "PIPELINE_ZONES_ATTEMPT",
      "PIPELINE_RENDER_AUDIT_ATTEMPT",
      "PIPELINE_TAIL_AUDIT_ATTEMPT",
      "PIPELINE_COMBINED_AUDIT_ATTEMPT",
      "PIPELINE_HELP_ATTEMPT",
    ])
      common[key] = tag;
    for (const id of options.selectedLanes) {
      const lane = laneRegistry.find((item) => item.id === id),
        directory = join(outputRoot, "lanes", id),
        cache = join(cacheRoot, id),
        staged = join(cache, "sources");
      await mkdir(directory, { recursive: true });
      await mkdir(staged, { recursive: true });
      const env = { ...common, S4_LANE_OUTPUT: directory, CURVED_UI_OUT: directory };
      let command;
      if (lane.kind === "current") {
        env.S4_CURRENT_SPEC = basename(lane.source);
        command = [
          "node_modules/@playwright/test/cli.js",
          "test",
          "--config",
          "tests/browser/nonadvanced/recovery-ui.config.ts",
          "--workers=1",
        ];
      } else {
        const proofs = [];
        await stageSource(
          lane,
          lane.source,
          staged,
          {
            outputDirectory: directory,
            cacheDirectory: cache,
            projectRoot: root,
            executablePath: freeze.browserExecutable,
            sourceCommit: freeze.sourceCommit,
            entryName: basename(freeze.entry.path),
            scopeAmendment: scopeAmendment.source,
            publicActionIdentitySourcePins: freeze.sourcePins.filter((pin) =>
              ["src/ui/Viewport.tsx", "src/ui/locales/viewport.ts"].includes(pin.path),
            ),
            guardModuleUrl: pathToFileURL(
              resolve(root, "tests/browser/nonadvanced/s4-browser-guard.mjs"),
            ).href,
            testModuleUrl: pathToFileURL(
              resolve(root, "tests/browser/nonadvanced/s4-legacy-test.ts"),
            ).href,
          },
          proofs,
        );
        await writeFile(
          join(directory, "adapter-proof.json"),
          JSON.stringify(proofs, null, 2) + "\n",
        );
        if (lane.kind === "mjs") {
          let args = lane.args({ output: directory, tag, freeze });
          if (lane.id === "interaction-main") {
            const selection = selectLegacyCases(
              await readFile(insideRoot(lane.source), "utf8"),
              scopeAmendment.excludedLegacyCaseIds,
              scopeAmendment.source,
            );
            await writeFile(
              join(directory, "case-selection.json"),
              JSON.stringify(selection, null, 2) + "\n",
              { flag: "wx" },
            );
            args = [selection.selectedCaseIds.join(","), ...args];
          }
          command = [join(staged, basename(lane.source)), ...args];
        } else {
          env.S4_LEGACY_CONFIG = lane.config;
          env.S4_LEGACY_SPEC = join(staged, basename(lane.source));
          command = [
            "node_modules/@playwright/test/cli.js",
            "test",
            "--config",
            "tests/browser/nonadvanced/s4-legacy.config.ts",
            "--workers=1",
          ];
        }
      }
      console.log(`S4_LANE_START ${id}`);
      const outcome = await executeLane(command, env, directory, options.laneTimeoutMs);
      const pins = { source: await verifySources(freeze), served: await verifyServer(freeze) };
      receipt.lanes.push({ id, ...outcome, postflight: pins });
      if (
        !outcome.ok ||
        !outcome.terminal ||
        outcome.interrupted ||
        outcome.status !== 0 ||
        outcome.signal ||
        outcome.timedOut
      )
        receipt.failures.push(`S4_LANE_FAILED:${id}`);
      await save();
      console.log(`S4_LANE_END ${id} status=${outcome.status}`);
      if (
        outcome.interrupted ||
        !outcome.terminal ||
        (receipt.failures.length && !options.keepGoing)
      )
        break;
    }
    const joined = await joinCurrentEvidence(plan, outputRoot, freeze);
    await writeFile(
      join(outputRoot, "current-results.json"),
      JSON.stringify(joined, null, 2) + "\n",
    );
    receipt.status = receipt.lanes.some((lane) => lane.interrupted)
      ? "INTERRUPTED"
      : receipt.failures.length
        ? "FAILED"
        : "EXECUTION_FINISHED_PENDING_FAMILY_REVIEW";
  } catch (error) {
    receipt.status = "REJECTED_OR_FAILED";
    receipt.failures.push(String(error));
    if (error?.receipt) receipt.unsavedLaneReceipt = error.receipt;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    await save();
  }
  if (receipt.failures.length) process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
