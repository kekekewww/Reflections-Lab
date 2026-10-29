import test from "node:test";
import assert from "node:assert/strict";
import { loadValidators } from "../../scripts/validation/schemas.mjs";

test("repository schema gate compiles all four agent contracts alongside original schemas", () => {
  const validators = loadValidators();
  for (const name of ["task", "implementation-result", "verification-result", "repair-task"]) {
    assert.equal(typeof validators.get(`agents/${name}.schema.json`), "function", name);
  }
  assert.equal(typeof validators.get("scene.schema.json"), "function");
  assert.equal(typeof validators.get("wiki-task.schema.json"), "function");
  const validate = validators.get("agents/implementation-result.schema.json");
  assert.equal(validate({ executor: "MUSE", success: true }), false);
});
