import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "meta-ui-workflow.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["line"], ["json", { outputFile: "test-results/meta-ui-workflow-results.json" }]],
  outputDir: "../../test-results/meta-ui-workflow",
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: "on",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  // Connect to the independently built production preview; never start or rebuild it.
});
