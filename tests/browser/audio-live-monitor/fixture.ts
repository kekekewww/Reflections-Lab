import { AudioEngine } from "../../../src/audio/engine.js";
import type { AcousticFrame, VoiceInput } from "../../../src/audio/types.js";
import type {
  LiveMonitorMode as Mode,
  LiveAudioMonitorFrame as MonitorFrame,
} from "../../../src/audio/live-monitor.js";

const CASE_MS = 7000;
const CLEANUP_MS = 3000;
const FFT_SIZE = 2048;
const TONE_BIN = 16;
const SOURCE_AMPLITUDE = 0.5;
const LEVEL_TOLERANCE_DB = 0.05;
const FFT_TOLERANCE_DB = 0.3;

type MonitorApi = Pick<AudioEngine, "readLiveMonitor" | "releaseLiveMonitor">;
interface NodeRecord {
  node: AudioNode;
  id: number;
  kind: string;
  productTimeReads: number;
  productFrequencyReads: number;
  oracleTimeReads: number;
  oracleFrequencyReads: number;
  productTimeBuffers: Set<Float32Array>;
  productFrequencyBuffers: Set<Float32Array>;
}
interface Edge {
  source: AudioNode;
  destination: AudioNode | AudioParam;
  output: number;
  input: number;
}
interface Artifact {
  name: string;
  domain: "waveform" | "spectrumDbfs";
  data: number[];
  sampleRateHz: number;
  fftSize: number;
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function db(linear: number): number {
  return linear === 0 ? -Infinity : 20 * Math.log10(linear);
}
function nearDb(actual: number | null, expected: number, label: string): void {
  requireCondition(
    actual !== null && Number.isFinite(actual) && Math.abs(actual - expected) <= LEVEL_TOLERANCE_DB,
    `${label}: ${actual} != ${expected} (+/-${LEVEL_TOLERANCE_DB} dB)`,
  );
}
function measure(samples: Float32Array) {
  let peak = 0,
    squares = 0;
  for (const sample of samples) {
    requireCondition(Number.isFinite(sample), "NONFINITE_NATIVE_WAVEFORM");
    peak = Math.max(peak, Math.abs(sample));
    squares += sample * sample;
  }
  const rms = Math.sqrt(squares / samples.length);
  return { peakLinear: peak, rmsLinear: rms, peakDbfs: db(peak), rmsDbfs: db(rms) };
}
function blackmanDftDb(samples: Float32Array, bin: number): number {
  let real = 0,
    imaginary = 0;
  for (let n = 0; n < samples.length; n++) {
    const angle = (2 * Math.PI * n) / samples.length;
    const window = 0.42 - 0.5 * Math.cos(angle) + 0.08 * Math.cos(2 * angle);
    const phase = angle * bin;
    real += samples[n]! * window * Math.cos(phase);
    imaginary -= samples[n]! * window * Math.sin(phase);
  }
  return db(Math.hypot(real, imaginary) / samples.length);
}
function strongestBin(samples: Float32Array): number {
  let selected = -1,
    maximum = -Infinity;
  for (let bin = 0; bin < samples.length; bin++) {
    const value = samples[bin]!;
    requireCondition(Number.isFinite(value) || value === -Infinity, "INVALID_NATIVE_FFT_VALUE");
    if (value > maximum) {
      maximum = value;
      selected = bin;
    }
  }
  return selected;
}
async function bounded<T>(operation: Promise<T>, deadline: number, label: string): Promise<T> {
  const remaining = deadline - performance.now();
  if (remaining <= 0) {
    void operation.catch(() => undefined);
    throw new Error(`${label}_DEADLINE`);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_DEADLINE`)), remaining);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
function metadata(frame: MonitorFrame) {
  return {
    state: frame.state,
    sampleRateHz: frame.sampleRateHz,
    fftSize: frame.fftSize,
    displayInput: frame.displayInput ?? null,
    frequencyBinHz: frame.frequencyBinHz ?? null,
    analyserNodeCount: frame.analyserNodeCount,
    tapNodeCount: frame.tapNodeCount,
    sourceTrackLimit: frame.sourceTrackLimit,
    sampledSourceVoices: frame.sampledSourceVoices,
    warmingSourceVoices: frame.warmingSourceVoices,
    unmeasuredVirtualVoices: frame.unmeasuredVirtualVoices,
    unmeasuredPendingVoices: frame.unmeasuredPendingVoices,
    unmeasuredNativeVoices: frame.unmeasuredNativeVoices,
    sampledAtAudioTimeSeconds: frame.sampledAtAudioTimeSeconds,
    tracks: frame.tracks.map((track) => ({ ...track })),
  };
}
function acousticFrame(): AcousticFrame {
  return {
    schemaVersion: "1.0.0",
    requestId: "native-monitor-tone",
    sceneRevision: 1,
    geometryRevision: 1,
    poseTick: 1,
    backendId: "native-monitor-component",
    backendVersion: "1",
    sourceId: "monitor-tone",
    listenerId: "listener",
    bandCentersHz: [1000],
    gainQuantity: "pressureRatio",
    capabilities: [],
    modelClass: "numericalApproximation",
    directDelayS: 0,
    paths: [],
    pathAvailability: "available",
    impulseResponseArtifactId: null,
    stale: false,
    limitations: ["RAW_NATIVE_MONITOR_COMPONENT_NOT_ROOM_ACOUSTICS_OR_HEARING"],
  };
}

async function runNativeMonitor() {
  const started = performance.now(),
    deadline = started + CASE_MS;
  const activationAtEntry = navigator.userActivation?.isActive ?? null;
  const records: NodeRecord[] = [],
    edges: Edge[] = [],
    sources: AudioScheduledSourceNode[] = [];
  const artifacts: Artifact[] = [],
    blockedDestinationAttempts: unknown[] = [];
  let context: AudioContext | null = null,
    engine: AudioEngine | null = null;
  let monitor: MonitorApi | null = null,
    finalMaster: AudioNode | null = null;
  let blockDestination = false,
    oracleRead = false,
    successfulSourceStarts = 0;
  let mainError: string | null = null,
    cleanupError: string | null = null;
  let mainComplete = false,
    cleanupComplete = false;
  let qualification: unknown = null,
    loud: unknown = null,
    muted: unknown = null;
  let released: unknown = null,
    cleanup: unknown = null;
  let actualSampleRate: number | null = null,
    actualQuantumFrames: number | null = null;
  const prototype = AudioNode.prototype;
  const connectDescriptor = Object.getOwnPropertyDescriptor(prototype, "connect");
  const disconnectDescriptor = Object.getOwnPropertyDescriptor(prototype, "disconnect");
  const nativeConnect = connectDescriptor?.value as ((...args: unknown[]) => unknown) | undefined;
  const nativeDisconnect = disconnectDescriptor?.value as
    | ((...args: unknown[]) => unknown)
    | undefined;
  function recordFor(node: AudioNode): NodeRecord | undefined {
    return records.find((record) => record.node === node);
  }
  function label(node: AudioNode | AudioParam): string {
    if (context && node === context.destination) return "owned-destination";
    const record = records.find((item) => item.node === node);
    return record ? `${record.kind}:${record.id}` : "audio-param-or-unobserved-node";
  }
  function pathTo(from: AudioNode, target: AudioNode): Edge[] | null {
    const visited = new Set<AudioNode>();
    function walk(node: AudioNode, path: Edge[]): Edge[] | null {
      if (node === target) return path;
      if (visited.has(node)) return null;
      visited.add(node);
      for (const edge of edges)
        if (edge.source === node && edge.destination instanceof AudioNode) {
          const result = walk(edge.destination, [...path, edge]);
          if (result) return result;
        }
      return null;
    }
    return walk(from, []);
  }
  function audibleEdges(): Edge[] {
    return edges.filter((edge) => context && edge.destination === context.destination);
  }
  function reachableAnalysers(): number {
    const roots = [...sources, ...(finalMaster ? [finalMaster] : [])];
    return records.filter(
      (record) =>
        record.kind === "createAnalyser" &&
        roots.some((root) => pathTo(root, record.node) !== null),
    ).length;
  }
  function observe(node: AudioNode, kind: string): AudioNode {
    requireCondition(records.length < 128, "NATIVE_NODE_OBSERVATION_BUDGET");
    const record: NodeRecord = {
      node,
      kind,
      id: records.length + 1,
      productTimeReads: 0,
      productFrequencyReads: 0,
      oracleTimeReads: 0,
      oracleFrequencyReads: 0,
      productTimeBuffers: new Set(),
      productFrequencyBuffers: new Set(),
    };
    records.push(record);
    if (kind === "createAnalyser") {
      const analyser = node as AnalyserNode;
      for (const method of ["getFloatTimeDomainData", "getFloatFrequencyData"] as const) {
        const native = analyser[method];
        Object.defineProperty(analyser, method, {
          configurable: true,
          writable: true,
          value: function (this: AnalyserNode, buffer: Float32Array) {
            if (oracleRead) {
              if (method === "getFloatTimeDomainData") record.oracleTimeReads++;
              else record.oracleFrequencyReads++;
            } else if (method === "getFloatTimeDomainData") {
              record.productTimeReads++;
              record.productTimeBuffers.add(buffer);
            } else {
              record.productFrequencyReads++;
              record.productFrequencyBuffers.add(buffer);
            }
            return Reflect.apply(native, this, [buffer]);
          },
        });
      }
    }
    if (kind === "createOscillator" || kind === "createBufferSource") {
      const scheduled = node as AudioScheduledSourceNode,
        start = scheduled.start;
      sources.push(scheduled);
      Object.defineProperty(scheduled, "start", {
        configurable: true,
        writable: true,
        value: function (this: AudioScheduledSourceNode, ...args: number[]) {
          const result = Reflect.apply(start, this, args);
          successfulSourceStarts++;
          return result;
        },
      });
    }
    return node;
  }
  let readSequence = 0;
  function readCounts() {
    return records.reduce(
      (sum, record) => ({
        product: sum.product + record.productTimeReads + record.productFrequencyReads,
        oracle: sum.oracle + record.oracleTimeReads + record.oracleFrequencyReads,
      }),
      { product: 0, oracle: 0 },
    );
  }
  function makeModeCost() {
    return {
      calls: 0,
      failedCalls: 0,
      minMs: null as number | null,
      maxMs: null as number | null,
      sumMs: 0,
      lastElapsedMs: null as number | null,
      lastStartedAtMs: null as number | null,
      lastEndedAtMs: null as number | null,
      nativeReadCalls: 0,
      coldGraphCreationCalls: 0,
      freshNativeSampleCalls: 0,
      cachedMeasuredCalls: 0,
      unmeasuredOrOtherCalls: 0,
      createdNativeNodes: 0,
      createdAnalyserNodes: 0,
    };
  }
  const modeCosts: Record<Mode, ReturnType<typeof makeModeCost>> = {
    levels: makeModeCost(),
    spectrum: makeModeCost(),
    waveform: makeModeCost(),
    load: makeModeCost(),
  };
  let lastObservedSampleAt: number | null = null;
  let lastFrameActiveNodes: { analyserNodeCount: number; tapNodeCount: number } | null = null;
  function readObserved(
    mode: Mode,
    input: "master-left" | "master-right" = "master-left",
  ): MonitorFrame | null {
    const stats = modeCosts[mode],
      nativeBefore = readCounts().product,
      nodesBefore = records.length;
    let frame: MonitorFrame | null = null,
      failed = true;
    const begin = performance.now();
    try {
      frame = monitor!.readLiveMonitor(mode, input);
      failed = false;
      return frame;
    } finally {
      const end = performance.now(),
        elapsed = end - begin;
      const nativeReads = readCounts().product - nativeBefore,
        created = records.length - nodesBefore;
      let analyserCreations = 0;
      for (let index = nodesBefore; index < records.length; index++) {
        if (records[index]!.kind === "createAnalyser") analyserCreations++;
      }
      stats.calls++;
      stats.failedCalls += Number(failed);
      stats.sumMs += elapsed;
      stats.minMs = stats.minMs === null ? elapsed : Math.min(stats.minMs, elapsed);
      stats.maxMs = stats.maxMs === null ? elapsed : Math.max(stats.maxMs, elapsed);
      stats.lastElapsedMs = elapsed;
      stats.lastStartedAtMs = begin;
      stats.lastEndedAtMs = end;
      stats.nativeReadCalls += nativeReads;
      stats.createdNativeNodes += created;
      stats.createdAnalyserNodes += analyserCreations;
      if (created > 0) stats.coldGraphCreationCalls++;
      else if (nativeReads > 0) stats.freshNativeSampleCalls++;
      else if (
        frame?.state === "active" &&
        frame.reason === null &&
        frame.sampledAtAudioTimeSeconds !== null &&
        frame.sampledAtAudioTimeSeconds === lastObservedSampleAt
      )
        stats.cachedMeasuredCalls++;
      else stats.unmeasuredOrOtherCalls++;
      if (frame) {
        lastObservedSampleAt = frame.sampledAtAudioTimeSeconds;
        lastFrameActiveNodes = {
          analyserNodeCount: frame.analyserNodeCount,
          tapNodeCount: frame.tapNodeCount,
        };
      }
    }
  }
  function beforeRead() {
    return {
      sequence: ++readSequence,
      audioTime: context!.currentTime,
      wallTimeMs: performance.now(),
      counts: readCounts(),
    };
  }
  async function waitFrame(
    mode: Mode,
    acceptable: (frame: MonitorFrame) => boolean,
    onAccepted?: (frame: MonitorFrame, before: ReturnType<typeof beforeRead>) => void,
  ): Promise<MonitorFrame> {
    for (let attempt = 0; attempt < 90; attempt++) {
      requireCondition(performance.now() < deadline, `MONITOR_${mode}_DEADLINE`);
      const before = beforeRead();
      const frame = readObserved(mode, "master-left");
      if (frame?.state === "error") throw new Error(`MONITOR_ERROR:${frame.reason ?? "unknown"}`);
      if (frame?.state === "active" && acceptable(frame)) {
        onAccepted?.(frame, before);
        return frame;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 75));
    }
    throw new Error(`MONITOR_${mode}_POLL_BUDGET`);
  }
  function save(name: string, domain: Artifact["domain"], values: Float32Array) {
    artifacts.push({
      name,
      domain,
      data: Array.from(values),
      sampleRateHz: actualSampleRate!,
      fftSize: FFT_SIZE,
    });
  }
  try {
    requireCondition(activationAtEntry === true, "TRUSTED_USER_ACTIVATION_REQUIRED");
    requireCondition(
      typeof nativeConnect === "function" && typeof nativeDisconnect === "function",
      "NATIVE_AUDIO_NODE_METHODS_UNAVAILABLE",
    );
    context = new AudioContext();
    const owned = context;
    Object.defineProperty(prototype, "connect", {
      ...connectDescriptor,
      value: function (this: AudioNode, ...args: unknown[]) {
        if (this.context !== owned) return Reflect.apply(nativeConnect, this, args);
        const destination = args[0] as AudioNode | AudioParam;
        if (destination === owned.destination && blockDestination) {
          blockedDestinationAttempts.push({ source: label(this), audioTime: owned.currentTime });
          throw new Error("FIXTURE_BLOCKED_AUDIBLE_DESTINATION_CONNECTION");
        }
        const result = Reflect.apply(nativeConnect, this, args);
        const output = typeof args[1] === "number" ? args[1] : 0;
        const input = typeof args[2] === "number" ? args[2] : 0;
        if (
          !edges.some(
            (edge) =>
              edge.source === this &&
              edge.destination === destination &&
              edge.output === output &&
              edge.input === input,
          )
        ) {
          requireCondition(edges.length < 256, "NATIVE_EDGE_OBSERVATION_BUDGET");
          edges.push({ source: this, destination, output, input });
        }
        return result;
      },
    });
    Object.defineProperty(prototype, "disconnect", {
      ...disconnectDescriptor,
      value: function (this: AudioNode, ...args: unknown[]) {
        const result = Reflect.apply(nativeDisconnect, this, args);
        if (this.context !== owned) return result;
        for (let i = edges.length - 1; i >= 0; i--) {
          const edge = edges[i]!;
          if (edge.source !== this) continue;
          const matches =
            args.length === 0 ||
            (typeof args[0] === "number"
              ? edge.output === args[0]
              : edge.destination === args[0] &&
                (args[1] === undefined || edge.output === args[1]) &&
                (args[2] === undefined || edge.input === args[2]));
          if (matches) edges.splice(i, 1);
        }
        return result;
      },
    });
    for (const factory of [
      "createGain",
      "createDynamicsCompressor",
      "createWaveShaper",
      "createAnalyser",
      "createChannelSplitter",
      "createChannelMerger",
      "createOscillator",
      "createBufferSource",
      "createConvolver",
      "createDelay",
      "createBiquadFilter",
      "createPanner",
    ] as const) {
      const native = owned[factory];
      Object.defineProperty(owned, factory, {
        configurable: true,
        writable: true,
        value: (...args: unknown[]) =>
          observe(Reflect.apply(native, owned, args) as AudioNode, factory),
      });
    }
    engine = new AudioEngine({
      context: owned,
      oscillatorModel: "nativeReference",
      virtualization: false,
      headroomGain: 1,
      monitorGain: 1,
      limiterEnabled: true,
      outputSafetyClip: true,
      diagnosticsEnabled: false,
    });
    monitor = engine;
    requireCondition(
      typeof monitor.readLiveMonitor === "function" &&
        typeof monitor.releaseLiveMonitor === "function",
      "LIVE_MONITOR_API_MISSING",
    );
    const initial = readObserved("levels");
    requireCondition(
      initial?.state !== "active" && records.every((record) => record.kind !== "createAnalyser"),
      "DISABLED_AUDIO_CREATED_ANALYSERS",
    );
    requireCondition(readObserved("load") === null, "LOAD_ONLY_MUST_NOT_CREATE_AUDIO_FRAME");
    const destinationEdges = audibleEdges();
    requireCondition(
      destinationEdges.length === 1,
      "EXPECTED_ONE_FINAL_MASTER_DESTINATION_EDGE_BEFORE_TONE",
    );
    finalMaster = destinationEdges[0]!.source;
    requireCondition(
      recordFor(finalMaster)?.kind === "createWaveShaper",
      "EXPECTED_POST_LIMITER_SAFETY_MASTER_POINT",
    );
    finalMaster.disconnect(owned.destination);
    blockDestination = true;
    requireCondition(audibleEdges().length === 0, "AUDIBLE_DESTINATION_EDGE_REMAINS");
    await bounded(engine.enable(0), deadline, "ENABLE");
    // The engine starts muted. Its device edge is already removed and guarded;
    // unmute the existing master only for this digital loud/zero comparison.
    engine.setMuted(false);
    actualSampleRate = owned.sampleRate;
    const observedQuantum = (owned as AudioContext & { renderQuantumSize?: number })
      .renderQuantumSize;
    actualQuantumFrames =
      typeof observedQuantum === "number" &&
      Number.isSafeInteger(observedQuantum) &&
      observedQuantum > 0
        ? observedQuantum
        : null;
    requireCondition(
      Number.isFinite(actualSampleRate) &&
        actualSampleRate > 0 &&
        String(owned.state) === "running",
      "NATIVE_CONTEXT_NOT_RUNNING",
    );
    const frequencyHz = (actualSampleRate / FFT_SIZE) * TONE_BIN;
    engine.setMonitorMode("raw");
    const input: VoiceInput = {
      instanceId: "monitor-tone-instance",
      sourceId: "monitor-tone",
      generator: { kind: "oscillator", waveform: "sine", frequencyHz },
      gainLinear: SOURCE_AMPLITUDE,
      pitchSemitones: 0,
      emissionTimeSeconds: 0,
      continuous: true,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
    };
    requireCondition(engine.playVoice(input, acousticFrame()).accepted, "TONE_ADMISSION_REJECTED");
    requireCondition(
      sources.length === 1 && successfulSourceStarts === 1,
      "EXPECTED_ONE_NATIVE_TONE_SOURCE",
    );
    qualification = {
      actualSampleRate,
      actualQuantumFrames,
      quantumStatus: actualQuantumFrames === null ? "NOT_AVAILABLE" : "AVAILABLE",
      frequencyHz,
      fftSize: FFT_SIZE,
      toneBin: TONE_BIN,
      destinationEdgeRemovedBeforeStart: true,
      measuredPoint: label(finalMaster),
      audibleEdges: audibleEdges().length,
    };
    const levels = await waitFrame(
      "levels",
      (frame) =>
        frame.tracks.filter((track) => track.kind === "output").length === 2 &&
        frame.tracks.some((track) => track.kind === "source" && track.rmsDbfs !== null),
    );
    const sourceTrack = levels.tracks.find(
      (track) => track.kind === "source" && track.id === input.instanceId,
    );
    requireCondition(
      sourceTrack !== undefined && sourceTrack.point === "contentPrePropagation",
      "STABLE_NATIVE_SOURCE_TRACK_MISSING",
    );
    const sourceTrackSnapshot = { ...sourceTrack };
    const sourceAnalysers = records.filter(
      (record) => record.kind === "createAnalyser" && pathTo(finalMaster!, record.node) === null,
    );
    requireCondition(sourceAnalysers.length === 1, "EXPECTED_ONE_NATIVE_SOURCE_CONTENT_ANALYSER");
    const sourceRecord = sourceAnalysers[0]!,
      sourceAnalyser = sourceRecord.node as AnalyserNode;
    requireCondition(
      sourceRecord.productTimeBuffers.size === 1 && sourceAnalyser.fftSize === 1024,
      "SOURCE_NATIVE_WINDOW_CONFIGURATION_MISMATCH",
    );
    const productSource = new Float32Array([...sourceRecord.productTimeBuffers][0]!);
    const independentSource = new Float32Array(1024);
    oracleRead = true;
    try {
      sourceAnalyser.getFloatTimeDomainData(independentSource);
    } finally {
      oracleRead = false;
    }
    artifacts.push({
      name: "loud-product-source-waveform",
      domain: "waveform",
      data: Array.from(productSource),
      sampleRateHz: actualSampleRate,
      fftSize: 1024,
    });
    artifacts.push({
      name: "loud-independent-source-waveform",
      domain: "waveform",
      data: Array.from(independentSource),
      sampleRateHz: actualSampleRate,
      fftSize: 1024,
    });
    const sourceMeasure = measure(independentSource);
    nearDb(sourceMeasure.peakDbfs, db(SOURCE_AMPLITUDE), "independent native source peak");
    nearDb(
      sourceMeasure.rmsDbfs,
      db(SOURCE_AMPLITUDE / Math.sqrt(2)),
      "independent native source RMS",
    );
    nearDb(sourceTrackSnapshot.peakDbfs, db(SOURCE_AMPLITUDE), "source pre-propagation peak");
    nearDb(
      sourceTrackSnapshot.rmsDbfs,
      db(SOURCE_AMPLITUDE / Math.sqrt(2)),
      "source pre-propagation RMS",
    );
    const waveformFrame = await waitFrame(
      "waveform",
      (frame) => frame.waveform !== null && frame.waveform.length === FFT_SIZE,
    );
    const waveformBuffer = waveformFrame.waveform!;
    // Earlier waveform reads qualify buffer identity only, never a later oracle window.
    await new Promise<void>((resolve) => setTimeout(resolve, 75));
    const reusedWaveform = readObserved("waveform", "master-left");
    requireCondition(
      reusedWaveform?.waveform === waveformBuffer,
      "PRODUCT_WAVEFORM_BUFFER_NOT_REUSED",
    );
    const priorSampledAt = reusedWaveform.sampledAtAudioTimeSeconds;
    requireCondition(priorSampledAt !== null, "NATIVE_MASTER_SAMPLE_TIME_MISSING");
    const masterAnalysers = records.filter(
      (record) => record.kind === "createAnalyser" && pathTo(finalMaster!, record.node) !== null,
    );
    requireCondition(masterAnalysers.length === 2, "EXPECTED_TRUE_SPLIT_MASTER_L_R_ANALYSERS");
    function channelRecord(channel: number): NodeRecord {
      const record = masterAnalysers.find((item) =>
        pathTo(finalMaster!, item.node)?.some(
          (edge) =>
            recordFor(edge.source)?.kind === "createChannelSplitter" && edge.output === channel,
        ),
      );
      requireCondition(record !== undefined, `MASTER_CHANNEL_${channel}_MISSING`);
      return record;
    }
    const left = channelRecord(0),
      right = channelRecord(1);
    for (const record of [left, right]) {
      const analyser = record.node as AnalyserNode;
      requireCondition(
        analyser.fftSize === FFT_SIZE && analyser.smoothingTimeConstant === 0,
        "NATIVE_FFT_CONFIGURATION_MISMATCH",
      );
      requireCondition(
        pathTo(finalMaster, record.node)!.some(
          (edge) =>
            recordFor(edge.destination as AudioNode)?.kind === "createGain" &&
            (edge.destination as GainNode).channelCount === 2 &&
            (edge.destination as GainNode).channelCountMode === "explicit" &&
            (edge.destination as GainNode).channelInterpretation === "speakers",
        ),
        "MASTER_STEREO_SPEAKER_MAPPING_MISSING",
      );
    }
    const waveform = new Float32Array(FFT_SIZE),
      spectrum = new Float32Array(FFT_SIZE / 2);
    const independentLeft = new Float32Array(FFT_SIZE),
      independentRight = new Float32Array(FFT_SIZE);
    const independentSpectrum = new Float32Array(FFT_SIZE / 2);
    const capture: {
      spectrumFrame: ReturnType<typeof metadata> | null;
      waveformFrame: ReturnType<typeof metadata> | null;
      spectrumBuffer: Float32Array | null;
      waveformBuffer: Float32Array | null;
      sampledAt: number | null;
      before: ReturnType<typeof beforeRead> | null;
      after: {
        audioTime: number;
        wallTimeMs: number;
        counts: ReturnType<typeof readCounts>;
      } | null;
      countsAfterSpectrum: ReturnType<typeof readCounts> | null;
      countsAfterCache: ReturnType<typeof readCounts> | null;
      cacheSpectrumSequence: number;
      cacheWaveformSequence: number;
      sameSpectrumBuffer: boolean;
    } = {
      spectrumFrame: null,
      waveformFrame: null,
      spectrumBuffer: null,
      waveformBuffer: null,
      sampledAt: null,
      before: null,
      after: null,
      countsAfterSpectrum: null,
      countsAfterCache: null,
      cacheSpectrumSequence: 0,
      cacheWaveformSequence: 0,
      sameSpectrumBuffer: false,
    };
    await waitFrame(
      "spectrum",
      (frame) =>
        frame.spectrumDbfs !== null &&
        frame.spectrumDbfs.length === FFT_SIZE / 2 &&
        frame.sampledAtAudioTimeSeconds !== null &&
        frame.sampledAtAudioTimeSeconds > priorSampledAt,
      (frame, before) => {
        // This callback runs synchronously in waitFrame, before its Promise can yield.
        // Copy the borrowed frame before another mode clears its spectrum field.
        capture.before = before;
        capture.sampledAt = frame.sampledAtAudioTimeSeconds;
        capture.spectrumFrame = metadata(frame);
        capture.spectrumBuffer = frame.spectrumDbfs!;
        spectrum.set(frame.spectrumDbfs!);
        capture.countsAfterSpectrum = readCounts();
        capture.cacheSpectrumSequence = ++readSequence;
        const cachedSpectrum = readObserved("spectrum", "master-left");
        capture.sameSpectrumBuffer = cachedSpectrum?.spectrumDbfs === capture.spectrumBuffer;
        capture.cacheWaveformSequence = ++readSequence;
        const cachedWaveform = readObserved("waveform", "master-left");
        requireCondition(
          cachedWaveform?.waveform !== null && cachedWaveform?.waveform !== undefined,
          "SAME_SAMPLE_WAVEFORM_MISSING",
        );
        capture.waveformFrame = metadata(cachedWaveform);
        capture.waveformBuffer = cachedWaveform.waveform;
        waveform.set(cachedWaveform.waveform);
        capture.countsAfterCache = readCounts();
        oracleRead = true;
        try {
          (left.node as AnalyserNode).getFloatTimeDomainData(independentLeft);
          (right.node as AnalyserNode).getFloatTimeDomainData(independentRight);
          (left.node as AnalyserNode).getFloatFrequencyData(independentSpectrum);
        } finally {
          oracleRead = false;
        }
        capture.after = {
          audioTime: owned.currentTime,
          wallTimeMs: performance.now(),
          counts: readCounts(),
        };
      },
    );
    // Preserve every acquired master raw window and clock record before qualification.
    save("loud-product-waveform", "waveform", waveform);
    save("loud-product-spectrum", "spectrumDbfs", spectrum);
    save("loud-independent-left-waveform", "waveform", independentLeft);
    save("loud-independent-right-waveform", "waveform", independentRight);
    save("loud-independent-spectrum", "spectrumDbfs", independentSpectrum);
    const loudEvidence = {
      frame: capture.spectrumFrame,
      waveformFrame: capture.waveformFrame,
      sourceTrack: sourceTrackSnapshot,
      readBracket: {
        model: "observedRenderClock;notHardwarePcmPointer",
        attempts: 1,
        numericRetries: 0,
        timingRetries: 0,
        priorSampledAt,
        sampledAt: capture.sampledAt,
        before: capture.before,
        after: capture.after,
        countsAfterSpectrum: capture.countsAfterSpectrum,
        countsAfterCache: capture.countsAfterCache,
        cacheSpectrumSequence: capture.cacheSpectrumSequence,
        cacheWaveformSequence: capture.cacheWaveformSequence,
      },
      independentLeft: null as ReturnType<typeof measure> | null,
      independentRight: null as ReturnType<typeof measure> | null,
      independentlyComputedBlackmanBinDbfs: null as number | null,
      productBinDbfs: spectrum[TONE_BIN],
      nativeOracleBinDbfs: independentSpectrum[TONE_BIN],
      strongestBin: null as number | null,
      measuredMasterPeakGainRatioToSource: null as number | null,
      sourcePeakOracleDbfs: db(SOURCE_AMPLITUDE),
      sourceRmsOracleDbfs: db(SOURCE_AMPLITUDE / Math.sqrt(2)),
      originalLimiterAndSafetyRetained: true,
      waveformBufferReused: true,
      spectrumCacheReused: capture.sameSpectrumBuffer,
      masterPaths: [left, right].map((record) =>
        pathTo(finalMaster!, record.node)!.map((edge) => ({
          source: label(edge.source),
          destination: label(edge.destination),
          output: edge.output,
          input: edge.input,
        })),
      ),
    };
    loud = loudEvidence;
    requireCondition(
      capture.before !== null &&
        capture.after !== null &&
        capture.spectrumFrame !== null &&
        capture.waveformFrame !== null &&
        capture.countsAfterSpectrum !== null &&
        capture.countsAfterCache !== null,
      "MASTER_CAPTURE_INCOMPLETE",
    );
    requireCondition(
      capture.sampledAt === capture.before.audioTime &&
        capture.after.audioTime === capture.before.audioTime,
      "MASTER_CAPTURE_RENDER_CLOCK_CROSSED",
    );
    requireCondition(
      capture.waveformFrame.sampledAtAudioTimeSeconds === capture.sampledAt &&
        capture.countsAfterCache.product === capture.countsAfterSpectrum.product &&
        capture.sameSpectrumBuffer,
      "FIFTEEN_HZ_CACHE_DID_NOT_PRESERVE_SAME_SAMPLE",
    );
    requireCondition(
      capture.spectrumFrame.sampleRateHz === actualSampleRate &&
        capture.waveformFrame.sampleRateHz === actualSampleRate &&
        capture.spectrumFrame.fftSize === FFT_SIZE &&
        capture.waveformFrame.fftSize === FFT_SIZE,
      "PRODUCT_SAMPLE_RATE_OR_FFT_SIZE_MISMATCH",
    );
    requireCondition(
      capture.waveformBuffer === waveformBuffer &&
        left.productTimeBuffers.has(waveformBuffer) &&
        capture.spectrumBuffer !== null &&
        left.productFrequencyBuffers.has(capture.spectrumBuffer),
      "PRODUCT_BUFFERS_WERE_NOT_FILLED_BY_REAL_MASTER_ANALYSER",
    );
    const l = measure(independentLeft),
      r = measure(independentRight),
      reportedWave = measure(waveform);
    const dftDb = blackmanDftDb(independentLeft, TONE_BIN),
      maximumBin = strongestBin(spectrum);
    Object.assign(loudEvidence, {
      independentLeft: l,
      independentRight: r,
      independentlyComputedBlackmanBinDbfs: dftDb,
      strongestBin: maximumBin,
      measuredMasterPeakGainRatioToSource: l.peakLinear / SOURCE_AMPLITUDE,
    });
    requireCondition(
      l.peakLinear > 0 && l.peakLinear < 1 && r.peakLinear > 0 && r.peakLinear < 1,
      "REAL_MASTER_SIGNAL_MISSING_OR_UNSAFE",
    );
    for (const [id, expected] of [
      ["@master/L", l],
      ["@master/R", r],
    ] as const) {
      const track = capture.spectrumFrame.tracks.find(
        (item) => item.id === id && item.kind === "output",
      );
      requireCondition(
        track !== undefined && track.point === "postLimiterAndMute",
        `STABLE_MASTER_TRACK_MISSING:${id}`,
      );
      nearDb(track.peakDbfs, expected.peakDbfs, `${id} peak`);
      nearDb(track.rmsDbfs, expected.rmsDbfs, `${id} RMS`);
    }
    nearDb(reportedWave.peakDbfs, l.peakDbfs, "product raw waveform peak");
    nearDb(reportedWave.rmsDbfs, l.rmsDbfs, "product raw waveform RMS");
    requireCondition(
      maximumBin === TONE_BIN && strongestBin(independentSpectrum) === TONE_BIN,
      "NATIVE_FFT_TONE_BIN_MISMATCH",
    );
    requireCondition(
      Math.abs(spectrum[TONE_BIN]! - dftDb) <= FFT_TOLERANCE_DB &&
        Math.abs(independentSpectrum[TONE_BIN]! - dftDb) <= FFT_TOLERANCE_DB,
      "NATIVE_FFT_DOES_NOT_MATCH_INDEPENDENT_BLACKMAN_DFT",
    );
    engine.setMuted(true);
    const mutedAt = owned.currentTime;
    while (owned.currentTime - mutedAt < 0.2) {
      requireCondition(performance.now() < deadline, "MUTE_SETTLE_DEADLINE");
      await new Promise<void>((resolve) => setTimeout(resolve, 75));
    }
    const zeroWaveFrame = await waitFrame(
      "waveform",
      (frame) =>
        frame.waveform !== null &&
        frame.tracks
          .filter((track) => track.kind === "output")
          .every((track) => track.peakDbfs === -Infinity && track.rmsDbfs === -Infinity),
    );
    const zeroWave = new Float32Array(zeroWaveFrame.waveform!);
    requireCondition(
      zeroWave.every((value) => value === 0),
      "MUTED_MASTER_WAVEFORM_NOT_TRUE_ZERO",
    );
    const zeroSpectrumFrame = await waitFrame("spectrum", (frame) => frame.spectrumDbfs !== null);
    const zeroSpectrum = new Float32Array(zeroSpectrumFrame.spectrumDbfs!);
    requireCondition(
      zeroSpectrum.every((value) => value === -Infinity),
      "MUTED_NATIVE_FFT_NOT_TRUE_NEGATIVE_INFINITY",
    );
    const zeroLevels = await waitFrame("levels", (frame) =>
      frame.tracks.some((track) => track.kind === "source" && track.rmsDbfs !== null),
    );
    const stillSource = zeroLevels.tracks.find(
      (track) => track.kind === "source" && track.id === input.instanceId,
    )!;
    nearDb(
      stillSource.peakDbfs,
      db(SOURCE_AMPLITUDE),
      "muted master still measures source pre-propagation peak",
    );
    nearDb(
      stillSource.rmsDbfs,
      db(SOURCE_AMPLITUDE / Math.sqrt(2)),
      "muted master still measures source pre-propagation RMS",
    );
    save("muted-product-waveform", "waveform", zeroWave);
    save("muted-product-spectrum", "spectrumDbfs", zeroSpectrum);
    muted = {
      frame: metadata(zeroLevels),
      trueZeroWaveform: true,
      trueNegativeInfinitySpectrum: true,
      actualAudioTime: owned.currentTime,
      elapsedAudioAfterMute: owned.currentTime - mutedAt,
    };
    const nativeCountBeforeRelease = engine.getNativeResourceSnapshot().nativeSourceNodes;
    const analyserCreations = records.filter((record) => record.kind === "createAnalyser").length;
    monitor.releaseLiveMonitor();
    monitor.releaseLiveMonitor();
    requireCondition(reachableAnalysers() === 0, "RELEASE_RETAINED_CONNECTED_NATIVE_ANALYSERS");
    requireCondition(
      readObserved("load") === null &&
        records.filter((record) => record.kind === "createAnalyser").length === analyserCreations,
      "LOAD_ONLY_CREATED_NATIVE_ANALYSERS",
    );
    requireCondition(
      engine.getNativeResourceSnapshot().nativeSourceNodes === nativeCountBeforeRelease &&
        sources.length === 1 &&
        successfulSourceStarts === 1,
      "MONITORING_CHANGED_NATIVE_SOURCE_OWNERSHIP",
    );
    requireCondition(
      audibleEdges().length === 0 && blockedDestinationAttempts.length === 0,
      "AUDIBLE_DESTINATION_GUARD_FAILED",
    );
    requireCondition(
      records
        .filter((record) => record.kind === "createAnalyser")
        .every(
          (record) =>
            record.productTimeBuffers.size <= 1 && record.productFrequencyBuffers.size <= 1,
        ),
      "PRODUCT_ANALYSER_BUFFERS_NOT_BOUNDED_AND_REUSED",
    );
    released = {
      connectedAnalysers: reachableAnalysers(),
      nativeSourceNodes: nativeCountBeforeRelease,
      analyserCreations,
      successfulSourceStarts,
      audibleDestinationEdges: audibleEdges().length,
    };
    mainComplete = true;
  } catch (error) {
    mainError = String(error);
  } finally {
    const cleanupDeadline = performance.now() + CLEANUP_MS;
    try {
      const results = await Promise.allSettled([
        bounded(
          Promise.resolve().then(() => monitor?.releaseLiveMonitor()),
          cleanupDeadline,
          "MONITOR_RELEASE",
        ),
        bounded(
          Promise.resolve().then(() => engine?.disposeAsync()),
          cleanupDeadline,
          "ENGINE_DISPOSE",
        ),
        bounded(
          Promise.resolve().then(() =>
            context && context.state !== "closed" ? context.close() : undefined,
          ),
          cleanupDeadline,
          "OWNED_CONTEXT_CLOSE",
        ),
      ]);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      requireCondition(
        context === null || String(context.state) === "closed",
        "OWNED_NATIVE_CONTEXT_NOT_CLOSED",
      );
      requireCondition(
        engine === null || engine.getNativeResourceSnapshot().nativeSourceNodes === 0,
        "ENGINE_RETAINED_NATIVE_SOURCES",
      );
      requireCondition(
        sources.every((source) => source.onended === null),
        "NATIVE_SOURCE_CALLBACK_RETAINED",
      );
      requireCondition(
        reachableAnalysers() === 0 && audibleEdges().length === 0,
        "NATIVE_MONITOR_EDGES_RETAINED",
      );
      cleanup = {
        contextState: context?.state ?? "not-created",
        nativeSourceNodes: engine?.getNativeResourceSnapshot().nativeSourceNodes ?? 0,
        connectedAnalysers: reachableAnalysers(),
        callbacksCleared: sources.every((source) => source.onended === null),
        audibleEdges: audibleEdges().length,
      };
      cleanupComplete = true;
    } catch (error) {
      cleanupError = String(error);
      cleanup = {
        contextState: context?.state ?? "not-created",
        connectedAnalysers: reachableAnalysers(),
        audibleEdges: audibleEdges().length,
      };
    } finally {
      if (connectDescriptor) Object.defineProperty(prototype, "connect", connectDescriptor);
      if (disconnectDescriptor)
        Object.defineProperty(prototype, "disconnect", disconnectDescriptor);
    }
  }
  return {
    status: mainComplete && cleanupComplete ? "PASS" : "FAIL",
    passed: mainComplete && cleanupComplete,
    id: "native-live-monitor-tone-and-zero",
    method: "trusted-click;native-AnalyserNode;independent-raw-Blackman-DFT;device-edge-removed",
    scope:
      "live digital monitor values and ownership only; no CPU, calibrated SPL, exact phase, hearing or Computer Use claim",
    primaryReferences: [
      "https://www.w3.org/TR/2021/REC-webaudio-20210617/#AnalyserNode",
      "https://www.w3.org/TR/2021/REC-webaudio-20210617/#fft-windowing-and-smoothing-over-time",
      "https://www.w3.org/TR/2021/REC-webaudio-20210617/#computing-the-makeup-gain",
    ],
    mainError,
    cleanupError,
    mainComplete,
    cleanupComplete,
    activationAtEntry,
    caseDeadlineMs: CASE_MS,
    cleanupDeadlineMs: CLEANUP_MS,
    elapsedMs: performance.now() - started,
    actualSampleRate,
    actualQuantumFrames,
    qualification,
    tolerances: { levelDb: LEVEL_TOLERANCE_DB, fftDb: FFT_TOLERANCE_DB },
    loud,
    muted,
    released,
    cleanup,
    blockedDestinationAttempts,
    observationCost: {
      provenance:
        "performance.now synchronous UI-main-thread readLiveMonitor elapsed; instrumented component fixture",
      interpretation:
        "Inclusive API elapsed includes its native-read observer hooks; excludes statistic aggregation, polling waits, independent oracle and UI drawing; not DSP time or whole/process CPU",
      clock: "performance.now milliseconds",
      performanceTimeOriginMs: performance.timeOrigin,
      modeClassification:
        "creation first; otherwise observed native reads; otherwise unchanged measured sample time with no warmup; all remaining calls other",
      perReadLog: false,
      modeCosts,
      nativeNodeOwnership: {
        createdDuringReadApi: Object.values(modeCosts).reduce(
          (sum, mode) => sum + mode.createdNativeNodes,
          0,
        ),
        analysersCreatedDuringReadApi: Object.values(modeCosts).reduce(
          (sum, mode) => sum + mode.createdAnalyserNodes,
          0,
        ),
        lastReturnedFrameActiveNodes: lastFrameActiveNodes,
        reachableAnalysersAfterCleanup: reachableAnalysers(),
        countsMeaning:
          "Creation counts are cumulative actual factory calls; frame counts are currently owned nodes at that returned frame, not an additional creation count",
      },
    },
    nodeObservations: records.map((record) => ({
      id: record.id,
      kind: record.kind,
      productTimeReads: record.productTimeReads,
      productFrequencyReads: record.productFrequencyReads,
      oracleTimeReads: record.oracleTimeReads,
      oracleFrequencyReads: record.oracleFrequencyReads,
      productTimeBufferCount: record.productTimeBuffers.size,
      productFrequencyBufferCount: record.productFrequencyBuffers.size,
    })),
    successfulSourceStarts,
    artifacts,
  };
}

const button = document.querySelector<HTMLButtonElement>("#run-live-monitor");
if (!button) throw new Error("LIVE_MONITOR_BUTTON_MISSING");
button.addEventListener(
  "click",
  () => {
    button.disabled = true;
    (window as unknown as { __audioLiveMonitor: Promise<unknown> }).__audioLiveMonitor =
      runNativeMonitor();
  },
  { once: true },
);
