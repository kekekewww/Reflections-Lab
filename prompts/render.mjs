import { readFileSync } from "node:fs";

const templates = Object.freeze({
  "muse/implementation": "./muse/implementation.md",
  "muse/bugfix": "./muse/bugfix.md",
  "muse/ui-implementation": "./muse/ui-implementation.md",
  "muse/acoustic-solver": "./muse/acoustic-solver.md",
  "muse/physics-interaction": "./muse/physics-interaction.md",
  "muse/repair": "./muse/repair.md",
  "muse/handoff": "./muse/handoff.md",
  "muse/codex-fallback": "./muse/codex-fallback.md",
  "runtime/scene-planner": "./runtime/scene-planner.md",
  "runtime/experiment-agent": "./runtime/experiment-agent.md",
  "runtime/acoustic-analysis": "./runtime/acoustic-analysis.md",
});
const tokens = new Set([
  "TASK_CONTRACT_JSON",
  "RUN_STATE_JSON",
  "REPAIR_TASK_JSON",
  "HANDOFF_JSON",
]);

export const TEMPLATE_NAMES = Object.freeze(Object.keys(templates));

/** Render once: token-like text inside task data is never reinterpreted. */
export function renderTemplate(name, values = {}) {
  if (!Object.hasOwn(templates, name)) throw new Error(`Unknown prompt template: ${name}`);
  if (values === null || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("Prompt values must be a named object");
  }
  const template = readFileSync(new URL(templates[name], import.meta.url), "utf8");
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_match, token) => {
    if (!tokens.has(token)) throw new Error(`Unknown prompt token: ${token}`);
    if (!Object.hasOwn(values, token)) throw new Error(`Missing prompt token: ${token}`);
    const value = typeof values[token] === "string" ? JSON.parse(values[token]) : values[token];
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Prompt token ${token} must contain a JSON object`);
    }
    const serialized = JSON.stringify(value, null, 2);
    if (Buffer.byteLength(serialized, "utf8") > 262144) {
      throw new Error(`Prompt token ${token} exceeds 256 KiB`);
    }
    return serialized;
  });
}
