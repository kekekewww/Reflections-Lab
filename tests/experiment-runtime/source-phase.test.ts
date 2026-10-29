import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import type {
  BehaviorAsset,
  BehaviorFrame,
  BehaviorSnapshot,
} from "../../src/audio-behavior/types.js";
import { AudioEngine } from "../../src/audio/index.js";
import type { VoiceCursor } from "../../src/audio/types.js";
import { solveAcoustics } from "../../src/acoustics/index.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import {
  createDefaultBehaviors,
  createDefaultScene,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import { RecordingProcessor } from "../../src/app/recording-processor.js";
import type { RecordedBehaviorSnapshot } from "../../src/app/recording-processor.js";
import {
  ExperimentRecorder,
  canonicalStringify,
  compareRecordings,
  recordingFingerprints,
  reprocessRecording,
  sha256Canonical,
  verifyRecording,
} from "../../src/experiments/index.js";
import type {
  RecordingArtifact,
  RecordingConfiguration,
  RecordingFrame,
} from "../../src/experiments/types.js";
import { createScene } from "../../src/scene/index.js";
import type { ProjectAsset } from "../../src/persistence/types.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";

const cursorModel = "AudioEngineEpochMappedSourceCursor; not hardware PCM read pointer";
const epoch = "epoch.phase-fixture";
const atmosphere = { medium: "air" as const, speedOfSoundMps: 343 };
const acousticOptions = {
  kind: "acoustic" as const,
  independentVariables: ["acousticMaterial" as const],
};

function fixtureConfiguration(disabled = false): RecordingConfiguration {
  const original = createDefaultScene();
  const scene = createScene({
    ...original,
    objects: original.objects.filter((object) => ["floor", "speaker"].includes(object.id)),
  });
  const behaviors = createDefaultBehaviors(scene);
  behaviors.profiles.find(
    (profile) => profile.profileId === "profile.continuous-tone",
  )!.rules[0]!.pitchSemitones = 12;
  if (disabled)
    behaviors.bindings.forEach((binding) => {
      binding.enabled = false;
    });
  return {
    sceneSnapshot: scene,
    sourceConfig: scene.sources,
    behaviorConfig: behaviors,
    generatorConfig: behaviors.profiles.map((profile) =>
      profile.rules.map((rule) => rule.generator),
    ),
    solverConfig: { backendId: "custom-web-geometric", maxReflectionOrder: 1, maxPaths: 8 },
    atmosphere,
    materialRegistry: DEFAULT_MATERIALS,
    assetManifest: [],
    physicsConfig: { fixedDtS: 1 / 60, gravityMps2: scene.gravityMps2 },
    geometrySnapshot: {},
    physicsVersion: "fixture-no-resimulation",
    backendId: "custom-web-geometric",
    backendVersion: "1.0.0",
    fixedDtS: 1 / 60,
    sampleRateHz: 48000,
  };
}
function behaviorInput(configuration: RecordingConfiguration, tick: number): BehaviorFrame {
  return {
    tick,
    sceneRevision: configuration.sceneSnapshot.sceneRevision,
    runEpoch: epoch,
    objects: configuration.sceneSnapshot.objects.map((object) => ({
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
    })),
    events: [],
  };
}
async function capture({
  native = true,
  disabled = false,
  runId = "run.phase-a",
  configuration: suppliedConfiguration,
  assets = [],
}: {
  native?: boolean;
  disabled?: boolean;
  runId?: string;
  configuration?: RecordingConfiguration;
  assets?: BehaviorAsset[];
} = {}): Promise<RecordingArtifact> {
  const configuration = suppliedConfiguration ?? fixtureConfiguration(disabled);
  const runtime = createBehaviorRuntime(
    configuration.behaviorConfig as SoundBehaviorDocument,
    makeBehaviorContext(
      configuration.sceneSnapshot,
      behaviorInput(configuration, 0).objects,
      assets,
    ),
    {
      experimentId: "run.phase-content",
      runEpoch: epoch,
      maxVoices: 16,
      randomSeed: configuration.sceneSnapshot.seed,
    },
  );
  const context = new FakeAudioContext();
  const audio = native ? new AudioEngine({ context: context.asContext() }) : null;
  if (audio) await audio.enable(0);
  const recorder = new ExperimentRecorder({ ...configuration, runId, runEpoch: epoch });
  const cursors = (snapshot: BehaviorSnapshot): Record<string, VoiceCursor> =>
    Object.fromEntries(
      snapshot.state.instances.flatMap((instance) => {
        const cursor = audio?.getVoiceCursor(
          instance.instanceId,
          snapshot.state.tick * snapshot.state.fixedDtSeconds,
        );
        return cursor ? [[instance.instanceId, cursor]] : [];
      }),
    );
  try {
    for (let tick = 0; tick <= 2; tick++) {
      context.currentTime = tick / 60;
      const inputFrame = behaviorInput(configuration, tick);
      const preStepSnapshot = runtime.snapshot(),
        preStepVoiceCursors = cursors(preStepSnapshot);
      const result = runtime.step(inputFrame),
        runtimeSnapshot = runtime.snapshot();
      const poses = inputFrame.objects.map((object) => ({
        objectId: object.objectId,
        positionM: object.positionMetres,
        orientationQuaternion: object.rotation!,
      }));
      const acousticFrames = buildAcousticRequests({
        scene: configuration.sceneSnapshot,
        poses,
        sources: runtimeSnapshot.state.instances
          .filter((instance) => instance.playbackState === "playing")
          .map((instance) => ({
            id: instance.instanceId,
            objectId: instance.objectId,
            positionM: instance.positionMetres,
          })),
        listener: configuration.sceneSnapshot.listener,
        tick,
        materials: DEFAULT_MATERIALS,
        atmosphere,
      }).map((request) => solveAcoustics(request).frame);
      // This fixture exercises the real AudioEngine source-clock getter using a
      // control context. It is not browser DSP or hardware read-pointer evidence.
      for (const voice of result.voices) {
        const event = voice.event;
        if (voice.action === "start" && audio) {
          assert.equal(
            audio.playVoice(
              {
                instanceId: event.instanceId,
                sourceId: event.instanceId,
                generator: voice.generator,
                gainLinear: event.gainLinear,
                pitchSemitones: event.pitchSemitones,
                emissionTimeSeconds: event.simulationTimeSeconds,
                continuous: true,
                fadeInSeconds: voice.fadeInSeconds,
                fadeOutSeconds: voice.fadeOutSeconds,
              },
              acousticFrames.find((frame) => frame.sourceId === event.instanceId),
            ).accepted,
            true,
          );
        } else if (voice.action === "update")
          audio?.updateVoice(event.instanceId, {
            gainLinear: event.gainLinear,
            pitchSemitones: event.pitchSemitones,
            smoothingSeconds: voice.smoothingSeconds,
          });
      }
      const frame: RecordingFrame = {
        tick,
        sceneRevision: inputFrame.sceneRevision,
        runEpoch: epoch,
        poses,
        listener: configuration.sceneSnapshot.listener,
        physicsEvents: [],
        behaviorDecisions: result.decisions,
        audioEvents: result.events,
        acousticFrames,
        acousticResultRefs: acousticFrames.map((value) => value.requestId),
        behaviorSnapshot: {
          inputFrame,
          preStepSnapshot,
          runtimeSnapshot,
          voiceIntents: result.voices,
          preStepVoiceCursors,
          voiceCursors: cursors(runtimeSnapshot),
          cursorModel,
        } satisfies RecordedBehaviorSnapshot,
      };
      recorder.appendFrame(frame);
    }
    return await recorder.finish();
  } finally {
    audio?.dispose();
  }
}
async function rebuild(
  original: RecordingArtifact,
  mutate: (frames: RecordingFrame[]) => void,
  runId: string,
): Promise<RecordingArtifact> {
  const frames = structuredClone(original.frames) as RecordingFrame[];
  mutate(frames);
  const recorder = new ExperimentRecorder({
    ...original.configuration,
    runId,
    runEpoch: original.runEpoch,
  });
  for (const frame of frames) recorder.appendFrame(frame);
  return recorder.finish();
}
async function legacy(original: RecordingArtifact): Promise<RecordingArtifact> {
  const {
    fingerprintVersion: _version,
    sourcePhaseEvidence: _evidence,
    artifactSha256: _hash,
    ...body
  } = structuredClone(original);
  const value = {
    ...body,
    fingerprints: await recordingFingerprints(body.configuration, body.frames, body.runId),
  };
  return { ...value, artifactSha256: await sha256Canonical(value) };
}
function eraseSources(frame: RecordingFrame, rearmAtTick?: number): void {
  const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
  for (const state of [snapshot.preStepSnapshot!, snapshot.runtimeSnapshot]) {
    state.state.instances = [];
    state.voiceMetadata = [];
    state.state.sequence = 0;
    state.state.processedEventIds = [];
    state.inputCursor = null;
    for (const binding of state.state.bindings) {
      binding.activeRuleIds = [];
      binding.cooldowns = rearmAtTick === undefined ? [] : [{ ruleId: "rule.always", rearmAtTick }];
    }
  }
  snapshot.voiceIntents = [];
  snapshot.preStepVoiceCursors = {};
  snapshot.voiceCursors = {};
  frame.audioEvents = [];
  frame.behaviorDecisions = [];
  frame.acousticFrames = [];
  frame.acousticResultRefs = [];
}
async function candidate(
  original: RecordingArtifact,
  doc = original.configuration.behaviorConfig as SoundBehaviorDocument,
): Promise<RecordingArtifact> {
  const processor = new RecordingProcessor({ getAssets: () => [] });
  return reprocessRecording(
    original,
    { runId: "run.phase-b", ...original.configuration, behaviorConfig: doc },
    (frame, changes) => processor.process(frame, changes, original.configuration),
  );
}

test("v2 rejects rebuilt same-configuration native source phase shifted by four milliseconds", async () => {
  const a = await capture();
  const b = await rebuild(
    a,
    (frames) => {
      const snapshot = frames[2]!.behaviorSnapshot as RecordedBehaviorSnapshot;
      Object.values(snapshot.voiceCursors!)[0]!.playheadSeconds += 0.004;
    },
    "run.phase-shift",
  );
  await Promise.all([verifyRecording(a), verifyRecording(b)]);
  assert.equal(a.fingerprintVersion, "content-and-cursors-v2");
  assert.equal(a.sourcePhaseEvidence!.evidenceClass, "nativeEpoch");
  assert.equal(a.fingerprints.motionTraceHash, b.fingerprints.motionTraceHash);
  assert.deepEqual(a.configuration, b.configuration);
  assert.notEqual(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  const result = await compareRecordings(a, b, acousticOptions);
  assert.equal(result.matched, false);
  assert.ok(result.mismatches.some((entry) => entry.field === "sourceSignalHash"));
});

test("v2 accepts genuine same-source B despite opaque instance remapping and preserves native cursor seconds", async () => {
  const a = await capture(),
    b = await candidate(a);
  const firstA = a.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
  const firstB = b.frames[0]!.behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.notEqual(
    firstA.runtimeSnapshot.state.instances[0]!.instanceId,
    firstB.runtimeSnapshot.state.instances[0]!.instanceId,
  );
  for (let index = 0; index < a.frames.length; index++) {
    const left = a.frames[index]!.behaviorSnapshot as RecordedBehaviorSnapshot;
    const right = b.frames[index]!.behaviorSnapshot as RecordedBehaviorSnapshot;
    assert.deepEqual(
      Object.values(right.preStepVoiceCursors!),
      Object.values(left.preStepVoiceCursors!),
    );
    assert.deepEqual(Object.values(right.voiceCursors!), Object.values(left.voiceCursors!));
  }
  const last = a.frames[2]!.behaviorSnapshot as RecordedBehaviorSnapshot;
  assert.ok(
    Object.values(last.voiceCursors!)[0]!.playheadSeconds >
      last.runtimeSnapshot.state.instances[0]!.playheadSeconds,
    "octave-shifted native source seconds differ from the unpitched Behavior clock",
  );
  assert.equal(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  assert.equal((await compareRecordings(a, b, acousticOptions)).matched, true);
});

test("v2 behavior comparison permits its declared changed profile/content while propagation remains fixed", async () => {
  const a = await capture();
  const changed = structuredClone(a.configuration.behaviorConfig) as SoundBehaviorDocument;
  changed.revision++;
  const profile = changed.profiles.find((value) => value.profileId === "profile.continuous-tone")!;
  profile.revision++;
  profile.rules[0]!.gainLinear = 0.3;
  changed.bindings[0]!.profileRevision = profile.revision;
  changed.bindings[0]!.overrides[0]!.gainLinear = 0.2;
  const b = await candidate(a, changed);
  assert.notEqual(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  assert.notEqual(a.fingerprints.profileHash, b.fingerprints.profileHash);
  assert.equal(
    (await compareRecordings(a, b, { kind: "behavior", independentVariables: ["behaviorProfile"] }))
      .matched,
    true,
  );
});

test("legacy verification preserves original bytes while the central comparison still checks actual source phase", async () => {
  const a = await capture();
  const shifted = await rebuild(
    a,
    (frames) => {
      const snapshot = frames[2]!.behaviorSnapshot as RecordedBehaviorSnapshot;
      Object.values(snapshot.voiceCursors!)[0]!.playheadSeconds += 0.004;
    },
    "run.phase-legacy-shift",
  );
  const [oldA, oldB] = await Promise.all([legacy(a), legacy(shifted)]);
  const originalBytes = canonicalStringify(oldA);
  await Promise.all([verifyRecording(oldA), verifyRecording(oldB)]);
  assert.equal(
    canonicalStringify(oldA),
    originalBytes,
    "reading legacy artifacts cannot rewrite or migrate historical bytes",
  );
  assert.equal(oldA.fingerprintVersion, undefined);
  assert.equal(
    oldA.fingerprints.sourceSignalHash,
    oldB.fingerprints.sourceSignalHash,
    "legacy config-only hashing is retained solely for verification",
  );
  const comparison = await compareRecordings(oldA, oldB, acousticOptions);
  assert.equal(comparison.matched, false);
  assert.ok(comparison.mismatches.some((entry) => entry.field === "sourceSignalHash"));
  const unsupported = structuredClone(a);
  (unsupported as unknown as { fingerprintVersion: string }).fingerprintVersion =
    "future-unrecognized";
  const { artifactSha256: _hash, ...body } = unsupported;
  unsupported.artifactSha256 = await sha256Canonical(body);
  await assert.rejects(verifyRecording(unsupported), { code: "FINGERPRINT_VERSION" });
});

test("pose/config-only recordings have missing phase proof instead of matched silence", async () => {
  const source = await capture();
  const generic = await rebuild(
    source,
    (frames) => {
      for (const frame of frames) {
        delete frame.behaviorSnapshot;
        frame.audioEvents = [];
        frame.behaviorDecisions = [];
      }
    },
    "run.phase-missing-a",
  );
  const other = await rebuild(generic, () => {}, "run.phase-missing-b");
  assert.equal(generic.sourcePhaseEvidence!.evidenceClass, "missing");
  const result = await compareRecordings(generic, other, acousticOptions);
  assert.equal(result.matched, false);
  assert.ok(result.mismatches.some((entry) => entry.field === "sourcePhaseProof"));
});

test("complete offline intended histories remain comparable without inventing native PCM cursor proof", async () => {
  const a = await capture({ native: false }),
    b = await candidate(a);
  assert.equal(a.sourcePhaseEvidence!.evidenceClass, "logicalIntent");
  assert.equal(b.sourcePhaseEvidence!.evidenceClass, "logicalIntent");
  assert.equal(a.fingerprints.sourceSignalHash, b.fingerprints.sourceSignalHash);
  assert.equal((await compareRecordings(a, b, acousticOptions)).matched, true);
  for (const frame of b.frames)
    assert.deepEqual((frame.behaviorSnapshot as RecordedBehaviorSnapshot).voiceCursors, {});
});

test("genuine evaluated empty emission histories prove silence instead of inferring it from missing data", async () => {
  const a = await capture({ native: false, disabled: true }),
    b = await candidate(a);
  assert.ok(a.frames.every((frame) => frame.audioEvents.length === 0));
  assert.equal(a.sourcePhaseEvidence!.evidenceClass, "silent");
  assert.equal((await compareRecordings(a, b, acousticOptions)).matched, true);
});

test("rehashed fabricated silence cannot suppress an enabled AlwaysOn source and acquire phase proof", async () => {
  const original = await capture({ native: false });
  const forged = await rebuild(
    original,
    (frames) => {
      for (const frame of frames) eraseSources(frame);
    },
    "run.forged-silent-a",
  );
  const other = await rebuild(forged, () => {}, "run.forged-silent-b");
  await Promise.all([verifyRecording(forged), verifyRecording(other)]);
  assert.deepEqual(forged.configuration, original.configuration);
  const document = forged.configuration.behaviorConfig as SoundBehaviorDocument;
  assert.equal(document.bindings[0]!.enabled, true);
  assert.equal(
    document.profiles.find((profile) => profile.profileId === "profile.continuous-tone")!.rules[0]!
      .enabled,
    true,
  );
  assert.equal(forged.sourcePhaseEvidence!.evidenceClass, "missing");
  const comparison = await compareRecordings(forged, other, acousticOptions);
  assert.equal(comparison.matched, false);
  assert.ok(comparison.mismatches.some((entry) => entry.field === "sourcePhaseProof"));
});

test("a forged far-future cooldown cannot suppress a zero-cooldown AlwaysOn source", async () => {
  const original = await capture({ native: false });
  const document = original.configuration.behaviorConfig as SoundBehaviorDocument;
  assert.equal(
    document.profiles.find((profile) => profile.profileId === "profile.continuous-tone")!.rules[0]!
      .cooldownSeconds,
    0,
  );
  const forged = await rebuild(
    original,
    (frames) => {
      frames.shift();
      for (const frame of frames) eraseSources(frame, 1_000_000);
    },
    "run.forged-cooldown-a",
  );
  const other = await rebuild(forged, () => {}, "run.forged-cooldown-b");
  await Promise.all([verifyRecording(forged), verifyRecording(other)]);
  assert.equal(forged.startTick, 1, "the attack cannot depend on the empty tick-zero special case");
  assert.deepEqual(forged.configuration, original.configuration);
  assert.equal(forged.sourcePhaseEvidence!.evidenceClass, "missing");
  const comparison = await compareRecordings(forged, other, acousticOptions);
  assert.equal(comparison.matched, false);
  assert.ok(comparison.mismatches.some((entry) => entry.field === "sourcePhaseProof"));
});

test("deleted or displaced source inputs cannot replace the authoritative recorded object poses", async () => {
  const original = await capture({ native: false });
  for (const attack of ["deletion", "displaced-pose"] as const) {
    const forged = await rebuild(
      original,
      (frames) => {
        for (const frame of frames) {
          const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
          if (attack === "deletion") {
            eraseSources(frame);
            snapshot.inputFrame.objects = snapshot.inputFrame.objects.filter(
              (object) => object.objectId !== "speaker",
            );
          } else {
            snapshot.inputFrame.objects.find(
              (object) => object.objectId === "speaker",
            )!.positionMetres[0] += 0.25;
            for (const state of [snapshot.preStepSnapshot!, snapshot.runtimeSnapshot])
              for (const instance of state.state.instances) instance.positionMetres[0] += 0.25;
            for (const intent of snapshot.voiceIntents) intent.event.positionMetres[0] += 0.25;
            // Frame events and VoiceIntent events can share references, so set
            // the authoritative forged emitter position once instead of adding twice.
            const claimedPosition = snapshot.inputFrame.objects.find(
              (object) => object.objectId === "speaker",
            )!.positionMetres;
            for (const event of frame.audioEvents)
              (event as { positionMetres: number[] }).positionMetres = [...claimedPosition];
            frame.acousticFrames = [];
            frame.acousticResultRefs = [];
          }
        }
      },
      `run.forged-input-${attack}-a`,
    );
    const other = await rebuild(forged, () => {}, `run.forged-input-${attack}-b`);
    await Promise.all([verifyRecording(forged), verifyRecording(other)]);
    assert.equal(original.fingerprints.motionTraceHash, forged.fingerprints.motionTraceHash);
    assert.deepEqual(forged.configuration, original.configuration);
    assert.equal(forged.sourcePhaseEvidence!.evidenceClass, "missing", attack);
    const comparison = await compareRecordings(forged, other, acousticOptions);
    assert.equal(comparison.matched, false, attack);
    assert.ok(
      comparison.mismatches.some((entry) => entry.field === "sourcePhaseProof"),
      attack,
    );
  }
});

test("rehashed forged generator or pitch states cannot acquire logical intent proof under unchanged rules", async () => {
  const original = await capture({ native: false });
  assert.equal(original.sourcePhaseEvidence!.evidenceClass, "logicalIntent");
  for (const parameter of ["generator", "pitch"] as const) {
    const forged = await rebuild(
      original,
      (frames) => {
        for (const frame of frames) {
          const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
          for (const state of [snapshot.preStepSnapshot!, snapshot.runtimeSnapshot]) {
            if (parameter === "generator") {
              for (const metadata of state.voiceMetadata)
                metadata.generator = { kind: "oscillator", waveform: "sine", frequencyHz: 880 };
            } else {
              for (const instance of state.state.instances) instance.pitchSemitones = -12;
            }
          }
          for (const intent of snapshot.voiceIntents) {
            if (parameter === "generator")
              intent.generator = { kind: "oscillator", waveform: "sine", frequencyHz: 880 };
            else intent.event.pitchSemitones = -12;
          }
          if (parameter === "pitch")
            for (const event of frame.audioEvents)
              (event as { pitchSemitones: number }).pitchSemitones = -12;
        }
      },
      `run.forged-${parameter}-a`,
    );
    const other = await rebuild(forged, () => {}, `run.forged-${parameter}-b`);
    await Promise.all([verifyRecording(forged), verifyRecording(other)]);
    assert.deepEqual(forged.configuration, original.configuration);
    assert.equal(forged.sourcePhaseEvidence!.evidenceClass, "missing", parameter);
    const comparison = await compareRecordings(forged, other, acousticOptions);
    assert.equal(comparison.matched, false, parameter);
    assert.ok(
      comparison.mismatches.some((entry) => entry.field === "sourcePhaseProof"),
      parameter,
    );
  }
});

test("sample phase proof requires decoded readiness and duration, not a pinned project descriptor alone", async () => {
  const context = new FakeAudioContext();
  const audio = new AudioEngine({ context: context.asContext() });
  await audio.enable(0);
  try {
    const buffer = context.createBuffer(1, 4800, context.sampleRate);
    const pcm = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index++)
      pcm[index] = 0.1 * Math.sin((2 * Math.PI * 220 * index) / context.sampleRate);
    const sha256 = createHash("sha256").update(new Uint8Array(pcm.buffer)).digest("hex");
    const decoded = audio.registerBuffer(
      "asset.original-phase-pcm",
      buffer as unknown as AudioBuffer,
      {
        name: "Original 220 Hz PCM fixture",
        origin: "generated",
        license: "ORIGINAL_TEST_PCM",
        sha256,
      },
    );
    assert.equal(decoded.sha256, sha256);
    assert.equal(decoded.durationSeconds, buffer.length / buffer.sampleRate);
    const pin = { assetId: decoded.assetId, revision: decoded.revision, sha256 };
    const reference: ProjectAsset = {
      ...pin,
      hashKind: "float32MonoPcmBytesSha256",
      name: decoded.name,
      mimeType: "application/x-original-float32-mono",
      byteLength: pcm.byteLength,
      storage: "generatedDescriptor",
      rights: {
        license: decoded.license,
        source: "Original programmatic Float32 PCM fixture; hash covers actual sample bytes",
      },
      generator: {
        algorithm: "tone-v1",
        durationSeconds: decoded.durationSeconds,
        sampleRateHz: 48000,
        frequencyHz: 220,
      },
    };
    const available: BehaviorAsset = {
      ...pin,
      availability: "READY",
      rightsStatus: "APPROVED",
      durationSeconds: decoded.durationSeconds,
    };
    const configuration = fixtureConfiguration();
    const document = configuration.behaviorConfig as SoundBehaviorDocument;
    document.assets = [pin];
    const profile = document.profiles.find(
      (entry) => entry.profileId === "profile.continuous-tone",
    )!;
    profile.presetKind = "creative";
    profile.rules[0]!.generator = {
      kind: "sample",
      asset: pin,
      loop: true,
      startOffsetSeconds: 0.01,
    };
    configuration.generatorConfig = document.profiles.map((entry) =>
      entry.rules.map((rule) => rule.generator),
    );
    configuration.assetManifest = [
      {
        ...reference,
        availability: available.availability,
        rightsStatus: available.rightsStatus,
        durationSeconds: available.durationSeconds,
      },
    ];
    const complete = await capture({
      native: false,
      runId: "run.sample-ready-a",
      configuration,
      assets: [available],
    });
    const completeB = await rebuild(complete, () => {}, "run.sample-ready-b");
    assert.equal(complete.sourcePhaseEvidence!.evidenceClass, "logicalIntent");
    assert.equal((await compareRecordings(complete, completeB, acousticOptions)).matched, true);
    for (const frame of complete.frames) {
      const snapshot = frame.behaviorSnapshot as RecordedBehaviorSnapshot;
      assert.equal(snapshot.runtimeSnapshot.voiceMetadata[0]!.generator.kind, "sample");
      assert.equal(
        snapshot.runtimeSnapshot.voiceMetadata[0]!.expiresAtTick,
        null,
        "an indefinite loop has no expiry from which decoded sample duration may be inferred",
      );
    }
    const descriptorsOnly = async (runId: string) => {
      const recorder = new ExperimentRecorder({
        ...complete.configuration,
        assetManifest: [reference],
        runId,
        runEpoch: complete.runEpoch,
      });
      for (const frame of complete.frames) recorder.appendFrame(frame);
      return recorder.finish();
    };
    const [missing, missingB] = await Promise.all([
      descriptorsOnly("run.sample-descriptor-a"),
      descriptorsOnly("run.sample-descriptor-b"),
    ]);
    await Promise.all([verifyRecording(missing), verifyRecording(missingB)]);
    assert.equal(
      reference.generator!.durationSeconds,
      decoded.durationSeconds,
      "authoring generator duration remains a descriptor, not decoded readiness evidence",
    );
    assert.equal(missing.sourcePhaseEvidence!.evidenceClass, "missing");
    assert.equal(missing.sourcePhaseEvidence!.reason, "SOURCE_ASSET_CONTEXT_UNAVAILABLE");
    const comparison = await compareRecordings(missing, missingB, acousticOptions);
    assert.equal(comparison.matched, false);
    assert.ok(comparison.mismatches.some((entry) => entry.field === "sourcePhaseProof"));
  } finally {
    audio.dispose();
  }
});
