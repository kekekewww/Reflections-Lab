import { AudioEngine } from "../../../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../../../src/audio/types.js";
import { BUDGET, POLICY } from "./contracts.js";

function check(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
/** Full 24-render-voice phase stress. Rebound real intent, 23 silent high-priority
 * competitors and one equal-priority overflow voice. Same starts/updates/stops in
 * both arms. Reference rejects overflow; candidate retains/demotes/promotes.
 * An independent output mask on the reference models the explicitly expected
 * 20ms render-gate transitions, including their first sample (no ignored prefix).
 * No observation tap anchors a virtual source or bypasses the candidate gate.
 */
export async function renderPhase(
  seed: VoiceInput,
  seedFrame: AcousticFrame,
  candidate: boolean,
  waveform: OscillatorType | "sample-loop",
) {
  check(
    ["sine", "square", "sawtooth", "triangle", "sample-loop"].includes(waveform),
    "fixed content matrix",
  );
  const context = new OfflineAudioContext(1, 96000, 48000);
  const engine = new AudioEngine({
    context,
    budget: BUDGET,
    oscillatorModel: "nativeReference",
    virtualization: candidate ? POLICY : false,
    offlineOutputTap: "dryContent",
    spatializationModel: "equalpower",
  });
  // Dry content comparison deliberately has no propagation routes; geometry and
  // the actual runtime-frame comparison are separate fixtures in the same run.
  const frame = { ...structuredClone(seedFrame), paths: [] };
  const target: VoiceInput = {
    ...structuredClone(seed),
    instanceId: "phase.target",
    emissionTimeSeconds: 0,
    generator: {
      kind: "oscillator",
      waveform: waveform as "sine" | "square" | "sawtooth" | "triangle",
      frequencyHz: 220,
    },
    continuous: true,
    priority: 1,
    gainLinear: 0.1,
    pitchSemitones: 0,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
  };
  const times = [0.1, 0.5, 1.25, 1.3, 1.5, 1.6];
  const observations = [],
    admissions = [];
  try {
    await engine.enable(0);
    const sample =
      waveform === "sample-loop"
        ? (await engine.registerBuiltins()).find((asset) => asset.assetId === "builtin-tone")!
        : null;
    if (sample)
      target.generator = {
        kind: "sample",
        asset: { assetId: sample.assetId, revision: sample.revision, sha256: sample.sha256! },
        loop: true,
        startOffsetSeconds: 0.125,
      };
    check(engine.playVoice(target, frame).accepted, "target admission");
    for (let i = 0; i < 23; i++)
      check(
        engine.playVoice(
          { ...target, instanceId: `phase.blocker.${i}`, priority: 2, gainLinear: 0 },
          frame,
        ).accepted,
        "full render capacity",
      );
    check(engine.getTelemetry().activeVoices === 24, "must render original 24 voices");
    admissions.push(
      engine.playVoice({ ...target, instanceId: "phase.waiting", gainLinear: 0 }, frame),
    );
    check(admissions[0]!.accepted === candidate, "overflow classification changed");
    const pauses = times.map((t) => context.suspend((Math.ceil((t * 48000) / 128) * 128) / 48000));
    const rendering = context.startRendering();
    for (let i = 0; i < times.length; i++) {
      await pauses[i];
      const time = times[i]!;
      if (time === 0.1)
        engine.updateVoice(target.instanceId, { pitchSemitones: 12, smoothingSeconds: 0.4 });
      if (time === 1.3)
        engine.updateVoice(target.instanceId, { pitchSemitones: -12, smoothingSeconds: 0.1 });
      if (time === 1.5) engine.stopVoice("phase.waiting", 0);
      engine.serviceNativeVoices();
      engine.flushControlUpdates();
      const t = engine.getTelemetry();
      const cursor = engine.getVoiceCursorState(target.instanceId, context.currentTime);
      check(
        t.activeRenderedCap === 24 &&
          t.nativeSourceNodes <= t.nativeCarrierBudget &&
          t.nativeSlotsInUse <= t.nativeGraphTotalBudget,
        "capacity violation",
      );
      if (candidate && time === 1.3)
        check(cursor?.provenance === "virtual", "target must actually be virtual");
      if (candidate && time === 1.6)
        check(cursor?.provenance === "native", "target must actually resume");
      if (!candidate && (time === 1.25 || time === 1.5)) {
        // An externally observed reference output mask, not a candidate-derived
        // waveform, timeline, or cursor. The mask is fixed by this scenario.
        const raw = (engine as unknown as { rawMix: GainNode }).rawMix.gain;
        raw.setValueAtTime(time === 1.25 ? 1 : 0, context.currentTime);
        raw.linearRampToValueAtTime(time === 1.25 ? 0 : 1, context.currentTime + 0.02);
      }
      observations.push({
        intendedTime: time,
        audioTime: context.currentTime,
        virtual: t.virtualVoices,
        nativeSlots: t.nativeSlotsInUse,
        nativeSources: t.nativeSourceNodes,
        demotions: t.virtualization.demotions,
        promotions: t.virtualization.promotions,
        targetProvenance: cursor?.provenance,
        logicalCursor: cursor?.logicalCursor,
      });
      await context.resume();
    }
    const output = await rendering;
    return {
      pcm: new Float32Array(output.getChannelData(0)),
      observations,
      admissions,
      samplePin: sample,
    };
  } finally {
    await engine.disposeAsync();
  }
}
