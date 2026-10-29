import test from "node:test";
import assert from "node:assert/strict";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import type { BehaviorAsset, BehaviorFrame } from "../../src/audio-behavior/types.js";
import { AudioEngine } from "../../src/audio/engine.js";
import type { VoiceInput } from "../../src/audio/types.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import {
  createDefaultBehaviors,
  createDefaultScene,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import { ReplayAudioHost } from "../../src/app/replay-audio.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import { ExperimentRecorder } from "../../src/experiments/index.js";
import type { RecordingArtifact, RecordingFrame } from "../../src/experiments/types.js";
import { stableHash } from "../../src/physics/math.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";

const DT = 1 / 60;
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

async function capture(
  options: {
    start?: number;
    end?: number;
    grabTick?: number;
    editDocument?: (document: SoundBehaviorDocument) => void;
    editFrame?: (frame: RecordingFrame) => void;
    editInput?: (frame: BehaviorFrame) => void;
    assets?: BehaviorAsset[];
  } = {},
): Promise<RecordingArtifact> {
  const scene = createDefaultScene();
  // Keep direct routes short, so tests can distinguish retained content from a new impact.
  scene.listener.positionM = [0, 1.6, 4];
  scene.listener.orientationQuaternion = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const document = createDefaultBehaviors(scene);
  options.editDocument?.(document);
  const objects: BehaviorFrame["objects"] = scene.objects.map((object) => ({
    objectId: object.id,
    generation: 1,
    lifecycle: "active",
    positionMetres: [...object.positionM],
    rotation: [...object.orientationQuaternion],
    states: {
      moving: false,
      airborne: false,
      held: false,
      sleeping: false,
      rolling: false,
      sliding: false,
      spinning: false,
    },
    metrics: { sourceSpeedMetresPerSecond: 0, angularSpeedRadiansPerSecond: 0 },
  }));
  const runtime = createBehaviorRuntime(
    document,
    makeBehaviorContext(scene, objects, options.assets ?? []),
    {
      experimentId: "run.original",
      runEpoch: "epoch.original",
      fixedDtSeconds: DT,
      maxVoices: 16,
    },
  );
  const recorder = new ExperimentRecorder({
    runId: "run.original",
    runEpoch: "epoch.original",
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: document,
    solverConfig: { maxReflectionOrder: 1 },
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    materialRegistry: DEFAULT_MATERIALS,
    physicsVersion: "test-reference",
    backendVersion: "1.0.0",
    fixedDtS: DT,
    sampleRateHz: 48000,
  });
  for (let tick = 1; tick <= (options.end ?? 4); tick++) {
    const inputFrame: BehaviorFrame = {
      tick,
      sceneRevision: scene.sceneRevision,
      runEpoch: "epoch.original",
      objects,
      events:
        tick === options.grabTick
          ? [
              {
                eventId: `input.grab.${tick}`,
                tick,
                sequence: 1,
                objectId: "ball",
                generation: 1,
                type: "OnGrab",
                source: "interaction",
                accepted: true,
                commandId: `command.grab.${tick}`,
              },
            ]
          : [],
    };
    options.editInput?.(inputFrame);
    const preStepSnapshot = runtime.snapshot();
    const result = runtime.step(inputFrame);
    const runtimeSnapshot = runtime.snapshot();
    const sources = new Map(
      runtimeSnapshot.state.instances.map((instance) => [
        instance.instanceId,
        {
          id: instance.instanceId,
          objectId: instance.objectId,
          positionM: instance.positionMetres,
        },
      ]),
    );
    for (const event of result.events)
      sources.set(event.instanceId, {
        id: event.instanceId,
        objectId: event.objectId,
        positionM: event.positionMetres,
      });
    const poses = objects.map((object) => ({
      objectId: object.objectId,
      positionM: object.positionMetres,
      orientationQuaternion: object.rotation!,
    }));
    const acousticFrames = buildAcousticRequests({
      scene,
      poses,
      sources: [...sources.values()],
      listener: scene.listener,
      tick,
      materials: DEFAULT_MATERIALS,
      atmosphere: { medium: "air", speedOfSoundMps: 343 },
    }).map((request) => solveAcoustics(request).frame);
    const frame: RecordingFrame = {
      tick,
      sceneRevision: scene.sceneRevision,
      runEpoch: inputFrame.runEpoch,
      poses,
      listener: structuredClone(scene.listener),
      physicsEvents: inputFrame.events,
      behaviorDecisions: result.decisions,
      audioEvents: result.events,
      acousticFrames,
      acousticResultRefs: acousticFrames.map((value) => value.requestId),
      behaviorSnapshot: {
        inputFrame,
        preStepSnapshot,
        runtimeSnapshot,
        voiceIntents: result.voices,
      },
    };
    options.editFrame?.(frame);
    if (tick >= (options.start ?? 1)) recorder.appendFrame(frame);
  }
  return recorder.finish();
}

async function engineFixture(
  run: (engine: AudioEngine, context: FakeAudioContext) => Promise<void>,
) {
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext(), limiterEnabled: false });
  await engine.enable(0);
  engine.setMuted(false);
  try {
    await run(engine, context);
  } finally {
    engine.dispose();
  }
}

test("replay control graph routes captured starts, updates and original listener orientation", async () => {
  const artifact = await capture({ grabTick: 2 });
  await engineFixture(async (engine, context) => {
    const calls: string[] = [];
    const route = engine.updateFrame.bind(engine);
    const play = engine.playVoice.bind(engine);
    const update = engine.updateVoice.bind(engine);
    engine.updateFrame = (frame) => {
      calls.push(`route:${frame.sourceId}`);
      return route(frame);
    };
    engine.playVoice = (input, frame) => {
      assert.ok(
        calls.includes(`route:${input.sourceId}`),
        "solver route must arrive before source",
      );
      calls.push(`play:${input.instanceId}`);
      return play(input, frame);
    };
    engine.updateVoice = (id, value) => {
      calls.push(`update:${id}`);
      return update(id, value);
    };
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await host.begin(artifact);
    for (const frame of artifact.frames) {
      context.currentTime = (frame.tick - 1) * DT;
      host.applyFrame(frame);
    }
    assert.equal(calls.filter((call) => call.startsWith("play:")).length, 2);
    assert.ok(calls.some((call) => call.startsWith("update:")));
    close(context.listener.forwardX.value, -1);
    close(context.listener.forwardZ.value, 0);
    assert.equal(engine.getTelemetry().activeVoices, 2);
    const sourceCount = context.sources().length;
    host.applyFrame(artifact.frames.at(-1)!);
    assert.equal(context.sources().length, sourceCount, "a duplicate frame cannot emit again");
    await host.stop();
    assert.equal(engine.getTelemetry().activeVoices, 0);
  });
});

test("late capture restores original source cursor before its first update", async () => {
  const artifact = await capture({ start: 21, end: 23 });
  await engineFixture(async (engine) => {
    const restored: { input: VoiceInput; cursor: { playheadSeconds: number } }[] = [];
    const restore = engine.restoreVoiceAtCursor.bind(engine);
    engine.restoreVoiceAtCursor = (input, frame, cursor) => {
      restored.push({ input, cursor });
      return restore(input, frame, cursor);
    };
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await host.begin(artifact);
    assert.equal(restored.length, 1);
    close(restored[0]!.cursor.playheadSeconds, 20 * DT);
    close(restored[0]!.input.emissionTimeSeconds, 21 * DT);
    assert.equal(restored[0]!.input.generator.kind, "oscillator");
    host.applyFrame(artifact.frames[0]!);
    assert.equal(engine.getTelemetry().activeVoices, 1);
    await host.stop();
  });
});

test("seek previews emit nothing; resume restores only remaining cursor content and never the old grab", async () => {
  const artifact = await capture({ grabTick: 2, end: 20 });
  await engineFixture(async (engine, context) => {
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await host.begin(artifact);
    host.applyFrame(artifact.frames[0]!);
    const target = artifact.frames[3]!;
    const before = context.sources().length;
    await host.seek(target);
    assert.equal(context.sources().length, before, "seek must not create audio nodes");
    assert.equal(engine.getTelemetry().activeVoices, 0);
    await host.resume();
    assert.equal(
      engine.getTelemetry().activeVoices,
      2,
      "continuous and unfinished one-shot are restored",
    );
    const resumed = context.sources().length;
    host.applyFrame(target);
    assert.equal(
      context.sources().length,
      resumed,
      "seeked frame's original OnGrab cannot retrigger",
    );
    await host.seek(artifact.frames.at(-1)!);
    await host.resume();
    assert.equal(
      engine.getTelemetry().activeVoices,
      1,
      "expired one-shot is absent at the later cursor",
    );
    await host.stop();
  });
});

test("replay rejects a rehashed arbitrary intent generator and tampered frame", async () => {
  const forged = await capture({
    editFrame(frame) {
      const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
      if (snapshot.voiceIntents[0])
        snapshot.voiceIntents[0].generator = {
          kind: "oscillator",
          waveform: "square",
          frequencyHz: 12345,
        };
    },
  });
  const good = await capture();
  await engineFixture(async (engine, context) => {
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await assert.rejects(host.begin(forged), { code: "INPUT_PROVENANCE_MISMATCH" });
    assert.equal(context.sources().length, 0);
    await host.begin(good);
    const altered = structuredClone(good.frames[0]!);
    altered.listener.positionM = [100, 100, 100];
    assert.throws(() => host.applyFrame(altered), { code: "INPUT_PROVENANCE_MISMATCH" });
    await host.stop();
  });
});

test("no enabled engine leaves replay silent without constructing an AudioContext", async () => {
  const artifact = await capture();
  const host = new ReplayAudioHost({ getEngine: () => null, getAssets: () => [] });
  await host.begin(artifact);
  host.applyFrame(artifact.frames[0]!);
  await host.seek(artifact.frames[1]!);
  await host.resume();
  await host.stop();
});

test("enabling audio during replay anchors and restores the current continuous cursor", async () => {
  const artifact = await capture({ end: 6 });
  await engineFixture(async (engine, context) => {
    let attached: AudioEngine | null = null;
    const host = new ReplayAudioHost({ getEngine: () => attached, getAssets: () => [] });
    await host.begin(artifact);
    host.applyFrame(artifact.frames[3]!);
    context.currentTime = 50;
    attached = engine;
    await host.resume();
    assert.equal(engine.getTelemetry().activeVoices, 1);
    const count = context.sources().length;
    host.applyFrame(artifact.frames[3]!);
    host.applyFrame(artifact.frames[4]!);
    assert.equal(context.sources().length, count);
    assert.equal(
      engine.getTelemetry().lateEvents,
      0,
      "new audio epoch is tied to the replay cursor",
    );
    await host.stop();
  });
});

test("captured stop intents release the original source through the audio engine", async () => {
  const artifact = await capture({
    editDocument(document) {
      document.profiles[0]!.rules[0]!.trigger = { kind: "continuous", type: "WhileMoving" };
    },
    editInput(frame) {
      frame.objects.find((object) => object.objectId === "speaker")!.states.moving =
        frame.tick <= 2;
    },
  });
  await engineFixture(async (engine) => {
    const stops: string[] = [];
    const stop = engine.stopVoice.bind(engine);
    engine.stopVoice = (id, fade) => {
      stops.push(id);
      return stop(id, fade);
    };
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await host.begin(artifact);
    for (const frame of artifact.frames) host.applyFrame(frame);
    assert.equal(stops.length, 1);
    assert.equal(engine.getTelemetry().activeVoices, 0);
    await host.stop();
  });
});

test("sample replay verifies captured asset pins against the trusted decoded registry", async () => {
  const asset: BehaviorAsset = {
    assetId: "sample.original",
    revision: 1,
    sha256: "a".repeat(64),
    availability: "READY",
    rightsStatus: "APPROVED",
    durationSeconds: 2,
  };
  const artifact = await capture({
    assets: [asset],
    editDocument(document) {
      const pin = { assetId: asset.assetId, revision: 1, sha256: asset.sha256 };
      document.assets = [pin];
      document.profiles[0]!.rules[0]!.generator = {
        kind: "sample",
        asset: pin,
        loop: true,
        startOffsetSeconds: 0,
      };
    },
  });
  await engineFixture(async (engine, context) => {
    const host = new ReplayAudioHost({
      getEngine: () => engine,
      getAssets: () => [{ ...asset, sha256: "b".repeat(64) }],
    });
    await assert.rejects(host.begin(artifact), { code: "ASSET_HASH_MISMATCH" });
    assert.equal(context.sources().length, 0);
    await host.stop();
  });
});

test("late pitch-mapped capture needs a true source cursor and restores it without using the logical playhead", async () => {
  const mapping = (document: SoundBehaviorDocument) => {
    document.profiles[0]!.rules[0]!.mappings = [
      {
        mappingId: "mapping.pitch",
        input: "sourceSpeedMetresPerSecond",
        target: "pitchSemitones",
        inputMin: 0,
        inputMax: 1,
        outputMin: 0,
        outputMax: 12,
        curve: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        interpolation: "linear",
        clamp: true,
        smoothingSeconds: 0,
      },
    ];
  };
  const missing = await capture({ start: 21, end: 23, editDocument: mapping });
  const complete = await capture({
    start: 21,
    end: 23,
    editDocument: mapping,
    editInput(frame) {
      frame.objects.find(
        (object) => object.objectId === "speaker",
      )!.metrics.sourceSpeedMetresPerSecond = frame.tick >= 11 && frame.tick <= 20 ? 1 : 0;
    },
    editFrame(frame) {
      const captured = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
      const voiceCursors = Object.fromEntries(
        captured.runtimeSnapshot.state.instances.map((instance) => {
          const elapsed = (frame.tick - instance.startedAtTick) * DT;
          return [
            instance.instanceId,
            {
              playheadSeconds: frame.tick >= 21 ? 30 * DT + (frame.tick - 21) * DT : elapsed,
              elapsedSinceEmissionSeconds: elapsed,
              remainingDurationSeconds: null,
            },
          ];
        }),
      );
      Object.assign(captured, { voiceCursors });
    },
  });
  await engineFixture(async (engine) => {
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await assert.rejects(host.begin(missing), { code: "AUDIO_CURSOR_UNAVAILABLE" });
    const restored: { position: number; pitch: number }[] = [];
    const restore = engine.restoreVoiceAtCursor.bind(engine);
    engine.restoreVoiceAtCursor = (input, frame, cursor) => {
      restored.push({ position: cursor.playheadSeconds, pitch: input.pitchSemitones });
      return restore(input, frame, cursor);
    };
    await host.begin(complete);
    close(restored[0]!.position, 30 * DT);
    assert.equal(restored[0]!.pitch, 12, "pre-step pitch is restored before the captured update");
    const updates: number[] = [];
    const update = engine.updateVoice.bind(engine);
    engine.updateVoice = (id, value) => {
      updates.push(value.pitchSemitones!);
      return update(id, value);
    };
    host.applyFrame(complete.frames[0]!);
    assert.deepEqual(
      updates,
      [0],
      "the first frame applies its original new pitch after restoration",
    );
    await host.stop();
  });
});

test("seek cuts fading content instead of inventing emissions after its recorded stop", async () => {
  const artifact = await capture({
    editDocument(document) {
      document.profiles[0]!.rules[0]!.trigger = { kind: "continuous", type: "WhileMoving" };
    },
    editInput(frame) {
      frame.objects.find((object) => object.objectId === "speaker")!.states.moving =
        frame.tick <= 2;
    },
  });
  await engineFixture(async (engine, context) => {
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await host.begin(artifact);
    host.applyFrame(artifact.frames[0]!);
    const count = context.sources().length;
    await host.seek(artifact.frames[3]!);
    await host.resume();
    assert.equal(engine.getTelemetry().activeVoices, 0);
    assert.equal(
      context.sources().length,
      count,
      "fading source and its cut tail cannot be recreated",
    );
    await host.stop();
  });
});

test("a retained contact source keeps its original selected material generator across contact updates", async () => {
  const artifact = await capture({
    editDocument(document) {
      const profile = document.profiles[0]!;
      profile.rules[0]!.trigger = { kind: "continuous", type: "WhileRolling" };
      profile.rules[0]!.emitter = { attachment: "contact", aggregation: "representative" };
      profile.materialPairOverrides = [
        {
          overrideId: "override.first",
          ruleId: "rule.always",
          materialA: "material.hard",
          materialB: "material.wood",
          generator: { kind: "oscillator", waveform: "sine", frequencyHz: 330 },
        },
        {
          overrideId: "override.second",
          ruleId: "rule.always",
          materialA: "material.soft",
          materialB: "material.wood",
          generator: { kind: "oscillator", waveform: "sine", frequencyHz: 660 },
        },
      ];
    },
    editInput(frame) {
      const object = frame.objects.find((value) => value.objectId === "speaker")!;
      object.states.rolling = true;
      object.contact = {
        pairKey: "contact.pair",
        episodeId: "contact.episode",
        objectA: "speaker",
        objectB: "floor",
        colliderA: `col-${stableHash("speaker")}`,
        colliderB: `col-${stableHash("floor")}`,
        materialA: frame.tick === 1 ? "material.hard" : "material.soft",
        materialB: "material.wood",
        pointWorldMetres: [1, 0, 0],
        normalAtoB: [0, -1, 0],
        normalImpulseNewtonSeconds: null,
        impulseMethod: "Unavailable",
        closingSpeedMetresPerSecond: null,
        tangentSpeedMetresPerSecond: null,
        velocityMethod: "Unavailable",
      };
    },
  });
  const intents = (artifact.frames[1]!.behaviorSnapshot as RecordedBehaviorSnapshot).voiceIntents;
  assert.deepEqual(intents[0]!.generator, {
    kind: "oscillator",
    waveform: "sine",
    frequencyHz: 330,
  });
  await engineFixture(async (engine) => {
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [] });
    await host.begin(artifact);
    for (const frame of artifact.frames) host.applyFrame(frame);
    assert.equal(engine.getTelemetry().activeVoices, 1);
    await host.stop();
  });
});

test("exhausted high-pitch sample fallback clamps source position to decoded content", async () => {
  const asset: BehaviorAsset = {
    assetId: "sample.short",
    revision: 1,
    sha256: "c".repeat(64),
    availability: "READY",
    rightsStatus: "APPROVED",
    durationSeconds: 1,
  };
  const artifact = await capture({
    assets: [asset],
    grabTick: 2,
    end: 20,
    editDocument(document) {
      const pin = { assetId: asset.assetId, revision: 1, sha256: asset.sha256 };
      document.assets = [pin];
      const grab = document.profiles[1]!.rules.find((rule) => rule.ruleId === "rule.grab")!;
      grab.generator = { kind: "sample", asset: pin, loop: false, startOffsetSeconds: 0.2 };
      grab.pitchSemitones = 24;
      delete grab.oneShotDurationSeconds;
    },
  });
  await engineFixture(async (engine, context) => {
    engine.registerBuffer(
      asset.assetId,
      context.createBuffer(1, 48000, 48000) as unknown as AudioBuffer,
      {
        name: "Control graph synthetic sample",
        origin: "generated",
        license: "TEST_ONLY_SYNTHETIC",
        sha256: asset.sha256,
      },
    );
    const restored: { position: number; remaining: number | null }[] = [];
    const restore = engine.restoreVoiceAtCursor.bind(engine);
    engine.restoreVoiceAtCursor = (input, frame, cursor) => {
      if (input.generator.kind === "sample")
        restored.push({
          position: cursor.playheadSeconds,
          remaining: cursor.remainingDurationSeconds,
        });
      return restore(input, frame, cursor);
    };
    const host = new ReplayAudioHost({ getEngine: () => engine, getAssets: () => [asset] });
    await host.begin(artifact);
    await host.seek(artifact.frames[14]!);
    await host.resume();
    assert.equal(restored.length, 1);
    close(restored[0]!.position, 0.8);
    assert.equal(restored[0]!.remaining, 0);
    await host.stop();
  });
});
