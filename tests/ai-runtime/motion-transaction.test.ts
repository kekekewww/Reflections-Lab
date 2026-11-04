import test from "node:test";
import assert from "node:assert/strict";
import { AgentHost } from "../../src/ai/host.js";
import { createSceneToolAdapter } from "../../src/ai/scene-adapter.js";
import { canonicalJson, digestJson } from "../../src/ai/validation.js";
import type { MotionTransactionHooks } from "../../src/ai/scene-adapter.js";
import type { AgentSidecarSnapshot, PlannerProvenance, ToolRequest } from "../../src/ai/types.js";
import { createScene } from "../../src/scene/index.js";
import type { SceneSpec } from "../../src/scene/types.js";

// The callbacks deliberately implement only the trusted atomic storage contract.
// Real Motion interpolation/physics is covered by the separate Motion host tests.
const provenance: PlannerProvenance = {
  provider: "offlineDeterministic",
  modelId: null,
  requestId: null,
  label: "OFFLINE_DETERMINISTIC",
};
function baseScene(): SceneSpec {
  return createScene({
    schemaVersion: "1.0.0",
    sceneId: "scene.motion-ai",
    sceneRevision: 0,
    units: "SI",
    coordinateSystem: "right-handed-y-up-minus-z-forward",
    seed: 1,
    gravityMps2: [0, -9.81, 0],
    objects: [
      {
        id: "object.ball",
        shape: "sphere",
        positionM: [0, 1, 0],
        dimensionsM: [0.5, 0.5, 0.5],
        orientationQuaternion: [0, 0, 0, 1],
        mode: "kinematic",
        massKg: 1,
        friction: 0.5,
        restitution: 0.2,
        physicsMaterialId: "material.test",
        acousticMaterialId: "material.test",
        acousticRole: "none",
      },
    ],
    sources: [],
    listener: {
      id: "listener.main",
      positionM: [0, 1.6, 3],
      orientationQuaternion: [0, 0, 0, 1],
      attachment: "independent",
    },
  });
}
function trajectory(id = "request.motion", objectId = "object.ball"): ToolRequest {
  return {
    schemaVersion: "1.0.0",
    requestId: id,
    tool: "SetTrajectory",
    sceneId: "scene.motion-ai",
    expectedSceneRevision: 0,
    transactionId: "transaction.motion",
    arguments: {
      objectId,
      interpolation: "linearSlerp",
      samples: [
        { timeS: 0, positionM: [0, 1, 0], orientationQuaternion: [0, 0, 0, 1] },
        { timeS: 1, positionM: [1, 1, 0], orientationQuaternion: [0, 0, 0, 1] },
      ],
    },
  };
}
function add(): ToolRequest {
  return {
    ...trajectory("request.add"),
    tool: "AddObject",
    arguments: {
      objectId: "object.new",
      label: "新增球",
      shape: "sphere",
      dimensionsM: [0.5, 0.5, 0.5],
      positionM: [2, 1, 0],
      orientationQuaternion: [0, 0, 0, 1],
      materialId: "material.test",
      mode: "kinematic",
      massKg: 1,
    },
  };
}
async function fixture(
  initialActions: Record<string, unknown>[] = [],
  enableRestoreProjection = true,
) {
  let scene = baseScene();
  let snapshot: AgentSidecarSnapshot = {
    namespace: "motion",
    revision: 0,
    document: {
      schemaVersion: "1.0.0",
      registryId: "motion.registry",
      revision: 0,
      scenePin: {
        sceneId: scene.sceneId,
        sceneRevision: scene.sceneRevision,
        sceneHash: await digestJson(scene),
      },
      actions: structuredClone(initialActions),
    },
  };
  const calls = { sceneCommit: 0, commit: 0, restore: 0, preview: 0 };
  let previewPolicy = "default";
  let corruptCommit = false;
  let mutateOnPreview = false;
  let restoreProjection: NonNullable<MotionTransactionHooks["prepareRestore"]> = (value) => value;
  const hooks: MotionTransactionHooks = {
    getSnapshot: () => structuredClone(snapshot),
    prepareRestore: (value, candidateScene) => restoreProjection(value, candidateScene),
    async preview(requests, candidateScene) {
      calls.preview++;
      assert.ok(requests.every((request) => request.tool === "SetTrajectory"));
      const before = structuredClone(snapshot);
      const revision = before.revision + 1;
      const document = structuredClone(before.document) as Record<string, unknown>;
      document.revision = revision;
      document.scenePin = {
        sceneId: candidateScene.sceneId,
        sceneRevision: candidateScene.sceneRevision,
        sceneHash: await digestJson(candidateScene),
      };
      document.actions = requests.map((request) => ({
        actionId: request.requestId,
        objectId: request.arguments.objectId,
        samples: request.arguments.samples,
        policy: previewPolicy,
      }));
      if (mutateOnPreview) snapshot = { ...before, revision: before.revision + 1 };
      return {
        candidate: { namespace: "motion", revision, document },
        changes: ["Author motion"],
        warnings: ["ATOMIC_STORAGE_FIXTURE_ONLY"],
      };
    },
    commit(input) {
      assert.equal(scene.sceneRevision, input.expectedSceneRevision);
      assert.equal(canonicalJson(snapshot), canonicalJson(input.before));
      const preparedScene = createScene(input.scene);
      const preparedSnapshot = structuredClone(input.candidate);
      // No await or fallible work after this publication boundary.
      scene = preparedScene;
      if (!corruptCommit) snapshot = preparedSnapshot;
      calls.commit++;
      return structuredClone(scene);
    },
    restore(input) {
      assert.equal(scene.sceneRevision, input.expectedSceneRevision);
      assert.equal(canonicalJson(snapshot), canonicalJson(input.expectedCurrent));
      const preparedScene = createScene(input.scene);
      const preparedSnapshot = structuredClone(input.restore);
      scene = preparedScene;
      snapshot = preparedSnapshot;
      calls.restore++;
      return structuredClone(scene);
    },
  };
  if (!enableRestoreProjection) delete hooks.prepareRestore;
  const adapter = createSceneToolAdapter({
    getScene: () => structuredClone(scene),
    commitScene(next, revision) {
      assert.equal(scene.sceneRevision, revision);
      calls.sceneCommit++;
      scene = createScene(next);
      return structuredClone(scene);
    },
    materials: [{ id: "material.test", label: "Synthetic" }],
    signals: [],
    motionTransaction: hooks,
  });
  return {
    adapter,
    hooks,
    host: new AgentHost(adapter),
    scene: () => structuredClone(scene),
    snapshot: () => structuredClone(snapshot),
    calls,
    changePolicy: () => (previewPolicy = "changed"),
    corruptCommit: () => (corruptCommit = true),
    mutateOnPreview: () => (mutateOnPreview = true),
    setRestoreProjection: (projection: NonNullable<MotionTransactionHooks["prepareRestore"]>) => {
      restoreProjection = projection;
    },
    externalMotionEdit: (sameRevision = false) => {
      const doc = structuredClone(snapshot.document) as Record<string, unknown>;
      const revision = snapshot.revision + (sameRevision ? 0 : 1);
      doc.revision = revision;
      doc.actions = [{ actionId: "external.action" }];
      snapshot = { namespace: "motion", revision, document: doc };
    },
  };
}

test("sidecar-only trajectory preview/apply/undo changes Motion revisions without dummy Scene edits", async () => {
  const f = await fixture();
  const before = f.scene();
  const preview = await f.host.stage([trajectory()], provenance);
  assert.deepEqual(f.scene(), before);
  assert.equal(f.snapshot().revision, 0);
  assert.equal(preview.sceneRevisionDelta, 0);
  assert.equal(preview.sidecar?.candidate.revision, 1);
  preview.sidecar!.candidate.document = { tampered: true };
  await f.host.apply(preview.previewId, preview.digest);
  assert.deepEqual(f.scene(), before);
  assert.equal(f.snapshot().revision, 1);
  assert.equal(f.calls.sceneCommit, 0);
  await f.host.apply(preview.previewId, preview.digest);
  assert.equal(f.calls.commit, 1);
  await f.host.undo(preview.previewId);
  assert.deepEqual(f.scene(), before);
  assert.equal(f.snapshot().revision, 2);
  assert.deepEqual((f.snapshot().document as { actions: unknown[] }).actions, []);
  assert.equal(f.calls.restore, 1);
});

test("mixed Scene + Motion batch uses a single atomic callback and restores both with new revisions", async () => {
  const f = await fixture();
  const preview = await f.host.stage(
    [add(), trajectory("request.motion", "object.new")],
    provenance,
  );
  assert.equal(preview.candidate.objects.length, 2);
  assert.equal(preview.sidecar?.candidate.revision, 1);
  await f.host.apply(preview.previewId, preview.digest);
  assert.equal(f.scene().sceneRevision, 1);
  assert.equal(f.snapshot().revision, 1);
  assert.equal(f.calls.sceneCommit, 0);
  await f.host.undo(preview.previewId);
  assert.equal(f.scene().sceneRevision, 2);
  assert.equal(f.scene().objects.length, 1);
  const document = f.snapshot().document as {
    revision: number;
    scenePin: { sceneRevision: number; sceneHash: string };
    actions: unknown[];
  };
  assert.equal(document.revision, 2);
  assert.equal(document.scenePin.sceneRevision, 2);
  assert.equal(document.scenePin.sceneHash, await digestJson(f.scene()));
  assert.deepEqual(document.actions, []);
});

test("approval digest covers Motion content even when requests and Scene are unchanged", async () => {
  const a = await fixture();
  const b = await fixture();
  b.changePolicy();
  const first = await a.host.stage([trajectory()], provenance);
  const second = await b.host.stage([trajectory()], provenance);
  assert.deepEqual(first.candidate, second.candidate);
  assert.deepEqual(first.requests, second.requests);
  assert.notEqual(first.digest, second.digest);
});

test("Motion revision and same-revision content races both reject Apply before storage", async () => {
  for (const sameRevision of [false, true]) {
    const f = await fixture();
    const preview = await f.host.stage([trajectory()], provenance);
    f.externalMotionEdit(sameRevision);
    await assert.rejects(f.host.apply(preview.previewId, preview.digest), {
      code: "REVISION_CONFLICT",
    });
    assert.equal(f.calls.commit, 0);
  }
});

test("Undo refuses to overwrite a later Motion authoring edit", async () => {
  const f = await fixture();
  const preview = await f.host.stage([trajectory()], provenance);
  await f.host.apply(preview.previewId, preview.digest);
  f.externalMotionEdit(true);
  await assert.rejects(f.host.undo(preview.previewId), { code: "REVISION_CONFLICT" });
  assert.equal(f.calls.restore, 0);
});

test("preview side effects and incomplete commit publication are detected", async () => {
  const a = await fixture();
  a.mutateOnPreview();
  await assert.rejects(a.host.stage([trajectory()], provenance), { code: "REVISION_CONFLICT" });
  assert.equal(a.calls.commit, 0);
  const b = await fixture();
  const preview = await b.host.stage([trajectory()], provenance);
  b.corruptCommit();
  await assert.rejects(b.host.apply(preview.previewId, preview.digest), { code: "INTERNAL_ERROR" });
});

test("recordedTrace cannot be authored without a trusted recorded trace", async () => {
  const f = await fixture();
  const request = trajectory();
  request.arguments.interpolation = "recordedTrace";
  await assert.rejects(f.host.stage([request], provenance), { code: "CAPABILITY_UNSUPPORTED" });
  assert.equal(f.calls.preview, 0);
});

test("direct adapter commit cannot omit or alter approved Motion snapshot", async () => {
  const f = await fixture();
  const requests = [trajectory()];
  const preview = await f.adapter.preview(requests);
  await assert.rejects(
    Promise.resolve(f.adapter.commit(preview.candidate, 0, "transaction.apply", requests)),
    { code: "PREVIEW_REQUIRED" },
  );
  const tampered = structuredClone(preview.sidecar!);
  (tampered.candidate.document as Record<string, unknown>).actions = [];
  await assert.rejects(
    Promise.resolve(
      f.adapter.commit(preview.candidate, 0, "transaction.apply", requests, tampered),
    ),
    { code: "PREVIEW_REQUIRED" },
  );
  assert.equal(f.calls.commit, 0);
});

const previousMotionAction = () => ({
  actionId: "motion.previous",
  revision: 1,
  objectId: "object.ball",
  generation: 2,
  kind: "moveTo",
  targetPositionM: [0.25, 1, 0],
  samples: [
    { timeS: 0, positionM: [0, 1, 0], orientationQuaternion: [0, 0, 0, 1] },
    { timeS: 1, positionM: [0.25, 1, 0], orientationQuaternion: [0, 0, 0, 1] },
  ],
});
function restoredActions(snapshot: AgentSidecarSnapshot): Record<string, unknown>[] {
  return (snapshot.document as { actions: Record<string, unknown>[] }).actions;
}
async function appliedMixedFixture() {
  const original = previousMotionAction();
  const f = await fixture([original]);
  const preview = await f.host.stage(
    [add(), trajectory("request.motion", "object.new")],
    provenance,
  );
  await f.host.apply(preview.previewId, preview.digest);
  return { f, preview, original };
}

test("trusted Undo projection rebinds restored action generation and preserves all author content", async () => {
  const { f, preview, original } = await appliedMixedFixture();
  f.setRestoreProjection((snapshot, candidateScene) => {
    assert.equal(candidateScene.sceneRevision, 2);
    assert.equal(candidateScene.objects.length, 1);
    restoredActions(snapshot)[0]!.generation = 4;
    return snapshot;
  });
  await f.host.undo(preview.previewId);
  assert.equal(f.scene().sceneRevision, 2);
  assert.equal(f.snapshot().revision, 2);
  const restored = restoredActions(f.snapshot())[0]!;
  assert.deepEqual(restored, { ...original, generation: 4 });
  assert.equal(f.calls.restore, 1);
});

test("generation projection cannot change author targets, samples, kind or action membership", async () => {
  const edits: ((snapshot: AgentSidecarSnapshot) => void)[] = [
    (snapshot) => {
      restoredActions(snapshot)[0]!.targetPositionM = [99, 1, 0];
    },
    (snapshot) => {
      restoredActions(snapshot)[0]!.samples = [];
    },
    (snapshot) => {
      restoredActions(snapshot)[0]!.kind = "impulse";
    },
    (snapshot) => {
      restoredActions(snapshot).push(previousMotionAction());
    },
    (snapshot) => {
      restoredActions(snapshot).splice(0, 1);
    },
    (snapshot) => {
      (snapshot as unknown as Record<string, unknown>).extra = "unapproved";
    },
  ];
  for (const edit of edits) {
    const { f, preview } = await appliedMixedFixture();
    const beforeUndo = f.snapshot();
    f.setRestoreProjection((snapshot) => {
      restoredActions(snapshot)[0]!.generation = 4;
      edit(snapshot);
      return snapshot;
    });
    await assert.rejects(f.host.undo(preview.previewId), { code: "DOMAIN_INVALID" });
    assert.equal(f.calls.restore, 0);
    assert.deepEqual(f.snapshot(), beforeUndo);
  }
});

test("generation projection must keep namespace, registry revision and the restored Scene pin", async () => {
  const edits: ((snapshot: AgentSidecarSnapshot) => void)[] = [
    (snapshot) => {
      (snapshot as { namespace: string }).namespace = "other";
    },
    (snapshot) => {
      snapshot.revision++;
      (snapshot.document as Record<string, unknown>).revision = snapshot.revision;
    },
    (snapshot) => {
      (snapshot.document as { scenePin: { sceneRevision: number } }).scenePin.sceneRevision++;
    },
  ];
  for (const edit of edits) {
    const { f, preview } = await appliedMixedFixture();
    f.setRestoreProjection((snapshot) => {
      edit(snapshot);
      return snapshot;
    });
    await assert.rejects(f.host.undo(preview.previewId), { code: "DOMAIN_INVALID" });
    assert.equal(f.calls.restore, 0);
  }
});

test("generation projection rejects zero, negative, fractional, unsafe or missing generations", async () => {
  for (const generation of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, undefined]) {
    const { f, preview } = await appliedMixedFixture();
    f.setRestoreProjection((snapshot) => {
      if (generation === undefined) delete restoredActions(snapshot)[0]!.generation;
      else restoredActions(snapshot)[0]!.generation = generation;
      return snapshot;
    });
    await assert.rejects(f.host.undo(preview.previewId), { code: "DOMAIN_INVALID" });
    assert.equal(f.calls.restore, 0);
  }
});

test("asynchronous Undo projection cannot overwrite a concurrent Motion edit", async () => {
  const { f, preview } = await appliedMixedFixture();
  f.setRestoreProjection(async (snapshot) => {
    await Promise.resolve();
    f.externalMotionEdit(true);
    restoredActions(snapshot)[0]!.generation = 4;
    return snapshot;
  });
  await assert.rejects(f.host.undo(preview.previewId), { code: "REVISION_CONFLICT" });
  assert.equal(f.calls.restore, 0);
});

test("Undo checks actual storage against projected generations after restore", async () => {
  const { f, preview } = await appliedMixedFixture();
  f.setRestoreProjection((snapshot) => {
    restoredActions(snapshot)[0]!.generation = 4;
    return snapshot;
  });
  const publish = f.hooks.restore;
  f.hooks.restore = (input) => {
    const corrupted = structuredClone(input);
    restoredActions(corrupted.restore)[0]!.generation = 3;
    return publish(corrupted);
  };
  await assert.rejects(f.host.undo(preview.previewId), { code: "INTERNAL_ERROR" });
  assert.equal(f.calls.restore, 1);
});

test("Motion hooks without a restore projector preserve the original apply/undo API", async () => {
  const f = await fixture([], false);
  const preview = await f.host.stage([trajectory()], provenance);
  await f.host.apply(preview.previewId, preview.digest);
  await f.host.undo(preview.previewId);
  assert.equal(f.scene().sceneRevision, 0);
  assert.equal(f.snapshot().revision, 2);
  assert.equal(f.calls.restore, 1);
});

test("generation projection cannot reorder otherwise unchanged authoring actions", async () => {
  const first = previousMotionAction();
  const second = { ...previousMotionAction(), actionId: "motion.second" };
  const f = await fixture([first, second]);
  const preview = await f.host.stage(
    [add(), trajectory("request.motion", "object.new")],
    provenance,
  );
  await f.host.apply(preview.previewId, preview.digest);
  f.setRestoreProjection((snapshot) => {
    for (const action of restoredActions(snapshot)) action.generation = 4;
    restoredActions(snapshot).reverse();
    return snapshot;
  });
  await assert.rejects(f.host.undo(preview.previewId), { code: "DOMAIN_INVALID" });
  assert.equal(f.calls.restore, 0);
});
