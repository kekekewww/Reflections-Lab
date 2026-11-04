import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const attempt = (process.env.MOTION_AUDIT_ATTEMPT ?? "current").replace(/[^A-Za-z0-9_.-]/g, "-");
export default defineConfig({
  testDir: ".",
  testMatch: "pipeline-motion-audit.spec.ts",
  timeout: 120_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL(
            `../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/motion/playwright-${attempt}.json`,
            import.meta.url,
          ),
        ),
      },
    ],
  ],
  outputDir: `../../../test-results/parameter-audit-motion/${attempt}`,
  use: {
    baseURL: "http://127.0.0.1:4173",
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
