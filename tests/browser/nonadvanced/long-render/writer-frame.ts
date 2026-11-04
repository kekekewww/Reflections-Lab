import { IndexedDBRenderOutputStore } from "../../../../src/audio/render-output-store.js";

type WriterConfig = { databaseName: string; jobId: string };
type WriterState = Record<string, unknown>;

declare global {
  interface Window {
    nativeWriterReady: boolean;
    nativeWriterDocumentToken: string;
    nativeWriterStart(config: WriterConfig): Promise<WriterState>;
    nativeWriterAppend(index: number, bytes: number[]): Promise<WriterState>;
    nativeWriterState(): Promise<WriterState>;
  }
}

const channel = "reflection-lab-native-writer-frame-v1";
const parameters = new URLSearchParams(location.search);
const nonce = parameters.get("nonce");
const configuredDatabaseName = parameters.get("database");
const configuredJobId = parameters.get("job");
const documentToken = crypto.randomUUID();
let store: IndexedDBRenderOutputStore | null = null;
let configuration: WriterConfig | null = null;
let started = false;

function send(message: Record<string, unknown>): void {
  if (window.parent !== window && nonce)
    window.parent.postMessage({ channel, nonce, documentToken, ...message }, location.origin);
}

function failure(error: unknown): Record<string, unknown> {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    code: error instanceof Error && "code" in error ? error.code : null,
  };
}

async function state(): Promise<WriterState> {
  return {
    documentToken,
    databaseName: configuration?.databaseName ?? null,
    jobId: configuration?.jobId ?? null,
    started,
    snapshot: store && configuration ? await store.getSnapshot(configuration.jobId) : null,
    jobs: store ? await store.listJobs() : [],
    usage: store ? await store.getArchiveUsage() : null,
  };
}

async function start(config: WriterConfig): Promise<WriterState> {
  if (store || started) throw new Error("WRITER_FRAME_ALREADY_STARTED");
  if (
    !config ||
    typeof config.databaseName !== "string" ||
    !config.databaseName.startsWith("reflection-lab-") ||
    typeof config.jobId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(config.jobId)
  )
    throw new Error("WRITER_FRAME_CONTEXT_INVALID");
  configuration = { databaseName: config.databaseName, jobId: config.jobId };
  store = new IndexedDBRenderOutputStore({ name: configuration.databaseName });
  await store.begin(configuration.jobId, 1024, ["pcm"], 512);
  await store.append(configuration.jobId, "pcm", 0, new Uint8Array([11, 22, 33]));
  started = true;
  return state();
}

async function append(index: number, bytes: number[]): Promise<WriterState> {
  if (
    !started ||
    !store ||
    !configuration ||
    !Number.isSafeInteger(index) ||
    index < 1 ||
    !Array.isArray(bytes) ||
    bytes.length < 1 ||
    bytes.length > 16 ||
    !bytes.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
  )
    throw new Error("WRITER_FRAME_APPEND_INVALID");
  await store.append(configuration.jobId, "pcm", index, new Uint8Array(bytes));
  return state();
}

window.nativeWriterDocumentToken = documentToken;
window.nativeWriterStart = start;
window.nativeWriterAppend = append;
window.nativeWriterState = state;
window.nativeWriterReady = true;

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (
    window.parent === window ||
    event.origin !== location.origin ||
    event.source !== window.parent ||
    !event.data ||
    typeof event.data !== "object"
  )
    return;
  const message = event.data as Record<string, unknown>;
  if (
    message.channel !== channel ||
    message.nonce !== nonce ||
    message.documentToken !== documentToken ||
    typeof message.requestId !== "string"
  )
    return;
  const requestId = message.requestId;
  const run = async (): Promise<WriterState> => {
    if (message.command === "start") {
      if (!configuredDatabaseName || !configuredJobId)
        throw new Error("WRITER_FRAME_CONTEXT_INVALID");
      return start({ databaseName: configuredDatabaseName, jobId: configuredJobId });
    }
    if (message.command === "append")
      return append(message.index as number, message.bytes as number[]);
    if (message.command === "state") return state();
    throw new Error("WRITER_FRAME_COMMAND_UNKNOWN");
  };
  void run().then(
    (result) => send({ type: "response", requestId, result }),
    (error) => send({ type: "response", requestId, error: failure(error) }),
  );
});

// There is deliberately no unload/pagehide disposal callback. The iframe tests
// observe native document-unload/reload release. The separate public CDP fixture
// can crash this top-level renderer while it holds the same native writer lease.
send({ type: "ready", databaseName: configuredDatabaseName, jobId: configuredJobId });
