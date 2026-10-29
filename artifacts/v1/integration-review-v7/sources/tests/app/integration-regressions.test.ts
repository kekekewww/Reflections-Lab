import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import { PhysicsWorld } from "../../src/physics/index.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { LabAction } from "../../src/ui/contracts.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import type { AssetStagingContext } from "../../src/app/asset-host.js";
import { BlobStore } from "../../src/persistence/blob-store.js";
import { verifyRecording } from "../../src/experiments/index.js";
import { ExperimentRecorder, recordingFingerprints } from "../../src/experiments/recorder.js";
import { sha256Canonical } from "../../src/experiments/hash.js";
import type { RecordingArtifact } from "../../src/experiments/types.js";
import type { AgentSessionView } from "../../src/app/agent-session.js";
import type { ExperimentToolResult } from "../../src/app/experiment-tools.js";

const STEP = 1 / 60;
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
async function fixture(run: (app: LabRuntime) => Promise<void>) {
  const app = await LabRuntime.create({
    storage: memory(),
    useWorker: false,
    assetStagingContext: stagingContext,
  });
  try {
    await run(app);
  } finally {
    app.dispose();
  }
}
/** Decoding/counts test adapter only; this does not provide native DSP evidence. */
function stagingContext(sampleRate: number): AssetStagingContext {
  const context = new FakeAudioContext();
  Object.defineProperty(context, "sampleRate", { value: sampleRate });
  return {
    sampleRate,
    createBuffer: context.createBuffer.bind(context) as AssetStagingContext["createBuffer"],
    decodeAudioData: (async (bytes: ArrayBuffer) => {
      const wave = new DataView(bytes);
      const channels = wave.getUint16(22, true),
        encodedRate = wave.getUint32(24, true);
      const frames = wave.getUint32(40, true) / wave.getUint16(32, true);
      return context.createBuffer(
        channels,
        Math.round((frames * sampleRate) / encodedRate),
        sampleRate,
      );
    }) as AssetStagingContext["decodeAudioData"],
  };
}
async function command(app: LabRuntime, action: LabAction) {
  await app.dispatch(action);
  assert.equal(app.getSnapshot().error, "", `command ${action.type} must succeed`);
}
async function steps(app: LabRuntime, count: number) {
  for (let index = 0; index < count; index++) {
    app.advance(STEP);
    // Allow actual asynchronous acoustic delivery; never fake a solved frame.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
function close(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} != ${expected}`);
}
async function referenceHeights(scene: SceneSpec, count: number) {
  const world = await PhysicsWorld.create(scene);
  try {
    world.resume();
    return Array.from(
      { length: count },
      () => world.step().poses.find((pose) => pose.objectId === "ball")!.positionMetres[1],
    );
  } finally {
    world.dispose();
  }
}

test("integration: invalid author edits keep running state and do not create undo history", async () => {
  await fixture(async (app) => {
    const scene = app.getSceneDocument(),
      behaviors = app.getBehaviorDocument();
    await command(app, { type: "run" });
    await steps(app, 3);
    await app.dispatch({ type: "patchObject", objectId: "ball", patch: { massKg: -10 } });
    const tick = app.getSnapshot().tick;
    assert.ok(app.getSnapshot().error);
    assert.deepEqual(app.getSceneDocument(), scene);
    assert.deepEqual(app.getBehaviorDocument(), behaviors);
    assert.equal(app.getSnapshot().simulationState, "running");
    assert.equal(app.getSnapshot().canUndo, false);
    await steps(app, 1);
    await command(app, { type: "pause" });
    assert.equal(app.getSnapshot().tick, tick + 1);
  });
});

test("integration: author undo and redo retain object IDs with monotonically increasing revisions", async () => {
  await fixture(async (app) => {
    const initial = app.getSceneDocument();
    await command(app, { type: "patchObject", objectId: "ball", patch: { massKg: 5 } });
    const edited = app.getSceneDocument();
    assert.equal(edited.sceneRevision, initial.sceneRevision + 1);
    await command(app, { type: "undo" });
    const undone = app.getSceneDocument();
    assert.deepEqual(undone.objects, initial.objects);
    assert.ok(undone.sceneRevision > edited.sceneRevision);
    await command(app, { type: "redo" });
    const redone = app.getSceneDocument();
    assert.deepEqual(redone.objects, edited.objects);
    assert.ok(redone.sceneRevision > undone.sceneRevision);
    const binding = app.getBehaviorDocument().bindings.find((value) => value.objectId === "ball")!;
    assert.equal(binding.objectId, "ball");
    await command(app, { type: "run" });
    await steps(app, 3);
  });
});

test("integration: geometry replacement, reset and undo keep behavior generation pins usable", async () => {
  await fixture(async (app) => {
    const generation = () =>
      app.getBehaviorDocument().bindings.find((value) => value.objectId === "ball")!
        .objectGeneration;
    const initial = generation();
    await command(app, {
      type: "patchObject",
      objectId: "ball",
      patch: { dimensionsM: [0.8, 0.8, 0.8] },
    });
    assert.ok(generation() > initial, "replacing a Rapier body must update its binding generation");
    await command(app, { type: "addRule", objectId: "ball", trigger: "AlwaysOn" });
    await command(app, { type: "run" });
    await steps(app, 3);
    await command(app, { type: "pause" });
    assert.ok(
      app
        .getSnapshot()
        .events.some((event) => event.objectId === "ball" && event.type === "AlwaysOn"),
    );
    const old = generation();
    await command(app, { type: "reset" });
    assert.ok(generation() > old);
    await command(app, { type: "run" });
    await steps(app, 3);
    await command(app, { type: "pause" });
    assert.ok(
      app
        .getSnapshot()
        .events.some((event) => event.objectId === "ball" && event.type === "AlwaysOn"),
    );
    await command(app, { type: "undo" });
    await command(app, { type: "run" });
    await steps(app, 2);
  });
});

test("integration: workspace navigation preserves the running simulation and recording", async () => {
  await fixture(async (app) => {
    await command(app, { type: "recordToggle" });
    await steps(app, 5);
    for (const workspace of ["simulation", "analysis", "scene"] as const) {
      await command(app, { type: "workspace", workspace });
      const previous = app.getSnapshot().tick;
      assert.equal(
        app.getSnapshot().simulationState,
        "running",
        "workspace is independent of transport",
      );
      assert.equal(app.getSnapshot().recording.state, "recording");
      await steps(app, 2);
      // A public snapshot is published by Pause and must show the two continued steps.
      await command(app, { type: "pause" });
      assert.equal(app.getSnapshot().tick, previous + 2);
      await command(app, { type: "run" });
    }
    await command(app, { type: "recordToggle" });
    assert.equal(app.getSnapshot().recording.state, "finalized");
  });
});

test("integration: replay starts on captured content and advances authoritative pose and time", async () => {
  await fixture(async (app) => {
    const poses = await referenceHeights(app.getSceneDocument(), 18);
    await command(app, { type: "recordToggle" });
    for (let index = 0; index < 18; index++) {
      await steps(app, 1);
    }
    await command(app, { type: "recordToggle" });
    await command(app, { type: "pause" });
    await command(app, { type: "replay" });
    await steps(app, 1);
    await command(app, { type: "selectObject", objectId: "ball" });
    close(app.getPose("ball")!.positionM[1], poses[0]!, "first replay pose");
    assert.equal(
      app.getSnapshot().tick,
      1,
      "transport must expose replay tick rather than the live world tick",
    );
    close(app.getSnapshot().simTimeSeconds, STEP, "first replay time");
    await steps(app, 10);
    await command(app, { type: "selectObject", objectId: "ball" });
    close(app.getPose("ball")!.positionM[1], poses[10]!, "eleventh replay pose");
    assert.equal(app.getSnapshot().tick, 11);
  });
});

test("integration: seek uses time relative to the capture even when recording starts late", async () => {
  await fixture(async (app) => {
    const reference = await referenceHeights(app.getSceneDocument(), 21);
    await command(app, { type: "run" });
    await steps(app, 20);
    await command(app, { type: "recordToggle" });
    await steps(app, 1);
    const first = reference[20]!;
    await steps(app, 9);
    await command(app, { type: "recordToggle" });
    await command(app, { type: "replay" });
    await command(app, { type: "seek", timeSeconds: 0 });
    close(app.getPose("ball")!.positionM[1], first, "zero offset means first captured pose");
    assert.equal(app.getSnapshot().recording.replayTimeSeconds, 0);
    assert.equal(app.getSnapshot().tick, 21);
  });
});

test("integration: real sound proposal stages without mutation and Apply/Undo update the live host", async () => {
  await fixture(async (app) => {
    const initialScene = app.getSceneDocument(),
      initial = app.getBehaviorDocument();
    await command(app, { type: "submitPrompt", prompt: "ball 碰撞音效小聲" });
    assert.equal(app.getSnapshot().ai.mode, "offline");
    assert.equal(app.getSnapshot().ai.status, "preview");
    assert.equal(app.getSnapshot().ai.canApply, true);
    assert.deepEqual(app.getBehaviorDocument(), initial, "Preview cannot commit a model proposal");
    await command(app, { type: "applyAI" });
    const next = app.getBehaviorDocument();
    assert.equal(next.revision, initial.revision + 1);
    assert.equal(
      next.profiles
        .find((profile) => profile.profileId === "profile.interactive-tone")!
        .rules.find((rule) => rule.ruleId === "rule.impact")!.gainLinear,
      0.1,
    );
    assert.deepEqual(app.getSceneDocument(), initialScene);
    await command(app, { type: "undo" });
    for (const profile of initial.profiles) {
      assert.deepEqual(
        app.getBehaviorDocument().profiles.find((value) => value.profileId === profile.profileId)!
          .rules,
        profile.rules,
      );
    }
    assert.ok(app.getBehaviorDocument().revision > next.revision);
    await command(app, { type: "run" });
    await steps(app, 50);
    await command(app, { type: "pause" });
    assert.ok(
      app
        .getSnapshot()
        .events.some((event) => event.type === "OnImpact" && event.ruleId === "rule.impact"),
      "the restored profile must execute against real collision events",
    );
  });
});

test("integration: AI RunSimulation returns a bounded result backed by actual solver steps and a persisted artifact", async (t) => {
  const blobs = new BlobStore({ indexedDB: null }),
    saved: RecordingArtifact[] = [];
  const persist = blobs.saveRecording.bind(blobs);
  t.mock.method(blobs, "saveRecording", async (artifact: RecordingArtifact) => {
    const receipt = await persist(artifact);
    saved.push(structuredClone(artifact));
    return receipt;
  });
  const app = await LabRuntime.create({
    storage: memory(),
    useWorker: false,
    blobStore: blobs,
    assetStagingContext: stagingContext,
  });
  try {
    const before = app.getSceneDocument();
    await command(app, { type: "submitPrompt", prompt: "執行模擬" });
    const ai = app.getSnapshot().ai as AgentSessionView;
    assert.equal(ai.mode, "offline");
    assert.equal(ai.status, "idle");
    assert.equal(ai.canApply, false);
    const entry = ai.toolResults![0]!;
    assert.equal(entry.tool, "RunSimulation");
    assert.equal(entry.status, "completed");
    assert.equal(entry.provenance.label, "OFFLINE_DETERMINISTIC");
    const result = entry.result as ExperimentToolResult;
    assert.equal(result.state, "succeeded");
    assert.equal(result.error, null);
    assert.ok(result.usage.solverSteps > 0 && result.usage.solverSteps <= 30 * 60);
    assert.equal(result.usage.actualCostUsd, 0);
    assert.ok(result.artifactIds.length > 0 && result.artifactIds.length <= 8);
    assert.ok(result.artifactIds.every((id) => /^[a-z][a-z0-9._-]{0,63}$/.test(id)));
    assert.ok(new TextEncoder().encode(JSON.stringify(result)).byteLength <= 64 * 1024);
    assert.equal(
      saved.length,
      1,
      "successful tool output must reference an actual persisted recording",
    );
    const artifact = saved[0]!;
    await verifyRecording(artifact);
    assert.equal(artifact.runId, result.runId);
    assert.equal(artifact.frameCount - 1, result.usage.solverSteps);
    assert.equal((artifact.endTick! - artifact.startTick!) * artifact.configuration.fixedDtS, 3);
    assert.ok(
      artifact.frames.at(-1)!.poses.find((pose) => pose.objectId === "ball")!.positionM[1] <
        artifact.frames[0]!.poses.find((pose) => pose.objectId === "ball")!.positionM[1],
    );
    assert.deepEqual(await blobs.loadRecording(artifact.runId, artifact.artifactSha256), artifact);
    assert.deepEqual(
      app.getSceneDocument(),
      before,
      "the tool's isolated solver cannot mutate the live Scene",
    );
    assert.equal(app.getSnapshot().tick, 0);
    assert.equal(app.getSnapshot().monitor.state, "blocked");
  } finally {
    app.dispose();
    blobs.close();
  }
});

test("integration: pause during replay freezes the replay cursor until explicit resume", async () => {
  await fixture(async (app) => {
    await command(app, { type: "recordToggle" });
    await steps(app, 15);
    await command(app, { type: "recordToggle" });
    await command(app, { type: "replay" });
    await steps(app, 2);
    await command(app, { type: "pause" });
    const pose = app.getPose("ball"),
      time = app.getSnapshot().recording.replayTimeSeconds;
    await steps(app, 5);
    await command(app, { type: "selectObject", objectId: "ball" });
    assert.deepEqual(app.getPose("ball"), pose);
    assert.equal(app.getSnapshot().recording.replayTimeSeconds, time);
    await command(app, { type: "run" });
    await steps(app, 2);
    await command(app, { type: "selectObject", objectId: "ball" });
    assert.notDeepEqual(app.getPose("ball"), pose, "resume must continue recorded motion");
  });
});

test("integration: leaving FPS restores the authored pinned listener rather than committing the head pose", async () => {
  await fixture(async (app) => {
    const pinned = app.getSceneDocument().listener;
    await command(app, { type: "enterFPS" });
    await command(app, { type: "pointerLockChanged", locked: true });
    await command(app, { type: "run" });
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: true });
    await steps(app, 12);
    await app.dispatch({ type: "inputKey", code: "KeyW", pressed: false });
    assert.notDeepEqual(
      app.getFPSCamera()!.positionM,
      pinned.positionM,
      "fixture must actually move the FPS player",
    );
    await command(app, { type: "exitFPS" });
    assert.deepEqual(app.getSceneDocument().listener, pinned);
    assert.deepEqual(app.getSnapshot().listener.positionM, pinned.positionM);
  });
});

test("integration: completed capture remains traceable in the exported project manifest", async () => {
  await fixture(async (app) => {
    await command(app, { type: "recordToggle" });
    await steps(app, 5);
    await command(app, { type: "recordToggle" });
    const project = JSON.parse(app.exportProject()) as {
      recordings: { status: string; frameCount: number; sha256: string }[];
    };
    assert.equal(
      project.recordings.length,
      1,
      "a completed run must survive save/export as an externalArtifact reference",
    );
    assert.equal(project.recordings[0]!.status, "captured");
    assert.equal(project.recordings[0]!.frameCount, 5);
    assert.match(project.recordings[0]!.sha256, /^[a-f0-9]{64}$/);
  });
});

test("integration: behavior B reevaluates A raw trace with the changed rules instead of copying A decisions", async () => {
  await fixture(async (app) => {
    await command(app, { type: "recordToggle" });
    await steps(app, 42);
    await command(app, { type: "recordToggle" });
    await command(app, { type: "captureComparison", slot: "A" });
    const a = app.getComparisonArtifacts().A!;
    assert.ok(
      a.frames.some((frame) => frame.audioEvents.some((event) => event.ruleId === "rule.always")),
      "A must actually contain an evaluated continuous event",
    );
    await command(app, {
      type: "patchRule",
      objectId: "speaker",
      ruleId: "rule.always",
      patch: { enabled: false },
    });
    await command(app, { type: "captureComparison", slot: "B" });
    const b = app.getComparisonArtifacts().B!;
    assert.equal(b.fingerprints.motionTraceHash, a.fingerprints.motionTraceHash);
    assert.equal(b.fingerprints.physicsEventTraceHash, a.fingerprints.physicsEventTraceHash);
    assert.notEqual(b.fingerprints.profileHash, a.fingerprints.profileHash);
    assert.ok(
      b.frames.every((frame) => frame.audioEvents.every((event) => event.ruleId !== "rule.always")),
      "disabled B rule cannot reuse A's emitted events",
    );
    assert.notDeepEqual(
      b.frames.map((frame) => frame.behaviorDecisions),
      a.frames.map((frame) => frame.behaviorDecisions),
      "the host must execute a fresh stateful evaluator for B",
    );
    await command(app, { type: "compare", kind: "behavior" });
    assert.match(app.getSnapshot().comparison.status, /固定條件相符/);
  });
});

test("integration: captured impact acoustics use the event contact emitter at the same authoritative tick", async () => {
  await fixture(async (app) => {
    await command(app, { type: "recordToggle" });
    await steps(app, 55);
    await command(app, { type: "recordToggle" });
    const artifact = app.getRecordingArtifact()!;
    const impacts = artifact.frames.flatMap((frame) =>
      frame.audioEvents
        .filter((event) => event.trigger.type === "OnImpact")
        .map((event) => ({ frame, event })),
    );
    assert.ok(impacts.length > 0, "fixture must contain a real evaluated impact");
    for (const { frame, event } of impacts) {
      const acoustic = frame.acousticFrames.find((value) => value.sourceId === event.instanceId);
      assert.ok(
        acoustic,
        "captured audio event must resolve through its own actual acoustic route",
      );
      assert.equal(acoustic.poseTick, frame.tick);
      assert.equal(acoustic.sceneRevision, frame.sceneRevision);
      const path = acoustic.paths.find((value) => value.order === 0);
      assert.ok(path, "the default scene has an unobstructed contact/listener segment");
      assert.deepEqual(
        path.verticesM[0],
        event.positionMetres,
        "propagation begins at the contact emitter rather than a decorative/COM preview",
      );
    }
  });
});

test("integration: late-start acoustic B preserves already active continuous content state", async () => {
  await fixture(async (app) => {
    await command(app, { type: "run" });
    await steps(app, 20);
    await command(app, { type: "recordToggle" });
    await steps(app, 5);
    await command(app, { type: "recordToggle" });
    await command(app, { type: "captureComparison", slot: "A" });
    await command(app, { type: "captureComparison", slot: "B" });
    const { A: a, B: b } = app.getComparisonArtifacts();
    const firstA = a!.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
    const firstB = b!.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
    assert.equal(firstB.stateInitializationPolicy, "restoredPreStepSnapshot");
    const continuousA = firstA.voiceIntents.find((voice) => voice.event.objectId === "speaker")!;
    const continuousB = firstB.voiceIntents.find((voice) => voice.event.objectId === "speaker")!;
    assert.equal(
      continuousA.action,
      "update",
      "A must begin with an already active continuous source",
    );
    assert.equal(
      continuousB.action,
      continuousA.action,
      "unchanged acoustic B must preserve the pre-capture source state, not start its content again",
    );
    assert.equal(
      continuousB.event.instanceId,
      continuousA.event.instanceId,
      "acoustic-only reprocessing retains the same logical source instance",
    );
    const instanceA = firstA.runtimeSnapshot.state.instances.find(
      (instance) => instance.instanceId === continuousA.event.instanceId,
    )!;
    const instanceB = firstB.runtimeSnapshot.state.instances.find(
      (instance) => instance.instanceId === continuousB.event.instanceId,
    )!;
    assert.equal(instanceB.startedAtTick, instanceA.startedAtTick);
    close(instanceB.playheadSeconds, instanceA.playheadSeconds, "acoustic B content playhead");
    assert.equal(b!.fingerprints.motionTraceHash, a!.fingerprints.motionTraceHash);
    assert.equal(b!.fingerprints.sourceSignalHash, a!.fingerprints.sourceSignalHash);
    await command(app, { type: "compare", kind: "acoustic" });
    assert.match(app.getSnapshot().comparison.status, /固定條件相符/);
  });
});

test("integration control graph: enabling audio while paused never starts a run or duplicate continuous event", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, { type: "enableAudio" });
      await command(app, { type: "enableAudio" });
      assert.equal(app.getSnapshot().tick, 0);
      assert.equal(app.getSnapshot().simulationState, "ready");
      assert.equal(contexts[0]!.sources().length, 0, "Enable is independent of Run/Resume");
      await command(app, { type: "run" });
      await steps(app, 5);
      const starts = contexts[0]!.sources().filter((source) => source.kind === "oscillator");
      assert.equal(starts.length, 1, "the live AlwaysOn source starts exactly once");
      await command(app, { type: "pause" });
      const tick = app.getSnapshot().tick;
      await command(app, { type: "enableAudio" });
      await steps(app, 3);
      assert.equal(app.getSnapshot().tick, tick);
      await command(app, { type: "run" });
      await steps(app, 5);
      await command(app, { type: "pause" });
      assert.equal(
        app.getSnapshot().events.filter((event) => event.type === "AlwaysOn").length,
        1,
        "the same logical continuous instance survives pause/resume",
      );
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration control graph: audio listener follows the authoritative pinned position and orientation", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      const half = Math.SQRT1_2;
      await command(app, {
        type: "patchListener",
        positionM: [1, 1.8, 3],
        orientationQuaternion: [0, half, 0, half],
      });
      await command(app, { type: "enableAudio" });
      await command(app, { type: "run" });
      await steps(app, 4);
      const listener = contexts[0]!.listener;
      close(listener.positionX.value, 1, "audio listener x");
      close(listener.positionY.value, 1.8, "audio listener y");
      close(listener.positionZ.value, 3, "audio listener z");
      close(listener.forwardX.value, -1, "audio listener -Z rotated by authored quaternion");
      close(listener.forwardZ.value, 0, "audio listener rotated z");
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration control graph: enabling audio again preserves imported trusted assets for authoring", async () => {
  const previous = globalThis.AudioContext;
  class Context extends FakeAudioContext {
    async decodeAudioData() {
      return this.createBuffer(1, 4800, 48000);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, { type: "enableAudio" });
      // Valid 4800-frame / 48 kHz / mono PCM16 silence. The decoder remains a
      // control-graph fake; this case verifies registry retention, not native DSP.
      const bytes = new ArrayBuffer(44 + 4800 * 2);
      const wave = new DataView(bytes);
      const ascii = (offset: number, text: string) => {
        for (let index = 0; index < text.length; index++)
          wave.setUint8(offset + index, text.charCodeAt(index));
      };
      ascii(0, "RIFF");
      wave.setUint32(4, bytes.byteLength - 8, true);
      ascii(8, "WAVE");
      ascii(12, "fmt ");
      wave.setUint32(16, 16, true);
      wave.setUint16(20, 1, true);
      wave.setUint16(22, 1, true);
      wave.setUint32(24, 48000, true);
      wave.setUint32(28, 96000, true);
      wave.setUint16(32, 2, true);
      wave.setUint16(34, 16, true);
      ascii(36, "data");
      wave.setUint32(40, 9600, true);
      const file = new File([bytes], "synthetic-test.wav", {
        type: "audio/wav",
      });
      await command(app, { type: "importAudio", file, rightsConfirmed: true });
      const imported = app.getSnapshot().assets.find((asset) => asset.name === file.name)!;
      assert.ok(imported, "decoded test import must be visible");
      await command(app, { type: "enableAudio" });
      await command(app, {
        type: "patchRule",
        objectId: "ball",
        ruleId: "rule.impact",
        patch: { generator: "sample", assetId: imported.id },
      });
      const rule = app
        .getBehaviorDocument()
        .profiles.find((profile) => profile.profileId === "profile.interactive-tone")!
        .rules.find((value) => value.ruleId === "rule.impact")!;
      assert.equal(rule.generator.kind, "sample");
      assert.equal(
        app.getBehaviorDocument().assets.find((asset) => asset.assetId === imported.id)!.sha256
          .length,
        64,
      );
      const project = JSON.parse(app.exportProject()) as { assets: { assetId: string }[] };
      assert.ok(project.assets.some((asset) => asset.assetId === imported.id));
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration control graph: recorded-output replay schedules captured content after draining live voices", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, { type: "enableAudio" });
      await command(app, { type: "recordToggle" });
      for (let tick = 0; tick < 5; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      await command(app, { type: "recordToggle" });
      const first = app.getRecordingArtifact()!.frames[0]!
        .behaviorSnapshot as RecordedBehaviorSnapshot;
      assert.ok(
        first.voiceIntents.some(
          (voice) => voice.action === "start" && voice.event.objectId === "speaker",
        ),
      );
      const liveSourceCount = contexts[0]!.sources().length;
      assert.ok(liveSourceCount > 0, "the original run must have a real control-graph source");
      await command(app, { type: "replay" });
      for (let tick = 0; tick < 2; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      await command(app, { type: "selectObject", objectId: "speaker" });
      assert.ok(
        contexts[0]!.sources().length > liveSourceCount,
        "Replay must schedule saved voice content after the old run is drained",
      );
      assert.ok(
        app.getSnapshot().monitor.activeVoices > 0,
        "motion-only playback must not masquerade as recorded-output audio replay",
      );
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration control graph: stopping replay restores the suspended live instance and source cursor on Run", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, { type: "enableAudio" });
      await command(app, { type: "recordToggle" });
      for (let tick = 0; tick < 8; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      await command(app, { type: "recordToggle" });
      const original = app.getRecordingArtifact()!.frames.at(-1)!
        .behaviorSnapshot as RecordedBehaviorSnapshot;
      const voice = original.runtimeSnapshot.state.instances.find(
        (instance) => instance.objectId === "speaker",
      )!;
      const cursor = original.voiceCursors![voice.instanceId]!;
      assert.ok(cursor, "capture must include the live AudioEngine source cursor");
      const liveTick = app.getSnapshot().tick;
      await command(app, { type: "replay" });
      for (let tick = 0; tick < 2; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      await command(app, { type: "stopReplay" });
      assert.equal(app.getSnapshot().tick, liveTick);
      assert.equal(app.getSnapshot().simulationState, "paused");
      await command(app, { type: "run" });
      await command(app, { type: "recordToggle" });
      contexts[0]!.currentTime += STEP;
      await steps(app, 1);
      await command(app, { type: "recordToggle" });
      const resumed = app.getRecordingArtifact()!.frames[0]!
        .behaviorSnapshot as RecordedBehaviorSnapshot;
      const update = resumed.voiceIntents.find((intent) => intent.event.objectId === "speaker")!;
      assert.equal(
        update.action,
        "update",
        "resuming live content must not invent another AlwaysOn start",
      );
      assert.equal(update.event.instanceId, voice.instanceId);
      const instance = resumed.runtimeSnapshot.state.instances.find(
        (value) => value.instanceId === voice.instanceId,
      )!;
      assert.equal(instance.startedAtTick, voice.startedAtTick);
      const resumedCursor = resumed.voiceCursors![voice.instanceId]!;
      assert.ok(resumedCursor.playheadSeconds >= cursor.playheadSeconds);
      assert.ok(
        resumedCursor.playheadSeconds <= cursor.playheadSeconds + 2 * STEP,
        "replay wall time cannot advance the suspended live source",
      );
      assert.ok(
        app.getSnapshot().monitor.activeVoices > 0,
        "restored live content must be connected to the real control graph",
      );
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration control graph: acoustic B preserves true AudioEngine cursor fields instead of logical playhead", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, {
        type: "patchRule",
        objectId: "speaker",
        ruleId: "rule.always",
        patch: { pitchSemitones: 12 },
      });
      await command(app, { type: "enableAudio" });
      await command(app, { type: "run" });
      for (let tick = 0; tick < 20; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      await command(app, { type: "recordToggle" });
      for (let tick = 0; tick < 3; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      await command(app, { type: "recordToggle" });
      await command(app, { type: "captureComparison", slot: "A" });
      await command(app, { type: "captureComparison", slot: "B" });
      const { A: a, B: b } = app.getComparisonArtifacts();
      for (let index = 0; index < a!.frames.length; index++) {
        const left = a!.frames[index]!.behaviorSnapshot as RecordedBehaviorSnapshot;
        const right = b!.frames[index]!.behaviorSnapshot as RecordedBehaviorSnapshot;
        assert.equal(right.stateInitializationPolicy, "restoredPreStepSnapshot");
        assert.equal(right.cursorModel, left.cursorModel);
        assert.deepEqual(right.preStepVoiceCursors, left.preStepVoiceCursors);
        assert.deepEqual(right.voiceCursors, left.voiceCursors);
        const instance = left.runtimeSnapshot.state.instances.find(
          (value) => value.objectId === "speaker",
        )!;
        assert.ok(
          left.voiceCursors![instance.instanceId]!.playheadSeconds > instance.playheadSeconds,
          "pitched source seconds must differ from the unpitched Behavior clock in this fixture",
        );
      }
      assert.equal(b!.fingerprints.sourceSignalHash, a!.fingerprints.sourceSignalHash);
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration: unsupported second-order tool request preserves the real host failure without invented artifacts", async (t) => {
  // Fixture transport only: no network or Meta model is invoked. The actual
  // local AgentSession/ExperimentToolHost still validate and execute the request.
  t.mock.method(globalThis, "fetch", async (url, options?: RequestInit) => {
    if (String(url) === "/api/agent/status")
      return new Response(
        JSON.stringify({
          offline: {
            state: "AVAILABLE",
            provenance: "OFFLINE_DETERMINISTIC",
            modelId: null,
            cloudCostUsd: 0,
          },
          meta: {
            provider: "metaModelApi",
            state: "READY",
            reason: "Local fixture transport",
            modelId: "fixture.no-model-call",
            remainingQuota: null,
            liveValidation: "NOT_RUN",
            estimatedCostCeilingUsd: 0.1,
          },
        }),
        { status: 200 },
      );
    assert.equal(String(url), "/api/agent/propose");
    const input = JSON.parse(String(options!.body)) as {
      context: { scene: { sceneId: string; sceneRevision: number; seed: number } };
    };
    return new Response(
      JSON.stringify({
        planId: "plan.unsupported-order",
        summary: "Fixture asks the real local host for unsupported order2",
        assumptions: [],
        warnings: [],
        provenance: {
          provider: "metaModelApi",
          label: "META_LIVE",
          modelId: "fixture.no-model-call",
          requestId: "response.local-fixture",
        },
        requests: [
          {
            schemaVersion: "1.0.0",
            requestId: "request.unsupported-order",
            tool: "RunSimulation",
            sceneId: input.context.scene.sceneId,
            expectedSceneRevision: input.context.scene.sceneRevision,
            transactionId: null,
            arguments: {
              backendId: "custom-web",
              durationS: 0.2,
              timeStepS: 1 / 60,
              seed: input.context.scene.seed,
              replayTraceId: null,
              maxReflectionOrder: 2,
              sampleRateHz: 48000,
            },
          },
        ],
      }),
      { status: 200 },
    );
  });
  await fixture(async (app) => {
    const before = app.getSceneDocument();
    await command(app, { type: "setAgentMode", mode: "meta" });
    await command(app, { type: "submitPrompt", prompt: "simulate" });
    const ai = app.getSnapshot().ai as AgentSessionView;
    assert.equal(ai.status, "error");
    assert.equal(ai.canApply, false);
    assert.match(ai.message, /CAPABILITY_UNSUPPORTED/);
    const result = ai.toolResults![0]!.result as ExperimentToolResult;
    assert.equal(result.state, "failed");
    assert.equal(result.error!.code, "CAPABILITY_UNSUPPORTED");
    assert.equal(result.usage.solverSteps, 0);
    assert.deepEqual(result.artifactIds, []);
    assert.deepEqual(app.getSceneDocument(), before);
  });
});

test("integration control graph: native onended cannot rewrite a recorded logical one-shot before its fixed-tick expiry", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      await command(app, { type: "enableAudio" });
      await command(app, { type: "recordToggle" });
      let callbackTick = -1;
      for (let tick = 0; tick < 65; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
        const impactSource = contexts[0]!
          .sources()
          .find(
            (source) =>
              source.kind === "oscillator" &&
              source.frequency.value === 440 &&
              source.starts.length > 0 &&
              source.onended !== null,
          );
        if (!impactSource) continue;
        callbackTick = app.getSnapshot().tick;
        const pose = app.getPose("ball");
        // Invoke the actual SourceNode callback installed by AudioEngine, while
        // neither physics nor simulation time advances. No logical API is faked.
        impactSource.finish();
        assert.equal(app.getSnapshot().tick, callbackTick);
        assert.deepEqual(app.getPose("ball"), pose);
        break;
      }
      assert.ok(
        callbackTick > 0,
        "fixture needs an actually admitted impact source with a native callback",
      );
      for (let tick = 0; tick < 20; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      await command(app, { type: "recordToggle" });
      const artifact = app.getRecordingArtifact()!;
      const starts = artifact.frames.flatMap((frame) =>
        (frame.behaviorSnapshot as RecordedBehaviorSnapshot).voiceIntents.filter(
          (voice) =>
            voice.action === "start" &&
            voice.event.trigger.type === "OnImpact" &&
            voice.event.objectId === "ball",
        ),
      );
      assert.equal(starts.length, 1);
      const start = starts[0]!,
        instanceId = start.event.instanceId,
        expiryTick = start.expiresAtTick!;
      assert.ok(callbackTick < expiryTick, "the native callback must occur before logical expiry");
      const callbackFrame = artifact.frames.find((frame) => frame.tick === callbackTick)!
        .behaviorSnapshot as RecordedBehaviorSnapshot;
      assert.equal(
        callbackFrame.runtimeSnapshot.state.instances.find(
          (instance) => instance.instanceId === instanceId,
        )!.playbackState,
        "playing",
      );
      for (const frame of artifact.frames.filter(
        (frame) => frame.tick > callbackTick && frame.tick < expiryTick,
      )) {
        const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
        assert.equal(
          snapshot.preStepSnapshot!.state.instances.find(
            (instance) => instance.instanceId === instanceId,
          )?.playbackState,
          "playing",
          "wall-clock onended cannot remove or stop the authoritative instance between fixed-step checkpoints",
        );
        assert.equal(
          snapshot.runtimeSnapshot.state.instances.find(
            (instance) => instance.instanceId === instanceId,
          )?.playbackState,
          "playing",
        );
      }
      const stops = artifact.frames.flatMap((frame) =>
        (frame.behaviorSnapshot as RecordedBehaviorSnapshot).voiceIntents.filter(
          (voice) => voice.action === "stop" && voice.event.instanceId === instanceId,
        ),
      );
      assert.equal(stops.length, 1, "one logical expiry produces exactly one stop");
      assert.equal(stops[0]!.event.tick, expiryTick);
      const raw = artifact.frames.flatMap((frame) => frame.audioEvents);
      assert.equal(new Set(raw.map((event) => event.eventId)).size, raw.length);
      await command(app, { type: "captureComparison", slot: "A" });
      await command(app, { type: "captureComparison", slot: "B" });
      await command(app, { type: "compare", kind: "acoustic" });
      assert.match(app.getSnapshot().comparison.status, /固定條件相符/);
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration control graph: gravity-only toggles preserve physical momentum and the same AlwaysOn native source phase", async () => {
  const previous = globalThis.AudioContext;
  const contexts: FakeAudioContext[] = [];
  class Context extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  try {
    await fixture(async (app) => {
      // A tilted initial box under the stable ball ID produces actual angular
      // momentum at floor contact. The measured transactions below change only mode.
      const initial = JSON.parse(app.exportProject());
      const body = initial.scene.objects.find((object: { id: string }) => object.id === "ball");
      body.shape = "box";
      body.orientationQuaternion = [0, 0, Math.sin(Math.PI / 12), Math.cos(Math.PI / 12)];
      await command(app, { type: "importProject", text: JSON.stringify(initial) });
      await command(app, { type: "addRule", objectId: "ball", trigger: "AlwaysOn" });
      const rule = app
        .getSnapshot()
        .behaviors.filter((behavior) => behavior.objectId === "ball")
        .flatMap((behavior) => behavior.rules)
        .find((value) => value.trigger === "AlwaysOn")!;
      await command(app, { type: "enableAudio" });
      await command(app, { type: "run" });
      for (let tick = 0; tick < 2; tick++) {
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      const native = contexts[0]!
        .sources()
        .find(
          (source) =>
            source.kind === "oscillator" &&
            source.frequency.value === 440 &&
            source.starts.length > 0 &&
            source.onended !== null,
        )!;
      assert.ok(
        native,
        "AlwaysOn must be admitted before any impact one-shot can share its frequency",
      );
      const nativeStarts = structuredClone(native.starts),
        nativeStopCount = native.stops.length;
      let movingAndSpinning = false;
      for (let tick = 0; tick < 90; tick++) {
        const object = app.getSnapshot().objects.find((value) => value.id === "ball")!;
        if (
          Math.hypot(...object.velocityMps!) > 0.05 &&
          Math.hypot(...object.angularVelocityRadps!) > 0.05
        ) {
          movingAndSpinning = true;
          break;
        }
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
      }
      assert.ok(
        movingAndSpinning,
        "momentum assertions require actual nonzero linear and angular velocities",
      );
      await command(app, { type: "recordToggle" });
      contexts[0]!.currentTime += STEP;
      await steps(app, 1);
      await command(app, { type: "recordToggle" });
      let before = app.getRecordingArtifact()!.frames.at(-1)!
        .behaviorSnapshot as RecordedBehaviorSnapshot;
      let instance = before.runtimeSnapshot.state.instances.find(
        (value) => value.objectId === "ball" && value.ruleId === rule.id,
      )!;
      assert.ok(instance);
      assert.ok(
        before.voiceCursors![instance.instanceId],
        "must capture the actual AudioEngine source cursor",
      );
      for (const mode of ["dynamicNoGravity", "dynamicGravity"] as const) {
        const revision = app.getSceneDocument().sceneRevision;
        const tick = app.getSnapshot().tick;
        const object = app.getSnapshot().objects.find((value) => value.id === "ball")!;
        const linear = [...object.velocityMps!],
          angular = [...object.angularVelocityRadps!];
        await command(app, { type: "patchObject", objectId: "ball", patch: { mode } });
        const changed = app.getSnapshot().objects.find((value) => value.id === "ball")!;
        assert.equal(changed.mode, mode);
        assert.ok(app.getSceneDocument().sceneRevision > revision);
        assert.equal(
          app.getSnapshot().tick,
          tick,
          "the mode transaction does not invent a physics step",
        );
        assert.deepEqual(
          changed.velocityMps,
          linear,
          "gravity toggles preserve current linear momentum",
        );
        assert.deepEqual(
          changed.angularVelocityRadps,
          angular,
          "gravity toggles preserve current angular momentum",
        );
        assert.equal(
          native.stops.length,
          nativeStopCount,
          "a gravity-only mode transaction cannot retire the already playing AlwaysOn native source",
        );
        assert.deepEqual(native.starts, nativeStarts);
        assert.notEqual(native.onended, null);
        await command(app, { type: "run" });
        await command(app, { type: "recordToggle" });
        contexts[0]!.currentTime += STEP;
        await steps(app, 1);
        await command(app, { type: "recordToggle" });
        const after = app.getRecordingArtifact()!.frames.at(-1)!
          .behaviorSnapshot as RecordedBehaviorSnapshot;
        const update = after.voiceIntents.find(
          (voice) => voice.event.objectId === "ball" && voice.event.ruleId === rule.id,
        )!;
        assert.equal(update.action, "update");
        assert.equal(update.event.instanceId, instance.instanceId);
        const next = after.runtimeSnapshot.state.instances.find(
          (value) => value.instanceId === instance.instanceId,
        )!;
        assert.equal(next.startedAtTick, instance.startedAtTick);
        assert.equal(after.runtimeSnapshot.state.runEpoch, before.runtimeSnapshot.state.runEpoch);
        close(
          next.playheadSeconds - instance.playheadSeconds,
          STEP,
          "logical content advances by exactly the next fixed tick",
        );
        close(
          after.voiceCursors![instance.instanceId]!.playheadSeconds -
            before.voiceCursors![instance.instanceId]!.playheadSeconds,
          STEP,
          "native content cursor does not restart or skip on gravity toggle",
        );
        before = after;
        instance = next;
      }
      assert.equal(
        app
          .getSnapshot()
          .events.filter(
            (event) =>
              event.objectId === "ball" && event.ruleId === rule.id && event.type === "AlwaysOn",
          ).length,
        1,
      );
    });
  } finally {
    if (previous) globalThis.AudioContext = previous;
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("integration: Replay ObjectView uses captured velocity and sleep state while the live world stays untouched", async () => {
  await fixture(async (app) => {
    await command(app, { type: "recordToggle" });
    await steps(app, 3);
    await command(app, { type: "recordToggle" });
    const frame = app.getRecordingArtifact()!.frames[0]!;
    const pose = frame.poses.find((value) => value.objectId === "ball")!;
    const input = (frame.behaviorSnapshot as RecordedBehaviorSnapshot).inputFrame.objects.find(
      (value) => value.objectId === "ball",
    )!;
    assert.ok(
      Math.hypot(...pose.linearVelocityMps!) > 0.05,
      "captured frame must have actual nonzero velocity",
    );
    assert.equal(input.states.sleeping, false);
    // Advance the actual live Rapier body to sleep. This is bounded, unrecorded
    // warmup; no renderer, browser, artificial velocity or private world access.
    for (
      let tick = 0;
      tick < 600 && !app.getSnapshot().objects.find((value) => value.id === "ball")!.sleeping;
      tick++
    )
      app.advance(STEP);
    await command(app, { type: "pause" });
    const live = structuredClone(app.getSnapshot().objects.find((value) => value.id === "ball")!);
    const liveTick = app.getSnapshot().tick,
      livePose = app.getPose("ball"),
      scene = app.getSceneDocument();
    assert.equal(live.sleeping, true, "live state must differ from captured awake state");
    assert.notDeepEqual(live.velocityMps, pose.linearVelocityMps);
    await command(app, { type: "replay" });
    await command(app, { type: "seek", timeSeconds: 0 });
    const displayed = app.getSnapshot().objects.find((value) => value.id === "ball")!;
    assert.equal(app.getSnapshot().tick, frame.tick);
    assert.deepEqual(
      displayed.velocityMps,
      pose.linearVelocityMps,
      "Replay Inspector must show recorded velocity, not the paused live world's velocity",
    );
    assert.deepEqual(displayed.angularVelocityRadps, pose.angularVelocityRadps);
    assert.equal(
      displayed.sleeping,
      input.states.sleeping,
      "Replay sleep state comes from the saved frame/input",
    );
    assert.deepEqual(app.getPose("ball")!.positionM, pose.positionM);
    await command(app, { type: "stopReplay" });
    assert.equal(app.getSnapshot().tick, liveTick);
    const restored = app.getSnapshot().objects.find((value) => value.id === "ball")!;
    assert.deepEqual(restored.velocityMps, live.velocityMps);
    assert.deepEqual(restored.angularVelocityRadps, live.angularVelocityRadps);
    assert.equal(restored.sleeping, live.sleeping);
    assert.deepEqual(app.getPose("ball"), livePose);
    assert.deepEqual(app.getSceneDocument(), scene);
  });
});

test("integration: legacy Replay ObjectView omits unavailable or malformed state instead of falling back to live values", async () => {
  const variants = [
    { id: "absent", snapshot: undefined },
    {
      id: "non-array",
      snapshot: { inputFrame: { objects: { ball: { states: { sleeping: true, held: true } } } } },
    },
    {
      id: "bad-state",
      snapshot: { inputFrame: { objects: [null, 7, { objectId: "ball", states: "asleep" }] } },
    },
    {
      id: "bad-booleans",
      snapshot: {
        inputFrame: { objects: [{ objectId: "ball", states: { sleeping: 1, held: "true" } }] },
      },
    },
  ];
  for (const variant of variants) {
    const blobs = new BlobStore({ indexedDB: null });
    const app = await LabRuntime.create({
      storage: memory(),
      useWorker: false,
      blobStore: blobs,
      assetStagingContext: stagingContext,
    });
    try {
      await command(app, { type: "recordToggle" });
      await steps(app, 1);
      await command(app, { type: "recordToggle" });
      const base = app.getRecordingArtifact()!,
        sourceFrame = base.frames[0]!;
      const recorder = new ExperimentRecorder({
        ...base.configuration,
        runId: `run.replay-view.${variant.id}`,
        runEpoch: `epoch.replay-view.${variant.id}`,
      });
      const poses = sourceFrame.poses.map((pose) => ({
        objectId: pose.objectId,
        positionM: pose.positionM,
        orientationQuaternion:
          pose.objectId === "ball"
            ? ([0, Math.SQRT1_2, 0, Math.SQRT1_2] as const)
            : pose.orientationQuaternion,
      }));
      recorder.appendFrame({
        tick: sourceFrame.tick,
        sceneRevision: sourceFrame.sceneRevision,
        poses,
        listener: sourceFrame.listener,
        physicsEvents: [],
        behaviorDecisions: [],
        audioEvents: [],
        acousticFrames: [],
        acousticResultRefs: [],
        ...(variant.snapshot === undefined ? {} : { behaviorSnapshot: variant.snapshot }),
      });
      // Construct a genuine legacy hash protocol through its public algorithm;
      // optional pose/state fields are deliberately absent or malformed data.
      const artifact = structuredClone(await recorder.finish());
      delete artifact.fingerprintVersion;
      delete artifact.sourcePhaseEvidence;
      artifact.fingerprints = await recordingFingerprints(
        artifact.configuration,
        artifact.frames,
        artifact.runId,
      );
      const body = Object.fromEntries(
        Object.entries(artifact).filter(([key]) => key !== "artifactSha256"),
      );
      artifact.artifactSha256 = await sha256Canonical(body);
      await verifyRecording(artifact);
      await blobs.saveRecording(artifact);
      const project = JSON.parse(app.exportProject());
      project.recordings = [
        {
          runId: artifact.runId,
          sha256: artifact.artifactSha256,
          status: "captured",
          frameCount: artifact.frameCount,
          durationSeconds: 0,
          storage: "externalArtifact",
        },
      ];
      project.activeRecordingId = artifact.runId;
      await command(app, { type: "importProject", text: JSON.stringify(project) });
      const live = app.getSnapshot().objects.find((object) => object.id === "ball")!;
      assert.ok(Object.hasOwn(live, "velocityMps"));
      assert.equal(live.held, false);
      assert.equal(live.sleeping, false);
      await command(app, { type: "replay" });
      await command(app, { type: "seek", timeSeconds: 0 });
      const displayed = app.getSnapshot().objects.find((object) => object.id === "ball")!;
      for (const key of ["velocityMps", "angularVelocityRadps", "held", "sleeping"])
        assert.equal(
          Object.hasOwn(displayed, key),
          false,
          `${variant.id}: ${key} is unavailable, never a live fallback or coerced value`,
        );
      assert.deepEqual(
        displayed.positionM,
        poses.find((pose) => pose.objectId === "ball")!.positionM,
      );
      assert.deepEqual(displayed.orientationQuaternion, [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
      assert.deepEqual(app.getPose("ball")!.orientationQuaternion, displayed.orientationQuaternion);
      await command(app, { type: "stopReplay" });
      assert.deepEqual(
        app.getSnapshot().objects.find((object) => object.id === "ball")!.velocityMps,
        live.velocityMps,
      );
    } finally {
      app.dispose();
      blobs.close();
    }
  }
});

test("integration: Replay ObjectView shows the captured Held state after the live object was dropped", async () => {
  await fixture(async (app) => {
    const project = JSON.parse(app.exportProject());
    const ball = project.scene.objects.find((object: { id: string }) => object.id === "ball");
    ball.mode = "dynamicNoGravity";
    ball.positionM = [0, 1.6, 2.5];
    await command(app, { type: "importProject", text: JSON.stringify(project) });
    await command(app, { type: "enterFPS" });
    await command(app, { type: "setAlternativeInput", enabled: true });
    await command(app, { type: "run" });
    await command(app, { type: "grab" });
    await steps(app, 1);
    assert.equal(
      app.getSnapshot().objects.find((object) => object.id === "ball")!.held,
      true,
      "fixture must really grab through the public interaction host",
    );
    await command(app, { type: "recordToggle" });
    await steps(app, 1);
    await command(app, { type: "recordToggle" });
    const frame = app.getRecordingArtifact()!.frames[0]!;
    const saved = (frame.behaviorSnapshot as RecordedBehaviorSnapshot).inputFrame.objects.find(
      (object) => object.objectId === "ball",
    )!;
    assert.equal(saved.states.held, true);
    await command(app, { type: "drop" });
    await steps(app, 1);
    await command(app, { type: "pause" });
    assert.equal(app.getSnapshot().objects.find((object) => object.id === "ball")!.held, false);
    const liveTick = app.getSnapshot().tick,
      livePose = app.getPose("ball");
    await command(app, { type: "replay" });
    await command(app, { type: "seek", timeSeconds: 0 });
    const displayed = app.getSnapshot().objects.find((object) => object.id === "ball")!;
    assert.equal(displayed.held, true);
    assert.deepEqual(
      displayed.positionM,
      frame.poses.find((pose) => pose.objectId === "ball")!.positionM,
    );
    await command(app, { type: "stopReplay" });
    assert.equal(app.getSnapshot().tick, liveTick);
    assert.equal(app.getSnapshot().objects.find((object) => object.id === "ball")!.held, false);
    assert.deepEqual(app.getPose("ball"), livePose);
  });
});
