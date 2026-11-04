import assert from "node:assert/strict";
import test from "node:test";
import { RenderHost } from "../../src/app/render-host.js";
import { createRenderPreset } from "../../src/audio/render-preset.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

test("cancel during deferred job preparation wins and never allocates a native context", async () => {
  const recording = await createRenderRecordingFixture();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let allocations = 0;
  const host = new RenderHost({
    getRecording: () => recording,
    getAssetBank: () => [],
    preparePreset: async (...args) => {
      await pending;
      return createRenderPreset(...args);
    },
    createContext: () => {
      allocations++;
      throw new Error("must not allocate");
    },
  });
  const result = host.renderPreset();
  assert.equal(host.getSnapshot().state, "rendering");
  await host.cancel();
  release();
  assert.equal((await result).status, "cancelled");
  assert.equal(host.getSnapshot().state, "cancelled");
  assert.equal(allocations, 0);
  assert.throws(() => host.download("mix"), /before downloading/);
});

test("host rejects overlapping preparation and refresh observes a newly completed take", async () => {
  let recording = null as Awaited<ReturnType<typeof createRenderRecordingFixture>> | null;
  const host = new RenderHost({ getRecording: () => recording, getAssetBank: () => [] });
  assert.equal(host.getSnapshot().recordingAvailable, false);
  recording = await createRenderRecordingFixture();
  host.refresh();
  assert.equal(host.getSnapshot().recordingAvailable, true);
  const run = host.renderPreset();
  await assert.rejects(() => host.renderPreset(), /already in progress/);
  await host.cancel();
  assert.equal((await run).status, "cancelled");
  host.dispose();
  await assert.rejects(() => host.renderPreset(), /disposed/);
});
