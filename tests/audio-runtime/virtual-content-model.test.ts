import assert from "node:assert/strict";
import test from "node:test";
import {
  readAudioContentModelPin,
  SEEKABLE_HARMONIC_CONTENT_MODEL,
} from "../../src/audio/content-model.js";

test("legacy generator configurations retain native waveform semantics", () => {
  for (const legacy of [undefined, null, [], [[{ kind: "oscillator" }]], {}, { profiles: [] }])
    assert.equal(readAudioContentModelPin(legacy), "nativeReference");
});

test("a recording explicitly pins the full seekable oscillator content model", () => {
  assert.equal(
    readAudioContentModelPin({
      audioContentModel: structuredClone(SEEKABLE_HARMONIC_CONTENT_MODEL),
      profiles: [],
    }),
    "seekableHarmonics",
  );
  assert.equal(SEEKABLE_HARMONIC_CONTENT_MODEL.modelClass, "perceptualApproximation");
  assert.equal(SEEKABLE_HARMONIC_CONTENT_MODEL.harmonicCap, 256);
  assert.ok(Object.isFrozen(SEEKABLE_HARMONIC_CONTENT_MODEL));
});

test("unknown versions, altered signal policies and partial pins fail explicitly", () => {
  for (const pin of [
    null,
    "seekableHarmonics",
    {},
    { ...SEEKABLE_HARMONIC_CONTENT_MODEL, version: 2 },
    { ...SEEKABLE_HARMONIC_CONTENT_MODEL, normalization: "normalized" },
    { ...SEEKABLE_HARMONIC_CONTENT_MODEL, harmonicCap: 128 },
    { ...SEEKABLE_HARMONIC_CONTENT_MODEL, extra: true },
  ])
    assert.throws(
      () => readAudioContentModelPin({ audioContentModel: pin, profiles: [] }),
      /AUDIO_CONTENT_MODEL_PIN/,
    );
});

test("native clock v2 is an explicit pin and does not rewrite the accepted v1 description", async () => {
  const models = await import("../../src/audio/content-model.js");
  const v2 = (models as unknown as { NATIVE_CLOCK_CONTENT_MODEL?: Record<string, unknown> })
    .NATIVE_CLOCK_CONTENT_MODEL;
  assert.ok(v2, "native clock candidate needs its own immutable content pin");
  assert.equal(
    readAudioContentModelPin({ audioContentModel: v2, profiles: [] }),
    "seekableNativeClock",
  );
  assert.equal(v2.version, 2);
  assert.equal(v2.sampleOriginPolicy, "nearestAssetFrameOnce;fractionalCursorPreserved");
  assert.equal(
    readAudioContentModelPin({ audioContentModel: SEEKABLE_HARMONIC_CONTENT_MODEL }),
    "seekableHarmonics",
  );
});

test("retained native carriers use a separate exact content pin and preserve legacy readers", async () => {
  const { NATIVE_CARRIER_CONTENT_MODEL } = await import("../../src/audio/content-model.js");
  assert.equal(
    readAudioContentModelPin({ audioContentModel: NATIVE_CARRIER_CONTENT_MODEL, profiles: [] }),
    "nativeCarrierRoutes",
  );
  assert.equal(NATIVE_CARRIER_CONTENT_MODEL.sourceContent, "nativeReference");
  assert.ok(Object.isFrozen(NATIVE_CARRIER_CONTENT_MODEL));
  assert.throws(
    () =>
      readAudioContentModelPin({
        audioContentModel: { ...NATIVE_CARRIER_CONTENT_MODEL, phasePolicy: "restartedSource" },
      }),
    /AUDIO_CONTENT_MODEL_PIN/,
  );
  assert.equal(readAudioContentModelPin({ profiles: [] }), "nativeReference");
});

test("nativeReference content pins describe original native waves independently of resource virtualization", async () => {
  const models = await import("../../src/audio/content-model.js");
  const pin = Reflect.get(models, "NATIVE_REFERENCE_CONTENT_MODEL") as
    | Record<string, unknown>
    | undefined;
  assert.ok(pin, "original native content requires its own exact recording pin");
  assert.equal(
    readAudioContentModelPin({ audioContentModel: pin, profiles: [] }),
    "nativeReference",
  );
  assert.equal(pin.oscillatorAutomationRate, "a-rate");
  assert.equal(pin.sampleAutomationRate, "k-rate");
  assert.equal(pin.oscillatorWaveformPolicy, "nativeOscillatorTypeAndNativeBandlimiting");
  assert.equal(
    Object.hasOwn(pin, "resourcePolicy"),
    false,
    "route policy is not a new content waveform",
  );
  assert.throws(
    () =>
      readAudioContentModelPin({
        audioContentModel: { ...pin, oscillatorAutomationRate: "k-rate" },
      }),
    /AUDIO_CONTENT_MODEL_PIN/,
  );
});
