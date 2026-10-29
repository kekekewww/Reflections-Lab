// Optional diagnostic only. Importing this file starts no browser, device or audio.
export const WORKLET_SOURCE = String.raw`
class ReflectionLabBlockProbe extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sizes = new Uint32Array(16);
    this.counts = new Float64Array(16);
    this.used = 0;
    this.blocks = 0;
    this.frames = 0;
    this.overflowBlocks = 0;
    this.overflowFrames = 0;
    this.missingOutputCalls = 0;
    this.saturated = false;
    this.running = true;
    this.requests = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.type === 'stop') {
        this.running = false;
        this.port.close();
      } else if (data?.type === 'snapshot' && Number.isInteger(data.id) &&
                 data.id >= 1 && data.id <= 16 && this.requests < 16) {
        this.requests++;
        // This event handler, never process(), allocates the bounded reply.
        this.port.postMessage({ type: 'snapshot', id: data.id,
          blocks: this.blocks, frames: this.frames,
          sizes: Array.from(this.sizes.subarray(0, this.used)),
          counts: Array.from(this.counts.subarray(0, this.used)),
          overflowBlocks: this.overflowBlocks, overflowFrames: this.overflowFrames,
          missingOutputCalls: this.missingOutputCalls, saturated: this.saturated });
      }
    };
  }
  process(_inputs, outputs) {
    // Node configuration fixes one mono output; zero all supplied channels defensively.
    const output = outputs[0];
    if (output) for (let c = 0; c < output.length; c++) output[c].fill(0);
    if (!this.running) return false;
    const length = output && output[0] ? output[0].length : 0;
    if (length === 0) {
      if (this.missingOutputCalls < 1000000000) this.missingOutputCalls++;
      return true;
    }
    // Explicit saturation; no wrapping integer counters or unbounded storage.
    if (this.blocks >= 1000000000 || this.frames + length > 4503599627370495) {
      this.saturated = true;
      return true;
    }
    this.blocks++;
    this.frames += length;
    for (let i = 0; i < this.used; i++) {
      if (this.sizes[i] === length) { this.counts[i]++; return true; }
    }
    if (this.used < this.sizes.length) {
      this.sizes[this.used] = length;
      this.counts[this.used++] = 1;
    } else {
      this.overflowBlocks++;
      this.overflowFrames += length;
    }
    return true;
  }
}
registerProcessor('reflection-lab-block-probe-v1', ReflectionLabBlockProbe);
`;

// Self-contained so it can be preloaded before the app by page.addInitScript.
export function installHearingProbe({ workletSource, provenance = {} }) {
  const host = globalThis;
  const key = "__v1HearingProbe";
  const failure = (code, detail = null) => ({ ok: false, code, detail, actualBlock: "UNKNOWN" });
  if (host[key]) return failure("ALREADY_INSTALLED");
  const descriptor = Object.getOwnPropertyDescriptor(host, "AudioContext");
  const Native = host.AudioContext;
  if (typeof Native !== "function") return failure("AUDIO_CONTEXT_UNAVAILABLE");
  if (!descriptor || !("value" in descriptor) || (!descriptor.writable && !descriptor.configurable))
    return failure("CONSTRUCTOR_NOT_WRITABLE");
  if (typeof workletSource !== "string" || workletSource.length > 16384)
    return failure("INVALID_WORKLET_SOURCE");
  const contexts = [];
  const maxContexts = 8;
  let overflow = false,
    armedRuntime = null,
    selected = null,
    selectedEngine = null;
  let disposed = false,
    attaching = false,
    nodes = null,
    blobUrl = null;
  let requestId = 0,
    pending = null;
  const details = Object.freeze({ ...provenance });
  let wrapper;
  wrapper = new Proxy(Native, {
    construct(target, args, newTarget) {
      const value = Reflect.construct(target, args, newTarget === wrapper ? target : newTarget);
      // Observation must never change a successful native construction into a failure.
      if (!disposed) {
        if (contexts.length < maxContexts) contexts.push(value);
        else overflow = true;
      }
      return value;
    },
  });
  Object.defineProperty(host, "AudioContext", { ...descriptor, value: wrapper });
  const runtime = () => host.__reflectionLab;
  const paused = (value) => ["ready", "paused"].includes(value?.getSnapshot?.().simulationState);
  const metadata = () => {
    const finite = (value) => (Number.isFinite(value) && value >= 0 ? value : null);
    return {
      sampleRate: selected ? finite(selected.sampleRate) : null,
      contextState: selected?.state ?? "not-selected",
      baseLatencyEstimateSeconds: selected ? finite(selected.baseLatency) : null,
      outputLatencyEstimateSeconds: selected ? finite(selected.outputLatency) : null,
      latencyMeaning: "browser-reported estimate; not measured end-to-end latency",
      sampleRateMeaning: "native App AudioContext rate; physical DAC rate unknown",
    };
  };
  const identityFailure = () => {
    if (disposed) return failure("DISPOSED");
    if (overflow || contexts.length !== 1) return failure("AMBIGUOUS_CONTEXTS");
    if (
      !selected ||
      !armedRuntime ||
      runtime() !== armedRuntime ||
      armedRuntime.audio !== selectedEngine ||
      selectedEngine.context !== selected ||
      contexts[0] !== selected ||
      !(selected instanceof Native) ||
      "startRendering" in selected
    )
      return failure("MAIN_CONTEXT_IDENTITY_MISMATCH");
    if (!selectedEngine.getTelemetry?.().enabled) return failure("LISTENING_NOT_ENABLED");
    if (selected.state === "closed") return failure("MAIN_CONTEXT_CLOSED");
    return null;
  };
  const safe = (errors, label, operation) => {
    try {
      operation();
      return true;
    } catch (error) {
      errors.push({ operation: label, message: String(error?.message ?? error) });
      return false;
    }
  };
  const releaseOwned = () => {
    const errors = [];
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(failure("PROBE_CLEANED_UP"));
      pending = null;
    }
    if (nodes) {
      // Keep failed resources reachable for an honest subsequent cleanup retry.
      const done = nodes.cleanup;
      const finish = (key, label, operation) => {
        if (!done[key] && safe(errors, label, operation)) done[key] = true;
      };
      if (nodes.probe)
        finish("processorStop", "stop-owned-processor", () =>
          nodes.probe.port.postMessage({ type: "stop" }),
        );
      else done.processorStop = true;
      if (nodes.started) finish("sourceStop", "stop-owned-source", () => nodes.source.stop());
      else done.sourceStop = true;
      for (const name of ["source", "probe", "gain"])
        if (nodes[name])
          finish(`${name}Disconnect`, `disconnect-owned-${name}`, () => nodes[name].disconnect());
        else done[`${name}Disconnect`] = true;
      if (nodes.probe) {
        nodes.probe.port.onmessage = null;
        finish("portClose", "close-owned-port", () => nodes.probe.port.close());
      } else done.portClose = true;
      if (Object.values(done).every(Boolean)) nodes = null;
    }
    if (blobUrl && safe(errors, "revoke-owned-blob", () => host.URL.revokeObjectURL(blobUrl)))
      blobUrl = null;
    return errors;
  };
  const api = Object.freeze({
    armEnableListening() {
      if (disposed) return failure("DISPOSED");
      if (armedRuntime || selected) return failure("ALREADY_ARMED");
      if (overflow || contexts.length) return failure("CONTEXT_EXISTS_BEFORE_ARM");
      const value = runtime();
      if (!value || !paused(value)) return failure("PAUSED_APP_RUNTIME_REQUIRED");
      if (value.audio?.context) return failure("MAIN_CONTEXT_ALREADY_EXISTS");
      armedRuntime = value;
      return {
        ok: true,
        next: "User clicks Enable listening while paused, then selectMainContext()",
      };
    },
    selectMainContext() {
      if (disposed) return failure("DISPOSED");
      if (!armedRuntime || runtime() !== armedRuntime || !paused(armedRuntime))
        return failure("ARMED_PAUSED_RUNTIME_REQUIRED");
      if (overflow || contexts.length !== 1) return failure("AMBIGUOUS_CONTEXTS");
      const engine = armedRuntime.audio,
        context = engine?.context;
      if (
        !context ||
        context !== contexts[0] ||
        !(context instanceof Native) ||
        "startRendering" in context
      )
        return failure("MAIN_CONTEXT_IDENTITY_MISMATCH");
      if (!engine.getTelemetry?.().enabled || context.state !== "running")
        return failure("LISTENING_NOT_ENABLED");
      if (selected && (selected !== context || selectedEngine !== engine))
        return failure("MAIN_CONTEXT_CHANGED");
      selected = context;
      selectedEngine = engine;
      return {
        ok: true,
        sameAppMainContext: true,
        capturedContexts: contexts.length,
        actualBlock: "UNKNOWN",
        metadata: metadata(),
        provenance: details,
      };
    },
    async attach({ moduleTimeoutMs = 3000 } = {}) {
      const invalid = identityFailure();
      if (invalid) return invalid;
      if (nodes || attaching) return failure("ALREADY_ATTACHED_OR_ATTACHING");
      if (!Number.isInteger(moduleTimeoutMs) || moduleTimeoutMs < 1 || moduleTimeoutMs > 10000)
        return failure("INVALID_TIMEOUT");
      if (
        typeof selected.audioWorklet?.addModule !== "function" ||
        typeof host.AudioWorkletNode !== "function"
      )
        return failure("AUDIO_WORKLET_UNAVAILABLE");
      attaching = true;
      let timer;
      try {
        blobUrl = host.URL.createObjectURL(
          new host.Blob([workletSource], { type: "text/javascript" }),
        );
        await Promise.race([
          selected.audioWorklet.addModule(blobUrl),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("MODULE_TIMEOUT")), moduleTimeoutMs);
          }),
        ]);
        const changed = identityFailure();
        if (changed) {
          releaseOwned();
          return changed;
        }
        nodes = {
          source: null,
          probe: null,
          gain: null,
          started: false,
          cleanup: {
            processorStop: false,
            sourceStop: false,
            sourceDisconnect: false,
            probeDisconnect: false,
            gainDisconnect: false,
            portClose: false,
          },
        };
        nodes.source = selected.createConstantSource();
        nodes.source.offset.value = 0;
        nodes.probe = new host.AudioWorkletNode(selected, "reflection-lab-block-probe-v1", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
        });
        nodes.gain = selected.createGain();
        nodes.gain.gain.value = 0;
        nodes.probe.port.onmessage = ({ data }) => {
          if (!pending || data?.type !== "snapshot" || data.id !== pending.id) return;
          const waiting = pending;
          pending = null;
          clearTimeout(waiting.timer);
          const invalidNow = identityFailure();
          if (invalidNow) {
            waiting.resolve(invalidNow);
            return;
          }
          const valid =
            Number.isSafeInteger(data.blocks) &&
            data.blocks >= 0 &&
            Number.isSafeInteger(data.frames) &&
            data.frames >= 0 &&
            Array.isArray(data.sizes) &&
            data.sizes.length <= 16 &&
            Array.isArray(data.counts) &&
            data.counts.length === data.sizes.length &&
            data.sizes.every((n) => Number.isInteger(n) && n > 0) &&
            new Set(data.sizes).size === data.sizes.length &&
            data.counts.every((n) => Number.isSafeInteger(n) && n > 0) &&
            [data.overflowBlocks, data.overflowFrames, data.missingOutputCalls].every(
              (n) => Number.isSafeInteger(n) && n >= 0,
            ) &&
            typeof data.saturated === "boolean" &&
            data.counts.reduce((sum, n) => sum + n, 0) + data.overflowBlocks === data.blocks &&
            data.sizes.reduce((sum, n, i) => sum + n * data.counts[i], 0) + data.overflowFrames ===
              data.frames;
          if (!valid) {
            waiting.resolve(failure("INVALID_PROCESSOR_REPLY"));
            return;
          }
          waiting.resolve({
            ok: true,
            actualBlock: data.blocks > 0 ? "OBSERVED" : "UNKNOWN",
            sameAppMainContext: true,
            metadata: metadata(),
            provenance: details,
            observation: {
              blocks: data.blocks,
              frames: data.frames,
              histogram: data.sizes.map((frames, i) => ({ frames, blocks: data.counts[i] })),
              histogramComplete: data.overflowBlocks === 0 && !data.saturated,
              overflowBlocks: data.overflowBlocks,
              overflowFrames: data.overflowFrames,
              missingOutputCalls: data.missingOutputCalls,
              saturated: data.saturated,
            },
            excludedClaims: [
              "hearing",
              "audibility",
              "SPL",
              "physical DAC rate",
              "xruns",
              "worklet p99",
            ],
          });
        };
        nodes.source.connect(nodes.probe);
        nodes.probe.connect(nodes.gain);
        nodes.gain.connect(selected.destination);
        nodes.source.start();
        nodes.started = true;
        return {
          ok: true,
          sameAppMainContext: true,
          actualBlock: "UNKNOWN",
          path: "owned zero ConstantSource -> silent mono probe -> zero Gain -> same native destination",
        };
      } catch (error) {
        return {
          ...failure("ATTACH_FAILED", String(error?.message ?? error)),
          cleanupErrors: releaseOwned(),
        };
      } finally {
        clearTimeout(timer);
        attaching = false;
      }
    },
    async snapshot({ timeoutMs = 1000 } = {}) {
      const invalid = identityFailure();
      if (invalid) return invalid;
      if (!nodes) return failure("NOT_ATTACHED");
      if (pending) return failure("REQUEST_PENDING");
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
        return failure("INVALID_TIMEOUT");
      if (requestId >= 16) return failure("REQUEST_BUDGET_EXHAUSTED");
      const id = ++requestId;
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (pending?.id === id) {
            pending = null;
            resolve(failure("PORT_TIMEOUT"));
          }
        }, timeoutMs);
        pending = { id, resolve, timer };
        try {
          nodes.probe.port.postMessage({ type: "snapshot", id });
        } catch (error) {
          pending = null;
          clearTimeout(timer);
          resolve(failure("PORT_SEND_FAILED", String(error?.message ?? error)));
        }
      });
    },
    status() {
      return {
        ok: true,
        armed: !!armedRuntime,
        selected: !!selected,
        attached: !!nodes,
        disposed,
        capturedContexts: contexts.length,
        registryOverflow: overflow,
        actualBlock: "UNKNOWN",
        metadata: metadata(),
        provenance: details,
      };
    },
    cleanup() {
      const errors = releaseOwned();
      disposed = true;
      if (host.AudioContext === wrapper)
        safe(errors, "restore-constructor", () =>
          Object.defineProperty(host, "AudioContext", descriptor),
        );
      return {
        ok: errors.length === 0,
        disposed: true,
        errors,
        mainContextClosed: false,
        mainContextSuspended: false,
        mainMonitorChanged: false,
      };
    },
  });
  Object.defineProperty(host, key, { value: api, configurable: true });
  return { ok: true, installed: true, actualBlock: "UNKNOWN", provenance: details };
}

export function createHearingProbePreload(provenance = {}) {
  return `(${installHearingProbe.toString()})(${JSON.stringify({ workletSource: WORKLET_SOURCE, provenance })});`;
}
