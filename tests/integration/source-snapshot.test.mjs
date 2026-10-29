import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { snapshotValidationInputs } from "../../scripts/validation/source-snapshot.mjs";

function fixture(work) {
  const prefix = path.join(tmpdir(), "reflection-lab-validation-inputs-");
  const root = mkdtempSync(prefix);
  const write = (name, text = name) => {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), text);
  };
  for (const name of [
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
  ])
    mkdirSync(path.join(root, name), { recursive: true });
  for (const name of [
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
  ])
    write(name);
  try {
    work({ root, write });
  } finally {
    assert.ok(
      path.resolve(root).startsWith(path.resolve(prefix)),
      "remove only this test's mkdtemp directory",
    );
    rmSync(root, { recursive: true, force: true });
  }
}

test("validation stamps executable helpers, CSS, configs and fixed JSON inputs and detects mutations", () => {
  fixture(({ root, write }) => {
    const inputs = [
      "scripts/validation/helper.mjs",
      "tests/audio-runtime/fake-context.ts",
      "tests/browser/local.config.ts",
      "tests/fixtures/fixed.json",
      "src/ui/styles.css",
      "benchmarks/fixtures/analytical.json",
      "benchmarks/muse/evaluate.mjs",
      "experiments/sound-behavior-spike/physics-policy.mjs",
      "third_party/emil-skills.manifest.json",
      "tests/audio-runtime/native-wave.ts",
      "public/favicon.svg",
      "artifacts/v1/authored-report/README.md",
      "artifacts/v1/source-before/ACCEPTANCE.md",
    ];
    for (const name of inputs) write(name);
    const initial = snapshotValidationInputs(root);
    const names = new Set(initial.map((value) => value.path));
    for (const name of inputs) assert.ok(names.has(name), `${name} is a validation input`);
    for (const name of inputs) {
      write(name, "changed input");
      assert.notDeepEqual(
        snapshotValidationInputs(root),
        initial,
        `${name} mutation must invalidate the stamp`,
      );
      write(name);
    }
    write("tests/fixtures/new-input.json");
    assert.notDeepEqual(
      snapshotValidationInputs(root),
      initial,
      "new inputs must also be detected",
    );
  });
});

test("known generated result writes do not conceal changes to test sources", () => {
  fixture(({ root, write }) => {
    write("tests/sound-behaviors/contracts.test.mjs");
    write("tests/sound-behaviors/latest-validation.json", "old output");
    write("tests/audio-runtime/native-wave-20261027.json", "old native output");
    write("experiments/physics-spike/results.json", "old physics output");
    write("experiments/sound-behavior-spike/physics-results-2026-10-27.json", "old probe output");
    write("benchmarks/muse/results/offline-20261027.json", "old offline output");
    write("artifacts/v1/validation-run/verification.json", "old verification output");
    write("tests/browser/test-results/sound-diagnostics-results.json", "old browser output");
    write("tests/browser/test-results/static-preview-results.json", "old browser output");
    const initial = snapshotValidationInputs(root);
    write("tests/sound-behaviors/latest-validation.json", "new output");
    write("tests/audio-runtime/native-wave-20261027.json", "new native output");
    write("experiments/physics-spike/results.json", "new physics output");
    write("experiments/sound-behavior-spike/physics-results-2026-10-27.json", "new probe output");
    write("benchmarks/muse/results/offline-20261027.json", "new offline output");
    write("artifacts/v1/validation-run/verification.json", "new verification output");
    write("tests/browser/test-results/sound-diagnostics-results.json", "new browser output");
    write("tests/browser/test-results/static-preview-results.json", "new browser output");
    assert.deepEqual(snapshotValidationInputs(root), initial);
    write("tests/browser/test-results/fixture.json", "new input");
    assert.notDeepEqual(
      snapshotValidationInputs(root),
      initial,
      "other files in the same directory remain stamped",
    );
    rmSync(path.join(root, "tests/browser/test-results/fixture.json"));
    assert.deepEqual(snapshotValidationInputs(root), initial);
    write("tests/sound-behaviors/contracts.test.mjs", "changed test");
    assert.notDeepEqual(snapshotValidationInputs(root), initial);
    assert.match(
      readFileSync(path.join(root, "tests/sound-behaviors/latest-validation.json"), "utf8"),
      /new output/,
    );
  });
});
