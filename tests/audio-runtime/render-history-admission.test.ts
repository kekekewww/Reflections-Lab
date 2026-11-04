import assert from "node:assert/strict";
import test from "node:test";
import { NativeOfflineRenderBackend } from "../../src/audio/render-backend.js";
import { createRenderPreset } from "../../src/audio/render-preset.js";
import { validateRenderJob, type ValidatedRenderPlan } from "../../src/audio/render-validation.js";
import type { RenderJob } from "../../src/audio/render-contract.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

test("finite preroll longer than an estimated tail never certifies unknown opaque native DSP history", async () => {
  const recording = await createRenderRecordingFixture({
    start: 3,
    end: 210,
    grabTick: null,
    editScene(scene) {
      scene.objects = scene.objects.filter((object) =>
        ["floor", "speaker", "ball"].includes(object.id),
      );
    },
  });
  const { job, input } = await createRenderPreset(recording, []);
  const windowed = { ...job, window: { ...job.window, startTick: 183, preRollFrames: 144000 } };
  const plan = validateRenderJob(windowed, input);
  const backend = new NativeOfflineRenderBackend({ input });
  const history = backend as unknown as {
    historyIncomplete(job: RenderJob, plan: ValidatedRenderPlan, required: number): boolean;
  };
  assert.equal(history.historyIncomplete(windowed, plan, 2), true);
  backend.dispose();
});

test("captured path counts above native limits are rejected before graph allocation rather than silently dropped", async () => {
  const recording = await createRenderRecordingFixture({
    grabTick: null,
    editFrame(frame) {
      const acoustic = frame.acousticFrames[0];
      const path = acoustic?.paths[0];
      if (acoustic && path)
        acoustic.paths = Array.from({ length: 17 }, (_, index) => ({
          ...path,
          id: `${path.id}.negative-${index}`,
        }));
    },
  });
  const { job, input } = await createRenderPreset(recording, []);
  assert.throws(() => validateRenderJob(job, input), /native.*path|path.*native/i);
});
