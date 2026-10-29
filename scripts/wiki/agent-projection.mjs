import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const taskSchema = JSON.parse(
  fs.readFileSync(new URL("../../schemas/wiki-task.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile({ $defs: taskSchema.$defs, ...taskSchema.properties.agent_execution });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function inside(root, target) {
  const relative = path.relative(root, target);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).includes(".."))
    throw new Error("Projection path must be inside the selected repository");
  const segments = relative.split(path.sep);
  if (
    segments.some(
      (part) =>
        /[:<>"|?*]/.test(part) ||
        /[. ]$/.test(part) ||
        /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part),
    )
  )
    throw new Error("Projection path has a Windows alias");
  let cursor = root;
  for (const part of segments) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink())
      throw new Error("Projection paths cannot contain symlink/junction components");
  }
  return relative.split(path.sep).join("/");
}

/** Import actual Harness export without changing Wiki task authority or mutable run files. */
export function writeAgentProjection({ root, control, projection, output }) {
  root = fs.realpathSync(root);
  control = path.resolve(root, control);
  inside(root, control);
  const source = path.resolve(projection.run_state_path);
  inside(control, source);
  const bytes = fs.readFileSync(source);
  if (hash(bytes) !== projection.run_state_sha256) throw new Error("Stale Harness export hash");
  const state = JSON.parse(bytes);
  if (state.run_id !== projection.run_id || state.wiki_task_id !== projection.wiki_task_id)
    throw new Error("Export identity does not match actual run state");
  if (
    typeof output !== "string" ||
    !/^artifacts\/[A-Za-z0-9_./-]+\.json$/.test(output) ||
    output.split("/").some((part) => [".", "..", ""].includes(part))
  )
    throw new Error("Output must be a fresh artifacts/<name>.json repository path");
  const patchPath = path.resolve(root, output);
  inside(root, patchPath);
  const snapshotPath = patchPath.replace(/\.json$/, ".state.json");
  inside(root, snapshotPath);
  if (fs.existsSync(patchPath) || fs.existsSync(snapshotPath))
    throw new Error("Projection output already exists");
  const evidence = state.verification_evidence.map((item) => {
    const file = path.resolve(control, item.path);
    inside(control, file);
    const relative = inside(root, file);
    if (hash(fs.readFileSync(file)) !== item.sha256)
      throw new Error("Verification evidence hash changed");
    return {
      path: relative,
      sha256: item.sha256,
      result: item.status ?? "UNKNOWN",
      command: item.authority ?? "independent-node-runner",
    };
  });
  const provenance = state.model_provenance
    .filter((item) => item.executor === state.actual_executor)
    .at(-1);
  const agent_execution = {
    run_id: state.run_id,
    run_state: state.status,
    preferred_executor: state.preferred_executor,
    actual_executor: state.actual_executor,
    previous_executor: state.previous_executor,
    fallback_reason: state.fallback_reason,
    model: provenance?.model ?? null,
    cli_version: state.executor_versions[state.actual_executor] ?? null,
    last_successful_checkpoint: state.last_successful_checkpoint?.id ?? null,
    git_revision: state.git_revision,
    modified_files: state.modified_files,
    completed_acceptance_criteria: state.completed_acceptance_criteria,
    remaining_work: state.remaining_work,
    verification_evidence: evidence,
    resource_usage: { ...state.resources, observations: projection.resource_status ?? null },
    run_state_path: inside(root, snapshotPath),
    run_state_sha256: hash(bytes),
    updated_at: state.updated_at,
  };
  if (!validate(agent_execution))
    throw new Error(`Invalid agent execution projection: ${ajv.errorsText(validate.errors)}`);
  const patch = { agent_execution };
  fs.mkdirSync(path.dirname(patchPath), { recursive: true });
  fs.writeFileSync(snapshotPath, bytes, { flag: "wx" });
  fs.writeFileSync(patchPath, `${JSON.stringify(patch, null, 2)}\n`, { flag: "wx" });
  return patch;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes("--help")) {
      console.log(
        "node scripts/wiki/agent-projection.mjs --input <Harness-export.json> --control <repo-control-dir> --output artifacts/<unique>.json [--root <repo>]",
      );
    } else {
      const flags = {};
      const args = process.argv.slice(2);
      for (let i = 0; i < args.length; i += 2) {
        if (
          !["--input", "--control", "--output", "--root"].includes(args[i]) ||
          !args[i + 1] ||
          Object.hasOwn(flags, args[i])
        )
          throw new Error("Invalid projection CLI arguments; use --help");
        flags[args[i]] = args[i + 1];
      }
      for (const name of ["--input", "--control", "--output"])
        if (!flags[name]) throw new Error(`Missing ${name}`);
      const root = fs.realpathSync(flags["--root"] ?? process.cwd());
      const input = path.resolve(root, flags["--input"]);
      inside(root, input);
      const patch = writeAgentProjection({
        root,
        control: flags["--control"],
        projection: JSON.parse(fs.readFileSync(input, "utf8")),
        output: flags["--output"],
      });
      console.log(
        JSON.stringify({
          ok: true,
          run_id: patch.agent_execution.run_id,
          output: flags["--output"],
          note: "Pinned snapshot only; apply via owner-authenticated wiki task update.",
        }),
      );
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
}
