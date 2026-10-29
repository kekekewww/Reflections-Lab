import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Vector3, Plane, Ray, REVISION } from "three";
import RAPIER from "@dimforge/rapier3d-compat";

const require = createRequire(import.meta.url);
const packageMetadata = (name) => {
  // Resolve the package entry, then walk to metadata without relying on an unexported subpath.
  let location = dirname(require.resolve(name));
  for (let i = 0; i < 5; i++) {
    try {
      const value = JSON.parse(readFileSync(join(location, "package.json"), "utf8"));
      if (value.name === name) return value;
    } catch {
      /* next parent */
    }
    location = dirname(location);
  }
  throw new Error(`cannot locate metadata for ${name}`);
};
const three = packageMetadata("three"),
  rapier = packageMetadata("@dimforge/rapier3d-compat");
assert.equal(three.version, "0.186.1");
assert.equal(rapier.version, "0.21.0");
const hit = new Ray(new Vector3(0, 1, 0), new Vector3(0, -1, 0)).intersectPlane(
  new Plane(new Vector3(0, 1, 0), 0),
  new Vector3(),
);
assert.deepEqual(hit.toArray(), [0, 0, 0]);
await RAPIER.init();
assert.equal(RAPIER.version(), "0.21.0");
const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
assert.ok(world.bodies);
world.free();
console.log(
  JSON.stringify(
    {
      status: "PASS",
      scope:
        "Node import + Three mathematical ray + Rapier WASM initialize/free only; no browser/render/audio claim",
      node: process.version,
      three: three.version,
      threeRevision: REVISION,
      rapier: rapier.version,
    },
    null,
    2,
  ),
);
