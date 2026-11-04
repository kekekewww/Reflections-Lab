import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  inspectFloatWave,
  inspectRecording,
  inspectSourceClockEvidence,
  verifyRenderBundle,
} from "./s4-evidence.js";

const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
function wave(samples: number[], rate = 48000, channels = 2) {
  const bytes = Buffer.alloc(56 + samples.length * 4);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * channels * 4, 28);
  bytes.writeUInt16LE(channels * 4, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("fact", 36);
  bytes.writeUInt32LE(4, 40);
  bytes.writeUInt32LE(samples.length / channels, 44);
  bytes.write("data", 48);
  bytes.writeUInt32LE(samples.length * 4, 52);
  samples.forEach((sample, index) => bytes.writeFloatLE(sample, 56 + index * 4));
  return bytes;
}
const stable = (value: unknown): string =>
  value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(stable).join(",")}]`
      : `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
          .join(",")}}`;
function recording() {
  const body = {
    schemaVersion: "1.0.0",
    runId: "run.s4",
    runEpoch: "epoch.s4",
    status: "captured",
    configuration: {
      fixedDtS: 1 / 48000,
      sampleRateHz: 48000,
      sceneSnapshot: { sceneRevision: 1 },
    },
    frames: [{ tick: 0, runEpoch: "epoch.s4" }],
    frameCount: 1,
    startTick: 0,
    endTick: 0,
  };
  return { ...body, artifactSha256: sha(stable(body)) };
}
function bundle() {
  const captured = recording();
  const bytes = wave([0.25, -0.25]);
  const configuration = {
    recordingConfigurationSha256: sha(stable(captured.configuration)),
    master: { outputSafetyClip: true },
  };
  const job = {
    schemaVersion: "render-job-plan-v1",
    jobId: "job.s4",
    recording: { id: captured.runId, sha256: sha(stable(captured)) },
    recordingContentSha256: captured.artifactSha256,
    sceneRevision: 1,
    renderConfiguration: { sha256: sha(stable(configuration)) },
    clock: { tickOrigin: 0, fixedDtNumerator: 1, fixedDtDenominator: 48000, sampleRateHz: 48000 },
    window: { startTick: 0, endTickExclusive: 1, tailFrames: 0 },
    outputs: [{ id: "master", tap: "master", channels: 2 }],
  };
  const manifest = {
    schemaVersion: "render-export-manifest-v1",
    job,
    configuration,
    result: {
      status: "completed",
      jobId: job.jobId,
      jobSha256: sha(stable(job)),
      outputs: [
        {
          requestId: "master",
          artifact: { sha256: sha(bytes) },
          frames: 1,
          channels: 2,
          sampleRateHz: 48000,
          peakLinear: 0.25,
          samplesOutsideUnitRange: 0,
          historyIncomplete: true,
          tailTruncated: true,
        },
      ],
    },
    files: [{ id: "master", filename: "master.wav", bytes: bytes.length, sha256: sha(bytes) }],
  };
  return { captured, bytes, manifest };
}

test("independent RIFF inspection accepts legal float levels and validates actual layout/clock", () => {
  const bytes = wave([1.5, -0.5, 0, 0.25]);
  const result = inspectFloatWave(bytes, {
    frames: 2,
    channels: 2,
    sampleRateHz: 48000,
    sha256: sha(bytes),
  });
  assert.equal(result.frames, 2);
  assert.equal(result.peakLinear, 1.5);
  assert.equal(result.samplesOutsideUnitRange, 1);
  assert.equal(result.nonzeroSamples, 3);
});

test("RIFF inspection refuses corrupt headers, wrong identity, clock, and nonfinite samples", () => {
  const expected = { frames: 1, channels: 2, sampleRateHz: 48000 };
  for (const bytes of [wave([NaN, 0]), wave([Infinity, 0]), wave([0, -Infinity])])
    assert.throws(() => inspectFloatWave(bytes, expected), /finite/);
  const short = wave([0, 0]);
  short.writeUInt32LE(9000, 52);
  assert.throws(() => inspectFloatWave(short, expected), /bounds|length|size/);
  const wrongRiff = wave([0, 0]);
  wrongRiff.writeUInt32LE(1, 4);
  assert.throws(() => inspectFloatWave(wrongRiff, expected), /RIFF/);
  assert.throws(() => inspectFloatWave(wave([0, 0]), { ...expected, frames: 2 }), /frame/);
  assert.throws(() => inspectFloatWave(wave([0, 0]), { ...expected, sampleRateHz: 44100 }), /rate/);
  assert.throws(
    () => inspectFloatWave(wave([0, 0]), { ...expected, sha256: "0".repeat(64) }),
    /hash/,
  );
});

test("recorded identity and every WAV are joined to the downloaded manifest without hiding boundary limits", () => {
  const { captured, bytes, manifest } = bundle();
  const inspected = inspectRecording(Buffer.from(JSON.stringify(captured)));
  assert.equal(inspected.runId, "run.s4");
  assert.equal(inspected.canonicalSha256, sha(stable(captured)));
  const result = verifyRenderBundle(
    Buffer.from(JSON.stringify(manifest)),
    inspected,
    new Map([["master", bytes]]),
  );
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0]!.historyIncomplete, true);
  assert.equal(result.recording.runEpoch, "epoch.s4");
  const altered = structuredClone(manifest);
  altered.job.recording.id = "run.other";
  assert.throws(
    () =>
      verifyRenderBundle(
        Buffer.from(JSON.stringify(altered)),
        inspected,
        new Map([["master", bytes]]),
      ),
    /recording|identity/,
  );
  assert.throws(
    () => verifyRenderBundle(Buffer.from(JSON.stringify(manifest)), inspected, new Map()),
    /file|count|missing/,
  );
  const badRecording = structuredClone(captured);
  badRecording.frames[0]!.tick = 3;
  assert.throws(() => inspectRecording(Buffer.from(JSON.stringify(badRecording))), /hash|tick/);
  assert.throws(() => inspectRecording(Buffer.from([0xff])), /UTF|encoded|decode/i);
});

test("captured pre-step provenance uses the earlier source clock and rejects mismatched epochs", () => {
  const captured = recording();
  const frame = {
    tick: 1,
    runEpoch: "epoch.s4",
    behaviorSnapshot: {
      inputFrame: { tick: 1, runEpoch: "epoch.s4" },
      preStepSnapshot: { state: { tick: 0, experimentId: "experiment.s4" } },
      runtimeSnapshot: { state: { tick: 1, experimentId: "experiment.s4" } },
      preStepVoiceCursors: {},
      voiceCursors: {},
      preStepNonNativeVoiceCursors: { source: { evidenceClass: "logicalIntent" } },
    },
  };
  const artifact = { ...captured, frames: [frame], startTick: 1, endTick: 1 };
  const result = inspectSourceClockEvidence(Buffer.from(JSON.stringify(artifact)));
  assert.equal(result.preStepFrames, 1);
  assert.equal(result.modeledCursorEntries, 1);
  frame.behaviorSnapshot.preStepSnapshot.state.tick = 1;
  assert.throws(
    () => inspectSourceClockEvidence(Buffer.from(JSON.stringify(artifact))),
    /pre-step/,
  );
  frame.behaviorSnapshot.preStepSnapshot.state.tick = 0;
  frame.behaviorSnapshot.inputFrame.runEpoch = "epoch.other";
  assert.throws(() => inspectSourceClockEvidence(Buffer.from(JSON.stringify(artifact))), /epoch/);
});

test("per-owner stems must sum to the full pre-master mix under the original 2e-6 bound", () => {
  const captured = recording();
  const body = {
    ...captured,
    frames: [
      {
        ...captured.frames[0],
        acousticFrames: [{ sourceId: "source.a" }, { sourceId: "source.b" }],
      },
    ],
  };
  const { artifactSha256: _old, ...withoutHash } = body;
  const source = { ...withoutHash, artifactSha256: sha(stable(withoutHash)) };
  const info = inspectRecording(Buffer.from(JSON.stringify(source)));
  const make = (mixValue: number) => {
    const configuration = {
      recordingConfigurationSha256: sha(stable(source.configuration)),
      master: { outputSafetyClip: true },
    };
    const requests = [
      { id: "mix", tap: "simulatedMix", channels: 2, sources: { kind: "allRecordedSources" } },
      {
        id: "stem-a",
        tap: "simulatedMix",
        channels: 2,
        sources: { kind: "includeRecordedSourceIds", sourceIds: ["source.a"] },
      },
      {
        id: "stem-b",
        tap: "simulatedMix",
        channels: 2,
        sources: { kind: "includeRecordedSourceIds", sourceIds: ["source.b"] },
      },
    ];
    const job = {
      schemaVersion: "render-job-plan-v1",
      jobId: "job.sum",
      recording: { id: source.runId, sha256: sha(stable(source)) },
      recordingContentSha256: source.artifactSha256,
      sceneRevision: 1,
      renderConfiguration: { sha256: sha(stable(configuration)) },
      clock: { tickOrigin: 0, fixedDtNumerator: 1, fixedDtDenominator: 48000, sampleRateHz: 48000 },
      window: { startTick: 0, endTickExclusive: 1, tailFrames: 0 },
      outputs: requests,
    };
    const downloads = new Map([
      ["mix", wave([mixValue, -0.75])],
      ["stem-a", wave([0.25, -0.25])],
      ["stem-b", wave([0.5, -0.5])],
    ]);
    const files = requests.map((request) => ({
      id: request.id,
      filename: request.id + ".wav",
      sha256: sha(downloads.get(request.id)!),
      bytes: downloads.get(request.id)!.length,
    }));
    const outputs = files.map((file) => ({
      requestId: file.id,
      artifact: { sha256: file.sha256 },
      frames: 1,
      channels: 2,
      sampleRateHz: 48000,
      peakLinear: file.id === "mix" ? Math.max(mixValue, 0.75) : file.id === "stem-a" ? 0.25 : 0.5,
      samplesOutsideUnitRange: 0,
      historyIncomplete: true,
      tailTruncated: false,
    }));
    return {
      bytes: Buffer.from(
        JSON.stringify({
          schemaVersion: "render-export-manifest-v1",
          job,
          configuration,
          result: { status: "completed", jobId: job.jobId, jobSha256: sha(stable(job)), outputs },
          files,
        }),
      ),
      downloads,
    };
  };
  const valid = make(0.75),
    result = verifyRenderBundle(valid.bytes, info, valid.downloads);
  assert.equal(result.stemSum?.maximumAbsoluteError, 0);
  assert.equal(result.stemSum?.tolerance, 2e-6);
  const incorrect = make(0.751);
  assert.throws(
    () => verifyRenderBundle(incorrect.bytes, info, incorrect.downloads),
    /stem.*sum|sum.*stem/i,
  );
});
