import { attachAcousticCorpus } from "../../benchmarks/acoustic-transport/corpus.js";
import type { RuntimeForCorpus } from "../../benchmarks/acoustic-transport/corpus.js";
import { LabRuntime } from "../../src/app/runtime.js";
import { DEFAULT_MATERIALS } from "../../src/app/defaults.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadFormal100Scene,
  initialFormalInput,
  qualifyPrimaryInput,
} from "../../benchmarks/acoustic-transport/fixture.js";
import {
  assertFullOracle,
  observeExplicitCopies,
  summarize,
} from "../../benchmarks/acoustic-transport/component.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import { solveAcoustics } from "../../src/acoustics/index.js";

test("benchmark uses the exact original100dynamic scene and existing full geometry compaction", async () => {
  const formal = await loadFormal100Scene();
  const input = initialFormalInput(formal.scene);
  const qualification = qualifyPrimaryInput(input, formal.scene);
  assert.equal(qualification.objects, 105);
  assert.equal(qualification.dynamicBodies, 100);
  const request = buildAcousticRequests(input)[0]!;
  assert.equal(request.surfaces.length, 24);
  assert.equal(request.primitives?.length, 67);
  assert.equal(request.boxOccluders?.length, 33);
  assert.equal(request.budget?.maxPaths, 8);
  assert.equal(request.budget?.maxSurfaces, 256);
  assert.equal(request.budget?.maxSegmentTests, 10000);
  assert.match(formal.fixtureSha256, /^[a-f0-9]{64}$/);
});

test("qualification refuses reduced bodies, altered material roles and relaxed solver budgets", async () => {
  const { scene } = await loadFormal100Scene();
  for (const change of [
    (input: ReturnType<typeof initialFormalInput>) => {
      input.scene.objects.pop();
    },
    (input: ReturnType<typeof initialFormalInput>) => {
      input.scene.objects.find((object) => object.id === "profile.body.0")!.acousticRole = "none";
    },
    (input: ReturnType<typeof initialFormalInput>) => {
      input.budget = { ...input.budget, maxPaths: 4 };
    },
  ]) {
    const input = initialFormalInput(scene);
    change(input);
    assert.throws(() => qualifyPrimaryInput(input, scene), /COMPONENT_WORKLOAD/);
  }
});

test("full oracle catches even tiny gains, identity, path or signed-zero differences", async () => {
  const { scene } = await loadFormal100Scene();
  const requests = buildAcousticRequests(initialFormalInput(scene));
  const solutions = requests.map(solveAcoustics);
  assertFullOracle(requests, requests, solutions, solutions);
  const changed = structuredClone(solutions);
  changed[0]!.frame.paths[0]!.bandGains[0]! += 1e-14;
  assert.throws(() => assertFullOracle(requests, requests, solutions, changed));
  const changedRequests = structuredClone(requests);
  changedRequests[0]!.source.positionM = [-0, 1.3, -2];
  const zeroRequests = structuredClone(changedRequests);
  zeroRequests[0]!.source.positionM = [0, 1.3, -2];
  assert.throws(() => assertFullOracle(zeroRequests, changedRequests, solutions, solutions));
});

test("copy probe counts explicit owned graph copies separately from unknown VM or wire bytes", async () => {
  const before = globalThis.structuredClone;
  const shared = [1, 2];
  const observed = await observeExplicitCopies(() =>
    structuredClone({ first: shared, second: shared }),
  );
  assert.equal(observed.copies.calls, 1);
  assert.equal(observed.copies.uniqueContainers, 2);
  assert.equal(observed.copies.numericValues, 2);
  assert.equal(observed.copies.vmAllocationBytes, null);
  assert.equal(observed.copies.nativeWireBytes, null);
  assert.strictEqual(observed.value.first, observed.value.second);
  assert.strictEqual(globalThis.structuredClone, before);
  await assert.rejects(
    observeExplicitCopies(() => {
      throw new Error("probe failure");
    }),
    /probe failure/,
  );
  assert.strictEqual(globalThis.structuredClone, before);
});

test("duration summaries preserve all observations and do not mutate the input", () => {
  const values = [9, 1, 5, 3, 7];
  const before = [...values];
  assert.deepEqual(summarize(values), { count: 5, min: 1, median: 5, p95: 9, max: 9 });
  assert.deepEqual(values, before);
  assert.throws(() => summarize([1, NaN]), /COMPONENT_TIMING/);
});

test("corpus sidecar records actual runtime requests/events and restores every observed method", async () => {
  const app = await LabRuntime.create({ useWorker: false });
  const runtime = app as unknown as RuntimeForCorpus;
  const original = {
    requests: runtime.requests,
    onTick: runtime.onTick,
    step: runtime.behavior.step,
  };
  const collector = attachAcousticCorpus(runtime, {
    materials: DEFAULT_MATERIALS,
    origin: "unit-actual-runtime",
    maxRows: 16,
  });
  try {
    collector.captureNow("initial");
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    await new Promise<void>((resolve) => setImmediate(resolve));
    collector.captureNow("moving");
    collector.assertValid();
    const state = collector.snapshot();
    assert.ok(state.rows.length >= 2);
    assert.ok(state.audioEvents.length > 0);
    assert.equal(state.rows[0]!.expected.ok, true);
    state.rows[0]!.input.scene.sceneId = "mutated.only.test.copy";
    assert.notEqual(collector.snapshot().rows[0]!.input.scene.sceneId, "mutated.only.test.copy");
  } finally {
    collector.dispose();
    app.dispose();
  }
  assert.strictEqual(runtime.requests, original.requests);
  assert.strictEqual(runtime.onTick, original.onTick);
  assert.strictEqual(runtime.behavior.step, original.step);
});
