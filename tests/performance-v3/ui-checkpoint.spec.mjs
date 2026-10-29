import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  writeBoundedUIRaw,
  checkpointThenCloseTrace,
} from "../browser/performance-owned-cleanup-v3.mjs";
async function temp(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "raw-checkpoint-"));
  try {
    return await fn(path.join(dir, "raw.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("bounded raw checkpoint matches JSON and its hash", () =>
  temp(async (f) => {
    const value = { a: [1, null, "測試"], b: { c: true } };
    const out = await writeBoundedUIRaw(f, value);
    const bytes = await readFile(f);
    assert.deepEqual(JSON.parse(bytes), value);
    assert.equal(out.bytes, bytes.length);
    assert.equal(out.sha256, createHash("sha256").update(bytes).digest("hex"));
  }));
test("checkpoint rejects raw cap", () =>
  temp(async (f) => assert.rejects(writeBoundedUIRaw(f, { v: "123456789" }, 5), /UI_RAW_CAP/)));
test("checkpoint completes before stop and success", async () => {
  const order = [];
  const r = await checkpointThenCloseTrace({
    checkpoint: async () => {
      order.push("checkpoint");
      return 3;
    },
    stop: async () => {
      order.push("stop");
    },
    completion: Promise.resolve("done"),
    timeoutMs: 100,
  });
  assert.deepEqual(order, ["checkpoint", "stop"]);
  assert.deepEqual(r, { checkpoint: 3, traceMeta: "done" });
});
test("checkpoint and stop errors preserved and stop attempted", async () => {
  const a = Error("checkpoint"),
    b = Error("stop");
  await assert.rejects(
    checkpointThenCloseTrace({
      checkpoint: async () => {
        throw a;
      },
      stop: async () => {
        throw b;
      },
      completion: Promise.reject(Error("completion")),
      timeoutMs: 100,
    }),
    (e) => e.errors?.includes(a) && e.errors?.includes(b),
  );
});
test("stop failure preserves checkpoint and observes late completion rejection", async () => {
  let reject;
  const pending = new Promise((_, r) => {
    reject = r;
  });
  await assert.rejects(
    checkpointThenCloseTrace({
      checkpoint: async () => 1,
      stop: async () => {
        throw Error("stop");
      },
      completion: pending,
      timeoutMs: 100,
    }),
    /stop/,
  );
  reject(Error("late"));
  await new Promise((r) => setImmediate(r));
});
test("timeout rejects even if completion remains pending and late rejection is observed", async () => {
  let reject;
  const pending = new Promise((_, r) => {
    reject = r;
  });
  await assert.rejects(
    checkpointThenCloseTrace({
      checkpoint: async () => 1,
      stop: async () => {},
      completion: pending,
      timeoutMs: 1,
    }),
    /CDP_TRACE_FLUSH_TIMEOUT/,
  );
  reject(Error("late"));
  await new Promise((r) => setImmediate(r));
});
test("completion failure remains primary after successful checkpoint and stop", async () => {
  await assert.rejects(
    checkpointThenCloseTrace({
      checkpoint: async () => 1,
      stop: async () => {},
      completion: Promise.reject(Error("completion")),
      timeoutMs: 100,
    }),
    /completion/,
  );
});
