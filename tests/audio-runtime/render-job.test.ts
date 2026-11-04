import assert from "node:assert/strict";
import test from "node:test";
import { createRenderPreset } from "../../src/audio/render-preset.js";
import {
  renderTickSample,
  validateRenderJob,
  verifyRenderInput,
} from "../../src/audio/render-validation.js";
import { sha256Canonical } from "../../src/experiments/hash.js";
import { createRenderRecordingFixture } from "./render-fixture.js";
import { SEEKABLE_HARMONIC_CONTENT_MODEL } from "../../src/audio/content-model.js";
import type { RenderJob } from "../../src/audio/render-contract.js";

test("a real captured Behavior/solver take produces a validated mix, dry, master and complete object stems", async () => {
  const recording = await createRenderRecordingFixture();
  const { job, input } = await createRenderPreset(
    recording,
    [],
    { tailSeconds: 0.25 },
    undefined,
    "render.valid",
  );
  const plan = await verifyRenderInput(job, input);
  assert.deepEqual(
    job.outputs.slice(0, 3).map((item) => item.id),
    ["mix", "master", "dry"],
  );
  assert.equal(job.outputs.filter((item) => item.id.startsWith("stem-")).length, 2);
  assert.equal(plan.outputFrames, 12 * 800 + 12000);
  assert.equal(plan.startFrameIndex, 0);
  const selected = job.outputs
    .filter((item) => item.sources.kind === "includeRecordedSourceIds")
    .flatMap((item) =>
      item.sources.kind === "includeRecordedSourceIds" ? [...item.sources.sourceIds] : [],
    );
  assert.equal(new Set(selected).size, selected.length);
});

test("closed schema, unsupported capabilities and missing source selection fail before native allocation", async () => {
  const { job, input } = await createRenderPreset(await createRenderRecordingFixture(), []);
  assert.throws(() => validateRenderJob({ ...job, hidden: true } as RenderJob, input), /exactly/);
  assert.throws(
    () => validateRenderJob({ ...job, requiredCapabilities: ["sampleScheduledControls"] }, input),
    /required capability/,
  );
  assert.throws(
    () => validateRenderJob({ ...job, outputs: [{ ...job.outputs[0]!, tap: "late" }] }, input),
    /late-reverb tap/,
  );
  assert.throws(
    () =>
      validateRenderJob(
        {
          ...job,
          outputs: [
            {
              ...job.outputs[0]!,
              sources: { kind: "includeRecordedSourceIds", sourceIds: ["not-recorded"] },
            },
          ],
        },
        input,
      ),
    /missing or duplicate/,
  );
  assert.throws(
    () => validateRenderJob({ ...job, outputs: [job.outputs[0]!, job.outputs[0]!] }, input),
    /unique/,
  );
});

test("frame/byte budgets have exact inclusive boundaries and reject before native allocation", async () => {
  const { job, input } = await createRenderPreset(await createRenderRecordingFixture(), []);
  const plan = validateRenderJob(job, input);
  const exact = {
    ...job,
    budget: {
      maxOutputFrames: plan.outputFrames,
      maxOutputBytes: plan.outputBytes,
      maxWorkingBytes: plan.estimatedWorkingBytes,
    },
  };
  assert.equal(validateRenderJob(exact, input).outputFrames, plan.outputFrames);
  for (const field of ["maxOutputFrames", "maxOutputBytes", "maxWorkingBytes"] as const)
    assert.throws(
      () =>
        validateRenderJob(
          { ...exact, budget: { ...exact.budget, [field]: exact.budget[field] - 1 } },
          input,
        ),
      /budget/,
    );
});

test("recording and graph hashes, scene/clock pins and incomplete captures reject", async () => {
  const { job, input } = await createRenderPreset(await createRenderRecordingFixture(), []);
  await assert.rejects(
    () =>
      verifyRenderInput({ ...job, recording: { ...job.recording, sha256: "0".repeat(64) } }, input),
    /recording bytes/,
  );
  await assert.rejects(
    () =>
      verifyRenderInput(
        { ...job, renderConfiguration: { ...job.renderConfiguration, sha256: "0".repeat(64) } },
        input,
      ),
    /configuration/,
  );
  assert.throws(
    () => validateRenderJob({ ...job, sceneRevision: job.sceneRevision + 1 }, input),
    /pin differs/,
  );
  assert.throws(
    () =>
      validateRenderJob(job, {
        ...input,
        recording: { ...input.recording, status: "interrupted" },
      }),
    /complete/,
  );
  const configuration = {
    ...input.configuration,
    master: { ...input.configuration.master, monitorGain: 99 },
  };
  await assert.rejects(
    async () =>
      verifyRenderInput(
        {
          ...job,
          renderConfiguration: {
            ...job.renderConfiguration,
            sha256: await sha256Canonical(configuration),
          },
        },
        { ...input, configuration },
      ),
    /gain/,
  );
});

test("preroll begins on actual captured ticks and retains rational sample origins", async () => {
  const { job, input } = await createRenderPreset(await createRenderRecordingFixture(), []);
  const window = { ...job.window, startTick: 6, preRollFrames: 5 * 800 };
  assert.equal(validateRenderJob({ ...job, window }, input).startFrameIndex, 0);
  assert.throws(
    () => validateRenderJob({ ...job, window: { ...window, preRollFrames: 5 * 800 - 1 } }, input),
    /tick boundary/,
  );
  assert.equal(renderTickSample(job, 61), 48000);
  const other = await createRenderPreset(
    await createRenderRecordingFixture({ sampleRateHz: 44100 }),
    [],
  );
  assert.equal(renderTickSample(other.job, 61), 44100);
});

test("offline source-model pins preserve legacy content and reject unknown models before native allocation", async () => {
  const known = await createRenderPreset(
    await createRenderRecordingFixture({ audioContentModel: SEEKABLE_HARMONIC_CONTENT_MODEL }),
    [],
  );
  assert.ok((await verifyRenderInput(known.job, known.input)).outputFrames > 0);
  const unknown = await createRenderPreset(
    await createRenderRecordingFixture({
      audioContentModel: { ...SEEKABLE_HARMONIC_CONTENT_MODEL, version: 2 },
    }),
    [],
  );
  await assert.rejects(() => verifyRenderInput(unknown.job, unknown.input), /content model/);
});
