import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, rm, mkdir, writeFile, symlink, lstat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  acquireDataset,
  CACHE_ROOT,
  parseArgs,
  validateManifest,
} from "../../scripts/setup/datasets.mjs";

// Original synthetic bytes only. These metadata intentionally do not describe an actual Zenodo record.
const CONTENT = Buffer.from("Reflection Lab synthetic dataset fetch fixture.\n", "utf8");
const SHA256 = createHash("sha256").update(CONTENT).digest("hex");
const NO_FETCH = async () => {
  throw new Error("Unexpected network request in isolated test");
};

function fixture(t, overrides = {}) {
  const manifest = {
    dataset_id: `spike-${randomUUID()}`,
    record_doi: null,
    version: "synthetic-v1",
    source_url: "https://zenodo.org/records/0",
    download_url: "https://zenodo.org/records/0/files/synthetic.txt",
    license_id: "SYNTHETIC_TEST_ONLY",
    license_status: "VERIFIED",
    license_url: "https://zenodo.org/records/0",
    license_evidence_url: "https://zenodo.org/records/0",
    license_scope: "Original in-memory test fixture only; no third-party rights assertion.",
    accessed_at: "2026-10-26",
    file_name: "synthetic.txt",
    size_bytes: CONTENT.length,
    sha256: SHA256,
    subset_ids: ["synthetic-only"],
    modifications: [],
    attribution: "Reflection Lab original synthetic test bytes; no acoustic measurement.",
    test_ids: ["dataset-fetch-spike"],
    max_download_bytes: CONTENT.length,
    dry_run: true,
    acquisition_status: "NOT_RUN",
    ...overrides,
  };
  const cleanupRoot = path.join(CACHE_ROOT, manifest.dataset_id);
  const relative = path.relative(CACHE_ROOT, cleanupRoot);
  assert.ok(
    relative &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative),
  );
  // Cleanup is restricted to a random test-owned directory inside .cache/datasets.
  if (manifest.dataset_id.startsWith("spike-"))
    t.after(() => rm(cleanupRoot, { recursive: true, force: true }));
  return manifest;
}

function targetOf(manifest) {
  return path.join(CACHE_ROOT, manifest.dataset_id, manifest.sha256, manifest.file_name);
}

function streamed(chunks, headers = {}) {
  let index = 0;
  return new Response(
    new ReadableStream({
      pull(controller) {
        if (index === chunks.length) controller.close();
        else controller.enqueue(new Uint8Array(chunks[index++]));
      },
    }),
    { status: 200, headers },
  );
}

function mockFetch(factory) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, "manual");
      assert.equal(options.credentials, "omit");
      assert.equal(options.referrerPolicy, "no-referrer");
      assert.equal(options.headers["Accept-Encoding"], "identity");
      assert.ok(options.signal instanceof AbortSignal);
      return factory(url, calls.length);
    },
  };
}

async function assertNoPublishedFile(manifest) {
  await assert.rejects(lstat(targetOf(manifest)), { code: "ENOENT" });
  const directory = path.dirname(targetOf(manifest));
  const files = await readdir(directory).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  assert.deepEqual(files, []);
  const datasetFiles = await readdir(path.join(CACHE_ROOT, manifest.dataset_id)).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  assert.ok(datasetFiles.every((name) => !name.endsWith(".part")));
}

test("CLI parses explicit opt-in, manifest path and rejects unknown/duplicate options", () => {
  assert.equal(parseArgs([]).fetchEnabled, false);
  const options = parseArgs(["--manifest", "synthetic.json", "--fetch"]);
  assert.equal(options.fetchEnabled, true);
  assert.equal(options.manifestPath, path.resolve("synthetic.json"));
  for (const args of [
    ["--output", "../outside"],
    ["--manifest"],
    ["--fetch", "--fetch"],
    ["--manifest", "--fetch"],
  ]) {
    assert.throws(() => parseArgs(args), { code: "INVALID_ARGUMENT" });
  }
});

test("real UNKNOWN example reports BLOCKED in both modes without invoking fetch", async () => {
  const examplePath = new URL(
    "../../research/datasets/acquisition-manifest.example.json",
    import.meta.url,
  );
  const manifest = JSON.parse(await readFile(examplePath, "utf8"));
  assert.equal(manifest.sha256, null);
  for (const fetchEnabled of [false, true]) {
    const result = await acquireDataset(manifest, { fetchEnabled, fetchImpl: NO_FETCH });
    assert.equal(result.status, "BLOCKED");
    assert.ok(result.blockers.includes("LICENSE_NOT_VERIFIED"));
    assert.ok(result.blockers.includes("MISSING_SHA256"));
  }
});

test("verified dry-run validates the plan without fetch or filesystem creation", async (t) => {
  const manifest = fixture(t);
  const result = await acquireDataset(manifest, { fetchImpl: NO_FETCH });
  assert.equal(result.status, "READY");
  assert.equal(result.mode, "dry-run");
  await assert.rejects(lstat(path.join(CACHE_ROOT, manifest.dataset_id)), { code: "ENOENT" });
});

test("UNKNOWN, REFUSED and page-only license never acquire, even with complete pins", async (t) => {
  for (const license_status of ["UNKNOWN", "REFUSED", "VERIFIED_PAGE_ONLY"]) {
    const manifest = fixture(t, { license_status });
    const result = await acquireDataset(manifest, { fetchEnabled: true, fetchImpl: NO_FETCH });
    assert.equal(result.status, "BLOCKED");
    assert.deepEqual(result.blockers, ["LICENSE_NOT_VERIFIED"]);
  }
});

test("VERIFIED metadata still requires exact file license evidence, size, hash and subset", (t) => {
  const manifest = fixture(t, {
    license_evidence_url: null,
    size_bytes: null,
    sha256: null,
    subset_ids: [],
  });
  assert.deepEqual(validateManifest(manifest).blockers, [
    "MISSING_LICENSE_EVIDENCE_URL",
    "MISSING_SIZE_BYTES",
    "MISSING_SHA256",
    "MISSING_SUBSET_IDS",
  ]);
});

test("paths reject traversal, absolute/drive/ADS paths and Windows reserved filenames", (t) => {
  for (const file_name of [
    "../escape.wav",
    "..\\escape.wav",
    "/tmp/escape",
    "C:\\escape",
    "sound.wav:stream",
    "NUL",
    "con.wav",
    "LPT1.txt",
    "CONIN$",
    "COM¹.txt",
    "bad. ",
    ".",
    "..",
    "bad\nname",
  ]) {
    assert.throws(() => validateManifest(fixture(t, { file_name })), { code: "INVALID_PATH" });
  }
  for (const dataset_id of ["../escape", "C:\\escape", "CON", "NUL"]) {
    const manifest = fixture(t);
    manifest.dataset_id = dataset_id;
    assert.throws(() => validateManifest(manifest), { code: "INVALID_PATH" });
  }
});

test("download URLs reject HTTP, nonallowlist/lookalike hosts, userinfo, query and fragments", (t) => {
  for (const download_url of [
    "http://zenodo.org/a",
    "https://unapproved.invalid/a",
    "https://zenodo.org.evil.invalid/a",
    "https://user:secret@zenodo.org/a",
    "https://zenodo.org/a?token=secret",
    "https://zenodo.org/a#x",
    "https://zenodo.org:8443/a",
  ]) {
    assert.throws(
      () => validateManifest(fixture(t, { download_url })),
      (error) => ["INVALID_URL", "HOST_NOT_ALLOWED"].includes(error.code),
    );
  }
});

test("size/hash/shape inputs reject unsafe numbers, missing fields and incorrect hashes", (t) => {
  for (const overrides of [
    { size_bytes: CONTENT.length + 1 },
    { size_bytes: -1 },
    { size_bytes: Number.MAX_SAFE_INTEGER + 1 },
    { max_download_bytes: 50_000_001 },
    { sha256: "not-a-hash" },
    { dry_run: false },
    { accessed_at: "2026-02-31" },
    { unexpected_field: true },
  ])
    assert.throws(() => validateManifest(fixture(t, overrides)));
  const missing = fixture(t);
  delete missing.license_scope;
  assert.throws(() => validateManifest(missing), { code: "INVALID_MANIFEST" });
});

test("opt-in streams synthetic bytes, verifies SHA and publishes a reusable cache", async (t) => {
  const manifest = fixture(t);
  const mock = mockFetch(() =>
    streamed([CONTENT.subarray(0, 7), CONTENT.subarray(7)], {
      "content-length": String(CONTENT.length),
    }),
  );
  const result = await acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl });
  assert.equal(result.status, "ACQUIRED");
  assert.equal(result.sha256, SHA256);
  assert.deepEqual(await readFile(targetOf(manifest)), CONTENT);
  assert.equal(
    (await acquireDataset(manifest, { fetchEnabled: true, fetchImpl: NO_FETCH })).status,
    "CACHED",
  );
  assert.equal(mock.calls.length, 1);
  assert.deepEqual(await readdir(path.dirname(targetOf(manifest))), [manifest.file_name]);
});

test("wrong hash cannot publish and removes temporary bytes", async (t) => {
  const manifest = fixture(t, { sha256: "0".repeat(64) });
  const mock = mockFetch(() => streamed([CONTENT]));
  await assert.rejects(
    acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl }),
    { code: "HASH_MISMATCH" },
  );
  await assertNoPublishedFile(manifest);
});

test("missing/lying Content-Length cannot bypass streaming cap or exact final size", async (t) => {
  for (const headers of [{}, { "content-length": String(CONTENT.length) }]) {
    const manifest = fixture(t);
    const mock = mockFetch(() => streamed([CONTENT, Buffer.from("extra")], headers));
    await assert.rejects(
      acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl }),
      { code: "SIZE_LIMIT" },
    );
    await assertNoPublishedFile(manifest);
  }
  const short = fixture(t);
  const shortMock = mockFetch(() => streamed([CONTENT.subarray(0, 3)]));
  await assert.rejects(
    acquireDataset(short, { fetchEnabled: true, fetchImpl: shortMock.fetchImpl }),
    { code: "SIZE_MISMATCH" },
  );
  await assertNoPublishedFile(short);
});

test("incorrect Content-Length fails before cache creation", async (t) => {
  const manifest = fixture(t);
  const mock = mockFetch(() => streamed([CONTENT], { "content-length": "90000000" }));
  await assert.rejects(
    acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl }),
    { code: "SIZE_MISMATCH" },
  );
  await assertNoPublishedFile(manifest);
});

test("redirect to unapproved host or HTTP is rejected before a second request", async (t) => {
  for (const location of [
    "https://unapproved.invalid/a",
    "http://zenodo.org/a",
    "https://zenodo.org/a?token=secret",
  ]) {
    const manifest = fixture(t);
    const mock = mockFetch(() => new Response(null, { status: 302, headers: { location } }));
    await assert.rejects(
      acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl }),
      (error) => ["HOST_NOT_ALLOWED", "INVALID_URL"].includes(error.code),
    );
    assert.equal(mock.calls.length, 1);
    await assertNoPublishedFile(manifest);
  }
});

test("allowlisted relative redirect is checked and redirect loops have a fixed limit", async (t) => {
  const manifest = fixture(t);
  const mock = mockFetch((_url, count) =>
    count === 1
      ? new Response(null, { status: 302, headers: { location: "/files/synthetic.txt" } })
      : streamed([CONTENT]),
  );
  assert.equal(
    (await acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl })).status,
    "ACQUIRED",
  );
  assert.equal(mock.calls[1], "https://zenodo.org/files/synthetic.txt");
  const loop = fixture(t);
  const loopMock = mockFetch(
    () => new Response(null, { status: 302, headers: { location: "/loop" } }),
  );
  await assert.rejects(
    acquireDataset(loop, { fetchEnabled: true, fetchImpl: loopMock.fetchImpl }),
    { code: "REDIRECT_LIMIT" },
  );
  assert.equal(loopMock.calls.length, 4);
  await assertNoPublishedFile(loop);
});

test("corrupt existing cache is retained and refused without downloading", async (t) => {
  const manifest = fixture(t);
  await mkdir(path.dirname(targetOf(manifest)), { recursive: true });
  const corrupt = Buffer.alloc(CONTENT.length, 0);
  await writeFile(targetOf(manifest), corrupt);
  await assert.rejects(acquireDataset(manifest, { fetchEnabled: true, fetchImpl: NO_FETCH }), {
    code: "CACHE_MISMATCH",
  });
  assert.deepEqual(await readFile(targetOf(manifest)), corrupt);
});

test("preexisting junction cannot move cache output outside its expected directory", async (t) => {
  const manifest = fixture(t);
  const parent = path.join(CACHE_ROOT, manifest.dataset_id);
  const outside = path.join(parent, "outside");
  await mkdir(outside, { recursive: true });
  try {
    await symlink(
      outside,
      path.join(parent, manifest.sha256),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      t.skip("NOT RUN: 本機 sandbox 不允許建立 symlink/junction fixture。");
      return;
    }
    throw error;
  }
  await assert.rejects(acquireDataset(manifest, { fetchEnabled: true, fetchImpl: NO_FETCH }), {
    code: "UNSAFE_CACHE",
  });
  assert.deepEqual(await readdir(outside), []);
});

test("destination race never overwrites another writer", async (t) => {
  const manifest = fixture(t);
  const racingBytes = Buffer.from("retain another writer");
  const mock = mockFetch(async () => {
    await mkdir(path.dirname(targetOf(manifest)), { recursive: true });
    await writeFile(targetOf(manifest), racingBytes);
    return streamed([CONTENT]);
  });
  await assert.rejects(
    acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl }),
    { code: "CACHE_EXISTS" },
  );
  assert.deepEqual(await readFile(targetOf(manifest)), racingBytes);
  assert.deepEqual(await readdir(path.dirname(targetOf(manifest))), [manifest.file_name]);
});

test("unsupported encoding and HTTP failures do not publish", async (t) => {
  for (const response of [
    new Response("error", { status: 403 }),
    streamed([CONTENT], { "content-encoding": "gzip" }),
  ]) {
    const manifest = fixture(t);
    const mock = mockFetch(() => response);
    await assert.rejects(
      acquireDataset(manifest, { fetchEnabled: true, fetchImpl: mock.fetchImpl }),
      (error) => ["HTTP_STATUS", "ENCODING_NOT_SUPPORTED"].includes(error.code),
    );
    await assertNoPublishedFile(manifest);
  }
});
