import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRun,
  runTask,
  resumeTask,
  readStatus,
  verifyTask,
  checkpointTask,
  handoffTask,
  acknowledgeCodex,
  setResource,
  exportWiki,
} from "./engine.mjs";
import { inspectInstalledMuse } from "./muse-adapter.mjs";
import { redact } from "./process-runner.mjs";
import { runMilestone } from "./milestone.mjs";
import { runDemo } from "./demo.mjs";
import { cancelRun, withCancellation } from "./cancellation.mjs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const definitions = {
  help: [],
  init: ["contract", "workspace", "control", "repository", "plan"],
  run: ["run", "control", "runner"],
  resume: ["run", "control", "runner"],
  status: ["run", "control"],
  cancel: ["run", "control", "reason"],
  verify: ["run", "control"],
  checkpoint: ["run", "control", "reason"],
  handoff: ["run", "control", "reason"],
  acknowledge: ["run", "control", "handoff-hash"],
  "set-resource": ["control", "executor", "status", "evidence", "remaining", "mock"],
  "export-wiki": ["run", "control", "output"],
  probe: ["workspace"],
  milestone: ["manifest", "control", "repository", "workspace-root", "runner", "plan"],
  demo: ["output", "workspace-root"],
};
export const help = {
  version: 1,
  usage: "node scripts/agents/cli.mjs <command> [options]",
  commands: {
    init: "init --contract <json> --workspace <isolated-dir> [--control <dir>] [--repository <root>] [--plan <mock-plan.json>]",
    run: "run --run <uuid> [--control <dir>] [--runner mock|muse]",
    resume:
      "resume --run <uuid> [--control <dir>] [--runner mock|muse] (same run; eligible resource blocks require confirmed recovery; budgets remain unchanged)",
    status: "status --run <uuid> [--control <dir>]",
    cancel:
      "cancel --run <uuid> [--control <dir>] [--reason <text>] (cooperative request; active process saves checkpoint then stops)",
    verify: "verify --run <uuid> [--control <dir>] (original protected independent acceptance)",
    checkpoint: "checkpoint --run <uuid> [--control <dir>] [--reason <text>]",
    handoff: "handoff --run <uuid> [--control <dir>] [--reason <text>]",
    acknowledge:
      "acknowledge --run <uuid> --handoff-hash <sha256> [--control <dir>] (current Codex implementation mode)",
    "set-resource":
      "set-resource --executor MUSE|CODEX|META_API --status available|exhausted|unavailable|unknown --evidence <text> [--remaining <number>] [--mock] [--control <dir>]",
    "export-wiki":
      "export-wiki --run <uuid> [--control <dir>] [--output <new.json>] (projection only; Wiki task remains authority)",
    probe: "probe [--workspace <dir>] (installed Muse version/help only; no model request)",
    milestone:
      "milestone --manifest <json> --workspace-root <dir> [--control <dir>] [--repository <root>] [--runner mock|muse] [--plan <mock-plan.json>]",
    demo: "demo --output <new-dir> [--workspace-root <new-dir>] (offline Mock scenarios, never Live validation)",
  },
  defaults: { control: "artifacts/agent-runs", runner: "muse", paid_budget_usd: 0 },
  limits: [
    "Existing current Codex session is not recursively launched.",
    "Unknown quota is null; product runtime and development quota are separate.",
    "Live process-tree containment must be confirmed before executor transition.",
    "No automatic Git commit/push, account change, reset or budget increase.",
    "Mock resource observations use a separate registry and cannot change Live account status.",
    "resume preserves the same run; eligible resource blocks require a confirmed available observation; other blocks require manual diagnosis.",
    "Execution exits: COMPLETED/PASS=0, BLOCKED/FAIL=1, HANDOFF_PENDING=2. Diagnostic commands may exit0 while reporting a blocked state.",
    "SIGINT/SIGTERM request cancellation where delivered to JavaScript. Use cancel from another CLI on Windows; force termination cannot promise a checkpoint.",
  ],
};
function parse(argv) {
  const command = argv[0] ?? "help";
  if (!Object.hasOwn(definitions, command)) throw new Error("UNKNOWN_COMMAND");
  const options = {};
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i].startsWith("--") ? argv[i].slice(2) : null;
    if (!key || !definitions[command].includes(key)) throw new Error(`UNKNOWN_OPTION:${argv[i]}`);
    if (Object.hasOwn(options, key)) throw new Error(`DUPLICATE_OPTION:${key}`);
    if (key === "mock") {
      options[key] = true;
      continue;
    }
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--"))
      throw new Error(`MISSING_OPTION_VALUE:${key}`);
    options[key] = argv[++i];
  }
  return { command, options };
}
function required(options, key) {
  if (!options[key]) throw new Error(`MISSING_OPTION:${key}`);
  return options[key];
}
function summary(state) {
  return {
    run_id: state.run_id,
    task_id: state.task_id,
    wiki_task_id: state.wiki_task_id,
    goal_id: state.goal_id,
    milestone_id: state.milestone_id,
    status: state.status,
    preferred_executor: state.preferred_executor,
    actual_executor: state.actual_executor,
    previous_executor: state.previous_executor,
    fallback_reason: state.fallback_reason,
    blocked_reason: state.blocked_reason,
    workspace: state.workspace,
    control: state.control,
    resource_usage: state.resources,
    modified_files: state.modified_files,
    completed_acceptance_criteria: state.completed_acceptance_criteria,
    remaining_work: state.remaining_work,
    verification_evidence: state.verification_evidence,
    handoffs: state.handoffs,
    validation_mode: state.validation_mode,
  };
}
export async function main(argv = process.argv.slice(2), { signal } = {}) {
  const { command, options: o } = parse(argv),
    control = path.resolve(o.control ?? "artifacts/agent-runs");
  const runOptions = () => ({ control, runId: required(o, "run") });
  if (command === "help") return help;
  if (command === "init")
    return summary(
      createRun({
        contractPath: required(o, "contract"),
        workspace: required(o, "workspace"),
        control,
        repository: o.repository ?? process.cwd(),
        mockPlan: o.plan ? readJson(o.plan) : undefined,
      }),
    );
  if (command === "run")
    return summary(
      await withCancellation({ ...runOptions(), signal }, (childSignal) =>
        runTask({ ...runOptions(), runner: o.runner ?? "muse", signal: childSignal }),
      ),
    );
  if (command === "resume")
    return summary(
      await withCancellation({ ...runOptions(), signal }, (childSignal) =>
        resumeTask({ ...runOptions(), runner: o.runner ?? "muse", signal: childSignal }),
      ),
    );
  if (command === "status") return readStatus(runOptions());
  if (command === "cancel") return cancelRun({ ...runOptions(), reason: o.reason });
  if (command === "verify")
    return summary(
      await withCancellation({ ...runOptions(), signal }, (childSignal) =>
        verifyTask({ ...runOptions(), signal: childSignal }),
      ),
    );
  if (command === "checkpoint")
    return summary(checkpointTask({ ...runOptions(), reason: o.reason }));
  if (command === "handoff") return summary(handoffTask({ ...runOptions(), reason: o.reason }));
  if (command === "acknowledge")
    return summary(acknowledgeCodex({ ...runOptions(), handoffHash: required(o, "handoff-hash") }));
  if (command === "set-resource") {
    const remaining = o.remaining === undefined ? null : Number(o.remaining);
    if (o.remaining !== undefined && o.remaining.trim() === "")
      throw new Error("INVALID_REMAINING_QUOTA");
    return setResource({
      control,
      executor: required(o, "executor"),
      status: required(o, "status"),
      evidence: required(o, "evidence"),
      mock: o.mock === true,
      remaining,
    });
  }
  if (command === "export-wiki") {
    const projection = exportWiki(runOptions());
    if (o.output) {
      const file = path.resolve(o.output);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(projection, null, 2) + "\n", { flag: "wx" });
      return { ...projection, export_path: file };
    }
    return projection;
  }
  if (command === "probe") {
    const probe = await inspectInstalledMuse({ workspace: o.workspace ?? process.cwd() });
    return {
      available: probe.available,
      executable: probe.executable,
      version: probe.version,
      flags: probe.flags,
      reason: probe.reason,
      validation_mode: "CLI_HELP_ONLY",
    };
  }
  if (command === "milestone")
    return runMilestone({
      manifestPath: required(o, "manifest"),
      workspaceRoot: required(o, "workspace-root"),
      control,
      repository: o.repository ?? process.cwd(),
      runner: o.runner ?? "muse",
      mockPlan: o.plan ? readJson(o.plan) : undefined,
      signal,
    });
  if (command === "demo")
    return runDemo({ output: required(o, "output"), workspaceRoot: o["workspace-root"] });
  throw new Error("UNKNOWN_COMMAND");
}
export function exitCodeForResult(command, result) {
  if (result?.status === "FAIL") return 1;
  if (!["run", "resume", "verify", "milestone", "demo", "acknowledge"].includes(command)) return 0;
  if (result?.status === "BLOCKED") return 1;
  if (result?.status === "HANDOFF_PENDING") return 2;
  return 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController(),
    onInterrupt = () => controller.abort("SIGINT"),
    onTerminate = () => controller.abort("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  try {
    const result = await main(process.argv.slice(2), { signal: controller.signal });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exitCode = exitCodeForResult(process.argv[2] ?? "help", result);
  } catch (error) {
    process.stderr.write(
      JSON.stringify({ error: redact(error.message), code: error.code ?? "HARNESS_ERROR" }) + "\n",
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
}
