import assert from "node:assert/strict";
import test from "node:test";
import { createRenderPreset } from "../../src/audio/render-preset.js";
import { validateRenderJob } from "../../src/audio/render-validation.js";
import { createRenderRecordingFixture } from "./render-fixture.js";

// Admission tests only: real 3600-tick capture/native PCM are separate browser evidence.
async function longAdmission() {
  const recording = await createRenderRecordingFixture({
    editScene(scene) {
      scene.objects = scene.objects.filter((object) =>
        ["floor", "speaker", "ball"].includes(object.id),
      );
    },
  });
  const { job, input } = await createRenderPreset(recording, [], { tailSeconds: 2 });

  const frames = Array.from({ length: 3600 }, (_, index) => {
    const { behaviorSnapshot: _history, ...frame } =
      recording.frames[index % recording.frames.length]!;
    void _history;
    return { ...frame, tick: index + 1 };
  });
  const longInput = {
    ...input,
    recording: { ...recording, frames, frameCount: 3600, endTick: 3600 },
  };
  const longJob = { ...job, window: { ...job.window, endTickExclusive: 3601 } };
  return { job: longJob, input: longInput };
}

test("60 second stereo emission plus two second tail has exact frame/encoded-byte admission", async () => {
  const { job, input } = await longAdmission();
  const plan = validateRenderJob(job, input);
  assert.equal(plan.emissionFrames, 2880000);
  assert.equal(plan.outputFrames, 2976000);
  assert.equal(plan.contextFrames, 2976000);
  assert.equal(plan.outputBytes, 5 * (56 + 2976000 * 2 * 4));
  assert.ok(plan.estimatedWorkingBytes <= job.budget.maxWorkingBytes);
});

test("long output is bounded at exactly 60 seconds, with at most 75 seconds native context", async () => {
  const { job, input } = await longAdmission();
  assert.doesNotThrow(() => validateRenderJob(job, input));
  const extra = {
    ...input,
    recording: {
      ...input.recording,
      endTick: 3601,
      frames: [...input.recording.frames, { ...input.recording.frames[0]!, tick: 3601 }],
      frameCount: 3601,
    },
  };
  assert.throws(
    () => validateRenderJob({ ...job, window: { ...job.window, endTickExclusive: 3602 } }, extra),
    /60 second/,
  );
  assert.throws(
    () => validateRenderJob({ ...job, window: { ...job.window, tailFrames: 480001 } }, input),
    /tail/i,
  );
});

test("long admission does not count every persisted WAV as resident PCM but counts a whole native output", async () => {
  const { job, input } = await longAdmission();
  const one = validateRenderJob({ ...job, outputs: [job.outputs[0]!] }, input);
  const five = validateRenderJob(job, input);
  assert.equal(five.estimatedWorkingBytes, one.estimatedWorkingBytes);
  assert.ok(five.estimatedWorkingBytes >= five.contextFrames * 2 * 4);
  assert.ok(five.outputBytes > one.outputBytes);
  assert.throws(
    () =>
      validateRenderJob(
        { ...job, budget: { ...job.budget, maxWorkingBytes: five.estimatedWorkingBytes - 1 } },
        input,
      ),
    /budget/,
  );
  assert.throws(
    () =>
      validateRenderJob(
        { ...job, budget: { ...job.budget, maxOutputBytes: five.outputBytes - 1 } },
        input,
      ),
    /budget/,
  );
});
