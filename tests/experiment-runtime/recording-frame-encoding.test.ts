import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { canonicalStringify, immutableClone } from "../../src/experiments/hash.js";
import { ExperimentRecorder } from "../../src/experiments/recorder.js";
import {
  RecordingPersistenceSession,
  type EncodedRecordingFrame,
  type RecordingCapturePersistence,
  type RecordingPersistenceBudget,
} from "../../src/experiments/recording-persistence.js";
import type { RecordingFrameInput } from "../../src/experiments/types.js";
import { frame, options } from "./worker-fixture.js";
import { RecordingHost } from "../../src/app/recording-host.js";
import { BlobStore } from "../../src/persistence/blob-store.js";

const encode = (value: unknown) => new TextEncoder().encode(canonicalStringify(value));
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// Execute the preserved helper, rather than deriving the golden with the new
// encoder/cache. The old clone + separate canonical encode path is independent.
const oldHashSource = readFileSync(
  new URL("../../artifacts/v1/capture-cost-baseline-20261027/hash.ts", import.meta.url),
);
assert.equal(
  sha256(oldHashSource),
  "0676be2ea96571b604f926b803b5e574b09ee73bda799c6779d0e1d07054be42",
);
const oldHashCode = transpileModule(
  oldHashSource
    .toString("utf8")
    .replace(
      'from "./types.js"',
      `from ${JSON.stringify(new URL("../../src/experiments/types.ts", import.meta.url).href)}`,
    ),
  { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } },
).outputText;
const oldHelpers = (await import(
  `data:text/javascript;base64,${Buffer.from(oldHashCode).toString("base64")}`
)) as {
  canonicalStringify(value: unknown): string;
  immutableClone<T>(value: T): T;
};
const oldEncode = (value: unknown) => Buffer.from(oldHelpers.canonicalStringify(value), "utf8");

async function capacityFrame(session: RecordingCapturePersistence, input: RecordingFrameInput) {
  let captured = input;
  assert.equal(
    await session.waitForCapacity(input, (owned) => {
      captured = owned;
    }),
    undefined,
  );
  return captured;
}

function fixture(limits: Partial<RecordingPersistenceBudget> = {}) {
  const recorder = new ExperimentRecorder(options());
  const chunks: EncodedRecordingFrame[] = [];
  const session = new RecordingPersistenceSession(
    "session.encoding",
    recorder.captureSealSnapshot(),
    {
      create: async () => {},
      append: async (_id, frames) => {
        chunks.push(...frames);
      },
      interrupt: async () => {},
      publish: async () => {
        throw new Error("not used");
      },
    },
    {},
    limits,
  );
  return { recorder, session, chunks };
}

test("capacity, recorder ownership and enqueue encode the final frame only once", async (t) => {
  const { recorder, session, chunks } = fixture();
  const input = frame(0);
  const originalEncode = TextEncoder.prototype.encode;
  let encodes = 0;
  t.mock.method(TextEncoder.prototype, "encode", function (this: TextEncoder, value) {
    encodes++;
    return originalEncode.call(this, value);
  });
  const owned = await capacityFrame(session, input);
  recorder.appendFrame(owned);
  session.enqueue(recorder.getLastFrame()!);
  await session.drain();
  assert.equal(encodes, 1);
  assert.equal(chunks.length, 1);
  assert.equal(session.getLastEnqueuedFrameBytes(), chunks[0]!.bytes.byteLength);
});

test("recorded sequence matches the old clone/size/enqueue path, including chunk and artifact SHA-256", async () => {
  const { recorder, session, chunks } = fixture();
  const reference = new ExperimentRecorder(options());
  const expectedChunks: Uint8Array[] = [];
  for (let tick = 0; tick < 4; tick++) {
    const input = frame(tick);
    input.behaviorDecisions = [
      { tick, text: '聲音🧪\n"\\\ud800', ordered: { z: -0, a: [null, true] } },
    ];
    // Original capacity normalization, recorder clone, and enqueue encode. The
    // golden is computed from independent inputs through the pre-change helpers.
    const normalized = {
      ...input,
      runEpoch: input.runEpoch ?? options().runEpoch ?? options().runId,
      acousticFrames: input.acousticFrames ?? [],
      acousticResultRefs: input.acousticResultRefs ?? [],
    };
    const capacityBytes = oldEncode(normalized);
    const oldOwned = oldHelpers.immutableClone(normalized);
    const oldBytes = oldEncode(oldOwned);
    assert.deepEqual(oldBytes, capacityBytes);
    expectedChunks.push(new Uint8Array(oldBytes));
    reference.appendFrame(oldOwned);

    const admitted = await capacityFrame(session, input);
    recorder.appendFrame(admitted);
    session.enqueue(recorder.getLastFrame()!);
    assert.equal(Reflect.set(input.poses[0]!.positionM, "0", 123), true);
    assert.equal(Reflect.set(recorder.getLastFrame()!.poses[0]!.positionM, "0", 456), false);
  }
  await session.drain();
  assert.deepEqual(
    chunks.map((chunk) => new Uint8Array(chunk.bytes)),
    expectedChunks,
  );
  assert.deepEqual(
    chunks.map((chunk) => sha256(new Uint8Array(chunk.bytes))),
    expectedChunks.map(sha256),
  );
  const expected = await reference.finish();
  const actual = await recorder.finish();
  assert.deepEqual(encode(actual), new Uint8Array(oldEncode(expected)));
  const { artifactSha256: _hash, ...expectedBody } = expected;
  assert.equal(actual.artifactSha256, sha256(oldEncode(expectedBody)));
  assert.equal(sha256(encode(actual)), sha256(oldEncode(expected)));
  assert.equal(actual.traceBytes, encode(actual.frames).byteLength);
});

test("BlobStore chunk descriptors and published artifact match the old helper path golden", async () => {
  const store = new BlobStore({ indexedDB: null });
  try {
    const recorder = new ExperimentRecorder(options());
    const reference = new ExperimentRecorder(options());
    const session = store.createRecordingPersistence(recorder);
    const expectedChunks: Uint8Array[] = [];
    for (let tick = 0; tick < 3; tick++) {
      const input = frame(tick);
      const oldFrame = oldHelpers.immutableClone({
        ...input,
        runEpoch: options().runEpoch!,
        acousticFrames: input.acousticFrames ?? [],
        acousticResultRefs: input.acousticResultRefs ?? [],
      });
      expectedChunks.push(new Uint8Array(oldEncode(oldFrame)));
      reference.appendFrame(oldFrame);
      recorder.appendFrame(await capacityFrame(session, input));
      session.enqueue(recorder.getLastFrame()!);
      input.poses[0]!.positionM[0] = 999;
    }
    await session.drain();
    const storage = store as unknown as {
      chunks: Map<string, EncodedRecordingFrame & { sha256: string; byteLength: number }>;
    };
    const chunks = [...storage.chunks.values()].sort((a, b) => a.sequence - b.sequence);
    assert.equal(chunks.length, expectedChunks.length);
    for (const [index, chunk] of chunks.entries()) {
      assert.deepEqual(new Uint8Array(chunk.bytes), expectedChunks[index]);
      assert.equal(chunk.sha256, sha256(expectedChunks[index]!));
      assert.equal(chunk.byteLength, expectedChunks[index]!.byteLength);
    }
    const expected = await reference.finish();
    const actual = await recorder.finish();
    const receipt = await session.publish(actual);
    const { artifactSha256: _hash, ...expectedBody } = expected;
    assert.equal(receipt.sha256, sha256(oldEncode(expectedBody)));
    assert.equal(receipt.encodedSha256, sha256(oldEncode(expected)));
    assert.equal(receipt.byteLength, oldEncode(expected).byteLength);
    assert.deepEqual(await store.loadRecording(receipt.runId, receipt.sha256), expected);
  } finally {
    store.close();
  }
});

test("oversize capacity rejection precedes recorder acceptance and JSON errors retain priority", async () => {
  const { recorder, session } = fixture({ maxBytes: 32 });
  await assert.rejects(session.waitForCapacity(frame(0)), {
    code: "RECORDING_STORAGE_BACKPRESSURE",
  });
  assert.equal(recorder.getTelemetry().frameCount, 0);
  assert.equal(session.getTelemetry().acceptedFrames, 0);
  const invalid = frame(0);
  invalid.behaviorDecisions = [Infinity];
  await assert.rejects(session.waitForCapacity(invalid), { code: "NONFINITE" });
  assert.equal(session.getTelemetry().acceptedFrames, 0);
  await session.cancel("TEST_END");
});

test("prepared frozen frames skip cloning while caller-frozen and mutable inputs produce identical bytes", async (t) => {
  const input = frame(0);
  const prepared = fixture();
  const owned = await capacityFrame(prepared.session, input);
  assert.ok(owned);
  const parse = JSON.parse;
  let parses = 0;
  t.mock.method(JSON, "parse", (text, reviver) => {
    parses++;
    return parse(text, reviver);
  });
  prepared.recorder.appendFrame(owned);
  assert.equal(parses, 0, "only this module's frozen clone may skip the ownership walk");
  assert.equal(prepared.recorder.getLastFrame(), owned);
  prepared.session.enqueue(prepared.recorder.getLastFrame()!);
  const expected = encode(owned);
  for (const value of [input, immutableClone(input), Object.freeze(structuredClone(input))]) {
    const normal = fixture();
    const before = parses;
    normal.recorder.appendFrame(value);
    assert.equal(parses, before + 1, "arbitrary frozen roots do not certify ownership");
    normal.session.enqueue(normal.recorder.getLastFrame()!);
    await normal.session.drain();
    assert.deepEqual(new Uint8Array(normal.chunks[0]!.bytes), expected);
  }
  await prepared.session.drain();
});

test("a changed frame cannot reuse capacity bytes and enqueue still enforces its exact byte cap", async () => {
  const probe = fixture();
  probe.recorder.appendFrame(frame(0));
  const limit = encode(probe.recorder.getLastFrame()!).byteLength;
  await probe.session.cancel("TEST_END");
  const { recorder, session } = fixture({ maxBytes: limit });
  await session.waitForCapacity(frame(0));
  const changed = frame(0);
  changed.behaviorDecisions = [{ tick: 0, text: "changed after capacity check" }];
  recorder.appendFrame(changed);
  assert.throws(() => session.enqueue(recorder.getLastFrame()!), {
    code: "RECORDING_STORAGE_BACKPRESSURE",
  });
  assert.equal(session.getTelemetry().acceptedFrames, 0);
  await assert.rejects(session.drain(), { code: "RECORDING_STORAGE_BACKPRESSURE" });
});

test("encoded buffers transfer once; a second storage owner cannot see the first backend's mutation", async () => {
  const first = fixture();
  const second = fixture();
  first.recorder.appendFrame(frame(0));
  const owned = first.recorder.getLastFrame()!;
  const expected = encode(owned);
  first.session.enqueue(owned);
  await first.session.drain();
  new Uint8Array(first.chunks[0]!.bytes).fill(0);
  second.session.enqueue(owned);
  await second.session.drain();
  assert.deepEqual(new Uint8Array(second.chunks[0]!.bytes), expected);
});

test("the host reuses capacity ownership and input mutation after admission cannot change stored chunks", async (t) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chunks: EncodedRecordingFrame[] = [];
  const finalEncodes: string[] = [];
  const host = new RecordingHost({
    getConfig: options,
    evaluateCapture: async () => {
      await gate;
      return [];
    },
    createPersistence: (recorder, callbacks) =>
      new RecordingPersistenceSession(
        "session.host-encoding",
        recorder.captureSealSnapshot(),
        {
          create: async () => {},
          append: async (_id, frames) => {
            chunks.push(...frames);
          },
          interrupt: async () => {},
          publish: async () => {
            throw new Error("not used");
          },
        },
        callbacks,
      ),
  });
  try {
    host.start();
    const originalEncode = TextEncoder.prototype.encode;
    t.mock.method(TextEncoder.prototype, "encode", function (this: TextEncoder, text) {
      if (text?.startsWith('{"acousticFrames":')) finalEncodes.push(text);
      return originalEncode.call(this, text);
    });
    const input = frame(0);
    const expected = immutableClone({
      ...input,
      runEpoch: options().runEpoch!,
      acousticFrames: [],
      acousticResultRefs: [],
    });
    host.appendEvaluationFrame(input, []);
    input.poses[0]!.positionM[0] = 999;
    release();
    await host.flushEvaluation();
    assert.equal(finalEncodes.length, 1);
    assert.equal(chunks.length, 1);
    assert.equal(new TextDecoder().decode(chunks[0]!.bytes), canonicalStringify(expected));
  } finally {
    release();
    host.dispose();
  }
});
