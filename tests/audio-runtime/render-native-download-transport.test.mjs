import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  stat,
  lstat,
  realpath,
  readdir,
  unlink,
  rmdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setImmediate as nextTurn } from "node:timers/promises";
import { createOwnedNativeDownloadTransport } from "../browser/nonadvanced/long-render/native-download-transport.mjs";
import { OwnedDownloadBatch } from "../browser/nonadvanced/long-render/owned-downloads.mjs";

const checkoutRoot = fileURLToPath(new URL("../../", import.meta.url));
const testRoot = path.join(checkoutRoot, ".cache/native-download-transport-unit");
const payload = Buffer.from("test-owned Chrome-download stand-in bytes\n", "utf8");
const payloadHash = createHash("sha256").update(payload).digest("hex");
const ownedGuid = "11111111-1111-4111-8111-111111111111";
const foreignGuid = "22222222-2222-4222-8222-222222222222";
const secondGuid = "33333333-3333-4333-8333-333333333333";
const blobUrl = "blob:http://127.0.0.1:5353/native-owned-download";
const codeIs = (code) => (error) => error?.code === code;

class FakePublicSession extends EventEmitter {
  constructor(harness, kind) {
    super();
    this.harness = harness;
    this.kind = kind;
    this.detached = false;
  }
  async send(method, params = {}) {
    this.harness.commands.push({ kind: this.kind, method, params });
    if (method === "Target.getTargetInfo") return { targetInfo: { ...this.harness.targetInfo } };
    if (method === "Target.getBrowserContexts")
      return { browserContextIds: [this.harness.targetInfo.browserContextId] };
    if (method === "Page.getFrameTree") return { frameTree: { frame: { ...this.harness.frame } } };
    if (
      method === "Page.enable" ||
      method === "Browser.setDownloadBehavior" ||
      method === "Browser.cancelDownload"
    )
      return {};
    throw new Error(`UNEXPECTED_PUBLIC_CDP_COMMAND:${method}`);
  }
  async detach() {
    this.detached = true;
  }
}

async function fixture(t, count = 1) {
  await mkdir(testRoot, { recursive: true });
  const directory = await mkdtemp(path.join(testRoot, "case-"));
  const createdDirectory = await lstat(directory);
  const createdRealpath = await realpath(directory);
  const transports = [];
  const harness = {
    commands: [],
    targetInfo: {
      targetId: "owned-target",
      type: "page",
      url: "http://127.0.0.1:5353/fixture.html",
      browserContextId: "owned-context",
    },
    frame: {
      id: "owned-frame",
      loaderId: "owned-loader",
      url: "http://127.0.0.1:5353/fixture.html",
    },
  };
  harness.pageSession = new FakePublicSession(harness, "page");
  harness.browserSession = new FakePublicSession(harness, "browser");
  harness.page = {
    context: () => harness.context,
    url: () => harness.frame.url,
    isClosed: () => false,
  };
  harness.context = {
    browser: () => harness.browser,
    pages: () => [harness.page],
    async newCDPSession(page) {
      assert.equal(page, harness.page);
      return harness.pageSession;
    },
  };
  harness.browser = {
    contexts: () => [harness.context],
    isConnected: () => true,
    browserType: () => ({ name: () => "chromium" }),
    async newBrowserCDPSession() {
      return harness.browserSession;
    },
  };
  harness.outputs = Array.from({ length: count }, (_, index) => ({
    id: `output-${index}`,
    filename: `output-${index}.wav`,
    bytes: payload.byteLength,
    sha256: payloadHash,
  }));
  harness.directory = directory;
  harness.open = async (overrides = {}) => {
    const transport = await createOwnedNativeDownloadTransport(
      overrides.browser ?? harness.browser,
      overrides.context ?? harness.context,
      overrides.page ?? harness.page,
      overrides.directory ?? directory,
      { outputs: overrides.outputs ?? harness.outputs },
    );
    transports.push(transport);
    return transport;
  };
  harness.download = (index = 0, overrides = {}) => ({
    page: () => harness.page,
    suggestedFilename: () => harness.outputs[index].filename,
    url: () => `${blobUrl}/${index}`,
    async saveAs() {
      assert.fail("direct transport must read Chrome GUID file, not Playwright saveAs");
    },
    ...overrides,
  });
  harness.begin = (index = 0, guid = ownedGuid, overrides = {}) =>
    harness.browserSession.emit("Browser.downloadWillBegin", {
      frameId: harness.frame.id,
      guid,
      suggestedFilename: harness.outputs[index].filename,
      url: `${blobUrl}/${index}`,
      ...overrides,
    });
  harness.progress = (guid = ownedGuid, state = "completed", overrides = {}) =>
    harness.browserSession.emit("Browser.downloadProgress", {
      guid,
      state,
      totalBytes: payload.byteLength,
      receivedBytes: state === "inProgress" ? 1 : payload.byteLength,
      ...overrides,
    });
  t.after(async () => {
    for (const transport of transports) {
      await transport.cancel();
      await transport.settle();
      await transport.dispose();
    }
    // Revalidate the actual final inode/realpath before deleting this exact flat fixture.
    // No recursive removal is used and symlink targets are never followed.
    const rootRealpath = await realpath(checkoutRoot);
    const testRealpath = await realpath(testRoot);
    const finalRealpath = await realpath(directory);
    const finalDirectory = await lstat(directory);
    const relativeRoot = path.relative(rootRealpath, testRealpath);
    const relative = path.relative(testRealpath, finalRealpath);
    assert.ok(
      relativeRoot !== "" &&
        relativeRoot !== ".." &&
        !relativeRoot.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativeRoot),
    );
    assert.equal(finalRealpath, createdRealpath);
    assert.ok(finalDirectory.isDirectory() && !finalDirectory.isSymbolicLink());
    assert.equal(finalDirectory.dev, createdDirectory.dev);
    assert.equal(finalDirectory.ino, createdDirectory.ino);
    assert.ok(
      relative.startsWith("case-") && !relative.includes(path.sep) && !path.isAbsolute(relative),
    );
    const knownNames = new Set([
      ...harness.outputs.map((value) => value.filename),
      ownedGuid,
      foreignGuid,
      secondGuid,
      `${ownedGuid}.crdownload`,
      `${foreignGuid}.crdownload`,
      `${secondGuid}.crdownload`,
    ]);
    const entries = await readdir(finalRealpath, { withFileTypes: true });
    assert.ok(entries.every((entry) => knownNames.has(entry.name) && !entry.isDirectory()));
    for (const entry of entries) await unlink(path.join(finalRealpath, entry.name));
    await rmdir(finalRealpath);
  });
  return harness;
}

async function missing(file) {
  try {
    await stat(file);
    return false;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

// These are Node unit stand-ins for Chrome event/disk ownership. The separate native
// runner must still download every anchor in Chrome and preserve its original deadline.
test("native transport rejects mismatched public browser/context/page ownership before policy mutation", async (t) => {
  const h = await fixture(t);
  h.page.context = () => ({});
  await assert.rejects(h.open(), codeIs("NATIVE_DOWNLOAD_OWNERSHIP"));
  assert.equal(
    h.commands.some((entry) => entry.method === "Browser.setDownloadBehavior"),
    false,
  );
});

test("native transport requires a concrete context ID and refuses default-context guessing", async (t) => {
  const h = await fixture(t);
  delete h.targetInfo.browserContextId;
  await assert.rejects(h.open(), codeIs("NATIVE_DOWNLOAD_CONTEXT_REQUIRED"));
  assert.equal(
    h.commands.some((entry) => entry.method === "Browser.setDownloadBehavior"),
    false,
  );
});

test("native transport requires an existing absolute directory strictly inside its own checkout", async (t) => {
  const h = await fixture(t);
  await assert.rejects(
    h.open({ directory: ".cache/relative-native-download" }),
    codeIs("NATIVE_DOWNLOAD_DIRECTORY"),
  );
  await assert.rejects(
    h.open({ directory: path.parse(checkoutRoot).root }),
    codeIs("NATIVE_DOWNLOAD_DIRECTORY"),
  );
  assert.equal(
    h.commands.some((entry) => entry.method === "Browser.setDownloadBehavior"),
    false,
  );
});

test("native transport known-file list rejects traversal, Windows device names, duplicate names and unfrozen bytes/hash", async (t) => {
  const h = await fixture(t);
  for (const filename of [
    "../escape.wav",
    "nested/file.wav",
    "nested\\file.wav",
    "NUL.wav",
    "trail.wav.",
  ])
    await assert.rejects(
      h.open({ outputs: [{ ...h.outputs[0], filename }] }),
      codeIs("NATIVE_DOWNLOAD_DESCRIPTOR"),
    );
  await assert.rejects(
    h.open({ outputs: [h.outputs[0], { ...h.outputs[0], id: "another" }] }),
    codeIs("NATIVE_DOWNLOAD_DESCRIPTOR"),
  );
  await assert.rejects(
    h.open({ outputs: [{ ...h.outputs[0], bytes: -1 }] }),
    codeIs("NATIVE_DOWNLOAD_DESCRIPTOR"),
  );
  await assert.rejects(
    h.open({ outputs: [{ ...h.outputs[0], sha256: "not-a-hash" }] }),
    codeIs("NATIVE_DOWNLOAD_DESCRIPTOR"),
  );
});

test("native transport current fixture cap accepts all sixteen known entries and rejects seventeen", async (t) => {
  const h = await fixture(t, 16);
  const transport = await h.open();
  assert.equal(transport.identity.browserContextId, "owned-context");
  assert.equal(transport.identity.frameId, "owned-frame");
  assert.equal(transport.identity.targetId, "owned-target");
  assert.equal(transport.identity.mode, "Browser.allowAndName");
  const policies = h.commands.filter((entry) => entry.method === "Browser.setDownloadBehavior");
  assert.deepEqual(policies[0]?.params, {
    behavior: "allowAndName",
    browserContextId: "owned-context",
    downloadPath: directoryCanonical(h.directory),
    eventsEnabled: true,
  });
  const seventeen = [...h.outputs, { ...h.outputs[0], id: "output-16", filename: "output-16.wav" }];
  await assert.rejects(h.open({ outputs: seventeen }), codeIs("NATIVE_DOWNLOAD_DESCRIPTOR"));
});
function directoryCanonical(directory) {
  return path.resolve(directory);
}

test("native transport refuses an already-existing output without overwriting it", async (t) => {
  const h = await fixture(t);
  const target = path.join(h.directory, h.outputs[0].filename);
  const preserved = Buffer.from("old valid result");
  await writeFile(target, preserved);
  await assert.rejects(h.open(), codeIs("NATIVE_DOWNLOAD_TARGET_EXISTS"));
  assert.deepEqual(await readFile(target), preserved);
});

test("native transport cannot publish an on-disk GUID file until matching completed native progress", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  await writeFile(path.join(h.directory, ownedGuid), payload);
  let deliverDownload;
  const pendingDownload = new Promise((resolve) => {
    deliverDownload = resolve;
  });
  const publications = [];
  h.page.waitForEvent = () => pendingDownload;
  h.page.evaluate = async (_action, id) => {
    assert.equal(id, h.outputs[0].id);
    h.begin();
    deliverDownload(h.download());
  };
  const batch = new OwnedDownloadBatch(h.page, h.directory, (value) => publications.push(value), {
    save: transport.save,
  });
  const saving = batch.run([h.outputs[0].id]);
  let settled = false;
  void saving.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  h.progress(ownedGuid, "inProgress");
  await nextTurn();
  assert.equal(settled, false, "existing bytes do not establish Chrome completion");
  assert.equal(publications.length, 0);
  assert.equal(await missing(path.join(h.directory, h.outputs[0].filename)), true);
  h.progress();
  await saving;
  await batch.settle();
  assert.equal(publications.length, 1);
  assert.equal(publications[0].id, h.outputs[0].id);
  const saved = publications[0].transport;
  assert.equal(saved.id, h.outputs[0].id);
  assert.equal(saved.guid, ownedGuid);
  assert.equal(saved.bytes, payload.byteLength);
  assert.equal(saved.sha256, payloadHash);
  assert.equal(saved.browserContextId, "owned-context");
  assert.equal(saved.frameId, "owned-frame");
  assert.deepEqual(await readFile(saved.path), payload);
  assert.deepEqual(await readFile(path.join(h.directory, ownedGuid)), payload);
});

test("native transport ignores foreign frame/progress rather than guessing context from global events", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  await writeFile(path.join(h.directory, ownedGuid), payload);
  h.begin(0, foreignGuid, { frameId: "foreign-frame" });
  h.progress(foreignGuid);
  const saving = transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id);
  let settled = false;
  void saving.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await nextTurn();
  assert.equal(settled, false);
  h.begin();
  h.progress();
  assert.equal((await saving).guid, ownedGuid);
  assert.equal(
    h.commands.some(
      (entry) => entry.method === "Browser.cancelDownload" && entry.params.guid === foreignGuid,
    ),
    false,
  );
});

test("native transport binds public Download page, suggested filename and URL to its frozen descriptor", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  h.begin();
  await assert.rejects(
    transport.save(h.download(0, { page: () => ({}) }), h.outputs[0].filename, h.outputs[0].id),
    codeIs("NATIVE_DOWNLOAD_BINDING"),
  );
  await assert.rejects(
    transport.save(h.download(), "another.wav", h.outputs[0].id),
    codeIs("NATIVE_DOWNLOAD_BINDING"),
  );
  await assert.rejects(
    transport.save(
      h.download(0, { url: () => "blob:http://foreign.invalid/file" }),
      h.outputs[0].filename,
      h.outputs[0].id,
    ),
    codeIs("NATIVE_DOWNLOAD_BINDING"),
  );
});

test("native transport never guesses between duplicate matching native GUIDs", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  h.begin(0, ownedGuid);
  h.begin(0, secondGuid);
  await assert.rejects(
    transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id),
    codeIs("NATIVE_DOWNLOAD_AMBIGUOUS"),
  );
  assert.equal(
    h.commands.some((entry) => entry.method === "Browser.cancelDownload"),
    false,
  );
});

test("native transport rejects malformed native GUIDs before any filesystem path can be formed", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  h.begin(0, "../foreign-file");
  await assert.rejects(
    transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id),
    codeIs("NATIVE_DOWNLOAD_GUID"),
  );
});

test("native transport completed byte-count mismatch and partial files never become saved outputs", async (t) => {
  const h = await fixture(t, 2);
  const transport = await h.open();
  await writeFile(path.join(h.directory, ownedGuid), payload);
  h.begin();
  const wrongSize = transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id);
  void wrongSize.catch(() => undefined);
  h.progress(ownedGuid, "completed", {
    totalBytes: payload.byteLength + 1,
    receivedBytes: payload.byteLength + 1,
  });
  await assert.rejects(wrongSize, codeIs("NATIVE_DOWNLOAD_PROGRESS"));
  const partial = path.join(h.directory, `${secondGuid}.crdownload`);
  await writeFile(partial, payload.subarray(0, 3));
  h.begin(1, secondGuid);
  const incomplete = transport.save(h.download(1), h.outputs[1].filename, h.outputs[1].id);
  void incomplete.catch(() => undefined);
  h.progress(secondGuid);
  await assert.rejects(incomplete, codeIs("NATIVE_DOWNLOAD_PARTIAL"));
  assert.equal(await missing(path.join(h.directory, h.outputs[0].filename)), true);
  assert.equal(await missing(path.join(h.directory, h.outputs[1].filename)), true);
  assert.deepEqual(await readFile(partial), payload.subarray(0, 3));
});

test("native transport checks actual native bytes against the frozen hash and rejects foreign filePath metadata", async (t) => {
  const h = await fixture(t, 2);
  const transport = await h.open();
  const wrong = Buffer.from(payload);
  wrong[0] ^= 1;
  await writeFile(path.join(h.directory, ownedGuid), wrong);
  h.begin();
  const hashMismatch = transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id);
  void hashMismatch.catch(() => undefined);
  h.progress();
  await assert.rejects(hashMismatch, codeIs("NATIVE_DOWNLOAD_HASH"));
  await writeFile(path.join(h.directory, secondGuid), payload);
  h.begin(1, secondGuid);
  const outside = transport.save(h.download(1), h.outputs[1].filename, h.outputs[1].id);
  void outside.catch(() => undefined);
  h.progress(secondGuid, "completed", { filePath: path.resolve(h.directory, "..", "foreign.wav") });
  await assert.rejects(outside, codeIs("NATIVE_DOWNLOAD_PATH"));
  assert.equal(await missing(path.join(h.directory, h.outputs[1].filename)), true);
});

test("native transport cancellation targets only claimed owned GUID and prevents late completion publication", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  h.begin(0, foreignGuid, { frameId: "foreign-frame" });
  h.begin();
  const saving = transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id);
  void saving.catch(() => undefined);
  await nextTurn();
  await transport.cancel();
  await assert.rejects(saving, codeIs("NATIVE_DOWNLOAD_CANCELLED"));
  await writeFile(path.join(h.directory, ownedGuid), payload);
  h.progress();
  await transport.settle();
  const cancelled = h.commands.filter((entry) => entry.method === "Browser.cancelDownload");
  assert.deepEqual(
    cancelled.map((entry) => entry.params),
    [{ guid: ownedGuid, browserContextId: "owned-context" }],
  );
  assert.equal(await missing(path.join(h.directory, h.outputs[0].filename)), true);
});

test("native transport rechecks frozen frame identity and destination exclusivity for each save", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  h.frame.loaderId = "navigated-loader";
  await assert.rejects(
    transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id),
    codeIs("NATIVE_DOWNLOAD_FRAME_CHANGED"),
  );
  h.frame.loaderId = "owned-loader";
  const preserved = Buffer.from("concurrent old file");
  const target = path.join(h.directory, h.outputs[0].filename);
  await writeFile(target, preserved);
  await writeFile(path.join(h.directory, ownedGuid), payload);
  h.begin();
  const saving = transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id);
  void saving.catch(() => undefined);
  h.progress();
  await assert.rejects(saving, codeIs("NATIVE_DOWNLOAD_TARGET_EXISTS"));
  assert.deepEqual(await readFile(target), preserved);
});

test("native transport invalidates an old claimed GUID on reuse and remembers pre-save candidate overflow", async (t) => {
  const reused = await fixture(t, 2);
  const transport = await reused.open();
  await writeFile(path.join(reused.directory, ownedGuid), payload);
  reused.begin(0, ownedGuid);
  const saving = transport.save(
    reused.download(0),
    reused.outputs[0].filename,
    reused.outputs[0].id,
  );
  void saving.catch(() => undefined);
  await nextTurn();
  // The same GUID is now announced as another known output/URL. The first claim
  // must become invalid too; poisoning only the second key cannot protect it.
  reused.begin(1, ownedGuid);
  reused.progress(ownedGuid);
  const reuseOutcome = await saving.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", code: reason.code }),
  );
  await transport.dispose();

  const overflow = await fixture(t);
  const capped = await overflow.open();
  const guidAt = (index) => `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, "0")}`;
  for (let index = 0; index < 32; index++)
    overflow.begin(0, guidAt(index), { url: `${blobUrl}/unmatched-candidate-${index}` });
  // Overflow arrives before save has an active waiter. It must remain a fatal
  // ambiguity instead of being silently dropped and turning into a 90-second wait.
  overflow.begin(0, guidAt(32));
  let capacityOutcome = null;
  const pending = capped.save(
    overflow.download(),
    overflow.outputs[0].filename,
    overflow.outputs[0].id,
  );
  void pending.then(
    (value) => {
      capacityOutcome = { status: "fulfilled", value };
    },
    (reason) => {
      capacityOutcome = { status: "rejected", code: reason.code };
    },
  );
  await nextTurn();
  const beforeCancellation = capacityOutcome;
  await capped.cancel();
  await pending.catch(() => undefined);
  assert.deepEqual(
    {
      reuse: { status: reuseOutcome.status, code: reuseOutcome.code ?? null },
      overflow: beforeCancellation,
    },
    {
      reuse: { status: "rejected", code: "NATIVE_DOWNLOAD_GUID" },
      overflow: { status: "rejected", code: "NATIVE_DOWNLOAD_AMBIGUOUS" },
    },
  );
});

test("native transport revalidates the saved file after the final asynchronous CDP frame check", async (t) => {
  const h = await fixture(t);
  const transport = await h.open();
  const target = path.join(h.directory, h.outputs[0].filename);
  const changed = Buffer.from(payload);
  changed[0] ^= 1;
  await writeFile(path.join(h.directory, ownedGuid), payload);
  const originalSend = h.pageSession.send.bind(h.pageSession);
  let targetInfoCalls = 0;
  let mutatedAfterInitialHash = false;
  h.pageSession.send = async (method, params) => {
    const result = await originalSend(method, params);
    if (method === "Target.getTargetInfo" && ++targetInfoCalls === 2) {
      // The source and initial destination hash have already been verified. This
      // exact awaited boundary lets the same-length destination change before return.
      await writeFile(target, changed);
      mutatedAfterInitialHash = true;
    }
    return result;
  };
  h.begin();
  const saving = transport.save(h.download(), h.outputs[0].filename, h.outputs[0].id);
  void saving.catch(() => undefined);
  h.progress();
  const outcome = await saving.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", code: reason.code }),
  );
  assert.equal(mutatedAfterInitialHash, true);
  assert.equal(
    createHash("sha256")
      .update(await readFile(target))
      .digest("hex") === payloadHash,
    false,
  );
  assert.equal(outcome.status, "rejected");
  assert.ok(["NATIVE_DOWNLOAD_PATH", "NATIVE_DOWNLOAD_HASH"].includes(outcome.code));
});

test("native transport resets context policy after an applied command rejects and preserves cleanup failure evidence", async (t) => {
  const simulate = async (failReset) => {
    const h = await fixture(t);
    const originalSend = h.browserSession.send.bind(h.browserSession);
    const setupFailure = new Error("SIMULATED_POLICY_APPLIED_THEN_REPLY_REJECTED");
    const resetFailure = new Error("SIMULATED_POLICY_RESET_REPLY_REJECTED");
    h.browserSession.send = async (method, params) => {
      const result = await originalSend(method, params);
      if (method === "Browser.setDownloadBehavior" && params.behavior === "allowAndName")
        throw setupFailure;
      if (method === "Browser.setDownloadBehavior" && params.behavior === "default" && failReset)
        throw resetFailure;
      return result;
    };
    let reason = null;
    try {
      await h.open();
    } catch (error) {
      reason = error;
    }
    return {
      h,
      reason,
      setupFailure,
      resetFailure,
      policies: h.commands.filter((entry) => entry.method === "Browser.setDownloadBehavior"),
    };
  };
  const restored = await simulate(false);
  const unknownPolicy = await simulate(true);
  const reset = { behavior: "default", browserContextId: "owned-context", eventsEnabled: false };
  assert.deepEqual(
    restored.policies.map((entry) => entry.params.behavior),
    ["allowAndName", "default"],
  );
  assert.deepEqual(restored.policies[1]?.params, reset);
  assert.equal(
    restored.reason,
    restored.setupFailure,
    "setup error identity must not be replaced by cleanup",
  );
  assert.equal(restored.reason.nativeDownloadCleanup?.policyAttempted, true);
  assert.equal(restored.reason.nativeDownloadCleanup?.policyReset.status, "fulfilled");
  assert.equal(restored.reason.nativeDownloadCleanup?.requiresOwnedContextClose, false);
  assert.deepEqual(
    unknownPolicy.policies.map((entry) => entry.params.behavior),
    ["allowAndName", "default"],
  );
  assert.deepEqual(unknownPolicy.policies[1]?.params, reset);
  assert.equal(unknownPolicy.reason, unknownPolicy.setupFailure);
  assert.equal(unknownPolicy.reason.nativeDownloadCleanup?.policyReset.status, "rejected");
  assert.equal(
    unknownPolicy.reason.nativeDownloadCleanup?.policyReset.reason.message,
    unknownPolicy.resetFailure.message,
  );
  assert.equal(unknownPolicy.reason.nativeDownloadCleanup?.requiresOwnedContextClose, true);
  assert.equal(restored.h.pageSession.detached && restored.h.browserSession.detached, true);
  assert.equal(
    unknownPolicy.h.pageSession.detached && unknownPolicy.h.browserSession.detached,
    true,
  );
  const primitiveTree = (value) =>
    value === null ||
    ["string", "number", "boolean"].includes(typeof value) ||
    (Array.isArray(value) && value.every(primitiveTree)) ||
    (typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype &&
      Object.values(value).every(primitiveTree));
  assert.ok(primitiveTree(restored.reason.nativeDownloadCleanup));
  assert.ok(primitiveTree(unknownPolicy.reason.nativeDownloadCleanup));
});
