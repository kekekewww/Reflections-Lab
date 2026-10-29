import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";

function wave(bits: number, float: boolean, sampleRate = 48000, frames = 480): ArrayBuffer {
  const stride = bits / 8,
    bytes = new ArrayBuffer(44 + frames * stride + ((frames * stride) % 2)),
    v = new DataView(bytes);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) v.setUint8(offset + i, text.charCodeAt(i));
  };
  tag(0, "RIFF");
  v.setUint32(4, bytes.byteLength - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, float ? 3 : 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * stride, true);
  v.setUint16(32, stride, true);
  v.setUint16(34, bits, true);
  tag(36, "data");
  v.setUint32(40, frames * stride, true);
  if (bits === 8) new Uint8Array(bytes, 44, frames).fill(128);
  const p = 44 + Math.round(frames / 2) * stride;
  if (float) v.setFloat32(p, 1, true);
  else if (bits === 8) v.setUint8(p, 255);
  else if (bits === 16) v.setInt16(p, 32767, true);
  else if (bits === 24) {
    v.setUint8(p, 255);
    v.setUint8(p + 1, 255);
    v.setUint8(p + 2, 127);
  } else v.setInt32(p, 2147483647, true);
  return bytes;
}
function frame(): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "wav",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "literal-wav-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.025,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["Original WAV codec fixture, no room measurement"],
    paths: [
      {
        id: "direct",
        sourceId: "source",
        listenerId: "listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [0, 0, -1],
          [0, 0, 0],
        ],
        lengthM: 8.575,
        absoluteDelayS: 0.025,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: [1],
      },
    ],
  };
}
/** Actual browser decodes for every supported V1 encoding, plus rejected preflight without decoder work. */
export async function runAudioWaveBrowserValidation() {
  const checks: { id: string; pass: boolean; evidence: Record<string, unknown> }[] = [],
    rate = 48000,
    context = new OfflineAudioContext(2, rate, rate),
    engine = new AudioEngine({
      context,
      headroomGain: 1,
      monitorGain: 1,
      limiterEnabled: false,
      spatializationModel: "equalpower",
    });
  await engine.enable(0);
  engine.setMuted(false);
  let decodeCalls = 0;
  const decode = context.decodeAudioData.bind(context);
  context.decodeAudioData = (bytes: ArrayBuffer) => {
    decodeCalls++;
    return decode(bytes);
  };
  const formats: [[number, boolean], ...Array<[number, boolean]>] = [
    [8, false],
    [16, false],
    [24, false],
    [32, false],
    [32, true],
  ];
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < formats.length; i++) {
    const [bits, float] = formats[i]!,
      id = `wav-${float ? "float" : "pcm"}-${bits}`,
      asset = await engine.importAsset(id, wave(bits, float), {
        name: id,
        origin: "imported",
        license: "ORIGINAL_TEST_WAV",
      });
    const admission = engine.playVoice(
      {
        instanceId: id,
        sourceId: "source",
        generator: {
          kind: "sample",
          asset: { assetId: id, revision: asset.revision, sha256: asset.sha256! },
          loop: false,
          startOffsetSeconds: 0,
        },
        gainLinear: 1,
        pitchSemitones: 0,
        emissionTimeSeconds: 0.05 + i * 0.15,
        continuous: false,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
      },
      frame(),
    );
    results.push({ bits, float, asset, admission });
  }
  const output = await context.startRendering(),
    samples = output.getChannelData(0),
    peaks: number[] = [];
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]!) > 0.1) peaks.push(i);
  const expected = formats.map((_, i) => Math.round((0.08 + i * 0.15) * rate));
  checks.push({
    id: "native-supported-PCM8-16-24-32-and-normalized-float32-WAV-decode",
    pass:
      peaks.length === 5 &&
      peaks.every((p, i) => Math.abs(p - expected[i]!) <= 1) &&
      results.every((r) => (r.admission as { accepted: boolean }).accepted),
    evidence: { decodeCalls, results, peaks, expected },
  });
  engine.dispose();
  const c = new OfflineAudioContext(2, rate / 5, rate),
    e = new AudioEngine({
      context: c,
      budget: { maxDecodedBytes: 4096 },
      headroomGain: 1,
      monitorGain: 1,
      limiterEnabled: false,
      spatializationModel: "equalpower",
    });
  await e.enable(0);
  e.setMuted(false);
  let calls = 0;
  const native = c.decodeAudioData.bind(c);
  c.decodeAudioData = (bytes: ArrayBuffer) => {
    calls++;
    return native(bytes);
  };
  const resampled = await e.importAsset("resampled", wave(16, false, 8000, 80), {
    name: "Original8kWAV",
    origin: "imported",
    license: "ORIGINAL_TEST_WAV",
  });
  e.playVoice(
    {
      instanceId: "resample",
      sourceId: "source",
      generator: {
        kind: "sample",
        asset: {
          assetId: resampled.assetId,
          revision: resampled.revision,
          sha256: resampled.sha256!,
        },
        loop: false,
        startOffsetSeconds: 0,
      },
      gainLinear: 1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0.05,
      continuous: false,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    },
    frame(),
  );
  const before = calls;
  let memoryCode = "",
    compressedCode = "";
  try {
    await e.importAsset("oversized", wave(16, false, 8000, 800), {
      name: "oversized",
      origin: "imported",
      license: "ORIGINAL_TEST_WAV",
    });
  } catch (error) {
    memoryCode = (error as { code?: string }).code ?? "unknown";
  }
  const compressed = wave(16, false);
  new DataView(compressed).setUint16(20, 2, true);
  try {
    await e.importAsset("compressed", compressed, {
      name: "compressed",
      origin: "imported",
      license: "ORIGINAL_TEST_WAV",
    });
  } catch (error) {
    compressedCode = (error as { code?: string }).code ?? "unknown";
  }
  const rendered = await c.startRendering();
  checks.push({
    id: "native-WAV-resample-reservation-and-unsupported-format-preflight",
    pass:
      resampled.sampleRate === rate &&
      resampled.decodedBytes === 480 * 4 &&
      calls === before &&
      memoryCode === "DECODED_MEMORY_BUDGET" &&
      compressedCode === "WAV_CAPABILITY_UNSUPPORTED" &&
      rendered.getChannelData(0).some((x) => Math.abs(x) > 0.01),
    evidence: {
      resampled,
      decodeCallsBeforeRejects: before,
      decodeCallsAfterRejects: calls,
      memoryCode,
      compressedCode,
    },
  });
  e.dispose();
  return {
    status: checks.every((x) => x.pass) ? "PASS" : "FAIL",
    checks,
    userAgent: navigator.userAgent,
    limitations: [
      "V1onlyuncompressedRIFF/WAVEPCM8/16/24/32 andnormalizedfinitefloat32; compressed/extensible formats explicitlyunsupported",
      "Metadata/chunk/PCMreservationsboundacceptednativework; internalbrowserdecoderresidentpeaknotmeasured",
      "No bundled third-party codec, hearing or realtime capacity certification",
    ],
  };
}
