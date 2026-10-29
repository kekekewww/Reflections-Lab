import type { AcousticFrame } from "../../src/acoustics/types.js";
import { PathRoute } from "../../src/audio/routes.js";
import {
  IR_STATE_REFERENCE_VERSION,
  IR_STATE_RATE,
  IR_STATE_FRAMES,
  IR_STATE_BANDS,
  IR_STATE_GAINS_A,
  IR_STATE_GAINS_B,
  IR_STATE_BASELINE_SHA256,
  fixedIrStateKernel,
} from "./ir-state-reference-v1-data.js";

const ids = [
  "native-identical-ir-impulse-tail",
  "native-identical-ir-continuous-tone-scale-20ms",
  "native-changed-ir-bank-reverse",
] as const;
type CaseId = (typeof ids)[number];
type Response = "A" | "B";
interface Change {
  atFrame: number;
  response: Response;
  scale: number;
  accepted: boolean;
}
// Every control boundary is explicitly on a 128-frame boundary. This is a
// fixture schedule, not a claim that any device uses 128-frame render blocks.
const scalarChanges: readonly Change[] = [
  { atFrame: 4096, response: "A", scale: 2, accepted: true },
];
const reverseChanges: readonly Change[] = [
  { atFrame: 4096, response: "B", scale: 1, accepted: true },
  { atFrame: 4608, response: "A", scale: 1, accepted: false },
  { atFrame: 5376, response: "A", scale: 1, accepted: true },
];
const delay = 0.025;
const listener = [0, 0, 0];
const maximumSampleErrorBound = 1e-5;
// Existing native-continuity waveform RMS bound; fixed before this reference runs.
const rmsErrorBound = 0.001;

function acousticFrame(response: Response, scale: number): AcousticFrame {
  const gains = response === "A" ? IR_STATE_GAINS_A : IR_STATE_GAINS_B;
  return {
    schemaVersion: "1.0.0",
    requestId: "ir-state-reference-v1",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "literal-independent-ir-state-fixture",
    backendVersion: "1",
    sourceId: "source",
    listenerId: "listener",
    bandCentersHz: [...IR_STATE_BANDS],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delay,
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["Literal native DSP qualification, not a geometry solver fixture"],
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
        lengthM: delay * 343,
        absoluteDelayS: delay,
        relativeDelayS: 0,
        arrivalDirection: [0, 0, -1],
        bandGains: gains.map((value) => value * scale),
      },
    ],
  };
}

/** Independent native control reference; never invokes PathRoute or live FIR design. */
function referenceRoute(context: OfflineAudioContext, input: AudioNode) {
  const delayNode = context.createDelay(5),
    scaleNode = context.createGain(),
    panner = context.createPanner(),
    convolvers = [context.createConvolver(), context.createConvolver()] as const,
    levels = [context.createGain(), context.createGain()] as const;
  const bufferFor = (response: Response) => {
    const data = fixedIrStateKernel(response),
      buffer = context.createBuffer(1, data.length, IR_STATE_RATE);
    buffer.getChannelData(0).set(data);
    return buffer;
  };
  panner.panningModel = "equalpower";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 1;
  panner.rolloffFactor = 0;
  panner.positionX.setValueAtTime(0, 0);
  panner.positionY.setValueAtTime(0, 0);
  panner.positionZ.setValueAtTime(-1, 0);
  delayNode.delayTime.setValueAtTime(delay, 0);
  scaleNode.gain.setValueAtTime(1, 0);
  for (let i = 0; i < 2; i++) {
    convolvers[i]!.normalize = false;
    convolvers[i]!.connect(levels[i]!);
    levels[i]!.gain.setValueAtTime(i === 0 ? 1 : 0, 0);
  }
  convolvers[0].buffer = bufferFor("A");
  input.connect(delayNode);
  delayNode.connect(convolvers[0]);
  levels[0].connect(scaleNode);
  scaleNode.connect(panner).connect(context.destination);
  let active: 0 | 1 = 0,
    retiring: 0 | 1 | null = null,
    target: Response = "A";
  const ramp = (param: AudioParam, value: number, seconds: number) => {
    const now = context.currentTime,
      held = param.value;
    if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
    else param.cancelScheduledValues(now);
    param.setValueAtTime(held, now);
    param.linearRampToValueAtTime(value, now + seconds);
  };
  return {
    update(change: Change) {
      // Direction and absolute delay controls remain mandatory, even when the
      // requested frequency response and scalar are unchanged or admission waits.
      ramp(delayNode.delayTime, delay, 0.03);
      ramp(panner.positionX, 0, 0.02);
      ramp(panner.positionY, 0, 0.02);
      ramp(panner.positionZ, -1, 0.02);
      if (!change.accepted) return;
      if (retiring !== null) {
        delayNode.disconnect(convolvers[retiring]);
        levels[retiring].disconnect(scaleNode);
        retiring = null;
      }
      if (change.response !== target) {
        const next = active === 0 ? 1 : 0;
        convolvers[next].buffer = bufferFor(change.response);
        levels[next].gain.setValueAtTime(0, context.currentTime);
        delayNode.connect(convolvers[next]);
        levels[next].connect(scaleNode);
        ramp(levels[next].gain, 1, 0.02);
        ramp(levels[active].gain, 0, 0.02);
        retiring = active;
        active = next;
        target = change.response;
      }
      ramp(scaleNode.gain, change.scale, 0.02);
    },
    disconnect() {
      input.disconnect();
      delayNode.disconnect();
      scaleNode.disconnect();
      panner.disconnect();
      for (const node of [...convolvers, ...levels]) node.disconnect();
    },
  };
}

async function render(id: CaseId, actual: boolean) {
  const context = new OfflineAudioContext(2, IR_STATE_FRAMES, IR_STATE_RATE),
    source = context.createBufferSource(),
    sourceBuffer = context.createBuffer(1, IR_STATE_FRAMES, IR_STATE_RATE),
    samples = sourceBuffer.getChannelData(0),
    changes = id === ids[2] ? reverseChanges : scalarChanges,
    impulse = id === ids[0];
  if (impulse) samples[480] = 1;
  else
    for (let i = 0; i < samples.length; i++)
      samples[i] = 0.4 * Math.sin((2 * Math.PI * 1000 * i) / IR_STATE_RATE);
  source.buffer = sourceBuffer;
  const initial = acousticFrame("A", 1),
    route = actual
      ? new PathRoute(
          context,
          source,
          context.destination,
          initial,
          initial.paths[0]!,
          "equalpower",
          listener,
        )
      : null,
    reference = actual ? null : referenceRoute(context, source),
    boundaries: Record<string, unknown>[] = [];
  source.start(impulse ? 0.05 : 0.01);
  const suspensions = changes.map((change) => context.suspend(change.atFrame / IR_STATE_RATE)),
    rendering = context.startRendering();
  try {
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]!;
      await suspensions[i];
      const before = route?.convolvers.map((node) => node.buffer);
      if (route) {
        const frame = acousticFrame(change.response, change.scale);
        route.update(frame, frame.paths[0]!, listener);
      } else reference!.update(change);
      boundaries.push({
        ...change,
        actualTime: context.currentTime,
        actualFrame: context.currentTime * IR_STATE_RATE,
        buffersUnchanged: route
          ? route.convolvers.every((node, bank) => node.buffer === before![bank])
          : null,
        scaleAudioParamValue: route?.gain.gain.value ?? null,
        delayAudioParamValue: route?.delay.delayTime.value ?? null,
        bankAudioParamValues: route?.bankGains.map((node) => node.gain.value) ?? null,
        reportedFilterGroupDelaySeconds: route?.groupDelaySeconds ?? 64 / IR_STATE_RATE,
        requestedRampEndTime: change.accepted ? context.currentTime + 0.02 : null,
      });
      await context.resume();
    }
    const output = await rendering;
    return {
      id: `${id}:${actual ? "actual" : "reference"}`,
      sampleRate: output.sampleRate,
      frames: output.length,
      channels: output.numberOfChannels,
      boundaries,
      rawPcm: [Array.from(output.getChannelData(0)), Array.from(output.getChannelData(1))],
    };
  } finally {
    route?.disconnect();
    reference?.disconnect();
    source.disconnect();
  }
}

function compare(
  actual: Awaited<ReturnType<typeof render>>,
  reference: Awaited<ReturnType<typeof render>>,
) {
  return actual.rawPcm.map((channel, channelIndex) => {
    let sum = 0,
      maximumError = 0,
      energy = 0,
      tailEnergy = 0,
      finite = true;
    const expected = reference.rawPcm[channelIndex]!;
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i]!,
        target = expected[i]!,
        error = value - target;
      finite &&= Number.isFinite(value) && Number.isFinite(target);
      sum += error * error;
      maximumError = Math.max(maximumError, Math.abs(error));
      energy += target * target;
      if (i >= 4096 && i < 4224) tailEnergy += target * target;
    }
    return {
      channelIndex,
      finite,
      rmsError: Math.sqrt(sum / channel.length),
      maximumError,
      referenceEnergy: energy,
      referenceTailEnergyAfterSwitch: tailEnergy,
    };
  });
}

/** Separate versioned numerical qualification; original25 cases/oracles are unchanged. */
export async function runNativeIrStateReferenceV1() {
  const capability = {
    offlineAudioContext: typeof globalThis.OfflineAudioContext === "function",
    offlineSuspend: typeof globalThis.OfflineAudioContext?.prototype.suspend === "function",
  };
  if (!capability.offlineAudioContext || !capability.offlineSuspend)
    return {
      status: "BLOCKED",
      referenceVersion: IR_STATE_REFERENCE_VERSION,
      capability,
      checks: [],
      renders: [],
      userAgent: navigator.userAgent,
    };
  const renders: Awaited<ReturnType<typeof render>>[] = [],
    checks = [];
  for (const id of ids) {
    const actual = await render(id, true),
      reference = await render(id, false),
      channels = compare(actual, reference);
    renders.push(actual, reference);
    const expectedReuse = id !== ids[2],
      formatCorrect = [actual, reference].every(
        (rendered) =>
          rendered.sampleRate === IR_STATE_RATE &&
          rendered.frames === IR_STATE_FRAMES &&
          rendered.channels === 2,
      ),
      expectedChanges = id === ids[2] ? reverseChanges : scalarChanges,
      scheduleCorrect = [actual, reference].every(
        (rendered) =>
          rendered.boundaries.length === expectedChanges.length &&
          rendered.boundaries.every(
            (boundary, index) => boundary.actualFrame === expectedChanges[index]!.atFrame,
          ),
      ),
      bufferStateCorrect = expectedReuse
        ? actual.boundaries.every((boundary) => boundary.buffersUnchanged === true)
        : actual.boundaries.every((boundary) => boundary.buffersUnchanged === !boundary.accepted),
      pass =
        formatCorrect &&
        scheduleCorrect &&
        bufferStateCorrect &&
        channels.every(
          (channel) =>
            channel.finite &&
            channel.referenceEnergy > 0 &&
            channel.referenceTailEnergyAfterSwitch > 0 &&
            channel.rmsError < rmsErrorBound &&
            channel.maximumError < maximumSampleErrorBound,
        );
    checks.push({
      id,
      pass,
      evidence: {
        channels,
        formatCorrect,
        scheduleCorrect,
        bufferStateCorrect,
        actualBoundaries: actual.boundaries,
        referenceBoundaries: reference.boundaries,
        rmsErrorBound,
        maximumSampleErrorBound,
        oracle: expectedReuse
          ? "Independent single native Convolver retains continuous input history; fixed old-math FIR; same native scale/delay/direction ramps"
          : "Independent fixed-FIR native two-bank A/B/A controller; fixed accepted/deferred schedule and20ms scale/bank ramps",
      },
    });
  }
  return {
    status: checks.every((check) => check.pass) ? "PASS" : "FAIL",
    referenceVersion: IR_STATE_REFERENCE_VERSION,
    kernelBaselineSha256: IR_STATE_BASELINE_SHA256,
    capability,
    sampleRate: IR_STATE_RATE,
    framesPerRender: IR_STATE_FRAMES,
    channelsPerRender: 2,
    userAgent: navigator.userAgent,
    checks,
    renders,
    limitations: [
      "New continuous-convolution reference; does not assert preimage PCM identity around redundant convolver-bank restarts",
      "Literal deterministic native OfflineAudioContext DSP only; no original25 acceptance replacement",
      "No device, hearing, realtime capacity, latency, SPL, AudioWorklet or performance claim",
    ],
  };
}
