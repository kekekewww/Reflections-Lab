import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { paths, readState } from "./store.mjs";
import { redact } from "./process-runner.mjs";

/** A separate CLI can request cancellation without acquiring the executor lock. */
export function cancelRun({ control, runId, reason = "operator cancellation" }) {
  const state = readState(control, runId),
    file = path.join(paths(control, runId).run, "cancel-request.json");
  if (["COMPLETED", "BLOCKED"].includes(state.status))
    return {
      run_id: runId,
      requested: false,
      status: state.status,
      reason: "Run is already terminal",
    };
  const request = {
    schema_version: 1,
    id: randomUUID(),
    run_id: runId,
    reason: redact(String(reason).slice(0, 1000)),
    recorded_at: new Date().toISOString(),
  };
  try {
    writeFileSync(file, JSON.stringify(request, null, 2) + "\n", { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return { run_id: runId, requested: true, already_requested: true, path: file };
  }
  return { run_id: runId, requested: true, already_requested: false, path: file };
}

/** Bounded polling keeps cancellation portable where Windows signals hard-kill. */
export async function withCancellation({ control, runId, signal }, callback) {
  const controller = new AbortController(),
    file = path.join(paths(control, runId).run, "cancel-request.json");
  const fromParent = () => controller.abort(signal.reason ?? "parent cancellation");
  const check = () => {
    if (!existsSync(file)) return;
    let reason = "cooperative cancellation request";
    try {
      const request = JSON.parse(readFileSync(file, "utf8"));
      if (request.run_id === runId && typeof request.reason === "string")
        reason = redact(request.reason.slice(0, 1000));
    } catch {}
    controller.abort(reason);
  };
  signal?.addEventListener("abort", fromParent, { once: true });
  if (signal?.aborted) fromParent();
  check();
  const timer = setInterval(check, 50);
  timer.unref();
  try {
    return await callback(controller.signal);
  } finally {
    clearInterval(timer);
    signal?.removeEventListener("abort", fromParent);
  }
}
