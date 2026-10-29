import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

/** Verify the built app without development HMR interrupting input ownership. */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "ui.spec.ts",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/ui-preview-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/ui-preview",
  use: { ...base.use, baseURL: "http://127.0.0.1:5174" },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --outDir test-results/ui-preview-dist --host 127.0.0.1 --port 5174 --strictPort",
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
