import {
  DELAY_REFERENCE_CASES_V1,
  DELAY_REFERENCE_FRAMES_V1,
  DELAY_REFERENCE_RATE_V1,
  DELAY_REFERENCE_SAMPLE_LIMIT_V1,
  DELAY_REFERENCE_VERSION_V1,
  predictDelayReferenceV1,
} from "./delay-reference-model-v1.js";

/** A new diagnostic reference; the original twenty-five fixtures and failed oracle stay untouched. */
export async function runNativeDelayReferenceV1() {
  if (typeof globalThis.OfflineAudioContext !== "function")
    return {
      status: "BLOCKED",
      referenceVersion: DELAY_REFERENCE_VERSION_V1,
      cases: [],
      reason: "Native OfflineAudioContext absent",
    };
  const cases = [];
  for (const spec of DELAY_REFERENCE_CASES_V1) {
    const prediction = predictDelayReferenceV1(spec); // Fixed before this graph is rendered.
    const context = new OfflineAudioContext(2, DELAY_REFERENCE_FRAMES_V1, DELAY_REFERENCE_RATE_V1);
    const nodes: AudioNode[] = [];
    try {
      const input = context.createBuffer(1, 960, DELAY_REFERENCE_RATE_V1);
      input.getChannelData(0)[480] = 1;
      const source = context.createBufferSource();
      source.buffer = input;
      nodes.push(source);
      const readbacks = spec.paths.map((path) => {
        let upstream: AudioNode = source;
        let delay: DelayNode | null = null;
        let convolver: ConvolverNode | null = null;
        if (path.delaySeconds !== null) {
          delay = context.createDelay(5);
          delay.delayTime.setValueAtTime(path.delaySeconds, 0);
          upstream.connect(delay);
          nodes.push(delay);
          upstream = delay;
        }
        if (path.convolver) {
          convolver = context.createConvolver();
          convolver.normalize = false;
          const unit = context.createBuffer(1, 1, context.sampleRate);
          unit.getChannelData(0)[0] = 1;
          convolver.buffer = unit;
          upstream.connect(convolver);
          nodes.push(convolver);
          upstream = convolver;
        }
        const gain = context.createGain();
        gain.gain.setValueAtTime(path.gain, 0);
        const panner = context.createPanner();
        panner.panningModel = "equalpower";
        panner.distanceModel = "inverse";
        panner.rolloffFactor = 0;
        panner.refDistance = 1;
        panner.maxDistance = 1;
        panner.positionX.setValueAtTime(0, 0);
        panner.positionY.setValueAtTime(0, 0);
        panner.positionZ.setValueAtTime(-1, 0);
        upstream.connect(gain);
        gain.connect(panner);
        panner.connect(context.destination);
        nodes.push(gain, panner);
        return {
          requested: path,
          delaySeconds: delay?.delayTime.value ?? null,
          gain: gain.gain.value,
          convolverNormalize: convolver?.normalize ?? null,
          convolverPcm: convolver?.buffer ? Array.from(convolver.buffer.getChannelData(0)) : null,
          panner: {
            model: panner.panningModel,
            rolloffFactor: panner.rolloffFactor,
            position: [panner.positionX.value, panner.positionY.value, panner.positionZ.value],
          },
        };
      });
      source.start(0.05);
      const rendered = await context.startRendering();
      const rawPcm = [0, 1].map((channel) => Array.from(rendered.getChannelData(channel)));
      let energy = 0;
      let finite = true;
      let maxSampleAbsoluteError = 0;
      const windows = rawPcm.map((data, channel) => {
        const expected = new Map(
          prediction.sparsePcm[channel]!.map(({ index, value }) => [index, value]),
        );
        let peakIndex = -1;
        let peakValue = 0;
        for (let index = 0; index < data.length; index++) {
          const value = data[index]!;
          finite &&= Number.isFinite(value);
          energy += value * value;
          maxSampleAbsoluteError = Math.max(
            maxSampleAbsoluteError,
            Math.abs(value - (expected.get(index) ?? 0)),
          );
          if (Math.abs(value) > Math.abs(peakValue)) {
            peakIndex = index;
            peakValue = value;
          }
        }
        const indices = new Set(
          prediction.sparsePcm[channel]!.flatMap(({ index }) => [index - 1, index, index + 1]),
        );
        return {
          peak: { index: peakIndex, value: peakValue },
          predictedArrivalWindows: [...indices]
            .sort((a, b) => a - b)
            .map((index) => ({ index, value: data[index] ?? null })),
        };
      });
      cases.push({
        id: spec.id,
        inputs: {
          sampleRate: DELAY_REFERENCE_RATE_V1,
          frames: DELAY_REFERENCE_FRAMES_V1,
          sourceStartSeconds: 0.05,
          impulseIndex: 480,
          sourceFrames: 960,
        },
        context: {
          sampleRate: context.sampleRate,
          state: context.state,
          channels: rendered.numberOfChannels,
          frames: rendered.length,
        },
        readbacks,
        prediction,
        observed: { finite, energy, windows },
        diagnosticComparison: {
          maxSampleAbsoluteError,
          sampleLimit: DELAY_REFERENCE_SAMPLE_LIMIT_V1,
          matchesPrediction: finite && maxSampleAbsoluteError <= DELAY_REFERENCE_SAMPLE_LIMIT_V1,
          energyErrorFromPrediction: energy - prediction.energy,
          energyErrorFromIdeal: energy - prediction.idealEnergy,
          originalThresholdRemainsUnchanged: 1e-5,
          acceptanceDecision: "NOT_AN_ORIGINAL_ACCEPTANCE_DECISION",
        },
        rawPcm,
      });
    } finally {
      for (const node of nodes) node.disconnect();
    }
  }
  return {
    status: "REFERENCE_MEASURED",
    referenceVersion: DELAY_REFERENCE_VERSION_V1,
    userAgent: navigator.userAgent,
    rawPcmBytes: cases.length * 2 * DELAY_REFERENCE_FRAMES_V1 * Float32Array.BYTES_PER_ELEMENT,
    originalFailRetained: true,
    cases,
    limitations: [
      "New diagnostic reference only; original25-case FAIL is preserved",
      "No AudioEngine or production DSP imports; native gain/unit-convolver/delay/equalpower-panner only",
      "No preference changes, hearing/device/Worklet or capacity claim",
    ],
  };
}
