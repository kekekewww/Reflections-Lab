import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

/** A solo browser fixture; native ownership is never replaced or granted by this harness. */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "pointerlock-race.spec.ts",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/pointerlock-race-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/pointerlock-race",
  use: { ...base.use, baseURL: "http://127.0.0.1:5174" },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --outDir test-results/ui-preview-dist --host 127.0.0.1 --port 5174 --strictPort",
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
