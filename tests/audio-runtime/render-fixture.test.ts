import test from "node:test";
import assert from "node:assert/strict";
import { verifyRecording } from "../../src/experiments/index.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

test("render fixture seals complete logical sine and one-shot histories with real solver paths", async () => {
  const recording = await createRenderRecordingFixture();
  await verifyRecording(recording);
  assert.equal(recording.status, "captured");
  assert.equal(recording.sourcePhaseEvidence?.evidenceClass, "logicalIntent");
  const starts = recording.frames.flatMap((frame) => {
    const captured = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
    assert.ok(captured.preStepSnapshot!.state.tick < frame.tick);
    assert.equal(captured.runtimeSnapshot.state.tick, frame.tick);
    assert.deepEqual(
      captured.voiceIntents.map((intent) => intent.event),
      frame.audioEvents,
    );
    assert.equal(
      captured.cursorModel,
      undefined,
      "logical age is never promoted to a native cursor",
    );
    return captured.voiceIntents.filter((intent) => intent.action === "start");
  });
  assert.deepEqual(
    new Set(starts.map((intent) => intent.event.objectId)),
    new Set(["speaker", "ball"]),
  );
  assert.ok(recording.frames.some((frame) => frame.acousticFrames.length === 2));
  assert.ok(
    recording.frames.every((frame) =>
      frame.acousticFrames.every(
        (acoustic) =>
          acoustic.poseTick === frame.tick && acoustic.backendId === "custom-web-geometric",
      ),
    ),
  );
});

test("render fixture supports pinned sample rules without replacing their content or claiming native PCM", async () => {
  const asset = {
    assetId: "asset.render-original-impulse",
    revision: 1,
    sha256: "a".repeat(64),
    availability: "READY" as const,
    rightsStatus: "APPROVED" as const,
    durationSeconds: 0.25,
  };
  const recording = await createRenderRecordingFixture({
    assets: [asset],
    editDocument(document) {
      const pin = { assetId: asset.assetId, revision: asset.revision, sha256: asset.sha256 };
      document.assets = [pin];
      document.profiles[0]!.rules[0]!.generator = {
        kind: "sample",
        asset: pin,
        loop: true,
        startOffsetSeconds: 0,
      };
    },
  });
  await verifyRecording(recording);
  assert.equal(recording.sourcePhaseEvidence?.evidenceClass, "logicalIntent");
  assert.deepEqual(recording.configuration.assetManifest, [asset]);
  const first = recording.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.equal(first.voiceIntents[0]!.generator.kind, "sample");
});

test("render fixture late windows retain the pre-existing source and their original tick clock", async () => {
  const recording = await createRenderRecordingFixture({ start: 4, end: 8 });
  await verifyRecording(recording);
  assert.equal(recording.startTick, 4);
  assert.equal(recording.endTick, 8);
  const captured = recording.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.equal(captured.preStepSnapshot!.state.tick, 3);
  assert.equal(captured.preStepSnapshot!.state.instances.length, 2);
  assert.equal(captured.voiceIntents.filter((intent) => intent.action === "start").length, 0);
});

test("render fixture rejects invalid or unbounded tick requests before evaluation", async () => {
  await assert.rejects(createRenderRecordingFixture({ start: 0 }), RangeError);
  await assert.rejects(createRenderRecordingFixture({ end: 601 }), RangeError);
  await assert.rejects(createRenderRecordingFixture({ start: 5, end: 4 }), RangeError);
});
