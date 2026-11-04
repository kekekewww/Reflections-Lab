import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const runName = process.env.TOP_MONITOR_RUN_NAME ?? "attempt01";
if (!/^attempt\d{2}(?:-[a-z0-9-]+)?$/.test(runName))
  throw new Error("TOP_MONITOR_RUN_NAME_INVALID");
const resultRoot = new URL(
  `../../test-results/top-monitor-production-${runName}/`,
  import.meta.url,
);

/** Root owns the frozen production build/server; this suite never rebuilds or starts one. */
export default defineConfig({
  testDir: ".",
  testMatch: "top-monitor-production.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: fileURLToPath(new URL("cases", resultRoot)),
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(new URL("results.json", resultRoot)),
      },
    ],
  ],
  use: {
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
});
