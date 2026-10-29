import test from "node:test";
import assert from "node:assert/strict";
import { validationOutput } from "../../scripts/validation/validation-output.mjs";

test("validation reports use fresh Phase3 paths and cannot overwrite previous phase evidence", () => {
  assert.equal(
    validationOutput([], new Date("2026-10-26T15:00:01.234Z")),
    "benchmarks/results/phase3-validation-2026-10-26T15-00-01-234Z.json",
  );
  assert.equal(
    validationOutput(["--output", "benchmarks/results/phase3-final.json"]),
    "benchmarks/results/phase3-final.json",
  );
  for (const file of [
    "benchmarks/results/phase2-validation-local.json",
    "benchmarks/results/validation-local.json",
    "benchmarks/results/phase1-validation-preserved.json",
    "../outside.json",
    "benchmarks/results/../secret.json",
    "C:\\temp\\output.json",
    "benchmarks/results/file.json/child.json",
  ])
    assert.throws(() => validationOutput(["--output", file]));
  assert.throws(() => validationOutput(["--unknown"]));
  assert.throws(() => validationOutput(["--output", "benchmarks/results/x.json", "extra"]));
});
