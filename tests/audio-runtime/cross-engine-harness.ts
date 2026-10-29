/** Browser-only adapter: original suites run against actual native contexts, without a product App. */
export interface CrossEngineSuite {
  id: string;
  module: string;
  exportName: string;
}
interface SerializedError {
  name: string;
  message: string;
  stack: string | null;
  code: string | number | null;
}
interface NativeOperation {
  method: string;
  context: string;
  status: string;
  time: number;
  endTime?: number;
  error?: SerializedError;
  wave?: { format: number; channels: number; sampleRate: number; bits: number };
}
interface ObservedContext {
  context: BaseAudioContext;
  kind: string;
  resumePending: boolean;
}
const operations: NativeOperation[] = [],
  contexts: ObservedContext[] = [],
  instrumentationWarnings: string[] = [];
const observedMethods = new WeakMap<object, Set<string>>();
let pending: Promise<{ value?: unknown; error?: SerializedError }> | null = null;
function serialized(error: unknown): SerializedError {
  const value = error as {
    name?: string;
    message?: string;
    stack?: string;
    code?: string | number;
  };
  return {
    name: value?.name ?? "Error",
    message: value?.message ?? String(error),
    stack: value?.stack ?? null,
    code: value?.code ?? null,
  };
}
export function nativeCapabilities() {
  const offline = globalThis.OfflineAudioContext?.prototype,
    live = globalThis.AudioContext?.prototype;
  return {
    offlineAudioContext: typeof globalThis.OfflineAudioContext === "function",
    audioContext: typeof globalThis.AudioContext === "function",
    nativeNodes: Boolean(
      offline &&
        [
          "createBuffer",
          "createGain",
          "createDelay",
          "createConvolver",
          "createPanner",
          "createBufferSource",
          "createOscillator",
        ].every((key) => typeof Reflect.get(offline, key) === "function"),
    ),
    offlineSuspend: typeof offline?.suspend === "function",
    offlineResume: typeof offline?.resume === "function",
    periodicWave: typeof offline?.createPeriodicWave === "function",
    decodeAudioData: typeof offline?.decodeAudioData === "function",
    webCrypto: typeof globalThis.crypto?.subtle?.digest === "function",
    cancelAndHoldAtTime: typeof globalThis.AudioParam?.prototype.cancelAndHoldAtTime === "function",
    liveResume: typeof live?.resume === "function",
    secureContext: globalThis.isSecureContext,
    visibility: document.visibilityState,
    userAgent: navigator.userAgent,
  };
}
function observe(prototype: object | undefined, method: string) {
  if (!prototype) return;
  let owner: object | null = prototype,
    descriptor: PropertyDescriptor | undefined;
  while (owner && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(owner, method);
    if (!descriptor) owner = Object.getPrototypeOf(owner) as object | null;
  }
  if (!owner || !descriptor || typeof descriptor.value !== "function") return;
  if (observedMethods.get(owner)?.has(method)) return;
  if (!descriptor.configurable && !descriptor.writable) {
    instrumentationWarnings.push(`${method}: immutable native descriptor; left untouched`);
    return;
  }
  const original = descriptor.value as (...args: unknown[]) => unknown;
  const replacement = function (this: BaseAudioContext, ...args: unknown[]) {
    const kind = this instanceof OfflineAudioContext ? "OfflineAudioContext" : "AudioContext";
    let tracked = contexts.find((value) => value.context === this);
    if (!tracked && contexts.length < 32) {
      tracked = { context: this, kind, resumePending: false };
      contexts.push(tracked);
    }
    const operation: NativeOperation = {
      method,
      context: kind,
      status: "pending",
      time: this.currentTime,
    };
    if (
      method === "decodeAudioData" &&
      args[0] instanceof ArrayBuffer &&
      args[0].byteLength >= 44
    ) {
      const view = new DataView(args[0]);
      operation.wave = {
        format: view.getUint16(20, true),
        channels: view.getUint16(22, true),
        sampleRate: view.getUint32(24, true),
        bits: view.getUint16(34, true),
      };
    }
    if (operations.length < 128) operations.push(operation);
    if (method === "resume" && tracked?.kind === "AudioContext") tracked.resumePending = true;
    try {
      const result = Reflect.apply(original, this, args) as unknown;
      if (result && typeof (result as Promise<unknown>).then === "function") {
        void (result as Promise<unknown>).then(
          () => {
            operation.status = "fulfilled";
            operation.endTime = this.currentTime;
            if (method === "resume" && tracked) tracked.resumePending = false;
          },
          (error) => {
            operation.status = "rejected";
            operation.error = serialized(error);
            if (method === "resume" && tracked) tracked.resumePending = false;
          },
        );
      } else operation.status = "returned";
      return result;
    } catch (error) {
      operation.status = "threw";
      operation.error = serialized(error);
      if (method === "resume" && tracked) tracked.resumePending = false;
      throw error;
    }
  };
  try {
    Object.defineProperty(owner, method, { ...descriptor, value: replacement });
    const methods = observedMethods.get(owner) ?? new Set<string>();
    methods.add(method);
    observedMethods.set(owner, methods);
  } catch (error) {
    instrumentationWarnings.push(`${method}: ${serialized(error).message}`);
  }
}
export async function prepareNativeSuite(suite: CrossEngineSuite) {
  observe(globalThis.AudioContext?.prototype, "resume");
  observe(globalThis.OfflineAudioContext?.prototype, "suspend");
  observe(globalThis.OfflineAudioContext?.prototype, "resume");
  observe(globalThis.OfflineAudioContext?.prototype, "startRendering");
  observe(globalThis.BaseAudioContext?.prototype, "decodeAudioData");
  const module = (await import(/* @vite-ignore */ suite.module)) as Record<
    string,
    () => Promise<unknown>
  >;
  const execute = module[suite.exportName];
  if (typeof execute !== "function")
    throw new Error(`Missing native suite export ${suite.exportName}`);
  const button = document.getElementById("run-native-audio");
  if (!button) throw new Error("Missing native audio activation button");
  button.onclick = () => {
    try {
      pending = Promise.resolve(execute()).then(
        (value) => ({ value }),
        (error) => ({ error: serialized(error) }),
      );
    } catch (error) {
      pending = Promise.resolve({ error: serialized(error) });
    }
  };
  return nativeCapabilities();
}
export async function awaitNativeSuite() {
  if (!pending) throw new Error("Native suite has not received its user gesture");
  return pending;
}
export function nativeDiagnostics() {
  return {
    operations,
    instrumentationWarnings,
    visibility: document.visibilityState,
    liveContexts: contexts
      .filter((value) => value.kind === "AudioContext")
      .map((value) => ({
        state: value.context.state,
        currentTime: value.context.currentTime,
        resumePending: value.resumePending,
      })),
    nativeContexts: contexts.map((value) => ({
      kind: value.kind,
      state: value.context.state,
      currentTime: value.context.currentTime,
      sampleRate: value.context.sampleRate,
    })),
  };
}
