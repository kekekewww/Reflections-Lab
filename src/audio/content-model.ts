/** Original browser-managed source content; route/resource policy is intentionally separate. */
export const NATIVE_REFERENCE_CONTENT_MODEL = Object.freeze({
  id: "reflection-lab/native-reference-v1",
  version: 1,
  oscillatorWaveformPolicy: "nativeOscillatorTypeAndNativeBandlimiting",
  sampleContentPolicy: "originalPcmAndNativeBufferSourceOffset",
  oscillatorAutomationRate: "a-rate",
  sampleAutomationRate: "k-rate",
  pitchPolicy: "linearAudioParamRateRamp",
  modelClass: "perceptualApproximation",
} as const);

/** Stable recording pin. This defines source content, not a physical vibration model. */
export const SEEKABLE_HARMONIC_CONTENT_MODEL = Object.freeze({
  id: "reflection-lab/seekable-harmonics-v1",
  version: 1,
  harmonicCap: 256,
  normalization: "disabled",
  harmonicPolicy: "baseFrequencyNyquistBound;nativeBandlimitedPeriodicWave",
  pitchPolicy: "linearAudioParamRateRamp;sourceTimeIntegral",
  phasePolicy: "fourierRotationAtIntegratedSourceSeconds",
  modelClass: "perceptualApproximation",
} as const);

/** Candidate v2: same harmonic content, explicit native render clock and source origin. */
export const NATIVE_CLOCK_CONTENT_MODEL = Object.freeze({
  id: "reflection-lab/seekable-native-clock-v2",
  version: 2,
  harmonicCap: 256,
  normalization: "disabled",
  harmonicPolicy: "baseFrequencyNyquistBound;nativeBandlimitedPeriodicWave",
  pitchPolicy: "nativeARateOscillator;nativeKRateSample;actualContextQuantum;Float32Parameter",
  phasePolicy: "leftSampleNativeIncrement;fourierRotationAtIntegratedSourceSeconds",
  sampleOriginPolicy: "nearestAssetFrameOnce;fractionalCursorPreserved",
  cursorModel: "nativeFloat32AAndKRate-v2",
  modelClass: "perceptualApproximation",
} as const);

/** Native waveform content is retained; only expensive route graphs are virtualized. */
export const NATIVE_CARRIER_CONTENT_MODEL = Object.freeze({
  id: "reflection-lab/native-carrier-route-virtualization-v1",
  version: 1,
  sourceContent: "nativeReference",
  oscillatorAutomationRate: "a-rate",
  sampleAutomationRate: "k-rate",
  phasePolicy: "retainedNativeSourceWithConnectedSilentAnchor",
  resourcePolicy: "activeRendered;activeAndRetiringGraphs;allNativeCarriersSeparatelyBounded",
  pausePolicy: "sameContextFadeSuspendResume",
  contextReplacement: "explicitInterruptedBoundary;phaseCursorRestoreNotPcmStateTransfer",
  modelClass: "perceptualApproximation",
} as const);

export type AudioOscillatorModel =
  | "nativeReference"
  | "seekableHarmonics"
  | "seekableNativeClock"
  | "nativeCarrierRoutes";

/** Missing pins retain legacy browser-managed oscillator content. Unknown pins fail closed. */
export function readAudioContentModelPin(generatorConfig: unknown): AudioOscillatorModel {
  if (
    generatorConfig === null ||
    typeof generatorConfig !== "object" ||
    Array.isArray(generatorConfig) ||
    !Object.hasOwn(generatorConfig, "audioContentModel")
  )
    return "nativeReference";
  const pin = (generatorConfig as Record<string, unknown>).audioContentModel;
  for (const [expected, model] of [
    [NATIVE_REFERENCE_CONTENT_MODEL, "nativeReference"],
    [SEEKABLE_HARMONIC_CONTENT_MODEL, "seekableHarmonics"],
    [NATIVE_CLOCK_CONTENT_MODEL, "seekableNativeClock"],
    [NATIVE_CARRIER_CONTENT_MODEL, "nativeCarrierRoutes"],
  ] as const) {
    if (
      pin !== null &&
      typeof pin === "object" &&
      !Array.isArray(pin) &&
      Object.keys(pin).length === Object.keys(expected).length &&
      Object.entries(expected).every(
        ([key, value]) => (pin as Record<string, unknown>)[key] === value,
      )
    )
      return model;
  }
  throw new Error("AUDIO_CONTENT_MODEL_PIN: Unknown or altered oscillator content model");
}
