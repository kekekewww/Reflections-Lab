import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseTraceStream } from "../browser/performance-stream-v3.mjs";

async function run(text, caps = {}) {
  const dir = await mkdtemp(join(tmpdir(), "rlab-trace-"));
  try {
    const path = join(dir, "trace.gz");
    await writeFile(path, gzipSync(text));
    const events = [];
    const stats = await parseTraceStream(path, (event) => events.push(event), { caps });
    return { events, stats };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("matches JSON.parse with escaped delimiters, nested metadata, primitives and UTF-8", async () => {
  const source = JSON.stringify({
    metadata: { nested: ["中文", { x: ']}\\"' }] },
    traceEvents: [null, 4, 'a]"', { name: "聲音", args: { list: [1, 2] } }],
    tail: true,
  });
  const { events, stats } = await run(source);
  assert.deepEqual(events, JSON.parse(source).traceEvents);
  assert.equal(stats.events, 4);
  assert.equal(stats.decodedBytes, Buffer.byteLength(source));
  assert.match(stats.compressedSha256, /^[a-f0-9]{64}$/);
});
test("handles decoder and framing boundaries", async () => {
  const source = JSON.stringify({
    traceEvents: [{ name: "x".repeat(65530) + '聲\\"}]' }, { name: "ok" }],
  });
  assert.deepEqual((await run(source)).events, JSON.parse(source).traceEvents);
});
test("rejects malformed entire document and duplicate traceEvents", async () => {
  for (const source of [
    '{"traceEvents":[1,]}',
    '{"traceEvents":[1]',
    '{"traceEvents":[]}x',
    '{"traceEvents":[],"traceEvents":[]}',
    '{"traceEvents":[],}',
    '{"traceEvents":[],"other":{"x":}}',
    '{"x":1}',
    '{"traceEvents":{}}',
  ]) {
    await assert.rejects(run(source), undefined, source);
  }
  await assert.rejects(run(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])));
});
test("resource caps fail closed and clean up", async () => {
  await assert.rejects(run('{"traceEvents":[1,2]}', { events: 1 }), /EVENT_CAP/);
  await assert.rejects(run('{"traceEvents":["abcdef"]}', { tokenBytes: 3 }), /TOKEN_CAP/);
  await assert.rejects(run('{"traceEvents":[[[1]]]}', { nesting: 1 }), /NESTING_CAP/);
  await assert.rejects(run('{"traceEvents":[]}', { decodedBytes: 2 }), /DECODED_CAP/);
  await assert.rejects(run('{"traceEvents":[]}', { compressedBytes: 2 }), /COMPRESSED_CAP/);
  await assert.rejects(run('{"traceEvents":[]}', { events: 0 }), /CAP_CONTRACT/);
});
test("rejects nested malformed values, trailing values, callback errors and promises", async () => {
  for (const source of [
    '{"traceEvents":[[true,false,null,]]}',
    '{"traceEvents":[] true}',
    '{"traceEvents":[1 2]}',
  ])
    await assert.rejects(run(source));
  const dir = await mkdtemp(join(tmpdir(), "rlab-callback-"));
  try {
    const path = join(dir, "trace.gz");
    await writeFile(path, gzipSync('{"traceEvents":[1,2]}'));
    await assert.rejects(
      parseTraceStream(path, () => {
        throw Error("CALLBACK_FAILURE");
      }),
      /CALLBACK_FAILURE/,
    );
    await assert.rejects(
      parseTraceStream(path, async () => {}),
      /ASYNC_CALLBACK_UNSUPPORTED/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("reproducible 1 MiB and 10 MiB parity smoke", async (t) => {
  for (const target of [1024 * 1024, 10 * 1024 * 1024]) {
    const row = {
      name: "RunTask",
      pid: 1,
      tid: 2,
      ph: "X",
      ts: 12345,
      dur: 42,
      args: { text: "聲".repeat(20) },
    };
    const count = Math.ceil(target / Buffer.byteLength(JSON.stringify(row)));
    const source = JSON.stringify({
      traceEvents: Array.from({ length: count }, () => row),
      metadata: { test: true },
    });
    const { events, stats } = await run(source);
    assert.deepEqual(events, JSON.parse(source).traceEvents);
    t.diagnostic(
      `${stats.decodedBytes} bytes, ${stats.events} events, ${stats.elapsedMs} ms, max token ${stats.maxTokenBytes} bytes`,
    );
  }
});
