/** Existing fixture IDs and API needs only. Numerical thresholds stay in the original suites. */
export const CROSS_ENGINE_DEFAULTS = Object.freeze({
  engines: ["firefox", "webkit"],
  suiteTimeoutMs: 45_000,
  launchTimeoutMs: 20_000,
  cleanupTimeoutMs: 8_000,
  operationLogLimit: 128,
});

const base = ["offlineAudioContext", "nativeNodes"];
const timed = [...base, "offlineSuspend", "offlineResume"];
const decoded = [...base, "webCrypto", "decodeAudioData"];
const entry = (id, requires = base) => ({ id, requires });
export const NATIVE_AUDIO_SUITES = [
  {
    id: "baseline",
    module: "/tests/audio-runtime/browser.ts",
    exportName: "runAudioBrowserValidation",
    cases: [
      entry("native-delay-arrivals-once"),
      entry("native-pressure-gain-once-and-no-convolver-normalization"),
      entry("native-dispose-resource-accounting"),
      entry("native-continuous-generator-survives-parameter-and-impact-updates"),
      entry("native-independent-voice-path-and-decoded-memory-budgets"),
      entry("native-bounded-burst-finite-output"),
      entry("native-hrtf-renders-finite-nonzero-output"),
    ],
  },
  {
    id: "pause",
    module: "/tests/audio-runtime/native-pause.ts",
    exportName: "runAudioPauseBrowserValidation",
    cases: [
      entry("native-ended-emission-unarrived-impulse-restored-once", timed),
      entry("native-heard-impact-not-reemitted", timed),
      entry("native-future-emission-rescheduled-once", timed),
      entry("native-sample-cursor-preserved-across-pause", timed),
      entry("native-oscillator-cursor-preserved-across-pause", [...timed, "periodicWave"]),
      entry("native-paused-run-keeps-device-clock-running", ["audioContext", "nativeNodes"]),
    ],
  },
  {
    id: "late",
    module: "/tests/audio-runtime/native-reverb.ts",
    exportName: "runAudioLateBrowserValidation",
    cases: [
      entry("native-synthetic-late-IR-explicit-unit-energy-no-auto-normalization"),
      entry("native-late-tail-starts-after-real-solver-path-and-30ms-synthetic-onset"),
      entry("native-late-bank-crossfade-bounded-finite-and-source-preserving", timed),
      entry("native-original-WAV-import-real-decode-and-trusted-hash-playback", decoded),
    ],
  },
  {
    id: "continuity",
    module: "/tests/audio-runtime/native-continuity.ts",
    exportName: "runAudioContinuityBrowserValidation",
    cases: [entry("native-delayed-path-birth-and-death-follow-audio-clock-fades", timed)],
  },
  {
    id: "restore",
    module: "/tests/audio-runtime/native-restore.ts",
    exportName: "runAudioRestoreBrowserValidation",
    cases: [
      entry("native-seek-restores-authored-offset-once-and-existing-propagation-pipeline"),
      entry("native-seek-ended-heard-impact-stays-heard"),
      entry("native-seek-ended-unarrived-impact-arrives-once"),
      entry("native-capture-source-cursor-integrates-authored-pitch-ramp", timed),
      entry("native-pause-captured-cursor-restores-without-fade-age-inflation", timed),
    ],
  },
  {
    id: "wave",
    module: "/tests/audio-runtime/native-wave.ts",
    exportName: "runAudioWaveBrowserValidation",
    cases: [
      entry("native-supported-PCM8-16-24-32-and-normalized-float32-WAV-decode", decoded),
      entry("native-WAV-resample-reservation-and-unsupported-format-preflight", decoded),
    ],
  },
];

export const NATIVE_AUDIO_CASE_COUNT = NATIVE_AUDIO_SUITES.reduce(
  (sum, suite) => sum + suite.cases.length,
  0,
);

export function parseCrossEngineArgs(args) {
  const result = { run: false, engines: [...CROSS_ENGINE_DEFAULTS.engines], output: null };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--prepare") continue;
    if (arg === "--run") {
      result.run = true;
      continue;
    }
    if (arg === "--engines" || arg === "--output") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing ${arg} value`);
      if (arg === "--engines") result.engines = [...new Set(value.split(","))];
      else result.output = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (
    !result.engines.length ||
    result.engines.some((engine) => !["chromium", "firefox", "webkit"].includes(engine))
  )
    throw new Error("Choose cached engines from chromium,firefox,webkit");
  return result;
}
