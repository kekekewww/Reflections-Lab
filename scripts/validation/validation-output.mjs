export function validationOutput(args, now = new Date()) {
  if (args.length === 0)
    return `benchmarks/results/phase3-validation-${now.toISOString().replace(/[:.]/g, "-")}.json`;
  if (
    args.length !== 2 ||
    args[0] !== "--output" ||
    !/^benchmarks\/results\/phase3-[A-Za-z0-9_-][A-Za-z0-9._-]*\.json$/.test(args[1])
  )
    throw new Error(
      "Use --output benchmarks/results/phase3-<unique-name>.json; old evidence is immutable.",
    );
  return args[1];
}
