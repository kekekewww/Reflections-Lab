import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptLegacyScript,
  adaptLegacyTestSource,
  selectLegacyCases,
} from "./s4-legacy-adapter.mjs";
const settings = {
  outputDirectory: "C:/task/new-output",
  cacheDirectory: "C:/task/cache",
  projectRoot: "C:/task",
  executablePath: "C:/Browser/chrome.exe",
  sourceCommit: "b".repeat(40),
  entryName: "index-current.js",
  publicActionIdentitySourcePins: [
    { path: "src/ui/Viewport.tsx", sha256: "1".repeat(64) },
    { path: "src/ui/locales/viewport.ts", sha256: "2".repeat(64) },
  ],
  scopeAmendment: {
    path: "docs/16-nonadvanced-completion/requests/TOP_MONITOR_REQUEST_20261103.json",
    sha256: "e".repeat(64),
  },
};

test("legacy port changes only recorded metadata and preserves all behavior assertions", () => {
  const original = `import assert from "node:assert/strict";\nimport { chromium } from "@playwright/test";\nconst out = "docs/old";\nconst receipt = {sourceCommit: "${"a".repeat(40)}", declaredEntry: "index-old.js"};\nconst browser = await chromium.launch({channel:"chrome", headless:true});\nassert.equal(35.5, 35.5, "temperature");\nassert.ok([receipt.declaredEntry].includes(receipt.declaredEntry));\n`;
  const result = adaptLegacyScript(original, settings);
  assert.ok(result.source.includes('executablePath: "C:/Browser/chrome.exe"'));
  assert.ok(result.source.includes('assert.equal(35.5, 35.5, "temperature")'));
  assert.ok(result.source.includes('"index-current.js"'));
  assert.equal(result.proof.assertionTextPreserved, true);
  assert.equal(result.proof.originalAssertionCount, 2);
  assert.notEqual(result.proof.originalSha256, result.proof.adaptedSha256);
});

test("legacy adapter refuses unknown structure, relative imports, and existing launch pins", () => {
  assert.throws(
    () => adaptLegacyScript("const browser=await chromium.launch({});", settings),
    /out declaration/,
  );
  assert.throws(
    () =>
      adaptLegacyScript(
        'import x from "./private.mjs"; const out="old"; const browser=await chromium.launch({});',
        settings,
      ),
    /Relative-import/,
  );
  assert.throws(
    () =>
      adaptLegacyScript(
        'const out="old"; const browser=await chromium.launch({executablePath:"old"});',
        settings,
      ),
    /existing browser pin/,
  );
});

test("every current legacy route can be ported without changing its behavior assertions", async () => {
  const { readFile } = await import("node:fs/promises");
  const { laneRegistry } = await import("./run-s4-ui.mjs");
  for (const lane of laneRegistry.filter((value) => value.kind !== "current")) {
    const source = await readFile(lane.source, "utf8");
    const result = (lane.kind === "mjs" ? adaptLegacyScript : adaptLegacyTestSource)(source, {
      ...settings,
      legacySourcePath: lane.source,
    });
    assert.equal(result.proof.behaviorAssertionsExceptApprovedSelectorsPreserved, true, lane.id);
    assert.ok(result.proof.originalAssertionCount > 0, lane.id);
  }
});

test("combined input fixture keeps its original pinned directory while outputs move to the new attempt", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    "tests/browser/parameter-audit/pipeline-render-performance-combined.spec.ts",
    "utf8",
  );
  const result = adaptLegacyTestSource(source, {
    ...settings,
    projectRoot: process.cwd(),
    legacySourcePath: "tests/browser/parameter-audit/pipeline-render-performance-combined.spec.ts",
  });
  const input = result.proof.edits.find((edit) => edit.kind === "immutable-fixture-root");
  const actualDirectory = JSON.parse(input.after);
  assert.ok(
    actualDirectory
      .replaceAll("\\", "/")
      .includes("docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render"),
  );
  const originalFixture = await readFile(
    "docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/render/final-combined-contract.json",
  );
  const { join } = await import("node:path");
  assert.deepEqual(
    await readFile(join(actualDirectory, "final-combined-contract.json")),
    originalFixture,
  );
  assert.ok(!input.after.includes("new-output"));
  assert.equal(result.proof.requiredFixturePaths.length, 1);
  assert.equal(result.proof.allNonPortCharactersPreserved, true);
});

test("approved 3D canvas identity port keeps every other assertion character and request proof", () => {
  const original = `import { test, expect } from "@playwright/test"; test("canvas",async({page})=>{ await expect(page.locator("canvas")).toBeVisible(); await expect(page.locator("canvas")).toHaveAttribute("width", "1600"); await expect(page.locator("canvas.annotation")).toHaveCount(2); });`;
  const result = adaptLegacyTestSource(original, settings);
  assert.ok(result.source.includes('locator(".viewport-canvas-wrap canvas")'));
  assert.ok(result.source.includes('locator("canvas.annotation")'));
  assert.equal(result.proof.assertionTextPreserved, false);
  assert.equal(result.proof.behaviorAssertionsExceptApprovedSelectorsPreserved, true);
  assert.equal(result.proof.approvedSelectorChanges.length, 2);
  assert.equal(result.proof.scopeAmendment.sha256, settings.scopeAmendment.sha256);
  assert.throws(
    () => adaptLegacyTestSource(original, { ...settings, scopeAmendment: null }),
    /scope.*authority|authority.*scope/i,
  );
});

test("removed navigation is filtered from current execution without modifying its historical source", async () => {
  const { readFile } = await import("node:fs/promises");
  const original = await readFile("tests/browser/parameter-audit/interaction-audit.mjs", "utf8");
  const result = selectLegacyCases(original, ["interaction.navigation"], settings.scopeAmendment);
  assert.equal(result.selectedCaseIds.length, 18);
  assert.ok(!result.selectedCaseIds.includes("interaction.navigation"));
  assert.ok(result.originalCaseIds.includes("interaction.navigation"));
  assert.equal(result.excluded[0].status, "SUPERSEDED_REMOVED");
  assert.equal(result.scopeAmendment.sha256, settings.scopeAmendment.sha256);
  assert.throws(
    () => selectLegacyCases(original, ["interaction.missing"], settings.scopeAmendment),
    /unknown|Unknown/,
  );
  assert.ok(original.includes('"02 Interactive experiment"'));
});
