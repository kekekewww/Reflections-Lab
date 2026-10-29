import test from "node:test";
import assert from "node:assert/strict";
import { RecordingHost } from "../../src/app/recording-host.js";
import type {
  ExperimentRecorderOptions,
  RecordingFrameInput,
} from "../../src/experiments/types.js";

function config(): ExperimentRecorderOptions {
  return {
    runId: "run.host",
    runEpoch: "epoch.host",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
    physicsVersion: "rapier-0.21.0",
    backendVersion: "1.0.0",
    sceneSnapshot: {
      schemaVersion: "1.0.0",
      sceneId: "scene.host",
      sceneRevision: 0,
      units: "SI",
      coordinateSystem: "right-handed-y-up-minus-z-forward",
      seed: 1,
      gravityMps2: [0, -9.81, 0],
      objects: [
        {
          id: "ball",
          shape: "sphere",
          dimensionsM: [1, 1, 1],
          positionM: [0, 1, 0],
          orientationQuaternion: [0, 0, 0, 1],
          mode: "dynamicGravity",
          massKg: 1,
          friction: 0.5,
          restitution: 0.5,
          physicsMaterialId: "metal",
          acousticMaterialId: "wall",
          acousticRole: "dynamicOccluder",
        },
      ],
      sources: [],
      listener: {
        id: "listener",
        positionM: [0, 1, 3],
        orientationQuaternion: [0, 0, 0, 1],
        attachment: "independent",
      },
    },
    sourceConfig: { signal: "sine" },
    behaviorConfig: { gain: 0.2 },
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: [{ id: "wall", absorption: 0.3 }],
  };
}
function frame(tick: number): RecordingFrameInput {
  return {
    tick,
    sceneRevision: 0,
    poses: [
      { objectId: "ball", positionM: [tick / 60, 1, 0], orientationQuaternion: [0, 0, 0, 1] },
    ],
    listener: { id: "listener", positionM: [0, 1, 3], orientationQuaternion: [0, 0, 0, 1] },
    physicsEvents:
      tick === 1
        ? [{ eventId: "impact.host", tick, sequence: 0, objectId: "ball", type: "OnImpact" }]
        : [],
    behaviorDecisions: [],
    audioEvents: [],
  };
}
async function recorded(host: RecordingHost) {
  host.start();
  host.appendFrame(frame(0));
  host.appendFrame(frame(1));
  return host.stop();
}

test("host seals capture atomically and rejects overlapping start while finalizing", async () => {
  const host = new RecordingHost({ getConfig: config });
  host.start();
  host.appendFrame(frame(0));
  host.pause();
  assert.equal(host.appendFrame(frame(1)), false);
  host.resume();
  host.appendFrame(frame(1));
  const stopping = host.stop();
  assert.throws(() => host.start(), { code: "HOST_BUSY" });
  const artifact = await stopping;
  assert.equal(artifact.status, "captured");
  assert.equal(host.getView().recording.state, "finalized");
  assert.equal(host.getView().recording.canReplay, true);
  assert.equal(host.getArtifact()!.artifactSha256, artifact.artifactSha256);
});
test("each host recording obtains a fresh run identity even if config repeats", async () => {
  const host = new RecordingHost({ getConfig: config });
  const first = await recorded(host);
  const second = await recorded(host);
  assert.notEqual(first.runId, second.runId);
});
test("B evaluates the A raw trace using pinned current configuration", async () => {
  const current = config();
  let calls = 0;
  const host = new RecordingHost({
    getConfig: () => current,
    reprocessFrame: async (source, changes) => {
      calls += 1;
      assert.equal((changes.behaviorConfig as { gain: number }).gain, 0.8);
      return {
        behaviorDecisions: [{ tick: source.tick, action: "update", gain: 0.8 }],
        audioEvents: [],
      };
    },
  });
  await recorded(host);
  const a = await host.captureComparison("A");
  current.behaviorConfig = { gain: 0.8 };
  current.sourceConfig = { signal: "sine", gain: 0.8 };
  const b = await host.captureComparison("B");
  assert.equal(calls, a.frameCount);
  assert.equal(b.fingerprints.motionTraceHash, a.fingerprints.motionTraceHash);
  assert.equal(b.fingerprints.physicsEventTraceHash, a.fingerprints.physicsEventTraceHash);
  assert.notEqual(b.fingerprints.profileHash, a.fingerprints.profileHash);
  assert.equal((await host.compare("behavior")).matched, true);
});
test("unavailable or failed reprocessor preserves existing slots", async () => {
  const missing = new RecordingHost({ getConfig: config });
  await recorded(missing);
  const a = await missing.captureComparison("A");
  await assert.rejects(() => missing.captureComparison("B"), { code: "CAPABILITY_UNSUPPORTED" });
  assert.equal(missing.getSlots().A!.artifactSha256, a.artifactSha256);
  assert.equal(missing.getSlots().B, null);
  let fail = false;
  const host = new RecordingHost({
    getConfig: config,
    reprocessFrame: () => {
      if (fail) throw Error("solver failed");
      return { behaviorDecisions: [], audioEvents: [] };
    },
  });
  await recorded(host);
  await host.captureComparison("A");
  const previous = await host.captureComparison("B");
  fail = true;
  await assert.rejects(() => host.captureComparison("B"), /solver failed/);
  assert.equal(host.getSlots().B!.artifactSha256, previous.artifactSha256);
  assert.equal(host.getView().pending, false);
});
test("changed physics remains incompatible and no matched delta is published", async () => {
  const current = config();
  const host = new RecordingHost({
    getConfig: () => current,
    reprocessFrame: () => ({ behaviorDecisions: [], audioEvents: [] }),
  });
  await recorded(host);
  await host.captureComparison("A");
  current.sceneSnapshot.objects[0]!.massKg = 2;
  await host.captureComparison("B");
  const result = await host.compare("acoustic");
  assert.equal(result.matched, false);
  assert(result.mismatches.some((entry) => entry.field === "physicsConfigHash"));
  assert(host.getView().comparison.metrics.every((metric) => metric.value === null));
});
test("interrupt cancels pending candidate without publishing partial B", async () => {
  let resolveGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  let entered!: () => void;
  const enteredGate = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const host = new RecordingHost({
    getConfig: config,
    reprocessFrame: async () => {
      entered();
      await gate;
      return { behaviorDecisions: [], audioEvents: [] };
    },
  });
  await recorded(host);
  await host.captureComparison("A");
  const pending = host.captureComparison("B");
  await enteredGate;
  await host.interrupt("reset");
  resolveGate();
  await assert.rejects(() => pending, { code: "OPERATION_CANCELLED" });
  assert.equal(host.getSlots().B, null);
});
test("host replay seek returns recorded poses without emitting past collision", async () => {
  const host = new RecordingHost({ getConfig: config });
  await recorded(host);
  await host.replay();
  assert.equal(host.nextReplay()!.tick, 0);
  const hit = host.nextReplay()!;
  assert.equal(hit.physicsEvents.length, 1);
  const seek = host.seek(1);
  assert.equal(seek.emitEvents, false);
  assert.notEqual(seek.replayEpoch, hit.replayEpoch);
  assert.equal(host.nextReplay(), null);
  assert.equal(host.getView().recording.state, "finalized");
});

test("changed backend version cannot be relabeled as the baseline solver during B", async () => {
  const current = config();
  const host = new RecordingHost({
    getConfig: () => current,
    reprocessFrame: () => ({ behaviorDecisions: [], audioEvents: [] }),
  });
  await recorded(host);
  await host.captureComparison("A");
  current.backendVersion = "another.solver";
  await assert.rejects(() => host.captureComparison("B"), { code: "INCOMPATIBLE_EXPERIMENTS" });
  assert.equal(host.getSlots().B, null);
});

test("candidate pins configuration before asynchronous processing and ignores later edits", async () => {
  const current = config();
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const enteredGate = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const seen: number[] = [];
  const host = new RecordingHost({
    getConfig: () => current,
    reprocessFrame: async (source, pinned) => {
      entered();
      await gate;
      seen.push((pinned.behaviorConfig as { gain: number }).gain);
      return { behaviorDecisions: [{ tick: source.tick, action: "update" }], audioEvents: [] };
    },
  });
  await recorded(host);
  await host.captureComparison("A");
  current.behaviorConfig = { gain: 0.8 };
  const candidate = host.captureComparison("B");
  await enteredGate;
  current.behaviorConfig = { gain: 0.1 };
  release();
  const b = await candidate;
  assert.deepEqual(seen, [0.8, 0.8]);
  assert.deepEqual(b.configuration.behaviorConfig, { gain: 0.8 });
});
