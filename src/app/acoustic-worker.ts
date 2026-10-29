import { solveAcoustics } from "../acoustics/index.js";
import type { AcousticRequest } from "../acoustics/types.js";

const worker = globalThis as unknown as {
  onmessage:
    | ((event: MessageEvent<{ batchId: number; requests: AcousticRequest[] }>) => void)
    | null;
  postMessage(value: unknown): void;
};
worker.onmessage = (event) => {
  const startedAt = performance.now();
  const { batchId, requests } = event.data ?? {};
  if (!Array.isArray(requests) || requests.length > 32) {
    worker.postMessage({
      batchId,
      error: "REQUEST_BUDGET_EXCEEDED",
      computeMs: performance.now() - startedAt,
    });
    return;
  }
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
  worker.postMessage({ batchId, results, computeMs: performance.now() - startedAt });
};
