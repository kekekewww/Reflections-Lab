import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame } from "../../src/acoustics/types.js";

/** A delayed newly born route must start its fade at actual arrival, not before the delay line fills. */
export async function runAudioContinuityBrowserValidation() {
  const rate = 48000,
    context = new OfflineAudioContext(2, Math.round(rate * 0.35), rate);
  const engine = new AudioEngine({
    context,
    headroomGain: 1,
    monitorGain: 1,
    limiterEnabled: false,
    spatializationModel: "equalpower",
  });
  await engine.enable(0);
  engine.setMuted(false);
  const frame: AcousticFrame = {
    schemaVersion: "1.0.0",
    requestId: "continuity",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 0,
    backendId: "literal-continuity-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: 0.025,
    paths: [],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["Isolated route lifecycle fixture, not a geometry solution"],
  };
  engine.playVoice(
    {
      instanceId: "continuous",
      sourceId: "source",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz: 1000 },
      gainLinear: 1,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    },
    frame,
  );
  const first = context.suspend(0.1),
    second = context.suspend(0.2),
    rendering = context.startRendering();
  await first;
  const birth = context.currentTime,
    arrival = birth + 0.025;
  engine.updateFrame({
    ...frame,
    poseTick: 1,
    paths: [
      {
        id: "new-path",
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
  });
  await context.resume();
  await second;
  const death = context.currentTime;
  engine.updateFrame({ ...frame, poseTick: 2 });
  await context.resume();
  const output = await rendering,
    left = output.getChannelData(0),
    right = output.getChannelData(1);
  let sum = 0,
    n = 0,
    maxDelta = 0,
    afterDeathEnergy = 0;
  const regions: Record<string, { error: number; count: number; energy: number }> = {};
  for (let i = Math.round(birth * rate); i < Math.round((death + 0.04) * rate); i++) {
    const t = i / rate,
      gain = Math.max(0, Math.min(1, (t - arrival) / 0.02, 1 - (t - death) / 0.02));
    const expected = Math.sin(2 * Math.PI * 1000 * (t - 0.025)) * gain;
    const actual = (left[i]! + right[i]!) * Math.SQRT1_2;
    sum += (actual - expected) ** 2;
    const region =
      t < arrival
        ? "before"
        : t < arrival + 0.02
          ? "birth"
          : t < death
            ? "steady"
            : t < death + 0.02
              ? "death"
              : "after";
    const stats = (regions[region] ??= { error: 0, count: 0, energy: 0 });
    stats.error += (actual - expected) ** 2;
    stats.count++;
    stats.energy += actual ** 2;
    n++;
    if (i > 0) maxDelta = Math.max(maxDelta, Math.abs(left[i]! - left[i - 1]!));
    if (t > death + 0.03) afterDeathEnergy += left[i]! ** 2 + right[i]! ** 2;
  }
  const rmsError = Math.sqrt(sum / n),
    telemetry = engine.getTelemetry();
  engine.dispose();
  return {
    status: rmsError < 0.001 && afterDeathEnergy < 1e-10 ? "PASS" : "FAIL",
    checks: [
      {
        id: "native-delayed-path-birth-and-death-follow-audio-clock-fades",
        pass: rmsError < 0.001 && afterDeathEnergy < 1e-10,
        evidence: {
          birth,
          arrival,
          death,
          rmsError,
          oracle: "sin(2*pi*1000*(t-.025))*clamp(min((t-arrival)/.02,1-(t-death)/.02),0,1)",
          rmsTolerance: 0.001,
          afterDeathEnergy,
          maxDelta,
          telemetry,
          regions,
        },
      },
    ],
    userAgent: navigator.userAgent,
    limitations: [
      "One literal delayed sine fixture; no universal click/pop threshold adopted",
      "No hearing or realtime performance certification",
    ],
  };
}
