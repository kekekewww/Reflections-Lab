import test from "node:test";
import assert from "node:assert/strict";
import { prepareStaticPreview } from "../../src/app/static-preview.js";
import {
  createDefaultScene,
  createDefaultBehaviors,
  DEFAULT_MATERIALS,
  makeBehaviorContext,
} from "../../src/app/defaults.js";
import { createBehaviorRuntime } from "../../src/audio-behavior/index.js";
import { frame, object, options } from "../audio-behavior/fixtures.js";
import type { StaticPreviewInput } from "../../src/app/static-preview.js";
function fixture(): StaticPreviewInput {
  const scene = createDefaultScene();
  scene.zones = [
    {
      id: "zone.preview",
      name: "Preview",
      enabled: true,
      shape: "sphere",
      centerM: [0, 1, 0],
      radiusM: 1,
      hysteresisM: 0.05,
    },
  ];
  const document = createDefaultBehaviors(scene);
  const rule = document.profiles.find((p) => p.profileId === "profile.continuous-tone")!.rules[0]!;
  rule.emitter = { attachment: "zone", zoneId: "zone.preview" };
  return {
    state: "paused",
    scene,
    document,
    poses: scene.objects.map((o) => ({
      objectId: o.id,
      positionM: o.positionM,
      orientationQuaternion: o.orientationQuaternion,
    })),
    objectId: "speaker",
    generation: 1,
    bindingId: "binding.continuous.speaker",
    ruleId: rule.ruleId,
    tick: 12,
    listener: scene.listener,
    materials: DEFAULT_MATERIALS,
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
  };
}
test("explicit Zone emitter preview uses the registered centre and records that anchor without changing Scene", () => {
  const input = fixture(),
    before = structuredClone(input.scene);
  const plan = prepareStaticPreview(input, "preview.zone");
  assert.equal(plan.metadata.source.origin, "zoneCenter");
  assert.deepEqual(plan.metadata.source.positionM, [0, 1, 0]);
  assert.deepEqual(input.scene, before);
  assert.equal(plan.metadata.excludedFromExperiment, true);
});
test("missing Zone preview anchor is refused rather than using an invented point", () => {
  const input = fixture();
  delete input.scene.zones;
  assert.throws(() => prepareStaticPreview(input, "preview.zone"), /ZONE_REFERENCE_UNAVAILABLE/);
});
test("disabling occupancy preserves an explicitly authored zone-center anchor for live and preview", () => {
  const input = fixture();
  input.scene.zones![0]!.enabled = false;
  const context = makeBehaviorContext(
    input.scene,
    input.scene.objects.map((o) => ({ objectId: o.id, generation: 1 })),
  );
  const runtime = createBehaviorRuntime(input.document, context, {
    ...options,
    fixedDtSeconds: 1 / 60,
  });
  const snapshot = frame(
    1,
    [],
    input.scene.objects.map((o) => object({ objectId: o.id, positionMetres: o.positionM })),
  );
  snapshot.sceneRevision = input.scene.sceneRevision;
  const output = runtime.step(snapshot);
  const anchored = output.events.find((event) => event.bindingId === input.bindingId);
  assert.ok(anchored);
  assert.deepEqual(anchored.positionMetres, [0, 1, 0]);
  const plan = prepareStaticPreview(input, "preview.disabled-anchor");
  assert.deepEqual(plan.metadata.source.positionM, anchored.positionMetres);
});
