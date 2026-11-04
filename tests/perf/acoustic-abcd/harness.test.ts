import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formalScene, loadRow, sha256 } from "./corpus.js";
import { ARMS, distribution, runArm } from "./comparison.js";
import type { RecordedRow } from "./comparison.js";
import { NodeMeasuredPort } from "./node-port.js";
import { initialFormalInput } from "../../../benchmarks/acoustic-transport/fixture.js";
import { encodeExact } from "../../../benchmarks/acoustic-transport/corpus-codec.js";
import { buildAcousticRequests } from "../../../src/app/acoustic-input.js";
import { solveAcoustics } from "../../../src/acoustics/index.js";
import { OwnedTransferProbe } from "./transfer-probe.js";
import { LabRuntime } from "../../../src/app/runtime.js";
import type { AcousticRequest } from "../../../src/acoustics/types.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
async function row(): Promise<RecordedRow> {
  const { scene } = await formalScene(root),
    input = initialFormalInput(scene),
    requests = buildAcousticRequests(input);
  return {
    id: "supplemental.v4-static",
    group: "test-only-static",
    phase: "supplemental-test-only",
    tick: 0,
    runId: "test.run",
    runEpoch: "test.epoch",
    callScope: "default-live",
    sourceEvents: [],
    input,
    expected: { ok: true, requests },
    reference: { ok: true, solutions: requests.map(solveAcoustics) },
  };
}
test(
  "four real worker arms retain the exact V4 workload, service validation and complete solution oracle",
  { timeout: 20000 },
  async () => {
    const recorded = await row();
    for (const arm of ARMS) {
      const result = await runArm({
        arm,
        repetition: 0,
        rowCount: 1,
        loadRow: async () => recorded,
        createPort: () => new NodeMeasuredPort(),
        memory: () => process.memoryUsage(),
      });
      assert.equal(result.summary.exactRequests, 1);
      assert.equal(result.summary.exactResults, 1);
      assert.equal(result.summary.exactPathIds, 1);
      assert.equal(result.summary.accepted, 1);
      assert.deepEqual(result.summary.differences, []);
      const timing = result.rows[0]!.boundary!;
      assert.ok(
        timing.sendMs >= 0 && timing.decodeMs >= 0 && timing.solveMs >= 0 && timing.returnMs >= 0,
      );
      assert.equal(recorded.input.scene.objects.length, 105);
    }
  },
);
test(
  "oracle detects full numerical/path/identity substitution without reducing the workload",
  { timeout: 10000 },
  async () => {
    const recorded = await row();
    assert.ok(recorded.reference.ok);
    recorded.reference.solutions[0]!.frame.geometryRevision++;
    const result = await runArm({
      arm: "D",
      repetition: 0,
      rowCount: 1,
      loadRow: async () => recorded,
      createPort: () => new NodeMeasuredPort(),
    });
    assert.equal(result.summary.exactResults, 0);
    assert.equal(result.summary.differences.length, 1);
  },
);
test("recorded row SHA rejects modified corpus bytes before replay", async () => {
  const { mkdir } = await import("node:fs/promises");
  const parent = path.join(root, ".cache/acoustic-abcd");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, "hash-test-"));
  const data = encodeExact(await row()),
    entry = { path: "row-00000.json", sha256: sha256(data), bytes: Buffer.byteLength(data) };
  await writeFile(path.join(directory, entry.path), data);
  assert.equal((await loadRow(directory, entry)).id, "supplemental.v4-static");
  await writeFile(path.join(directory, entry.path), data + " ");
  await assert.rejects(loadRow(directory, entry), /CORPUS_HASH/);
  await assert.rejects(loadRow(directory, { ...entry, path: "../outside.json" }), /CORPUS_PATH/);
});
test("nearest-rank tails and signed net-memory deltas are not normalized away", () => {
  assert.deepEqual(distribution([-4, 0, 1, 2]), { count: 4, p50: 0, p95: 2, p99: 2 });
  assert.throws(() => distribution([NaN]), /NONFINITE/);
});
test("public run reset changes run/epoch; an old same-revision preview cannot replace new-run data", async () => {
  const app = await LabRuntime.create({ useWorker: false }),
    runtime = app as any;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const before = {
      runId: runtime.runId,
      epoch: runtime.runEpoch,
      revision: runtime.scene.sceneRevision,
    };
    let first = true;
    runtime.acoustics.solve = async (requests: AcousticRequest[]) => {
      const result = requests.map(solveAcoustics);
      if (first) {
        first = false;
        result[0]!.frame.stale = true;
        await gate;
      }
      return result;
    };
    const old = runtime.solveCurrent();
    await app.dispatch({ type: "reset" });
    assert.notEqual(runtime.runId, before.runId);
    assert.notEqual(runtime.runEpoch, before.epoch);
    assert.equal(runtime.scene.sceneRevision, before.revision);
    const current = new Map(runtime.solutions);
    release();
    await old;
    assert.deepEqual(new Map(runtime.solutions), current);
    assert.ok([...runtime.solutions.values()].every((solution: any) => !solution.frame.stale));
  } finally {
    release();
    app.dispose();
  }
});
test("busy preview never coalesces capture requests or drops recorded event ticks", async () => {
  const app = await LabRuntime.create({ useWorker: false }),
    runtime = app as any;
  try {
    await app.dispatch({ type: "run" });
    for (let i = 0; i < 3; i++) {
      app.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await app.dispatch({ type: "recordToggle" });
    const start = runtime.world.tick,
      captured: number[] = [],
      requests = runtime.requests;
    runtime.requests = function (...args: any[]) {
      if (args.length > 1) captured.push(this.latest.tick);
      return requests.apply(this, args);
    };
    Object.defineProperty(runtime.acoustics, "busy", { value: true, configurable: true });
    for (let i = 0; i < 5; i++) {
      app.advance(1 / 60);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    delete runtime.acoustics.busy;
    await app.dispatch({ type: "recordToggle" });
    assert.deepEqual(
      [...new Set(captured)],
      Array.from({ length: 5 }, (_, i) => start + i + 1),
    );
    const artifact = runtime.recorder.getArtifact();
    assert.equal(artifact.status, "captured");
    for (const tick of captured)
      assert.ok(artifact.frames.some((frame: any) => frame.tick === tick));
    const events = artifact.frames.flatMap((frame: any) => frame.audioEvents);
    assert.ok(events.length > 0);
    for (const event of events) assert.equal(event.simulationTimeSeconds, event.tick / 60);
  } finally {
    app.dispose();
  }
});
test("real transfer probe detaches only owned copies, returns exact bytes and reuses returned ownership", async () => {
  const probe = new OwnedTransferProbe();
  try {
    const authority = new Uint8Array([1, 2, 3, 255]);
    await assert.rejects(probe.sendOwned(authority.buffer), /NOT_OWNED/);
    const owned = probe.ownedCopy(authority),
      pending = probe.sendOwned(owned);
    assert.equal(owned.byteLength, 0);
    assert.equal(authority.byteLength, 4);
    const returned = await pending;
    assert.deepEqual(new Uint8Array(returned), authority);
    const reused = probe.sendOwned(returned);
    assert.equal(returned.byteLength, 0);
    assert.deepEqual(new Uint8Array(await reused), authority);
    assert.equal(probe.snapshot().inFlight, 0);
    assert.throws(() => probe.ownedCopy(new Uint8Array(2 * 1024 * 1024 + 1)), /CAP/);
  } finally {
    await probe.cancel();
  }
});
for (const mode of ["hold", "crash"] as const)
  test(`real transfer ${mode === "hold" ? "cancel" : "crash"} invalidates ownership; late/duplicate generation cannot settle reuse`, async () => {
    const probe = new OwnedTransferProbe();
    try {
      const oldAllocated = probe.ownedCopy(new Uint8Array([9]));
      const owned = probe.ownedCopy(new Uint8Array([7]));
      const pending = probe.sendOwned(owned, mode),
        rejected = assert.rejects(pending, mode === "hold" ? /CANCELLED/ : /PROBE_CRASH/);
      assert.equal(owned.byteLength, 0);
      await assert.rejects(probe.sendOwned(oldAllocated), /BUSY/);
      if (mode === "hold") await probe.cancel();
      await rejected;
      await assert.rejects(probe.sendOwned(oldAllocated), /STALE/);
      const snapshot = probe.snapshot();
      const current = probe.sendOwned(probe.ownedCopy(new Uint8Array([8])), "hold");
      const currentRejected = assert.rejects(current, /CANCELLED/);
      assert.equal(
        probe.acceptReturn({
          generation: snapshot.generation - 1,
          ticket: snapshot.ticket,
          buffer: new ArrayBuffer(1),
        }),
        false,
      );
      assert.equal(probe.snapshot().inFlight, 1);
      await probe.cancel();
      await currentRejected;
      const returned = await probe.sendOwned(probe.ownedCopy(new Uint8Array([8])));
      assert.deepEqual([...new Uint8Array(returned)], [8]);
      assert.equal(
        probe.acceptReturn({
          generation: probe.snapshot().generation,
          ticket: probe.snapshot().ticket,
          buffer: returned,
        }),
        false,
      );
    } finally {
      await probe.cancel();
    }
  });
