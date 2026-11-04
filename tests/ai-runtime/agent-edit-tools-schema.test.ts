import test from "node:test";
import assert from "node:assert/strict";
import { MUTATION_TOOLS } from "../../src/ai/types.js";
import { localToolSchema, validateToolRequest } from "../../src/ai/validation.js";
import { createMetaFunctionTools } from "../../server/meta-provider.js";

const NEW_TOOLS = ["MoveObject", "ResizeObject", "RemoveObject"] as const;
const defs = localToolSchema.$defs as Record<string, Record<string, unknown>>;

test("the edit tools are scene mutations, so the Host stages and previews them", () => {
  for (const tool of NEW_TOOLS) assert.ok((MUTATION_TOOLS as readonly string[]).includes(tool));
});

test("the edit tools fit the provider's strict schema subset", () => {
  for (const tool of NEW_TOOLS) {
    const schema = defs[tool]!;
    assert.equal(schema.type, "object", tool);
    assert.equal(schema.additionalProperties, false, tool);
    assert.equal("oneOf" in schema || "allOf" in schema, false, tool);
    assert.deepEqual(
      [...(schema.required as string[])].sort(),
      Object.keys(schema.properties as object).sort(),
      tool,
    );
  }
});

test("the existing single-step planner still offers only its original tools", () => {
  const names = (createMetaFunctionTools() as { function: { name: string } }[]).map(
    (tool) => tool.function.name,
  );
  assert.deepEqual(names, [
    "CreateScene",
    "AddObject",
    "SetMaterial",
    "SetRigidBodyMode",
    "ConfigureSoundSource",
    "MoveListener",
    "SetTrajectory",
    "RunSimulation",
    "CaptureExperiment",
    "AnalyzeAcousticResults",
    "CompareExperiments",
  ]);
});

test("a read tool's arguments can't pass as an edit tool", () => {
  assert.throws(
    () =>
      validateToolRequest({
        schemaVersion: "1.0.0",
        requestId: "request.edit",
        tool: "MoveObject",
        sceneId: "scene.test",
        expectedSceneRevision: 0,
        transactionId: "transaction.edit",
        arguments: { objectId: "ball" },
      }),
    { code: "SCHEMA_INVALID" },
  );
});
