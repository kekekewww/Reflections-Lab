import assert from "node:assert/strict";
import test from "node:test";
import { laneRegistry } from "./run-s4-ui.mjs";
import { adaptLegacyScript, adaptLegacyTestSource } from "./s4-legacy-adapter.mjs";
const settings = {
  outputDirectory: "C:/task/new-output",
  cacheDirectory: "C:/task/cache",
  projectRoot: "C:/task",
  executablePath: "C:/Browser/chrome.exe",
  sourceCommit: "b".repeat(40),
  entryName: "index-current.js",
  scopeAmendment: {
    path: "docs/16-nonadvanced-completion/requests/TOP_MONITOR_REQUEST_20261103.json",
    sha256: "e".repeat(64),
  },
  publicActionIdentitySourcePins: [
    { path: "src/ui/Viewport.tsx", sha256: "1".repeat(64) },
    { path: "src/ui/locales/viewport.ts", sha256: "2".repeat(64) },
  ],
};

test("audio monitor retest receives the same complete public asset path as the unchanged script assertion", () => {
  const lane = laneRegistry.find((value) => value.id === "audio-monitor-retest");
  assert.deepEqual(
    lane.args({ freeze: { entry: { path: "/assets/index-final-frozen.js" } }, tag: "fresh" }),
    ["/assets/index-final-frozen.js", "fresh"],
  );
});

test("diagnostics copied receipt identifies the current frozen source and entry with an explicit metadata edit", async () => {
  const { readFile } = await import("node:fs/promises");
  const path = "tests/browser/parameter-audit/pipeline-render-performance-diagnostics.spec.ts";
  const original = await readFile(path, "utf8");
  const result = adaptLegacyTestSource(original, { ...settings, legacySourcePath: path });
  assert.ok(
    result.source.includes(
      `${settings.sourceCommit} / ${settings.entryName} (actual network bytes separately pinned)`,
    ),
  );
  const change = result.proof.edits.find(
    (edit) =>
      edit.kind === "source-identity-metadata" && edit.before.includes("19db9f9 / index-BDGeI4Sd"),
  );
  assert.ok(change);
  assert.ok(change.after.includes(settings.sourceCommit));
  assert.equal(result.proof.behaviorAssertionsExceptApprovedSelectorsPreserved, true);
  assert.ok(original.includes("19db9f9 / index-BDGeI4Sd"));
});

test("held action selector identifies the existing bounded Gentle place action without changing the G outcome or original source", async () => {
  const { readFile } = await import("node:fs/promises");
  const path = "tests/browser/parameter-audit/interaction-priority.mjs",
    original = await readFile(path, "utf8");
  const result = adaptLegacyScript(original, { ...settings, legacySourcePath: path });
  assert.ok(result.source.includes('button("Gentle place").isDisabled()'));
  assert.ok(result.source.includes('await page.keyboard.press("g")'));
  assert.ok(result.source.includes("matching the G key."));
  const change = result.proof.edits.find(
    (edit) => edit.kind === "approved-accessible-action-identity",
  );
  assert.ok(change);
  assert.equal(change.before, '"Place"');
  assert.equal(change.after, '"Gentle place"');
  assert.deepEqual(
    result.proof.publicActionIdentitySourcePins,
    settings.publicActionIdentitySourcePins,
  );
  assert.equal(result.proof.behaviorAssertionsExceptApprovedSelectorsPreserved, true);
  assert.ok(original.includes('button("Place").isDisabled()'));
  assert.throws(
    () =>
      adaptLegacyScript(original, {
        ...settings,
        legacySourcePath: path,
        publicActionIdentitySourcePins: [],
      }),
    /action.*source|source.*action/i,
  );
});
