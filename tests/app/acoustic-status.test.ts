import assert from "node:assert/strict";
import test from "node:test";
import { LabRuntime } from "../../src/app/runtime.js";
import type { AcousticSolution } from "../../src/acoustics/types.js";

async function withRuntime(run: (app: LabRuntime, internal: any) => Promise<void> | void) {
  const app = await LabRuntime.create({ useWorker: false });
  try {
    await run(app, app);
  } finally {
    app.dispose();
  }
}
function result(internal: any): AcousticSolution {
  const solution = internal.solutions.values().next().value;
  assert.ok(solution, "fixture starts from an actual solver result");
  return solution;
}

test("public vacuum edit reports unavailable, preserves historical path reference and null metrics", async () => {
  await withRuntime(async (app) => {
    const before = app.getSnapshot();
    assert.equal(before.acoustic.state, "ready");
    const selected = before.paths[0]!.id;
    await app.dispatch({ type: "selectPath", pathId: selected });
    await app.dispatch({ type: "setAtmosphere", medium: "vacuum" });
    const vacuum = app.getSnapshot();
    assert.equal(vacuum.acoustic.state, "unavailable");
    assert.deepEqual(vacuum.paths, []);
    assert.equal(vacuum.selectedPathId, selected);
    assert.equal(vacuum.acoustic.revision, vacuum.sceneRevision);
    assert.equal(vacuum.acoustic.metrics[0]!.value, null);
    assert.match(vacuum.acoustic.metrics[0]!.reason!, /真空/);
    await app.dispatch({ type: "setAtmosphere", medium: "air" });
    assert.equal(app.getSnapshot().acoustic.state, "ready");
    assert.equal(app.getSnapshot().selectedPathId, selected);
    assert.ok(app.getSnapshot().paths.some((path) => path.id === selected));
  });
});

test("an available solver result with no paths is empty, not unavailable or not computed", async () => {
  await withRuntime((app, internal) => {
    result(internal).frame.paths = [];
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "ready");
    assert.equal(app.getSnapshot().acoustic.revision, app.getSnapshot().sceneRevision);
    assert.deepEqual(app.getSnapshot().paths, []);
  });
});

test("an explicit unsupported frame is not labeled computed", async () => {
  await withRuntime((app, internal) => {
    const frame = result(internal).frame;
    frame.pathAvailability = "unsupported";
    frame.paths = [];
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "unsupported");
  });
});

test("a failed path result is an error even when a frame exists", async () => {
  await withRuntime((app, internal) => {
    const frame = result(internal).frame;
    frame.pathAvailability = "failed";
    frame.paths = [];
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "error");
  });
});

test("no solver result is idle and has no result revision", async () => {
  await withRuntime((app, internal) => {
    internal.solutions.clear();
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "unsupported");
    assert.equal(app.getSnapshot().acoustic.revision, null);
    assert.equal(app.getSnapshot().acoustic.metrics[0]!.value, null);
    assert.deepEqual(app.getSnapshot().paths, []);
  });
});

test("pending and stale take precedence over unavailable and preserve result revisions", async () => {
  await withRuntime(async (app, internal) => {
    await app.dispatch({ type: "setAtmosphere", medium: "vacuum" });
    const frame = result(internal).frame;
    frame.sceneRevision = 17;
    Object.defineProperty(internal.acoustics, "busy", { value: true, configurable: true });
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "pending");
    assert.equal(app.getSnapshot().acoustic.revision, 17);
    delete internal.acoustics.busy;
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "stale");
    assert.equal(app.getSnapshot().acoustic.revision, 17);
    frame.sceneRevision = app.getSnapshot().sceneRevision;
    frame.poseTick++;
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "stale");
    frame.poseTick = app.getSnapshot().tick;
    frame.stale = true;
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "stale");
  });
});

test("actual numeric zero remains available and distinct from null", async () => {
  await withRuntime((app, internal) => {
    const frame = result(internal).frame;
    frame.directDelayS = 0;
    frame.paths[0]!.absoluteDelayS = 0;
    frame.paths[0]!.bandGains.fill(0);
    internal.publish();
    const model = app.getSnapshot();
    assert.equal(model.acoustic.state, "ready");
    assert.equal(model.acoustic.metrics[0]!.value, 0);
    assert.equal(model.paths[0]!.delaySeconds, 0);
    assert.equal(model.paths[0]!.gainLinear, 0);
    assert.equal(model.acoustic.metrics[1]!.value, null);
  });
});

test("all frames contribute status; a failed second source cannot be hidden by the first result", async () => {
  await withRuntime((app, internal) => {
    const second = structuredClone(result(internal));
    second.frame.sourceId = "fixture.second-source";
    second.frame.pathAvailability = "failed";
    second.frame.paths = [];
    internal.solutions.set(second.frame.sourceId, second);
    internal.publish();
    assert.equal(app.getSnapshot().acoustic.state, "error");
  });
});

test("an empty first source does not hide paths returned for a second source", async () => {
  await withRuntime((app, internal) => {
    const first = result(internal);
    const second = structuredClone(first);
    second.frame.sourceId = "fixture.second-source";
    for (const path of second.frame.paths) path.sourceId = second.frame.sourceId;
    internal.solutions.set(second.frame.sourceId, second);
    first.frame.paths = [];
    internal.publish();
    const model = app.getSnapshot();
    assert.equal(model.acoustic.state, "ready");
    assert.equal(model.paths.length, second.frame.paths.length);
    assert.ok(model.paths.length > 0);
    assert.ok(model.paths.every((path) => path.sourceId === second.frame.sourceId));
  });
});
