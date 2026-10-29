import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext, pathsToDestination } from "./fake-context.js";

// Snapshot-restore admission and scheduling checks. These do not render DSP.
const hash = "e".repeat(64);

function frame(sourceId: string, delay = 0.5): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: `restore-${sourceId}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "restore-control-fixture",
    backendVersion: "1",
    sourceId,
    listenerId: "restore-listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delay,
    paths: [
      {
        id: `${sourceId}-direct`,
        sourceId,
        listenerId: "restore-listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: delay * 343,
        absoluteDelayS: delay,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [0.5],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["SNAPSHOT_RESTORE_CONTROL_FIXTURE_ONLY"],
  };
}

function voice(id: string, overrides: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId: id,
    sourceId: id,
    generator: {
      kind: "sample",
      asset: { assetId: "restore-pcm", revision: 1, sha256: hash },
      loop: true,
      startOffsetSeconds: 0,
    },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 5,
    continuous: true,
    fadeInSeconds: 0.01,
    fadeOutSeconds: 0.02,
    priority: 1,
    ...overrides,
  };
}

async function setup(options: ConstructorParameters<typeof AudioEngine>[0] = {}) {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ ...options, context: context.asContext() });
  await engine.enable(0);
  engine.registerBuffer(
    "restore-pcm",
    context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer,
    {
      name: "Original restore PCM fixture",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: hash,
    },
  );
  context.currentTime = 10;
  engine.setEpoch(5, 10);
  return { context, engine };
}

function closeTo(actual: number | undefined, expected: number, message: string): void {
  assert.ok(
    actual !== undefined && Math.abs(actual - expected) < 1e-9,
    `${message}: actual=${actual}, expected=${expected}`,
  );
}

test("cursor restore applies an authored sample offset separately from a constant-pitch playhead", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("pitched-loop", { pitchSemitones: 12 });
    assert.equal(input.generator.kind, "sample");
    if (input.generator.kind !== "sample") throw new Error("sample fixture required");
    input.generator.startOffsetSeconds = 0.125;
    const result = engine.restoreVoiceAtCursor(input, frame(input.sourceId), {
      playheadSeconds: 0.5,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: null,
      restorePendingArrivals: false,
    });
    assert.equal(result.accepted, true);
    assert.equal(context.sources().length, 1);
    const source = context.sources()[0]!;
    closeTo(source.starts[0]?.when, 10, "restore uses the new emission epoch");
    closeTo(
      source.starts[0]?.offset,
      0.625,
      "authored offset is added once to the saved buffer cursor",
    );
    assert.equal(source.playbackRate.value, 2);
    assert.equal(source.stops.length, 0);
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    engine.dispose();
  }
});

test("cursor restore keeps main propagation delay and pending-arrival remaining delay distinct", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("in-flight");
    assert.equal(
      engine.restoreVoiceAtCursor(input, frame(input.sourceId), {
        playheadSeconds: 0.25,
        elapsedSinceEmissionSeconds: 0.25,
        remainingDurationSeconds: null,
        restorePendingArrivals: true,
      }).accepted,
      true,
    );
    assert.equal(context.sources().length, 2);
    const main = context.sources().find((source) => source.stops.length === 0);
    const pending = context.sources().find((source) => source.stops.length > 0);
    assert.ok(main && pending);
    closeTo(main.starts[0]?.offset, 0.25, "main source resumes at the saved cursor");
    closeTo(pending.starts[0]?.offset, 0, "unheard content begins at its original cursor");
    assert.deepEqual(
      context
        .delays()
        .map((delay) => delay.delayTime.value)
        .sort(),
      [0.25, 0.5],
      "the pending onset is 0.25s away while new source emission still propagates for 0.5s",
    );
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.equal(engine.getTelemetry().activePaths, 2);
  } finally {
    engine.dispose();
  }
});

test("an ended one-shot whose final arrival was heard creates no source and repeats no callback", async () => {
  const ended: string[] = [];
  const { context, engine } = await setup({ onVoiceEnded: (id) => ended.push(id) });
  try {
    const input = voice("already-heard", { continuous: false, durationSeconds: 0.1 });
    engine.restoreVoiceAtCursor(input, frame(input.sourceId, 0.1), {
      playheadSeconds: 0.1,
      elapsedSinceEmissionSeconds: 0.5,
      remainingDurationSeconds: 0,
      restorePendingArrivals: true,
    });
    assert.equal(context.sources().length, 0);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.deepEqual(ended, [], "the historical event was already ended before restoration");
  } finally {
    engine.dispose();
  }
});

test("an ended but unarrived one-shot restores only its tail through the acoustic route", async () => {
  const ended: string[] = [];
  const { context, engine } = await setup({ onVoiceEnded: (id) => ended.push(id) });
  try {
    const input = voice("unheard-tail", { continuous: false, durationSeconds: 0.1 });
    assert.equal(
      engine.restoreVoiceAtCursor(input, frame(input.sourceId), {
        playheadSeconds: 0.1,
        elapsedSinceEmissionSeconds: 0.25,
        remainingDurationSeconds: 0,
        restorePendingArrivals: true,
      }).accepted,
      true,
    );
    assert.equal(context.sources().length, 1);
    const tail = context.sources()[0]!;
    closeTo(tail.starts[0]?.offset, 0, "only unheard PCM is reconstructed");
    closeTo(
      tail.stops[0]! - tail.starts[0]!.when,
      0.1,
      "the original one-shot duration is preserved",
    );
    closeTo(
      context.delays()[0]?.delayTime.value,
      0.25,
      "elapsed source time is removed from pending propagation",
    );
    const outputPaths = pathsToDestination(tail, context.destination);
    assert.ok(outputPaths.length > 0);
    assert.ok(
      outputPaths.every((path) => path.some((node) => node.kind === "panner")),
      "an already-ended event must not be replayed on the dry/raw source branch",
    );
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 1);
    assert.deepEqual(ended, []);
  } finally {
    engine.dispose();
  }
});

test("duplicate cursor restoration rejects without allocating another generation or pending segment", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("restore-once");
    const cursor = {
      playheadSeconds: 0.25,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: null,
      restorePendingArrivals: true,
    };
    assert.equal(engine.restoreVoiceAtCursor(input, frame(input.sourceId), cursor).accepted, true);
    const count = context.sources().length;
    const paths = engine.getTelemetry().activePaths;
    assert.equal(engine.restoreVoiceAtCursor(input, frame(input.sourceId), cursor).accepted, false);
    assert.equal(context.sources().length, count);
    assert.equal(engine.getTelemetry().activePaths, paths);
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    engine.dispose();
  }
});

test("duplicate arrival-only restoration cannot replay the same ended logical event twice", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("ended-restore-once", { continuous: false, durationSeconds: 0.1 });
    const cursor = {
      playheadSeconds: 0.1,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: 0,
      restorePendingArrivals: true,
    };
    assert.equal(engine.restoreVoiceAtCursor(input, frame(input.sourceId), cursor).accepted, true);
    assert.equal(engine.restoreVoiceAtCursor(input, frame(input.sourceId), cursor).accepted, false);
    assert.equal(context.sources().length, 1);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 1);
  } finally {
    engine.dispose();
  }
});

test("restored main sources obey the ordinary voice cap without replacing an equal-priority source", async () => {
  const { context, engine } = await setup({ budget: { maxVoices: 1 } });
  try {
    const cursor = {
      playheadSeconds: 0.25,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: null,
      restorePendingArrivals: false,
    };
    assert.equal(
      engine.restoreVoiceAtCursor(voice("admitted"), frame("admitted"), cursor).accepted,
      true,
    );
    assert.equal(
      engine.restoreVoiceAtCursor(voice("overflow"), frame("overflow"), cursor).accepted,
      false,
    );
    assert.equal(context.sources().length, 1);
    assert.equal(engine.getTelemetry().activeVoices, 1);
  } finally {
    engine.dispose();
  }
});

test("ended arrival-only restorations obey the pending-event cap independently of active voices", async () => {
  const { context, engine } = await setup({ budget: { maxPendingEvents: 2, maxTotalPaths: 4 } });
  try {
    const cursor = {
      playheadSeconds: 0.1,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: 0,
      restorePendingArrivals: true,
    };
    for (const id of ["tail-first", "tail-second"]) {
      const input = voice(id, { continuous: false, durationSeconds: 0.1 });
      assert.equal(engine.restoreVoiceAtCursor(input, frame(id), cursor).accepted, true);
    }
    const overflow = voice("tail-overflow", { continuous: false, durationSeconds: 0.1 });
    assert.equal(
      engine.restoreVoiceAtCursor(overflow, frame(overflow.sourceId), cursor).accepted,
      false,
    );
    assert.equal(context.sources().length, 2);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 2);
    assert.equal(engine.getTelemetry().retiringVoices, 2);
  } finally {
    engine.dispose();
  }
});

test("an ended-tail restore cannot bypass stale-frame admission without a cached valid frame", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("stale-tail", { continuous: false, durationSeconds: 0.1 });
    const result = engine.restoreVoiceAtCursor(
      input,
      { ...frame(input.sourceId), stale: true },
      {
        playheadSeconds: 0.1,
        elapsedSinceEmissionSeconds: 0.25,
        remainingDurationSeconds: 0,
        restorePendingArrivals: true,
      },
    );
    assert.equal(
      result.accepted,
      false,
      "history must use the same valid-frame admission as a new source",
    );
    assert.equal(context.sources().length, 0);
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(engine.getTelemetry().cachedSourceFrames, 0);
  } finally {
    engine.dispose();
  }
});

test("an exhausted path budget rejects an arrival-only restore before allocating an inaudible source", async () => {
  const { context, engine } = await setup({ budget: { maxTotalPaths: 1 } });
  try {
    const occupant = voice("existing-path");
    assert.equal(engine.playVoice(occupant, frame(occupant.sourceId)).accepted, true);
    const input = voice("path-overflow-tail", { continuous: false, durationSeconds: 0.1 });
    const result = engine.restoreVoiceAtCursor(input, frame(input.sourceId), {
      playheadSeconds: 0.1,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: 0,
      restorePendingArrivals: true,
    });
    assert.equal(result.accepted, false);
    assert.equal(
      context.sources().length,
      1,
      "a rejected restore leaves the original source generation intact",
    );
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.equal(engine.getTelemetry().retiringVoices, 0);
    assert.equal(engine.getTelemetry().activePaths, 1);
  } finally {
    engine.dispose();
  }
});

test("a finite one-shot cursor cannot request an indefinite native loop", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("finite-null-cursor", { continuous: false, durationSeconds: 0.1 });
    const result = engine.restoreVoiceAtCursor(input, frame(input.sourceId), {
      playheadSeconds: 0.05,
      elapsedSinceEmissionSeconds: 0.05,
      remainingDurationSeconds: null,
      restorePendingArrivals: false,
    });
    assert.equal(result.accepted, false);
    assert.equal(context.sources().length, 0);
    assert.equal(engine.getTelemetry().activeVoices, 0);
  } finally {
    engine.dispose();
  }
});

test("an explicit original emission end clips restored history before any post-stop content", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("early-stopped-tail", { continuous: false, durationSeconds: 0.6 });
    assert.equal(
      engine.restoreVoiceAtCursor(input, frame(input.sourceId), {
        playheadSeconds: 0.1,
        elapsedSinceEmissionSeconds: 0.25,
        remainingDurationSeconds: 0,
        emissionEndElapsedSeconds: 0.1,
        restorePendingArrivals: true,
      }).accepted,
      true,
    );
    assert.equal(context.sources().length, 1);
    const tail = context.sources()[0]!;
    closeTo(tail.starts[0]?.offset, 0, "the surviving history begins at the original sample start");
    closeTo(
      tail.stops[0]! - tail.starts[0]!.when,
      0.1,
      "restoration cannot synthesize the 0.15s interval after the actual source end",
    );
    closeTo(
      context.delays()[0]?.delayTime.value,
      0.25,
      "unheard history keeps its remaining propagation",
    );
    assert.equal(engine.getTelemetry().activeVoices, 0);
  } finally {
    engine.dispose();
  }
});

test("a retiring finite source exposes its final cursor while its acoustic arrivals are pending", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("retiring-cursor", { continuous: false, durationSeconds: 0.1 });
    engine.playVoice(input, frame(input.sourceId));
    context.currentTime = 10.1;
    context.sources()[0]!.finish();
    const cursor = engine.getVoiceCursor(input.instanceId, 5.25);
    assert.ok(cursor, "the pending acoustic tail still has an identifiable logical source cursor");
    closeTo(cursor.playheadSeconds, 0.1, "sample playhead stops at the finite emission end");
    closeTo(
      cursor.elapsedSinceEmissionSeconds,
      0.25,
      "arrival aging uses the original emission clock",
    );
    closeTo(cursor.emissionEndElapsedSeconds, 0.1, "the original source end remains explicit");
    assert.equal(cursor.remainingDurationSeconds, 0);
  } finally {
    engine.dispose();
  }
});

test("a frozen ended source retains the same original emission-end metadata", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("frozen-ended-cursor", { continuous: false, durationSeconds: 0.1 });
    engine.playVoice(input, frame(input.sourceId));
    context.currentTime = 10.1;
    context.sources()[0]!.finish();
    context.currentTime = 10.25;
    await engine.pause(5.25);
    const cursor = engine.getVoiceCursor(input.instanceId, 5.25);
    assert.ok(cursor);
    closeTo(
      cursor.emissionEndElapsedSeconds,
      0.1,
      "pausing must not erase the finite end used to clip pending-arrival history",
    );
    closeTo(
      cursor.elapsedSinceEmissionSeconds,
      0.25,
      "the frozen emission clock stays at its logical tick",
    );
    assert.equal(cursor.remainingDurationSeconds, 0);
  } finally {
    engine.dispose();
  }
});

test("cursor getters carry integrated playhead and original elapsed time across restore and pause", async () => {
  const { context, engine } = await setup();
  try {
    const input = voice("cursor-carry", { pitchSemitones: 12 });
    engine.restoreVoiceAtCursor(input, frame(input.sourceId), {
      playheadSeconds: 0.5,
      elapsedSinceEmissionSeconds: 0.25,
      remainingDurationSeconds: null,
      restorePendingArrivals: false,
    });
    context.currentTime = 10.1;
    const beforePause = engine.getVoiceCursor(input.instanceId, 5.1);
    assert.ok(beforePause);
    closeTo(beforePause.playheadSeconds, 0.7, "the 2x source advances 0.2 source seconds");
    closeTo(
      beforePause.elapsedSinceEmissionSeconds,
      0.35,
      "the original clock advances 0.1 logical seconds",
    );
    await engine.pause(5.1);
    context.currentTime = 30;
    const frozen = engine.getVoiceCursor(input.instanceId, 5.1);
    assert.ok(frozen);
    closeTo(frozen.playheadSeconds, 0.7, "device wall time does not move a frozen cursor");
    closeTo(
      frozen.elapsedSinceEmissionSeconds,
      0.35,
      "the frozen original emission clock is retained",
    );
    await engine.resume(5.1);
    context.currentTime = 30.2;
    const afterResume = engine.getVoiceCursor(input.instanceId, 5.3);
    assert.ok(afterResume);
    closeTo(afterResume.playheadSeconds, 1.1, "playhead carries across the native source restart");
    closeTo(
      afterResume.elapsedSinceEmissionSeconds,
      0.55,
      "elapsed time is not reset to the resume epoch",
    );
    assert.equal(afterResume.remainingDurationSeconds, null);
  } finally {
    engine.dispose();
  }
});

test("valid submillisecond restore remainders and arrival segments retain their exact backend duration", async () => {
  const { context, engine } = await setup();
  try {
    const remaining = voice("subms-main", { continuous: false, durationSeconds: 0.1 });
    assert.doesNotThrow(() => {
      assert.equal(
        engine.restoreVoiceAtCursor(remaining, frame(remaining.sourceId), {
          playheadSeconds: 0.0995,
          elapsedSinceEmissionSeconds: 0.0995,
          remainingDurationSeconds: 0.0005,
          restorePendingArrivals: false,
        }).accepted,
        true,
      );
    });
    const main = context.sources()[0]!;
    closeTo(
      main.stops[0]! - main.starts[0]!.when,
      0.0005,
      "validation must not round a valid restored remainder up to the authored-duration minimum",
    );

    const tailInput = voice("subms-arrival", { continuous: false, durationSeconds: 0.1 });
    assert.doesNotThrow(() => {
      assert.equal(
        engine.restoreVoiceAtCursor(tailInput, frame(tailInput.sourceId), {
          playheadSeconds: 0.1,
          elapsedSinceEmissionSeconds: 0.5995,
          remainingDurationSeconds: 0,
          restorePendingArrivals: true,
        }).accepted,
        true,
      );
    });
    assert.equal(context.sources().length, 2);
    const tail = context.sources()[1]!;
    closeTo(
      tail.starts[0]?.offset,
      0.0995,
      "the last unheard half millisecond is selected exactly",
    );
    closeTo(
      tail.stops[0]! - tail.starts[0]!.when,
      0.0005,
      "a reconstructed arrival segment uses its actual duration",
    );
    assert.throws(
      () =>
        engine.playVoice(
          voice("invalid-authored-subms", {
            continuous: false,
            durationSeconds: 0.0005,
          }),
          frame("invalid-authored-subms"),
        ),
      "new authored one-shots must still obey the separate 1ms minimum",
    );
    assert.equal(context.sources().length, 2);
  } finally {
    engine.dispose();
  }
});
