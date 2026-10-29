import test from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, TEMPLATE_NAMES } from "./render.mjs";

const values = {
  TASK_CONTRACT_JSON: { id: "fixture-task", objective: "繁體中文目標" },
  RUN_STATE_JSON: { state: "HANDOFF_PENDING" },
  REPAIR_TASK_JSON: { defects: [] },
  HANDOFF_JSON: { remaining_work: ["finish"] },
};

test("all pinned templates render with supplied objects", () => {
  assert.equal(TEMPLATE_NAMES.length, 11);
  for (const name of TEMPLATE_NAMES) {
    const rendered = renderTemplate(name, values);
    assert.ok(rendered.length > 100);
    assert.doesNotMatch(rendered, /\{\{[A-Z_]+\}\}/);
  }
});

test("renderer rejects arbitrary path access and inherited object keys", () => {
  for (const name of ["../AGENTS.md", "D:/private.txt", "__proto__", "toString"]) {
    assert.throws(() => renderTemplate(name, values), /Unknown prompt template/);
  }
});

test("required task and handoff inputs cannot be silently omitted", () => {
  assert.throws(() => renderTemplate("muse/implementation"), /Missing prompt token/);
  assert.throws(
    () => renderTemplate("muse/codex-fallback", { TASK_CONTRACT_JSON: {} }),
    /RUN_STATE_JSON/,
  );
});

test("serialized task strings parse as JSON and preserve Unicode", () => {
  const rendered = renderTemplate("muse/implementation", {
    TASK_CONTRACT_JSON: JSON.stringify(values.TASK_CONTRACT_JSON),
  });
  assert.match(rendered, /繁體中文目標/);
  assert.throws(
    () => renderTemplate("muse/implementation", { TASK_CONTRACT_JSON: "invalid" }),
    SyntaxError,
  );
});

test("task data containing token syntax does not trigger recursive substitution", () => {
  const rendered = renderTemplate("muse/implementation", {
    TASK_CONTRACT_JSON: { objective: "literal {{HANDOFF_JSON}}" },
  });
  assert.match(rendered, /literal \{\{HANDOFF_JSON\}\}/);
});

test("renderer rejects scalar data and unbounded payloads", () => {
  for (const value of [null, [], 42, true, "null", "[]"]) {
    assert.throws(
      () => renderTemplate("muse/implementation", { TASK_CONTRACT_JSON: value }),
      /JSON object/,
    );
  }
  assert.throws(
    () => renderTemplate("muse/implementation", { TASK_CONTRACT_JSON: { x: "a".repeat(262145) } }),
    /256 KiB/,
  );
});
