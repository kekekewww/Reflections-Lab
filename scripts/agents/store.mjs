import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  readdirSync,
  lstatSync,
  realpathSync,
  unlinkSync,
  openSync,
  closeSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { redact } from "./process-runner.mjs";

export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export const readJson = (file) => JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const atomicRenameBackoffMs = [5, 10, 20, 40, 80];
const atomicRenameWait = new Int32Array(new SharedArrayBuffer(4));
export function atomic(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temp, typeof value === "string" ? value : json(value), { flag: "wx" });
  let originalError;
  for (let retry = 0; ; retry++) {
    try {
      renameSync(temp, file);
      return;
    } catch (error) {
      if (process.platform !== "win32" || error.code !== "EPERM") throw error;
      originalError ??= error;
      if (retry === atomicRenameBackoffMs.length) throw originalError;
      // Windows can briefly deny replacement while another process reads it.
      // Retry only this rename: at most six attempts / 155ms requested wait.
      // Keep the old target and the unique temp intact if publication fails.
      Atomics.wait(atomicRenameWait, 0, 0, atomicRenameBackoffMs[retry]);
    }
  }
}
export function safePath(root, relative, allowMissing = true) {
  if (
    typeof relative !== "string" ||
    !relative ||
    relative.includes("\\") ||
    relative.includes(":") ||
    relative.startsWith("/") ||
    relative.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error("UNSAFE_PATH");
  const full = path.resolve(root, relative),
    base = realpathSync(root);
  if (!full.startsWith(base + path.sep)) throw new Error("UNSAFE_PATH");
  let cursor = base;
  for (const part of relative.split("/")) {
    cursor = path.join(cursor, part);
    if (existsSync(cursor)) {
      if (lstatSync(cursor).isSymbolicLink() || !realpathSync(cursor).startsWith(base + path.sep))
        throw new Error("SYMLINK_PATH");
    } else if (!allowMissing) throw new Error("MISSING_FILE");
  }
  return full;
}
export function realDirectory(dir) {
  mkdirSync(dir, { recursive: true });
  const absolute = path.resolve(dir);
  if (
    lstatSync(absolute).isSymbolicLink() ||
    path.normalize(realpathSync(absolute)).toLowerCase() !== path.normalize(absolute).toLowerCase()
  )
    throw new Error("SYMLINK_DIRECTORY");
  return realpathSync(absolute);
}
const sensitive =
  /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.json)?|[^/]*\.(?:pem|key|p12|pfx))$/i;
export function workspaceSnapshot(workspace, allowedFiles) {
  const files = {},
    contents = {},
    secretContentPaths = [];
  let total = 0,
    count = 0;
  function visit(dir, prefix = "") {
    for (const name of readdirSync(dir).sort()) {
      if (!prefix && name === ".reflection-agent.lock") continue;
      if (name === "node_modules") throw new Error("UNSUPPORTED_WORKSPACE_NODE_MODULES");
      const relative = prefix + name,
        file = safePath(workspace, relative);
      const stat = lstatSync(file);
      if (stat.isDirectory()) {
        visit(file, relative + "/");
        continue;
      }
      if (!stat.isFile()) throw new Error("UNSUPPORTED_WORKSPACE_ENTRY");
      if (++count > 5000 || stat.size > 2 * 1024 * 1024 || (total += stat.size) > 16 * 1024 * 1024)
        throw new Error("WORKSPACE_SNAPSHOT_BUDGET");
      const bytes = readFileSync(file);
      files[relative] = sha(bytes);
      if (sensitive.test(relative)) continue;
      if (allowedFiles.includes(relative)) {
        if (redact(bytes.toString("utf8")) !== bytes.toString("utf8"))
          secretContentPaths.push(relative);
        else contents[relative] = bytes.toString("base64");
      }
    }
  }
  visit(workspace);
  return {
    files,
    allowed_file_contents_base64: contents,
    secret_content_paths: secretContentPaths,
  };
}
export function differences(before, after) {
  return [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])]
    .sort()
    .filter((file) => before.files[file] !== after.files[file])
    .map((file) => ({
      path: file,
      before_sha256: before.files[file] ?? null,
      after_sha256: after.files[file] ?? null,
    }));
}
export function gitState(workspace) {
  const call = (args) =>
    spawnSync("git", ["-C", workspace, ...args], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
  const head = call(["rev-parse", "--verify", "HEAD"]),
    branch = call(["symbolic-ref", "--short", "HEAD"]),
    status = call(["status", "--porcelain=v1", "--untracked-files=all"]);
  return {
    revision: head.status === 0 ? head.stdout.trim() : null,
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    status: status.status === 0 ? status.stdout.slice(0, 65536) : null,
    repository_present: status.status === 0,
  };
}
export function gitDiff(workspace) {
  const result = spawnSync("git", ["-C", workspace, "diff", "--no-ext-diff", "--binary", "--"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  return {
    command: ["git", "diff", "--no-ext-diff", "--binary", "--"],
    exit_code: result.status,
    text: redact((result.stdout ?? "").slice(0, 262144)),
    truncated: (result.stdout?.length ?? 0) > 262144,
    error: result.error ? redact(result.error.message) : null,
    untracked_note:
      "Untracked allowed files are preserved by checkpoint snapshots; ordinary git diff excludes them",
  };
}
export function paths(control, runId) {
  if (!/^[0-9a-f-]{36}$/.test(runId)) throw new Error("INVALID_RUN_ID");
  const root = path.resolve(control),
    run = safePath(root, `runs/${runId}`);
  return {
    root,
    run,
    state: path.join(run, "state.json"),
    operation: path.join(run, "operation.lock"),
  };
}
export function readState(control, runId) {
  const p = paths(control, runId),
    state = readJson(p.state);
  const event = readJson(safePath(p.run, `events/${state.last_event}.json`, false));
  if (event.state_sha256 !== sha(json(state))) throw new Error("STATE_EVENT_INTEGRITY_CHANGED");
  if (sha(json(state.contract)) !== state.contract_sha256)
    throw new Error("CONTRACT_INTEGRITY_CHANGED");
  return state;
}
export function saveState(control, state, type, detail = {}) {
  const p = paths(control, state.run_id),
    id = randomUUID();
  const next = {
    ...state,
    revision: (state.revision ?? 0) + 1,
    updated_at: new Date().toISOString(),
    last_event: id,
  };
  const event = {
    schema_version: 1,
    id,
    sequence: next.revision,
    run_id: state.run_id,
    task_id: state.task_id,
    type,
    recorded_at: next.updated_at,
    validation_mode: state.validation_mode,
    state_sha256: sha(json(next)),
    previous_event: state.last_event ?? null,
    detail,
  };
  mkdirSync(path.join(p.run, "events"), { recursive: true });
  writeFileSync(path.join(p.run, "events", `${id}.json`), json(event), { flag: "wx" });
  atomic(p.state, next);
  Object.assign(state, next);
  return state;
}
export function reserveWorkspace(control, workspace, runId) {
  const root = path.resolve(control),
    key = sha(workspace.toLowerCase());
  const file = path.join(root, "workspace-locks", `${key}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  const universal = path.join(workspace, ".reflection-agent.lock"),
    value = json({
      workspace,
      control: path.resolve(control),
      run_id: runId,
      created_at: new Date().toISOString(),
    });
  try {
    writeFileSync(universal, value, { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("WORKSPACE_BUSY");
    throw error;
  }
  try {
    writeFileSync(file, value, { flag: "wx" });
  } catch (error) {
    if (existsSync(universal) && readJson(universal).run_id === runId) unlinkSync(universal);
    if (error.code === "EEXIST") throw new Error(`WORKSPACE_BUSY:${readJson(file).run_id}`);
    throw error;
  }
  return file;
}
export function releaseWorkspace(control, state) {
  const file = path.join(
    path.resolve(control),
    "workspace-locks",
    `${sha(state.workspace.toLowerCase())}.json`,
  );
  if (existsSync(file) && readJson(file).run_id === state.run_id) unlinkSync(file);
  const universal = path.join(state.workspace, ".reflection-agent.lock");
  if (existsSync(universal) && readJson(universal).run_id === state.run_id) unlinkSync(universal);
}
export function operation(control, runId, callback) {
  const p = paths(control, runId),
    token = randomUUID();
  let fd;
  try {
    fd = openSync(p.operation, "wx");
    writeFileSync(
      fd,
      json({ pid: process.pid, token, run_id: runId, created_at: new Date().toISOString() }),
    );
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("OPERATION_BUSY");
    throw error;
  }
  const finish = () => {
    closeSync(fd);
    if (existsSync(p.operation) && readJson(p.operation).token === token) unlinkSync(p.operation);
  };
  try {
    const state = readState(control, runId);
    if (state.status !== "COMPLETED") {
      const workspaceOwner = readJson(path.join(state.workspace, ".reflection-agent.lock"));
      if (
        workspaceOwner.run_id !== runId ||
        path.resolve(workspaceOwner.control) !== path.resolve(control)
      )
        throw new Error("WORKSPACE_OWNER_CHANGED");
    }
    const result = callback(state);
    if (result && typeof result.then === "function") return result.finally(finish);
    finish();
    return result;
  } catch (error) {
    finish();
    throw error;
  }
}
