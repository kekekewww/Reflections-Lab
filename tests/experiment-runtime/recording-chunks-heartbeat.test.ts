import assert from "node:assert/strict";
import test from "node:test";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import { RecordingPersistenceSession } from "../../src/experiments/recording-persistence.js";
import { options, frame } from "./worker-fixture.js";

test("owner heartbeats are single-flight and a late heartbeat cannot mark a published take failed", async (t) => {
  let poll!: () => void;
  const timer = setTimeout(() => {}, 2147483647);
  timer.unref();
  t.after(() => clearTimeout(timer));
  t.mock.method(globalThis, "setInterval", (callback: () => void) => {
    poll = callback;
    return timer;
  });
  let heartbeatCalls = 0;
  let heartbeatReject!: (error: Error) => void;
  const heartbeat = new Promise<void>((_resolve, reject) => {
    heartbeatReject = reject;
  });
  let failures = 0;
  const recorder = new ExperimentRecorder(options());
  const session = new RecordingPersistenceSession(
    "recording.test",
    recorder.captureSealSnapshot(),
    {
      create: async () => {},
      append: async () => {},
      heartbeat: () => {
        heartbeatCalls++;
        return heartbeat;
      },
      interrupt: async () => {},
      publish: async (_id, artifact) => ({
        runId: artifact.runId,
        sha256: artifact.artifactSha256,
        hashKind: "canonicalRecordingArtifactSha256",
        encodedHashKind: "utf8JsonBytesSha256",
        encodedSha256: "a".repeat(64),
        byteLength: 1,
      }),
    },
    {
      onFailure: () => {
        failures++;
      },
    },
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  for (let count = 0; count < 5; count++) poll();
  assert.equal(heartbeatCalls, 1);
  recorder.appendFrame(frame(0));
  session.enqueue(recorder.getLastFrame()!);
  await session.publish(await recorder.finish());
  heartbeatReject(new Error("session was removed by completed publication"));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(failures, 0);
  assert.equal(session.getTelemetry().state, "published");
  assert.equal(session.getTelemetry().error, null);
});
