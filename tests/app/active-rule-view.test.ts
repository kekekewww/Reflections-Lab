import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { LabRuntime } from "../../src/app/runtime.js";
import { createDefaultScene, createDefaultBehaviors } from "../../src/app/defaults.js";
import type { BehaviorRuntime, BehaviorSnapshot } from "../../src/audio-behavior/types.js";
import type { SceneSpec } from "../../src/scene/types.js";
import type { LabAction, LabViewModel } from "../../src/ui/contracts.js";

type ActiveRuleState = { bindingId: string; activeRuleIds: string[] };
type ObservedBehavior = BehaviorRuntime & { getActiveRuleStates(): ActiveRuleState[] };
type PrivateMethod = (...args: unknown[]) => unknown;
interface RuntimeProbe {
  behavior: ObservedBehavior;
  publish: PrivateMethod;
  onTick: PrivateMethod;
  requests: PrivateMethod;
  disposed: boolean;
  audio: unknown;
}
interface Counts {
  publish: number;
  fullSnapshot: number;
  publishFullSnapshot: number;
  outsideFullSnapshot: number;
  narrow: number;
  publishNarrow: number;
  behaviorStep: number;
  physicsTicks: number;
  requests: number;
}
interface Checkpoint {
  name: string;
  view: LabViewModel;
  behavior: BehaviorSnapshot;
  trace: ReturnType<BehaviorRuntime["getTrace"]>;
  artifact: ReturnType<LabRuntime["getRecordingArtifact"]>;
  project: string;
}

const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

/** Identity metadata only: physics deltas and performance clocks remain real and unchanged. */
function deterministicIdentities(): () => void {
  const originalDate = globalThis.Date;
  const originalUuid = globalThis.crypto.randomUUID;
  const uuidDescriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
  const fixedTime = "2026-10-27T12:00:00.000Z";
  let sequence = 0;
  globalThis.Date = new Proxy(originalDate, {
    construct(target, args) {
      return Reflect.construct(target, args.length ? args : [fixedTime]);
    },
    get(target, property, receiver) {
      return property === "now"
        ? () => originalDate.parse(fixedTime)
        : Reflect.get(target, property, receiver);
    },
  });
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    writable: true,
    value: () => `${(++sequence).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`,
  });
  return () => {
    globalThis.Date = originalDate;
    if (uuidDescriptor) Object.defineProperty(globalThis.crypto, "randomUUID", uuidDescriptor);
    else {
      delete (globalThis.crypto as unknown as { randomUUID?: () => string }).randomUUID;
      assert.equal(globalThis.crypto.randomUUID, originalUuid);
    }
  };
}

/** Test-only observation follows every replacement behavior object; no production seam is added. */
function installObservers(app: LabRuntime, fullSnapshotOracle: boolean) {
  const target = app as unknown as RuntimeProbe;
  const counts: Counts = {
    publish: 0,
    fullSnapshot: 0,
    publishFullSnapshot: 0,
    outsideFullSnapshot: 0,
    narrow: 0,
    publishNarrow: 0,
    behaviorStep: 0,
    physicsTicks: 0,
    requests: 0,
  };
  const states = new WeakMap<
    ObservedBehavior,
    {
      snapshot: BehaviorRuntime["snapshot"];
      query: ObservedBehavior["getActiveRuleStates"];
      step: BehaviorRuntime["step"];
    }
  >();
  const restores: Array<() => void> = [];
  let depth = 0;
  let enabled = true;
  let current = target.behavior;
  function instrument(value: ObservedBehavior): void {
    if (states.has(value)) return;
    assert.equal(typeof value.getActiveRuleStates, "function", "actual production query required");
    const state = { snapshot: value.snapshot, query: value.getActiveRuleStates, step: value.step };
    states.set(value, state);
    value.snapshot = function () {
      if (enabled) {
        counts.fullSnapshot++;
        if (depth) counts.publishFullSnapshot++;
        else counts.outsideFullSnapshot++;
      }
      return state.snapshot.call(this);
    };
    value.getActiveRuleStates = fullSnapshotOracle
      ? function () {
          // Independent oracle keeps the original complete detached snapshot as its authority.
          return this.snapshot().state.bindings.map(({ bindingId, activeRuleIds }) => ({
            bindingId,
            activeRuleIds,
          }));
        }
      : function () {
          if (enabled) {
            counts.narrow++;
            if (depth) counts.publishNarrow++;
          }
          return state.query.call(this);
        };
    value.step = function (frame) {
      if (enabled) counts.behaviorStep++;
      return state.step.call(this, frame);
    };
    restores.push(() => {
      value.snapshot = state.snapshot;
      value.getActiveRuleStates = state.query;
      value.step = state.step;
    });
  }
  instrument(current);
  Object.defineProperty(target, "behavior", {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value: ObservedBehavior) => {
      current = value;
      instrument(value);
    },
  });
  const publish = target.publish;
  const onTick = target.onTick;
  const requests = target.requests;
  target.publish = function (...args) {
    if (enabled && !this.disposed) counts.publish++;
    depth++;
    try {
      return publish.apply(this, args);
    } finally {
      depth--;
    }
  };
  target.onTick = function (...args) {
    if (enabled) counts.physicsTicks++;
    return onTick.apply(this, args);
  };
  target.requests = function (...args) {
    if (enabled) counts.requests++;
    return requests.apply(this, args);
  };
  const views: LabViewModel[] = [];
  const unsubscribe = app.subscribe(() => views.push(clone(app.getSnapshot())));
  return {
    counts,
    views,
    rawSnapshot: () => {
      const state = states.get(current);
      assert.ok(state);
      return state.snapshot.call(current);
    },
    finish() {
      enabled = false;
      unsubscribe();
      target.publish = publish;
      target.onTick = onTick;
      target.requests = requests;
      for (const restore of restores) restore();
      Object.defineProperty(target, "behavior", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: current,
      });
    },
  };
}

const settle = async (): Promise<void> => new Promise(setImmediate);

async function workload(fullSnapshotOracle: boolean, large: boolean) {
  const restoreIdentities = deterministicIdentities();
  let app: LabRuntime | null = null;
  let observations: ReturnType<typeof installObservers> | null = null;
  try {
    app = await LabRuntime.create({ storage: memory(), useWorker: false });
    const runtime = app;
    const internals = runtime as unknown as RuntimeProbe;
    if (large) {
      const bytes = fs.readFileSync(new URL("../browser/performance-fixture.mjs", import.meta.url));
      assert.equal(hash(bytes), "32641b92aa3cd48e9eacdd979f324738567b9a4b61c64b93e14c136f6846546b");
      const source = bytes.toString();
      const constructors = source.slice(
        source.indexOf("const makeBody = "),
        source.indexOf("function wrap("),
      );
      assert.equal(Buffer.byteLength(constructors), 746);
      assert.equal(
        hash(constructors),
        "bc7425efb8a07697058e3605e7f5181514e2116f065a81f4858ef70eb7269dc3",
      );
      const scene = JSON.parse(
        JSON.stringify(vm.runInNewContext(constructors + "\nuiScene()", { createDefaultScene })),
      ) as SceneSpec;
      const document = createDefaultBehaviors(scene);
      assert.equal(scene.objects.length, 105);
      assert.equal(scene.objects.filter((value) => value.mode.startsWith("dynamic")).length, 100);
      assert.equal(document.bindings.length, 101);
      assert.equal(
        document.bindings.reduce(
          (count, binding) =>
            count +
            document.profiles.find((profile) => profile.profileId === binding.profileId)!.rules
              .length,
          0,
        ),
        301,
      );
      const project = JSON.parse(runtime.exportProject());
      project.scene = scene;
      project.soundBehaviors = document;
      await runtime.importProject(JSON.stringify(project));
    }
    const observer = installObservers(runtime, fullSnapshotOracle);
    observations = observer;
    const checkpoints: Checkpoint[] = [];
    const checkpoint = (name: string): void => {
      assert.equal(internals.audio, null);
      assert.equal(runtime.getSnapshot().error, "", name + " unexpected app error");
      checkpoints.push({
        name,
        view: clone(runtime.getSnapshot()),
        behavior: observer.rawSnapshot(),
        trace: internals.behavior.getTrace(),
        artifact: clone(runtime.getRecordingArtifact()),
        project: runtime.exportProject(),
      });
    };
    const action = async (value: LabAction): Promise<void> => {
      await runtime.dispatch(value);
      await settle();
      assert.equal(runtime.getSnapshot().error, "", value.type);
    };
    const advance = async (count: number): Promise<void> => {
      for (let i = 0; i < count; i++) {
        runtime.advance(1 / 60);
        await settle();
      }
    };
    checkpoint("initial");
    await action({ type: "run" });
    await advance(120);
    checkpoint("run120");
    await action({ type: "pause" });
    runtime.advance(1 / 60);
    await settle();
    checkpoint("pause");
    if (large) {
      await action({ type: "run" });
      await advance(20);
      await action({ type: "pause" });
      checkpoint("large140");
    } else {
      await action({ type: "addRule", objectId: "ball", trigger: "WhileMoving" });
      checkpoint("author-add-rule");
      await action({ type: "undo" });
      checkpoint("author-undo");
      await action({ type: "redo" });
      checkpoint("author-redo");
      await action({ type: "recordToggle" });
      await advance(24);
      await action({ type: "recordToggle" });
      checkpoint("capture24");
      const artifact = runtime.getRecordingArtifact();
      assert.ok(artifact);
      assert.equal(artifact.frames.length, 24);
      for (const frame of artifact.frames) {
        const saved = frame.behaviorSnapshot as {
          preStepSnapshot: BehaviorSnapshot;
          runtimeSnapshot: BehaviorSnapshot;
        };
        assert.ok(saved.preStepSnapshot);
        assert.ok(saved.runtimeSnapshot);
        for (const snapshot of [saved.preStepSnapshot, saved.runtimeSnapshot]) {
          assert.ok(Array.isArray(snapshot.state.bindings));
          assert.ok(Array.isArray(snapshot.state.instances));
          assert.ok(Array.isArray(snapshot.state.processedEventIds));
          assert.ok(Array.isArray(snapshot.voiceMetadata));
          assert.ok("inputCursor" in snapshot);
        }
      }
      const beforeCapture = checkpoints.find((value) => value.name === "author-redo");
      assert.ok(beforeCapture);
      const firstFrame = artifact.frames[0];
      assert.ok(firstFrame);
      const firstSaved = firstFrame.behaviorSnapshot as { preStepSnapshot: BehaviorSnapshot };
      assert.ok(firstSaved.preStepSnapshot.state.tick >= beforeCapture.behavior.state.tick);
      await action({ type: "replay" });
      await advance(8);
      checkpoint("replay8");
      await action({ type: "seek", timeSeconds: 2 / 60 });
      checkpoint("seek");
      await action({ type: "stopReplay" });
      checkpoint("stop-replay");
      await action({ type: "reset" });
      checkpoint("reset");
      await runtime.importProject(runtime.exportProject());
      await settle();
      checkpoint("import");
    }
    assert.equal(
      observer.views.length,
      observer.counts.publish,
      "one notification per live publication",
    );
    assert.equal(
      observer.counts.behaviorStep,
      observer.counts.physicsTicks,
      "no evaluator ticks skipped",
    );
    return { counts: clone(observer.counts), views: observer.views, checkpoints };
  } finally {
    observations?.finish();
    app?.dispose();
    restoreIdentities();
  }
}

async function compareWorkload(large: boolean): Promise<void> {
  const baseline = await workload(true, large);
  const candidate = await workload(false, large);
  assert.deepEqual(candidate.views, baseline.views, "complete ordered publication payloads");
  assert.deepEqual(
    candidate.checkpoints,
    baseline.checkpoints,
    "complete snapshots, traces, projects and capture/replay artifacts",
  );
  for (const key of [
    "publish",
    "behaviorStep",
    "physicsTicks",
    "requests",
    "outsideFullSnapshot",
  ] as const)
    assert.equal(candidate.counts[key], baseline.counts[key], key + " same workload");
  assert.equal(baseline.counts.publishFullSnapshot, baseline.counts.publish);
  assert.equal(baseline.counts.narrow, 0);
  assert.equal(candidate.counts.publishFullSnapshot, 0);
  assert.equal(candidate.counts.narrow, candidate.counts.publish);
  assert.equal(candidate.counts.publishNarrow, candidate.counts.publish);
  assert.equal(
    baseline.counts.fullSnapshot - candidate.counts.fullSnapshot,
    baseline.counts.publish,
    "exactly P fewer full snapshots",
  );
  assert.equal(candidate.counts.physicsTicks, large ? 140 : 144);
  if (!large)
    assert.ok(candidate.counts.outsideFullSnapshot >= 48, "full capture pre/post snapshots remain");
  console.log(
    JSON.stringify({
      classification: "DETERMINISTIC_APP_EQUIVALENCE_AND_OPERATION_COUNTS_NOT_PERFORMANCE",
      large,
      baseline: baseline.counts,
      candidate: candidate.counts,
      completeViewsEqual: true,
      checkpointsArtifactsEqual: true,
      audio: "NULL",
      worker: false,
    }),
  );
}

test(
  "active-rule view matches complete snapshot oracle through authoring, capture, replay and reset",
  { concurrency: false },
  async () => {
    await compareWorkload(false);
  },
);

test(
  "active-rule view preserves full ordered views and work for 105 objects, 101 bindings and 301 rules",
  { concurrency: false },
  async () => {
    await compareWorkload(true);
  },
);
