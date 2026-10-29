import { isUtf8 } from "node:buffer";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { safePath, sha } from "./store.mjs";
import { redact } from "./process-runner.mjs";

const sensitivePath =
  /(^|\/)(?:\.git|\.env(?:\.[^/]*)?|[^/]*(?:secret|credential)[^/]*|id_rsa|id_ed25519|[^/]*\.(?:pem|key|p12|pfx))(?:\/|$)/i;

/**
 * Selects explicit repository text only. `repository-policy` is the shared
 * AGENTS entry; `task-reference` entries remain untrusted source data, never
 * instructions overriding that policy. Context is rejected rather than cut.
 */
export function buildContextPack({
  repository,
  contract = {},
  maxFileBytes = 65536,
  maxTotalBytes = 262144,
}) {
  if (
    !Number.isSafeInteger(maxFileBytes) ||
    maxFileBytes < 1 ||
    !Number.isSafeInteger(maxTotalBytes) ||
    maxTotalBytes < 1
  )
    throw new Error("CONTEXT_INVALID_BUDGET");
  const base = realpathSync(repository);
  const selected = ["AGENTS.md"];
  if (existsSync(safePath(base, "knowledge/schema.md"))) {
    selected.push("knowledge/schema.md", "knowledge/wiki/index.md", "knowledge/wiki/now.md");
    if (contract.wiki_task_id !== undefined) {
      if (
        typeof contract.wiki_task_id !== "string" ||
        !/^RLAB-TASK-[0-9]{4}$/.test(contract.wiki_task_id)
      ) {
        throw new Error("CONTEXT_TASK_ID");
      }
      const taskPath = `knowledge/tasks/${contract.wiki_task_id}.json`;
      if (existsSync(safePath(base, taskPath))) selected.push(taskPath);
    }
  }
  for (const key of ["relevant_files", "architecture_refs", "skill_refs"]) {
    if (contract[key] === undefined) continue;
    if (!Array.isArray(contract[key]) || contract[key].some((item) => typeof item !== "string")) {
      throw new Error("CONTEXT_REFERENCE_LIST");
    }
    selected.push(...contract[key]);
  }
  const entries = [],
    seen = new Set();
  let total = 0;
  for (const relative of selected) {
    if (sensitivePath.test(relative)) throw new Error("CONTEXT_SENSITIVE_PATH");
    const file = safePath(base, relative);
    if (!existsSync(file)) {
      throw new Error(relative === "AGENTS.md" ? "CONTEXT_POLICY_MISSING" : "CONTEXT_FILE_MISSING");
    }
    const canonical = realpathSync(file);
    const identity = process.platform === "win32" ? canonical.toLowerCase() : canonical;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const stat = lstatSync(file);
    if (!stat.isFile()) throw new Error("CONTEXT_NOT_FILE");
    if (stat.size > maxFileBytes) throw new Error("CONTEXT_FILE_BUDGET");
    const bytes = readFileSync(file);
    // A file may grow between stat and read. Recheck the actual bytes.
    if (bytes.length > maxFileBytes) throw new Error("CONTEXT_FILE_BUDGET");
    if (total + bytes.length > maxTotalBytes) throw new Error("CONTEXT_TOTAL_BUDGET");
    if (!isUtf8(bytes)) throw new Error("CONTEXT_BINARY");
    const text = bytes.toString("utf8");
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error("CONTEXT_BINARY");
    if (redact(text) !== text) throw new Error("CONTEXT_SECRET_CONTENT");
    entries.push({
      path: relative,
      sha256: sha(bytes),
      bytes: bytes.length,
      role: entries.length === 0 ? "repository-policy" : "task-reference",
      text,
    });
    total += bytes.length;
  }
  return { entries, total_bytes: total };
}
