import assert from "node:assert/strict";
import test from "node:test";
import { RenderHost } from "../../src/app/render-host.js";
import { NativeOfflineRenderBackend } from "../../src/audio/render-backend.js";
import type { RenderExportManifest } from "../../src/audio/render-types.js";
import type { RenderResult } from "../../src/audio/render-contract.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}
function downloadHost() {
  const file = deferred<Blob | null>();
  const host = new RenderHost({ getRecording: () => null, getAssetBank: () => [] });
  const access = host as unknown as {
    published: { backend: NativeOfflineRenderBackend; jobId: string };
    archiveStore: { readManifest(jobId: string): Promise<string | null> };
    downloadSerial: number;
    publish(value: { error: string | null }): void;
  };
  const manifest = { files: [{ id: "mix", filename: "old.wav" }] } as RenderExportManifest;
  access.published = {
    jobId: "old",
    backend: {
      getManifest: () => manifest,
      getFileBlob: () => file.promise,
    } as unknown as NativeOfflineRenderBackend,
  };
  return { host, access, file };
}

test("an archived manifest superseding a pending WAV always clears the download busy state", async () => {
  const { host, access, file } = downloadHost();
  const manifest = deferred<string | null>();
  access.archiveStore = { readManifest: () => manifest.promise };
  host.download("mix");
  const run = host.downloadArchivedManifest("archive");
  manifest.resolve(null);
  await assert.rejects(run, /unavailable/);
  file.resolve(null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(host.getSnapshot().downloadingOutputId, null);
});

test("a stale download rejection cannot overwrite the current job error state", async () => {
  const { host, access, file } = downloadHost();
  host.download("mix");
  access.downloadSerial++;
  access.published = { ...access.published, jobId: "new" };
  access.publish({ error: null });
  file.reject(new Error("old storage failure"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(host.getSnapshot().error, null);
});

test("host cancellation after backend commit rolls back only its newly completed candidate", async (t) => {
  const recording = await createRenderRecordingFixture();
  const originalRender = NativeOfflineRenderBackend.prototype.render;
  const originalRollback = Object.getOwnPropertyDescriptor(
    NativeOfflineRenderBackend.prototype,
    "discardOwnedJob",
  );
  let discarded = 0;
  const host = new RenderHost({ getRecording: () => recording, getAssetBank: () => [] });
  Object.defineProperty(NativeOfflineRenderBackend.prototype, "discardOwnedJob", {
    configurable: true,
    value: async () => {
      discarded++;
    },
  });
  NativeOfflineRenderBackend.prototype.render = async (job): Promise<RenderResult> => {
    await host.cancel();
    return {
      status: "completed",
      jobId: job.jobId,
      jobSha256: "0".repeat(64),
      outputs: [],
      provenance: {
        backend: job.backend,
        capabilities: [],
        engine: { id: "unit-host-only", version: "1" },
        startedAtUtc: "2026-11-03T00:00:00Z",
        finishedAtUtc: "2026-11-03T00:00:00Z",
        limitations: [],
      },
    };
  };
  t.after(() => {
    NativeOfflineRenderBackend.prototype.render = originalRender;
    if (originalRollback)
      Object.defineProperty(
        NativeOfflineRenderBackend.prototype,
        "discardOwnedJob",
        originalRollback,
      );
    else Reflect.deleteProperty(NativeOfflineRenderBackend.prototype, "discardOwnedJob");
  });
  assert.equal((await host.renderPreset()).status, "cancelled");
  assert.equal(discarded, 1);
});
