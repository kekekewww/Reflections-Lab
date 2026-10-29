import test from "node:test";
import assert from "node:assert/strict";
import { RecordingWorkerClient } from "../../src/experiments/recording-worker-client.js";
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: any[] = [];
  terminated = 0;
  postMessage(message: unknown) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated++;
  }
  reply(data: unknown) {
    this.onmessage?.({ data });
  }
}
test("single job and mismatched response cannot release pending job", async () => {
  const worker = new FakeWorker();
  const client = new RecordingWorkerClient(() => worker, 1000);
  const job = client.run({ runId: "run.test" } as any);
  await assert.rejects(client.run({ runId: "run.test" } as any), /BUSY/);
  worker.reply({ id: "wrong", ok: true });
  await assert.rejects(job, /PROTOCOL/);
  assert.equal(worker.terminated, 1);
});
test("timeout terminates job and disposal rejects pending work", async () => {
  const worker = new FakeWorker();
  const client = new RecordingWorkerClient(() => worker, 20);
  await assert.rejects(client.run({ runId: "run.test" } as any), /TIMEOUT/);
  assert.equal(worker.terminated, 1);
  const next = new FakeWorker();
  const second = new RecordingWorkerClient(() => next, 1000);
  const pending = second.run({ runId: "run.test" } as any);
  second.dispose();
  await assert.rejects(pending, /DISPOSED/);
  assert.equal(next.terminated, 1);
});
test("malformed or oversized reply never returns an artifact", async () => {
  const worker = new FakeWorker();
  const client = new RecordingWorkerClient(() => worker, 1000);
  const job = client.run({ runId: "run.test" } as any);
  const id = worker.sent[0].id;
  worker.reply({ id, ok: true, bytes: new ArrayBuffer(71 * 1024 * 1024), artifact: {} });
  await assert.rejects(job, /PROTOCOL|BUDGET/);
  assert.equal(worker.terminated, 1);
});
test("valid response checks digest and provides independent frozen artifact", async () => {
  const worker = new FakeWorker();
  const client = new RecordingWorkerClient(() => worker, 1000);
  const job = client.run({ runId: "run.test" } as any);
  const id = worker.sent[0].id;
  const artifact = { runId: "run.test", artifactSha256: "a".repeat(64), frames: [{ tick: 1 }] };
  const bytes = new TextEncoder().encode(JSON.stringify(artifact)).buffer;
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  worker.reply({
    id,
    ok: true,
    bytes,
    encodedSha256: digest,
    artifactSha256: artifact.artifactSha256,
  });
  const result = (await job) as any;
  assert.deepEqual(result.artifact, artifact);
  assert.ok(Object.isFrozen(result.artifact.frames[0]));
  assert.equal(worker.terminated, 1);
});
test("wrong encoded digest cannot produce a result", async () => {
  const worker = new FakeWorker();
  const client = new RecordingWorkerClient(() => worker, 1000);
  const job = client.run({ runId: "run.test" } as any);
  const id = worker.sent[0].id;
  worker.reply({
    id,
    ok: true,
    bytes: new TextEncoder().encode("{}").buffer,
    encodedSha256: "a".repeat(64),
    artifactSha256: "a".repeat(64),
  });
  await assert.rejects(job, /DIGEST/);
});
test("bounded worker failure preserves code and message", async () => {
  const worker = new FakeWorker();
  const client = new RecordingWorkerClient(() => worker, 1000);
  const job = client.run({ runId: "run.test" } as any);
  worker.reply({
    id: worker.sent[0].id,
    ok: false,
    error: { name: "RecordingError", code: "RECORDING_COUNTER", message: "invalid counter" },
  });
  await assert.rejects(
    job,
    (e: any) =>
      e.name === "RecordingError" &&
      e.code === "RECORDING_COUNTER" &&
      e.message === "invalid counter",
  );
});
