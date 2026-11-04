import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { solveAcoustics } from "../../src/acoustics/index.js";
import { LabRuntime } from "../../src/app/runtime.js";
import { AudioEngine } from "../../src/audio/engine.js";
import { FakeAudioContext } from "../audio-runtime/fake-context.js";
import {
  RecordingEvaluationClient,
  type RecordingEvaluationWorkerPort,
} from "../../src/app/recording-evaluation-client.js";
import type { RecordingHost } from "../../src/app/recording-host.js";
import type { AssetHost } from "../../src/app/asset-host.js";
import type { AcousticRequest } from "../../src/acoustics/types.js";
import {
  RECORDING_EVALUATION_MAX_BYTES,
  RECORDING_EVALUATION_MAX_REQUESTS,
} from "../../src/app/recording-evaluation-limits.js";

interface Message {
  id: number;
  kind?: string;
  generation?: number;
  protocolVersion?: number;
  input?: { requests: AcousticRequest[] };
}
class Port implements RecordingEvaluationWorkerPort {
  onmessage: RecordingEvaluationWorkerPort["onmessage"] = null;
  onerror: RecordingEvaluationWorkerPort["onerror"] = null;
  onmessageerror: RecordingEvaluationWorkerPort["onmessageerror"] = null;
  messages: Message[] = [];
  terminated = 0;
  postMessage(value: unknown) {
    this.messages.push(value as Message);
  }
  terminate() {
    this.terminated++;
  }
  ack(message = this.messages.find((m) => m.kind === "prepare")!) {
    this.onmessage?.({
      data: {
        kind: "prepared",
        ok: true,
        id: message.id,
        generation: message.generation,
        protocolVersion: 1,
      },
    });
  }
  solve() {
    const message = this.messages
      .slice()
      .reverse()
      .find((m) => m.input)!;
    this.onmessage?.({
      data: {
        id: message.id,
        ok: true,
        output: message.input!.requests.map((r) => solveAcoustics(r).frame),
      },
    });
  }
}
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(check(), true, "bounded preparation condition must become observable");
}
function assertPrepare(client: RecordingEvaluationClient) {
  assert.equal(typeof client.prepare, "function");
}

test("preparation is a distinct ACK and duplicate owner calls share one bounded promise", async () => {
  const port = new Port();
  const client = new RecordingEvaluationClient({ workerFactory: () => port });
  try {
    assertPrepare(client);
    const first = client.prepare(),
      same = client.prepare();
    assert.equal(first, same);
    assert.equal(port.messages.length, 1);
    assert.equal(port.messages[0]!.kind, "prepare");
    assert.equal(port.messages[0]!.input, undefined, "no synthetic solver job");
    assert.equal(client.getReadinessDiagnostics().firstWorkerProtocolReplyAtWallMs, null);
    port.ack();
    await first;
    assert.equal(client.getReadinessDiagnostics().workerPrepared, true);
    assert.equal(
      client.getReadinessDiagnostics().firstWorkerProtocolReplyAtWallMs,
      null,
      "ACK is not an evaluation reply",
    );
    const count = port.messages.length;
    await client.prepare();
    assert.equal(port.messages.length, count, "ready worker is reused");
    const capture = client.capture([]);
    port.solve();
    await capture;
    assert.notEqual(client.getReadinessDiagnostics().firstWorkerProtocolReplyAtWallMs, null);
  } finally {
    client.dispose();
  }
});

test("pre-aborted, timed out and failed preparations clean up and preserve worker ownership", async () => {
  const pre = new AbortController();
  pre.abort();
  let creates = 0;
  const preClient = new RecordingEvaluationClient({
    workerFactory: () => {
      creates++;
      return new Port();
    },
  });
  try {
    assertPrepare(preClient);
    await assert.rejects(preClient.prepare(pre.signal), { code: "EVALUATION_PREPARE_CANCELLED" });
    assert.equal(creates, 0);
  } finally {
    preClient.dispose();
  }
  const port = new Port(),
    client = new RecordingEvaluationClient({ workerFactory: () => port, timeoutMs: 5 });
  try {
    assertPrepare(client);
    await assert.rejects(client.prepare(), { code: "EVALUATION_PREPARE_TIMEOUT" });
    assert.equal(port.terminated, 1);
    assert.equal(port.onmessage, null);
    assert.equal(client.getReadinessDiagnostics().workerPrepared, false);
  } finally {
    client.dispose();
  }
});

test("cancel and stale ACK cannot prepare a replacement generation", async () => {
  const first = new Port(),
    second = new Port();
  let creates = 0;
  const client = new RecordingEvaluationClient({
    workerFactory: () => (creates++ === 0 ? first : second),
  });
  try {
    assertPrepare(client);
    const signal = new AbortController();
    const old = client.prepare(signal.signal);
    const oldHandler = first.onmessage!,
      oldMessage = first.messages[0]!;
    signal.abort();
    await assert.rejects(old, { code: "EVALUATION_PREPARE_CANCELLED" });
    const current = client.prepare();
    oldHandler({
      data: {
        kind: "prepared",
        ok: true,
        id: oldMessage.id,
        generation: oldMessage.generation,
        protocolVersion: 1,
      },
    });
    assert.equal(client.getReadinessDiagnostics().workerPrepared, false);
    second.ack();
    await current;
    assert.equal(client.getReadinessDiagnostics().workerPrepared, true);
    assert.equal(first.terminated, 1);
    assert.equal(client.getReadinessDiagnostics().workerCreateCount, 2);
  } finally {
    client.dispose();
  }
});

test("a current malformed ACK rejects rather than claiming readiness", async () => {
  const port = new Port(),
    client = new RecordingEvaluationClient({ workerFactory: () => port });
  try {
    assertPrepare(client);
    const pending = client.prepare();
    const sent = port.messages[0]!;
    port.onmessage?.({
      data: {
        kind: "prepared",
        ok: true,
        id: sent.id,
        generation: sent.generation,
        protocolVersion: 2,
      },
    });
    await assert.rejects(pending, { code: "EVALUATION_PREPARE_PROTOCOL" });
    assert.equal(port.terminated, 1);
  } finally {
    client.dispose();
  }
});

test("worker-unavailable reference policy prepares without changing direct fallback execution", async () => {
  assert.equal(
    typeof globalThis.Worker,
    "undefined",
    "the Node fixture really has no native Worker",
  );
  const client = new RecordingEvaluationClient({ useWorker: true, yieldTask: async () => {} });
  try {
    assertPrepare(client);
    await client.prepare();
    assert.equal(client.mode, "yieldingReference");
    assert.equal(client.getReadinessDiagnostics().workerCreateCount, 0);
    assert.deepEqual(await client.capture([]), []);
  } finally {
    client.dispose();
  }
});

interface Access {
  recordingEvaluation: RecordingEvaluationClient;
  recorder: RecordingHost;
  world: { paused: boolean; tick: number };
  busy: boolean;
}
async function runtimeFixture(timeoutMs = 10000) {
  const runtime = await LabRuntime.create({ useWorker: false });
  const access = runtime as unknown as Access;
  access.recordingEvaluation.dispose();
  const port = new Port();
  const client = new RecordingEvaluationClient({ workerFactory: () => port, timeoutMs });
  access.recordingEvaluation = client;
  return { runtime, access, port, client };
}

test("cold readiness delayed past eight fixed ticks admits no recording until ACK", async () => {
  const { runtime, access, port, client } = await runtimeFixture();
  let starting: Promise<void> | null = null;
  try {
    assertPrepare(client);
    starting = runtime.dispatch({ type: "recordToggle" });
    await until(() => port.messages.some((m) => m.kind === "prepare"));
    assert.equal(runtime.getSnapshot().notice, "正在準備錄製…");
    const tick = access.world.tick;
    for (let i = 0; i < 12; i++) runtime.advance(1 / 60);
    assert.equal(access.world.tick, tick);
    assert.equal(access.world.paused, true);
    assert.equal(access.recorder.getView().recording.state, "idle");
    const preparing = access.recorder.getEvaluationTelemetry();
    assert.ok(preparing, "the zero-frame candidate owns a real evaluation lane");
    assert.equal(preparing.acceptedFrames, 0);
    assert.equal(preparing.committedFrames, 0);
    assert.equal(preparing.pendingFrames, 0);
    assert.equal(access.recorder.getPersistenceQueueTelemetry()!.acceptedFrames, 0);
    assert.equal(access.recorder.getView().pending, true);
    assert.equal(port.messages.length, 1, "preparation did not submit solver frames");
    port.ack();
    await starting;
    assert.equal(access.world.paused, false);
    assert.notEqual(runtime.getSnapshot().notice, "正在準備錄製…");
    assert.equal(access.recorder.getView().recording.state, "recording");
    runtime.advance(1 / 60);
    port.solve();
    await runtime.flushRecordingEvaluation();
    assert.equal(access.world.tick, tick + 1);
    assert.equal(access.recorder.getEvaluationTelemetry()!.acceptedFrames, 1);
    assert.equal(access.recorder.getEvaluationTelemetry()!.committedFrames, 1);
    await runtime.dispatch({ type: "recordToggle" });
  } finally {
    runtime.dispose();
    await starting;
  }
});

for (const action of ["pause", "reset", "dispose"] as const)
  test(`${action} cancels preparation and a late ACK never resumes the runtime`, async () => {
    const { runtime, access, port, client } = await runtimeFixture();
    let starting: Promise<void> | null = null;
    try {
      assertPrepare(client);
      starting = runtime.dispatch({ type: "recordToggle" });
      await until(() => port.messages.some((m) => m.kind === "prepare"));
      const handler = port.onmessage!,
        message = port.messages[0]!;
      const previousRunId = runtime.getSnapshot().runId;
      if (action === "dispose") runtime.dispose();
      else await runtime.dispatch({ type: action });
      await starting;
      if (action === "reset")
        assert.notEqual(
          runtime.getSnapshot().runId,
          previousRunId,
          "Reset must actually complete after cancelling preparation",
        );
      handler({
        data: {
          kind: "prepared",
          ok: true,
          id: message.id,
          generation: message.generation,
          protocolVersion: 1,
        },
      });
      assert.equal(access.world.paused, true);
      assert.equal(access.recorder.getView().recording.state, "idle");
      assert.equal(port.terminated, 1);
      assert.equal(client.getReadinessDiagnostics().workerPrepared, false);
    } finally {
      runtime.dispose();
      await starting;
    }
  });

test("double-click recording does not create a second preparation or accept early frames", async () => {
  const { runtime, access, port, client } = await runtimeFixture();
  let starting: Promise<void> | null = null;
  try {
    assertPrepare(client);
    starting = runtime.dispatch({ type: "recordToggle" });
    await until(() => port.messages.some((m) => m.kind === "prepare"));
    await runtime.dispatch({ type: "recordToggle" });
    assert.equal(port.messages.length, 1);
    assert.equal(access.recorder.getView().recording.state, "idle");
    port.ack();
    await starting;
    assert.equal(access.recorder.getView().recording.state, "recording");
  } finally {
    runtime.dispose();
    await starting;
  }
});

function workerHarness() {
  const source = readFileSync(
    new URL("../../src/app/recording-evaluation.worker.ts", import.meta.url),
    "utf8",
  ).replace(/^import[\s\S]*?;/gm, "");
  const posted: unknown[] = [];
  let solved = 0,
    processed = 0;
  let release!: (value: unknown) => void;
  const gate = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  const context: Record<string, unknown> = {
    exports: {},
    RECORDING_EVALUATION_MAX_BYTES,
    RECORDING_EVALUATION_MAX_REQUESTS,
    postMessage: (value: unknown) => posted.push(structuredClone(value)),
    solveAcoustics: () => {
      solved++;
      return { frame: {} };
    },
    canonicalBytes: (value: unknown) => JSON.stringify(value).length,
    RecordingProcessor: class {
      process() {
        processed++;
        return gate;
      }
    },
  };
  context.globalThis = context;
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    context,
  );
  return {
    send: (data: unknown) => (context.onmessage as (event: { data: unknown }) => void)({ data }),
    posted,
    counts: () => ({ solved, processed }),
    release,
  };
}

test("back-to-back worker captures finish synchronously in message order without a busy rejection", () => {
  const h = workerHarness();
  h.send({ id: 1, input: { kind: "capture", requests: [{}] } });
  h.send({ id: 2, input: { kind: "capture", requests: [{}, {}] } });
  assert.deepEqual(h.posted, [
    { id: 1, ok: true, output: [{}] },
    { id: 2, ok: true, output: [{}, {}] },
  ]);
  assert.deepEqual(h.counts(), { solved: 3, processed: 0 });
});

test("worker preparation ACK runs no solver job and rejects malformed envelope", async () => {
  const h = workerHarness();
  h.send({ kind: "prepare", id: 1, generation: 0, protocolVersion: 1 });
  assert.deepEqual(h.posted[0], {
    kind: "prepared",
    ok: true,
    id: 1,
    generation: 0,
    protocolVersion: 1,
  });
  assert.deepEqual(h.counts(), { solved: 0, processed: 0 });
  for (const bad of [
    { kind: "prepare", id: 2, generation: 0, protocolVersion: 2 },
    { kind: "prepare", id: 3, generation: -1, protocolVersion: 1 },
    {
      kind: "prepare",
      id: 4,
      generation: 0,
      protocolVersion: 1,
      input: { kind: "capture", requests: [] },
    },
  ])
    h.send(bad);
  assert.ok(h.posted.slice(1).every((v) => (v as { ok: boolean }).ok === false));
  assert.deepEqual(h.counts(), { solved: 0, processed: 0 });
});

test("prepare rejected during reprocess does not clear legacy worker busy ownership", async () => {
  const h = workerHarness();
  h.send({
    id: 10,
    input: { kind: "reprocess", assets: [], frame: {}, changes: {}, baseline: {} },
  });
  h.send({ kind: "prepare", id: 11, generation: 0, protocolVersion: 1 });
  h.send({ kind: "prepare", id: 12, generation: 0, protocolVersion: 1 });
  assert.ok(h.posted.every((v) => (v as { ok: boolean }).ok === false));
  assert.deepEqual(h.counts(), { solved: 0, processed: 1 });
  h.release({});
  await until(() =>
    h.posted.some((v) => (v as { id: number; ok: boolean }).id === 10 && (v as { ok: boolean }).ok),
  );
  h.send({ id: 13, input: { kind: "capture", requests: [] } });
  await Promise.resolve();
  assert.deepEqual(h.posted.at(-1), { id: 13, ok: true, output: [] });
});

test("preparation owns one abort listener and refuses an unrelated owner or concurrent job", async () => {
  const port = new Port(),
    client = new RecordingEvaluationClient({ workerFactory: () => port });
  const controller = new AbortController(),
    foreign = new AbortController();
  let added = 0,
    removed = 0;
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  Object.defineProperty(controller.signal, "addEventListener", {
    value: (...args: Parameters<AbortSignal["addEventListener"]>) => {
      if (args[0] === "abort") added++;
      return add(...args);
    },
  });
  Object.defineProperty(controller.signal, "removeEventListener", {
    value: (...args: Parameters<AbortSignal["removeEventListener"]>) => {
      if (args[0] === "abort") removed++;
      return remove(...args);
    },
  });
  try {
    assertPrepare(client);
    const pending = client.prepare(controller.signal);
    assert.equal(client.prepare(controller.signal), pending);
    await assert.rejects(client.prepare(foreign.signal), { code: "EVALUATION_PREPARE_OWNER" });
    await assert.rejects(client.capture([]), { code: "EVALUATION_BUSY" });
    assert.equal(added, 1);
    assert.equal(port.messages.length, 1);
    port.ack();
    await pending;
    assert.equal(removed, 1);
    assert.equal(client.getReadinessDiagnostics().preparing, false);
  } finally {
    client.dispose();
  }
});

test("worker-declared preparation failure and actual constructor/send failures never imply ready", async () => {
  const port = new Port(),
    client = new RecordingEvaluationClient({ workerFactory: () => port });
  try {
    assertPrepare(client);
    const pending = client.prepare();
    const sent = port.messages[0]!;
    port.onmessage?.({
      data: {
        kind: "prepared",
        ok: false,
        id: sent.id,
        generation: sent.generation,
        protocolVersion: 1,
        error: { code: "EVALUATION_BUSY", message: "worker busy" },
      },
    });
    await assert.rejects(pending, { code: "EVALUATION_BUSY" });
    assert.equal(port.terminated, 1);
    assert.equal(client.getReadinessDiagnostics().workerPrepared, false);
    assert.equal(client.getReadinessDiagnostics().firstWorkerProtocolReplyAtWallMs, null);
  } finally {
    client.dispose();
  }
  for (const phase of ["constructor", "send"] as const) {
    const failure = new Error("ACTUAL_" + phase + "_FAILURE"),
      sending = new Port();
    if (phase === "send")
      sending.postMessage = () => {
        throw failure;
      };
    const failing = new RecordingEvaluationClient({
      workerFactory: () => {
        if (phase === "constructor") throw failure;
        return sending;
      },
    });
    try {
      assertPrepare(failing);
      await assert.rejects(failing.prepare(), (error) => error === failure);
      assert.equal(failing.getReadinessDiagnostics().workerPrepared, false);
    } finally {
      failing.dispose();
    }
  }
});

test("running audio freezes with physics throughout delayed recording preparation", async () => {
  const { runtime, access, port } = await runtimeFixture();
  const context = new FakeAudioContext();
  const engine = new AudioEngine({ context: context.asContext() });
  (runtime as unknown as { audio: AudioEngine }).audio = engine;
  let starting: Promise<void> | null = null;
  try {
    await engine.enable(0);
    await runtime.dispatch({ type: "run" });
    runtime.advance(1 / 60);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(engine.getTelemetry().paused, false);
    starting = runtime.dispatch({ type: "recordToggle" });
    await until(() => port.messages.some((m) => m.kind === "prepare"));
    assert.equal(
      engine.getTelemetry().paused,
      true,
      "native transport freezes before the ACK wait",
    );
    const tick = access.world.tick;
    for (let i = 0; i < 12; i++) runtime.advance(1 / 60);
    assert.equal(access.world.tick, tick);
    assert.equal(access.recorder.getView().recording.state, "idle");
    port.ack();
    await starting;
    assert.equal(engine.getTelemetry().paused, false);
    assert.equal(access.recorder.getView().recording.state, "recording");
  } finally {
    runtime.dispose();
    await starting;
  }
});

test("Reset during short take preparation waits for owner cleanup and actually resets", async () => {
  const { runtime, access, port } = await runtimeFixture();
  let capture: Promise<void> | null = null;
  try {
    const runId = runtime.getSnapshot().runId;
    capture = runtime.captureShortTake(1 / 60);
    const interrupted = assert.rejects(capture, /SHORT_TAKE_INTERRUPTED/);
    await until(() => port.messages.some((m) => m.kind === "prepare"));
    await runtime.dispatch({ type: "reset" });
    await interrupted;
    assert.notEqual(
      runtime.getSnapshot().runId,
      runId,
      "Reset must outlive the entire short take owner",
    );
    assert.equal(access.busy, false);
    assert.equal(access.world.paused, true);
    assert.equal(access.recorder.getView().recording.state, "idle");
    assert.notEqual(runtime.getSnapshot().notice, "正在準備錄製…");
  } finally {
    runtime.dispose();
    await capture?.catch(() => {});
  }
});

test("an asset lease failure cannot leave a stale preparing status", async () => {
  const { runtime, access, port } = await runtimeFixture();
  const assetHost = (runtime as unknown as { assetHost: AssetHost }).assetHost;
  assetHost.acquireAssetBank = async () => {
    throw new Error("LEASE_UNAVAILABLE");
  };
  try {
    await runtime.dispatch({ type: "recordToggle" });
    assert.match(runtime.getSnapshot().error ?? "", /LEASE_UNAVAILABLE/);
    assert.equal(access.busy, false);
    assert.equal(access.world.paused, true);
    assert.equal(port.messages.length, 0);
    assert.notEqual((runtime as unknown as { pauseReason: string }).pauseReason, "正在準備錄製…");
    assert.notEqual(runtime.getSnapshot().notice, "正在準備錄製…");
  } finally {
    runtime.dispose();
  }
});

test("a timed out runtime preparation stays paused, clears its notice and allows an explicit retry", async () => {
  const { runtime, access, port, client } = await runtimeFixture(50);
  let retry: Promise<void> | null = null;
  try {
    await runtime.dispatch({ type: "recordToggle" });
    assert.equal(runtime.getSnapshot().error, "錄製評估準備逾時。");
    assert.notEqual(runtime.getSnapshot().notice, "正在準備錄製…");
    assert.equal(access.busy, false);
    assert.equal(access.world.paused, true);
    assert.equal(access.recorder.getView().recording.state, "idle");
    assert.equal(access.recorder.getEvaluationTelemetry(), null);
    retry = runtime.dispatch({ type: "recordToggle" });
    await until(() => port.messages.filter((m) => m.kind === "prepare").length === 2);
    port.ack(port.messages.at(-1)!);
    await retry;
    assert.equal(client.getReadinessDiagnostics().workerCreateCount, 2);
    assert.equal(access.recorder.getView().recording.state, "recording");
    assert.equal(runtime.getSnapshot().error, "");
  } finally {
    runtime.dispose();
    await retry;
  }
});

test("a second runtime take retains the real prepared worker after retiring the completed evaluation lane", async () => {
  const { runtime, access, port, client } = await runtimeFixture();
  let starting: Promise<void> | null = null;
  try {
    starting = runtime.dispatch({ type: "recordToggle" });
    await until(() => port.messages.some((message) => message.kind === "prepare"));
    port.ack();
    await starting;
    runtime.advance(1 / 60);
    port.solve();
    await runtime.flushRecordingEvaluation();
    await runtime.dispatch({ type: "recordToggle" });
    const first = runtime.getRecordingArtifact();
    assert.equal(first?.frameCount, 1);
    assert.equal(client.getReadinessDiagnostics().workerPrepared, true);
    const prepareCount = port.messages.filter((message) => message.kind === "prepare").length;
    starting = runtime.dispatch({ type: "recordToggle" });
    await until(
      () =>
        access.recorder.getView().recording.state === "recording" ||
        port.messages.filter((message) => message.kind === "prepare").length > prepareCount,
    );
    assert.equal(port.terminated, 0, "retiring the old lane cannot cancel its replacement owner");
    assert.equal(client.getReadinessDiagnostics().workerCreateCount, 1);
    assert.equal(client.getReadinessDiagnostics().workerPrepared, true);
    assert.equal(
      port.messages.filter((message) => message.kind === "prepare").length,
      prepareCount,
    );
    await starting;
    runtime.advance(1 / 60);
    port.solve();
    await runtime.flushRecordingEvaluation();
    await runtime.dispatch({ type: "recordToggle" });
    assert.equal(runtime.getRecordingArtifact()?.frameCount, 1);
    assert.notEqual(runtime.getRecordingArtifact()?.runId, first?.runId);
  } finally {
    runtime.dispose();
    await starting?.catch(() => {});
  }
});
