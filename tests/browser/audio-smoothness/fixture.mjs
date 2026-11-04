/* global window, document, performance, requestAnimationFrame, PerformanceObserver, AudioNode, AudioDestinationNode, AudioWorkletNode, setTimeout */
// Measures how smoothly the real app renders audio while it simulates: the rendered
// destination signal (audio thread), audio pauses, engine counters and main-thread stalls.
import { LabRuntime } from "../../../src/app/runtime.ts";
import { mountReflectionLab } from "../../../src/app/bootstrap.ts";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nativeConnect = AudioNode.prototype.connect;
const buses = new WeakMap();
const output = { firstFrame: null, sampleRate: null, rms: [], peak: [] };
let capturing = false;

function tapBus(context) {
  let bus = buses.get(context);
  if (bus) return bus;
  bus = context.createGain();
  buses.set(context, bus);
  const url = new URL("./tap-processor.js", import.meta.url).href;
  void context.audioWorklet.addModule(url).then(() => {
    const tap = new AudioWorkletNode(context, "rendered-output-tap", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    const silent = context.createGain();
    silent.gain.value = 0;
    nativeConnect.call(bus, tap);
    nativeConnect.call(tap, silent);
    nativeConnect.call(silent, context.destination);
    tap.port.onmessage = ({ data }) => {
      if (!capturing) return;
      output.firstFrame ??= data.firstFrame;
      output.sampleRate = data.sampleRate;
      output.rms.push(...data.rms);
      output.peak.push(...data.peak);
    };
  });
  return bus;
}

// Count graph churn: node creation and convolver kernel swaps during the measured window.
const churn = {};
for (const method of [
  "createConvolver",
  "createPanner",
  "createBufferSource",
  "createDelay",
  "createGain",
]) {
  const native = window.BaseAudioContext.prototype[method];
  window.BaseAudioContext.prototype[method] = function (...args) {
    if (capturing) churn[method] = (churn[method] ?? 0) + 1;
    return native.apply(this, args);
  };
}
for (const method of [
  "setValueAtTime",
  "linearRampToValueAtTime",
  "setTargetAtTime",
  "cancelScheduledValues",
  "cancelAndHoldAtTime",
]) {
  const native = window.AudioParam.prototype[method];
  if (typeof native !== "function") continue;
  window.AudioParam.prototype[method] = function (...args) {
    if (capturing) churn[`param.${method}`] = (churn[`param.${method}`] ?? 0) + 1;
    return native.apply(this, args);
  };
}
const bufferDescriptor = Object.getOwnPropertyDescriptor(window.ConvolverNode.prototype, "buffer");
Object.defineProperty(window.ConvolverNode.prototype, "buffer", {
  ...bufferDescriptor,
  set(value) {
    if (capturing) churn.convolverBufferSets = (churn.convolverBufferSets ?? 0) + 1;
    bufferDescriptor.set.call(this, value);
  },
});

// Every node the engine connects to the destination is also connected to the tap bus.
// ?tap=0 skips the AudioWorklet tap: a worklet can move rendering to a different
// thread, so underrun counts are compared with and without it.
const tapEnabled = new URLSearchParams(window.location.search).get("tap") !== "0";
if (tapEnabled)
  AudioNode.prototype.connect = function (destination, ...rest) {
    const result = nativeConnect.call(this, destination, ...rest);
    if (destination instanceof AudioDestinationNode) nativeConnect.call(this, tapBus(this.context));
    return result;
  };

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
const playback = (context) => {
  const stats = context?.playbackStats ?? context?.playoutStats;
  if (!stats) return null;
  const copy = {};
  for (const key in stats) if (typeof stats[key] !== "function") copy[key] = stats[key];
  return copy;
};

// Diagnostic variants: ?latency=playback|balanced|<seconds> overrides the context latency
// hint; ?render=none mounts the runtime and RAF loop without the React/WebGL renderer.
const query = new URLSearchParams(window.location.search);
const latencyOverride = query.get("latency");
if (latencyOverride) {
  const NativeContext = window.AudioContext;
  const hint = Number.isFinite(Number(latencyOverride)) ? Number(latencyOverride) : latencyOverride;
  window.AudioContext = class extends NativeContext {
    constructor(options = {}) {
      super({ ...options, latencyHint: hint });
    }
  };
}

let runtime = null;
async function mount() {
  runtime = await LabRuntime.create();
  await mountReflectionLab(document.getElementById("root"), {
    createRuntime: async () => runtime,
    ...(query.get("render") === "none" ? { render: () => ({ unmount() {} }) } : {}),
  });
  document.getElementById("enable-audio").onclick = () =>
    void runtime.dispatch({ type: "enableAudio" }).then(() => {
      // Diagnostic ?lookahead=0 shadows the engine scheduling lookahead (R21+) on this instance.
      if (query.get("lookahead") === "0" && runtime.audio)
        Object.defineProperty(runtime.audio, "lookahead", { get: () => 0 });
      window.__audioSmoothness.audioEnabled = runtime.audio?.context?.state === "running";
    });
}

async function walk(seconds, until) {
  const key = (code, pressed) => runtime.dispatch({ type: "inputKey", code, pressed });
  await runtime.dispatch({ type: "enterFPS" });
  await runtime.dispatch({ type: "setAlternativeInput", enabled: true });
  await runtime.dispatch({ type: "run" });
  let forward = true;
  while (performance.now() < until) {
    const code = forward ? "KeyW" : "KeyS";
    await key(code, true);
    for (let i = 0; i < 10 && performance.now() < until; i++) {
      await runtime.dispatch({ type: "inputLook", movementX: forward ? 30 : -30, movementY: 0 });
      await wait(200);
    }
    await key(code, false);
    forward = !forward;
  }
  void seconds;
}

async function run({ scenario = "editor", seconds = 30 } = {}) {
  const context = runtime.audio?.context;
  if (!context || context.state !== "running") throw new Error("AUDIO_NOT_RUNNING");
  const telemetry = [];
  const frameIntervals = [];
  const longTasks = [];
  const advances = [];
  const pauses = [];
  const engine = runtime.audio;
  // Diagnostic ?freezeListener=1: drop listener/panner re-automation after the first call
  // (only valid for a static listener) to isolate its cost on the audio thread.
  const originalUpdateListener = engine.updateListener.bind(engine);
  if (query.get("freezeListener") === "1") {
    let applied = false;
    engine.updateListener = (pose) => {
      if (applied) return;
      applied = true;
      originalUpdateListener(pose);
    };
  }
  const originalPause = engine.pause.bind(engine);
  engine.pause = (...args) => {
    pauses.push({ atMs: performance.now() - started, reason: runtime.getSnapshot().pauseReason });
    return originalPause(...args);
  };
  const originalAdvance = runtime.advance.bind(runtime);
  runtime.advance = (delta) => {
    const start = performance.now();
    try {
      return originalAdvance(delta);
    } finally {
      advances.push(performance.now() - start);
    }
  };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration);
  });
  observer.observe({ type: "longtask", buffered: false });
  const playbackBefore = playback(context);
  const tickBefore = runtime.world.tick;
  const capacity = [];
  const renderCapacity = context.renderCapacity;
  const onCapacity = (event) =>
    capacity.push({
      averageLoad: event.averageLoad,
      peakLoad: event.peakLoad,
      underrunRatio: event.underrunRatio,
    });
  if (renderCapacity) {
    renderCapacity.addEventListener("update", onCapacity);
    renderCapacity.start({ updateInterval: 1 });
  }
  for (const key of Object.keys(churn)) delete churn[key];
  output.rms.length = 0;
  output.peak.length = 0;
  output.firstFrame = null;
  capturing = true;
  const started = performance.now();
  const until = started + seconds * 1000;
  let last = started,
    framing = true;
  const frame = (now) => {
    frameIntervals.push(now - last);
    last = now;
    if (framing) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const sampler = setInterval(() => {
    const value = engine.getTelemetry();
    telemetry.push({
      atMs: performance.now() - started,
      lateEvents: value.lateEvents,
      droppedVoices: value.droppedVoices,
      droppedPaths: value.droppedPaths,
      staleFrames: value.staleFrames,
      activeVoices: value.activeVoices,
      activePaths: value.activePaths,
      simulation: runtime.getSnapshot().simulationState,
    });
  }, 500);
  if (scenario === "fps-walk") await walk(seconds, until);
  else {
    await runtime.dispatch({ type: "run" });
    while (performance.now() < until) await wait(100);
  }
  const simulatedSeconds = (runtime.world.tick - tickBefore) * runtime.world.fixedDtSeconds;
  framing = false;
  clearInterval(sampler);
  observer.disconnect();
  await wait(300);
  capturing = false;
  if (renderCapacity) {
    renderCapacity.stop();
    renderCapacity.removeEventListener("update", onCapacity);
  }
  engine.pause = originalPause;
  engine.updateListener = originalUpdateListener;
  runtime.advance = originalAdvance;
  const first = telemetry[0] ?? {},
    lastSample = telemetry.at(-1) ?? {};
  const delta = (key) => (lastSample[key] ?? 0) - (first[key] ?? 0);
  return {
    scenario,
    wallSeconds: (performance.now() - started) / 1000,
    simulatedSeconds,
    finalSimulationState: runtime.getSnapshot().simulationState,
    pauseReason: runtime.getSnapshot().pauseReason,
    audio: {
      sampleRate: context.sampleRate,
      baseLatencySeconds: context.baseLatency,
      outputLatencySeconds: context.outputLatency ?? null,
      contextState: context.state,
      pauseCalls: pauses,
      lateEventsDelta: delta("lateEvents"),
      droppedVoicesDelta: delta("droppedVoices"),
      droppedPathsDelta: delta("droppedPaths"),
      staleFramesDelta: delta("staleFrames"),
      playbackStatsBefore: playbackBefore,
      playbackStatsAfter: playback(context),
      renderCapacity: renderCapacity
        ? {
            samples: capacity,
            averageLoadMean: capacity.length
              ? capacity.reduce((sum, value) => sum + value.averageLoad, 0) / capacity.length
              : null,
            peakLoadMax: Math.max(0, ...capacity.map((value) => value.peakLoad)),
            underrunRatioMax: Math.max(0, ...capacity.map((value) => value.underrunRatio)),
          }
        : "NOT_AVAILABLE",
      graphChurn: { ...churn },
      maxActiveVoices: Math.max(0, ...telemetry.map((value) => value.activeVoices)),
      maxActivePaths: Math.max(0, ...telemetry.map((value) => value.activePaths)),
    },
    mainThread: {
      frames: frameIntervals.length,
      frameIntervalMs: {
        p50: percentile(frameIntervals, 50),
        p95: percentile(frameIntervals, 95),
        p99: percentile(frameIntervals, 99),
        max: Math.max(0, ...frameIntervals),
      },
      framesOver50ms: frameIntervals.filter((value) => value > 50).length,
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
      advanceMs: {
        p50: percentile(advances, 50),
        p95: percentile(advances, 95),
        max: Math.max(0, ...advances),
      },
    },
    telemetry,
    rendered: {
      firstFrame: output.firstFrame,
      sampleRate: output.sampleRate,
      quantumFrames: 128,
      rms: Array.from(output.rms),
      peak: Array.from(output.peak),
    },
  };
}

window.__audioSmoothness = { ready: false, audioEnabled: false, error: null, run };
mount().then(
  () => {
    window.__audioSmoothness.ready = true;
  },
  (error) => {
    window.__audioSmoothness.error = String(error?.stack ?? error);
  },
);
