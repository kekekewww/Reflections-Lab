import assert from "node:assert/strict";
import { createHash } from "node:crypto";

/** Independent byte verifier: no product encoder, renderer, recorder or hash implementation imports. */
export const byteSha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown, label: string): Record<string, unknown> => {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label}: expected object`,
  );
  return value as Record<string, unknown>;
};
const integer = (value: unknown, label: string, minimum = 0): number => {
  assert.ok(Number.isSafeInteger(value) && Number(value) >= minimum, `${label}: invalid integer`);
  return Number(value);
};
const text = (value: unknown, label: string): string => {
  assert.ok(
    typeof value === "string" && value.length > 0 && value.length < 1024,
    `${label}: invalid identity`,
  );
  return value;
};
const array = (value: unknown, label: string): unknown[] => {
  assert.ok(Array.isArray(value), `${label}: expected array`);
  return value;
};
const decodeJson = (bytes: Uint8Array): unknown => {
  assert.ok(
    bytes.length > 0 && bytes.length <= 128 * 1024 * 1024,
    "JSON download length is not bounded",
  );
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
};

function canonical(value: unknown, ancestors = new Set<object>(), depth = 0): string {
  assert.ok(depth <= 48, "canonical JSON depth exceeded");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), "nonfinite canonical number");
    return JSON.stringify(value);
  }
  assert.ok(typeof value === "object" && !ancestors.has(value), "non-JSON or cyclic value");
  ancestors.add(value);
  let result: string;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++)
      assert.ok(Object.hasOwn(value, index), "sparse JSON array");
    result = `[${value.map((item) => canonical(item, ancestors, depth + 1)).join(",")}]`;
  } else {
    const record = object(value, "canonical value");
    const keys = Object.keys(record).sort();
    assert.ok(
      !keys.some((key) => ["__proto__", "constructor", "prototype"].includes(key)),
      "unsafe JSON key",
    );
    result = `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key], ancestors, depth + 1)}`).join(",")}}`;
  }
  ancestors.delete(value);
  return result;
}
const canonicalSha = (value: unknown) => byteSha256(canonical(value));

export interface WaveInspection {
  sha256: string;
  bytes: number;
  frames: number;
  channels: number;
  sampleRateHz: number;
  peakLinear: number;
  samplesOutsideUnitRange: number;
  nonzeroSamples: number;
  dataOffset: number;
  dataBytes: number;
}
export function inspectFloatWave(
  bytes: Uint8Array,
  expected: {
    frames: number;
    channels: number;
    sampleRateHz: number;
    sha256?: string;
  },
): WaveInspection {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.ok(buffer.length >= 44, "WAV header length");
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF", "RIFF signature");
  assert.equal(buffer.readUInt32LE(4), buffer.length - 8, "RIFF declared length");
  assert.equal(buffer.toString("ascii", 8, 12), "WAVE", "WAVE signature");
  let format: { channels: number; sampleRateHz: number } | null = null;
  let fact: number | null = null;
  let dataOffset = -1,
    dataBytes = -1;
  for (let offset = 12; offset < buffer.length; ) {
    assert.ok(offset + 8 <= buffer.length, "WAV chunk header bounds");
    const id = buffer.toString("ascii", offset, offset + 4),
      size = buffer.readUInt32LE(offset + 4),
      start = offset + 8;
    assert.ok(start + size <= buffer.length, "WAV chunk payload bounds");
    if (id === "fmt ") {
      assert.equal(format, null, "duplicate format chunk");
      assert.ok(size >= 16, "WAV format length");
      assert.equal(buffer.readUInt16LE(start), 3, "IEEE754 float format");
      const channels = buffer.readUInt16LE(start + 2),
        sampleRateHz = buffer.readUInt32LE(start + 4);
      assert.equal(buffer.readUInt16LE(start + 14), 32, "32-bit sample format");
      assert.equal(buffer.readUInt16LE(start + 12), channels * 4, "block alignment");
      assert.equal(buffer.readUInt32LE(start + 8), sampleRateHz * channels * 4, "byte rate");
      format = { channels, sampleRateHz };
    } else if (id === "fact") {
      assert.equal(fact, null, "duplicate fact chunk");
      assert.ok(size >= 4, "fact length");
      fact = buffer.readUInt32LE(start);
    } else if (id === "data") {
      assert.equal(dataOffset, -1, "duplicate data chunk");
      dataOffset = start;
      dataBytes = size;
    }
    offset = start + size + (size % 2);
    assert.ok(offset <= buffer.length, "WAV padding bounds");
  }
  assert.ok(format && dataOffset >= 0, "missing WAV format or data");
  assert.equal(format.channels, expected.channels, "WAV channel count");
  assert.equal(format.sampleRateHz, expected.sampleRateHz, "WAV sample rate");
  assert.ok([1, 2].includes(format.channels), "WAV channels must be 1 or 2");
  assert.equal(dataBytes % (format.channels * 4), 0, "PCM frame alignment");
  const frames = dataBytes / (format.channels * 4);
  assert.equal(frames, expected.frames, "WAV frame count");
  if (fact !== null) assert.equal(fact, frames, "fact frame count");
  let peakLinear = 0,
    samplesOutsideUnitRange = 0,
    nonzeroSamples = 0;
  for (let offset = dataOffset; offset < dataOffset + dataBytes; offset += 4) {
    const sample = buffer.readFloatLE(offset);
    assert.ok(Number.isFinite(sample), `nonfinite PCM sample at byte ${offset}`);
    peakLinear = Math.max(peakLinear, Math.abs(sample));
    if (Math.abs(sample) > 1) samplesOutsideUnitRange++;
    if (sample !== 0) nonzeroSamples++;
  }
  const sha256 = byteSha256(buffer);
  if (expected.sha256) assert.equal(sha256, expected.sha256.replace(/^sha256:/, ""), "WAV hash");
  return {
    sha256,
    bytes: bytes.length,
    frames,
    ...format,
    peakLinear,
    samplesOutsideUnitRange,
    nonzeroSamples,
    dataOffset,
    dataBytes,
  };
}

export interface RecordingInspection {
  rawSha256: string;
  canonicalSha256: string;
  artifactSha256: string;
  configurationSha256: string;
  runId: string;
  runEpoch: string;
  status: string;
  sceneRevision: number;
  frameCount: number;
  startTick: number;
  endTick: number;
  fixedDtS: number;
  sampleRateHz: number;
  recordedSourceIds: readonly string[];
}
export function inspectRecording(bytes: Uint8Array): RecordingInspection {
  const recording = object(decodeJson(bytes), "recording"),
    configuration = object(recording.configuration, "recording configuration");
  const { artifactSha256, ...body } = recording;
  assert.equal(canonicalSha(body), artifactSha256, "recording content hash");
  const frames = array(recording.frames, "recording frames");
  const frameCount = integer(recording.frameCount, "recording frame count", 1);
  assert.equal(frames.length, frameCount, "recording frame count");
  const startTick = integer(recording.startTick, "recording start tick"),
    endTick = integer(recording.endTick, "recording end tick");
  const runId = text(recording.runId, "recording run ID"),
    runEpoch = text(recording.runEpoch, "recording epoch");
  frames.forEach((frame, index) => {
    const value = object(frame, "recording frame");
    assert.equal(value.tick, startTick + index, "continuous recording tick");
    assert.equal(value.runEpoch, runEpoch, "recording frame epoch");
  });
  assert.equal(endTick, startTick + frameCount - 1, "recording end tick");
  assert.ok(
    recording.status === "captured" || recording.status === "interrupted",
    "recording completion state",
  );
  assert.ok(
    typeof configuration.fixedDtS === "number" &&
      Number.isFinite(configuration.fixedDtS) &&
      configuration.fixedDtS > 0,
    "recording fixedDt",
  );
  const sampleRateHz = integer(configuration.sampleRateHz, "recording sample rate", 1);
  return {
    rawSha256: byteSha256(bytes),
    canonicalSha256: canonicalSha(recording),
    artifactSha256: text(artifactSha256, "recording content SHA"),
    configurationSha256: canonicalSha(configuration),
    runId,
    runEpoch,
    status: recording.status,
    sceneRevision: integer(
      object(configuration.sceneSnapshot, "recorded scene").sceneRevision,
      "recorded scene revision",
    ),
    frameCount,
    startTick,
    endTick,
    fixedDtS: configuration.fixedDtS,
    sampleRateHz,
    recordedSourceIds: [
      ...new Set(
        frames.flatMap((frame) => {
          const value = object(frame, "recording frame");
          return value.acousticFrames === undefined
            ? []
            : array(value.acousticFrames, "recorded acoustic frames").map((acoustic) =>
                text(object(acoustic, "recorded acoustic frame").sourceId, "recorded source ID"),
              );
        }),
      ),
    ].sort(),
  };
}

export function verifyRenderBundle(
  manifestBytes: Uint8Array,
  recording: RecordingInspection,
  downloads: ReadonlyMap<string, Uint8Array>,
) {
  const manifest = object(decodeJson(manifestBytes), "render manifest");
  assert.equal(manifest.schemaVersion, "render-export-manifest-v1", "portable manifest version");
  const job = object(manifest.job, "render job"),
    configuration = object(manifest.configuration, "render configuration"),
    result = object(manifest.result, "render result");
  const recordingRef = object(job.recording, "render recording reference");
  assert.equal(
    recording.status,
    "captured",
    "only a captured recording produces a complete render",
  );
  assert.equal(recordingRef.id, recording.runId, "render recording identity");
  assert.equal(
    recordingRef.sha256,
    recording.canonicalSha256,
    "render recording canonical bytes hash",
  );
  assert.equal(job.recordingContentSha256, recording.artifactSha256, "recorded content hash");
  assert.equal(job.sceneRevision, recording.sceneRevision, "recorded scene identity");
  assert.equal(
    configuration.recordingConfigurationSha256,
    recording.configurationSha256,
    "recording configuration hash",
  );
  assert.equal(
    object(job.renderConfiguration, "configuration reference").sha256,
    canonicalSha(configuration),
    "render configuration hash",
  );
  assert.equal(result.status, "completed", "render must be published completed");
  assert.equal(result.jobId, job.jobId, "render job identity");
  assert.equal(result.jobSha256, canonicalSha(job), "render job hash");
  const clock = object(job.clock, "render clock"),
    window = object(job.window, "render window");
  const rate = integer(clock.sampleRateHz, "render rate", 1),
    numerator = integer(clock.fixedDtNumerator, "clock numerator", 1),
    denominator = integer(clock.fixedDtDenominator, "clock denominator", 1),
    origin = integer(clock.tickOrigin, "clock origin");
  assert.equal(rate, recording.sampleRateHz, "recorded/render sample rate");
  assert.ok(
    Math.abs(numerator / denominator - recording.fixedDtS) < 1e-12,
    "recording fixed-step clock",
  );
  const start = integer(window.startTick, "window start"),
    end = integer(window.endTickExclusive, "window end", 1),
    tail = integer(window.tailFrames, "tail frames");
  assert.equal(start, recording.startTick, "recorded window start");
  assert.equal(end, recording.endTick + 1, "recorded window end");
  const sampleAt = (tick: number) => Math.round(((tick - origin) * numerator * rate) / denominator);
  const frames = sampleAt(end) - sampleAt(start) + tail;
  assert.ok(Number.isSafeInteger(frames) && frames > 0, "render frame count");
  const expectedFiles = array(manifest.files, "manifest files"),
    requests = array(job.outputs, "job outputs"),
    outputs = array(result.outputs, "result outputs");
  assert.equal(downloads.size, expectedFiles.length, "download file count");
  assert.equal(requests.length, expectedFiles.length, "job/manifest file count");
  assert.equal(outputs.length, expectedFiles.length, "result/manifest file count");
  const seen = new Set<string>();
  const files = expectedFiles.map((item) => {
    const file = object(item, "manifest file"),
      id = text(file.id, "file ID");
    assert.ok(!seen.has(id), "duplicate manifest file ID");
    seen.add(id);
    const bytes = downloads.get(id);
    assert.ok(bytes, `missing downloaded file ${id}`);
    const request = requests
        .map((item) => object(item, "output request"))
        .find((value) => value.id === id),
      output = outputs
        .map((item) => object(item, "rendered output"))
        .find((value) => value.requestId === id);
    assert.ok(request && output, `missing output identity ${id}`);
    assert.equal(bytes.length, file.bytes, "manifest file bytes");
    const inspection = inspectFloatWave(bytes, {
      frames,
      channels: integer(request.channels, "output channels", 1),
      sampleRateHz: rate,
      sha256: text(file.sha256, "file hash"),
    });
    assert.equal(
      object(output.artifact, "rendered artifact").sha256,
      inspection.sha256,
      "result WAV hash",
    );
    assert.equal(output.frames, inspection.frames, "result frame count");
    assert.equal(output.channels, inspection.channels, "result channel count");
    assert.equal(output.sampleRateHz, inspection.sampleRateHz, "result sample rate");
    assert.ok(
      typeof output.peakLinear === "number" &&
        Math.abs(output.peakLinear - inspection.peakLinear) <= 2e-6,
      "reported PCM peak",
    );
    assert.equal(
      output.samplesOutsideUnitRange,
      inspection.samplesOutsideUnitRange,
      "reported finite float range count",
    );
    if (
      request.tap === "master" &&
      object(configuration.master, "master settings").outputSafetyClip === true
    )
      assert.equal(inspection.samplesOutsideUnitRange, 0, "configured safety master range");
    assert.equal(typeof output.historyIncomplete, "boolean", "explicit history limit");
    assert.equal(typeof output.tailTruncated, "boolean", "explicit tail limit");
    return {
      id,
      ...inspection,
      historyIncomplete: output.historyIncomplete,
      tailTruncated: output.tailTruncated,
    };
  });
  const requestObjects = requests.map((item) => object(item, "output request"));
  const mixes = requestObjects.filter(
    (request) =>
      request.tap === "simulatedMix" &&
      object(request.sources, "mix source selection").kind === "allRecordedSources",
  );
  const stems = requestObjects.filter(
    (request) =>
      request.tap === "simulatedMix" &&
      object(request.sources, "stem source selection").kind === "includeRecordedSourceIds",
  );
  let stemSum: null | {
    status: string;
    tolerance: number;
    maximumAbsoluteError: number | null;
    comparedSamples: number;
    mixId: string | null;
    stemIds: string[];
    sourceIds: string[];
  } = null;
  if (stems.length) {
    const sourceIds = stems.flatMap((stem) =>
      array(object(stem.sources, "stem source selection").sourceIds, "stem source IDs").map(
        (value) => text(value, "stem source ID"),
      ),
    );
    assert.equal(
      new Set(sourceIds).size,
      sourceIds.length,
      "stem source selections must be disjoint",
    );
    const complete =
      JSON.stringify([...sourceIds].sort()) === JSON.stringify(recording.recordedSourceIds);
    stemSum = {
      status: "NOT_VERIFIED_INCOMPLETE_SOURCE_PARTITION",
      tolerance: 2e-6,
      maximumAbsoluteError: null,
      comparedSamples: 0,
      mixId: null,
      stemIds: stems.map((stem) => text(stem.id, "stem ID")),
      sourceIds: [...sourceIds].sort(),
    };
    if (complete && mixes.length === 1) {
      const mixId = text(mixes[0]!.id, "mix ID"),
        mix = files.find((file) => file.id === mixId)!;
      const selected = stems.map((stem) => files.find((file) => file.id === stem.id)!);
      assert.ok(
        selected.every((stem) => stem.channels === mix.channels && stem.frames === mix.frames),
        "stem sum channel/frame identity",
      );
      const bufferView = (value: Uint8Array) =>
        Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      const mixBuffer = bufferView(downloads.get(mixId)!),
        stemBuffers = selected.map((stem) => bufferView(downloads.get(stem.id)!));
      let maximumAbsoluteError = 0;
      const comparedSamples = mix.frames * mix.channels;
      for (let index = 0; index < comparedSamples; index++) {
        let sum = 0;
        for (let stem = 0; stem < selected.length; stem++)
          sum += stemBuffers[stem]!.readFloatLE(selected[stem]!.dataOffset + index * 4);
        maximumAbsoluteError = Math.max(
          maximumAbsoluteError,
          Math.abs(sum - mixBuffer.readFloatLE(mix.dataOffset + index * 4)),
        );
      }
      assert.ok(
        maximumAbsoluteError <= 2e-6,
        `pre-master stem sum maximum absolute error ${maximumAbsoluteError} exceeds original 2e-6 bound`,
      );
      stemSum = {
        status: "VERIFIED",
        tolerance: 2e-6,
        maximumAbsoluteError,
        comparedSamples,
        mixId,
        stemIds: selected.map((stem) => stem.id),
        sourceIds: [...sourceIds].sort(),
      };
    }
  }
  return {
    stemSum,
    manifestSha256: byteSha256(manifestBytes),
    jobId: text(job.jobId, "job ID"),
    recording,
    files,
    frameCountPerFile: frames,
    sampleRateHz: rate,
    scope:
      "Independent digital bytes/identity verification; not hardware hearing, SPL, formal performance, or full DSP reference equivalence.",
  };
}

/** Inspect captured clocks separately; this does not claim PCM propagation-delay equivalence. */
export function inspectSourceClockEvidence(bytes: Uint8Array) {
  const artifact = object(decodeJson(bytes), "recording"),
    frames = array(artifact.frames, "recording frames");
  let preStepFrames = 0,
    nativeCursorEntries = 0,
    modeledCursorEntries = 0;
  for (const value of frames) {
    const frame = object(value, "frame"),
      snapshot = object(frame.behaviorSnapshot, "captured behavior snapshot");
    const input = object(snapshot.inputFrame, "behavior input"),
      pre = object(object(snapshot.preStepSnapshot, "pre-step snapshot").state, "pre-step state"),
      post = object(
        object(snapshot.runtimeSnapshot, "post-step snapshot").state,
        "post-step state",
      );
    assert.equal(input.tick, frame.tick, "input tick belongs to captured frame");
    assert.equal(input.runEpoch, artifact.runEpoch, "input run epoch");
    assert.equal(post.tick, frame.tick, "post-step tick belongs to captured frame");
    assert.ok(
      Number(pre.tick) < Number(frame.tick),
      "pre-step snapshot must precede source-clock frame",
    );
    assert.equal(pre.experimentId, post.experimentId, "pre/post behavior experiment identity");
    preStepFrames++;
    for (const key of ["preStepVoiceCursors", "voiceCursors"])
      if (snapshot[key] && typeof snapshot[key] === "object")
        nativeCursorEntries += Object.keys(snapshot[key]).length;
    for (const key of ["preStepNonNativeVoiceCursors", "nonNativeVoiceCursors"])
      if (snapshot[key] && typeof snapshot[key] === "object")
        modeledCursorEntries += Object.keys(snapshot[key]).length;
  }
  return {
    preStepFrames,
    nativeCursorEntries,
    modeledCursorEntries,
    sourceRunId: artifact.runId,
    sourceRunEpoch: artifact.runEpoch,
    firstAcceptedTick: artifact.startTick,
    lastAcceptedTick: artifact.endTick,
    scope:
      "Pre/post/source-clock provenance only. Native PCM restoration, once-only propagation delay and full-span reference retain their independent audio/native gates.",
  };
}
