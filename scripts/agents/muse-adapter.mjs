import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { runProcess } from "./process-runner.mjs";

const REQUIRED_FLAGS = [
  "--provider",
  "--json",
  "--prompt-file",
  "--workspace",
  "--model",
  "--reasoning-effort",
  "--max-model-steps",
  "--session-id",
  "--contributor-mode",
  "--disable-approval",
  "--sandbox-network",
  "--trust-workspace",
  "--no-foreign-personal-context",
  "--disable-web-tools",
  "--disable-reminders",
  "--disable-request-user-input",
];

/** Resolves the existing signed-install binary without running an updater. */
export function discoverMuseExecutable({
  platform = process.platform,
  environment = process.env,
} = {}) {
  if (platform !== "win32") return "muse";
  const get = (name) =>
    Object.entries(environment).find(([key]) => key.toUpperCase() === name)?.[1] ?? "";
  // Sandboxed Windows may remap LOCALAPPDATA. PATH still points to the actual
  // installed launcher, whose validated sibling state names the native binary.
  const directories = [
    ...get("PATH").split(";"),
    join(get("LOCALAPPDATA"), "Programs", "muse"),
  ].filter(Boolean);
  for (const directory of directories) {
    const native = join(directory, "muse.exe");
    if (existsSync(native)) return resolve(native);
    if (!existsSync(join(directory, "muse.cmd"))) continue;
    const versionFile = join(directory, ".muse-version");
    if (!existsSync(versionFile)) continue;
    const version = readFileSync(versionFile, "utf8").trim();
    if (!/^\d+\.\d+\.\d+-R\d+(?:\.\d+)?$/.test(version)) continue;
    const executable = join(directory, `muse-bin-${version}.exe`);
    if (existsSync(executable)) return resolve(executable);
  }
  return null;
}

export async function inspectInstalledMuse({ workspace = process.cwd(), executable } = {}) {
  const file = executable ? resolve(executable) : discoverMuseExecutable();
  if (!file)
    return {
      available: false,
      executable: null,
      version: null,
      flags: [],
      reason: "CLI_NOT_INSTALLED",
    };
  const version = await runProcess({
    file,
    args: ["--version"],
    cwd: resolve(workspace),
    timeoutMs: 15000,
    maxOutputBytes: 8192,
  });
  const help = await runProcess({
    file,
    args: ["exec", "--help"],
    cwd: resolve(workspace),
    timeoutMs: 15000,
    maxOutputBytes: 65536,
  });
  const flags = REQUIRED_FLAGS.filter((flag) => help.stdout.includes(flag));
  const available =
    version.exit_code === 0 &&
    help.exit_code === 0 &&
    version.process_stopped &&
    help.process_stopped &&
    flags.length === REQUIRED_FLAGS.length;
  return {
    available,
    executable: file,
    version: version.exit_code === 0 ? version.stdout.trim() : null,
    flags,
    help: help.stdout,
    reason: available ? null : "CLI_PROFILE_UNVERIFIED",
    observation: { version, help },
  };
}

/** Builds only a help-verified profile; calling this does not authorize billing. */
export function buildMuseCommand({
  probe,
  promptFile,
  workspace,
  sessionId,
  provider,
  model,
  maxModelSteps,
  reasoningEffort = "medium",
}) {
  if (
    !probe?.available ||
    typeof probe.executable !== "string" ||
    REQUIRED_FLAGS.some((flag) => !probe.flags?.includes(flag))
  )
    throw new Error("ERR_MUSE_PROFILE: installed help verification required");
  if (!["echo", "meta"].includes(provider))
    throw new Error("ERR_MUSE_PROFILE: explicit provider required");
  if (
    typeof model !== "string" ||
    !model.trim() ||
    !Number.isSafeInteger(maxModelSteps) ||
    maxModelSteps < 1 ||
    maxModelSteps > 1000 ||
    !["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].includes(reasoningEffort)
  )
    throw new Error("ERR_MUSE_PROFILE: explicit bounded model configuration required");
  if (
    sessionId &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(sessionId)
  )
    throw new Error("ERR_MUSE_PROFILE: invalid session UUID");
  const prompt = realpathSync(resolve(promptFile));
  const directory = realpathSync(resolve(workspace));
  if (!statSync(prompt).isFile() || !statSync(directory).isDirectory())
    throw new Error("ERR_MUSE_PROFILE: prompt and workspace must exist");
  const args = [
    "exec",
    "--provider",
    provider,
    "--json",
    "--prompt-file",
    prompt,
    "--workspace",
    directory,
    "--model",
    model,
    "--reasoning-effort",
    reasoningEffort,
    "--max-model-steps",
    String(maxModelSteps),
    "--contributor-mode",
    "off",
    "--disable-approval",
    "--sandbox-network",
    "restricted",
    "--trust-workspace",
    "--no-foreign-personal-context",
    "--disable-web-tools",
    "--disable-reminders",
    "--disable-request-user-input",
  ];
  if (sessionId) args.push("--session-id", sessionId);
  return {
    file: probe.executable,
    args,
    cwd: directory,
    env: { MUSE_NO_AUTO_UPDATE: "1" },
    provider,
    cli_version: probe.version,
    model,
    billable: provider === "meta",
    sandbox_enabled: true,
  };
}
