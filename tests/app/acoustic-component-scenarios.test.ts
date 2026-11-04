import test from "node:test";
import assert from "node:assert/strict";
import { invalidationScenarios } from "../../benchmarks/acoustic-transport/scenarios.js";
import {
  initialFormalInput,
  loadFormal100Scene,
  ORIGINAL_BUDGET,
} from "../../benchmarks/acoustic-transport/fixture.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import type { CorpusRow } from "../../benchmarks/acoustic-transport/corpus.js";
import { AcousticGeometryCache } from "../../src/app/acoustic-geometry-cache.js";

test("supplemental boundaries retain100dynamic and exact uncached oracles while identifying nonformal provenance", async () => {
  const { scene } = await loadFormal100Scene();
  const input = initialFormalInput(scene);
  const seed: CorpusRow = {
    id: "actual.initial",
    group: "initial",
    phase: "initial",
    tick: input.tick,
    runEpoch: "epoch.actual",
    callScope: "default-live",
    sourceEvents: [],
    input,
    expected: { ok: true, requests: buildAcousticRequests(input) },
  };
  const before = structuredClone(seed),
    rows = invalidationScenarios([seed]);
  assert.equal(rows.length, 12);
  assert.deepEqual(seed, before);
  const cache = new AcousticGeometryCache();
  let firstMisses = 0;
  for (const row of rows) {
    assert.equal(row.phase, "synthetic-boundary-only");
    assert.match(row.group, /^invalidation\./);
    assert.equal(row.input.scene.objects.length, 105);
    assert.equal(
      row.input.scene.objects.filter((object) => object.mode.startsWith("dynamic")).length,
      100,
    );
    assert.deepEqual(row.input.budget, ORIGINAL_BUDGET);
    assert.equal(row.input.sources.length, seed.input.sources.length);
    if (row.clearCacheBefore) cache.clear();
    assert.deepEqual(
      buildAcousticRequests(row.input, cache),
      row.expected.ok ? row.expected.requests : null,
    );
    if (row.group === "invalidation.cold") firstMisses = cache.getTelemetry().misses;
    if (row.group === "invalidation.unchanged-pose") {
      assert.equal(cache.getTelemetry().misses, firstMisses);
      assert.ok(cache.getTelemetry().hits > 0);
    }
  }
  assert.equal(
    rows.find((row) => row.group === "invalidation.epoch-reset")!.clearCacheBefore,
    true,
  );
  assert.notEqual(
    rows.find((row) => row.group === "invalidation.epoch-reset")!.runEpoch,
    seed.runEpoch,
  );
});

test("supplemental generation refuses replacing a rejected corpus with invented accepted work", () => {
  assert.throws(() => invalidationScenarios([]), /COMPONENT_INVALIDATION_SEED/);
});
