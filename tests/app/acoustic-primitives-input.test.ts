import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import type { AcousticInput } from "../../src/app/acoustic-input.js";
import { solveAcoustics, EXTENDED_SOLVER_VERSION } from "../../src/acoustics/index.js";
import { createDefaultScene, DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import type { SceneSpec } from "../../src/scene/types.js";

function poses(scene: SceneSpec): AcousticInput["poses"] {
  return scene.objects.map((object) => ({
    objectId: object.id,
    positionM: [...object.positionM] as [number, number, number],
    orientationQuaternion: [...object.orientationQuaternion] as [number, number, number, number],
  }));
}
function fixture(): AcousticInput {
  const scene = createDefaultScene();
  const ball = scene.objects.find((object) => object.id === "ball")!;
  scene.objects.push({
    ...structuredClone(ball),
    id: "capsule",
    shape: "capsule",
    dimensionsM: [0.8, 2, 0.8],
    positionM: [2, 1, 0],
    orientationQuaternion: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
    mode: "kinematic",
    acousticRole: "dynamicReflector",
  });
  return {
    scene,
    poses: poses(scene),
    sources: [{ id: "voice.speaker", objectId: "speaker", positionM: [1.5, 1.3, -2] }],
    listener: scene.listener,
    tick: 0,
    materials: structuredClone(DEFAULT_MATERIALS),
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
  };
}
function close(actual: readonly number[], expected: readonly number[]): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]!) <= 1e-12));
}

test("curved builder emits one analytic primitive per sphere/capsule with the actual pose", () => {
  const input = fixture();
  const original = structuredClone(input);
  const request = buildAcousticRequests(input)[0]!;
  assert.equal(request.surfaces.length, 24);
  assert.equal(request.primitives?.length, 2);
  const ball = request.primitives!.find((primitive) => primitive.id === "ball.body")!;
  assert.equal(ball.kind, "sphere");
  assert.equal(ball.radiusM, 0.25);
  assert.equal(ball.role, "dynamicOccluder");
  assert.equal("axis" in ball, false);
  assert.equal("halfLengthM" in ball, false);
  close(ball.centerM, [-0.8, 2, 0]);
  const capsule = request.primitives!.find((primitive) => primitive.id === "capsule.body")!;
  assert.equal(capsule.kind, "capsule");
  assert.equal(capsule.radiusM, 0.4);
  assert.equal(capsule.halfLengthM, 0.6);
  assert.equal(capsule.role, "dynamicReflector");
  close(capsule.centerM, [2, 1, 0]);
  close(capsule.axis!, [-1, 0, 0]);
  assert.deepEqual(input, original);
});

test("actual live/replay pose conventions produce identical primitive geometry", () => {
  const input = fixture();
  const recorded = buildAcousticRequests(input);
  const live = {
    ...input,
    poses: input.poses.map((pose) => {
      assert.ok("positionM" in pose);
      return {
        objectId: pose.objectId,
        positionMetres: [...pose.positionM] as [number, number, number],
        rotation: [...pose.orientationQuaternion] as [number, number, number, number],
      };
    }),
  };
  assert.deepEqual(buildAcousticRequests(live), recorded);
});

test("curved source owners are excluded and per-source primitive snapshots never alias", () => {
  const input = fixture();
  input.sources = [
    { id: "voice.a", objectId: "ball", positionM: [-0.8, 2, 0] },
    { id: "voice.z", objectId: "speaker", positionM: [1.5, 1.3, -2] },
  ];
  const original = structuredClone(input);
  const [first, second] = buildAcousticRequests(input);
  assert.ok(first && second);
  assert.equal(
    first.primitives!.some((primitive) => primitive.id === "ball.body"),
    false,
  );
  assert.equal(
    second.primitives!.some((primitive) => primitive.id === "ball.body"),
    true,
  );
  const a = first.primitives!.find((primitive) => primitive.id === "capsule.body")!;
  const b = second.primitives!.find((primitive) => primitive.id === "capsule.body")!;
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.centerM, b.centerM);
  assert.notStrictEqual(a.axis, b.axis);
  const retained = structuredClone(second);
  Reflect.set(a.centerM, "0", 99);
  Reflect.set(a.axis!, "0", 99);
  assert.deepEqual(second, retained);
  assert.deepEqual(input, original);
});

test("same-revision moving snapshots refresh primitive pose and preserve previous requests", () => {
  const input = fixture();
  const first = buildAcousticRequests(input)[0]!;
  const retained = structuredClone(first);
  const pose = input.poses.find((entry) => entry.objectId === "capsule")!;
  assert.ok("positionM" in pose);
  pose.positionM[0] = -3;
  pose.orientationQuaternion.splice(0, 4, 0, 0, 0, 1);
  input.tick++;
  const next = buildAcousticRequests(input)[0]!;
  const capsule = next.primitives!.find((primitive) => primitive.id === "capsule.body")!;
  close(capsule.centerM, [-3, 1, 0]);
  close(capsule.axis!, [0, 1, 0]);
  assert.equal(next.sceneRevision, first.sceneRevision);
  assert.equal(next.poseTick, first.poseTick + 1);
  assert.deepEqual(first, retained);
});

test("all three shapes honor explicit reflector, occluder and legacy-static role semantics", () => {
  const cases = [
    ["fixed", "staticSurface", "staticReflector"],
    ["dynamicGravity", "staticSurface", "dynamicOccluder"],
    ["kinematic", "dynamicReflector", "dynamicReflector"],
    ["fixed", "dynamicReflector", "dynamicReflector"],
    ["dynamicNoGravity", "dynamicOccluder", "dynamicOccluder"],
    ["fixed", "none", null],
  ] as const;
  for (const shape of ["box", "sphere", "capsule"] as const) {
    for (const [mode, role, expected] of cases) {
      const input = fixture();
      const object = input.scene.objects.find((entry) => entry.id === "capsule")!;
      object.shape = shape;
      object.dimensionsM = shape === "sphere" ? [0.8, 0.8, 0.8] : [0.8, 2, 0.8];
      object.mode = mode;
      object.acousticRole = role;
      input.poses = poses(input.scene);
      const request = buildAcousticRequests(input)[0]!;
      const geometry = [
        ...request.surfaces.filter((surface) => surface.id.startsWith("capsule.")),
        ...(request.primitives ?? []).filter((primitive) => primitive.id === "capsule.body"),
      ];
      assert.equal(geometry.length, expected === null ? 0 : shape === "box" ? 6 : 1);
      assert.ok(geometry.every((item) => item.role === expected));
    }
  }
});

test("105-object default regression remains inside the unchanged 256-entry geometry budget", () => {
  const input = fixture();
  input.scene.objects = input.scene.objects.filter((object) => object.id !== "capsule");
  const ball = input.scene.objects.find((object) => object.id === "ball")!;
  for (let i = 0; i < 99; i++)
    input.scene.objects.push({
      ...structuredClone(ball),
      id: "cloned.ball." + i,
      dimensionsM: [0.3, 0.3, 0.3],
      positionM: [(i % 10) * 0.4 - 2, 0.5, Math.floor(i / 10) * 0.4 - 2],
    });
  assert.equal(input.scene.objects.length, 105);
  input.poses = poses(input.scene);
  const request = buildAcousticRequests(input)[0]!;
  assert.equal(request.surfaces.length, 24);
  assert.equal(request.primitives?.length, 100);
  assert.equal(request.budget?.maxSurfaces, 256);
  input.budget = { maxSurfaces: 124 };
  assert.equal(buildAcousticRequests(input)[0]!.primitives!.length, 100);
  input.budget = { maxSurfaces: 123 };
  assert.throws(() => buildAcousticRequests(input), { code: "SURFACE_BUDGET" });
  input.sources = [{ id: "voice.ball", objectId: "ball", positionM: ball.positionM }];
  assert.equal(buildAcousticRequests(input)[0]!.primitives!.length, 99);
});

test("moving curved geometry requires an authoritative pose except for its emitting owner", () => {
  const input = fixture();
  input.poses = input.poses.filter((pose) => pose.objectId !== "ball");
  assert.throws(() => buildAcousticRequests(input), { code: "POSE_REQUIRED" });
  input.sources = [{ id: "voice.ball", objectId: "ball", positionM: [-0.8, 2, 0] }];
  assert.equal(buildAcousticRequests(input)[0]!.primitives!.length, 1);
  input.poses = [];
  assert.throws(() => buildAcousticRequests(input), { code: "POSE_REQUIRED" });
  input.sources = [];
  assert.deepEqual(buildAcousticRequests(input), []);
});

test("nonfinite, sparse and non-unit curved poses are rejected without changing input", () => {
  for (const corrupt of [
    (object: { positionM: number[] }) => {
      object.positionM[0] = NaN;
    },
    (object: { positionM: number[] }) => {
      delete object.positionM[1];
    },
    (object: { orientationQuaternion: number[] }) => {
      object.orientationQuaternion[3] = 2;
    },
    (object: { orientationQuaternion: number[] }) => {
      delete object.orientationQuaternion[0];
    },
  ]) {
    const input = fixture();
    const pose = input.poses.find((entry) => entry.objectId === "capsule")!;
    assert.ok("positionM" in pose);
    corrupt(pose);
    assert.throws(() => buildAcousticRequests(input), { code: "INVALID_GEOMETRY_POSE" });
  }
});

test("legacy planar-only requests omit primitives and retain box geometry", () => {
  const input = fixture();
  for (const object of input.scene.objects)
    if (object.shape !== "box") object.acousticRole = "none";
  const request = buildAcousticRequests(input)[0]!;
  assert.equal("primitives" in request, false);
  assert.equal("modelVersion" in request, false);
  assert.equal(request.surfaces.length, 24);
  const floor = request.surfaces.find((surface) => surface.id === "floor.py")!;
  assert.deepEqual(floor.verticesM[0], [-3.2, 0, -4.2]);
  assert.deepEqual(floor.normal, [0, 1, 0]);
  assert.equal(floor.role, "staticReflector");
});

test("primitive order stays deterministic under Scene/source reorder", () => {
  const input = fixture();
  input.sources = [
    ...input.sources,
    { id: "voice.ball", objectId: "ball", positionM: [-0.8, 2, 0] },
  ];
  const original = buildAcousticRequests(input);
  input.scene.objects.reverse();
  input.poses = [...input.poses].reverse();
  input.sources = [...input.sources].reverse();
  assert.deepEqual(buildAcousticRequests(input), original);
});

test("Inspector exposes curved material/role controls while retaining running and static-role gates", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Inspector } = await import("../../src/ui/Inspector.js");
  const { LocaleProvider } = await import("../../src/ui/locale.js");
  const { LabRuntime } = await import("../../src/app/runtime.js");
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const base = app.getSnapshot();
    for (const shape of ["sphere", "capsule"] as const) {
      for (const mode of ["fixed", "dynamicGravity"] as const) {
        const model = {
          ...base,
          selectedObjectId: "ball",
          objects: base.objects.map((object) =>
            object.id === "ball"
              ? { ...object, shape, mode, acousticRole: "dynamicReflector" as const }
              : object,
          ),
        };
        const markup = renderToStaticMarkup(
          createElement(LocaleProvider, null, createElement(Inspector, { controller: app, model })),
        );
        const material = markup.match(/<select[^>]*aria-label="聲學材質"[^>]*>/)?.[0];
        const role = markup.match(/<span>聲學角色<\/span><select[^>]*>/)?.[0];
        assert.ok(material && role);
        assert.doesNotMatch(material, /disabled/);
        assert.doesNotMatch(role, /disabled/);
        assert.match(markup, /不含曲率聚焦/);
        assert.match(markup, /準靜態快照/);
        const staticOption = markup.match(/<option value="staticSurface"[^>]*>/)?.[0];
        assert.ok(staticOption);
        assert.equal(staticOption.includes("disabled"), mode !== "fixed");
        const running = renderToStaticMarkup(
          createElement(
            LocaleProvider,
            null,
            createElement(Inspector, {
              controller: app,
              model: { ...model, simulationState: "running" },
            }),
          ),
        );
        assert.match(
          running.match(/<select[^>]*aria-label="聲學材質"[^>]*>/)?.[0] ?? "",
          /disabled/,
        );
      }
    }
  } finally {
    app.dispose();
  }
});

test("one scene pins every source to the same model even when its emitter excludes the only primitive", () => {
  const input = fixture();
  input.scene.objects = input.scene.objects.filter((object) => object.id !== "capsule");
  input.poses = poses(input.scene);
  input.sources = [
    { id: "voice.a", objectId: "ball", positionM: [-0.8, 2, 0] },
    { id: "voice.z", objectId: "speaker", positionM: [1.5, 1.3, -2] },
  ];
  const requests = buildAcousticRequests(input);
  assert.equal("primitives" in requests[0]!, false);
  assert.equal(requests[1]!.primitives!.length, 1);
  for (const request of requests) {
    assert.equal(request.modelVersion, EXTENDED_SOLVER_VERSION);
    assert.equal(solveAcoustics(request).frame.backendVersion, EXTENDED_SOLVER_VERSION);
  }
});

test("the immutable mixed uiScene fixture fits the unchanged geometry cap with analytic box occluders", () => {
  const bytes = fs.readFileSync(new URL("../browser/performance-fixture.mjs", import.meta.url));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "32641b92aa3cd48e9eacdd979f324738567b9a4b61c64b93e14c136f6846546b",
  );
  const source = bytes.toString();
  const constructors = source.slice(
    source.indexOf("const makeBody = "),
    source.indexOf("function wrap("),
  );
  assert.equal(Buffer.byteLength(constructors), 746);
  assert.equal(
    createHash("sha256").update(constructors).digest("hex"),
    "bc7425efb8a07697058e3605e7f5181514e2116f065a81f4858ef70eb7269dc3",
  );
  const scene = JSON.parse(
    JSON.stringify(vm.runInNewContext(constructors + "\nuiScene()", { createDefaultScene })),
  ) as SceneSpec;
  assert.equal(scene.objects.length, 105);
  assert.equal(
    scene.objects.filter(
      (object) => object.id.startsWith("profile.body.") && object.shape === "box",
    ).length,
    33,
  );
  assert.equal(
    scene.objects.filter(
      (object) => object.id.startsWith("profile.body.") && object.shape === "sphere",
    ).length,
    33,
  );
  assert.equal(
    scene.objects.filter(
      (object) => object.id.startsWith("profile.body.") && object.shape === "capsule",
    ).length,
    33,
  );
  const input: AcousticInput = {
    scene,
    poses: poses(scene),
    sources: [{ id: "voice.speaker", objectId: "speaker", positionM: [1.5, 1.3, -2] }],
    listener: scene.listener,
    tick: 0,
    materials: structuredClone(DEFAULT_MATERIALS),
    atmosphere: { medium: "air", speedOfSoundMps: 343 },
  };
  const request = buildAcousticRequests(input)[0]!;
  assert.equal(request.budget!.maxSurfaces, 256);
  assert.equal(request.surfaces.length, 24);
  assert.equal(request.primitives!.length, 67);
  assert.equal(request.boxOccluders!.length, 33);
  assert.equal(solveAcoustics(request).frame.pathAvailability, "available");
  input.budget = { maxSurfaces: 124 };
  assert.equal(buildAcousticRequests(input)[0]!.boxOccluders!.length, 33);
  input.budget = { maxSurfaces: 123 };
  assert.throws(() => buildAcousticRequests(input), { code: "SURFACE_BUDGET" });
});

function compactBoxFixture(): AcousticInput {
  const input = fixture();
  const object = input.scene.objects.find((entry) => entry.id === "capsule")!;
  object.shape = "box";
  object.acousticRole = "dynamicOccluder";
  input.poses = poses(input.scene);
  input.budget = { maxSurfaces: 30 };
  return input;
}

test("per-source compaction uses distinct cache representations and independently owned volumes", () => {
  const input = compactBoxFixture();
  input.sources = [
    { id: "voice.a", objectId: "ball", positionM: [-0.8, 2, 0] },
    { id: "voice.y", objectId: "speaker", positionM: [1.5, 1.3, -2] },
    { id: "voice.z", objectId: "speaker", positionM: [1.5, 1.3, -2] },
  ];
  const original = structuredClone(input);
  const [full, compactA, compactB] = buildAcousticRequests(input);
  assert.ok(full && compactA && compactB);
  assert.equal(full.surfaces.length, 30);
  assert.equal("boxOccluders" in full, false);
  assert.equal(compactA.surfaces.length, 24);
  assert.equal(compactA.boxOccluders!.length, 1);
  const a = compactA.boxOccluders![0]!;
  const b = compactB.boxOccluders![0]!;
  assert.equal(a.id, "capsule.volume");
  assert.equal(a.materialId, "material.metal");
  close(a.centerM, [2, 1, 0]);
  close(a.halfExtentsM, [0.4, 1, 0.4]);
  close(a.orientationQuaternion, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.centerM, b.centerM);
  assert.notStrictEqual(a.halfExtentsM, b.halfExtentsM);
  assert.notStrictEqual(a.orientationQuaternion, b.orientationQuaternion);
  const retained = structuredClone(compactB);
  Reflect.set(a.centerM, "0", 99);
  Reflect.set(a.halfExtentsM, "1", 99);
  Reflect.set(a.orientationQuaternion, "3", 99);
  assert.deepEqual(compactB, retained);
  assert.deepEqual(input, original);
  input.sources = [
    { id: "voice.a", objectId: "speaker", positionM: [1.5, 1.3, -2] },
    { id: "voice.z", objectId: "ball", positionM: [-0.8, 2, 0] },
  ];
  const reverseOrder = buildAcousticRequests(input);
  assert.equal(reverseOrder[0]!.boxOccluders!.length, 1);
  assert.equal(reverseOrder[1]!.surfaces.length, 30);
  assert.equal("boxOccluders" in reverseOrder[1]!, false);
});

test("compacted box pose stays fresh and precise admission accounts for owner exclusion", () => {
  const input = compactBoxFixture();
  input.budget = { maxSurfaces: 26 };
  const first = buildAcousticRequests(input)[0]!;
  const retained = structuredClone(first);
  const pose = input.poses.find((entry) => entry.objectId === "capsule")!;
  assert.ok("positionM" in pose);
  pose.positionM[0] = 4;
  pose.orientationQuaternion.splice(0, 4, 0, 0, 0, 1);
  input.tick++;
  const next = buildAcousticRequests(input)[0]!;
  close(next.boxOccluders![0]!.centerM, [4, 1, 0]);
  close(next.boxOccluders![0]!.orientationQuaternion, [0, 0, 0, 1]);
  assert.equal(next.sceneRevision, first.sceneRevision);
  assert.deepEqual(first, retained);
  input.budget = { maxSurfaces: 25 };
  assert.throws(() => buildAcousticRequests(input), { code: "SURFACE_BUDGET" });
  input.sources = [{ id: "voice.ball", objectId: "ball", positionM: [-0.8, 2, 0] }];
  const owner = buildAcousticRequests(input)[0]!;
  assert.equal(
    owner.surfaces.length + (owner.primitives?.length ?? 0) + owner.boxOccluders!.length,
    25,
  );
  input.sources = [{ id: "voice.box", objectId: "capsule", positionM: [4, 1, 0] }];
  const boxOwner = buildAcousticRequests(input)[0]!;
  assert.equal("boxOccluders" in boxOwner, false);
});

test("reflecting boxes retain exact planes even when a smaller cap would prefer compaction", () => {
  const input = compactBoxFixture();
  input.scene.objects.find((object) => object.id === "capsule")!.acousticRole = "dynamicReflector";
  assert.throws(() => buildAcousticRequests(input), { code: "SURFACE_BUDGET" });
  input.budget = { maxSurfaces: 31 };
  const request = buildAcousticRequests(input)[0]!;
  assert.equal(request.surfaces.length, 30);
  assert.equal("boxOccluders" in request, false);
  assert.ok(
    request.surfaces
      .filter((surface) => surface.id.startsWith("capsule."))
      .every((surface) => surface.role === "dynamicReflector"),
  );
});

test("legacy planar-only scenes never gain a volume field or compact their original faces", () => {
  const input = compactBoxFixture();
  input.scene.objects.find((object) => object.id === "ball")!.acousticRole = "none";
  input.budget = { maxSurfaces: 29 };
  assert.throws(() => buildAcousticRequests(input), { code: "SURFACE_BUDGET" });
  input.budget = { maxSurfaces: 30 };
  const request = buildAcousticRequests(input)[0]!;
  assert.equal(request.surfaces.length, 30);
  assert.equal("boxOccluders" in request, false);
  assert.equal("primitives" in request, false);
  assert.equal("modelVersion" in request, false);
  const face = request.surfaces.find((surface) => surface.id === "capsule.px")!;
  close(face.normal!, [0, 1, 0]);
});

test("detached zone anchors retain binding ownership without deleting the distant owner's occlusion geometry", () => {
  const input = fixture();
  input.sources = [
    { id: "voice.zone", objectId: "ball", emitterObjectId: null, positionM: [2, 4, 0] },
  ];
  const detached = buildAcousticRequests(input)[0]!;
  assert.ok(detached.primitives!.some((primitive) => primitive.id === "ball.body"));
  input.sources = [{ id: "voice.legacy", objectId: "ball", positionM: [-0.8, 2, 0] }];
  const legacy = buildAcousticRequests(input)[0]!;
  assert.equal(
    legacy.primitives!.some((primitive) => primitive.id === "ball.body"),
    false,
  );
  input.sources = [
    { id: "voice.explicit", objectId: "ball", emitterObjectId: "capsule", positionM: [2, 1, 0] },
  ];
  const explicit = buildAcousticRequests(input)[0]!;
  assert.ok(explicit.primitives!.some((primitive) => primitive.id === "ball.body"));
  assert.equal(
    explicit.primitives!.some((primitive) => primitive.id === "capsule.body"),
    false,
  );
  input.sources = [
    { id: "voice.bad", objectId: "ball", emitterObjectId: "missing", positionM: [2, 1, 0] },
  ];
  assert.throws(() => buildAcousticRequests(input), { code: "SOURCE_EMITTER_IDENTITY" });
  input.sources = [
    { id: "voice.bad-owner", objectId: "missing", emitterObjectId: null, positionM: [2, 1, 0] },
  ];
  assert.throws(() => buildAcousticRequests(input), { code: "SOURCE_IDENTITY" });
});

test("explicit emitting bodies require trusted moving poses even while their own geometry is excluded", () => {
  const input = fixture();
  input.sources = [
    { id: "voice.explicit", objectId: "ball", emitterObjectId: "capsule", positionM: [2, 1, 0] },
  ];
  const before = structuredClone(input);
  input.poses = input.poses.filter((pose) => pose.objectId !== "capsule");
  assert.throws(() => buildAcousticRequests(input), { code: "POSE_REQUIRED" });
  input.poses = before.poses;
  const pose = input.poses.find((entry) => entry.objectId === "capsule")!;
  assert.ok("positionM" in pose);
  pose.positionM = [NaN, 1, 0];
  assert.throws(() => buildAcousticRequests(input), { code: "INVALID_GEOMETRY_POSE" });
  pose.positionM = [2, 1, 0];
  pose.orientationQuaternion = [0, 0, 0, 2];
  assert.throws(() => buildAcousticRequests(input), { code: "INVALID_GEOMETRY_POSE" });
  pose.orientationQuaternion = [0, 0, 0, 1];
  assert.equal(
    buildAcousticRequests(input)[0]!.primitives!.some(
      (primitive) => primitive.id === "capsule.body",
    ),
    false,
  );
  input.sources = [
    { id: "voice.fixed", objectId: "ball", emitterObjectId: "speaker", positionM: [1.5, 1.3, -2] },
  ];
  input.poses = input.poses.filter((entry) => entry.objectId !== "speaker");
  assert.doesNotThrow(() => buildAcousticRequests(input));
});
