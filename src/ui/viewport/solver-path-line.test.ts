import assert from "node:assert/strict";
import test from "node:test";
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Raycaster,
  Vector3,
} from "three";
import type { PathView } from "../contracts.js";
import { canonicalTokens } from "../tokens.js";
import * as implementation from "./solver-path-line.js";

const path = (overrides: Partial<PathView> = {}): PathView => ({
  id: "path.1",
  kind: "direct",
  points: [
    [0, 0, 0],
    [1 / 3, 1, 0],
  ],
  distanceM: 1,
  delaySeconds: 0.01,
  ...overrides,
});
const create = (input = path()) => {
  const resource = new implementation.SolverPathLine();
  resource.update(input);
  return resource;
};
function disposals(resource: BufferGeometry | BufferAttribute | LineBasicMaterial) {
  let count = 0;
  resource.addEventListener("dispose", () => count++);
  return () => count;
}

test("same point values in fresh DTOs preserve every resource and skip uploads and bounds", () => {
  const resource = create(),
    line = resource.line,
    geometry = line.geometry;
  const position = geometry.getAttribute("position") as BufferAttribute,
    distance = geometry.getAttribute("lineDistance") as BufferAttribute;
  const material = line.material,
    sphere = geometry.boundingSphere;
  const versions = [position.version, distance.version];
  geometry.computeBoundingSphere = () => assert.fail("unchanged bounds recomputed");
  for (let index = 0; index < 20; index++) resource.update(path());
  assert.equal(resource.line, line);
  assert.equal(line.geometry, geometry);
  assert.equal(geometry.getAttribute("position"), position);
  assert.equal(geometry.getAttribute("lineDistance"), distance);
  assert.equal(line.material, material);
  assert.equal(geometry.boundingSphere, sphere);
  assert.deepEqual([position.version, distance.version], versions);
  resource.dispose();
});

test("point updates and shrink reuse capacity, draw only active vertices and refresh raycast bounds", () => {
  const resource = create(
    path({
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [100, 100, 100],
      ],
    }),
  );
  const geometry = resource.line.geometry,
    position = geometry.getAttribute("position");
  resource.update(
    path({
      points: [
        [10, 0, 0],
        [12, 0, 0],
      ],
    }),
  );
  assert.equal(resource.line.geometry, geometry);
  assert.equal(geometry.getAttribute("position"), position);
  assert.deepEqual(Array.from(position.array).slice(0, 6), [10, 0, 0, 12, 0, 0]);
  assert.deepEqual(geometry.drawRange, { start: 0, count: 2 });
  assert.deepEqual(geometry.boundingSphere?.center.toArray(), [11, 0, 0]);
  assert.equal(geometry.boundingSphere?.radius, 1);
  const raycaster = new Raycaster(new Vector3(11, 0, 5), new Vector3(0, 0, -1));
  assert.equal(raycaster.intersectObject(resource.line).length, 1);
  resource.dispose();
});

test("capacity growth replaces geometry and attributes and disposes each old resource once", () => {
  const resource = create(),
    line = resource.line,
    geometry = line.geometry;
  const position = geometry.getAttribute("position") as BufferAttribute;
  const distance = geometry.getAttribute("lineDistance") as BufferAttribute;
  const geometryCount = disposals(geometry),
    positionCount = disposals(position),
    distanceCount = disposals(distance);
  const points = Array.from(
    { length: position.count + 1 },
    (_, index): [number, number, number] => [index, index / 3, -index],
  );
  resource.update(path({ points }));
  assert.equal(resource.line, line);
  assert.notEqual(line.geometry, geometry);
  assert.notEqual(line.geometry.getAttribute("position"), position);
  assert.deepEqual(line.geometry.drawRange, { start: 0, count: points.length });
  resource.update(path({ points: structuredClone(points) }));
  resource.dispose();
  assert.deepEqual([geometryCount(), positionCount(), distanceCount()], [1, 1, 1]);
});

test("material type changes dispose once while style-only changes keep material and geometry", () => {
  const resource = create(),
    basic = resource.line.material,
    geometry = resource.line.geometry;
  const basicCount = disposals(basic);
  resource.update(path({ kind: "reflection", stale: true }));
  assert.equal(resource.line.material, basic);
  assert.equal(basic.opacity, 0.5);
  assert.equal(
    basic.color.getHexString(),
    canonicalTokens.color.warning.$value.slice(1).toLowerCase(),
  );
  resource.update(path({ kind: "blocked" }));
  const dashed = resource.line.material,
    dashedCount = disposals(dashed);
  assert.ok(dashed instanceof LineDashedMaterial);
  assert.deepEqual([dashed.dashSize, dashed.gapSize, dashed.opacity], [0.1, 0.07, 0.8]);
  resource.update(path({ kind: "transmission", stale: true }));
  assert.equal(resource.line.material, dashed);
  assert.equal(dashed.opacity, 0.5);
  resource.update(path());
  assert.ok(resource.line.material instanceof LineBasicMaterial);
  assert.ok(!(resource.line.material instanceof LineDashedMaterial));
  assert.equal(resource.line.geometry, geometry);
  assert.deepEqual([basicCount(), dashedCount()], [1, 1]);
  resource.dispose();
  assert.deepEqual([basicCount(), dashedCount()], [1, 1]);
});

test("positions and cumulative dashed distances match Three's original Float32 calculation", () => {
  const input = path({
    kind: "transmission",
    points: [
      [1 / 3, 2 / 7, 0],
      [3, 4, 1 / 9],
      [-2, 1 / 3, 5],
    ],
  });
  const resource = create(input),
    geometry = resource.line.geometry;
  const distance = geometry.getAttribute("lineDistance");
  input.points[1] = [5 / 3, -8, 3];
  resource.update(input);
  const reference = new Line(
    new BufferGeometry().setFromPoints(input.points.map((point) => new Vector3(...point))),
    new LineDashedMaterial(),
  );
  reference.computeLineDistances();
  assert.deepEqual(
    Array.from(geometry.getAttribute("position").array).slice(0, 9),
    Array.from(reference.geometry.getAttribute("position").array),
  );
  assert.deepEqual(
    Array.from(geometry.getAttribute("lineDistance").array).slice(0, 3),
    Array.from(reference.geometry.getAttribute("lineDistance").array),
  );
  assert.equal(geometry.getAttribute("lineDistance"), distance);
  resource.dispose();
  reference.geometry.dispose();
  reference.material.dispose();
});

test("dispose is idempotent and cannot resurrect released resources", () => {
  const resource = create();
  const counts = [
    resource.line.geometry,
    resource.line.material,
    ...Object.values(resource.line.geometry.attributes),
  ].map((value) => disposals(value as BufferAttribute));
  resource.dispose();
  resource.dispose();
  assert.deepEqual(
    counts.map((count) => count()),
    [1, 1, 1, 1],
  );
  assert.throws(() => resource.update(path()), /disposed/i);
});

test("style-only changes do not upload point buffers or recompute bounds", () => {
  const resource = create();
  const geometry = resource.line.geometry;
  const position = geometry.getAttribute("position") as BufferAttribute;
  const distances = geometry.getAttribute("lineDistance") as BufferAttribute;
  const versions = [position.version, distances.version];
  geometry.computeBoundingSphere = () => assert.fail("style changed bounds");
  resource.update(path({ kind: "blocked", stale: true }));
  assert.deepEqual([position.version, distances.version], versions);
  resource.dispose();
});

test("all path kinds retain the original colors, transparency and opacity", () => {
  const colors = canonicalTokens.color;
  const resource = create();
  for (const kind of ["direct", "reflection", "blocked", "transmission"] as const) {
    for (const stale of [false, true]) {
      resource.update(path({ kind, stale }));
      const material = resource.line.material;
      const color = stale
        ? colors.warning.$value
        : kind === "direct"
          ? colors.success.$value
          : kind === "blocked"
            ? colors.danger.$value
            : kind === "transmission"
              ? colors.textSecondary.$value
              : colors.accent.$value;
      assert.equal(material.color.getHexString(), color.slice(1).toLowerCase());
      assert.equal(
        material.opacity,
        stale ? 0.5 : kind === "blocked" || kind === "transmission" ? 0.8 : 0.9,
      );
      assert.equal(material.transparent, true);
    }
  }
  resource.dispose();
});

test("clearing points removes all draw and raycast segments while retaining capacity", () => {
  const resource = create();
  const geometry = resource.line.geometry;
  resource.update(path({ points: [] }));
  assert.equal(resource.line.geometry, geometry);
  assert.deepEqual(geometry.drawRange, { start: 0, count: 0 });
  assert.equal(geometry.boundingSphere?.radius, 0);
  const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
  assert.deepEqual(raycaster.intersectObject(resource.line), []);
  resource.dispose();
});

test("an unpickable line lets picking rays through to the surfaces behind it, and picks again once restored", () => {
  const resource = create();
  // 0.43 m beside the drawn segment: still a hit under three.js's 1 m default line threshold.
  const raycaster = new Raycaster(new Vector3(0.6, 0.5, 5), new Vector3(0, 0, -1));
  assert.equal(raycaster.intersectObject(resource.line).length, 1);
  resource.setPickable(false);
  assert.deepEqual(raycaster.intersectObject(resource.line), []);
  // Picking is independent of drawing: point updates keep the line unpickable.
  resource.update(
    path({
      points: [
        [0, 0, 0],
        [1, 1, 0],
      ],
    }),
  );
  assert.deepEqual(raycaster.intersectObject(resource.line), []);
  resource.setPickable(true);
  assert.equal(raycaster.intersectObject(resource.line).length, 1);
  resource.dispose();
});
