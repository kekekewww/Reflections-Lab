import { createWorkerHost } from "../../../perf/acoustic-abcd/worker-host.js";
const handle = createWorkerHost((value) => globalThis.postMessage(value));
globalThis.onmessage = (event) => handle(event.data);
globalThis.postMessage({ kind: "ready" });
