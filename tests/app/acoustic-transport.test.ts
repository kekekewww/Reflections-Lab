import { acousticPayloadBytes } from "../../src/app/acoustic-payload.js";
import test from "node:test";
import assert from "node:assert/strict";
import { packAcousticBatch, unpackAcousticBatch } from "../../src/app/acoustic-transport.js";
import {
  solveAcoustics,
  createBoxSurfaces,
  EXTENDED_SOLVER_VERSION,
} from "../../src/acoustics/index.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";
import { DEFAULT_MATERIALS } from "../../src/app/defaults.js";

function requests(): AcousticRequest[] {
  const surfaces = createBoxSurfaces({
    id: "wall",
    positionM: [0, 0, 0],
    orientationQuaternion: [0, 0, 0, 1],
    dimensionsM: [1, 8, 8],
    materialId: DEFAULT_MATERIALS[0]!.id,
    role: "staticReflector",
  });
  return Array.from({ length: 8 }, (_, index) => ({
    requestId: `request.${index}`,
    sceneRevision: 2,
    geometryRevision: 2,
    poseTick: 20,
    topologyId: "scene.test",
    source: { id: `voice.${index}`, positionM: [-2, 1, index / 10] },
    listener: { id: "listener", positionM: [-3, 1, 1] },
    surfaces: structuredClone(surfaces),
    materials: structuredClone(DEFAULT_MATERIALS),
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
    budget: { maxPaths: 8 },
  }));
}

test("a compact batch sends each exact shared geometry/material value once and preserves solver output", () => {
  const input = requests();
  const packet = packAcousticBatch(input);
  assert.equal(packet.surfaces.length, 6);
  assert.equal(packet.materials.length, DEFAULT_MATERIALS.length);
  const decoded = unpackAcousticBatch(structuredClone(packet));
  assert.deepEqual(decoded, input);
  assert.deepEqual(decoded.map(solveAcoustics), input.map(solveAcoustics));
  assert.ok(JSON.stringify(packet).length < JSON.stringify(input).length / 2);
});

test("packet data is independently owned and keeps exact negative zero and explicit optional properties", () => {
  const input = requests();
  input[0]!.surfaces = [{ ...input[0]!.surfaces[0]! }];
  Reflect.set(input[0]!.surfaces[0]!, "normal", undefined);
  input[1]!.surfaces = [{ ...input[0]!.surfaces[0]!, normal: [-0, 0, 1] }];
  input[2]!.surfaces = [{ ...input[0]!.surfaces[0]!, normal: [0, 0, 1] }];
  const before = structuredClone(input);
  const packet = packAcousticBatch(input);
  input[0]!.materials[0]!.label = "caller mutation";
  Reflect.set(input[1]!.surfaces[0]!.normal!, "0", 999);
  const decoded = unpackAcousticBatch(packet);
  assert.deepEqual(decoded, before);
  assert.ok(Object.is(decoded[1]!.surfaces[0]!.normal![0], -0));
  assert.ok(!Object.is(decoded[2]!.surfaces[0]!.normal![0], -0));
  assert.ok(Object.hasOwn(decoded[0]!.surfaces[0]!, "normal"));
});

test("same revision content changes, role changes and source exclusions cannot alias the previous packet", () => {
  const input = requests();
  const first = packAcousticBatch(input);
  const old = structuredClone(first);
  input[1]!.surfaces = input[1]!.surfaces.slice(1);
  input[2]!.surfaces = input[2]!.surfaces.map((value) => ({ ...value, role: "dynamicOccluder" }));
  const material = structuredClone(input[3]!.materials[0]!);
  material.bands = material.bands.map((band) => ({
    ...band,
    reflectionEnergy: 0.2,
    absorptionEnergy: 0.8,
    transmissionEnergy: 0,
  }));
  input[3]!.materials = [material];
  const next = packAcousticBatch(input);
  assert.deepEqual(unpackAcousticBatch(next), input);
  assert.deepEqual(first, old);
  assert.notDeepEqual(next, first);
});

test("analytic primitives and closed box occluders retain their model pins and exact membership", () => {
  const input = requests().slice(0, 2);
  for (const request of input) {
    request.modelVersion = EXTENDED_SOLVER_VERSION;
    request.primitives = [
      {
        id: "ball.body",
        kind: "sphere",
        materialId: DEFAULT_MATERIALS[0]!.id,
        centerM: [1, 2, 3],
        radiusM: 0.5,
        role: "dynamicOccluder",
      },
    ];
    request.boxOccluders = [
      {
        id: "crate.volume",
        materialId: DEFAULT_MATERIALS[0]!.id,
        centerM: [2, 3, 4],
        halfExtentsM: [1, 2, 3],
        orientationQuaternion: [0, 0, 0, 1],
      },
    ];
  }
  input[1]!.primitives = [];
  const packet = packAcousticBatch(input);
  assert.equal(packet.primitives.length, 1);
  assert.equal(packet.boxOccluders.length, 1);
  const decoded = unpackAcousticBatch(packet);
  assert.deepEqual(decoded, input);
  assert.deepEqual(decoded.map(solveAcoustics), input.map(solveAcoustics));
});

test("packet references, containers and aggregate source caps are bounded before reconstruction", () => {
  const packet = packAcousticBatch(requests());
  for (const reference of [-1, 0.5, Number.MAX_SAFE_INTEGER, NaN]) {
    const invalid = structuredClone(packet);
    invalid.requests[0]!.surfaceRefs[0] = reference;
    assert.throws(() => unpackAcousticBatch(invalid), /ACOUSTIC_PACKET/);
  }
  const sparse = structuredClone(packet);
  delete sparse.requests[0]!.surfaceRefs[0];
  assert.throws(() => unpackAcousticBatch(sparse), /ACOUSTIC_PACKET/);
  assert.throws(
    () => unpackAcousticBatch({ ...packet, protocol: "old-version" } as never),
    /ACOUSTIC_PACKET/,
  );
  assert.throws(
    () => unpackAcousticBatch({ ...packet, unexpected: [] } as never),
    /ACOUSTIC_PACKET/,
  );
  assert.throws(
    () => packAcousticBatch(Array.from({ length: 33 }, () => requests()[0]!)),
    /ACOUSTIC_PACKET/,
  );
  const oversized = structuredClone(packet);
  oversized.requests[0]!.surfaceRefs = new Array(257).fill(0);
  assert.throws(() => unpackAcousticBatch(oversized), /ACOUSTIC_PACKET/);
});

test("typed content identity cannot alias malformed normal payload with optional undefined", () => {
  const input = requests().slice(0, 2);
  input[0]!.surfaces = [{ ...input[0]!.surfaces[0]! }];
  Reflect.set(input[0]!.surfaces[0]!, "normal", undefined);
  input[1]!.surfaces = [{ ...input[0]!.surfaces[0]! }];
  Reflect.set(input[1]!.surfaces[0]!, "normal", ["acoustic:undefined"]);
  const decoded = unpackAcousticBatch(packAcousticBatch(input));
  assert.deepEqual(decoded, input);
  assert.notStrictEqual(decoded[0]!.surfaces[0], decoded[1]!.surfaces[0]);
  assert.throws(() => solveAcoustics(decoded[1]!));
});

test("transport preserves unsupported model pins so solver rejection is never replaced by a fallback", () => {
  const input = requests().slice(0, 1);
  input[0]!.modelVersion = "unsupported-future-model";
  const decoded = unpackAcousticBatch(packAcousticBatch(input));
  assert.deepEqual(decoded, input);
  assert.throws(() => solveAcoustics(input[0]!), { code: "INVALID_MODEL_VERSION" });
  assert.throws(() => solveAcoustics(decoded[0]!), { code: "INVALID_MODEL_VERSION" });
});

test("an unreferenced or oversized table cannot smuggle work across the Worker boundary", () => {
  const packet = packAcousticBatch(requests());
  const unused = structuredClone(packet);
  unused.surfaces.push(structuredClone(unused.surfaces[0]!));
  assert.throws(() => unpackAcousticBatch(unused), /ACOUSTIC_PACKET/);
  const empty = { ...structuredClone(packet), requests: [] };
  assert.throws(() => unpackAcousticBatch(empty), /ACOUSTIC_PACKET/);
  const huge = structuredClone(packet);
  Reflect.set(huge.surfaces[0]!, "extra", "x".repeat(2 * 1024 * 1024));
  assert.throws(() => unpackAcousticBatch(huge), /ACOUSTIC_PACKET/);
  const aggregate = structuredClone(packet);
  aggregate.surfaces = Array.from({ length: 256 }, (_, index) => {
    const surface = structuredClone(packet.surfaces[0]!);
    surface.id = `surface.${index}`;
    Reflect.set(surface, "boundedNote", "x".repeat(8192));
    return surface;
  });
  aggregate.requests[0]!.surfaceRefs = aggregate.surfaces.map((_surface, index) => index);
  assert.ok(new TextEncoder().encode(JSON.stringify(aggregate)).byteLength > 2 * 1024 * 1024);
  assert.throws(
    () => unpackAcousticBatch(aggregate),
    /ACOUSTIC_PACKET/,
    "aggregate bytes are bounded even when every string, array, table and reference is individually legal",
  );
  const deep = structuredClone(packet);
  let value: unknown = "end";
  for (let index = 0; index < 18; index++) value = { nested: value };
  Reflect.set(deep.surfaces[0]!, "extra", value);
  assert.throws(() => unpackAcousticBatch(deep), /ACOUSTIC_PACKET/);
});

test("custom nonenumerable vector map methods cannot alias distinct numeric geometry", () => {
  const input = requests().slice(0, 2);
  const first = structuredClone(input[0]!.surfaces[0]!);
  first.normal = [1, 0, 0];
  const second = structuredClone(first);
  second.normal = [-1, 0, 0];
  let callerMethodCalls = 0;
  Object.defineProperty(first.normal, "map", {
    value: (map: (value: number, index: number) => unknown) => {
      callerMethodCalls++;
      return [-1, 0, 0].map(map);
    },
    enumerable: false,
  });
  input[0]!.surfaces = [first];
  input[1]!.surfaces = [second];
  const expected = structuredClone(input);
  assert.deepEqual(unpackAcousticBatch(packAcousticBatch(input)), expected);
  assert.equal(callerMethodCalls, 0);
});

test("logical payload node limits count indexed values without executing caller iterators", () => {
  const values = Array.from({ length: 50 }, () => new Array(4096).fill(0));
  let iteratorCalls = 0;
  Object.defineProperty(values, Symbol.iterator, {
    enumerable: false,
    value: function* () {
      iteratorCalls++;
    },
  });
  assert.ok(JSON.stringify(values).length < 2 * 1024 * 1024);
  assert.throws(() => acousticPayloadBytes({ values }), /ACOUSTIC_PAYLOAD_BUDGET/);
  assert.equal(
    iteratorCalls,
    0,
    "payload bounds inspect actual values rather than caller-supplied iteration",
  );
});
