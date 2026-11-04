import { solveAcoustics } from "../acoustics/index.js";
import { canonicalBytes } from "../experiments/hash.js";
import { RecordingProcessor } from "./recording-processor.js";
import type { BehaviorAsset } from "../audio-behavior/types.js";
import type { RecordingEvaluationJob } from "./recording-evaluation-client.js";
import {
  RECORDING_EVALUATION_MAX_BYTES,
  RECORDING_EVALUATION_MAX_REQUESTS,
} from "./recording-evaluation-limits.js";

interface PrepareWorkerMessage {
  kind: "prepare";
  id: number;
  generation: number;
  protocolVersion: 1;
}
interface EvaluationWorkerMessage {
  id: number;
  input: RecordingEvaluationJob;
  kind?: never;
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PrepareWorkerMessage | EvaluationWorkerMessage>) => void) | null;
  postMessage(value: unknown): void;
};
let assets: readonly BehaviorAsset[] = [];
const processor = new RecordingProcessor({ getAssets: () => [...assets] });
let busy = false;
scope.onmessage = ({ data }) => {
  if (data?.kind === "prepare") {
    // This ACK proves only that imports/initialization reached this handler.
    // Preparation never enters the solver, changes assets, or owns the job busy flag.
    const keys = Object.keys(data);
    const valid =
      !Array.isArray(data) &&
      keys.length === 4 &&
      keys.every((key) => ["kind", "id", "generation", "protocolVersion"].includes(key)) &&
      Number.isSafeInteger(data.id) &&
      data.id > 0 &&
      Number.isSafeInteger(data.generation) &&
      data.generation >= 0 &&
      data.protocolVersion === 1;
    const id = Number.isSafeInteger(data.id) && data.id > 0 ? data.id : null;
    const generation =
      Number.isSafeInteger(data.generation) && data.generation >= 0 ? data.generation : null;
    if (!valid || busy) {
      scope.postMessage({
        kind: "prepared",
        ok: false,
        id,
        generation,
        protocolVersion: 1,
        error: {
          code: valid ? "EVALUATION_BUSY" : "EVALUATION_PREPARE_PROTOCOL",
          message: valid ? "錄製評估 Worker 正在處理工作。" : "錄製 Worker 準備協定無效。",
        },
      });
    } else {
      scope.postMessage({ kind: "prepared", ok: true, id, generation, protocolVersion: 1 });
    }
    // In particular, a busy preparation cannot run the legacy job's finally.
    return;
  }
  void (async () => {
    const id = data?.id;
    try {
      if (
        busy ||
        !Number.isSafeInteger(id) ||
        id < 1 ||
        canonicalBytes(data.input) > RECORDING_EVALUATION_MAX_BYTES
      )
        throw new Error("EVALUATION_PROTOCOL");
      busy = true;
      const input = data.input;
      let output: unknown;
      if (input.kind === "capture") {
        // Keep capture synchronous through postMessage/finally: the next queued
        // message must observe busy=false even when two capture jobs are posted.
        if (
          !Array.isArray(input.requests) ||
          input.requests.length > RECORDING_EVALUATION_MAX_REQUESTS
        )
          throw new Error("EVALUATION_REQUEST_BUDGET");
        output = input.requests.map((request) => solveAcoustics(request).frame);
      } else if (input.kind === "reprocess") {
        assets = input.assets;
        output = await processor.process(input.frame, input.changes, input.baseline);
      } else throw new Error("EVALUATION_PROTOCOL");
      if (canonicalBytes(output) > RECORDING_EVALUATION_MAX_BYTES)
        throw new Error("EVALUATION_REPLY_BUDGET");
      scope.postMessage({ id, ok: true, output });
    } catch (error) {
      scope.postMessage({
        id,
        ok: false,
        error: {
          code:
            error && typeof error === "object" && "code" in error
              ? String(error.code).slice(0, 80)
              : "EVALUATION_FAILED",
          message: error instanceof Error ? error.message.slice(0, 512) : "錄製評估失敗。",
        },
      });
    } finally {
      busy = false;
    }
  })();
};
