import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import { createDefaultBehaviors, createDefaultScene } from "../../src/app/defaults.js";
import type { LabAction, LabViewModel } from "../../src/ui/contracts.js";
import type { SoundBehaviorDocument } from "../../schemas/sound-behavior/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import { originalPublish } from "./fixtures/view-projection-reference.mjs";
import { ViewProjection } from "../../src/app/view-projection.js";
import type { EventView } from "../../src/ui/contracts.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import { editableRulePatch } from "../../src/ui/rule-drafts.js";

interface Internal {
  scene: SceneSpec;
  document: SoundBehaviorDocument;
  view: LabViewModel;
  publish(): void;
  eventLog: EventView[];
}
const internal = (app: LabRuntime) => app as unknown as Internal;
function compareReference(app: LabRuntime) {
  const actual = app.getSnapshot();
  originalPublish.call(app);
  const expected = app.getSnapshot();
  assert.deepEqual(actual, expected);
  internal(app).view = actual;
}
async function workload() {
  const app = await LabRuntime.create({ useWorker: false });
  const scene = createDefaultScene();
  scene.objects.push(
    ...Array.from({ length: 99 }, (_, i) => ({
      ...structuredClone(scene.objects.find((object) => object.id === "ball")!),
      id: `projection.body.${i}`,
      positionM: [((i % 10) - 4.5) * 0.45, 0.5, (Math.floor(i / 10) - 4.5) * 0.45] as [
        number,
        number,
        number,
      ],
      dimensionsM: [0.3, 0.3, 0.3] as [number, number, number],
    })),
  );
  const project = JSON.parse(app.exportProject());
  project.scene = scene;
  project.soundBehaviors = createDefaultBehaviors(scene);
  await app.importProject(JSON.stringify(project));
  return app;
}

test("unchanged authoring inputs are not cloned for each complete publication", async () => {
  const app = await workload();
  try {
    const inputs = new WeakSet<object>([
      ...internal(app).scene.objects,
      ...internal(app).document.profiles.flatMap((profile) =>
        profile.rules.map((rule) => rule.mappings),
      ),
    ]);
    const clone = globalThis.structuredClone;
    let authoringClones = 0;
    globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
      if (value && typeof value === "object" && inputs.has(value)) authoringClones++;
      return clone(value, options);
    }) as typeof structuredClone;
    try {
      await app.dispatch({ type: "selectObject", objectId: "speaker" });
      await app.dispatch({ type: "selectObject", objectId: "ball" });
    } finally {
      globalThis.structuredClone = clone;
    }
    assert.equal(app.getSnapshot().objects.length, 105);
    assert.equal(
      app.getSnapshot().behaviors.reduce((sum, binding) => sum + binding.rules.length, 0),
      301,
    );
    assert.equal(
      authoringClones,
      0,
      "unchanged authoring object/mapping identities must be projected once",
    );
    compareReference(app);
  } finally {
    app.dispose();
  }
});

test("authoring templates retain full reference values and isolated immutable nested data", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    const first = app.getSnapshot();
    const retained = structuredClone(first);
    assert.throws(() => {
      first.objects[0]!.dimensionsM[0] = 123;
    }, TypeError);
    const impact = first.behaviors.find((binding) => binding.objectId === "ball")!.rules[0]!;
    assert.throws(() => {
      impact.mappings![0]!.curve[0]!.x = 123;
    }, TypeError);
    const draft = editableRulePatch(impact);
    draft.mappings![0]!.curve[0]!.x = 0.1;
    assert.equal(impact.mappings![0]!.curve[0]!.x, 0);
    assert.equal(app.getBehaviorDocument().profiles[1]!.rules[0]!.mappings[0]!.curve[0]!.x, 0);
    const actions: LabAction[] = [
      { type: "patchObject", objectId: "ball", patch: { name: "Renamed sphere", massKg: 2 } },
      {
        type: "setBindingOverride",
        objectId: "ball",
        ruleId: impact.id,
        override: { enabled: false, gainLinear: 0.12 },
      },
      { type: "undo" },
      { type: "redo" },
      { type: "undo" },
      { type: "run" },
      { type: "pause" },
      { type: "reset" },
    ];
    for (const action of actions) {
      await app.dispatch(action);
      assert.equal(app.getSnapshot().error, "");
      compareReference(app);
    }
    assert.deepEqual(first, retained);
    const project = JSON.parse(app.exportProject());
    const sceneRevision = project.scene.sceneRevision;
    const documentRevision = project.soundBehaviors.revision;
    project.scene.objects.find((object: { id: string }) => object.id === "ball").massKg = 7;
    project.soundBehaviors.profiles[1].rules[0].gainLinear = 0.19;
    await app.importProject(JSON.stringify(project));
    assert.equal(app.getSceneDocument().sceneRevision, sceneRevision);
    assert.equal(app.getBehaviorDocument().revision, documentRevision);
    assert.equal(app.getSnapshot().objects.find((object) => object.id === "ball")!.massKg, 7);
    assert.equal(
      app.getSnapshot().behaviors.find((binding) => binding.objectId === "ball")!.rules[0]!
        .gainLinear,
      0.19,
    );
    compareReference(app);
    await app.dispatch({ type: "run" });
    for (let i = 0; i < 8; i++) {
      app.advance(1 / 60);
      compareReference(app);
    }
    assert.ok(
      app.getSnapshot().behaviors.some((binding) => binding.rules.some((rule) => rule.active)),
    );
  } finally {
    app.dispose();
  }
});

test("finalized events are copied once by object identity while each publication retains a fresh array", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await app.dispatch({ type: "run" });
    for (let i = 0; i < 4; i++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    assert.ok(app.getSnapshot().events.length > 0);
    const before = app.getSnapshot();
    const retained = structuredClone(before);
    const clone = globalThis.structuredClone;
    let eventArrayCopies = 0;
    globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
      if (
        Array.isArray(value) &&
        value[0] &&
        typeof value[0] === "object" &&
        "id" in value[0] &&
        "tick" in value[0]
      )
        eventArrayCopies++;
      return clone(value, options);
    }) as typeof structuredClone;
    try {
      await app.dispatch({ type: "selectObject", objectId: "speaker" });
      await app.dispatch({ type: "selectObject", objectId: "ball" });
    } finally {
      globalThis.structuredClone = clone;
    }
    assert.equal(
      eventArrayCopies,
      0,
      "unchanged finalized event rows must not be cloned as a full array",
    );
    assert.notEqual(app.getSnapshot().events, before.events);
    assert.equal(app.getSnapshot().events[0], before.events[0]);
    assert.deepEqual(before, retained);
    compareReference(app);
  } finally {
    app.dispose();
  }
});

test("event projections preserve repeated IDs, ordering and nested ownership without freezing inputs", () => {
  const projection = new ViewProjection();
  assert.equal(typeof projection.events, "function");
  const input: EventView = {
    id: "event.same",
    tick: 1,
    timeSeconds: 1 / 60,
    type: "BehaviorDecision",
    positionM: [1, 2, 3],
    decision: {
      tick: 1,
      sequence: 0,
      action: "reject",
      reason: "FIRST",
      contactPositionM: [4, 5, 6],
    },
  };
  const first = projection.events([input]);
  assert.deepEqual(first, [input]);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.positionM), false);
  assert.throws(() => {
    first[0]!.decision!.contactPositionM![0] = 123;
  }, TypeError);
  const replacement = {
    ...input,
    detail: "new same-ID object",
    decision: { ...input.decision!, reason: "SECOND" },
  };
  const second = projection.events([replacement, input]);
  assert.deepEqual(second, [replacement, input]);
  assert.notEqual(second[0], first[0]);
  assert.equal(second[1], first[0]);
  assert.equal(first[0]!.decision!.reason, "FIRST");
});

test("full event publication preserves the512 cap and stable tied-tick ordering", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    internal(app).eventLog = Array.from({ length: 513 }, (_, index) => ({
      id: `event.${index}`,
      tick: Math.floor(index / 3),
      timeSeconds: Math.floor(index / 3) / 60,
      type: "SyntheticProjectionOrdering",
      positionM: [index, 0, 0],
      decision: {
        tick: Math.floor(index / 3),
        sequence: index % 3,
        action: "reject",
        reason: "REFERENCE_ORDER",
      },
    }));
    internal(app).publish();
    assert.equal(app.getSnapshot().events.length, 512);
    assert.equal(app.getSnapshot().events[0]!.id, "event.1");
    assert.equal(app.getSnapshot().events.at(-1)!.id, "event.512");
    compareReference(app);
    const retained = app.getSnapshot();
    const copy = structuredClone(retained);
    internal(app).publish();
    assert.deepEqual(retained, copy);
    assert.notEqual(app.getSnapshot().events, retained.events);
  } finally {
    app.dispose();
  }
});

test("complete publication matches reference during offline AI, recording and replay transitions", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    for (const action of [
      { type: "submitPrompt", prompt: "ball 碰撞音效小聲" },
      { type: "applyAI" },
      { type: "undo" },
      { type: "run" },
      { type: "recordToggle" },
    ] as LabAction[]) {
      await app.dispatch(action);
      assert.equal(app.getSnapshot().error, "");
      compareReference(app);
    }
    for (let i = 0; i < 6; i++) {
      app.advance(1 / 60);
      compareReference(app);
    }
    for (const action of [{ type: "recordToggle" }, { type: "replay" }] as LabAction[]) {
      await app.dispatch(action);
      assert.equal(app.getSnapshot().error, "");
      compareReference(app);
    }
    app.advance(1 / 60);
    compareReference(app);
    await app.dispatch({ type: "stopReplay" });
    compareReference(app);
    await app.dispatch({ type: "reset" });
    compareReference(app);
  } finally {
    app.dispose();
  }
});

test("async native admission and same-document rule diagnostics retain complete reference values", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const engine = new AudioEngine({
    context: new FakeAudioContext().asContext(),
    budget: { maxSources: 8 },
  });
  try {
    const project = JSON.parse(app.exportProject());
    const object = project.scene.objects.find((value: { id: string }) => value.id === "speaker");
    const source = project.scene.sources[0];
    const binding = project.soundBehaviors.bindings.find(
      (value: { objectId: string }) => value.objectId === "speaker",
    );
    for (let i = 1; i <= 8; i++) {
      const objectId = `speaker.${i}`;
      project.scene.objects.push({ ...object, id: objectId, positionM: [i, 1, -2] });
      project.scene.sources.push({ ...source, id: `source.${objectId}`, objectId });
      project.soundBehaviors.bindings.push({
        ...binding,
        bindingId: `binding.${objectId}`,
        objectId,
      });
    }
    await app.importProject(JSON.stringify(project));
    (app as unknown as { audio: AudioEngine }).audio = engine;
    await engine.enable(0);
    await app.dispatch({ type: "run" });
    for (let i = 0; i < 3; i++) {
      app.advance(1 / 60);
      compareReference(app);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(app.getSnapshot().events.some((event) => event.nativeRejection));
    compareReference(app);
    const retained = app.getSnapshot();
    const copy = structuredClone(retained);
    await app.dispatch({ type: "pause" });
    compareReference(app);
    assert.deepEqual(retained, copy);
  } finally {
    app.dispose();
    engine.dispose();
  }
});
