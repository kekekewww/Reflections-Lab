import assert from "node:assert/strict";
import test from "node:test";
import { AudioEngine } from "../../src/audio/index.js";
import type { AcousticFrame, VoiceInput } from "../../src/audio/types.js";
import { FakeAudioContext, FakeGainNode } from "./fake-context.js";

// These tests inspect native-node lifecycle and scheduling decisions. They do
// not emulate rendered audio, clicks, HRTF output, or device timing.
const assetHash = "c".repeat(64);

function frame(sourceId: string, delaySeconds = 0): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: `pause-fixture-${sourceId}`,
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "pause-control-fixture",
    backendVersion: "1",
    sourceId,
    listenerId: "pause-listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: ["directParameters"],
    modelClass: "numericalApproximation",
    directDelayS: delaySeconds,
    paths: [
      {
        id: `${sourceId}-direct`,
        sourceId,
        listenerId: "pause-listener",
        surfaceIds: [],
        order: 0,
        verticesM: [
          [1, 0, 0],
          [0, 0, 0],
        ],
        lengthM: delaySeconds * 343,
        absoluteDelayS: delaySeconds,
        relativeDelayS: 0,
        arrivalDirection: [1, 0, 0],
        bandGains: [0.5],
      },
    ],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["CONTROL_LIFECYCLE_FIXTURE_ONLY"],
  };
}

function sampleVoice(instanceId: string, overrides: Partial<VoiceInput> = {}): VoiceInput {
  return {
    instanceId,
    sourceId: instanceId,
    generator: {
      kind: "sample",
      asset: { assetId: "pause-pcm", revision: 1, sha256: assetHash },
      loop: true,
      startOffsetSeconds: 0,
    },
    gainLinear: 1,
    pitchSemitones: 0,
    emissionTimeSeconds: 0,
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
    "pause-pcm",
    context.createBuffer(1, 96000, 48000) as unknown as AudioBuffer,
    {
      name: "Original pause lifecycle PCM fixture",
      origin: "generated",
      license: "PROJECT_GENERATED_TEST_FIXTURE",
      sha256: assetHash,
    },
  );
  return { context, engine };
}

function closeTo(actual: number | undefined, expected: number, message: string): void {
  assert.ok(
    actual !== undefined && Math.abs(actual - expected) < 1e-9,
    `${message}: actual=${actual}, expected=${expected}`,
  );
}

test("pause keeps the device clock running and restores a sample cursor without wall-time drift", async () => {
  const ended: string[] = [];
  const { context, engine } = await setup({ onVoiceEnded: (id) => ended.push(id) });
  try {
    engine.playVoice(sampleVoice("loop", { pitchSemitones: 12 }), frame("loop"));
    const original = context.sources()[0]!;
    context.currentTime = 0.25;
    await engine.pause(0.25);
    assert.equal(context.state, "running", "simulation pause must keep AudioContext running");
    assert.equal(
      original.connections.length,
      0,
      "old source must disconnect after the bounded fade",
    );
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.deepEqual(ended, [], "freezing a voice must not end its logical instance");

    assert.throws(
      () =>
        engine.registerBuffer(
          "pause-pcm",
          context.createBuffer(1, 96000, 48000) as unknown as AudioBuffer,
          { name: "replacement", origin: "generated", license: "FIXTURE_ONLY", revision: 2 },
        ),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "ASSET_IN_USE",
    );

    context.currentTime = 100;
    await engine.resume(0.25);
    const restored = context.sources().at(-1)!;
    assert.notEqual(restored, original);
    closeTo(restored.starts[0]?.when, 100, "restored start uses the new audio epoch");
    closeTo(restored.starts[0]?.offset, 0.5, "2x playback cursor freezes at the pause tick");
    assert.equal(restored.buffer, original.buffer, "decoded PCM is reused across epochs");
    assert.equal(engine.getTelemetry().activeVoices, 1);
    assert.deepEqual(ended, []);
  } finally {
    engine.dispose();
  }
});

test("stopping a future emission while paused prevents its admission on resume", async () => {
  const ended: string[] = [];
  const { context, engine } = await setup({ onVoiceEnded: (id) => ended.push(id) });
  try {
    engine.playVoice(sampleVoice("future", { emissionTimeSeconds: 1 }), frame("future"));
    context.currentTime = 0.25;
    await engine.pause(0.25);
    assert.equal(engine.getTelemetry().pendingVoices, 1);
    engine.stopVoice("future");
    engine.stopVoice("future");
    context.currentTime = 10;
    await engine.resume(0.25);
    assert.equal(
      context.sources().length,
      1,
      "canceled future emission must not create a new node",
    );
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(engine.getTelemetry().pendingVoices, 0);
    assert.deepEqual(ended, ["future"], "logical cancellation is reported exactly once");
  } finally {
    engine.dispose();
  }
});

test("an ended sample retains its unarrived path content across pause without repeating its event", async () => {
  const ended: string[] = [];
  const { context, engine } = await setup({ onVoiceEnded: (id) => ended.push(id) });
  try {
    engine.playVoice(
      sampleVoice("impact", { continuous: false, durationSeconds: 0.1 }),
      frame("impact", 0.5),
    );
    context.currentTime = 0.1;
    context.sources()[0]!.finish();
    context.currentTime = 0.15;
    await engine.pause(0.15);
    context.currentTime = 10;
    await engine.resume(0.15);
    assert.equal(engine.getTelemetry().activeVoices, 0, "an ended logical event stays ended");
    assert.equal(engine.getTelemetry().activePaths, 1, "its acoustic content remains scheduled");
    assert.equal(context.sources().length, 2);
    const continuation = context.sources()[1]!;
    closeTo(
      continuation.starts[0]?.offset,
      0,
      "unheard sample content starts at the original cursor",
    );
    closeTo(
      context.delays().at(-1)?.delayTime.value,
      0.5 - 0.15,
      "the unheard onset retains its original distance from the frozen logical pause time",
    );
    assert.deepEqual(
      ended,
      ["impact"],
      "arrival restoration must not redispatch an impact lifecycle",
    );
  } finally {
    engine.dispose();
  }
});

test("stopping a frozen voice removes both its continuation and unarrived path segments", async () => {
  const ended: string[] = [];
  const { context, engine } = await setup({ onVoiceEnded: (id) => ended.push(id) });
  try {
    engine.playVoice(sampleVoice("frozen"), frame("frozen", 0.5));
    context.currentTime = 0.25;
    await engine.pause(0.25);
    engine.stopVoice("frozen");
    context.currentTime = 10;
    await engine.resume(0.25);
    assert.equal(context.sources().length, 1);
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.deepEqual(ended, ["frozen"]);
  } finally {
    engine.dispose();
  }
});

test("pausing while an old same-ID generation retires preserves the current generation", async () => {
  const ended: string[] = [];
  const { context, engine } = await setup({ onVoiceEnded: (id) => ended.push(id) });
  try {
    engine.playVoice(sampleVoice("reused"), frame("reused", 0.5));
    context.currentTime = 0.1;
    engine.stopVoice("reused", 0.01);
    const current = sampleVoice("reused");
    assert.equal(current.generator.kind, "sample");
    if (current.generator.kind !== "sample") throw new Error("sample fixture required");
    current.generator.startOffsetSeconds = 0.4;
    assert.equal(engine.playVoice(current, frame("reused", 0.5)).accepted, true);
    context.currentTime = 0.2;
    await engine.pause(0.2);
    const priorSourceCount = context.sources().length;
    context.currentTime = 10;
    await engine.resume(0.2);
    const main = context
      .sources()
      .slice(priorSourceCount)
      .filter((source) => source.stops.length === 0);
    assert.equal(
      engine.getTelemetry().activeVoices,
      1,
      "the old retiring generation must not replace the current generation's frozen snapshot",
    );
    assert.equal(main.length, 1);
    closeTo(
      main[0]?.starts[0]?.offset,
      0.5,
      "the current generation resumes its own sample cursor",
    );
    assert.deepEqual(
      ended,
      ["reused"],
      "restoring old arrival tails must not end the new generation",
    );
  } finally {
    engine.dispose();
  }
});

test("cache pressure cannot evict frame references pinned by pending and frozen voices", async () => {
  const { context, engine } = await setup({
    budget: { maxVoices: 2, maxSources: 2, maxSourceFrames: 2, maxTotalPaths: 4 },
  });
  try {
    engine.playVoice(sampleVoice("frozen-frame"), frame("frozen-frame"));
    engine.playVoice(
      sampleVoice("pending-frame", { emissionTimeSeconds: 1 }),
      frame("pending-frame"),
    );
    context.currentTime = 0.25;
    await engine.pause(0.25);
    for (let index = 0; index < 12; index++) engine.updateFrame(frame(`unrelated-${index}`));
    assert.ok(engine.getTelemetry().cachedSourceFrames <= 2);
    context.currentTime = 10;
    await engine.resume(0.25);
    assert.equal(engine.getTelemetry().activeVoices, 2, "both protected sources can be restored");
    assert.equal(engine.getTelemetry().droppedVoices, 0);
    assert.equal(engine.getTelemetry().pendingVoices, 0);
  } finally {
    engine.dispose();
  }
});

test("a second pause preserves an arrival whose logical source has already ended", async () => {
  const { context, engine } = await setup();
  try {
    engine.playVoice(
      sampleVoice("twice", { continuous: false, durationSeconds: 0.1 }),
      frame("twice", 0.5),
    );
    context.currentTime = 0.1;
    context.sources()[0]!.finish();
    context.currentTime = 0.15;
    await engine.pause(0.15);
    context.currentTime = 1;
    await engine.resume(0.15);
    assert.equal(engine.getTelemetry().activePaths, 1);
    context.currentTime = 1.05;
    await engine.pause(0.2);
    context.currentTime = 2;
    const priorSourceCount = context.sources().length;
    await engine.resume(0.2);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    const restored = context.sources().slice(priorSourceCount);
    assert.ok(restored.length > 0, "a repeated pause must retain unheard acoustic content");
    const coveredIntervals = restored
      .map((source) => {
        const start = source.starts[0]!;
        return [start.offset!, start.offset! + source.stops[0]! - start.when] as const;
      })
      .sort((left, right) => left[0] - right[0]);
    closeTo(coveredIntervals[0]?.[0], 0, "the original sample beginning is still unheard");
    closeTo(coveredIntervals.at(-1)?.[1], 0.1, "the original sample ending remains scheduled");
    for (let index = 1; index < coveredIntervals.length; index++) {
      closeTo(
        coveredIntervals[index]?.[0],
        coveredIntervals[index - 1]![1],
        "split arrival segments must cover the sample exactly once without a gap or overlap",
      );
    }
    assert.ok(engine.getTelemetry().activePaths > 0);
    assert.ok(engine.getTelemetry().activePaths <= engine.getTelemetry().budget.maxTotalPaths);
    await engine.drainVoices();
    assert.equal(engine.getTelemetry().activePaths, 0);
    assert.equal(engine.getTelemetry().cachedSourceFrames, 0);
    assert.equal(engine.getTelemetry().assetCount, 1);
  } finally {
    engine.dispose();
  }
});

test("a finite sample shorter than its authored attack schedules a reachable envelope peak", async () => {
  const { context, engine } = await setup();
  try {
    engine.playVoice(
      sampleVoice("short", {
        continuous: false,
        durationSeconds: 0.004,
        fadeInSeconds: 0.1,
        fadeOutSeconds: 0.1,
      }),
      frame("short"),
    );
    const source = context.sources()[0]!;
    const contentGain = source.connections[0];
    assert.ok(contentGain instanceof FakeGainNode);
    const envelope = contentGain.connections[0];
    assert.ok(envelope instanceof FakeGainNode);
    const end = source.stops[0]!;
    const peak = envelope.gain.automation.find(
      (event) => event.method === "linearRampToValueAtTime" && event.value === 1,
    );
    assert.ok(
      peak && peak.time > 0 && peak.time < end,
      "a short source must reach nonzero gain before it stops",
    );
    assert.ok(
      envelope.gain.automation.every((event) => event.time <= end),
      "no envelope stage may remain scheduled beyond the finite source lifetime",
    );
  } finally {
    engine.dispose();
  }
});

test("unique completed one-shots release frame cache entries under a small source budget", async () => {
  const { context, engine } = await setup({
    budget: { maxVoices: 2, maxSources: 2, maxSourceFrames: 2 },
  });
  try {
    for (let index = 0; index < 6; index++) {
      const id = `completed-${index}`;
      const now = context.currentTime;
      assert.equal(
        engine.playVoice(
          sampleVoice(id, {
            emissionTimeSeconds: now,
            continuous: false,
            durationSeconds: 0.01,
          }),
          frame(id),
        ).accepted,
        true,
      );
      context.currentTime = now + 0.01;
      context.sources().at(-1)!.finish();
      context.currentTime = now + 0.1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal(engine.getTelemetry().activePaths, 0);
      assert.equal(
        engine.getTelemetry().cachedSourceFrames,
        0,
        "a unique per-shot source must not leave a persistent frame entry",
      );
      assert.equal(engine.getTelemetry().activeSources, 0);
    }
    assert.equal(engine.getTelemetry().droppedVoices, 0);
  } finally {
    engine.dispose();
  }
});
