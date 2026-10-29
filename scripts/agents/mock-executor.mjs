// Explicit offline implementation process. Never represents a real model response.
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { safePath } from "./store.mjs";
const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const emit = (value) => process.stdout.write(JSON.stringify(value) + "\n");
emit({ type: "start", executor: input.executor, model: "MOCK_NO_MODEL" });
for (const write of input.writes ?? []) {
  if (!input.allowed_files.includes(write.path)) throw new Error("OUTSIDE_ALLOWED_FILES");
  const file = safePath(input.workspace, write.path);
  mkdirSync(path.dirname(file), { recursive: true });
  if (typeof write.append === "string") appendFileSync(file, write.append);
  else writeFileSync(file, write.content ?? "");
}
const errors = {
  quota: { code: "subscription_usage_limit" },
  rate: { http_status: 429, code: "rate_limit_exceeded" },
  outage: { http_status: 503, code: "service_unavailable" },
  unavailable: { code: "executor_unavailable" },
  auth: { http_status: 401, code: "invalid_api_key" },
  unknown: { code: "unrecognized_failure" },
};
if (input.kind === "hang") setTimeout(() => {}, 120000);
else if (errors[input.kind]) {
  emit({
    type: "error",
    error: { domain: "development", executor: input.executor, ...errors[input.kind] },
  });
  process.exitCode = 1;
} else if (input.kind === "success")
  emit({ type: "completed", result: { mock: true, claimed_success: true } });
else {
  emit({ type: "future-unrecognized-event" });
  process.exitCode = 1;
}
