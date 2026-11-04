import { APPROVED_QUALIFICATIONS_V4 } from "./performance-approved-qualifications-v4.mjs";

// Current collector inputs are a superset of the immutable semantic approval
// pins. Extending this inventory never edits that historical approval record.
export const V4_METHOD_SOURCE_PATHS = Object.freeze(
  [
    ...new Set([
      ...APPROVED_QUALIFICATIONS_V4.flatMap((record) =>
        record.requiredSourcePins.map((row) => row.path),
      ),
      "tests/browser/performance-method-v4.mjs",
      "tests/browser/run-performance-v4.mjs",
      "tests/browser/performance-profile-v4.mjs",
      "tests/browser/performance-profile-v3.mjs",
      "tests/browser/performance-profile.mjs",
      "tests/browser/performance-attribution-metrics-v1.mjs",
      "tests/browser/performance-cli-v3.mjs",
      "tests/browser/performance-cli-v4.mjs",
      "tests/browser/performance-approved-qualifications-v4.mjs",
      "tests/browser/performance-native-formal-v4.mjs",
      "tests/browser/performance-profile-contract-v4.mjs",
      "tests/browser/performance-process-cpu-v4.mjs",
      "tests/browser/performance-process-times-v4.mjs",
      "tests/browser/performance-process-times-v4.ps1",
      "tests/browser/performance-preview-listen-v4.mjs",
      "tests/browser/performance-observation-summary-v4.mjs",
      "tests/browser/performance-fixture-v4.mjs",
      "tests/browser/performance-fixture-v4.html",
      "tests/browser/performance-v4.vite.config.ts",
      "docs/16-nonadvanced-completion/lanes/performance/VERSIONED_APPROVAL_RECORD-V4-SEMANTIC-03.json",
    ]),
  ].sort(),
);
