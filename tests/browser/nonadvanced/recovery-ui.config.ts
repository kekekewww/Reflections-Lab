import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

if (
  !process.env.S4_FREEZE_PATH ||
  !process.env.S4_OUTPUT_ROOT ||
  !process.env.S4_LANE_OUTPUT ||
  !process.env.S4_BROWSER_EXECUTABLE
)
  throw new Error(
    "S4_ROOT_FREEZE_REQUIRED: use the S4 runner with an explicit production freeze and resource lease.",
  );

const selectedSpec = process.env.S4_CURRENT_SPEC ?? "recovery-ui.spec.ts";
if (!["recovery-ui.spec.ts", "top-monitor-s4.spec.ts"].includes(selectedSpec))
  throw new Error("S4_UNKNOWN_CURRENT_SPEC");

/** Root owns the already-running production preview. This config never builds or starts a server. */
export default defineConfig({
  testDir: ".",
  testMatch: selectedSpec,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: resolve(process.env.S4_LANE_OUTPUT, "playwright-artifacts"),
  reporter: [
    ["line"],
    ["json", { outputFile: resolve(process.env.S4_LANE_OUTPUT, "playwright-results.json") }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    serviceWorkers: "block",
    trace: "on",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.S4_BROWSER_EXECUTABLE,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
