import test from "node:test";
import assert from "node:assert/strict";
import { createZoneDraft, nextZoneId, zoneDraftError, zoneFromDraft } from "./zone-panel-model.js";
import { editableRulePatch, sameEditableRule } from "./rule-drafts.js";
import type { BehaviorRuleView } from "./contracts.js";
import type { SceneZone } from "../scene/types.js";
import { zoneRegistryPin } from "../app/zone-registry-pin.js";

const zone: SceneZone = {
  id: "zone.room",
  name: "Room",
  shape: "aabb",
  centerM: [0, 1, 0],
  halfExtentsM: [1, 2, 3],
  hysteresisM: 0.02,
  enabled: true,
};
const rule: BehaviorRuleView = {
  id: "rule.zone",
  trigger: "OnEnterZone",
  zoneId: "zone.room",
  enabled: true,
  gainLinear: 0.25,
  pitchSemitones: 0,
  cooldownSeconds: 0.1,
};

test("a new zone ID is stable against existing IDs rather than array position", () => {
  assert.equal(
    nextZoneId([
      { ...zone, id: "zone.1" },
      { ...zone, id: "zone.3" },
    ]),
    "zone.2",
  );
  assert.equal(
    nextZoneId([
      { ...zone, id: "zone.3" },
      { ...zone, id: "zone.1" },
    ]),
    "zone.2",
  );
  const draft = createZoneDraft(zone, 12, [zone]);
  assert.equal(draft.id, zone.id);
  assert.equal(draft.existingId, zone.id);
  assert.equal(draft.sceneRevision, 12);
});

test("the zone draft builds only the currently selected shape payload and does not mutate the committed zone", () => {
  const before = structuredClone(zone);
  const draft = createZoneDraft(zone, 12, [zone]);
  draft.shape = "sphere";
  draft.radius = "2.5";
  draft.name = "  Sphere area  ";
  const saved = zoneFromDraft(draft, [zone]);
  assert.equal(saved.shape, "sphere");
  assert.equal(saved.name, "Sphere area");
  assert.equal("halfExtentsM" in saved, false);
  assert.equal(saved.shape === "sphere" && saved.radiusM, 2.5);
  assert.deepEqual(zone, before);
});

test("invalid numeric text never silently falls back to the previously committed value", () => {
  for (const raw of ["", " ", "NaN", "Infinity", "-201", "201"]) {
    const draft = createZoneDraft(zone, 12, [zone]);
    draft.center[0] = raw;
    assert.equal(zoneDraftError(draft, [zone]), "center");
    assert.throws(() => zoneFromDraft(draft, [zone]), /ZONE_DRAFT_CENTER/);
    assert.equal(zone.centerM[0], 0);
  }
});

test("hysteresis must fit the selected volume, and fields for another shape do not contaminate its payload", () => {
  const draft = createZoneDraft(zone, 12, [zone]);
  draft.halfExtents = ["0.05", "1", "1"];
  draft.hysteresis = "0.05";
  assert.equal(zoneDraftError(draft, [zone]), "hysteresis");
  draft.hysteresis = "0.049";
  assert.equal(zoneDraftError(draft, [zone]), null);
  draft.shape = "sphere";
  draft.radius = "0.04";
  assert.equal(zoneDraftError(draft, [zone]), "radius");
  draft.radius = "1";
  draft.halfExtents[0] = "";
  assert.equal(zoneDraftError(draft, [zone]), null);
  assert.equal("halfExtentsM" in zoneFromDraft(draft, [zone]), false);
});

test("existing zone identity cannot be renamed and new drafts reject duplicates and capacity", () => {
  const draft = createZoneDraft(zone, 12, [zone]);
  draft.id = "zone.changed";
  assert.equal(zoneDraftError(draft, [zone]), "id");
  const fresh = createZoneDraft(null, 12, [zone]);
  fresh.id = zone.id;
  assert.equal(zoneDraftError(fresh, [zone]), "duplicate");
  const full = Array.from({ length: 16 }, (_, index) => ({ ...zone, id: "zone." + index }));
  const overflow = createZoneDraft(null, 12, full);
  assert.equal(zoneDraftError(overflow, full), "capacity");
});

test("zone selectors are authored draft fields and acknowledgements compare their stable IDs", () => {
  assert.equal(editableRulePatch(rule).zoneId, "zone.room");
  assert.equal(sameEditableRule(rule, { ...rule, zoneId: "zone.other" }), false);
  assert.equal("zoneId" in editableRulePatch({ ...rule, trigger: "OnImpact" }), false);
  assert.equal(sameEditableRule(rule, { ...rule }), true);
});

test("a Zone draft pins registry content even when imported project identity and Scene revision are reused", () => {
  const draft = createZoneDraft(zone, 12, [zone]);
  const replacement: SceneZone = { ...zone, halfExtentsM: [2, 3, 4] };
  assert.equal(draft.sceneRevision, 12);
  assert.notEqual(draft.registryPin, zoneRegistryPin([replacement]));
  draft.center[0] = "5";
  assert.equal(
    draft.registryPin,
    zoneRegistryPin([zone]),
    "editing a draft must not replace its baseline",
  );
});

test("a registry pin treats reordered JSON object keys as the same authoring values", () => {
  const reordered: SceneZone = {
    enabled: zone.enabled,
    hysteresisM: zone.hysteresisM,
    halfExtentsM: zone.halfExtentsM,
    centerM: zone.centerM,
    shape: "aabb",
    name: zone.name,
    id: zone.id,
  };
  assert.equal(createZoneDraft(zone, 12, [zone]).registryPin, zoneRegistryPin([reordered]));
  assert.equal(zoneRegistryPin(undefined), zoneRegistryPin([]));
});

test("registry deletion, replacement and author order changes invalidate the pinned draft", () => {
  const other: SceneZone = { ...zone, id: "zone.other", name: "Other" };
  const draft = createZoneDraft(zone, 12, [zone, other]);
  assert.notEqual(draft.registryPin, zoneRegistryPin([other]));
  assert.notEqual(draft.registryPin, zoneRegistryPin([{ ...zone, enabled: false }, other]));
  assert.notEqual(draft.registryPin, zoneRegistryPin([other, zone]));
});
