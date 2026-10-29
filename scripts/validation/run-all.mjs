import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { validationOutput } from "./validation-output.mjs";
import { snapshotValidationInputs } from "./source-snapshot.mjs";

const output = validationOutput(process.argv.slice(2));
const sha256 = (name) => createHash("sha256").update(readFileSync(name)).digest("hex");
const before = snapshotValidationInputs();
mkdirSync("benchmarks/results", { recursive: true });
// Reserve before any work. Never overwrite an earlier report, including Phase1/2.
writeFileSync(
  output,
  JSON.stringify({ status: "RUNNING", recordedAt: new Date().toISOString() }) + "\n",
  { flag: "wx" },
);

// Fixed repository scripts only. No user text or environment values enter shell command text.
const names = [
  "environment:check",
  "test",
  "test:agents",
  "test:prompts",
  "test:wiki",
  "test:design",
  "test:sound-behaviors",
  "validate:sound-behaviors",
  "smoke:sound-physics",
  "smoke:dependencies",
  "test:physics",
  "test:datasets",
  "validate:research",
  "validate:schemas",
  "validate:docs",
  "validate:wiki",
  "validate:skills",
  "validate:design",
  "typecheck",
  "lint",
  "format:check",
  "test:runtime",
  "build",
  "validate:licenses",
  "validate:english",
  "benchmark:muse",
];
const steps = [];
for (const name of names) {
  const startedAt = new Date().toISOString(),
    start = performance.now();
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm run ${name}`], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 300000,
          maxBuffer: 8 * 1024 * 1024,
        })
      : spawnSync("npm", ["run", name], {
          encoding: "utf8",
          timeout: 300000,
          maxBuffer: 8 * 1024 * 1024,
        });
  steps.push({
    command: `npm run ${name}`,
    startedAt,
    durationMs: performance.now() - start,
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message ?? null,
  });
  console.log(`${result.status === 0 ? "PASS" : "FAIL"} npm run ${name}`);
}
const after = snapshotValidationInputs();
const sourceStableDuringRun = JSON.stringify(before) === JSON.stringify(after);
const report = {
  schemaVersion: "1.0.0",
  recordedAt: new Date().toISOString(),
  status: steps.every((s) => s.exitCode === 0) && sourceStableDuringRun ? "PASS" : "FAIL",
  scope:
    "V1 TypeScript runtime tests and production build plus preserved research/optional Harness regression; browser/native device/hearing/live Meta require separate evidence",
  excludedValidation: {
    browser: "NOT RUN by this command",
    nativeSteamAudio: "NOT RUN by this command",
    hearing: "NOT RUN by this command",
    liveMeta: "NOT RUN by this command",
    performanceProfile: "NOT RUN by this command",
  },
  outputNaming:
    "Legacy phase3-* immutable output prefix retained for compatibility; scope field identifies V1 coverage",
  sourceStableDuringRun,
  sourceStabilityMethod:
    "Before/after SHA-256 equality; no continuous file monitor, so reverted interim edits cannot be detected. Run only with source writers stopped.",
  sourceSnapshots: { before, after },
  node: process.version,
  hashes: {
    packageLock: sha256("package-lock.json"),
    analyticalFixtures: sha256("benchmarks/fixtures/analytical.json"),
    analyticalKernel: sha256("scripts/validation/analytic-kernels.mjs"),
    evidenceLedger: sha256("research/EVIDENCE_LEDGER.json"),
    physicsSmoke: sha256("experiments/physics-spike/smoke.mjs"),
    physicsLock: sha256("experiments/physics-spike/package-lock.json"),
    datasetAcquisition: sha256("scripts/setup/datasets.mjs"),
    datasetAcquisitionTests: sha256("experiments/dataset-fetch-spike/dataset-fetch.test.mjs"),
    wikiEngine: sha256("scripts/wiki/core.mjs"),
    emilBundleManifest: sha256("third_party/emil-skills.manifest.json"),
    designTokens: sha256("docs/05-ux/DESIGN_TOKENS.json"),
    agentEngine: sha256("scripts/agents/engine.mjs"),
    agentStore: sha256("scripts/agents/store.mjs"),
    agentProcess: sha256("scripts/agents/process-runner.mjs"),
    agentFailurePolicy: sha256("scripts/agents/failure-policy.mjs"),
    agentResources: sha256("scripts/agents/resources.mjs"),
    agentMuseAdapter: sha256("scripts/agents/muse-adapter.mjs"),
    promptRenderer: sha256("prompts/render.mjs"),
    promptEvaluator: sha256("benchmarks/muse/evaluate.mjs"),
    soundBehaviorSchema: sha256("schemas/sound-behavior/behavior-document.schema.json"),
    soundBehaviorAISchema: sha256("schemas/sound-behavior/sound-behavior-ai.schema.json"),
    soundBehaviorTypes: sha256("schemas/sound-behavior/types.ts"),
    soundBehaviorValidator: sha256("scripts/validation/sound-behavior.mjs"),
    soundPhysicsPolicy: sha256("experiments/sound-behavior-spike/physics-policy.mjs"),
    soundPhysicsProbe: sha256("experiments/sound-behavior-spike/physics-probe.mjs"),
    schemas: Object.fromEntries(
      readdirSync("schemas")
        .filter((name) => name.endsWith(".schema.json"))
        .sort()
        .map((name) => [name, sha256(`schemas/${name}`)]),
    ),
  },
  steps,
};
mkdirSync("benchmarks/results", { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Recorded ${output} (prior evidence retained)`);
if (report.status !== "PASS") process.exitCode = 1;
