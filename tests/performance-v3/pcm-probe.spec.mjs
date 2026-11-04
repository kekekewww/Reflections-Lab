// Test-only PCM observer contract. No browser, product backend or hardware claims.
// The missing module is an assertion failure rather than an import exception.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const moduleUrl = new URL("../browser/performance-pcm-probe-v1.js", import.meta.url);
const moduleSource = await readFile(moduleUrl, "utf8").catch((error) => {
  if (error.code === "ENOENT") return null;
  throw error;
});
const PROCESSOR = "reflection-performance-pcm-probe-v1";
const MAX_CAPTURE_BYTES = 32 * 1024 * 1024;
const waveform = (frame, channel) => Math.fround(((frame + 1) * (channel % 2 ? -1 : 1)) / 512);
const pcmExpected = (startFrame, frameCount, channelCount) =>
  Array.from({ length: frameCount * channelCount }, (_, index) =>
    waveform(startFrame + Math.floor(index / channelCount), index % channelCount),
  );

function makeHarness(processorOptions, rate = 48000) {
  assert.equal(typeof moduleSource, "string", "bounded PCM observer implementation must exist");
  const registered = new Map();
  const messages = [];
  let typedArrayAllocations = 0;
  let allocatedBytes = 0;
  class CountedFloat32Array extends Float32Array {
    constructor(...args) {
      super(...args);
      typedArrayAllocations++;
      allocatedBytes += this.byteLength;
    }
  }
  class CountedUint32Array extends Uint32Array {
    constructor(...args) {
      super(...args);
      typedArrayAllocations++;
      allocatedBytes += this.byteLength;
    }
  }
  class FakeAudioWorkletProcessor {
    constructor() {
      this.port = {
        onmessage: null,
        postMessage(message, transfers = []) {
          // Preserve actual transfer semantics: a released pool must be detached.
          messages.push({
            message: structuredClone(message, { transfer: transfers }),
            transfers: transfers.length,
          });
        },
      };
    }
  }
  const context = vm.createContext({
    AudioWorkletProcessor: FakeAudioWorkletProcessor,
    registerProcessor(name, Processor) {
      assert.equal(registered.has(name), false, "processor registers exactly once");
      registered.set(name, Processor);
    },
    sampleRate: rate,
    currentFrame: 0,
    currentTime: 0,
    Float32Array: CountedFloat32Array,
    Uint32Array: CountedUint32Array,
    ArrayBuffer,
    DataView,
    fetch: undefined,
    console: undefined,
  });
  vm.runInContext(moduleSource, context, { filename: moduleUrl.pathname, timeout: 1000 });
  const Processor = registered.get(PROCESSOR);
  assert.equal(typeof Processor, "function", "registers the fixed test-only PCM processor name");
  assert.equal(registered.size, 1);
  const processor = new Processor({ processorOptions });
  const send = (data) => {
    assert.equal(typeof processor.port.onmessage, "function");
    processor.port.onmessage({ data });
  };
  const block = (
    frame,
    length,
    {
      inputChannels = processorOptions.channelCount,
      outputChannels = processorOptions.channelCount,
      outputLength = length,
      noInput = false,
      noOutput = false,
      mutateInput,
    } = {},
  ) => {
    context.currentFrame = frame;
    context.currentTime = frame / rate;
    const input = noInput
      ? []
      : Array.from({ length: inputChannels }, (_, channel) =>
          Float32Array.from({ length }, (_, index) => waveform(frame + index, channel)),
        );
    mutateInput?.(input);
    const output = noOutput
      ? []
      : Array.from({ length: outputChannels }, () => new Float32Array(outputLength));
    const running = processor.process([input], [output], {});
    return { input, output, running };
  };
  return {
    processor,
    messages,
    send,
    block,
    allocations: () => ({ typedArrayAllocations, allocatedBytes }),
    result() {
      assert.equal(messages.length, 1, "terminal capture is emitted exactly once");
      return messages[0].message;
    },
  };
}
function validResult(result, { startFrame, frameCount, channelCount, sampleRate = 48000 }) {
  assert.equal(result.kind, "capture");
  assert.equal(result.schemaVersion, "1.0.0");
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.sampleRate, sampleRate);
  assert.equal(result.startFrame, startFrame);
  assert.equal(result.frameCount, frameCount);
  assert.equal(result.channelCount, channelCount);
  assert.equal(result.capturedFrames, frameCount);
  assert.equal(result.reservedPcmBytes, frameCount * channelCount * 4);
  assert.equal(result.firstCapturedContextFrame, startFrame);
  assert.equal(result.lastCapturedContextFrameExclusive, startFrame + frameCount);
  assert.equal(result.nativeDspCpuMs, null);
  assert.equal(result.hardwareUnderrunEvents, null);
  assert.deepEqual(result.reasons, []);
  for (const key of [
    "blockLengthOverflowCount",
    "missingInputFrames",
    "channelMismatchFrames",
    "nonFiniteSamples",
    "renderFrameGapFrames",
    "overlapFrames",
    "overflowFrames",
  ])
    assert.equal(result[key], 0, `${key} is an observed zero`);
  assert.equal(result.pcm instanceof ArrayBuffer, true);
  assert.equal(result.pcm.byteLength, result.reservedPcmBytes);
  assert.deepEqual(
    Array.from(new Float32Array(result.pcm)),
    pcmExpected(startFrame, frameCount, channelCount),
  );
}
function invalidResult(result, counter) {
  assert.equal(result.status, "INVALID");
  assert.ok(result.reasons.length > 0);
  if (counter) assert.ok(result[counter] > 0, `${counter} records the observed failure`);
  assert.equal(result.nativeDspCpuMs, null);
  assert.equal(result.hardwareUnderrunEvents, null);
}
const whenImplemented = (run) => () => {
  if (moduleSource === null) return;
  return run();
};

test("bounded PCM capture module exists and registers its fixed diagnostic processor", () => {
  makeHarness({ startFrame: 0, frameCount: 8, channelCount: 2 });
});

test(
  "17-frame native block is copied exactly without assuming a 128-frame quantum",
  whenImplemented(() => {
    const config = { startFrame: 0, frameCount: 17, channelCount: 2 };
    const host = makeHarness(config);
    const block = host.block(0, 17);
    assert.equal(block.running, false);
    assert.deepEqual(Array.from(block.output[0]), Array.from(block.input[0]));
    assert.deepEqual(Array.from(block.output[1]), Array.from(block.input[1]));
    validResult(host.result(), config);
    assert.deepEqual(Array.from(host.result().actualBlockLengths), [17]);
    assert.equal(host.messages[0].transfers, 1);
  }),
);

test(
  "varying native block lengths remain contiguous and transparent",
  whenImplemented(() => {
    const config = { startFrame: 0, frameCount: 293, channelCount: 1 };
    const host = makeHarness(config);
    let frame = 0;
    for (const length of [64, 192, 37]) {
      const block = host.block(frame, length);
      assert.deepEqual(Array.from(block.output[0]), Array.from(block.input[0]));
      frame += length;
    }
    validResult(host.result(), config);
    assert.deepEqual(Array.from(host.result().actualBlockLengths), [64, 192, 37]);
  }),
);

test(
  "capture trims both window edges exactly while outside-window data is not overflow",
  whenImplemented(() => {
    const config = { startFrame: 17, frameCount: 200, channelCount: 2 };
    const host = makeHarness(config);
    assert.equal(host.block(0, 64).running, true);
    assert.equal(host.messages.length, 0);
    assert.equal(host.block(64, 192).running, false);
    validResult(host.result(), config);
    assert.deepEqual(Array.from(host.result().actualBlockLengths), [64, 192]);
  }),
);

test(
  "missing input during the capture window cannot be published as measured silence",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 16, channelCount: 2 });
    host.block(0, 16, { noInput: true });
    invalidResult(host.result(), "missingInputFrames");
  }),
);

test(
  "missing input wholly before the capture window does not corrupt later valid PCM",
  whenImplemented(() => {
    const config = { startFrame: 16, frameCount: 16, channelCount: 2 };
    const host = makeHarness(config);
    host.block(0, 16, { noInput: true });
    assert.equal(host.messages.length, 0);
    host.block(16, 16);
    validResult(host.result(), config);
  }),
);

for (const [label, dimensions] of [
  ["missing source channel", { inputChannels: 1 }],
  ["extra source channel", { inputChannels: 3 }],
  ["missing output channel", { outputChannels: 1 }],
]) {
  test(
    `${label} is explicit invalid capture rather than silently coerced channels`,
    whenImplemented(() => {
      const host = makeHarness({ startFrame: 0, frameCount: 16, channelCount: 2 });
      host.block(0, 16, dimensions);
      invalidResult(host.result(), "channelMismatchFrames");
    }),
  );
}

test(
  "NaN PCM is preserved as invalid evidence rather than normalized or hidden",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 16, channelCount: 2 });
    host.block(0, 16, {
      mutateInput: (input) => {
        input[0][3] = Number.NaN;
      },
    });
    const result = host.result();
    invalidResult(result, "nonFiniteSamples");
    assert.equal(result.nonFiniteSamples, 1);
    assert.equal(Number.isNaN(new Float32Array(result.pcm)[6]), true);
  }),
);

test(
  "a context-frame gap is measured independently from input silence and hardware underrun",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 16, channelCount: 2 });
    host.block(0, 4);
    host.block(8, 8);
    const result = host.result();
    invalidResult(result, "renderFrameGapFrames");
    assert.equal(result.renderFrameGapFrames, 4);
    assert.equal(result.missingInputFrames, 0);
    assert.equal(result.capturedFrames, 12);
  }),
);

test(
  "overlapping render frames are invalid and never inflate captured frame count",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 12, channelCount: 2 });
    host.block(0, 8);
    host.block(4, 8);
    const result = host.result();
    invalidResult(result, "overlapFrames");
    assert.equal(result.overlapFrames, 4);
    assert.ok(result.capturedFrames <= 12);
  }),
);

test(
  "no input or output length is explicit invalid evidence, never a synthetic 128-frame block",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 16, channelCount: 2 });
    const block = host.block(0, 0, { noInput: true, noOutput: true });
    assert.equal(block.running, false);
    const result = host.result();
    invalidResult(result);
    assert.equal(result.capturedFrames, 0);
    assert.deepEqual(Array.from(result.actualBlockLengths), []);
  }),
);

test(
  "inconsistent input/output block lengths fail without inventing a quantum",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 16, channelCount: 2 });
    const block = host.block(0, 16, { outputLength: 15 });
    assert.equal(block.running, false);
    invalidResult(host.result());
  }),
);

test(
  "unequal input channel lengths cannot be copied as complete stereo",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 16, channelCount: 2 });
    host.block(0, 16, {
      mutateInput: (input) => {
        input[1] = input[1].subarray(0, 15);
      },
    });
    invalidResult(host.result());
  }),
);

test(
  "block-length metadata stays bounded to 16 values and reports its own overflow",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 512, channelCount: 1 });
    let frame = 0;
    for (let length = 1; length <= 17; length++) {
      host.block(frame, length);
      frame += length;
    }
    if (host.messages.length === 0) host.block(frame, 512 - frame);
    const result = host.result();
    invalidResult(result, "blockLengthOverflowCount");
    assert.ok(result.actualBlockLengths.length <= 16);
  }),
);

test(
  "the PCM pool is preallocated and process creates no new typed-array storage",
  whenImplemented(() => {
    const config = { startFrame: 0, frameCount: 64, channelCount: 2 };
    const host = makeHarness(config);
    const allocated = host.allocations();
    assert.ok(allocated.allocatedBytes >= config.frameCount * config.channelCount * 4);
    assert.ok(allocated.allocatedBytes <= config.frameCount * config.channelCount * 4 + 4096);
    for (let frame = 0; frame < 64; frame += 8) host.block(frame, 8);
    assert.deepEqual(host.allocations(), allocated);
    validResult(host.result(), config);
    assert.equal(host.block(64, 8).running, false);
    assert.equal(host.messages.length, 1);
    assert.deepEqual(host.allocations(), allocated);
  }),
);

test(
  "cancel transfers no partial PCM and cannot publish completion later",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 64, channelCount: 2 });
    host.block(0, 8);
    host.send({ kind: "cancel" });
    const result = host.result();
    assert.equal(result.status, "CANCELLED");
    assert.equal(result.kind, "capture");
    assert.equal(result.pcm, null);
    assert.equal(host.messages[0].transfers, 0);
    assert.equal(result.capturedFrames, 8);
    assert.equal(host.block(8, 64).running, false);
    host.send({ kind: "cancel" });
    assert.equal(host.messages.length, 1);
  }),
);

test(
  "unknown control messages cannot rearm or enlarge the reserved PCM pool",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 64, channelCount: 2 });
    const allocated = host.allocations();
    host.send({ kind: "resize", frameCount: Number.MAX_SAFE_INTEGER });
    invalidResult(host.result());
    assert.deepEqual(host.allocations(), allocated);
    assert.equal(host.block(0, 64).running, false);
  }),
);

for (const [label, options, rate = 48000] of [
  ["negative start", { startFrame: -1, frameCount: 8, channelCount: 2 }],
  ["fractional start", { startFrame: 0.5, frameCount: 8, channelCount: 2 }],
  ["zero frames", { startFrame: 0, frameCount: 0, channelCount: 2 }],
  ["nonfinite frames", { startFrame: 0, frameCount: Infinity, channelCount: 2 }],
  ["duration cap plus one", { startFrame: 0, frameCount: 480001, channelCount: 2 }],
  ["unknown channels", { startFrame: 0, frameCount: 8, channelCount: 3 }],
  ["zero channels", { startFrame: 0, frameCount: 8, channelCount: 0 }],
  ["missing frame count", { startFrame: 0, channelCount: 2 }],
  ["unsafe ending frame", { startFrame: Number.MAX_SAFE_INTEGER, frameCount: 8, channelCount: 2 }],
  ["unknown configuration", { startFrame: 0, frameCount: 8, channelCount: 2, allowOverflow: true }],
  ["actual rate above cap", { startFrame: 0, frameCount: 8, channelCount: 2 }, 384001],
  ["actual rate below supported range", { startFrame: 0, frameCount: 8, channelCount: 2 }, 7999],
  ["nonfinite actual rate", { startFrame: 0, frameCount: 8, channelCount: 2 }, Number.NaN],
]) {
  test(
    `invalid PCM reservation rejects before capture: ${label}`,
    whenImplemented(() => {
      assert.throws(
        () => makeHarness(options, rate),
        /invalid|cap|range|bounds|schema|configuration/i,
      );
    }),
  );
}

test(
  "maximum actual rate and ten-second stereo reservation fit the explicit 32 MiB cap",
  whenImplemented(() => {
    const frameCount = 384000 * 10;
    const host = makeHarness({ startFrame: 0, frameCount, channelCount: 2 }, 384000);
    assert.ok(host.allocations().allocatedBytes >= frameCount * 2 * 4);
    assert.ok(host.allocations().allocatedBytes <= MAX_CAPTURE_BYTES);
    host.send({ kind: "cancel" });
    assert.equal(host.result().reservedPcmBytes, 30720000);
    assert.equal(host.result().status, "CANCELLED");
  }),
);

test(
  "inherited cancel kind is not a valid own-key control message",
  whenImplemented(() => {
    const host = makeHarness({ startFrame: 0, frameCount: 64, channelCount: 2 });
    const message = Object.create({ kind: "cancel" });
    message.unrelated = true;
    host.send(message);
    invalidResult(host.result());
    assert.equal(host.result().reasons.includes("UNKNOWN_CONTROL_MESSAGE"), true);
  }),
);

test("diagnostic WAV encoder is accepted by the frozen independent Stage12 float-WAV parser", async () => {
  const attributionSource = await readFile(
    new URL("../browser/performance-audio-attribution-v1.mjs", import.meta.url),
    "utf8",
  );
  const wavStart = attributionSource.indexOf("function wav(pcm, rate, channels, frames) {");
  const wavEnd = attributionSource.indexOf("\nasync function runCase(", wavStart);
  assert.ok(wavStart >= 0 && wavEnd > wavStart);
  const encode = new Function(attributionSource.slice(wavStart, wavEnd) + "; return wav;")();
  const referenceSource = await readFile(
    new URL("../browser/render/verify-downloaded-wav.mjs", import.meta.url),
    "utf8",
  );
  const parserStart = referenceSource.indexOf("function decodeWave(bytes, expected) {");
  const parserEnd = referenceSource.indexOf("\nfunction difference(a, b) {", parserStart);
  assert.ok(parserStart >= 0 && parserEnd > parserStart);
  const decode = new Function(
    "assert",
    referenceSource.slice(parserStart, parserEnd) + "; return decodeWave;",
  )(assert);
  const samples = Float32Array.from({ length: 34 }, (_, index) => Math.fround((index - 17) / 128));
  const bytes = Buffer.from(encode(samples.buffer, 48000, 2, 17));
  const decoded = decode(bytes, { channels: 2, sampleRateHz: 48000, frames: 17 });
  assert.equal(decoded.frames, 17);
  assert.deepEqual(Array.from(decoded.samples), Array.from(samples));
});

// Independent byte/artifact oracle contract. This writer and sample signal do not
// import the browser encoder, capture implementation, or production WAV decoder.
const artifactOracleUrl = new URL("../browser/performance-pcm-artifact-v1.mjs", import.meta.url);
const artifactOracleSource = await readFile(artifactOracleUrl, "utf8").catch((error) => {
  if (error.code === "ENOENT") return null;
  throw error;
});
const artifactOracle = artifactOracleSource === null ? null : await import(artifactOracleUrl.href);
const artifactDefinition =
  "all-channel exact-zero run >= shortest observed block; not proof of one aligned missing callback block/hardware/audibility";
const artifactFaultCounters = [
  "blockLengthOverflowCount",
  "missingInputFrames",
  "channelMismatchFrames",
  "nonFiniteSamples",
  "renderFrameGapFrames",
  "overlapFrames",
  "overflowFrames",
];
const artifactWhenImplemented = (run) => () => {
  if (artifactOracle === null) return;
  return run();
};
function artifactFixture({
  rate = 48000,
  frames = 1024,
  channels = 2,
  zeroRuns = [],
  zeroChannel = null,
} = {}) {
  const pcm = new Float32Array(frames * channels);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      pcm[frame * channels + channel] =
        channel === 0
          ? Math.fround(((frame % 29) + 1) / 64)
          : Math.fround(-((((frame + 11) % 31) + 1) / 128));
    }
  }
  for (const [first, endExclusive] of zeroRuns) {
    for (let frame = first; frame < endExclusive; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        if (zeroChannel === null || channel === zeroChannel) pcm[frame * channels + channel] = 0;
      }
    }
  }
  const bytes = Buffer.alloc(56 + pcm.length * 4);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8, "ascii");
  bytes.write("fmt ", 12, "ascii");
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(channels, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * channels * 4, 28);
  bytes.writeUInt16LE(channels * 4, 32);
  bytes.writeUInt16LE(32, 34);
  bytes.write("fact", 36, "ascii");
  bytes.writeUInt32LE(4, 40);
  bytes.writeUInt32LE(frames, 44);
  bytes.write("data", 48, "ascii");
  bytes.writeUInt32LE(pcm.length * 4, 52);
  for (let index = 0; index < pcm.length; index++) bytes.writeFloatLE(pcm[index], 56 + index * 4);
  const startFrame = rate * 2;
  const endFrame = startFrame + frames;
  const caseResult = {
    schemaVersion: "1.0.0",
    method: "controlled-native-audio-pcm-v1",
    caseId: "steady",
    probeMode: "on",
    status: "CAPTURED_DIGITAL_ONLY",
    timeline: {
      epochFrame: Math.round(rate * 1.4),
      epochSeconds: 1.4,
      schedulingLookaheadSeconds: 0.1,
      expectedPrimaryOnsetAudioSeconds: 1.5,
      startFrame,
      endFrame,
      frameCount: frames,
      sampleRate: rate,
      channelCount: channels,
    },
    capture: {
      kind: "capture",
      schemaVersion: "1.0.0",
      status: "COMPLETE",
      sampleRate: rate,
      startFrame,
      frameCount: frames,
      channelCount: channels,
      capturedFrames: frames,
      reservedPcmBytes: frames * channels * 4,
      firstCapturedContextFrame: startFrame,
      lastCapturedContextFrameExclusive: endFrame,
      processCalls: 100,
      actualBlockLengths: [17, 64, 192],
      ...Object.fromEntries(artifactFaultCounters.map((key) => [key, 0])),
      reasons: [],
      nativeDspCpuMs: null,
      hardwareUnderrunEvents: null,
    },
    wav: {
      bytes: bytes.length,
      frames,
      channels,
      sampleRate: rate,
      format: "IEEE_FLOAT32_LE",
      normalized: false,
    },
    primaryStartStillFutureAtReturn: true,
    actualContextTimeAtEndSeconds: endFrame / rate,
    contextClosed: true,
    cleanupErrors: [],
    nativeDspCpuMs: null,
  };
  return { bytes, caseResult };
}
function artifactAnalyze(fixture) {
  return artifactOracle.analyzeCapturedPcmWave(fixture.bytes, fixture.caseResult);
}
function artifactQualified(result) {
  assert.equal(result.schemaVersion, "1.0.0");
  assert.equal(result.status, "VERIFIED_DIGITAL_PCM", JSON.stringify(result.reasons));
  assert.equal(result.qualified, true, JSON.stringify(result.reasons));
  assert.deepEqual(result.reasons, []);
  assert.equal(result.definition, artifactDefinition);
  assert.equal(result.nativeDspCpuMs, null);
  assert.equal(result.hardwareUnderrunEvents, null);
}
function artifactUnavailable(result, expectedStatus = "INVALID") {
  assert.equal(result.status, expectedStatus);
  assert.equal(result.qualified, false);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
  for (const key of [
    "minimumDigitalGapFrames",
    "digitalGaps",
    "zeroRunCount",
    "longestAllChannelZeroRunFrames",
    "peakLinear",
    "rmsLinear",
  ])
    assert.equal(result[key], null, `${key} cannot become a measured zero on unavailable evidence`);
  assert.equal(result.nativeDspCpuMs, null);
  assert.equal(result.hardwareUnderrunEvents, null);
}
function artifactRejected(fixture) {
  let result;
  assert.doesNotThrow(() => {
    result = artifactAnalyze(fixture);
  });
  artifactUnavailable(result);
  return result;
}
function artifactExpectedGap(startFrame, first, endExclusive, rate) {
  return {
    relativeStartFrame: first,
    relativeEndFrameExclusive: endExclusive,
    startFrame: startFrame + first,
    endFrameExclusive: startFrame + endExclusive,
    frames: endExclusive - first,
    seconds: (endExclusive - first) / rate,
  };
}

test("PCM artifact module exposes a real byte-and-capture oracle rather than plan metadata", () => {
  assert.equal(typeof artifactOracle?.analyzeCapturedPcmWave, "function");
});

test(
  "independent phase-separated stereo bytes retain a true measured zero gap count",
  artifactWhenImplemented(() => {
    const fixture = artifactFixture();
    const result = artifactAnalyze(fixture);
    artifactQualified(result);
    assert.equal(result.sampleRate, 48000);
    assert.equal(result.channelCount, 2);
    assert.equal(result.frameCount, 1024);
    assert.equal(result.startFrame, 96000);
    assert.equal(result.endFrameExclusive, 97024);
    assert.deepEqual(result.actualBlockLengths, [17, 64, 192]);
    assert.equal(result.minimumDigitalGapFrames, 17);
    assert.deepEqual(result.digitalGaps, []);
    assert.equal(result.zeroRunCount, 0);
    assert.equal(result.longestAllChannelZeroRunFrames, 0);
    assert.equal(result.peakLinear, 29 / 64);
    assert.ok(result.rmsLinear > 0);
  }),
);

for (const rate of [44100, 48000]) {
  test(
    `500 manually inserted silent stereo frames preserve actual ${rate} Hz and global origin`,
    artifactWhenImplemented(() => {
      const fixture = artifactFixture({ rate, zeroRuns: [[200, 700]] });
      const result = artifactAnalyze(fixture);
      artifactQualified(result);
      assert.equal(result.zeroRunCount, 1);
      assert.equal(result.longestAllChannelZeroRunFrames, 500);
      assert.deepEqual(result.digitalGaps, [artifactExpectedGap(rate * 2, 200, 700, rate)]);
      assert.ok(result.peakLinear > 0 && result.rmsLinear > 0);
    }),
  );
}

test(
  "one silent channel is not an all-channel digital gap",
  artifactWhenImplemented(() => {
    const fixture = artifactFixture({ zeroRuns: [[200, 700]], zeroChannel: 0 });
    const result = artifactAnalyze(fixture);
    artifactQualified(result);
    assert.equal(result.zeroRunCount, 0);
    assert.equal(result.longestAllChannelZeroRunFrames, 0);
    assert.deepEqual(result.digitalGaps, []);
  }),
);

for (const [frames, expectedGaps] of [
  [16, 0],
  [17, 1],
]) {
  test(
    `gap threshold uses the actual 17-frame shortest block at ${frames} silent frames`,
    artifactWhenImplemented(() => {
      const fixture = artifactFixture({ zeroRuns: [[200, 200 + frames]] });
      const result = artifactAnalyze(fixture);
      artifactQualified(result);
      assert.equal(result.minimumDigitalGapFrames, 17);
      assert.equal(result.zeroRunCount, 1);
      assert.equal(result.longestAllChannelZeroRunFrames, frames);
      assert.equal(result.digitalGaps.length, expectedGaps);
      if (expectedGaps)
        assert.deepEqual(result.digitalGaps[0], artifactExpectedGap(96000, 200, 217, 48000));
    }),
  );
}

test(
  "first and last sample zero runs retain half-open active-window boundaries",
  artifactWhenImplemented(() => {
    const fixture = artifactFixture({
      zeroRuns: [
        [0, 17],
        [1007, 1024],
      ],
    });
    const result = artifactAnalyze(fixture);
    artifactQualified(result);
    assert.equal(result.zeroRunCount, 2);
    assert.deepEqual(result.digitalGaps, [
      artifactExpectedGap(96000, 0, 17, 48000),
      artifactExpectedGap(96000, 1007, 1024, 48000),
    ]);
  }),
);

test(
  "complete all-zero PCM remains measured silence rather than invalid or unavailable data",
  artifactWhenImplemented(() => {
    const fixture = artifactFixture({ zeroRuns: [[0, 1024]] });
    const result = artifactAnalyze(fixture);
    artifactQualified(result);
    assert.equal(result.peakLinear, 0);
    assert.equal(result.rmsLinear, 0);
    assert.equal(result.zeroRunCount, 1);
    assert.equal(result.longestAllChannelZeroRunFrames, 1024);
    assert.deepEqual(result.digitalGaps, [artifactExpectedGap(96000, 0, 1024, 48000)]);
  }),
);

test(
  "other native output observations cannot become PCM-probe hardware or DSP CPU measurements",
  artifactWhenImplemented(() => {
    const fixture = artifactFixture();
    fixture.caseResult.afterDiagnostics = {
      nativeOutput: {
        status: "AVAILABLE",
        deltaUnderrunEvents: 5,
        deltaUnderrunSeconds: 0.2,
      },
    };
    const result = artifactAnalyze(fixture);
    artifactQualified(result);
    assert.equal(result.hardwareUnderrunEvents, null);
    assert.equal(result.nativeDspCpuMs, null);
  }),
);

for (const rate of [22050, 96000, 384000]) {
  test(
    `valid ${rate} Hz capture is explicitly unsupported by the frozen 44.1/48 kHz byte reference`,
    artifactWhenImplemented(() => {
      const fixture = artifactFixture({ rate });
      const result = artifactAnalyze(fixture);
      artifactUnavailable(result, "UNSUPPORTED_SAMPLE_RATE");
    }),
  );
}

const artifactMetadataMutations = {
  "missing case result": (f) => {
    f.caseResult = null;
  },
  "missing capture metadata": (f) => {
    delete f.caseResult.capture;
  },
  "null capture metadata": (f) => {
    f.caseResult.capture = null;
  },
  "invalid capture status": (f) => {
    f.caseResult.capture.status = "INVALID";
  },
  "not observed probe off": (f) => {
    f.caseResult.capture.status = "NOT_OBSERVED_PROBE_OFF";
    f.caseResult.probeMode = "off";
  },
  "null capture status": (f) => {
    f.caseResult.capture.status = null;
  },
  "short captured packet": (f) => {
    f.caseResult.capture.capturedFrames--;
  },
  "null captured frame count": (f) => {
    f.caseResult.capture.capturedFrames = null;
  },
  "capture window shifted one frame": (f) => {
    f.caseResult.capture.startFrame++;
  },
  "last context frame not complete": (f) => {
    f.caseResult.capture.lastCapturedContextFrameExclusive--;
  },
  "null first context frame": (f) => {
    f.caseResult.capture.firstCapturedContextFrame = null;
  },
  "timeline duration and capture disagree": (f) => {
    f.caseResult.timeline.endFrame--;
  },
  "reserved bytes are not PCM ownership": (f) => {
    f.caseResult.capture.reservedPcmBytes--;
  },
  "declared WAV bytes differ from actual": (f) => {
    f.caseResult.wav.bytes--;
  },
  "declared WAV frame count differs": (f) => {
    f.caseResult.wav.frames--;
  },
  "declared WAV channel count differs": (f) => {
    f.caseResult.wav.channels = 1;
  },
  "declared WAV rate differs": (f) => {
    f.caseResult.wav.sampleRate = 44100;
  },
  "capture channel count differs": (f) => {
    f.caseResult.capture.channelCount = 1;
  },
  "capture rate differs": (f) => {
    f.caseResult.capture.sampleRate = 44100;
  },
  "metadata reasons claim an invalid capture": (f) => {
    f.caseResult.capture.reasons = ["MISSING_CAPTURE_INPUT"];
  },
  "null reasons are not a clean capture": (f) => {
    f.caseResult.capture.reasons = null;
  },
  "empty observed block list": (f) => {
    f.caseResult.capture.actualBlockLengths = [];
  },
  "null observed block list": (f) => {
    f.caseResult.capture.actualBlockLengths = null;
  },
  "zero observed block": (f) => {
    f.caseResult.capture.actualBlockLengths = [0, 64];
  },
  "fractional observed block": (f) => {
    f.caseResult.capture.actualBlockLengths = [17.5, 64];
  },
  "nonfinite observed block": (f) => {
    f.caseResult.capture.actualBlockLengths = [Number.NaN, 64];
  },
  "unbounded block history": (f) => {
    f.caseResult.capture.actualBlockLengths = Array.from({ length: 17 }, (_, i) => i + 1);
  },
};
for (const key of artifactFaultCounters) {
  artifactMetadataMutations[`missing ${key} is not an observed zero`] = (f) => {
    delete f.caseResult.capture[key];
  };
  artifactMetadataMutations[`null ${key} is not an observed zero`] = (f) => {
    f.caseResult.capture[key] = null;
  };
  artifactMetadataMutations[`positive ${key} disqualifies completeness`] = (f) => {
    f.caseResult.capture[key] = 1;
  };
}
for (const [label, mutate] of Object.entries(artifactMetadataMutations)) {
  test(
    `PCM artifact rejects ${label}`,
    artifactWhenImplemented(() => {
      const fixture = artifactFixture();
      mutate(fixture);
      artifactRejected(fixture);
    }),
  );
}

const artifactByteMutations = {
  "short RIFF packet": (f) => {
    f.bytes = f.bytes.subarray(0, 32);
  },
  "truncated data payload": (f) => {
    f.bytes = f.bytes.subarray(0, f.bytes.length - 4);
  },
  "wrong RIFF identity": (f) => {
    f.bytes.write("RIFX", 0, "ascii");
  },
  "wrong WAVE identity": (f) => {
    f.bytes.write("NOPE", 8, "ascii");
  },
  "forged RIFF byte size": (f) => {
    f.bytes.writeUInt32LE(f.bytes.length, 4);
  },
  "integer PCM masquerading as float": (f) => {
    f.bytes.writeUInt16LE(1, 20);
  },
  "header channel mismatch": (f) => {
    f.bytes.writeUInt16LE(1, 22);
  },
  "header rate mismatch": (f) => {
    f.bytes.writeUInt32LE(44100, 24);
  },
  "forged byte rate": (f) => {
    f.bytes.writeUInt32LE(1, 28);
  },
  "forged block alignment": (f) => {
    f.bytes.writeUInt16LE(4, 32);
  },
  "wrong float bit width": (f) => {
    f.bytes.writeUInt16LE(16, 34);
  },
  "wrong fact sample count": (f) => {
    f.bytes.writeUInt32LE(1023, 44);
  },
  "data size disagrees with exact frame count": (f) => {
    f.bytes.writeUInt32LE(f.bytes.readUInt32LE(52) - 8, 52);
  },
  "NaN sample cannot be hidden behind a zero nonfinite counter": (f) => {
    f.bytes.writeFloatLE(Number.NaN, 56 + 17 * 4);
  },
};
for (const [label, mutate] of Object.entries(artifactByteMutations)) {
  test(
    `PCM artifact rejects ${label}`,
    artifactWhenImplemented(() => {
      const fixture = artifactFixture();
      mutate(fixture);
      artifactRejected(fixture);
    }),
  );
}

for (const [label, byteValue] of [
  ["null", null],
  ["text", "not PCM"],
  ["empty", Buffer.alloc(0)],
]) {
  test(
    `PCM artifact rejects ${label} bytes without throwing or measured-zero summaries`,
    artifactWhenImplemented(() => {
      const fixture = artifactFixture();
      fixture.bytes = byteValue;
      artifactRejected(fixture);
    }),
  );
}

test(
  "PCM artifact rejects duration cap plus one even with self-consistent bytes and metadata",
  artifactWhenImplemented(() => {
    const fixture = artifactFixture({ frames: 480001 });
    const result = artifactRejected(fixture);
    assert.ok(result.reasons.some((reason) => /cap|capacity|bound|duration/i.test(reason)));
  }),
);

test(
  "PCM artifact bounds the byte input before accepting a giant or ambiguous RIFF packet",
  artifactWhenImplemented(() => {
    const fixture = artifactFixture();
    fixture.bytes = Buffer.alloc(32 * 1024 * 1024 + 57);
    const result = artifactRejected(fixture);
    assert.ok(result.reasons.some((reason) => /cap|capacity|bound|bytes/i.test(reason)));
  }),
);

async function artifactFrozenStage12Decoder() {
  const reference = await readFile(
    new URL("../browser/render/verify-downloaded-wav.mjs", import.meta.url),
    "utf8",
  );
  const begin = reference.indexOf("function decodeWave(bytes, expected) {");
  const end = reference.indexOf("\nfunction difference(a, b) {", begin);
  assert.ok(begin >= 0 && end > begin);
  return new Function("assert", reference.slice(begin, end) + "; return decodeWave;")(assert);
}
function artifactReferenceIdentity(result) {
  assert.equal(result.decoderPolicy, "capture-format-v1");
  assert.equal(
    result.stage12NonzeroReference.sourcePath,
    "tests/browser/render/verify-downloaded-wav.mjs",
  );
  assert.equal(
    result.stage12NonzeroReference.sourceSha256,
    "11da91f61c06b4d89fa2b917f99b4e78faeb4216c6a27459eae090325ad12536",
  );
}

test(
  "nonzero capture cross-checks the unchanged Stage12 byte reference on the same original bytes",
  artifactWhenImplemented(async () => {
    const fixture = artifactFixture({ zeroRuns: [[200, 700]] });
    const original = Buffer.from(fixture.bytes);
    const decode = await artifactFrozenStage12Decoder();
    const independentlyDecoded = decode(fixture.bytes, {
      channels: 2,
      sampleRateHz: 48000,
      frames: 1024,
    });
    assert.ok(independentlyDecoded.nonZeroSamples > 0);
    const result = artifactAnalyze(fixture);
    artifactQualified(result);
    artifactReferenceIdentity(result);
    assert.equal(result.stage12NonzeroReference.status, "PASS");
    assert.equal(result.stage12NonzeroReference.error, null);
    assert.equal(result.peakLinear, independentlyDecoded.peakLinear);
    assert.equal(result.rmsLinear, independentlyDecoded.rmsLinear);
    assert.equal(
      fixture.bytes.equals(original),
      true,
      "reference and raw reader cannot mutate captured bytes",
    );
  }),
);

test(
  "valid full silence preserves the frozen Stage12 nonzero rejection instead of repairing the reference input",
  artifactWhenImplemented(async () => {
    const fixture = artifactFixture({ zeroRuns: [[0, 1024]] });
    const original = Buffer.from(fixture.bytes);
    const decode = await artifactFrozenStage12Decoder();
    assert.throws(
      () => decode(fixture.bytes, { channels: 2, sampleRateHz: 48000, frames: 1024 }),
      /PCM data contains nonzero samples/,
    );
    const result = artifactAnalyze(fixture);
    artifactQualified(result);
    artifactReferenceIdentity(result);
    assert.equal(result.stage12NonzeroReference.status, "REJECTED");
    assert.match(result.stage12NonzeroReference.error, /PCM data contains nonzero samples/);
    assert.equal(result.peakLinear, 0);
    assert.equal(result.rmsLinear, 0);
    assert.deepEqual(result.digitalGaps, [artifactExpectedGap(96000, 0, 1024, 48000)]);
    assert.equal(
      fixture.bytes.equals(original),
      true,
      "all-zero PCM is never changed into an impulse to satisfy the older quality gate",
    );
  }),
);

async function capturedWaveEncoder() {
  const source = await readFile(
    new URL("../browser/performance-audio-attribution-v1.mjs", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function wav(pcm, rate, channels, frames) {");
  const end = source.indexOf("\nasync function runCase(", start);
  assert.ok(start >= 0 && end > start);
  return new Function(source.slice(start, end) + "; return wav;")();
}
for (const bytes of [128, 144])
  test(`WAV encapsulation rejects ${bytes}-byte PCM instead of padding or truncating a 136-byte capture`, async () => {
    const encode = await capturedWaveEncoder();
    assert.throws(() => encode(new ArrayBuffer(bytes), 48000, 2, 17), /PCM.*length|length.*PCM/i);
  });
test("WAV encapsulation retains original PCM bits including signed zero and NaN payload", async () => {
  const encode = await capturedWaveEncoder();
  const pcm = new ArrayBuffer(16),
    words = new Uint32Array(pcm);
  words.set([0x80000000, 0x7f812345, 0x3f000000, 0xbf000000]);
  const bytes = Buffer.from(encode(pcm, 48000, 2, 2));
  assert.deepEqual(bytes.subarray(56), Buffer.from(pcm));
});
