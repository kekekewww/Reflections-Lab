import { installAcousticWorker } from "../../../src/app/acoustic-worker.js";
import type { AcousticWorkerPort } from "../../../src/app/acoustic-worker.js";
import { wallNow } from "./comparison.js";

/** Timing envelopes stay outside the strict product reply. No request/result fields are rewritten. */
export function createWorkerHost(
  post: (value: unknown) => void,
  memory?: () => { heapUsed: number; external: number; arrayBuffers: number; rss: number },
) {
  let decodeMs = 0,
    solveMs = 0,
    receiveAt = 0,
    sentAt = 0;
  let before = memory?.();
  const port: AcousticWorkerPort = {
    onmessage: null,
    postMessage(value) {
      const after = memory?.();
      const workerMemoryDelta =
        before && after
          ? Object.fromEntries(
              Object.keys(before).map((key) => [
                key,
                after[key as keyof typeof after]! - before![key as keyof typeof before]!,
              ]),
            )
          : null;
      post({
        kind: "reply",
        value,
        timing: {
          decodeMs,
          solveMs,
          receiveAt,
          sentAt,
          workerMemoryDelta,
          resultPostedAt: wallNow(),
        },
      });
    },
  };
  installAcousticWorker(port, (timing) => {
    decodeMs = timing.decodeMs;
    solveMs = timing.solveMs;
  });
  return (message: {
    value: Parameters<NonNullable<AcousticWorkerPort["onmessage"]>>[0]["data"];
    sentAt: number;
  }) => {
    receiveAt = wallNow();
    sentAt = message.sentAt;
    before = memory?.();
    port.onmessage!(new MessageEvent("message", { data: message.value }));
  };
}
