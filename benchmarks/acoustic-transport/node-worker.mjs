import { parentPort, workerData } from "node:worker_threads";
import { tsImport } from "tsx/esm/api";

if (!parentPort) throw new Error("NODE_ACOUSTIC_PARENT_PORT_REQUIRED");
if (typeof workerData?.workerModuleUrl !== "string")
  throw new Error("NODE_ACOUSTIC_WORKER_MODULE_REQUIRED");

// The application worker owns its ordinary reply envelope. This adapter does not
// add fields or transfer buffers, and messages sent during import remain in Node's queue.
globalThis.postMessage = (value) => parentPort.postMessage(value);
await tsImport(workerData.workerModuleUrl, import.meta.url);
if (typeof globalThis.onmessage !== "function")
  throw new Error("NODE_ACOUSTIC_MESSAGE_HANDLER_REQUIRED");

parentPort.on("message", (data) => {
  globalThis.onmessage.call(globalThis, new MessageEvent("message", { data }));
});
parentPort.postMessage({ __acousticComponentReady: "reflection-lab-acoustic-node-ready-1" });
