import assert from "node:assert/strict";
import test from "node:test";
import * as dock from "../../src/ui/AnalysisDock.js";
import { messages } from "../../src/ui/locales/index.js";
import type { LabViewModel } from "../../src/ui/contracts.js";

type Input = Pick<LabViewModel, "acoustic" | "paths">;
const classify = (value: Input) => {
  const fn = (dock as unknown as { acousticPathPresentation?: (model: Input) => string })
    .acousticPathPresentation;
  assert.equal(typeof fn, "function");
  return fn!(value);
};
const input = (state: LabViewModel["acoustic"]["state"], revision: number | null): Input => ({
  acoustic: {
    backend: "actual-test",
    model: "numericalApproximation",
    state,
    revision,
    metrics: [],
  },
  paths: [],
});

test("presentation separates no result from an explicitly unsupported result", () => {
  assert.equal(classify(input("unsupported", null)), "idle");
  assert.equal(classify(input("unsupported", 0)), "unsupported");
});

test("presentation distinguishes computed empty paths from unavailable propagation", () => {
  assert.equal(classify(input("ready", 0)), "empty");
  assert.equal(classify(input("unavailable", 0)), "unavailable");
  const value = input("ready", 0);
  value.paths = [{ id: "solver.stable-id" } as LabViewModel["paths"][number]];
  assert.equal(classify(value), "ready");
});

test("presentation preserves pending, stale and error even without paths or a revision", () => {
  for (const state of ["pending", "stale", "error"] as const) {
    assert.equal(classify(input(state, null)), state);
    assert.equal(classify(input(state, 0)), state);
  }
});

test("bilingual unavailable reason, no-result and solved-empty help remain distinct", () => {
  for (const locale of ["zh-TW", "en"] as const) {
    const reason = messages["analysis.paths.unavailableHelp"][locale];
    assert.match(reason, locale === "en" ? /vacuum/i : /真空/);
    assert.notEqual(
      messages["analysis.paths.idleHelp"][locale],
      messages["analysis.paths.emptyHelp"][locale],
    );
    assert.ok(messages["analysis.paths.selectionUnavailable"][locale].length > 0);
  }
});
