import ts from "typescript";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fixtures } from "./fixtures.mjs";
import { acceptance } from "./acceptance.mjs";

export { fixtures };
const base = path.dirname(fileURLToPath(import.meta.url));
export const defaultConfig = JSON.parse(
  readFileSync(path.join(base, "evaluation-config.json"), "utf8"),
);

// Trusted hand-authored fixture controls only. node:vm is NOT a security sandbox.
// Route all untrusted model code through the development harness instead.
export function evaluateCandidateSource(fixtureId, source) {
  const fixture = fixtures.find((item) => item.id === fixtureId);
  if (!fixture) throw new Error(`Unknown fixture: ${fixtureId}`);
  const started = performance.now();
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      strict: true,
    },
    reportDiagnostics: true,
    fileName: `${fixtureId}.ts`,
  });
  const compileErrors = (output.diagnostics ?? [])
    .filter((item) => item.category === ts.DiagnosticCategory.Error)
    .map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n"));
  const expectedChecks = acceptance[fixtureId] ?? [];
  if (expectedChecks.length === 0) compileErrors.push("Missing independent acceptance checks");
  const checks = [];
  let moduleExports = null;
  if (compileErrors.length === 0) {
    const context = vm.createContext({ exports: {} });
    try {
      vm.runInContext(output.outputText, context, { timeout: 500 });
      moduleExports = context.exports;
      if (moduleExports === null || typeof moduleExports !== "object") {
        compileErrors.push("Candidate exports must be a non-null object");
      }
    } catch (error) {
      compileErrors.push(error.message);
    }
  }
  if (compileErrors.length === 0) {
    for (const [name, check] of expectedChecks) {
      try {
        check(moduleExports);
        checks.push({ name, passed: true });
      } catch (error) {
        checks.push({ name, passed: false, error: error.message });
      }
    }
  }
  return {
    status:
      compileErrors.length === 0 &&
      expectedChecks.length > 0 &&
      checks.length === expectedChecks.length &&
      checks.every((item) => item.passed)
        ? "PASS"
        : "FAIL",
    compile_errors: compileErrors,
    expected_check_count: expectedChecks.length,
    checks,
    candidate_sha256: createHash("sha256").update(source).digest("hex"),
    validation_latency_ms: performance.now() - started,
  };
}

export function promptFor(fixture, strategy) {
  if (strategy === "A") return `${fixture.objective}\n請輸出實作與已執行測試。`;
  if (strategy !== "B") throw new Error(`Unknown strategy: ${strategy}`);
  return JSON.stringify(
    {
      task_id: `PROMPT-FIXTURE-${fixture.id}`,
      objective: fixture.objective,
      scope: ["單一隔離 TypeScript fixture"],
      constraints: fixture.constraints,
      acceptance_criteria: fixture.acceptance,
      forbidden_operations: ["修改驗收程式", "網路或模型 API 呼叫", "宣稱已通過未執行的測試"],
      completion: "列出修改、測試、限制；獨立驗證器決定完成狀態",
    },
    null,
    2,
  );
}

export function evaluateFixtures(config = defaultConfig) {
  if (
    !Array.isArray(config.fixtures) ||
    config.fixtures.length === 0 ||
    new Set(config.fixtures).size !== config.fixtures.length
  )
    throw new Error("Invalid fixture selection");
  const selectedFixtures = config.fixtures.map((id) => {
    const fixture = fixtures.find((item) => item.id === id);
    if (!fixture) throw new Error(`Unknown fixture: ${id}`);
    return fixture;
  });
  const strategies = Object.keys(config.strategies ?? {});
  if (strategies.length === 0 || strategies.some((value) => !["A", "B"].includes(value)))
    throw new Error("Invalid strategy selection");
  const results = [];
  for (const fixture of selectedFixtures) {
    const positive = evaluateCandidateSource(fixture.id, fixture.reference_source);
    const negative = evaluateCandidateSource(fixture.id, fixture.broken_source);
    for (const strategy of strategies) {
      const prompt = promptFor(fixture, strategy);
      results.push({
        fixture_id: fixture.id,
        category: fixture.category,
        strategy,
        prompt,
        prompt_utf8_bytes: Buffer.byteLength(prompt, "utf8"),
        prompt_sha256: createHash("sha256").update(prompt).digest("hex"),
        model: null,
        model_cli_version: null,
        live_status: "NOT RUN",
        fixture_reference: positive,
        negative_control: negative,
        model_metrics: {
          task_success_rate: null,
          test_pass_rate: null,
          repair_rounds: null,
          unexpected_file_modifications: null,
          hallucinated_apis: null,
          latency_ms: null,
          tokens: null,
          cost_usd: null,
          tool_calls: null,
          human_intervention: null,
          final_code_quality: null,
        },
      });
    }
  }
  return {
    schema_version: 1,
    recorded_at: new Date().toISOString(),
    mode: "OFFLINE_TRUSTED_FIXTURE_VALIDATION",
    live_evaluation: "NOT RUN",
    status: results.every(
      (row) => row.fixture_reference.status === "PASS" && row.negative_control.status === "FAIL",
    )
      ? "PASS"
      : "FAIL",
    scope:
      "4 類 × 2 prompt strategy 的可執行基礎；沒有模型生成，不能比較模型或 prompt 成效。TypeScript transpile 不等於專案 typecheck；physics fixture 不是 Rapier/browser 驗證。",
    results,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = evaluateFixtures();
  report.source_hashes = Object.fromEntries(
    ["fixtures.mjs", "acceptance.mjs", "evaluate.mjs", "evaluation-config.json"].map((name) => [
      name,
      createHash("sha256")
        .update(readFileSync(path.join(base, name)))
        .digest("hex"),
    ]),
  );
  const outputDirectory = path.join(base, "results");
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    `offline-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(
    JSON.stringify({
      status: report.status,
      fixture_count: fixtures.length,
      prompt_variants: report.results.length,
      live: report.live_evaluation,
      artifact: outputPath,
    }),
  );
  if (report.status !== "PASS") process.exitCode = 1;
}
