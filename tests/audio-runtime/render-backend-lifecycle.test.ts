import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { NativeOfflineRenderBackend } from "../../src/audio/render-backend.js";
import { createRenderPreset } from "../../src/audio/render-preset.js";
import { MemoryRenderOutputStore } from "../../src/audio/render-output-store.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

test("a globally existing published job is never deleted when a new backend fails to claim its ID", async () => {
  const store = new MemoryRenderOutputStore();
  const { job, input } = await createRenderPreset(
    await createRenderRecordingFixture(),
    [],
    {},
    undefined,
    "render.reused-archive",
  );
  const bytes = new Uint8Array([10, 20, 30]);
  await store.begin(job.jobId, 3, ["previous"]);
  await store.append(job.jobId, "previous", 0, bytes);
  await store.sealOutput(
    job.jobId,
    "previous",
    3,
    createHash("sha256").update(bytes).digest("hex"),
  );
  await store.publish(job.jobId);
  let allocations = 0;
  const backend = new NativeOfflineRenderBackend({
    input,
    outputStore: store,
    createContext() {
      allocations++;
      throw new Error("must not allocate");
    },
  });
  const result = await backend.render(job);
  assert.equal(result.status, "failed");
  assert.equal(allocations, 0);
  assert.deepEqual(
    new Uint8Array(await (await store.readBlob(job.jobId, "previous"))!.arrayBuffer()),
    bytes,
  );
  assert.equal((await store.getSnapshot(job.jobId))?.status, "published");
});

test("cancel during the initial job hash prevents storage/native admission and publication", async () => {
  const { job, input } = await createRenderPreset(await createRenderRecordingFixture(), []);
  const store = new MemoryRenderOutputStore();
  let allocations = 0;
  const backend = new NativeOfflineRenderBackend({
    input,
    outputStore: store,
    createContext() {
      allocations++;
      throw new Error("must not allocate");
    },
  });
  const run = backend.render(job);
  await backend.cancel(job.jobId);
  const result = await run;
  assert.equal(result.status, "cancelled");
  assert.equal(allocations, 0);
  assert.equal(backend.getManifest(job.jobId), null);
  assert.equal(await store.getSnapshot(job.jobId), null);
});
