import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const attempt = (process.env.PIPELINE_HELP_ATTEMPT ?? "unassigned").replace(
  /[^A-Za-z0-9_.-]/g,
  "-",
);
export default defineConfig({
  testDir: ".",
  testMatch: "pipeline-help-sweep-audit.spec.ts",
  timeout: 180_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL(
            `../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/help-sweep/playwright-${attempt}.json`,
            import.meta.url,
          ),
        ),
      },
    ],
  ],
  outputDir: `../../../.cache/pipeline-help-sweep/${attempt}/playwright`,
  use: {
    baseURL: "http://127.0.0.1:4173",
    actionTimeout: 10000,
    channel: "chrome",
    headless: true,
    viewport: { width: 1600, height: 1200 },
    acceptDownloads: true,
    trace: "on",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
