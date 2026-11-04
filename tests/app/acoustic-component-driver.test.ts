import test from "node:test";
import assert from "node:assert/strict";
import { CONFIGURATIONS } from "../../benchmarks/acoustic-transport/component.js";
import { prepareOracles, runConfiguration } from "../../benchmarks/acoustic-transport/driver.js";
import { errorIdentity, exactDataEqual } from "../../benchmarks/acoustic-transport/corpus.js";
import type { CorpusRow } from "../../benchmarks/acoustic-transport/corpus.js";
import {
  loadFormal100Scene,
  initialFormalInput,
} from "../../benchmarks/acoustic-transport/fixture.js";
import { buildAcousticRequests } from "../../src/app/acoustic-input.js";
import type { AcousticInput } from "../../src/app/acoustic-input.js";

function makeRow(
  input: AcousticInput,
  id: string,
  group = "initial",
  clearCacheBefore = false,
): CorpusRow {
  const sourceEvents = input.sources.map((source) => ({
    instanceId: source.id,
    bindingId:
      source.objectId === "speaker"
        ? "binding.continuous.speaker"
        : `binding.interactive.${source.objectId}`,
    profileId:
      source.objectId === "speaker" ? "profile.continuous-tone" : "profile.interactive-tone",
    profileRevision: 1,
    ruleId: source.objectId === "speaker" ? "rule.always" : "rule.impact",
    objectId: source.objectId,
    generation: 1,
    positionMetres: [...source.positionM] as [number, number, number],
  }));
  let expected: CorpusRow["expected"];
  try {
    expected = { ok: true, requests: buildAcousticRequests(input) };
  } catch (error) {
    expected = errorIdentity(error);
  }
  return {
    id,
    group,
    phase: "unit-fixture",
    tick: input.tick,
    runEpoch: "epoch.component-unit",
    callScope: "default-live",
    sourceEvents,
    input,
    expected,
    clearCacheBefore,
  };
}
async function fullInput(): Promise<AcousticInput> {
  const { scene } = await loadFormal100Scene();
  const input = initialFormalInput(scene);
  const ball = scene.objects.find((object) => object.id === "ball")!;
  input.sources = [
    { ...input.sources[0]!, id: "node.voice.speaker" },
    { id: "node.voice.ball", objectId: ball.id, positionM: [...ball.positionM] },
  ];
  return input;
}

test(
  "all four driver configurations retain the complete100dynamic request/solution oracle and physical worker exit",
  { timeout: 20000 },
  async () => {
    const rows = [makeRow(await fullInput(), "full.initial")],
      before = structuredClone(rows);
    const prepared = prepareOracles(rows);
    const checksums: number[] = [];
    for (const configuration of CONFIGURATIONS) {
      const result = await runConfiguration(rows, configuration, prepared, {
        warmup: 0,
        repetitions: 1,
        copyProbe: false,
      });
      assert.equal(result.summary.acceptedRows, 1);
      assert.equal(result.summary.buildRejectedRows, 0);
      assert.equal(result.rows.length, 1);
      const row = result.rows[0]!;
      assert.equal(row.status, "accepted");
      assert.equal(row.sourceCount, 2);
      assert.ok(
        row.geometry!.every(
          (entry) => entry.surfaces === 24 && entry.primitives >= 66 && entry.boxOccluders === 33,
        ),
      );
      assert.ok(Number.isFinite(row.metrics.builderMs));
      assert.ok(Number.isFinite(row.metrics.serviceMs));
      assert.ok(Number.isFinite(row.metrics.totalComponentAgeMs));
      assert.equal(row.metrics.runtimeAudioConsumerMs, null);
      assert.equal(row.metrics.nativeOnsetSeconds, null);
      assert.equal(row.metrics.livePoseAgeTicks, null);
      assert.equal(row.metrics.vmAllocationBytes, null);
      assert.equal(result.copyProbe, null);
      assert.ok(result.nodeTelemetry.every((port) => port.state === "closed"));
      assert.equal(result.allNodeWorkersExited, true);
      checksums.push(row.consumerChecksum!);
    }
    assert.ok(checksums.every((value) => value === checksums[0]));
    assert.ok(exactDataEqual(rows, before));
  },
);

test("recorded request corruption and substituted gain oracles are refused before a timed configuration", async () => {
  const rows = [makeRow(await fullInput(), "oracle.initial")];
  const badExpected = structuredClone(rows);
  assert.ok(badExpected[0]!.expected.ok);
  badExpected[0]!.expected.requests[0]!.listener.positionM = [99, 99, 99];
  assert.throws(() => prepareOracles(badExpected), /COMPONENT_RECORDED_REQUEST_ORACLE/);
  const prepared = prepareOracles(rows);
  const substituted = structuredClone(prepared);
  substituted.rows[0]!.solutions![0]!.frame.paths[0]!.bandGains[0]! += 1e-14;
  await assert.rejects(
    runConfiguration(rows, "A", substituted, { warmup: 0, repetitions: 1 }),
    /COMPONENT_PREPARED_ORACLE/,
  );
  const changedRows = structuredClone(rows);
  changedRows[0]!.input.tick++;
  await assert.rejects(
    runConfiguration(changedRows, "A", prepared, { warmup: 0, repetitions: 1 }),
    /COMPONENT_CORPUS_CHANGED/,
  );
});

test(
  "same-revision pose changes and explicit cache reset cannot reuse old world geometry",
  { timeout: 15000 },
  async () => {
    const first = await fullInput();
    const moving = structuredClone(first);
    moving.tick++;
    const pose = moving.poses.find((value) => value.objectId === "profile.body.2")!;
    assert.ok("positionM" in pose);
    Reflect.set(pose.positionM, "0", 1.1);
    [Math.SQRT1_2, 0, 0, Math.SQRT1_2].forEach((value, index) =>
      Reflect.set(pose.orientationQuaternion, String(index), value),
    );
    const reset = structuredClone(moving);
    reset.tick++;
    const rows = [
      makeRow(first, "motion.initial"),
      makeRow(moving, "motion.same-revision", "moving"),
      makeRow(reset, "motion.reset", "invalidation.reset", true),
    ];
    const prepared = prepareOracles(rows);
    const result = await runConfiguration(rows, "D", prepared, { warmup: 0, repetitions: 1 });
    assert.equal(result.summary.acceptedRows, 3);
    assert.ok(result.rows[1]!.cacheAfter!.misses > result.rows[0]!.cacheAfter!.misses);
    assert.equal(
      result.rows[2]!.cacheAfter!.generation,
      result.rows[1]!.cacheAfter!.generation + 1,
    );
    assert.ok(result.groups["invalidation.reset"]!.latency!.builderMs);
    assert.equal(result.allNodeWorkersExited, true);
  },
);

test(
  "copy probing is a separate untimed pass with its own closed worker",
  { timeout: 15000 },
  async () => {
    const rows = [makeRow(await fullInput(), "probe.initial")],
      prepared = prepareOracles(rows);
    const result = await runConfiguration(rows, "C", prepared, {
      warmup: 0,
      repetitions: 1,
      copyProbe: true,
    });
    assert.equal(result.rows.length, 1);
    assert.equal(result.summary.acceptedRows, 1);
    assert.ok(result.copyProbe);
    assert.equal(result.copyProbe.rows.length, 1);
    assert.ok(result.copyProbe.rows[0]!.copies.calls > 0);
    assert.equal(result.copyProbe.rows[0]!.copies.vmAllocationBytes, null);
    assert.equal(result.copyProbe.rows[0]!.copies.nativeWireBytes, null);
    assert.equal(result.copyProbe.timed, false);
    assert.ok(result.copyProbe.nodeTelemetry.every((port) => port.state === "closed"));
  },
);

test(
  "an original17-source builder rejection is retained in full and never enters accepted latency summaries",
  { timeout: 15000 },
  async () => {
    const input = await fullInput();
    input.sources = Array.from({ length: 17 }, (_, index) => {
      const object = input.scene.objects.find((value) => value.id === `profile.body.${index}`)!;
      return { id: `voice.impact.${index}`, objectId: object.id, positionM: [...object.positionM] };
    });
    const rows = [makeRow(input, "rejection.original", "moving")],
      prepared = prepareOracles(rows);
    assert.equal(rows[0]!.expected.ok, false);
    const result = await runConfiguration(rows, "D", prepared, { warmup: 0, repetitions: 1 });
    assert.equal(result.summary.acceptedRows, 0);
    assert.equal(result.summary.buildRejectedRows, 1);
    assert.equal(result.rows[0]!.status, "build-rejected");
    assert.equal(result.rows[0]!.sourceCount, 17);
    assert.equal(result.rows[0]!.sourceIds.length, 17);
    assert.equal(result.rows[0]!.error?.code, "SOURCE_BUDGET");
    assert.equal(result.rows[0]!.metrics.serviceMs, null);
    assert.equal(result.groups.moving!.latency, null);
    assert.equal(result.serviceTelemetry.submittedBatches, 0);
    assert.ok(
      result.nodeTelemetry.every((port) => port.postCalls === 0 && port.state === "closed"),
    );
  },
);

test(
  "live and explicit-event DTO rows retain separate latency summaries",
  { timeout: 15000 },
  async () => {
    const input = await fullInput();
    const live = makeRow(input, "scopes.live", "moving");
    const capture = makeRow(structuredClone(input), "scopes.capture", "moving");
    capture.callScope = "explicit-event-batch";
    const rows = [live, capture],
      prepared = prepareOracles(rows);
    const result = await runConfiguration(rows, "D", prepared, { warmup: 0, repetitions: 1 });
    assert.equal(result.summary.acceptedRows, 2);
    assert.equal(result.summary.latency, null);
    assert.equal(result.groups.moving!.latency, null);
    assert.equal(result.groupsByCallScope["moving/default-live"]!.acceptedRows, 1);
    assert.ok(result.groupsByCallScope["moving/default-live"]!.latency!.serviceMs);
    assert.equal(result.groupsByCallScope["moving/explicit-event-batch"]!.acceptedRows, 1);
    assert.ok(result.groupsByCallScope["moving/explicit-event-batch"]!.latency!.serviceMs);
    assert.match(result.timingScope, /not the RecordingEvaluationClient capture pipeline/);
    assert.equal(result.allNodeWorkersExited, true);
  },
);
