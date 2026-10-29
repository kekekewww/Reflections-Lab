import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeBoundedUIRaw } from "../browser/performance-owned-cleanup-v3.mjs";
test("open failure rejects cleanly and settles file stream", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "raw-open-"));
  try {
    await assert.rejects(writeBoundedUIRaw(dir, { a: 1 }), (e) =>
      ["EISDIR", "EPERM", "EEXIST"].includes(e.code),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("write failure is observed and stream closes before rejection", async () => {
  let stream;
  const failure = Error("write failure");
  await assert.rejects(
    writeBoundedUIRaw("unused", { a: 1 }, 100, {
      createWriteStream: () =>
        (stream = new Writable({
          write(_chunk, _encoding, cb) {
            setImmediate(() => cb(failure));
          },
        })),
    }),
    (e) => e === failure,
  );
  assert.equal(stream.closed, true);
});
test("cap failure waits for delayed destroy error and close without losing primary", async () => {
  let stream;
  const late = Error("late destroy error");
  await assert.rejects(
    writeBoundedUIRaw("unused", { a: "long" }, 2, {
      createWriteStream: () =>
        (stream = new Writable({
          write(_chunk, _encoding, cb) {
            cb();
          },
          destroy(_error, cb) {
            setImmediate(() => cb(late));
          },
        })),
    }),
    /UI_RAW_CAP/,
  );
  assert.equal(stream.closed, true);
  await new Promise((resolve) => setImmediate(resolve));
});
