import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(
  readFileSync(new URL("../../schemas/agents/task.schema.json", import.meta.url), "utf8"),
);
const validate = new Ajv2020({ strict: true, allErrors: true, useDefaults: true }).compile(schema);
const artifactAjv = new Ajv2020({ strict: true, allErrors: true });
addFormats(artifactAjv);
const artifactValidators = new Map();
const artifactNames = new Set([
  "implementation-result",
  "verification-result",
  "repair-task",
  "handoff",
]);

function contractError(message) {
  return Object.assign(new Error(message), { code: "ERR_CONTRACT" });
}

function pathKey(value) {
  const segments = value.split("/");
  if (
    segments.some(
      (part) =>
        part === "." ||
        part === ".." ||
        part.endsWith(".") ||
        part.endsWith(" ") ||
        /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part) ||
        /^\.git$/i.test(part) ||
        /^\.reflection-agent\.lock$/i.test(part) ||
        /^\.env(?:\.|$)/i.test(part) ||
        /^(?:id_rsa|id_ed25519|credentials(?:\.[^/]*)?|secrets?(?:\.[^/]*)?)$/i.test(part) ||
        /\.(?:pem|key|p12|pfx)$/i.test(part),
    )
  )
    throw contractError(`Unsafe or secret-bearing contract path: ${value}`);
  return value.toLowerCase();
}

/** Validate and normalize data only. This does not authorize execution or prove test truth. */
export function validateContract(input) {
  let value;
  try {
    value = structuredClone(input);
  } catch {
    throw contractError("Task contract must be JSON-compatible data");
  }
  if (!validate(value)) {
    throw contractError(`Invalid task contract: ${JSON.stringify(validate.errors)}`);
  }
  for (const field of [
    "allowed_files",
    "protected_files",
    "relevant_files",
    "architecture_refs",
    "skill_refs",
  ]) {
    const keys = value[field].map(pathKey);
    if (new Set(keys).size !== keys.length) throw contractError(`Case-alias duplicate in ${field}`);
  }
  const writable = value.allowed_files.map(pathKey);
  const protectedKeys = [
    ...value.protected_files,
    ...value.acceptance.map((entry) => entry.script),
  ].map(pathKey);
  const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
  if (
    writable.some((file, index) => writable.slice(index + 1).some((other) => overlaps(file, other)))
  ) {
    throw contractError("Writable file paths must not be ancestors of each other");
  }
  if (
    writable.some((file) => protectedKeys.some((protectedFile) => overlaps(file, protectedFile)))
  ) {
    throw contractError("Executor writable scope overlaps protected acceptance files");
  }
  const criteria = value.acceptance.map((entry) => entry.id);
  if (new Set(criteria).size !== criteria.length)
    throw contractError("Acceptance IDs must be unique");
  if (value.completed_acceptance_criteria.some((id) => !criteria.includes(id))) {
    throw contractError("Completed acceptance criteria must refer to original acceptance IDs");
  }
  if (value.policy.timeout_ms > value.policy.max_elapsed_ms) {
    throw contractError("Per-process timeout exceeds the cumulative elapsed budget");
  }
  if (value.policy.backoff_ms > value.policy.max_backoff_ms) {
    throw contractError("Initial backoff exceeds maximum backoff");
  }
  return value;
}

export function loadContract(filePath) {
  try {
    return validateContract(JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")));
  } catch (error) {
    if (error.code === "ERR_CONTRACT") throw error;
    throw contractError(`Could not read task contract (${error.code ?? error.name})`);
  }
}

/** Output shape guard only; a valid artifact is not proof that its claims are true. */
export function validateArtifact(name, input) {
  if (!artifactNames.has(name))
    throw Object.assign(new Error("Unknown artifact schema"), { code: "ERR_ARTIFACT" });
  let value;
  try {
    value = structuredClone(input);
  } catch {
    throw Object.assign(new Error("Artifact must be JSON-compatible data"), {
      code: "ERR_ARTIFACT",
    });
  }
  if (!artifactValidators.has(name)) {
    artifactValidators.set(
      name,
      artifactAjv.compile(
        JSON.parse(
          readFileSync(
            new URL(`../../schemas/agents/${name}.schema.json`, import.meta.url),
            "utf8",
          ),
        ),
      ),
    );
  }
  const check = artifactValidators.get(name);
  if (!check(value))
    throw Object.assign(new Error(`Invalid ${name}: ${JSON.stringify(check.errors)}`), {
      code: "ERR_ARTIFACT",
    });
  return value;
}
