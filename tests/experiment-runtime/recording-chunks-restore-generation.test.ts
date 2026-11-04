import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RecordingHost } from "../../src/app/recording-host.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { options, frame } from "./worker-fixture.js";

async function captured(runId: string) {
  const recorder = new ExperimentRecorder(options(runId));
  recorder.appendFrame(frame(0));
  return recorder.finish();
}
function deferCrypto(t: TestContext) {
  let release!: () => void, ready!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  t.mock.method(
    crypto.subtle,
    "digest",
    async (algorithm: AlgorithmIdentifier, bytes: BufferSource) => {
      const result = digest(algorithm, bytes);
      ready();
      await gate;
      return result;
    },
  );
  return { release, entered };
}

test("dispose during restore verification cannot publish to the old host generation", async (t) => {
  const previous = await captured("run.previous");
  const incoming = await captured("run.incoming");
  const host = new RecordingHost({ getConfig: options });
  await host.restoreArtifact(previous);
  const gate = deferCrypto(t);
  const restoring = host.restoreArtifact(incoming);
  await gate.entered;
  host.dispose();
  gate.release();
  await assert.rejects(restoring, { code: "OPERATION_CANCELLED" });
  assert.equal(host.getArtifact()!.artifactSha256, previous.artifactSha256);
});

test("capture started during restore verification keeps input ownership and the prior artifact", async (t) => {
  const previous = await captured("run.previous");
  const incoming = await captured("run.incoming");
  const host = new RecordingHost({ getConfig: options });
  await host.restoreArtifact(previous);
  const gate = deferCrypto(t);
  const restoring = host.restoreArtifact(incoming);
  await gate.entered;
  host.start();
  host.appendFrame(frame(0));
  gate.release();
  await assert.rejects(restoring, { code: "RECORDER_ACTIVE" });
  assert.equal(host.getArtifact()!.artifactSha256, previous.artifactSha256);
  assert.equal(host.getView().recording.state, "recording");
  assert.equal((await host.stop()).status, "captured");
});
