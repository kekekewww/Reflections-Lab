import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { verifyRecording } from "../../src/experiments/index.js";

async function step(app: LabRuntime) {
  app.advance(1 / 60);
  await app.flushRecordingEvaluation();
  await new Promise<void>((resolve) => setImmediate(resolve));
}
test("an immutable archived export is admitted while recording persistence owns the mutation transaction", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const originalSave = BlobStore.prototype.saveRecording;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalDocument = globalThis.document;
  let release: (() => void) | undefined;
  let stopping: Promise<void> | undefined;
  const downloads: { blob: Blob; filename: string }[] = [];
  const blobs = new Map<string, Blob>();
  try {
    await app.dispatch({ type: "recordToggle" });
    await step(app);
    await step(app);
    await app.dispatch({ type: "recordToggle" });
    const first = app.getRecordingArtifact()!;
    await verifyRecording(first);
    await app.dispatch({ type: "recordToggle" });
    await step(app);
    await step(app);
    await app.dispatch({ type: "pause" });
    let hold = true;
    BlobStore.prototype.saveRecording = function (artifact) {
      if (!hold) return originalSave.call(this, artifact);
      hold = false;
      return new Promise<void>((resolve) => {
        release = resolve;
      }).then(() => originalSave.call(this, artifact));
    };
    stopping = app.dispatch({ type: "recordToggle" });
    for (let i = 0; i < 200 && !release; i++) {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
    assert.ok(release, "the public persistence adapter must be held");
    app.advance(0.2); // Publish while the live world is paused; no physical tick advances.
    const archived = app.getRecordingArtifact()!;
    await verifyRecording(archived);
    assert.notEqual(archived.runId, first.runId);
    assert.equal(app.getSnapshot().recording.state, "finalized");
    assert.equal(app.getSnapshot().recording.hasArtifact, true);

    URL.createObjectURL = (blob) => {
      assert.ok(blob instanceof Blob);
      const url = "blob:recording-export-test-" + blobs.size;
      blobs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = () => {};
    globalThis.document = {
      createElement() {
        const anchor = {
          href: "",
          download: "",
          click() {
            downloads.push({ blob: blobs.get(anchor.href)!, filename: anchor.download });
          },
        };
        return anchor;
      },
    } as unknown as Document;
    await app.dispatch({ type: "exportRecording" });
    console.log(
      JSON.stringify({
        phase: "immutable artifact sealed, persistence deferred",
        uiState: app.getSnapshot().recording.state,
        uiHasArtifact: app.getSnapshot().recording.hasArtifact,
        downloadCount: downloads.length,
        error: app.getSnapshot().error,
        artifactSha256: archived.artifactSha256,
      }),
    );
    assert.equal(
      app.getSnapshot().error,
      "",
      "read-only download must not be rejected by an unrelated mutable transaction",
    );
    assert.equal(downloads.length, 1);
    const exported = JSON.parse(await downloads[0]!.blob.text());
    assert.equal(exported.runId, archived.runId);
    assert.equal(exported.artifactSha256, archived.artifactSha256);
    assert.match(downloads[0]!.filename, /\.recording\.json$/);
    await verifyRecording(exported);
    assert.equal(app.getRecordingArtifact()!.artifactSha256, archived.artifactSha256);
  } finally {
    release?.();
    await stopping;
    BlobStore.prototype.saveRecording = originalSave;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    if (originalDocument) globalThis.document = originalDocument;
    else Reflect.deleteProperty(globalThis, "document");
    app.dispose();
  }
});

function downloadCapture() {
  const previousDocument = globalThis.document;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  const downloads: { blob: Blob; filename: string }[] = [];
  const blobs = new Map<string, Blob>();
  URL.createObjectURL = (blob) => {
    assert.ok(blob instanceof Blob);
    const url = "blob:sealed-export-test-" + blobs.size;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => {};
  globalThis.document = {
    createElement() {
      const anchor = {
        href: "",
        download: "",
        click() {
          downloads.push({ blob: blobs.get(anchor.href)!, filename: anchor.download });
        },
      };
      return anchor;
    },
  } as unknown as Document;
  return {
    downloads,
    restore() {
      URL.createObjectURL = previousCreate;
      URL.revokeObjectURL = previousRevoke;
      if (previousDocument) globalThis.document = previousDocument;
      else Reflect.deleteProperty(globalThis, "document");
    },
  };
}
async function waitForRelease(check: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("public seal adapter was not entered");
}

test("export during a deferred new seal reads only the previous immutable archive and leaves the mutation gate closed", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const originalFinish = ExperimentRecorder.prototype.finish;
  let release: (() => void) | undefined;
  let stopping: Promise<void> | undefined;
  const capture = downloadCapture();
  try {
    await app.dispatch({ type: "recordToggle" });
    await step(app);
    await step(app);
    await app.dispatch({ type: "recordToggle" });
    const previous = app.getRecordingArtifact()!;
    await verifyRecording(previous);
    await app.dispatch({ type: "recordToggle" });
    await step(app);
    await step(app);
    await app.dispatch({ type: "pause" });
    let hold = true;
    ExperimentRecorder.prototype.finish = function () {
      const sealed = originalFinish.call(this);
      if (!hold) return sealed;
      hold = false;
      return new Promise<void>((resolve) => {
        release = resolve;
      }).then(() => sealed);
    };
    let settled = false;
    stopping = app.dispatch({ type: "recordToggle" }).then(() => {
      settled = true;
    });
    await waitForRelease(() => Boolean(release));
    app.advance(0.2);
    assert.equal(app.getSnapshot().recording.state, "recording");
    assert.equal(app.getSnapshot().recording.hasArtifact, true);
    const scene = app.getSceneDocument();
    await app.dispatch({ type: "exportRecording" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(capture.downloads.length, 1);
    const exported = JSON.parse(await capture.downloads[0]!.blob.text());
    assert.equal(exported.runId, previous.runId);
    assert.equal(exported.artifactSha256, previous.artifactSha256);
    await verifyRecording(exported);
    assert.equal(settled, false, "export cannot complete or replace a pending seal");
    await app.dispatch({ type: "patchObject", objectId: "ball", patch: { massKg: 2 } });
    assert.match(app.getSnapshot().error, /TRANSACTION_BUSY/);
    assert.deepEqual(app.getSceneDocument(), scene);
    await app.dispatch({ type: "clearError" });
    release!();
    await stopping;
    const next = app.getRecordingArtifact()!;
    assert.notEqual(next.runId, previous.runId);
    await app.dispatch({ type: "exportRecording" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(capture.downloads.length, 2);
    const newExport = JSON.parse(await capture.downloads[1]!.blob.text());
    assert.equal(newExport.runId, next.runId);
    assert.equal(newExport.artifactSha256, next.artifactSha256);
    await verifyRecording(previous);
    await verifyRecording(next);
  } finally {
    release?.();
    await stopping;
    ExperimentRecorder.prototype.finish = originalFinish;
    capture.restore();
    app.dispose();
  }
});

test("no previous archive is explicit NO_RECORDING even while the first seal is pending", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const originalFinish = ExperimentRecorder.prototype.finish;
  let release: (() => void) | undefined;
  let stopping: Promise<void> | undefined;
  const capture = downloadCapture();
  try {
    await app.dispatch({ type: "exportRecording" });
    assert.match(app.getSnapshot().error, /NO_RECORDING/);
    assert.equal(capture.downloads.length, 0);
    await app.dispatch({ type: "recordToggle" });
    await step(app);
    await step(app);
    await app.dispatch({ type: "pause" });
    let hold = true;
    ExperimentRecorder.prototype.finish = function () {
      const sealed = originalFinish.call(this);
      if (!hold) return sealed;
      hold = false;
      return new Promise<void>((resolve) => {
        release = resolve;
      }).then(() => sealed);
    };
    stopping = app.dispatch({ type: "recordToggle" });
    await waitForRelease(() => Boolean(release));
    app.advance(0.2);
    assert.equal(app.getRecordingArtifact(), null);
    assert.equal(app.getSnapshot().recording.hasArtifact, false);
    await app.dispatch({ type: "exportRecording" });
    assert.match(app.getSnapshot().error, /NO_RECORDING/);
    assert.doesNotMatch(app.getSnapshot().error, /TRANSACTION_BUSY/);
    assert.equal(capture.downloads.length, 0);
    release!();
    await stopping;
    await app.dispatch({ type: "clearError" });
    await app.dispatch({ type: "exportRecording" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(capture.downloads.length, 1);
    const exported = JSON.parse(await capture.downloads[0]!.blob.text());
    await verifyRecording(exported);
    assert.equal(exported.artifactSha256, app.getRecordingArtifact()!.artifactSha256);
  } finally {
    release?.();
    await stopping;
    ExperimentRecorder.prototype.finish = originalFinish;
    capture.restore();
    app.dispose();
  }
});

test("a sealed interrupted prefix remains exportable with its original status and hash", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const capture = downloadCapture();
  try {
    await app.dispatch({ type: "recordToggle" });
    await step(app);
    await step(app);
    await app.dispatch({ type: "reset" });
    const artifact = app.getRecordingArtifact()!;
    assert.equal(artifact.status, "interrupted");
    assert.ok(artifact.frameCount > 0);
    await verifyRecording(artifact);
    await app.dispatch({ type: "exportRecording" });
    assert.equal(app.getSnapshot().error, "");
    assert.equal(capture.downloads.length, 1);
    const exported = JSON.parse(await capture.downloads[0]!.blob.text());
    assert.equal(exported.status, "interrupted");
    assert.equal(exported.artifactSha256, artifact.artifactSha256);
    assert.equal(exported.runId, artifact.runId);
    await verifyRecording(exported);
  } finally {
    capture.restore();
    app.dispose();
  }
});
