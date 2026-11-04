import assert from "node:assert/strict";
import { AudioEngine } from "../../../../src/audio/engine.js";
import { selectNativeVoices } from "../../../../src/audio/virtual-policy.js";
import { FakeAudioContext, FakeAudioParam } from "../../../audio-runtime/fake-context.js";
import { apply, BUDGET, POLICY, type Corpus } from "./contracts.js";
import type { AcousticFrame, VoiceInput } from "../../../../src/audio/types.js";

export class ControlContext extends FakeAudioContext {
  readonly renderQuantumSize = 128;
  // Enables the product's actual-audio-time retirement path. This renders NO PCM.
  async startRendering() {
    return this.createBuffer(1, 1, this.sampleRate) as unknown as AudioBuffer;
  }
}
function controlCalls(context: FakeAudioContext) {
  let calls = 0;
  for (const owner of [...context.nodes, context.listener])
    for (const value of Object.values(owner))
      if (value instanceof FakeAudioParam) calls += value.automation.length;
  return calls;
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9, `${a} != ${b}`);
export async function replayCorpus(corpus: Corpus, candidate: boolean) {
  assert.deepEqual(corpus.budget, BUDGET, "reject changed capacity profiles");
  const context = new ControlContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: BUDGET,
    oscillatorModel: "nativeReference",
    virtualization: candidate ? POLICY : false,
  });
  const snapshots = [],
    admissions = [],
    cursors = [];
  const ids = new Set<string>();
  let previousCalls = 0;
  try {
    await engine.enable(0);
    for (const tick of corpus.ticks) {
      context.currentTime = tick.time;
      for (const op of tick.operations) {
        const outcome = apply(engine, structuredClone(op));
        if (op.kind === "start") {
          ids.add(op.input.instanceId);
          admissions.push({ tick: tick.tick, id: op.input.instanceId, outcome });
        }
      }
      engine.flushControlUpdates();
      const calls = controlCalls(context);
      const t = engine.getTelemetry();
      assert.equal(t.activeRenderedCap, 24);
      assert.ok(t.activeVoices <= 24);
      assert.ok(t.nativeSlotsInUse <= t.nativeGraphTotalBudget);
      assert.ok(t.nativeSourceNodes <= t.nativeCarrierBudget);
      assert.ok(t.internalArrivalGraphsInUse <= t.internalArrivalGraphBudget);
      const cursor = [...ids].map((id) => ({
        id,
        value: engine.getVoiceCursorState(id, tick.time)?.logicalCursor ?? null,
      }));
      cursors.push({ tick: tick.tick, cursor });
      snapshots.push({
        tick: tick.tick,
        time: tick.time,
        nativeSlots: t.nativeSlotsInUse,
        nativeSources: t.nativeSourceNodes,
        virtualVoices: t.virtualVoices,
        retiring: t.retiringVoices,
        pending: t.pendingVoices,
        activePaths: t.activePaths,
        controlCalls: calls - previousCalls,
        onsets: engine.getDiagnostics().onsets,
      });
      previousCalls = calls;
    }
    return {
      admissions,
      cursors,
      snapshots,
      costs: {
        ticks: snapshots.length,
        peakNativeSlots: Math.max(...snapshots.map((s) => s.nativeSlots)),
        peakNativeSources: Math.max(...snapshots.map((s) => s.nativeSources)),
        peakVirtualVoices: Math.max(...snapshots.map((s) => s.virtualVoices)),
        controlCalls: previousCalls,
        controlCallsPerTick: previousCalls / snapshots.length,
        onsetLatenessMs: engine.getDiagnostics().onsets.latenessMs,
        sourceStarts: context.sources().reduce((n, s) => n + s.starts.length, 0),
        nativeDspCpuMs: null,
      },
    };
  } finally {
    await engine.disposeAsync();
    assert.ok(context.sources().every((s) => s.starts.length === 1 && s.connections.length === 0));
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 0);
    assert.equal(engine.getTelemetry().nativeSourceNodes, 0);
  }
}

/** Full formal render capacity, then an explicitly tagged overflow workload.
 * The native admissions MAY differ in overflow; logical/recording admission may not.
 * Intent and solver path templates come from the real captured runtime.
 */
export async function capacityNegatives(corpus: Corpus, candidate: boolean) {
  const seed = corpus.ticks.flatMap((t) => t.operations).find((o) => o.kind === "start");
  assert.ok(seed?.kind === "start");
  const context = new ControlContext();
  const ended: string[] = [];
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: BUDGET,
    oscillatorModel: "nativeReference",
    virtualization: candidate ? POLICY : false,
    onVoiceEnded: (id) => ended.push(id),
  });
  const admissions = [],
    snapshots = [];
  const input = (i: number): VoiceInput => ({
    ...structuredClone(seed.input),
    instanceId: `capacity.${i}`,
    emissionTimeSeconds: 0,
    continuous: true,
    priority: 1,
    pitchSemitones: 0,
  });
  try {
    await engine.enable(0);
    for (let i = 0; i < 57; i++) {
      const outcome = engine.playVoice(input(i), seed.frame);
      admissions.push(outcome);
      if (i < 24) assert.equal(outcome.accepted, true, "all 24 formal render voices must fit");
    }
    assert.equal(engine.getTelemetry().activeVoices, 24);
    if (candidate) {
      assert.equal(engine.getTelemetry().virtualVoices, 32);
      assert.equal(admissions[56]!.reason, "VIRTUAL_VOICE_BUDGET");
    }
    const starts = context.sources().length;
    assert.equal(engine.playVoice(input(0), seed.frame).reason, "ALREADY_PLAYING");
    assert.equal(context.sources().length, starts, "repeat start cannot allocate");
    for (const time of [0.1, 0.15, 0.19, 0.5, 1.25, 1.3, 1.31]) {
      context.currentTime = time;
      if (time === 0.1)
        for (let i = 0; i < (candidate ? 56 : 24); i++)
          engine.updateVoice(`capacity.${i}`, { pitchSemitones: 12, smoothingSeconds: 0.4 });
      engine.serviceNativeVoices();
      engine.flushControlUpdates();
      const t = engine.getTelemetry();
      assert.ok(t.activeVoices <= 24 && t.nativeSlotsInUse <= t.nativeGraphTotalBudget);
      assert.ok(t.nativeSourceNodes <= t.nativeCarrierBudget);
      assert.ok(t.virtualVoices <= 32 + 24, "bounded outgoing transition set");
      assert.ok(t.activePaths <= BUDGET.maxTotalPaths, "formal path cap including retiring graphs");
      if (candidate && time < 0.2)
        assert.equal(t.virtualization.demotions, 0, "minimum residence hysteresis");
      // Independent piecewise integral of rate 1 -> 2 over [.1,.5].
      const dt = Math.max(0, Math.min(time - 0.1, 0.4));
      const expected = Math.min(time, 0.1) + dt + (dt * dt) / 0.8 + Math.max(0, time - 0.5) * 2;
      for (let i = 0; i < (candidate ? 56 : 24); i++) {
        const state = engine.getVoiceCursorState(`capacity.${i}`, time);
        assert.ok(state, "demotion cannot remove logical cursor");
        close(state.logicalCursor.playheadSeconds, expected);
      }
      snapshots.push({
        time,
        nativeSlots: t.nativeSlotsInUse,
        virtual: t.virtualVoices,
        sources: t.nativeSourceNodes,
        retiring: t.retiringVoices,
        activePaths: t.activePaths,
        droppedPaths: t.droppedPaths,
        droppedVoices: t.droppedVoices,
        stolenVoices: t.stolenVoices,
        demotions: t.virtualization.demotions,
        promotions: t.virtualization.promotions,
        controlCalls: controlCalls(context),
      });
    }
    assert.deepEqual(ended, [], "virtualization is not a logical end");
    context.currentTime = 1.4;
    await engine.pause(1.4);
    const paused = engine.getTelemetry();
    assert.ok(paused.pendingVoices <= BUDGET.maxPendingEvents);
    assert.ok(paused.frozenArrivals <= BUDGET.maxPendingEvents);
    await engine.resume(1.4);
    context.currentTime = 1.5;
    engine.serviceNativeVoices();
    await engine.drainVoices();
    const drained = engine.getTelemetry();
    assert.equal(
      drained.activeVoices +
        drained.virtualVoices +
        drained.retiringVoices +
        drained.pendingVoices +
        drained.nativeSourceNodes,
      0,
    );
    assert.equal(new Set(ended).size, ended.length, "completion is delivered once");
    return { admissions, snapshots, paused, drained, sourceStarts: context.sources().length };
  } finally {
    await engine.disposeAsync();
    assert.equal(engine.getTelemetry().nativeSlotsInUse, 0);
    assert.ok(context.sources().every((s) => s.starts.length === 1 && s.connections.length === 0));
  }
}

export function hysteresisOracle() {
  const native = Array.from({ length: 24 }, (_, i) => ({
    instanceId: `n.${i}`,
    priority: 1,
    nativeSince: 0,
    virtualSince: null,
  }));
  const waiting = { instanceId: "waiting", priority: 1.05, nativeSince: null, virtualSince: 0 };
  assert.ok(!selectNativeVoices([...native, waiting], POLICY, 0.19).includes("waiting"));
  assert.ok(!selectNativeVoices([...native, waiting], POLICY, 0.3).includes("waiting"));
  assert.ok(selectNativeVoices([...native, waiting], POLICY, 1.25).includes("waiting"));
  return { minimumResidence: true, priorityHysteresis: true, fairness: true, cap: 24 };
}

export async function arrivalCapNegative(corpus: Corpus, candidate: boolean) {
  const seed = corpus.ticks.flatMap((t) => t.operations).find((o) => o.kind === "start");
  assert.ok(seed?.kind === "start");
  const context = new ControlContext();
  const engine = new AudioEngine({
    context: context.asContext(),
    budget: BUDGET,
    oscillatorModel: "nativeReference",
    virtualization: candidate ? POLICY : false,
  });
  try {
    await engine.enable(0);
    assert.ok(seed.frame.paths.length);
    const outcomes = [];
    for (let i = 0; i < 9; i++) {
      const sourceId = `arrival.${i}`;
      // Repeated real solver route geometry is a synthetic capacity stress expansion,
      // not additional scientific paths or new physics emissions.
      const frame: AcousticFrame = {
        ...structuredClone(seed.frame),
        sourceId,
        directDelayS: 0.5,
        paths: Array.from({ length: 32 }, (_, j) => ({
          ...structuredClone(seed.frame.paths[j % seed.frame.paths.length]!),
          id: `arrival.${i}.${j}`,
          sourceId,
          absoluteDelayS: 0.5,
          relativeDelayS: 0,
        })),
      };
      const voice = {
        ...seed.input,
        sourceId,
        instanceId: sourceId,
        continuous: false,
        durationSeconds: 0.1,
        emissionTimeSeconds: 0,
      };
      outcomes.push(
        engine.restoreVoiceAtCursor(voice, frame, {
          playheadSeconds: 0.1,
          elapsedSinceEmissionSeconds: 0.25,
          remainingDurationSeconds: 0,
          emissionEndElapsedSeconds: 0.1,
        }),
      );
    }
    const peak = engine.getTelemetry();
    assert.equal(peak.internalArrivalGraphsInUse, 256, "original full pending-arrival capacity");
    assert.ok(peak.activePaths <= BUDGET.maxTotalPaths);
    assert.ok(peak.nativeSourceNodes <= peak.nativeCarrierBudget);
    context.currentTime = 2;
    engine.flushControlUpdates();
    assert.equal(
      engine.getTelemetry().nativeSlotsInUse,
      0,
      "retiring arrivals drain by audio clock",
    );
    return { outcomes, peak, drained: engine.getTelemetry() };
  } finally {
    await engine.disposeAsync();
  }
}

export async function compareVoices(corpus: Corpus) {
  const frozen = JSON.stringify(corpus);
  const reference = await replayCorpus(corpus, false),
    candidate = await replayCorpus(corpus, true);
  assert.deepEqual(
    candidate.admissions,
    reference.admissions,
    "same native admissions within original capacity",
  );
  assert.deepEqual(
    candidate.cursors,
    reference.cursors,
    "same logical tick/pitch-integrated cursor",
  );
  assert.equal(
    JSON.stringify(corpus),
    frozen,
    "policies cannot rewrite physics/recording/input corpus",
  );
  return {
    classification:
      "Node/FakeAudioContext scheduling and reachability approximations; no DSP/PCM/CPU/hearing measurement",
    controlCallsDefinition:
      "Count of recorded AudioParam automation API calls; initialization is included in the first tick. Source starts and graph-slot counts are separate. Not total native DSP work.",
    oracle: {
      sameAdmissions: true,
      sameLogicalCursors: true,
      immutableCorpus: true,
      hysteresis: hysteresisOracle(),
    },
    reference,
    candidate,
    overflow: {
      reference: await capacityNegatives(corpus, false),
      candidate: await capacityNegatives(corpus, true),
      interpretation:
        "Extra native virtual admission is intentional. These are rebound copies of a real runtime intent, not additional recorded physics decisions. Reference can reject overflow; candidate cannot rewrite the frozen logical corpus.",
    },
    arrivals: {
      reference: await arrivalCapNegative(corpus, false),
      candidate: await arrivalCapNegative(corpus, true),
    },
    recommendation:
      "KEEP_REFERENCE: no browser PCM or native DSP cost evidence in this Node run; saturation changes native allocation semantics and must remain explicit.",
  };
}
