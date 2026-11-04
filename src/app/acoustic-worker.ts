import { solveAcoustics } from "../acoustics/index.js";
import { unpackAcousticBatch } from "./acoustic-transport.js";
import type { AcousticBatchPacket } from "./acoustic-transport.js";
import type { AcousticRequest } from "../acoustics/types.js";

export interface AcousticWorkerPort {
  onmessage:
    | ((
        event: MessageEvent<{
          batchId: number;
          requests?: AcousticRequest[];
          packet?: AcousticBatchPacket;
        }>,
      ) => void)
    | null;
  postMessage(value: unknown): void;
}
/** Optional benchmark observer. Product workers use the same handler without an observer. */
export function installAcousticWorker(
  worker: AcousticWorkerPort,
  observe?: (timing: { decodeMs: number; solveMs: number }) => void,
): void {
  worker.onmessage = (event) => {
    const startedAt = performance.now();
    const { batchId } = event.data ?? {};
    let requests: AcousticRequest[] | undefined;
    try {
      if (event.data.packet !== undefined && event.data.requests !== undefined)
        throw new Error("ACOUSTIC_PACKET_AMBIGUOUS");
      requests =
        event.data.packet === undefined
          ? event.data.requests
          : unpackAcousticBatch(event.data.packet);
    } catch (error) {
      observe?.({ decodeMs: performance.now() - startedAt, solveMs: 0 });
      worker.postMessage({
        batchId,
        error: error instanceof Error ? error.message : "ACOUSTIC_PACKET_INVALID",
        computeMs: performance.now() - startedAt,
      });
      return;
    }
    if (!Array.isArray(requests) || requests.length > 32) {
      observe?.({ decodeMs: performance.now() - startedAt, solveMs: 0 });
      worker.postMessage({
        batchId,
        error: "REQUEST_BUDGET_EXCEEDED",
        computeMs: performance.now() - startedAt,
      });
      return;
    }
    const decodedAt = observe ? performance.now() : 0;
    const results = requests.map((request) => {
      try {
        return { sourceId: request.source.id, solution: solveAcoustics(request) };
      } catch (error) {
        return {
          sourceId: request?.source?.id,
          error: error instanceof Error ? error.message : "SOLVER_ERROR",
        };
      }
    });
    observe?.({ decodeMs: decodedAt - startedAt, solveMs: performance.now() - decodedAt });
    worker.postMessage({ batchId, results, computeMs: performance.now() - startedAt });
  };
}
installAcousticWorker(globalThis as unknown as AcousticWorkerPort);
