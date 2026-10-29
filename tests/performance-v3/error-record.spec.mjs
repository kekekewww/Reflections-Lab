import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = path.resolve(process.env.ERROR_RECORD_TARGET ?? ".");
const legacy = process.env.ERROR_RECORD_LEGACY === "1";
const { serializeErrorRecord } = legacy
  ? { serializeErrorRecord: (error) => ({ message: error.message, stack: error.stack }) }
  : await import(pathToFileURL(path.join(target, "tests/browser/performance-error-record-v3.mjs")));
const serial = (value) => JSON.parse(JSON.stringify(value));

test("ordered nested AggregateError and cause survive a durable round trip; message/stack stay compatible", () => {
  const cause = new Error("checkpoint original cause");
  const raw = new Error("raw checkpoint failed", { cause });
  const finish = new Error("finish failed");
  const trace = new Error("trace failed", { cause: 0 });
  const first = new AggregateError([raw, finish], "UI checkpoint and cleanup failed");
  const error = new AggregateError([first, trace], "UI finish and trace recovery failed");
  const record = serial(serializeErrorRecord(error));
  assert.equal(record.message, error.message);
  assert.equal(record.stack, error.stack);
  assert.equal(record.errors[0].errors[0].message, raw.message);
  assert.equal(record.errors[0].errors[0].cause.message, cause.message);
  assert.equal(record.errors[0].errors[1].message, finish.message);
  assert.equal(record.errors[1].message, trace.message);
  assert.equal(record.errors[1].cause.value, 0);
  assert.equal(record.serialization.truncated, false);
  assert.equal(error.errors[0], first);
  assert.equal(first.errors[0], raw);
  assert.equal(first.errors[1], finish);
  assert.equal(error.errors[1], trace);
});

test("falsy thrown primitives are distinguishable and JSON safe", () => {
  for (const value of [undefined, null, false, 0, "", -0, NaN, 1n, Symbol("sentinel")]) {
    const record = serial(serializeErrorRecord(value));
    assert.equal(typeof record.message, "string");
    assert.equal(record.kind, value === null ? "null" : typeof value);
    if ([false, 0, ""].includes(value) && !Object.is(value, -0)) assert.equal(record.value, value);
    if (Object.is(value, -0)) assert.equal(record.value, "-0");
  }
});

test("hostile getters, revoked proxies and toString never escape or execute coercion", () => {
  let coerced = 0;
  const error = new Error("original remains");
  for (const key of ["name", "stack", "cause", "errors"]) {
    Object.defineProperty(error, key, {
      get() {
        throw new Error("hostile getter");
      },
    });
  }
  error.toString = () => {
    coerced++;
    throw new Error("coercion forbidden");
  };
  const record = serial(serializeErrorRecord(error));
  assert.equal(record.message, "original remains");
  assert.equal(record.serialization.truncated, true);
  assert.ok(record.serialization.events.unreadableProperty >= 1);
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.doesNotThrow(() => serial(serializeErrorRecord(proxy)));
  const hostile = new Proxy(
    {},
    {
      get() {
        throw Error("get");
      },
      getPrototypeOf() {
        throw Error("proto");
      },
    },
  );
  assert.doesNotThrow(() => serial(serializeErrorRecord(hostile)));
  assert.equal(coerced, 0);
});

test("cycles, depth, node, string and total UTF-8 byte limits have explicit diagnostics", () => {
  const cycle = new Error("cycle");
  cycle.cause = cycle;
  assert.ok(serializeErrorRecord(cycle).serialization.events.cycle >= 1);
  let deep = new Error("leaf");
  for (let index = 0; index < 20; index++) deep = new Error("branch", { cause: deep });
  assert.ok(serializeErrorRecord(deep, { maxDepth: 3 }).serialization.events.maxDepth >= 1);
  const wide = new AggregateError(
    Array.from({ length: 100 }, (_, i) => new Error(`child ${i}`)),
    "wide",
  );
  const nodes = serializeErrorRecord(wide, { maxNodes: 4 });
  assert.ok(nodes.serialization.events.maxNodes >= 1);
  assert.ok(nodes.serialization.nodes <= 4);
  const long = new Error("😀".repeat(20000));
  const strings = serializeErrorRecord(long, { maxStringChars: 80 });
  assert.ok(strings.serialization.events.maxStringChars >= 1);
  assert.ok(strings.message.length <= 80);
  const total = serializeErrorRecord(
    new AggregateError(
      Array.from({ length: 40 }, () => long),
      "total",
    ),
    { maxTotalBytes: 2048 },
  );
  assert.ok(Buffer.byteLength(JSON.stringify(total), "utf8") <= 2048);
  assert.ok(total.serialization.events.maxTotalBytes >= 1);
  assert.equal(total.serialization.limits.maxTotalBytes, 2048);
});

test("actual source-extracted runner preserves thrown identities and all durable causes across simultaneous failures", async () => {
  const source = await readFile(
    path.join(target, "tests/browser/performance-profile-v3.mjs"),
    "utf8",
  );
  const begin = source.indexOf("// BEGIN_TESTABLE_UI_WINDOW_FINALIZATION");
  const end = source.indexOf("// END_TESTABLE_UI_WINDOW_FINALIZATION", begin);
  assert.ok(begin >= 0 && end > begin);
  const catchBegin = source.indexOf('  } catch (error) {\n    report.status = "FAILED";', end);
  const catchEnd = source.indexOf("  } finally {", catchBegin);
  assert.ok(catchBegin > end && catchEnd > catchBegin, "use actual durable outer catch");
  const catchBody = source.slice(catchBegin + "  } catch (error) {".length, catchEnd);
  const handle = new Function("error", "report", "serializeErrorRecord", "process", catchBody);
  const run = new Function(
    "d",
    `return(async()=>{const {page,writeBoundedUIRaw,report,path,directory,UI_RAW_MAX_BYTES,checkpointThenCloseTrace,cdp,completion,traceObserver,formal,bufferUsage,saveOwnedTrace,FORMAL_TRACE_CAPS,SHORT_TRACE_CAPS,serializeErrorRecord}=d;let tracePhase,traceMeta;${source.slice(begin, end)}})()`,
  );
  for (const primary of [
    new Error("original raw checkpoint", { cause: new Error("checkpoint root cause") }),
    0,
    false,
    "",
    undefined,
    null,
  ]) {
    const finish = new Error("secondary finish");
    const trace = new Error("tertiary trace", { cause: new Error("trace root cause") });
    const report = {};
    let caught,
      didThrow = false;
    try {
      await run({
        page: {
          evaluate: async (fn) => {
            if (fn.toString().includes("getUIFinishTail"))
              return { status: "TAIL_INCOMPLETE_UNVERIFIED" };
            if (fn.toString().includes("finishUI")) throw finish;
            return { sampleMilliseconds: 600000, collectionWindow: { collectionId: "synthetic" } };
          },
        },
        writeBoundedUIRaw: async (file) => {
          if (file.endsWith("ui.raw.json")) throw primary;
          return { bytes: 1 };
        },
        report,
        path,
        directory: "synthetic",
        UI_RAW_MAX_BYTES: 268435456,
        checkpointThenCloseTrace: async ({ checkpoint, stop }) => {
          await checkpoint();
          await stop();
          return { traceMeta: {} };
        },
        cdp: {
          send: async () => {
            throw trace;
          },
        },
        completion: Promise.resolve(),
        traceObserver: { fault: new Promise(() => {}) },
        formal: false,
        bufferUsage: [],
        saveOwnedTrace: async () => {},
        FORMAL_TRACE_CAPS: { compressedBytes: 1 },
        SHORT_TRACE_CAPS: { compressedBytes: 1 },
        serializeErrorRecord,
      });
    } catch (error) {
      caught = error;
      didThrow = true;
      handle(error, report, serializeErrorRecord, { exitCode: 0 });
    }
    assert.equal(didThrow, true);
    assert.equal(caught.errors[0].errors[0], primary);
    assert.equal(caught.errors[0].errors[1], finish);
    assert.equal(caught.errors[1], trace);
    const durable = serial(report);
    assert.equal(durable.error.errors[0].errors[1].message, finish.message);
    assert.equal(durable.error.errors[1].cause.message, "trace root cause");
    assert.equal(durable.uiFinishFailure.primary.message, "UI checkpoint and cleanup failed");
    if (primary instanceof Error)
      assert.equal(durable.error.errors[0].errors[0].cause.message, "checkpoint root cause");
    else
      assert.equal(
        durable.error.errors[0].errors[0].kind,
        primary === null ? "null" : typeof primary,
      );
  }
});
