import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "pipeline-ui.spec.ts",
  reporter: [["line"], ["json", { outputFile: "test-results/pipeline-ui-results.json" }]],
  outputDir: "../../test-results/pipeline-ui",
  use: { ...base.use, baseURL: "http://127.0.0.1:5188" },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --mode e2e --host 127.0.0.1 --port 5188 --strictPort",
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    url: "http://127.0.0.1:5188",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
