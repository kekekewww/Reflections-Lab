import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "pipeline-zones-audit.spec.ts",
  timeout: 150_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  maxFailures: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: "test-results/parameter-audit-pipeline-zones.json" }],
  ],
  outputDir: "../../../test-results/parameter-audit-pipeline-zones",
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: "on",
    screenshot: "only-on-failure",
    acceptDownloads: true,
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
