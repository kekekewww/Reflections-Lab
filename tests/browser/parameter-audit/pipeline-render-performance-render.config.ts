import { defineConfig } from "@playwright/test";
const auditAttempt = (process.env.PIPELINE_RENDER_AUDIT_ATTEMPT ?? "initial").replace(
  /[^A-Za-z0-9_.-]/g,
  "-",
);
export default defineConfig({
  testDir: ".",
  testMatch: "pipeline-render-performance-render.spec.ts",
  timeout: 150_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["line"],
    ["json", { outputFile: `test-results/parameter-audit-render-results-${auditAttempt}.json` }],
  ],
  outputDir: `../../../test-results/parameter-audit-render/${auditAttempt}`,
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
