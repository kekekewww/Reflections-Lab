import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const attempt = (process.env.PIPELINE_DOCK_ATTEMPT ?? "initial").replace(/[^A-Za-z0-9_.-]/g, "-");
export default defineConfig({
  testDir: ".",
  testMatch: "pipeline-dock-paths-comparison.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL(
            `../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/dock/playwright-${attempt}.json`,
            import.meta.url,
          ),
        ),
      },
    ],
  ],
  outputDir: `../../../.cache/parameter-audit-pipeline-dock/${attempt}`,
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
