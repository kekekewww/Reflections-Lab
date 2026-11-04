import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const buildDirectory =
  process.env.RECORDING_READINESS_DIST ?? ".cache/recording-readiness/e2e-dist";
const buildReceiptPath =
  process.env.RECORDING_READINESS_BUILD_RECEIPT ??
  ".cache/recording-readiness/e2e-build-receipt.json";
if (!/^\.cache\/recording-readiness\/e2e-dist(?:-attempt[0-9]{2})?$/.test(buildDirectory))
  throw new Error("Invalid diagnostic build directory");
if (
  !/^\.cache\/recording-readiness\/e2e-build-(?:receipt|attempt[0-9]{2})\.json$/.test(
    buildReceiptPath,
  )
)
  throw new Error("Invalid diagnostic build receipt path");
const attempt = process.env.RECORDING_READINESS_ATTEMPT ?? "attempt01";
if (!/^attempt[0-9]{2}$/.test(attempt)) throw new Error("Invalid diagnostic attempt name");
const output = fileURLToPath(
  new URL(`../../../../test-results/recording-readiness-${attempt}/`, import.meta.url),
);
// Playwright reloads this configuration inside its worker after creating the output directory.
if (process.env.TEST_WORKER_INDEX === undefined && existsSync(output))
  throw new Error("Diagnostic attempt already exists; preserve it and choose a new attempt");

/** Root owns an e2e build and preview on 5241. This diagnostic never builds or starts a server. */
export default defineConfig({
  metadata: { recordingReadinessInputs: { buildDirectory, buildReceiptPath } },
  testDir: ".",
  testMatch: "diagnostic.spec.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: `${output}/cases`,
  reporter: [["line"], ["json", { outputFile: `${output}/results.json` }]],
  use: {
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    baseURL: "http://127.0.0.1:5241",
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    trace: "on",
    screenshot: "only-on-failure",
    video: "off",
  },
});
