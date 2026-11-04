import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

/** Trajectory editor flows against the e2e preview build (`node tests/browser/build-ui-preview.mjs`). */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "trajectory-editor.spec.ts",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/trajectory-editor-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/trajectory-editor",
  use: { ...base.use, baseURL: "http://127.0.0.1:5181" },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --outDir test-results/ui-preview-dist --host 127.0.0.1 --port 5181 --strictPort",
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    url: "http://127.0.0.1:5181",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
