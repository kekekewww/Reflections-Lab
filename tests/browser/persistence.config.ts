import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

/** The managed runner owns the isolated Vite process; discovery never starts a server. */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "persistence.spec.ts",
  workers: 1,
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/storage-browser-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/storage-browser",
  use: { ...base.use, baseURL: "http://127.0.0.1:5178" },
  webServer: [],
});
