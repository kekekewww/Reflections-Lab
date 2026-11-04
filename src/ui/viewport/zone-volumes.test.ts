import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import type { SceneZone } from "../../scene/types.js";
import {
  createZoneVolumeGeometry,
  ignoreZoneRaycast,
  zoneVolumeAppearance,
  ZoneVolumes,
} from "./ZoneVolumes.js";

const box: SceneZone = {
  id: "zone.box",
  name: "Box region",
  enabled: true,
  shape: "aabb",
  centerM: [2, 3, 4],
  halfExtentsM: [1, 2, 3],
  hysteresisM: 0.02,
};
const sphere: SceneZone = {
  id: "zone.sphere",
  name: "Sphere region",
  enabled: false,
  shape: "sphere",
  centerM: [-1, 1, 0],
  radiusM: 2.5,
  hysteresisM: 0.02,
};

test("AABB wireframe geometry spans the authored half extents, with translation owned by the view", () => {
  const before = structuredClone(box),
    geometry = createZoneVolumeGeometry(box);
  try {
    geometry.computeBoundingBox();
    assert.deepEqual(geometry.boundingBox!.min.toArray(), [-1, -2, -3]);
    assert.deepEqual(geometry.boundingBox!.max.toArray(), [1, 2, 3]);
    assert.deepEqual(box, before);
  } finally {
    geometry.dispose();
  }
});

test("sphere vertices lie on the authored radius without borrowing a physical Scene object", () => {
  const before = structuredClone(sphere),
    geometry = createZoneVolumeGeometry(sphere);
  try {
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      const radius = Math.hypot(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      );
      assert.ok(Math.abs(radius - sphere.radiusM) < 1e-6);
    }
    assert.deepEqual(sphere, before);
  } finally {
    geometry.dispose();
  }
});

test("disabled regions retain a subdued distinct authoring appearance", () => {
  const enabled = zoneVolumeAppearance(true),
    disabled = zoneVolumeAppearance(false);
  assert.notEqual(enabled.color, disabled.color);
  assert.ok(enabled.opacity > disabled.opacity && disabled.opacity > 0);
  assert.ok(enabled.opacity <= 1);
});

test("real Three raycasting passes through zone wireframes to the physical object behind", () => {
  const zoneGeometry = createZoneVolumeGeometry(box),
    objectGeometry = createZoneVolumeGeometry(box);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const overlay = new Mesh(zoneGeometry, material),
    physical = new Mesh(objectGeometry, material);
  const group = new Group();
  physical.position.z = -8;
  group.add(overlay, physical);
  group.updateMatrixWorld(true);
  const raycaster = new Raycaster(new Vector3(0, 0, 8), new Vector3(0, 0, -1));
  try {
    assert.ok(
      raycaster.intersectObject(overlay).length > 0,
      "fixture must hit without suppression",
    );
    overlay.raycast = ignoreZoneRaycast;
    const hits = raycaster.intersectObject(group, true);
    assert.ok(hits.length > 0);
    assert.ok(hits.every((hit) => hit.object === physical));
  } finally {
    zoneGeometry.dispose();
    objectGeometry.dispose();
    material.dispose();
  }
});

test("FPS and replay SSR do not expose current Zone overlays over their own scene", () => {
  for (const mode of ["fps-interact", "fps-build"] as const)
    assert.equal(
      renderToStaticMarkup(createElement(ZoneVolumes, { zones: [box, sphere], mode })),
      "",
    );
  assert.equal(
    renderToStaticMarkup(
      createElement(ZoneVolumes, { zones: [box], mode: "editor", replaying: true }),
    ),
    "",
  );
  assert.equal(
    renderToStaticMarkup(createElement(ZoneVolumes, { zones: undefined, mode: "editor" })),
    "",
  );
});

test("editor view preserves each declared Zone identity and enabled state", () => {
  const regions = [box, sphere],
    before = structuredClone(regions);
  const overlay = ZoneVolumes({ zones: regions, mode: "editor" });
  assert.ok(overlay);
  assert.equal(overlay.type, "group");
  const children = overlay.props.children;
  assert.equal(children.length, 2);
  assert.deepEqual(
    children.map((child: { key: string | null }) => child.key),
    ["zone.box", "zone.sphere"],
  );
  assert.deepEqual(regions, before);
});
