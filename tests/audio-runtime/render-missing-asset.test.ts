import assert from "node:assert/strict";
import test from "node:test";
import { NativeOfflineRenderBackend } from "../../src/audio/render-backend.js";
import { createRenderPreset } from "../../src/audio/render-preset.js";
import { encodeFloatWave, hashRenderBytes } from "../../src/audio/render-pcm.js";
import { verifyRenderInput } from "../../src/audio/render-validation.js";
import { sha256Canonical } from "../../src/experiments/hash.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import type { AudioAssetBankEntry } from "../../src/audio/types.js";
import { FakeAudioBuffer } from "./fake-context.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

test("a captured sample with unavailable pinned PCM fails atomically before native allocation", async (t) => {
  // Original impulse data and its actual WAVE hash; the fake buffer supplies data
  // ownership only. This is a preflight/publication unit test, not native DSP proof.
  const sampleRate = 48000 as const;
  const sample = new FakeAudioBuffer(1, 12000, sampleRate);
  sample.getChannelData(0)[480] = 0.5;
  const wave = encodeFloatWave([sample.getChannelData(0)], sampleRate);
  const pin = {
    assetId: "asset.render-missing-original-impulse",
    revision: 1,
    sha256: await hashRenderBytes(wave.bytes),
  };
  const recording = await createRenderRecordingFixture({
    grabTick: null,
    assets: [
      {
        ...pin,
        availability: "READY",
        rightsStatus: "APPROVED",
        durationSeconds: sample.duration,
      },
    ],
    editDocument(document) {
      document.assets = [pin];
      document.profiles[0]!.rules[0]!.generator = {
        kind: "sample",
        asset: pin,
        loop: true,
        startOffsetSeconds: 0,
      };
    },
  });
  const first = recording.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.ok(
    first.voiceIntents.some(
      (intent) => intent.action === "start" && intent.generator.kind === "sample",
    ),
    "the recording actually requires the pinned sample, rather than merely listing an unused asset",
  );
  const entry: AudioAssetBankEntry = {
    assetId: pin.assetId,
    buffer: sample as unknown as AudioBuffer,
    metadata: {
      revision: pin.revision,
      sha256: pin.sha256,
      name: "Original missing-asset guard impulse",
      origin: "generated",
      license: "ORIGINAL_TEST_FIXTURE",
    },
  };
  const { job, input } = await createRenderPreset(
    recording,
    [entry],
    { tailSeconds: 0.1 },
    undefined,
    "render.missing-pinned-asset",
  );
  assert.deepEqual(input.configuration.assets, [pin]);
  assert.ok((await verifyRenderInput(job, input)).outputFrames > 0, "valid control input");
  const originalJob = await sha256Canonical(job);
  const originalRecording = await sha256Canonical(recording);

  let nativeBufferAllocations = 0;
  const originalBuffer = Object.getOwnPropertyDescriptor(globalThis, "AudioBuffer");
  Object.defineProperty(globalThis, "AudioBuffer", {
    configurable: true,
    value: class {
      constructor() {
        nativeBufferAllocations++;
        throw new Error("Asset preflight must finish before native buffer allocation");
      }
    },
  });
  t.after(() => {
    if (originalBuffer) Object.defineProperty(globalThis, "AudioBuffer", originalBuffer);
    else Reflect.deleteProperty(globalThis, "AudioBuffer");
  });

  for (const [reason, assetBank] of [
    ["missing PCM entry", []],
    ["different revision", [{ ...entry, metadata: { ...entry.metadata, revision: 2 } }]],
    ["different hash", [{ ...entry, metadata: { ...entry.metadata, sha256: "0".repeat(64) } }]],
  ] as const) {
    let contextAllocations = 0;
    let progressPublications = 0;
    const backend = new NativeOfflineRenderBackend({
      input: { ...input, assetBank },
      createContext() {
        contextAllocations++;
        throw new Error("Asset preflight must finish before native context allocation");
      },
      onProgress() {
        progressPublications++;
      },
    });
    const result = await backend.render(job);
    assert.equal(result.status, "failed", reason);
    assert.equal(result.jobId, job.jobId, reason);
    assert.equal(result.jobSha256, originalJob, "failure does not relabel the requested job");
    assert.equal(result.code, "RENDER_ASSET_PIN", reason);
    assert.match(result.reason ?? "", /Pinned asset .* is absent or has changed/, reason);
    assert.equal(contextAllocations, 0, reason);
    assert.equal(nativeBufferAllocations, 0, reason);
    assert.equal(progressPublications, 0, reason);
    assert.equal(backend.getManifest(job.jobId), null, reason);
    for (const output of job.outputs)
      assert.equal(backend.getFile(job.jobId, output.id), null, reason);
  }
  assert.equal(await sha256Canonical(job), originalJob);
  assert.equal(await sha256Canonical(recording), originalRecording);
});
