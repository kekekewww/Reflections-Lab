// Device-observation helper. Importing performs no browser/server/native/audio operation.
// Coordinator runtime GO is required before the CLI invocation with --go.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createHearingProbePreload, WORKLET_SOURCE } from "./hearing-probe.mjs";
import { launchExternalNativeBrowser } from "../native-accessibility-external-browser.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const EXPECTED = Object.freeze({
  manifest: "c31a05cf470313cea8a7deccaafd0676f1e83f29b2b4b059ffebf74649a676f5",
  inputDigest: "028b16a8f8f49bda1be4bc693867fc5061e9819dac872e49186d541a4deb7bc0",
  helper: "18b2f6677f52bdfe8dfa41e5e0a13c2503f56a9b1a93c6e4be07a2b50f7841e0",
  tests: "f22c7934f7fdbf0c78ff3dee637a7094af241ea3c5e97973ebefb37bc9f42495",
  review: "ca93bc279d3f9738432c3d79fb3d33e6db960d4220170f2895b3100bca745611",
  worklet: "79faea329835d31b5462c2c0e22d1391532fd2ef542b375e95d3691ae4dbd1db",
});
const TIMESTAMP_FIELDS = Object.freeze(["buildStartedAt", "buildCompletedAt"]);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const local = (relative) => {
  assert.equal(typeof relative, "string");
  const result = path.resolve(root, relative),
    back = path.relative(root, result);
  assert(back && !back.startsWith("..") && !path.isAbsolute(back), "Workspace-local file required");
  return result;
};
async function bounded(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("HOST_OPERATION_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function bundleBytes(response) {
  assert(response.ok && response.body, "Frozen HTTP asset unavailable");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    assert(bytes <= 8 * 1024 * 1024, "HTTP asset exceeded bounded8MiB budget");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

export function createBoundedLineDecoder({ maxLineBytes = 4096, maxLines = 64 } = {}) {
  assert(Number.isInteger(maxLineBytes) && maxLineBytes > 0 && maxLineBytes <= 4096);
  assert(Number.isInteger(maxLines) && maxLines > 0 && maxLines <= 64);
  const storage = Buffer.alloc(maxLineBytes),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let used = 0,
    lines = 0,
    ended = false;
  const fail = (code) => {
    ended = true;
    throw new Error(code);
  };
  const line = () => {
    if (lines >= maxLines) return fail("INPUT_COMMAND_LIMIT");
    lines++;
    const length = used && storage[used - 1] === 13 ? used - 1 : used;
    let value;
    try {
      value = decoder.decode(storage.subarray(0, length));
    } catch {
      return fail("INPUT_INVALID_UTF8");
    }
    used = 0;
    return value;
  };
  return Object.freeze({
    feed(bytes) {
      assert(!ended, "INPUT_READER_ENDED");
      assert(bytes instanceof Uint8Array, "Byte chunks required");
      const result = [];
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 10) result.push(line());
        else {
          // Reject before writing/copying beyond the single preallocated line buffer.
          if (used === maxLineBytes) return fail("INPUT_LINE_BYTE_LIMIT");
          storage[used++] = bytes[i];
        }
      }
      return result;
    },
    finish() {
      assert(!ended, "INPUT_READER_ENDED");
      const result = used ? [line()] : [];
      ended = true;
      return result;
    },
  });
}

export function createFrozenRouteHandler({ origin, responses, onBlocked = () => {} }) {
  assert.equal(new URL(origin).origin, origin);
  assert(Array.isArray(responses) && responses.length > 0 && responses.length <= 130);
  const frozen = new Map();
  let totalBytes = 0,
    requests = 0;
  for (const response of responses) {
    assert(
      response.path.startsWith("/") && !response.path.includes("?") && !frozen.has(response.path),
    );
    assert(response.bytes instanceof Uint8Array && response.bytes.length <= 8 * 1024 * 1024);
    totalBytes += response.bytes.length;
    assert(totalBytes <= 64 * 1024 * 1024);
    const bytes = Buffer.from(response.bytes);
    assert.equal(sha(bytes), response.sha256, `Unverified route bytes:${response.path}`);
    frozen.set(response.path, { bytes, contentType: response.contentType });
  }
  return async (route) => {
    const request = route.request(),
      target = new URL(request.url());
    // AudioWorklet Blob code is same-origin, first-party and already hash-bound separately.
    if (target.protocol === "blob:" && target.origin === origin) return route.continue();
    const resource = frozen.get(target.pathname);
    if (
      ++requests <= 256 &&
      target.origin === origin &&
      !target.search &&
      ["GET", "HEAD"].includes(request.method()) &&
      resource
    ) {
      return route.fulfill({
        status: 200,
        contentType: resource.contentType,
        headers: { "cache-control": "no-store" },
        body: request.method() === "HEAD" ? Buffer.alloc(0) : Buffer.from(resource.bytes),
      });
    }
    onBlocked({ origin: target.origin, path: target.pathname.slice(0, 160) });
    return route.abort("blockedbyclient");
  };
}

function contentType(relative) {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".map": "application/json",
    ".wasm": "application/wasm",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  return types[path.posix.extname(relative)] ?? "application/octet-stream";
}

export function compareQualifiedBuildManifests(trusted, rebuilt) {
  const keys = [
    "schemaVersion",
    "mode",
    "buildStartedAt",
    "buildCompletedAt",
    "sourceStableDuringBuild",
    "inputDigest",
    "inputs",
    "bundle",
  ];
  const inspect = (manifest) => {
    assert(manifest && typeof manifest === "object" && !Array.isArray(manifest));
    assert.deepEqual(Object.keys(manifest).sort(), [...keys].sort(), "Manifest key set changed");
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.mode, "e2e");
    assert.equal(manifest.sourceStableDuringBuild, true);
    assert.equal(manifest.inputDigest, EXPECTED.inputDigest);
    for (const field of TIMESTAMP_FIELDS) {
      assert.equal(typeof manifest[field], "string");
      assert.equal(
        new Date(manifest[field]).toISOString(),
        manifest[field],
        "Canonical ISO timestamp required",
      );
    }
    assert(Date.parse(manifest.buildStartedAt) <= Date.parse(manifest.buildCompletedAt));
    for (const [field, count] of [
      ["inputs", 170],
      ["bundle", 12],
    ]) {
      assert(
        Array.isArray(manifest[field]) && manifest[field].length === count,
        `Exact ${field} count required`,
      );
      const paths = new Set();
      for (const entry of manifest[field]) {
        assert.deepEqual(Object.keys(entry).sort(), ["path", "sha256"]);
        assert.equal(typeof entry.path, "string");
        assert(entry.path.length > 0 && entry.path.length <= 512 && !path.isAbsolute(entry.path));
        assert(!entry.path.split(/[\\/]/).includes(".."), "Entry path escape");
        assert(!paths.has(entry.path), `Duplicate ${field} path`);
        paths.add(entry.path);
        assert(/^[a-f0-9]{64}$/.test(entry.sha256), "Exact lowercase SHA256 required");
      }
    }
    assert.equal(
      sha(JSON.stringify(manifest.inputs)),
      manifest.inputDigest,
      "Declared input digest differs",
    );
  };
  inspect(trusted);
  inspect(rebuilt);
  for (const field of keys)
    if (!TIMESTAMP_FIELDS.includes(field))
      assert.deepEqual(rebuilt[field], trusted[field], `Non-timestamp field changed:${field}`);
  return {
    ok: true,
    scope: "qualified-build provenance for device observation only",
    inputDigest: trusted.inputDigest,
    inputCount: trusted.inputs.length,
    bundleCount: trusted.bundle.length,
    permittedDifferenceFields: [...TIMESTAMP_FIELDS],
    changedTimestampFields: TIMESTAMP_FIELDS.filter((field) => rebuilt[field] !== trusted[field]),
    trustedTimes: Object.fromEntries(TIMESTAMP_FIELDS.map((field) => [field, trusted[field]])),
    rebuiltTimes: Object.fromEntries(TIMESTAMP_FIELDS.map((field) => [field, rebuilt[field]])),
  };
}

export function assertQualifiedBytes(bytes, expectedSha256, label = "Qualified bytes changed") {
  assert.equal(sha(bytes), expectedSha256, label);
}

export function assertRuntimePromotionBinding(config) {
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.status, "QUALIFIED_BUILD_PROVENANCE_ONLY");
  assert.equal(
    config.promotionVerification.status,
    "PASS_STATIC_AND_PURE_HOST_SCOPE",
    "Permanent-path verification still required",
  );
  assert.equal(config.trustedBuild.manifestSha256, EXPECTED.manifest);
  assert.equal(config.trustedBuild.inputDigest, EXPECTED.inputDigest);
  assert.deepEqual(config.trustedBuild.permittedTimestampDifferences, [...TIMESTAMP_FIELDS]);
  assert.equal(config.preparation.helperReview.sha256, EXPECTED.review);
}

export async function launchManualProbeDriver({
  go,
  baseUrl,
  previewPid,
  browserExecutable,
  bindingPath = "tests/browser/device-hearing/binding.json",
} = {}) {
  assert.equal(go, true, "Coordinator GO required; no runtime launch from preparation");
  const configBytes = await readFile(local(bindingPath)),
    config = JSON.parse(configBytes);
  assertRuntimePromotionBinding(config);
  assert.equal(
    sha(await readFile(local(config.promotionVerification.receiptPath))),
    config.promotionVerification.receiptSha256,
  );
  assert.equal(
    sha(await readFile(new URL(import.meta.url))),
    config.promotionVerification.driverSha256,
  );
  assert.equal(
    sha(await readFile(new URL("./manual-probe-protocol.json", import.meta.url))),
    config.promotionVerification.protocolSha256,
  );
  const url = new URL(baseUrl);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.pathname, "/");
  assert.equal(url.username + url.password + url.search + url.hash, "");
  assert(
    Number.isSafeInteger(previewPid) && previewPid > 0,
    "Coordinator-owned preview PID required",
  );
  assert(
    typeof browserExecutable === "string" && path.isAbsolute(browserExecutable),
    "Known Chrome executable required",
  );
  const manifestPath = config.trustedBuild.manifestPath;
  const rebuiltManifestPath = config.trustedBuild.rebuiltManifestPath;
  const manifestBytes = await readFile(local(manifestPath));
  assertQualifiedBytes(manifestBytes, EXPECTED.manifest, "Trusted archive bytes changed");
  const manifest = JSON.parse(manifestBytes);
  const rebuiltManifestBytes = await readFile(local(rebuiltManifestPath));
  const rebuiltManifest = JSON.parse(rebuiltManifestBytes);
  const manifestComparison = compareQualifiedBuildManifests(manifest, rebuiltManifest);
  const reviewPath = config.preparation.helperReview.path;
  const binding = {
    scope: "qualified-build provenance/device-observation only; no overallV1/UI/hearing PASS",
    bindingPath,
    bindingSha256: sha(configBytes),
    promotionVerification: { ...config.promotionVerification },
    trustedManifest: { path: manifestPath, sha256: sha(manifestBytes) },
    rebuiltManifest: { path: rebuiltManifestPath, sha256: sha(rebuiltManifestBytes) },
    manifestComparison,
    inputDigest: manifest.inputDigest,
    helperSha256: sha(await readFile(new URL("./hearing-probe.mjs", import.meta.url))),
    syntheticTestsSha256: sha(
      await readFile(new URL("./hearing-probe.synthetic.test.mjs", import.meta.url)),
    ),
    independentReceiptPath: reviewPath,
    independentReceiptSha256: sha(await readFile(local(reviewPath))),
    workletSha256: sha(WORKLET_SOURCE),
  };
  assert.equal(binding.helperSha256, EXPECTED.helper);
  assert.equal(binding.syntheticTestsSha256, EXPECTED.tests);
  assert.equal(binding.independentReceiptSha256, EXPECTED.review);
  assert.equal(binding.workletSha256, EXPECTED.worklet);
  const bundleRoot = path.posix.dirname(
    manifest.bundle.find((item) => item.path.endsWith("/index.html")).path,
  );
  const verifyLocal = async () => {
    assert.equal(
      sha(await readFile(local(bindingPath))),
      binding.bindingSha256,
      "Binding changed during session",
    );
    assert.equal(
      sha(await readFile(local(manifestPath))),
      binding.trustedManifest.sha256,
      "Trusted manifest changed",
    );
    assert.equal(
      sha(await readFile(local(rebuiltManifestPath))),
      binding.rebuiltManifest.sha256,
      "Rebuilt manifest changed during session",
    );
    for (const item of [...manifest.inputs, ...manifest.bundle])
      assertQualifiedBytes(
        await readFile(local(item.path)),
        item.sha256,
        `Frozen file changed:${item.path}`,
      );
    assert.equal(
      sha(await readFile(new URL("./hearing-probe.mjs", import.meta.url))),
      EXPECTED.helper,
    );
    assert.equal(sha(await readFile(local(reviewPath))), EXPECTED.review);
    assert.equal(
      sha(await readFile(new URL(import.meta.url))),
      config.promotionVerification.driverSha256,
    );
    assert.equal(
      sha(await readFile(new URL("./manual-probe-protocol.json", import.meta.url))),
      config.promotionVerification.protocolSha256,
    );
  };
  await verifyLocal();
  const served = [],
    frozenResponses = [];
  let frozenBytes = 0;
  const httpDeadline = Date.now() + 15000;
  for (const item of manifest.bundle) {
    const relative = path.posix.relative(bundleRoot, item.path);
    assert(relative && !relative.startsWith("../"));
    // The actual navigation is '/', so bind that response to frozen index.html.
    const href = new URL(relative === "index.html" ? "/" : relative, url);
    assert(Date.now() < httpDeadline, "HTTP verification15s budget exhausted");
    const response = await fetch(href, {
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(5000, httpDeadline - Date.now())),
    });
    const bytes = await bundleBytes(response),
      observed = sha(bytes);
    frozenBytes += bytes.length;
    assert(frozenBytes <= 64 * 1024 * 1024, "Frozen HTTP memory budget64MiB");
    assertQualifiedBytes(bytes, item.sha256, `HTTP bundle mismatch:${relative}`);
    served.push({ path: href.pathname, frozenPath: relative, sha256: observed });
    const resource = {
      path: href.pathname,
      bytes,
      sha256: item.sha256,
      contentType: contentType(relative),
    };
    frozenResponses.push(resource);
    if (relative === "index.html") frozenResponses.push({ ...resource, path: "/index.html" });
  }
  const sessionId = new Date().toISOString().replaceAll(":", "-");
  const directory = local(`artifacts/v1/device-hearing-session-${sessionId}`);
  const profilePath = local(`test-results/device-hearing-profiles/${sessionId}`);
  await mkdir(directory, { recursive: false });
  const record = {
    schemaVersion: 1,
    scope: "MANUAL_INSTRUMENTED_E2E_SESSION",
    startedAt: new Date().toISOString(),
    binding,
    served,
    preview: {
      url: url.href,
      pid: previewPid,
      ownership: "coordinator-declared; driver never launches/stops preview",
    },
    hardwareUserReport: {
      headphones: "Austrian Audio Hi-x65",
      speakers: "ADAM Audio D3V",
      actualRoute: null,
    },
    nativeProbe: "NOT_RUN",
    actualBlock: "UNKNOWN",
    hearing: "NOT_RUN",
    nativeObservations: [],
    userReports: [],
    operations: [],
    errors: [],
    blockedRequests: [],
    limitations: [
      "Probe adds a silent diagnostic branch and instrumentation overhead",
      "Sample rate belongs to the exact App context; physical DAC/output route unknown",
      "Latency fields are browser estimates; no end-to-end measurement",
      "No xrun/workletp99/SPL/hearing claim from callback counts or UI",
      "Synthetic18/review evidence reused unchanged; no rerun by this driver",
    ],
  };
  let native = null,
    page = null,
    invalidated = null,
    loaded = false,
    collecting = true;
  let priorBlocks = 0,
    commands = 0,
    exports = 0,
    completedCleanup = null;
  const emit = (value) => process.stdout.write(JSON.stringify(value) + "\n");
  const exportRecord = async () => {
    assert(exports < 80, "Export budget exhausted");
    exports++;
    try {
      await verifyLocal();
      record.finalSourceStable = true;
    } catch (error) {
      record.finalSourceStable = false;
      record.errors.push(String(error.message).slice(0, 400));
    }
    record.lastExportAt = new Date().toISOString();
    await writeFile(
      path.join(directory, "collection.json"),
      JSON.stringify(record, null, 2) + "\n",
    );
    return {
      ok: true,
      file: path.join(directory, "collection.json"),
      hearing: record.hearing,
      actualBlock: record.actualBlock,
    };
  };
  const evaluate = (operation) =>
    bounded(
      page.evaluate((name) => {
        const probe = window.__v1HearingProbe;
        if (!probe) return { ok: false, code: "PRELOAD_OR_PAGE_LOST", actualBlock: "UNKNOWN" };
        return name === "snapshot" ? probe.snapshot({ timeoutMs: 1000 }) : probe[name]();
      }, operation),
      operation === "attach" ? 5000 : 2500,
    );
  const view = () =>
    bounded(
      page.evaluate(() => {
        const model = window.__reflectionLab?.getSnapshot();
        return model
          ? {
              simulationState: model.simulationState,
              tick: model.tick,
              runId: model.runId,
              sceneRevision: model.sceneRevision,
              monitor: model.monitor,
              listener: model.listener,
              interactionMode: model.interactionMode,
              acousticState: model.acoustic.state,
            }
          : null;
      }),
      2000,
    );
  const cleanup = async () => {
    collecting = false;
    if (completedCleanup?.ok) return completedCleanup;
    let result;
    try {
      result = await evaluate("cleanup");
    } catch (error) {
      result = {
        ok: false,
        code: "CLEANUP_UNAVAILABLE",
        message: String(error.message),
        ownedResourcesUnknown: true,
      };
    }
    if (record.operations.length < 96)
      record.operations.push({ at: new Date().toISOString(), operation: "cleanup", result });
    if (result.ok) completedCleanup = result;
    return result;
  };
  try {
    native = await launchExternalNativeBrowser({
      profile: profilePath,
      executablePath: browserExecutable,
      visible: true,
    });
    record.browser = {
      ownedPid: native.pid,
      executable: native.executable,
      args: native.args,
      profile: native.profile,
      visible: native.visible,
      version: native.browser.version(),
      os: process.platform,
      osVersion: "USER_REPORT_REQUIRED",
    };
    await native.context.route(
      "**/*",
      createFrozenRouteHandler({
        origin: url.origin,
        responses: frozenResponses,
        onBlocked: (entry) => {
          if (record.blockedRequests.length < 32) record.blockedRequests.push(entry);
        },
      }),
    );
    await native.context.addInitScript({
      content: createHearingProbePreload({
        evidenceKind: "native-browser",
        ...binding,
        scope: "instrumented existing e2e App context; callback observation only",
      }),
    });
    const pages = native.context.pages();
    assert(pages.length <= 1, "Only sole owned blank page expected");
    page = pages[0] ?? (await native.context.newPage());
    page.on("framenavigated", (frame) => {
      if (loaded && frame === page.mainFrame()) invalidated = "PAGE_NAVIGATED_OR_RELOADED";
    });
    page.on("close", () => {
      invalidated = "PAGE_CLOSED";
    });
    page.on("pageerror", (error) => {
      if (record.errors.length < 32) record.errors.push(String(error.message).slice(0, 400));
    });
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => !!window.__reflectionLab && !!window.__v1HearingProbe, null, {
      timeout: 15000,
    });
    loaded = true;
    emit({
      stage: "WAITING_USER_VISIBLE_APP",
      url: page.url(),
      ownedPid: native.pid,
      directory,
      instructions:
        "Do not click Enable listening until coordinator sends arm; user performs all listening/Run/Monitor actions in visible UI.",
    });
    const command = async (input) => {
      assert(input && typeof input.command === "string");
      if (!["cleanup", "export", "finish", "close-browser"].includes(input.command)) {
        assert(collecting, "Collection ended; only cleanup/export/finish/close-browser remain");
        assert(!invalidated, invalidated);
        assert(++commands <= 64, "Collection command budget64 exhausted");
      }
      let result;
      if (input.command === "report") {
        assert.equal(input.providedBy, "actual-user", "Actual observer report required");
        const allowed = [
          "hardware",
          "actualRoute",
          "interfaceOrDac",
          "osVersion",
          "deviceVolume",
          "monitorGain",
          "mode",
          "heard",
          "clickPop",
          "volumeJump",
          "movingPosition",
          "dropout",
          "pauseResume",
          "duration",
          "notes",
        ];
        const fields = {};
        for (const key of allowed)
          if (input[key] !== undefined) {
            assert(
              typeof input[key] === "string" && input[key].length <= 512,
              `Bounded user report:${key}`,
            );
            fields[key] = input[key];
          }
        record.userReports.push({
          at: new Date().toISOString(),
          source: "actual-user-report",
          fields,
        });
        if (
          ["heard", "clickPop", "volumeJump", "movingPosition", "dropout", "pauseResume"].some(
            (key) => fields[key] !== undefined,
          )
        )
          record.hearing = "USER_REPORTED_NOT_ADJUDICATED";
        result = { ok: true, userReportedOnly: true };
      } else if (input.command === "export") result = await exportRecord();
      else if (input.command === "cleanup") result = await cleanup();
      else if (input.command === "finish" || input.command === "close-browser") {
        const disposition = input.command === "close-browser" ? "close" : input.browser;
        assert(
          ["keep", "close"].includes(disposition),
          "Explicit browser keep/close disposition required",
        );
        result = await cleanup();
        if (!result.ok) {
          await exportRecord();
          return result;
        }
        record.browserDisposition = disposition;
        record.finishedAt = new Date().toISOString();
        await exportRecord();
        if (disposition === "close") {
          record.browserCleanup = await native.close();
          await exportRecord();
        } else
          emit({
            stage: "TAB_RETAINED_EXPLICITLY",
            instruction:
              "Probe cleaned; driver stays idle attached. User controls main audio. Send close-browser only when explicitly authorized.",
          });
      } else {
        const operations = {
          arm: "armEnableListening",
          select: "selectMainContext",
          attach: "attach",
          snapshot: "snapshot",
          status: "status",
        };
        assert(operations[input.command], "Unknown command");
        result = await evaluate(operations[input.command]);
        const appView = await view();
        record.operations.push({
          at: new Date().toISOString(),
          operation: input.command,
          result,
          appView,
        });
        if (input.command === "attach" && result.ok)
          record.nativeProbe = "ATTACHED_AWAITING_CALLBACK";
        if (input.command === "snapshot") {
          const blocks = result.observation?.blocks ?? priorBlocks;
          const delta = Math.max(0, blocks - priorBlocks);
          priorBlocks = blocks;
          record.nativeObservations.push({
            at: new Date().toISOString(),
            label: String(input.label ?? "").slice(0, 80),
            callbackDeltaSincePriorSnapshot: delta,
            callbacksObservedSincePriorSnapshot: delta > 0,
            appView,
            result,
          });
          if (result.ok && result.actualBlock === "OBSERVED") {
            record.nativeProbe = "CALLBACKS_OBSERVED";
            record.actualBlock = "OBSERVED_HISTOGRAM_SEE_NATIVE_OBSERVATIONS";
          }
        }
      }
      return result;
    };
    const commandError = (error) => {
      const message = String(error.message ?? error).slice(0, 400);
      if (record.errors.length < 32) record.errors.push({ kind: "host-command", message });
      emit({ ok: false, error: message });
    };
    return { directory, record, command, cleanup, exportRecord, emit, commandError };
  } catch (error) {
    record.errors.push(String(error.message).slice(0, 400));
    if (page) await cleanup();
    // Startup fails before handing the visible UI to the user; only this newly owned browser is closed.
    if (native && !loaded) {
      try {
        record.browserCleanup = await native.close();
      } catch (cleanupError) {
        record.browserCleanup = {
          ok: false,
          error: String(cleanupError.message ?? cleanupError).slice(0, 400),
        };
        record.errors.push({ kind: "owned-browser-cleanup", ...record.browserCleanup });
      }
    }
    try {
      await exportRecord();
    } catch (exportError) {
      // Preserve the original startup error even if final receipt export also fails.
      if (error && typeof error === "object" && Object.isExtensible(error))
        error.hearingProbeReceipt = {
          directory,
          browserCleanup: record.browserCleanup ?? null,
          exportError: String(exportError.message ?? exportError).slice(0, 400),
        };
    }
    throw error;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      go: { type: "boolean" },
      "base-url": { type: "string" },
      "preview-pid": { type: "string" },
      "browser-executable": { type: "string" },
      binding: { type: "string" },
    },
  });
  const session = await launchManualProbeDriver({
    go: values.go,
    baseUrl: values["base-url"],
    previewPid: Number(values["preview-pid"]),
    browserExecutable: values["browser-executable"],
    bindingPath: values.binding,
  });
  let queue = Promise.resolve();
  const emergency = () => {
    queue = queue
      .then(async () => {
        await session.cleanup();
        session.emit(await session.exportRecord());
        session.emit({
          stage: "COLLECTION_STOPPED_BROWSER_RETAINED",
          instruction:
            "User mutes/pauses in visible app; finish requires explicit keep/close disposition.",
        });
      })
      .catch((error) => session.emit({ ok: false, error: String(error.message) }));
  };
  const limit = setTimeout(emergency, 30 * 60 * 1000);
  process.on("SIGINT", emergency);
  const decoder = createBoundedLineDecoder();
  let finished = false;
  const consume = async (line) => {
    queue = queue.then(async () => {
      try {
        const parsed = JSON.parse(line),
          result = await session.command(parsed);
        session.emit(result);
        if (
          (parsed.command === "close-browser" ||
            (parsed.command === "finish" && parsed.browser === "close")) &&
          result.ok
        )
          finished = true;
      } catch (error) {
        session.commandError(error);
      }
    });
    await queue;
  };
  try {
    for await (const chunk of process.stdin) {
      for (const line of decoder.feed(chunk)) {
        await consume(line);
        if (finished) break;
      }
      if (finished) break;
    }
    if (!finished) for (const line of decoder.finish()) await consume(line);
  } catch (error) {
    session.commandError(error);
  }
  clearTimeout(limit);
  process.off("SIGINT", emergency);
  await session.cleanup();
  await session.exportRecord();
  // EOF never silently closes a retained user tab. Native ownership remains recorded in collection.json.
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch((error) => {
    process.stderr.write(String(error.stack ?? error) + "\n");
    process.exitCode = 1;
  });
