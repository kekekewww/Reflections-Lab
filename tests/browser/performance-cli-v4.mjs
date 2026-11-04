import { parseProfileOptions } from "./performance-cli-v3.mjs";

const addedOptions = new Set([
  "--probe-mode",
  "--qualification",
  "--top-monitor-mode",
  "--top-monitor-input",
  "--audio-policy-arm",
]);
const originalValueOptions = new Set([
  "--seconds",
  "--phase",
  "--physics-iterations",
  "--acoustic-iterations",
  "--executable-path",
  "--output",
]);

// Only new metadata is parsed here. All original load/cap rules remain in V3.
export function parseProfileOptionsV4(args) {
  if (!Array.isArray(args) || !args.every((value) => typeof value === "string"))
    throw new Error("INVALID_PROFILE_ARGUMENTS");
  const forwarded = [],
    added = new Map();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (originalValueOptions.has(key)) {
      // Preserve the immediate token, including a malformed new flag value.
      // Removing that flag first could silently repair an original missing value.
      forwarded.push(key);
      if (index + 1 < args.length) forwarded.push(args[++index]);
      continue;
    }
    if (!addedOptions.has(key)) {
      forwarded.push(key);
      continue;
    }
    if (added.has(key)) throw new Error("DUPLICATE_OPTION");
    const value = args[++index];
    if (value === undefined || value === "" || value.startsWith("--"))
      throw new Error("MISSING_OPTION_VALUE");
    added.set(key, value);
  }
  const original = parseProfileOptions(forwarded);
  const probeMode = added.get("--probe-mode") ?? "on";
  const topMonitorMode = added.get("--top-monitor-mode") ?? "levels";
  const topMonitorInput = added.get("--top-monitor-input") ?? "master-left";
  const qualificationId = added.get("--qualification") ?? null;
  const audioPolicyArm = added.get("--audio-policy-arm") ?? "reference";
  if (
    !["reference", "candidate"].includes(audioPolicyArm) ||
    !["on", "off"].includes(probeMode) ||
    !["levels", "spectrum", "waveform", "load"].includes(topMonitorMode) ||
    !["master-left", "master-right"].includes(topMonitorInput) ||
    (qualificationId !== null && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(qualificationId))
  )
    throw new Error("INVALID_PROFILE_V4_OPTIONS");
  if (original.formal && (topMonitorMode !== "levels" || topMonitorInput !== "master-left"))
    throw new Error("FORMAL_PROFILE_MISMATCH");
  return {
    ...original,
    probeMode,
    topMonitorMode,
    topMonitorInput,
    qualificationId,
    audioPolicyArm,
  };
}
