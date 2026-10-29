import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** Inputs used by validation, excluding known outputs that the validators themselves write. */
export function snapshotValidationInputs(root = process.cwd()) {
  function files(directory) {
    return readdirSync(path.resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
      const relative = path.posix.join(directory, entry.name);
      if (entry.isDirectory() && ["node_modules", ".cache", "build", "dist"].includes(entry.name))
        return [];
      return entry.isDirectory() ? files(relative) : [relative];
    });
  }
  const generatedTestEvidence = [
    /^tests\/sound-behaviors\/latest-[^/]+\.(?:json|jsonl|tap|txt)$/,
    /^tests\/audio-runtime\/(?:native-|audio-validation-manifest-)[^/]+\.(?:json|jsonl|tap|txt)$/,
    /^tests\/acoustics-runtime\/(?:validation-results|benchmark-results|delivery-browser-\d+)\.json$/,
    /^tests\/interaction-runtime\/evidence-\d+[^/]*\/(?:verification\.json|host\.tap)$/,
    /^experiments\/physics-spike\/results\.json$/,
    /^experiments\/sound-behavior-spike\/physics-results-[^/]+\.json$/,
    /^benchmarks\/muse\/results\/[^/]+\.json$/,
    /^tests\/browser\/test-results\/(?:sound-diagnostics|static-preview)-results\.json$/,
  ];
  const names = [
    ...new Set([
      ...[
        "src",
        "server",
        "scripts",
        "schemas",
        "tests",
        "prompts",
        "examples",
        "benchmarks/fixtures",
        "benchmarks/analytic",
        "benchmarks/muse",
        "experiments",
        "third_party",
        ".agents",
        "docs",
        "knowledge",
        "research",
        ".github",
      ]
        .flatMap(files)
        .filter((name) => !generatedTestEvidence.some((pattern) => pattern.test(name))),
      ...(existsSync(path.resolve(root, "public")) ? files("public") : []),
      // Authored evidence reports are inputs to docs/English validation. Raw JSON/PCM
      // results stay outputs; immutable copied Markdown is stamped as well.
      ...(existsSync(path.resolve(root, "artifacts"))
        ? files("artifacts").filter((name) => /\.md$/iu.test(name))
        : []),
      // The English validator consumes both root READMEs when present.
      ...["README.md", "README.en.md"].filter((name) => existsSync(path.resolve(root, name))),
      "AGENTS.md",
      "index.html",
      ".node-version",
      ".prettierrc.json",
      ".prettierignore",
      "eslint.config.mjs",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "vite.config.ts",
      "playwright.config.ts",
    ]),
  ].sort();
  return names.map((name) => ({
    path: name,
    sha256: createHash("sha256")
      .update(readFileSync(path.resolve(root, name)))
      .digest("hex"),
  }));
}
