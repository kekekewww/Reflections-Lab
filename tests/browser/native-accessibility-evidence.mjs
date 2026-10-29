import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const destination = "tests/browser/native-accessibility-evidence/20261027";
fs.mkdirSync(destination, { recursive: true });
const stored = [];
function copy(source, name) {
  const bytes = fs.readFileSync(source),
    target = path.join(destination, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  stored.push({ source, path: target, sha256: sha256(bytes) });
  return target;
}
function decodeReport(source, label) {
  const report = JSON.parse(fs.readFileSync(source, "utf8"));
  const cases = [];
  function walk(suite) {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests) {
        for (const [index, result] of test.results.entries()) {
          const attachments = [];
          for (const attachment of result.attachments ?? []) {
            if (!attachment.body || attachment.contentType !== "application/json") continue;
            const bytes = Buffer.from(attachment.body, "base64");
            const name = `${label}/case-${cases.length + 1}-${index}-${attachment.name}`;
            const target = path.join(destination, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, bytes);
            stored.push({
              source: `${source}#${attachment.name}`,
              path: target,
              sha256: sha256(bytes),
            });
            attachments.push(target);
          }
          cases.push({
            title: spec.title,
            status: result.status,
            durationMs: result.duration,
            errors: result.errors,
            attachments,
          });
        }
      }
    for (const child of suite.suites ?? []) walk(child);
  }
  walk(report);
  return { source, sourceSha256: sha256(fs.readFileSync(source)), stats: report.stats, cases };
}
const inputs = decodeReport(
  "test-results/native-accessibility-browser-results.json",
  "inputs-pass",
);
const initialInputs = decodeReport(
  "test-results/native-accessibility/inputs-initial-20261027/results.json",
  "inputs-initial",
);
const composition = decodeReport(
  "test-results/native-accessibility/cdp-composition-initial-20261027/results.json",
  "cdp-composition",
);
const zooms = [];
for (const stamp of [
  "2026-10-27T05-51-39.324Z",
  "2026-10-27T05-54-10.330Z",
  "2026-10-27T06-01-44.449Z",
]) {
  const source = `test-results/native-accessibility/${stamp}`;
  const result = JSON.parse(fs.readFileSync(`${source}/verification.json`, "utf8"));
  copy(`${source}/verification.json`, `zoom-${stamp}/verification.json`);
  for (const name of ["baseline-page.png", "failure-page.png"])
    if (fs.existsSync(`${source}/${name}`)) copy(`${source}/${name}`, `zoom-${stamp}/${name}`);
  zooms.push({
    stamp,
    status: result.status,
    browserVersion: result.browserVersion,
    checks: result.checks.map((item) => ({ id: item.id, status: item.status })),
    error: result.error,
    nativeZoomAuthority: result.nativeZoomAuthority,
    baseline: result.baseline,
    zoom200: result.zoom200,
    cleanup: result.cleanup,
  });
}
copy(
  "test-results/native-accessibility/2026-10-27T06-01-44.449Z/frozen-build-manifest.json",
  "frozen-build-manifest.json",
);
copy("test-results/native-accessibility/process-cleanup.json", "process-cleanup.json");
copy("test-results/native-accessibility/tabs-capability.json", "tabs-capability.json");
copy(
  "test-results/native-accessibility/tabs-capability-native-focus.json",
  "tabs-capability-native-focus.json",
);
copy("test-results/native-accessibility/extension-capability.json", "extension-capability.json");
copy(
  "test-results/native-accessibility/2026-10-27T06-03-14.367Z/verification.json",
  "native-menu-unavailable.json",
);
const summary = {
  schemaVersion: 1,
  finalizedAt: new Date().toISOString(),
  status: "PARTIAL_WITH_RETAINED_FAILURES",
  frozenInputDigest: "9ae2ca2eb7508be78a0fcfa96ef99e1543189a644b6f3c1057d10d3c78664176",
  manifestSha256: "10d1fcb0f8b3514b03c1793ea32095bc6a192e84af8bf6e5fa215af9e0cd3839",
  sourceStability: {
    before: "zero input/bundle hash mismatches",
    afterCheckedAt: "2026-10-27T06:04:58Z",
    after:
      "zero input/bundle hash mismatches before NATIVEEND; later root resource repair is outside this run",
  },
  commands: [
    "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5174 --strictPort --outDir test-results/ui-preview-dist",
    "node tests/browser/native-accessibility-automatic.mjs http://127.0.0.1:5174 test-results/ui-preview-build.json",
    "node node_modules/@playwright/test/cli.js test --config tests/browser/native-accessibility.config.ts",
    "node node_modules/@playwright/test/cli.js test --config tests/browser/native-accessibility-cdp-composition.config.ts",
    "node tests/browser/native-accessibility-menu.mjs http://127.0.0.1:5174 test-results/ui-preview-build.json",
  ],
  inputs,
  initialInputs,
  composition,
  zooms,
  nativeMenu: {
    status: "NOT_RUN",
    harnessResult: "FAIL/explicit abort",
    reason:
      "Computer-use list_apps/list_windows exposed no task Chrome window; no native zoom action was sent. Helper windowsHide:true is a possible fixture cause; not yet validated.",
  },
  limitations: [
    "Automatic zoom API/DPR/viewport and four keyboard criteria are observed, but overall zoom suite remains FAIL at native Pointer Lock and favicon.ico404 is also retained without filtering.",
    "CDP native-widget start/update/input events were trusted and actual commit/cancel values passed, but both compositionend events were isTrusted:false. The strict case remains FAIL; it is not OS IME evidence.",
    "OS IME candidate window, screen reader and human hearing tests are NOT_RUN.",
    "Native browser input evidence does not prove complete V1, numerical physics/acoustic accuracy, real GPU performance, or live Meta output.",
  ],
  stored,
};
fs.writeFileSync(path.join(destination, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(
  JSON.stringify({
    destination,
    inputs: inputs.stats,
    composition: composition.stats,
    zoomRuns: zooms.length,
    stored: stored.length,
  }),
);
