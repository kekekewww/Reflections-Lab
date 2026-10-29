import test from "node:test";
import assert from "node:assert/strict";
import { prepareStaticPreview } from "../../src/app/static-preview.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
} from "../../src/app/defaults.js";
import type { StaticPreviewInput, CapturedPreviewContact } from "../../src/app/static-preview.js";

function fixture(): StaticPreviewInput {
  const scene = createDefaultScene();
  return {
    state: "paused",
    scene,
    document: createDefaultBehaviors(scene),
    poses: scene.objects.map((object) => ({
      objectId: object.id,
      positionM: [...object.positionM],
      orientationQuaternion: [...object.orientationQuaternion],
    })),
    objectId: "speaker",
    generation: 1,
    bindingId: "binding.continuous.speaker",
    ruleId: "rule.always",
    tick: 12,
    listener: scene.listener,
    materials: DEFAULT_MATERIALS,
    atmosphere: {
      medium: "air",
      speedOfSoundMps: 343,
      bandAbsorptionDbPerM: DEFAULT_MATERIALS[0]!.bands.map(() => 0),
      dataClass: "Synthetic",
    },
  };
}

function contact(input: StaticPreviewInput): CapturedPreviewContact {
  input.objectId = "ball";
  input.bindingId = "binding.interactive.ball";
  input.ruleId = "rule.impact";
  const rule = input.document.profiles.find(
    (profile) => profile.profileId === "profile.interactive-tone",
  )!.rules[0]!;
  const data = {
    pairKey: "pair.ball-floor",
    episodeId: "episode.1",
    objectA: "ball",
    objectB: "floor",
    colliderA: "collider.ball",
    colliderB: "collider.floor",
    materialA: "material.metal",
    materialB: "material.wood",
    pointWorldMetres: [0.25, 0, -1] as [number, number, number],
    normalAtoB: [0, -1, 0] as [number, number, number],
    normalImpulseNewtonSeconds: 2,
    impulseMethod: "RapierContactImpulse" as const,
    closingSpeedMetresPerSecond: 2,
    tangentSpeedMetresPerSecond: 0,
    velocityMethod: "PreStepRigidBodyEstimate" as const,
  };
  return {
    runId: "run.original",
    runEpoch: "epoch.original",
    sceneRevision: input.scene.sceneRevision,
    behaviorDocument: structuredClone(input.document),
    inputEvent: {
      eventId: "physics.contact",
      tick: 9,
      sequence: 1,
      objectId: "ball",
      generation: 1,
      type: "OnImpact",
      source: "physics",
      accepted: true,
      contact: data,
    },
    voice: {
      action: "start",
      generator: structuredClone(rule.generator),
      fadeInSeconds: rule.fadeInSeconds,
      fadeOutSeconds: rule.fadeOutSeconds,
      smoothingSeconds: 0.015,
      event: {
        eventId: "audio.contact",
        parentPhysicsEventId: "physics.contact",
        experimentId: "experiment.original",
        runEpoch: "epoch.original",
        sceneRevision: input.scene.sceneRevision,
        tick: 9,
        simulationTimeSeconds: 9 / 60,
        fixedDtSeconds: 1 / 60,
        sequence: 2,
        objectId: "ball",
        generation: 1,
        bindingId: input.bindingId,
        profileId: "profile.interactive-tone",
        profileRevision: 1,
        ruleId: input.ruleId,
        trigger: rule.trigger,
        instanceId: "instance.original",
        action: "start",
        positionMetres: data.pointWorldMetres,
        gainLinear: 0.07,
        pitchSemitones: 2,
        contact: data,
      },
    },
  };
}

test("static object preview resolves binding overrides, rotated offset and immutable solver provenance", () => {
  const input = fixture();
  const rule = input.document.profiles[0]!.rules[0]!;
  rule.emitter = { attachment: "object", offsetMetres: [1, 0, 0] };
  const pose = input.poses.find((value) => value.objectId === "speaker")!;
  if ("orientationQuaternion" in pose)
    pose.orientationQuaternion = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const before = structuredClone(input);
  const plan = prepareStaticPreview(input, "preview.test");
  assert.deepEqual(input, before);
  assert.deepEqual(
    plan.metadata.source.positionM.map((value) => Math.round(value * 1e6) / 1e6),
    [1.5, 1.3, -3],
  );
  assert.equal(plan.voice.gainLinear, 10 ** (-24 / 20));
  assert.equal(plan.voice.emissionTimeSeconds, 0);
  assert.equal(plan.voice.durationSeconds, 2);
  assert.equal(plan.metadata.profileRevision, 1);
  assert.equal(plan.metadata.poseTick, 12);
  assert.equal(plan.metadata.solver.requestId, plan.solution.frame.requestId);
  assert.equal(plan.metadata.solver.backendId, "custom-web-geometric");
  assert.equal(plan.metadata.excludedFromExperiment, true);
  assert.ok(plan.solution.frame.paths.some((path) => path.order === 0));
  input.scene.listener.positionM[0] = 99;
  input.document.profiles[0]!.revision = 5;
  assert.equal(plan.metadata.listener.positionM[0], 0);
  assert.equal(plan.metadata.profileRevision, 1);
});

test("Running, Recording and replay refuse preview before any playback or synthetic event", () => {
  for (const state of ["running", "recording", "replaying"] as const) {
    assert.throws(
      () => prepareStaticPreview({ ...fixture(), state }, "preview.refused"),
      /PREVIEW_REQUIRES_PAUSE/,
    );
  }
});

test("contact preview refuses missing evidence and reproduces captured content/contact parameters", () => {
  const input = fixture();
  const captured = contact(input);
  assert.throws(() => prepareStaticPreview(input, "preview.missing"), /CONTACT_EVENT_REQUIRED/);
  input.contact = captured;
  const before = structuredClone(input);
  const plan = prepareStaticPreview(input, "preview.contact");
  assert.deepEqual(input, before);
  assert.deepEqual(plan.metadata.source.positionM, [0.25, 0, -1]);
  assert.equal(plan.metadata.source.origin, "capturedContact");
  assert.equal(plan.metadata.contact?.audioEventId, "audio.contact");
  assert.equal(plan.metadata.contact?.inputEventId, "physics.contact");
  assert.equal(plan.metadata.contact?.runEpoch, "epoch.original");
  assert.equal(plan.voice.gainLinear, 0.07);
  assert.equal(plan.voice.pitchSemitones, 2);
  assert.equal(plan.voice.durationSeconds, 0.22);
  assert.notEqual(plan.voice.instanceId, captured.voice.event.instanceId);
});

test("mismatched captured object, revision, acceptance, point, generator and source are refused", () => {
  for (const mutate of [
    (value: CapturedPreviewContact) => {
      value.inputEvent.accepted = false;
    },
    (value: CapturedPreviewContact) => {
      value.inputEvent.source = "interaction";
    },
    (value: CapturedPreviewContact) => {
      value.voice.event.generation = 2;
    },
    (value: CapturedPreviewContact) => {
      value.voice.event.profileRevision = 2;
    },
    (value: CapturedPreviewContact) => {
      value.voice.event.parentPhysicsEventId = "different";
    },
    (value: CapturedPreviewContact) => {
      value.voice.event.positionMetres = [9, 9, 9];
    },
    (value: CapturedPreviewContact) => {
      value.voice.generator = { kind: "oscillator", waveform: "sine", frequencyHz: 99 };
    },
  ]) {
    const input = fixture();
    input.contact = contact(input);
    mutate(input.contact);
    assert.throws(
      () => prepareStaticPreview(input, "preview.invalid"),
      /CONTACT_PROVENANCE_MISMATCH/,
    );
  }
});

test("missing mapping inputs, stale binding generation and unsupported zone anchors are explicit errors", () => {
  const mapped = fixture();
  mapped.document.profiles[0]!.rules[0]!.mappings = structuredClone(
    mapped.document.profiles[1]!.rules[0]!.mappings,
  );
  assert.throws(() => prepareStaticPreview(mapped, "preview.mapped"), /MAPPING_INPUT_UNAVAILABLE/);
  assert.throws(
    () => prepareStaticPreview({ ...fixture(), generation: 2 }, "preview.generation"),
    /PREVIEW_SELECTION_MISMATCH/,
  );
  const zone = fixture();
  zone.document.profiles[0]!.rules[0]!.emitter = { attachment: "zone", zoneId: "zone.unknown" };
  assert.throws(() => prepareStaticPreview(zone, "preview.zone"), /EMITTER_UNSUPPORTED/);
});

test("contact material pair selects its accepted captured generator and duration stays bounded", () => {
  const input = fixture();
  const captured = contact(input);
  const generator = {
    kind: "oscillator" as const,
    waveform: "triangle" as const,
    frequencyHz: 600,
  };
  input.document.profiles[1]!.materialPairOverrides.push({
    overrideId: "override.pair",
    ruleId: "rule.impact",
    materialA: "material.wood",
    materialB: "material.metal",
    generator,
  });
  captured.voice.generator = generator;
  captured.behaviorDocument = structuredClone(input.document);
  input.contact = captured;
  const plan = prepareStaticPreview(input, "preview.pair");
  assert.deepEqual(plan.voice.generator, generator);
  assert.throws(
    () => prepareStaticPreview({ ...fixture(), durationSeconds: 4 }, "preview.long"),
    /PREVIEW_DURATION/,
  );
});

test("captured contact refuses binding override edits even when profile revision does not change", () => {
  const input = fixture();
  input.contact = contact(input);
  input.document.bindings
    .find((binding) => binding.bindingId === input.bindingId)!
    .overrides.push({ ruleId: input.ruleId, gainLinear: 0.8 });
  // A revision-aware editor increments document.revision, but byte comparison also catches a bad host.
  assert.throws(
    () => prepareStaticPreview(input, "preview.stale-override"),
    /CONTACT_PROVENANCE_MISMATCH/,
  );
  input.document.revision++;
  assert.throws(
    () => prepareStaticPreview(input, "preview.stale-revision"),
    /CONTACT_PROVENANCE_MISMATCH/,
  );
});
