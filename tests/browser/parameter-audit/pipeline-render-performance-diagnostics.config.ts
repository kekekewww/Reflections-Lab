import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "pipeline-render-performance-diagnostics.spec.ts",
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: "test-results/parameter-audit-performance-diagnostics.json" }],
  ],
  outputDir: "../../../test-results/parameter-audit-performance-diagnostics",
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
});
