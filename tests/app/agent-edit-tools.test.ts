import test from "node:test";
import assert from "node:assert/strict";
import { LabRuntime } from "../../src/app/runtime.js";
import type { AgentHost } from "../../src/ai/host.js";
import type { PlannerProvenance, ToolName, ToolRequest } from "../../src/ai/types.js";
import { canonicalJson } from "../../src/ai/validation.js";
import type { PhysicsWorld } from "../../src/physics/index.js";
import type { SceneSpec } from "../../src/scene/types.js";

// Everything here runs through the real AgentHost, scene adapter, Motion workspace and physics
// world, because the risk in these tools is what they leave behind outside the scene document.
const provenance: PlannerProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
};
const IDENTITY = [0, 0, 0, 1];
type Call = [ToolName, Record<string, unknown>];

function host(app: LabRuntime): AgentHost {
  return (app.getAgentSession() as unknown as { sceneHost: AgentHost }).sceneHost;
}
function world(app: LabRuntime): PhysicsWorld {
  return (app as unknown as { world: PhysicsWorld }).world;
}
let sequence = 0;
function requests(scene: SceneSpec, calls: Call[]): ToolRequest[] {
  const batch = ++sequence;
  return calls.map(([tool, args], index) => ({
    schemaVersion: "1.0.0",
    requestId: `request.edit-${batch}-${index + 1}`,
    tool,
    sceneId: scene.sceneId,
    expectedSceneRevision: scene.sceneRevision,
    transactionId: `transaction.edit-${batch}`,
    arguments: args,
  }));
}
async function propose(app: LabRuntime, calls: Call[]) {
  return host(app).stage(requests(app.getSceneDocument(), calls), provenance);
}
async function applyCalls(app: LabRuntime, calls: Call[]) {
  const preview = await propose(app, calls);
  await host(app).apply(preview.previewId, preview.digest);
  return preview;
}
function withoutRevision(scene: SceneSpec) {
  const { sceneRevision: _revision, ...content } = scene;
  return content;
}
// A restored or rebuilt object is a new physics body, so bindings correctly follow its new generation.
function behaviorContent(app: LabRuntime) {
  const { revision: _revision, bindings, ...content } = app.getBehaviorDocument();
  return {
    ...content,
    bindings: bindings.map(({ objectGeneration: _generation, ...binding }) => binding),
  };
}
// Rapier stores positions in 32-bit floats.
function assertNear(actual: readonly number[], expected: readonly number[]): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) =>
    assert.ok(Math.abs(value - expected[index]!) < 1e-5, `${value} ≈ ${expected[index]}`),
  );
}
function pathActions(app: LabRuntime) {
  return app
    .getMotionWorkspace()
    .getSnapshot()
    .actions.map(({ generation: _generation, ...action }) => action);
}
function everything(app: LabRuntime): string {
  return canonicalJson({
    scene: app.getSceneDocument(),
    behaviors: app.getBehaviorDocument(),
    motion: app.getMotionWorkspace().getSnapshot(),
  });
}
function ballPath(scene: SceneSpec, start?: number[]): Call[] {
  const ball = scene.objects.find((object) => object.id === "ball")!;
  const [x, y, z] = (start ?? ball.positionM) as [number, number, number];
  return [
    ["SetRigidBodyMode", { objectId: "ball", mode: "kinematic", velocityPolicy: "zero" }],
    [
      "SetTrajectory",
      {
        objectId: "ball",
        interpolation: "linearSlerp",
        samples: [
          { timeS: 0, positionM: [x, y, z], orientationQuaternion: IDENTITY },
          { timeS: 1, positionM: [x + 0.1, y, z], orientationQuaternion: IDENTITY },
        ],
      },
    ],
  ];
}
function box(id: string, positionM: number[]): Call {
  return [
    "AddObject",
    {
      objectId: id,
      label: id,
      shape: "box",
      dimensionsM: [0.5, 0.5, 0.5],
      positionM,
      orientationQuaternion: IDENTITY,
      materialId: "material.wood",
      mode: "fixed",
      massKg: 5,
    },
  ];
}
async function withApp(body: (app: LabRuntime) => Promise<void>): Promise<void> {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await body(app);
  } finally {
    app.dispose();
  }
}
let commandSequence = 0;
async function assertPathRuns(app: LabRuntime): Promise<void> {
  const view = app.getMotionWorkspace().getView();
  assert.equal(view.stale, false, "the Motion panel must not report a stale registry");
  const receipt = await app
    .getMotionWorkspace()
    .start("trajectory.ball", `command.edit-${++commandSequence}`);
  assert.equal(receipt.actionId, "trajectory.ball");
  app.getMotionWorkspace().cancel(receipt.runId);
}

test("MoveObject changes nothing until Apply, moves the body, and Undo puts it back", async () => {
  await withApp(async (app) => {
    const original = app.getSceneDocument();
    const preview = await propose(app, [
      [
        "MoveObject",
        { objectId: "speaker", positionM: [-2, 0.35, -3], orientationQuaternion: IDENTITY },
      ],
    ]);
    assert.deepEqual(preview.changes, ["移動 speaker 到 [-2, 0.35, -3]"]);
    assert.deepEqual(app.getSceneDocument(), original, "preview must not change the scene");
    await host(app).apply(preview.previewId, preview.digest);
    const moved = app.getSceneDocument().objects.find((object) => object.id === "speaker")!;
    assert.deepEqual(moved.positionM, [-2, 0.35, -3]);
    assertNear(world(app).getPose("speaker").positionMetres, [-2, 0.35, -3]);
    assert.equal(app.getSceneDocument().sources[0]!.objectId, "speaker");
    await host(app).undo(preview.previewId);
    assert.deepEqual(withoutRevision(app.getSceneDocument()), withoutRevision(original));
    assertNear(world(app).getPose("speaker").positionMetres, [1.5, 1.3, -2]);
  });
});

test("ResizeObject keeps the shape and Undo restores the size", async () => {
  await withApp(async (app) => {
    const original = app.getSceneDocument();
    const preview = await applyCalls(app, [
      ["ResizeObject", { objectId: "ball", dimensionsM: [0.8, 0.8, 0.8] }],
    ]);
    assert.deepEqual(preview.changes, ["調整 ball 尺寸為 0.8×0.8×0.8 m"]);
    const ball = app.getSceneDocument().objects.find((object) => object.id === "ball")!;
    assert.equal(ball.shape, "sphere");
    assert.deepEqual(ball.dimensionsM, [0.8, 0.8, 0.8]);
    await host(app).undo(preview.previewId);
    assert.deepEqual(withoutRevision(app.getSceneDocument()), withoutRevision(original));
  });
});

test("RemoveObject takes the object's source and bindings, and Undo restores them", async () => {
  await withApp(async (app) => {
    const original = app.getSceneDocument();
    const behaviors = behaviorContent(app);
    assert.ok(behaviors.bindings.some((binding) => binding.objectId === "speaker"));
    const preview = await applyCalls(app, [["RemoveObject", { objectId: "speaker" }]]);
    assert.deepEqual(preview.changes, ["移除 speaker；一併移除聲源 source.speaker"]);
    const scene = app.getSceneDocument();
    assert.equal(
      scene.objects.some((object) => object.id === "speaker"),
      false,
    );
    assert.deepEqual(scene.sources, []);
    assert.equal(
      app.getBehaviorDocument().bindings.some((binding) => binding.objectId === "speaker"),
      false,
    );
    assert.throws(() => world(app).getPose("speaker"));
    await host(app).undo(preview.previewId);
    assert.deepEqual(withoutRevision(app.getSceneDocument()), withoutRevision(original));
    assert.deepEqual(behaviorContent(app), behaviors);
    assertNear(world(app).getPose("speaker").positionMetres, [1.5, 1.3, -2]);
  });
});

test("removing the selected object clears the selection", async () => {
  await withApp(async (app) => {
    assert.equal(app.getSnapshot().selectedObjectId, "ball");
    await applyCalls(app, [["RemoveObject", { objectId: "ball" }]]);
    assert.equal(app.getSnapshot().selectedObjectId, null);
  });
});

test("removing an object with a path removes the path, and Undo restores a path that runs", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const actions = pathActions(app);
    assert.equal(actions.length, 1);
    const preview = await applyCalls(app, [["RemoveObject", { objectId: "ball" }]]);
    assert.deepEqual(preview.changes, ["移除 ball；一併移除路徑 trajectory.ball"]);
    assert.deepEqual(pathActions(app), []);
    assert.equal(app.getMotionWorkspace().getView().stale, false);
    await host(app).undo(preview.previewId);
    assert.deepEqual(pathActions(app), actions);
    await assertPathRuns(app);
  });
});

test("resizing an object with a path keeps the path runnable, before and after Undo", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const actions = pathActions(app);
    const generation = world(app).getPose("ball").generation;
    const preview = await applyCalls(app, [
      ["ResizeObject", { objectId: "ball", dimensionsM: [0.8, 0.8, 0.8] }],
    ]);
    assert.ok(world(app).getPose("ball").generation > generation, "geometry must rebuild the body");
    assert.deepEqual(pathActions(app), actions);
    await assertPathRuns(app);
    await host(app).undo(preview.previewId);
    assert.deepEqual(pathActions(app), actions);
    await assertPathRuns(app);
  });
});

test("adding an unrelated object leaves an existing path runnable, before and after Undo", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const preview = await applyCalls(app, [box("box.new", [2, 0.25, 2])]);
    await assertPathRuns(app);
    await host(app).undo(preview.previewId);
    await assertPathRuns(app);
  });
});

test("applying and undoing while a path is playing stops the run and keeps the path", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const start = await app
      .getMotionWorkspace()
      .start("trajectory.ball", `command.edit-${++commandSequence}`);
    assert.equal(app.getMotionWorkspace().getView().activeRunIds.length, 1);
    assert.equal(start.actionId, "trajectory.ball");
    const preview = await applyCalls(app, [box("box.new", [2, 0.25, 2])]);
    assert.equal(app.getMotionWorkspace().getView().activeRunIds.length, 0);
    assert.equal(pathActions(app).length, 1);
    await app.getMotionWorkspace().start("trajectory.ball", `command.edit-${++commandSequence}`);
    await host(app).undo(preview.previewId);
    assert.equal(app.getMotionWorkspace().getView().activeRunIds.length, 0);
    await assertPathRuns(app);
  });
});

test("applying while the simulation and a path are both running works", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    await app.getMotionWorkspace().start("trajectory.ball", `command.edit-${++commandSequence}`);
    await app.dispatch({ type: "run" });
    app.advance(0.2);
    await applyCalls(app, [box("box.new", [2, 0.25, 2])]);
    assert.ok(app.getSceneDocument().objects.some((object) => object.id === "box.new"));
    assert.equal(app.getMotionWorkspace().getView().activeRunIds.length, 0);
  });
});

function boxes(prefix: string, count: number): Call[] {
  return Array.from({ length: count }, (_, index) =>
    box(`${prefix}.${index}`, [-2.5 + (index % 8) * 0.7, 0.25, -3 + Math.floor(index / 8) * 0.8]),
  );
}
test("a proposal that would silence the scene is rejected at preview, with the numbers", async () => {
  await withApp(async (app) => {
    // The default room counts 25: floor and 3 walls at 6 each, plus the ball. 38 boxes make 253.
    await applyCalls(app, boxes("first", 30));
    const before = everything(app);
    await assert.rejects(propose(app, boxes("second", 9)), (error: Error & { code?: string }) => {
      assert.equal(error.code, "ACOUSTIC_BUDGET");
      assert.match(error.message, /259/);
      assert.match(error.message, /256/);
      return true;
    });
    assert.equal(everything(app), before);
  });
});

test("a proposal up to the limit is accepted and the acoustics still solve", async () => {
  await withApp(async (app) => {
    await applyCalls(app, boxes("first", 30));
    await applyCalls(app, boxes("second", 8));
    assert.doesNotMatch(
      JSON.stringify(app.getSnapshot()),
      /SURFACE_BUDGET|exceeds the shared surface/,
    );
  });
});

test("the limit check matches what the solver really refuses", async () => {
  await withApp(async (app) => {
    await applyCalls(app, boxes("first", 30));
    await applyCalls(app, boxes("second", 8));
    // One box more through the editor, which has no limit check, passes 256.
    await app.dispatch({ type: "duplicateObject", objectId: "first.0" });
    assert.match(JSON.stringify(app.getSnapshot()), /exceeds the shared surface|SURFACE_BUDGET/);
  });
});

test("a scene already over the limit can still get edits, and sound returns once it fits", async () => {
  await withApp(async (app) => {
    await applyCalls(app, boxes("first", 30));
    await applyCalls(app, boxes("second", 8));
    assert.ok(app.getSnapshot().paths.length > 0);
    await app.dispatch({ type: "duplicateObject", objectId: "first.0" });
    assert.equal(app.getSnapshot().paths.length, 0, "over the limit, the solver refuses the scene");
    const preview = await propose(app, [["RemoveObject", { objectId: "second.0" }]]);
    await host(app).apply(preview.previewId, preview.digest);
    assert.ok(app.getSnapshot().paths.length > 0);
  });
});

test("a path can be proposed after an earlier scene edit", async () => {
  await withApp(async (app) => {
    await applyCalls(app, [box("box.new", [2, 0.25, 2])]);
    await applyCalls(app, ballPath(app.getSceneDocument()));
    await assertPathRuns(app);
  });
});

test("a manual edit still leaves a path for the user to rebase, and Muse can keep adding", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    await app.dispatch({
      type: "patchObject",
      objectId: "speaker",
      patch: { positionM: [1, 1.3, -2] },
    });
    assert.equal(app.getMotionWorkspace().getView().stale, true);
    await applyCalls(app, [box("box.new", [2, 0.25, 2])]);
    assert.equal(app.getMotionWorkspace().getView().stale, true);
    const before = everything(app);
    await assert.rejects(propose(app, [["RemoveObject", { objectId: "ball" }]]), {
      code: "REVISION_CONFLICT",
    });
    assert.equal(everything(app), before);
  });
});

test("moving an object with a path warns that its path no longer starts there", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const start = [1, 2, 1];
    const move: Call = [
      "MoveObject",
      { objectId: "ball", positionM: start, orientationQuaternion: IDENTITY },
    ];
    const alone = await propose(app, [move]);
    assert.deepEqual(alone.warnings, ["ball 已有路徑，起點不再符合新位置；需要新的路徑才能播放。"]);
    host(app).cancel(alone.previewId);
    const withNewPath = await propose(app, [move, ballPath(app.getSceneDocument(), start)[1]!]);
    assert.equal(
      withNewPath.warnings.some((line) => line.includes("已有路徑")),
      false,
    );
  });
});

test("a path that doesn't start where its object is gets rejected at preview", async () => {
  await withApp(async (app) => {
    const before = everything(app);
    const [mode, path] = ballPath(app.getSceneDocument(), [1, 1, 1]);
    await assert.rejects(propose(app, [mode!, path!]), { code: "MOTION_START_POSE" });
    assert.equal(everything(app), before);
  });
});

test("a path that starts with the wrong rotation gets rejected at preview", async () => {
  await withApp(async (app) => {
    const ball = app.getSceneDocument().objects.find((object) => object.id === "ball")!;
    await assert.rejects(
      propose(app, [
        ballPath(app.getSceneDocument())[0]!,
        [
          "SetTrajectory",
          {
            objectId: "ball",
            interpolation: "linearSlerp",
            samples: [
              {
                timeS: 0,
                positionM: ball.positionM,
                orientationQuaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
              },
              { timeS: 1, positionM: ball.positionM, orientationQuaternion: IDENTITY },
            ],
          },
        ],
      ]),
      { code: "MOTION_START_POSE" },
    );
  });
});

test("rejected lists don't use up the Host's tool allowance", async () => {
  await withApp(async (app) => {
    const bad = Array.from({ length: 20 }, (): Call => ["RemoveObject", { objectId: "missing" }]);
    for (let attempt = 0; attempt < 3; attempt++)
      await assert.rejects(propose(app, bad), { code: "UNKNOWN_ID" });
    await propose(app, [box("box.new", [2, 0.25, 2])]);
  });
});

test("an acoustic edit leaves the path registry untouched, so A/B reprocessing still matches", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const registry = canonicalJson(app.getMotionWorkspace().getSnapshot());
    await applyCalls(app, [
      [
        "SetMaterial",
        {
          objectId: "wall.back",
          materialId: "material.soft",
          materialRegistryRevision: 1,
          scope: "acoustic",
        },
      ],
    ]);
    assert.equal(canonicalJson(app.getMotionWorkspace().getSnapshot()), registry);
  });
});

test("an empty path registry is not touched by a scene edit", async () => {
  await withApp(async (app) => {
    const registry = canonicalJson(app.getMotionWorkspace().getSnapshot());
    await applyCalls(app, [box("box.new", [2, 0.25, 2])]);
    assert.equal(canonicalJson(app.getMotionWorkspace().getSnapshot()), registry);
  });
});

test("Motion still refuses an object that vanished without an approved removal", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const scene = app.getSceneDocument();
    const candidate = { ...scene, objects: scene.objects.filter((object) => object.id !== "ball") };
    await assert.rejects(app.getMotionWorkspace().previewTrajectories([], candidate), {
      code: "MOTION_UNKNOWN_OBJECT",
    });
  });
});

test("one proposal can add, move, resize, remove and give a path, and one Undo reverts it all", async () => {
  await withApp(async (app) => {
    const original = app.getSceneDocument();
    const behaviors = behaviorContent(app);
    const start = [-1, 1.5, 1];
    const preview = await applyCalls(app, [
      box("box.new", [2, 0.25, 2]),
      ["ResizeObject", { objectId: "box.new", dimensionsM: [1, 0.5, 1] }],
      ["MoveObject", { objectId: "ball", positionM: start, orientationQuaternion: IDENTITY }],
      ["ResizeObject", { objectId: "ball", dimensionsM: [0.3, 0.3, 0.3] }],
      ["RemoveObject", { objectId: "speaker" }],
      ...ballPath(original, start),
    ]);
    assert.equal(preview.changes.length, 7);
    const scene = app.getSceneDocument();
    const byId = (id: string) => scene.objects.find((object) => object.id === id);
    assert.deepEqual(byId("box.new")!.dimensionsM, [1, 0.5, 1]);
    assert.deepEqual(byId("ball")!.positionM, start);
    assert.deepEqual(byId("ball")!.dimensionsM, [0.3, 0.3, 0.3]);
    assert.equal(byId("speaker"), undefined);
    await assertPathRuns(app);
    await host(app).undo(preview.previewId);
    assert.deepEqual(withoutRevision(app.getSceneDocument()), withoutRevision(original));
    assert.deepEqual(behaviorContent(app), behaviors);
    assert.deepEqual(pathActions(app), []);
  });
});

test("a moved object starts from its new place even if the simulation was running", async () => {
  await withApp(async (app) => {
    await app.dispatch({ type: "run" });
    app.advance(0.2);
    const preview = await propose(app, [
      ["MoveObject", { objectId: "ball", positionM: [1, 3, 1], orientationQuaternion: IDENTITY }],
    ]);
    await host(app).apply(preview.previewId, preview.digest);
    assertNear(world(app).getPose("ball").positionMetres, [1, 3, 1]);
  });
});

test("changing a room surface warns before Apply", async () => {
  await withApp(async (app) => {
    const moved = await propose(app, [
      [
        "MoveObject",
        { objectId: "wall.left", positionM: [-4, 2, 0], orientationQuaternion: IDENTITY },
      ],
    ]);
    assert.deepEqual(moved.warnings, [
      "此操作變更房間表面 wall.left，會影響聲學與物理；套用前請檢查。",
    ]);
    host(app).cancel(moved.previewId);
    const removed = await propose(app, [["RemoveObject", { objectId: "floor" }]]);
    assert.deepEqual(removed.warnings, [
      "此操作變更房間表面 floor，會影響聲學與物理；套用前請檢查。",
    ]);
    host(app).cancel(removed.previewId);
    const furniture = await propose(app, [
      ["ResizeObject", { objectId: "ball", dimensionsM: [0.8, 0.8, 0.8] }],
    ]);
    assert.deepEqual(furniture.warnings, []);
    host(app).cancel(furniture.previewId);
    await applyCalls(app, [box("box.new", [2, 0.25, 2])]);
    const added = await propose(app, [["RemoveObject", { objectId: "box.new" }]]);
    assert.deepEqual(added.warnings, [], "a fixed object Muse added is not a room surface");
  });
});

test("replacing the room also removes paths, and Undo restores them", async () => {
  await withApp(async (app) => {
    await applyCalls(app, ballPath(app.getSceneDocument()));
    const actions = pathActions(app);
    const preview = await applyCalls(app, [
      [
        "CreateScene",
        {
          label: "New room",
          roomDimensionsM: [8, 4, 10],
          surfaceMaterialId: "material.wood",
          seed: 7,
        },
      ],
    ]);
    assert.deepEqual(pathActions(app), []);
    assert.ok(preview.changes.some((line) => line.includes("trajectory.ball")));
    await host(app).undo(preview.previewId);
    assert.deepEqual(pathActions(app), actions);
    await assertPathRuns(app);
  });
});

const MOVE = { positionM: [0, 1, 0], orientationQuaternion: IDENTITY };
const rejected: { name: string; calls: Call[]; code: string }[] = [
  {
    name: "moving an unknown object",
    calls: [["MoveObject", { objectId: "missing", ...MOVE }]],
    code: "UNKNOWN_ID",
  },
  {
    name: "resizing an unknown object",
    calls: [["ResizeObject", { objectId: "missing", dimensionsM: [1, 1, 1] }]],
    code: "UNKNOWN_ID",
  },
  {
    name: "removing an unknown object",
    calls: [["RemoveObject", { objectId: "missing" }]],
    code: "UNKNOWN_ID",
  },
  {
    name: "removing an object twice",
    calls: [
      ["RemoveObject", { objectId: "ball" }],
      ["RemoveObject", { objectId: "ball" }],
    ],
    code: "UNKNOWN_ID",
  },
  {
    name: "resizing an object before it is added",
    calls: [
      ["ResizeObject", { objectId: "box.new", dimensionsM: [1, 1, 1] }],
      box("box.new", [2, 0.25, 2]),
    ],
    code: "UNKNOWN_ID",
  },
  {
    name: "moving an object after removing it",
    calls: [
      ["RemoveObject", { objectId: "ball" }],
      ["MoveObject", { objectId: "ball", ...MOVE }],
    ],
    code: "UNKNOWN_ID",
  },
  {
    name: "giving a removed object a path",
    calls: [
      ["RemoveObject", { objectId: "ball" }],
      [
        "SetTrajectory",
        {
          objectId: "ball",
          interpolation: "linearSlerp",
          samples: [
            { timeS: 0, positionM: [0, 1, 0], orientationQuaternion: IDENTITY },
            { timeS: 1, positionM: [1, 1, 0], orientationQuaternion: IDENTITY },
          ],
        },
      ],
    ],
    code: "MOTION_NOT_KINEMATIC",
  },
  {
    name: "giving a sphere unequal dimensions",
    calls: [["ResizeObject", { objectId: "ball", dimensionsM: [1, 2, 1] }]],
    code: "DOMAIN_INVALID",
  },
  {
    name: "a quaternion that is not a rotation",
    calls: [
      [
        "MoveObject",
        { objectId: "ball", positionM: [0, 1, 0], orientationQuaternion: [0.5, 0, 0, 0.5] },
      ],
    ],
    code: "DOMAIN_INVALID",
  },
  {
    name: "a dimension out of range",
    calls: [["ResizeObject", { objectId: "speaker", dimensionsM: [0, 1, 1] }]],
    code: "SCHEMA_INVALID",
  },
  {
    name: "an extra argument",
    calls: [["RemoveObject", { objectId: "ball", force: true }]],
    code: "SCHEMA_INVALID",
  },
];
for (const { name, calls, code } of rejected)
  test(`rejected without side effects: ${name}`, async () => {
    await withApp(async (app) => {
      const before = everything(app);
      await assert.rejects(propose(app, calls), { code });
      assert.equal(everything(app), before);
    });
  });
