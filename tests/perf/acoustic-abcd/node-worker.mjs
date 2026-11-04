import { parentPort } from "node:worker_threads";
import { tsImport } from "tsx/esm/api";
const { createWorkerHost } = await tsImport(
  new URL("./worker-host.ts", import.meta.url).href,
  import.meta.url,
);
const handle = createWorkerHost(
  (value) => parentPort.postMessage(value),
  () => process.memoryUsage(),
);
parentPort.on("message", handle);
parentPort.postMessage({ kind: "ready" });
