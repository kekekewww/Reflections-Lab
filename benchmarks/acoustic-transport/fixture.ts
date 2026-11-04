import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import { createScene } from "../../src/scene/index.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { AcousticInput } from "../../src/app/acoustic-input.js";
import type { AcousticMaterial } from "../../src/acoustics/types.js";

export const SOURCE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const ORIGINAL_BUDGET = Object.freeze({
  maxPaths: 8,
  maxSurfaces: 256,
  maxSegmentTests: 10000,
});
export async function loadFormal100Scene(
  options: { root?: string; defaults?: () => SceneSpec } = {},
) {
  const fixturePath = path.join(
    options.root ?? SOURCE_ROOT,
    "tests/browser/performance-fixture-v3.mjs",
  );
  const source = await readFile(fixturePath, "utf8");
  const begin = source.indexOf("const makeBody = ");
  const end = source.indexOf("\nfunction wrap(", begin);
  if (begin < 0 || end <= begin || end - begin > 16000)
    throw new Error("COMPONENT_FIXTURE_EXTRACTION");
  const region = source.slice(begin, end);
  // This is the bounded, reviewed data-construction region of this repository's formal fixture.
  // Importing the full module would install browser observers and require a DOM.
  const build = new Function("createDefaultScene", region + "\nreturn uiScene();") as (
    defaults: () => SceneSpec,
  ) => SceneSpec;
  const scene = createScene(build(options.defaults ?? createDefaultScene));
  return {
    scene,
    fixturePath,
    fixtureSha256: createHash("sha256").update(source).digest("hex"),
    constructionSha256: createHash("sha256").update(region).digest("hex"),
  };
}
export function initialFormalInput(scene: SceneSpec): AcousticInput {
  const owned = structuredClone(scene);
  return {
    scene: owned,
    poses: owned.objects.map((object) => ({
      objectId: object.id,
      positionM: [...object.positionM],
      orientationQuaternion: [...object.orientationQuaternion],
    })),
    sources: owned.sources
      .filter((source) => source.playing)
      .map((source) => ({
        id: `preview.${source.id}`,
        objectId: source.objectId,
        positionM: [...owned.objects.find((object) => object.id === source.objectId)!.positionM],
      })),
    listener: { id: owned.listener.id, positionM: [...owned.listener.positionM] },
    tick: 0,
    materials: structuredClone(DEFAULT_MATERIALS),
    atmosphere: { medium: "air", temperatureC: 20 },
    budget: { ...ORIGINAL_BUDGET },
  };
}
const objectIdentity = (scene: SceneSpec) =>
  [...scene.objects].sort((a, b) => a.id.localeCompare(b.id));
export function qualifyPrimaryInput(
  input: AcousticInput,
  original: SceneSpec,
  materials: readonly AcousticMaterial[] = DEFAULT_MATERIALS,
) {
  try {
    assert.equal(input.scene.objects.length, 105);
    const dynamic = input.scene.objects.filter((object) => object.mode.startsWith("dynamic"));
    assert.equal(dynamic.length, 100);
    assert.deepEqual(objectIdentity(input.scene), objectIdentity(original));
    assert.deepEqual(input.scene.sources, original.sources);
    assert.deepEqual(input.scene.listener, original.listener);
    assert.deepEqual(input.scene.gravityMps2, original.gravityMps2);
    assert.equal(input.scene.seed, original.seed);
    assert.deepEqual(input.materials, materials);
    assert.deepEqual(input.budget, ORIGINAL_BUDGET);
    assert.equal(input.poses.length, 105);
    assert.equal(new Set(input.poses.map((pose) => pose.objectId)).size, 105);
    assert.deepEqual(
      [...input.poses.map((pose) => pose.objectId)].sort(),
      input.scene.objects.map((object) => object.id).sort(),
    );
    assert.ok(input.sources.length > 0, "do not replace a formal request by an empty batch");
    return {
      objects: 105,
      dynamicBodies: 100,
      fixedBodies: 5,
      sourceCount: input.sources.length,
      budget: { ...ORIGINAL_BUDGET },
      materialCount: input.materials.length,
    };
  } catch (error) {
    throw new Error("COMPONENT_WORKLOAD_MISMATCH", { cause: error });
  }
}
