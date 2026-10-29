export function parseProfileOptions(args) {
  const known = new Set([
    "--seconds",
    "--phase",
    "--physics-iterations",
    "--acoustic-iterations",
    "--executable-path",
    "--output",
  ]);
  const values = new Map(),
    flags = new Set();
  let formal = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--prepare" || key === "--swiftshader") {
      if (flags.has(key)) throw Error("DUPLICATE_OPTION");
      flags.add(key);
      continue;
    }
    if (key === "--formal-600") {
      if (formal) throw Error("DUPLICATE_OPTION");
      formal = true;
      continue;
    }
    if (!known.has(key)) throw Error("UNKNOWN_OPTION");
    if (values.has(key)) throw Error("DUPLICATE_OPTION");
    const value = args[++i];
    if (value === undefined || value.startsWith("--") || value === "")
      throw Error("MISSING_OPTION_VALUE");
    values.set(key, value);
  }
  const seconds = Number(values.get("--seconds") ?? (formal ? "600" : "20"));
  const phase = values.get("--phase") ?? "all";
  const physicsIterations = Number(values.get("--physics-iterations") ?? "3000");
  const acousticIterations = Number(values.get("--acoustic-iterations") ?? "600");
  if (
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    seconds > (formal ? 600 : 60) ||
    !["all", "ui", "physics", "acoustics"].includes(phase) ||
    !Number.isSafeInteger(physicsIterations) ||
    physicsIterations < 1 ||
    physicsIterations > 18000 ||
    !Number.isSafeInteger(acousticIterations) ||
    acousticIterations < 1 ||
    acousticIterations > 18000
  )
    throw Error("INVALID_PROFILE");
  if (
    formal &&
    (flags.size ||
      seconds !== 600 ||
      phase !== "all" ||
      physicsIterations !== 3000 ||
      acousticIterations !== 600)
  )
    throw Error("FORMAL_PROFILE_MISMATCH");
  return {
    seconds,
    phase,
    physicsIterations,
    acousticIterations,
    formal,
    prepare: flags.has("--prepare"),
    softwareGPU: flags.has("--swiftshader"),
    executablePath: values.get("--executable-path") ?? null,
    output: values.get("--output") ?? null,
  };
}
