import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const attempt = (process.env.PIPELINE_AGENT_ATTEMPT ?? "initial").replace(/[^a-z0-9_-]/gi, "_");
export default defineConfig({
  testDir: ".",
  testMatch: "pipeline-agent-audit.spec.ts",
  timeout: 150_000,
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
            `../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/agent/playwright-${attempt}.json`,
            import.meta.url,
          ),
        ),
      },
    ],
  ],
  outputDir: `../../../.cache/pipeline-agent-parameter-audit/${attempt}`,
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
