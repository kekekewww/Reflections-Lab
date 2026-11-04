import { createRenderRecordingFixture } from "/tests/audio-runtime/render-fixture.ts";
import { createRenderPreset } from "/src/audio/render-preset.ts";
import { NativeOfflineRenderBackend } from "/src/audio/render-backend.ts";
import { hashRenderBytes } from "/src/audio/render-pcm.ts";

function pcm(file) {
  const view = new DataView(file.bytes.buffer, file.bytes.byteOffset, file.bytes.byteLength);
  const channels = view.getUint16(22, true);
  const frames = view.getUint32(44, true);
  return Array.from({ length: channels }, (_, channel) =>
    Float32Array.from({ length: frames }, (_, frame) =>
      view.getFloat32(56 + (frame * channels + channel) * 4, true),
    ),
  );
}
function peakSample(samples) {
  let index = 0;
  for (let sample = 1; sample < samples.length; sample++)
    if (Math.abs(samples[sample]) > Math.abs(samples[index])) index = sample;
  return index;
}
window.runRenderValidation = async () => {
  const checks = [];
  const check = (id, pass, evidence) => checks.push({ id, pass, evidence });
  const recording = await createRenderRecordingFixture({ end: 18 });
  const { job, input } = await createRenderPreset(
    recording,
    [],
    { tailSeconds: 0.2, spatializationModel: "equalpower" },
    undefined,
    "render.browser-sum",
  );
  const backend = new NativeOfflineRenderBackend({ input });
  const result = await backend.render(job);
  check("native-recorded-take-render-completes", result.status === "completed", result);
  if (result.status === "completed") {
    const mix = pcm(backend.getFile(job.jobId, "mix"));
    const stemIds = job.outputs
      .filter((output) => output.id.startsWith("stem-"))
      .map((output) => output.id);
    const stems = stemIds.map((id) => pcm(backend.getFile(job.jobId, id)));
    let maximumError = 0;
    let mixPeak = 0;
    for (let channel = 0; channel < mix.length; channel++)
      for (let frame = 0; frame < mix[channel].length; frame++) {
        const sum = stems.reduce((value, stem) => value + stem[channel][frame], 0);
        maximumError = Math.max(maximumError, Math.abs(mix[channel][frame] - sum));
        mixPeak = Math.max(mixPeak, Math.abs(mix[channel][frame]));
      }
    check(
      "native-pre-master-object-stems-sum-to-mix",
      stemIds.length === 2 && mixPeak > 1e-5 && maximumError <= 2e-6,
      { stemIds, maximumError, mixPeak, frames: mix[0].length },
    );
    const manifest = backend.getManifest(job.jobId);
    const hashes = await Promise.all(
      manifest.files.map(async (file) => ({
        id: file.id,
        pass: (await hashRenderBytes(backend.getFile(job.jobId, file.id).bytes)) === file.sha256,
      })),
    );
    check(
      "float-WAVE-files-hash-match-atomic-manifest",
      hashes.every((value) => value.pass) &&
        result.outputs.every((output) => output.frames === mix[0].length),
      { hashes, observations: manifest.controlObservations },
    );
    const reused = await backend.render(job);
    check("same-job-id-hash-is-idempotent", JSON.stringify(reused) === JSON.stringify(result), {
      reusedStatus: reused.status,
    });
    const reusedWrong = await backend.render({ ...job, normalization: "other" });
    check(
      "same-job-id-different-content-is-rejected",
      reusedWrong.code === "RENDER_JOB_ID_REUSED",
      reusedWrong,
    );
  }
  const assetId = "asset.render-impulse";
  const source = new AudioBuffer({ numberOfChannels: 1, length: 960, sampleRate: 48000 });
  source.getChannelData(0)[480] = 1;
  const pin = { assetId, revision: 1, sha256: "a".repeat(64) };
  const sampleRecording = await createRenderRecordingFixture({
    end: 10,
    grabTick: 3,
    assets: [
      { ...pin, availability: "READY", rightsStatus: "APPROVED", durationSeconds: source.duration },
    ],
    editDocument(document) {
      document.assets = [pin];
      for (const profile of document.profiles)
        for (const rule of profile.rules) rule.enabled = false;
      const rule = document.profiles
        .flatMap((profile) => profile.rules)
        .find((rule) => rule.trigger.type === "OnGrab");
      rule.enabled = true;
      rule.generator = { kind: "sample", asset: pin, loop: false, startOffsetSeconds: 0 };
      rule.fadeInSeconds = 0;
      rule.fadeOutSeconds = 0;
    },
  });
  const bank = [
    {
      assetId,
      buffer: source,
      metadata: {
        revision: 1,
        sha256: pin.sha256,
        name: "Original render impulse",
        origin: "generated",
        license: "ORIGINAL_TEST_FIXTURE",
      },
    },
  ];
  const samplePreset = await createRenderPreset(
    sampleRecording,
    bank,
    { includeSourceStems: false, tailSeconds: 0.1, spatializationModel: "equalpower" },
    undefined,
    "render.browser-impulse",
  );
  const sampleJob = {
    ...samplePreset.job,
    outputs: [
      { ...samplePreset.job.outputs[0], id: "direct", tap: "direct" },
      samplePreset.job.outputs[2],
    ],
  };
  const sampleBackend = new NativeOfflineRenderBackend({
    input: samplePreset.input,
    onProgress: (completed) => {
      if (completed === 1) source.getChannelData(0).fill(0);
    },
  });
  const sampleResult = await sampleBackend.render(sampleJob);
  if (sampleResult.status === "completed") {
    const first = sampleRecording.frames.find((frame) =>
      frame.audioEvents.some((event) => event.action === "start"),
    );
    const directPath = first.acousticFrames[0].paths.find((path) => path.order === 0);
    const expectedDry = (first.tick - sampleRecording.startTick) * 800 + 480;
    const expectedDirect = Math.round(expectedDry + directPath.absoluteDelayS * 48000);
    const direct = pcm(sampleBackend.getFile(sampleJob.jobId, "direct"));
    const dry = pcm(sampleBackend.getFile(sampleJob.jobId, "dry"));
    const directPeak = peakSample(direct[0]);
    const dryPeak = peakSample(dry[0]);
    check(
      "pinned-sample-onset-and-propagation-delay-once",
      Math.abs(directPeak - expectedDirect) <= 1 &&
        dryPeak === expectedDry &&
        Math.abs(direct[0][directPeak]) > 0,
      {
        expectedDirect,
        expectedDry,
        directPeak,
        dryPeak,
        absoluteDelayS: directPath.absoluteDelayS,
      },
    );
  } else check("pinned-sample-onset-and-propagation-delay-once", false, sampleResult);
  const cancelled = await createRenderPreset(
    recording,
    [],
    { tailSeconds: 0.1, spatializationModel: "equalpower" },
    undefined,
    "render.browser-cancel",
  );
  let cancelBackend;
  cancelBackend = new NativeOfflineRenderBackend({
    input: cancelled.input,
    onProgress: () => {
      void cancelBackend.cancel(cancelled.job.jobId);
    },
  });
  const cancelledResult = await cancelBackend.render(cancelled.job);
  check(
    "cancel-between-outputs-prevents-partial-publication",
    cancelledResult.status === "cancelled" &&
      cancelBackend.getManifest(cancelled.job.jobId) === null &&
      cancelBackend.getFile(cancelled.job.jobId, "mix") === null,
    cancelledResult,
  );
  return {
    status: checks.every((item) => item.pass) ? "PASS" : "FAIL",
    checks,
    userAgent: navigator.userAgent,
    limitations: [
      "Actual headless Chrome OfflineAudioContext output; no hearing or device latency claim.",
      "Controls have recorded render-quantum offsets; source onset/absolute propagation are tested independently.",
      "No full V1 or 600-second performance claim.",
    ],
  };
};
document.body.textContent = "Render fixture ready";
