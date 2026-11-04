import assert from "node:assert/strict";
import test from "node:test";
import { RenderHost } from "../../src/app/render-host.js";
import { createRenderPreset } from "../../src/audio/render-preset.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

test("render host borrows its asset bank through preparation and releases exactly once after cancellation", async () => {
  const recording = await createRenderRecordingFixture();
  let releasePreparation!: () => void;
  const pending = new Promise<void>((resolve) => {
    releasePreparation = resolve;
  });
  let borrowed = 0,
    released = 0,
    prepared = 0;
  const host = new RenderHost({
    getRecording: () => recording,
    getAssetBank: () => {
      throw new Error("unleased bank must not be read");
    },
    acquireAssetBank: async () => {
      borrowed++;
      return {
        entries: [],
        released: false,
        release: () => {
          released++;
        },
      };
    },
    preparePreset: async (...args) => {
      prepared++;
      await pending;
      return createRenderPreset(...args);
    },
  });
  const result = host.renderPreset();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(borrowed, 1);
  assert.equal(prepared, 1);
  assert.equal(released, 0);
  await host.cancel();
  releasePreparation();
  assert.equal((await result).status, "cancelled");
  assert.equal(released, 1);
  host.dispose();
  assert.equal(released, 1);
});

test("disposing during the async asset borrow releases its late lease and never prepares a graph", async () => {
  const recording = await createRenderRecordingFixture();
  let accept!: (lease: { entries: []; released: boolean; release(): void }) => void;
  const pending = new Promise<{ entries: []; released: boolean; release(): void }>((resolve) => {
    accept = resolve;
  });
  let released = 0,
    prepared = 0;
  const host = new RenderHost({
    getRecording: () => recording,
    getAssetBank: () => [],
    acquireAssetBank: () => pending,
    preparePreset: async (...args) => {
      prepared++;
      return createRenderPreset(...args);
    },
  });
  const run = host.renderPreset();
  host.dispose();
  accept({
    entries: [],
    released: false,
    release: () => {
      released++;
    },
  });
  await assert.rejects(run, /disposed/);
  assert.equal(prepared, 0);
  assert.equal(released, 1);
  assert.equal(host.getSnapshot().outputs.length, 0);
});

test("archive recovery and render admission exclude one another for their whole async operation", async () => {
  const recording = await createRenderRecordingFixture();
  let finishRecovery!: (value: { jobId: string; status: "interrupted" | "published" }[]) => void;
  const pending = new Promise<{ jobId: string; status: "interrupted" | "published" }[]>(
    (resolve) => {
      finishRecovery = resolve;
    },
  );
  let borrowed = 0;
  const host = new RenderHost({
    getRecording: () => recording,
    acquireAssetBank: async () => {
      borrowed++;
      return { entries: [], release() {} };
    },
  });
  const access = host as unknown as {
    archiveStore: { recover(): typeof pending; dispose(): void };
  };
  access.archiveStore = { recover: () => pending, dispose() {} };
  const recovery = host.recoverArchive();
  try {
    await assert.rejects(() => host.renderPreset(), /recovery|busy/i);
    assert.equal(borrowed, 0, "recovery owns admission before any asset borrowing");
  } finally {
    finishRecovery([]);
    await recovery;
    await host.cancel();
    host.dispose();
  }
});

test("host refuses to discard an interrupted archive while another writer lease is active", async () => {
  const host = new RenderHost({ getRecording: () => null });
  let discarded = 0;
  const access = host as unknown as {
    archiveStore: {
      getSnapshot(jobId: string): Promise<{ status: string }>;
      listJobs(): Promise<
        { jobId: string; status: string; activeWriter: boolean; canDiscard: boolean }[]
      >;
      discard(jobId: string): Promise<void>;
    };
  };
  access.archiveStore = {
    getSnapshot: async () => ({ status: "interrupted" }),
    listJobs: async () => [
      { jobId: "job.busy", status: "interrupted", activeWriter: true, canDiscard: false },
    ],
    discard: async () => {
      discarded++;
    },
  };
  await assert.rejects(() => host.discardInterruptedJob("job.busy"), /active|busy|writer/i);
  assert.equal(discarded, 0);
});
