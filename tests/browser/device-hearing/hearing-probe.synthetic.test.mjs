import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createHearingProbePreload, WORKLET_SOURCE } from "./hearing-probe.mjs";

// Every fixture is synthetic. These tests never establish native/browser/hearing evidence.
function fixture({ unanswered = false, failGain = false, failModule = false } = {}) {
  const resources = { nodes: [], blobs: new Map(), allocations: 0, mainLifecycleCalls: 0 };
  const makeNode = (context, kind) => {
    const node = {
      context,
      kind,
      connections: [],
      disconnects: 0,
      starts: 0,
      stops: 0,
      offset: { value: 1 },
      gain: { value: 1 },
      connect(to) {
        this.connections.push(to);
        return to;
      },
      disconnect() {
        this.disconnects++;
        this.connections.length = 0;
      },
      start() {
        this.starts++;
      },
      stop() {
        this.stops++;
      },
    };
    resources.nodes.push(node);
    return node;
  };
  class NativeContext {
    constructor(options) {
      if (options?.syntheticConstructorError) throw new Error("NATIVE_ERROR");
      this.options = options;
      this.sampleRate = 48000;
      this.state = "running";
      this.baseLatency = 0.01;
      this.outputLatency = 0.02;
      this.destination = { kind: "native-destination", context: this };
      this.audioWorklet = {
        addModule: async (url) => {
          if (failModule) throw new Error("SYNTHETIC_MODULE_ERROR");
          vm.runInContext(resources.blobs.get(url).parts.join(""), sandbox);
        },
      };
    }
    createConstantSource() {
      return makeNode(this, "constant");
    }
    createGain() {
      if (failGain) throw new Error("SYNTHETIC_GAIN_ERROR");
      return makeNode(this, "gain");
    }
    close() {
      resources.mainLifecycleCalls++;
    }
    suspend() {
      resources.mainLifecycleCalls++;
    }
    resume() {
      resources.mainLifecycleCalls++;
    }
  }
  class Port {
    constructor() {
      this.closed = 0;
      this.messages = [];
    }
    postMessage(data) {
      this.messages.push(data);
      if (!unanswered || data.type === "stop") this.peer?.onmessage?.({ data });
    }
    close() {
      this.closed++;
    }
  }
  class ProcessorBase {
    constructor() {
      this.port = new Port();
    }
  }
  class WorkletNode {
    constructor(context, name, options) {
      const node = makeNode(context, "probe");
      Object.assign(this, node);
      this.options = options;
      this.port = new Port();
      this.processor = new resources.Processor();
      this.port.peer = this.processor.port;
      this.processor.port.peer = this.port;
      resources.probe = this;
      resources.nodes[resources.nodes.length - 1] = this;
    }
  }
  const runtime = { audio: null, getSnapshot: () => ({ simulationState: "ready" }) };
  const sandbox = vm.createContext({
    AudioContext: NativeContext,
    AudioWorkletNode: WorkletNode,
    AudioWorkletProcessor: ProcessorBase,
    registerProcessor: (name, ctor) => {
      resources.Processor = ctor;
    },
    __reflectionLab: runtime,
    setTimeout,
    clearTimeout,
    Blob: class {
      constructor(parts) {
        this.parts = parts;
      }
    },
    URL: {
      createObjectURL(blob) {
        const url = `blob:synthetic-${resources.blobs.size}`;
        resources.blobs.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        resources.blobs.delete(url);
      },
    },
    Uint32Array: class extends Uint32Array {
      constructor(...args) {
        super(...args);
        resources.allocations++;
      }
    },
    Float64Array: class extends Float64Array {
      constructor(...args) {
        super(...args);
        resources.allocations++;
      }
    },
  });
  const initialDescriptor = Object.getOwnPropertyDescriptor(sandbox, "AudioContext");
  vm.runInContext(
    createHearingProbePreload({ evidenceKind: "synthetic", hearing: "NOT_RUN" }),
    sandbox,
  );
  const api = sandbox.__v1HearingProbe;
  const enable = () => {
    assert.equal(api.armEnableListening().ok, true);
    const context = new sandbox.AudioContext({ latencyHint: "interactive" });
    runtime.audio = { context, getTelemetry: () => ({ enabled: true }), monitor: { value: 0.18 } };
    assert.equal(api.selectMainContext().ok, true);
    return context;
  };
  const process = (...lengths) => {
    const channels = lengths.map((size) => new Float32Array(size).fill(0.75));
    const result = resources.probe.processor.process([], [channels]);
    assert(
      channels.every((channel) => channel.every((n) => n === 0)),
      "all synthetic output is silent",
    );
    return result;
  };
  return { api, sandbox, runtime, resources, NativeContext, initialDescriptor, enable, process };
}

test("Synthetic: constructor arguments, prototype, subclass and native errors preserved", () => {
  const f = fixture(),
    Native = f.NativeContext;
  const context = new f.sandbox.AudioContext({ latencyHint: "interactive" });
  assert(context instanceof Native);
  assert.equal(Object.getPrototypeOf(context), Native.prototype);
  assert.equal(f.sandbox.AudioContext.prototype, Native.prototype);
  assert.equal(context.options.latencyHint, "interactive");
  class Sub extends f.sandbox.AudioContext {}
  const sub = new Sub();
  assert(sub instanceof Sub && sub instanceof Native);
  assert.equal(Object.getPrototypeOf(sub), Sub.prototype);
  assert.throws(
    () => new f.sandbox.AudioContext({ syntheticConstructorError: true }),
    /NATIVE_ERROR/,
  );
  assert.equal(f.api.status().capturedContexts, 2);
  f.api.cleanup();
  assert.deepEqual(Object.getOwnPropertyDescriptor(f.sandbox, "AudioContext"), f.initialDescriptor);
});

test("Synthetic: first sole context requires actual enabled paused App engine identity", () => {
  const f = fixture(),
    context = f.enable();
  const status = f.api.status();
  assert.equal(status.metadata.sampleRate, context.sampleRate);
  assert.equal(status.provenance.evidenceKind, "synthetic");
  assert.equal(status.actualBlock, "UNKNOWN");
  assert.equal(f.runtime.audio.context, context);
  f.api.cleanup();
});

test("Synthetic: no runtime, running app, pre-arm construction and no callbacks refuse claims", () => {
  const f = fixture();
  f.sandbox.__reflectionLab = null;
  assert.equal(f.api.armEnableListening().code, "PAUSED_APP_RUNTIME_REQUIRED");
  f.sandbox.__reflectionLab = { audio: null, getSnapshot: () => ({ simulationState: "running" }) };
  assert.equal(f.api.armEnableListening().code, "PAUSED_APP_RUNTIME_REQUIRED");
  new f.sandbox.AudioContext();
  assert.equal(f.api.armEnableListening().code, "CONTEXT_EXISTS_BEFORE_ARM");
  assert.equal(f.api.status().actualBlock, "UNKNOWN");
  f.api.cleanup();
});

test("Synthetic: preview-only and same-valued different context cannot become main Run", () => {
  const f = fixture();
  f.api.armEnableListening();
  new f.sandbox.AudioContext(); // represents a separate static preview or audition
  f.runtime.audio = { context: new f.NativeContext(), getTelemetry: () => ({ enabled: true }) };
  assert.equal(f.api.selectMainContext().code, "MAIN_CONTEXT_IDENTITY_MISMATCH");
  f.api.cleanup();
});

test("Synthetic: disabled listening and suspended native context do not select", () => {
  const f = fixture();
  f.api.armEnableListening();
  const context = new f.sandbox.AudioContext();
  f.runtime.audio = { context, getTelemetry: () => ({ enabled: false }) };
  assert.equal(f.api.selectMainContext().code, "LISTENING_NOT_ENABLED");
  f.runtime.audio.getTelemetry = () => ({ enabled: true });
  context.state = "suspended";
  assert.equal(f.api.selectMainContext().code, "LISTENING_NOT_ENABLED");
  f.api.cleanup();
});

test("Synthetic: constructor registry is bounded and cannot break successful construction", () => {
  const f = fixture();
  f.api.armEnableListening();
  for (let i = 0; i < 20; i++) assert(new f.sandbox.AudioContext() instanceof f.NativeContext);
  assert.equal(f.api.status().capturedContexts, 8);
  assert.equal(f.api.status().registryOverflow, true);
  assert.equal(f.api.selectMainContext().code, "AMBIGUOUS_CONTEXTS");
  f.api.cleanup();
});

test("Synthetic: absent AudioWorklet returns UNKNOWN without owned audio nodes", async () => {
  const f = fixture(),
    context = f.enable();
  context.audioWorklet = undefined;
  const result = await f.api.attach();
  assert.equal(result.code, "AUDIO_WORKLET_UNAVAILABLE");
  assert.equal(result.actualBlock, "UNKNOWN");
  assert.equal(f.resources.nodes.length, 0);
  f.api.cleanup();
});

test("Synthetic: same context silent graph, UNKNOWN until observed variable blocks", async () => {
  const f = fixture(),
    context = f.enable();
  assert.equal((await f.api.attach()).ok, true);
  const [source, probe, gain] = f.resources.nodes;
  assert.equal(source.context, context);
  assert.equal(probe.context, context);
  assert.equal(gain.context, context);
  assert.equal(source.offset.value, 0);
  assert.equal(gain.gain.value, 0);
  assert.deepEqual(source.connections, [probe]);
  assert.deepEqual(probe.connections, [gain]);
  assert.deepEqual(gain.connections, [context.destination]);
  assert.equal((await f.api.snapshot()).actualBlock, "UNKNOWN");
  f.process(64, 64);
  f.process(128);
  f.process(64);
  const result = await f.api.snapshot();
  assert.equal(result.provenance.evidenceKind, "synthetic");
  assert.equal(result.actualBlock, "OBSERVED");
  assert.deepEqual(JSON.parse(JSON.stringify(result.observation.histogram)), [
    { frames: 64, blocks: 2 },
    { frames: 128, blocks: 1 },
  ]);
  assert.equal(result.observation.frames, 256);
  assert.equal(result.observation.blocks, 3);
  assert.equal(result.observation.histogramComplete, true);
  f.api.cleanup();
});

test("Synthetic: empty outputs stay UNKNOWN; fixed histogram overflow is explicit", async () => {
  const f = fixture();
  f.enable();
  await f.api.attach();
  f.resources.probe.processor.process([], []);
  assert.equal((await f.api.snapshot()).actualBlock, "UNKNOWN");
  for (let size = 1; size <= 20; size++) f.process(size);
  const result = await f.api.snapshot();
  assert.equal(result.observation.histogram.length, 16);
  assert.equal(result.observation.histogramComplete, false);
  assert.equal(result.observation.overflowBlocks, 4);
  assert.equal(result.observation.overflowFrames, 74);
  assert.equal(result.observation.frames, 210);
  assert.equal(result.observation.missingOutputCalls, 1);
  f.api.cleanup();
});

test("Synthetic: callback has fixed storage, no messages/allocation, finite saturation", async () => {
  const f = fixture();
  f.enable();
  await f.api.attach();
  const processor = f.resources.probe.processor;
  const sizes = processor.sizes,
    counts = processor.counts,
    allocations = f.resources.allocations;
  const output = [[new Float32Array(128)]];
  for (let i = 0; i < 1000; i++) processor.process([], output);
  assert.equal(processor.sizes, sizes);
  assert.equal(processor.counts, counts);
  assert.equal(f.resources.allocations, allocations);
  assert.equal(processor.port.messages.length, 0);
  processor.blocks = 1000000000;
  const frames = processor.frames;
  processor.process([], output);
  assert.equal(processor.blocks, 1000000000);
  assert.equal(processor.frames, frames);
  assert.equal(processor.saturated, true);
  const processSource = WORKLET_SOURCE.split("process(_inputs, outputs)")[1];
  assert(!/\bnew\b|postMessage|console\.|fetch\(|\.push\(/.test(processSource));
  f.api.cleanup();
});

test("Synthetic: later additional context and replaced main engine invalidate collection", async () => {
  const f = fixture();
  f.enable();
  await f.api.attach();
  f.process(128);
  new f.sandbox.AudioContext();
  assert.equal((await f.api.snapshot()).code, "AMBIGUOUS_CONTEXTS");
  f.api.cleanup();
  const g = fixture();
  g.enable();
  await g.api.attach();
  g.runtime.audio = { ...g.runtime.audio };
  assert.equal((await g.api.snapshot()).code, "MAIN_CONTEXT_IDENTITY_MISMATCH");
  g.api.cleanup();
  const closed = fixture(),
    context = closed.enable();
  await closed.api.attach();
  closed.process(64);
  context.state = "closed";
  const result = await closed.api.snapshot();
  assert.equal(result.code, "MAIN_CONTEXT_CLOSED");
  assert.equal(result.actualBlock, "UNKNOWN");
  closed.api.cleanup();
});

test("Synthetic: unanswered port timeout, single pending request and stale reply isolation", async () => {
  const f = fixture({ unanswered: true });
  f.enable();
  await f.api.attach();
  const first = f.api.snapshot({ timeoutMs: 5 });
  assert.equal((await f.api.snapshot()).code, "REQUEST_PENDING");
  assert.equal((await first).code, "PORT_TIMEOUT");
  const second = f.api.snapshot({ timeoutMs: 5 });
  f.resources.probe.port.onmessage({ data: { type: "snapshot", id: 1, blocks: 999 } });
  assert.equal((await second).code, "PORT_TIMEOUT");
  const last = f.api.snapshot({ timeoutMs: 50 });
  f.api.cleanup();
  assert.equal((await last).code, "PROBE_CLEANED_UP");
});

test("Synthetic: host and processor snapshot budgets are independently bounded", async () => {
  const f = fixture();
  f.enable();
  await f.api.attach();
  for (let i = 0; i < 16; i++) assert.equal((await f.api.snapshot()).ok, true);
  assert.equal((await f.api.snapshot()).code, "REQUEST_BUDGET_EXHAUSTED");
  const processor = f.resources.probe.processor,
    replies = processor.port.messages.length;
  for (let i = 0; i < 20; i++) processor.port.onmessage({ data: { type: "snapshot", id: 1 } });
  assert.equal(processor.requests, 16);
  assert.equal(processor.port.messages.length, replies);
  f.api.cleanup();
});

test("Synthetic: malformed positive reply cannot fake an observed callback", async () => {
  const f = fixture({ unanswered: true });
  f.enable();
  await f.api.attach();
  const pending = f.api.snapshot();
  f.resources.probe.port.onmessage({
    data: {
      type: "snapshot",
      id: 1,
      blocks: 1,
      frames: 0,
      sizes: [],
      counts: [],
      overflowBlocks: 0,
      overflowFrames: 0,
      missingOutputCalls: 0,
      saturated: false,
    },
  });
  assert.equal((await pending).code, "INVALID_PROCESSOR_REPLY");
  f.api.cleanup();
});

test("Synthetic: cleanup idempotent, restores constructor, keeps all App state untouched", async () => {
  const f = fixture(),
    context = f.enable(),
    engine = f.runtime.audio;
  await f.api.attach();
  f.process(128);
  const nodes = [...f.resources.nodes],
    port = f.resources.probe.port;
  assert.equal(f.api.cleanup().ok, true);
  assert.equal(f.api.cleanup().ok, true);
  assert.equal(nodes[0].stops, 1);
  assert(nodes.every((node) => node.disconnects === 1));
  assert.equal(port.closed, 1);
  assert.equal(f.resources.blobs.size, 0);
  assert.equal(f.resources.mainLifecycleCalls, 0);
  assert.equal(context.state, "running");
  assert.equal(f.runtime.audio, engine);
  assert.equal(engine.monitor.value, 0.18);
  assert.equal(f.resources.probe.processor.process([], [[new Float32Array(128)]]), false);
  assert.equal((await f.api.snapshot()).code, "DISPOSED");
});

test("Synthetic: partial attach failures clean every owned resource, preserve App context", async () => {
  for (const options of [{ failGain: true }, { failModule: true }]) {
    const f = fixture(options),
      context = f.enable();
    const result = await f.api.attach();
    assert.equal(result.code, "ATTACH_FAILED");
    assert.equal(result.cleanupErrors.length, 0);
    assert(f.resources.nodes.every((node) => node.disconnects === 1));
    assert.equal(f.resources.blobs.size, 0);
    assert.equal(f.resources.mainLifecycleCalls, 0);
    assert.equal(context.state, "running");
    f.api.cleanup();
  }
});

test("Synthetic: cleanup attempts remaining owned resources after one disconnect throws", async () => {
  const f = fixture();
  f.enable();
  await f.api.attach();
  let stopAttempts = 0,
    disconnectAttempts = 0;
  const source = f.resources.nodes[0],
    originalStop = source.stop.bind(source),
    originalDisconnect = source.disconnect.bind(source);
  source.stop = () => {
    if (++stopAttempts === 1) throw new Error("SYNTHETIC_STOP_ERROR");
    originalStop();
  };
  source.disconnect = () => {
    if (++disconnectAttempts === 1) throw new Error("SYNTHETIC_DISCONNECT_ERROR");
    originalDisconnect();
  };
  const result = f.api.cleanup();
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].operation, "stop-owned-source");
  assert.equal(result.errors[1].operation, "disconnect-owned-source");
  assert.equal(f.resources.nodes[1].disconnects, 1);
  assert.equal(f.resources.nodes[2].disconnects, 1);
  assert.equal(f.resources.probe.port.closed, 1);
  assert.equal(f.resources.blobs.size, 0);
  assert.equal(f.api.status().attached, true, "failed owned resources retained for retry");
  assert.equal(f.api.cleanup().ok, true);
  assert.equal(stopAttempts, 2);
  assert.equal(disconnectAttempts, 2);
  assert.equal(source.stops, 1);
  assert.equal(source.disconnects, 1);
  assert.equal(f.resources.nodes[1].disconnects, 1, "successful disconnect not repeated");
  assert.equal(f.resources.probe.port.closed, 1, "successful port close not repeated");
  assert.equal(f.api.status().attached, false);
  assert.equal(f.api.cleanup().ok, true);
  assert.equal(stopAttempts, 2);
  assert.equal(f.resources.mainLifecycleCalls, 0);
});

test("Synthetic: cleanup never overwrites a subsequent unrelated constructor replacement", () => {
  const f = fixture(),
    replacement = function DifferentOwner() {};
  f.sandbox.AudioContext = replacement;
  f.api.cleanup();
  assert.equal(f.sandbox.AudioContext, replacement);
});
