import { defineConfig } from "@playwright/test";
import path from "node:path";
import base from "../../playwright.config.js";
const { webServer: _webServer, ...baseWithoutServer } = base;

/** Uses a separately owned frozen preview; no nested webServer process tree. */
export default defineConfig({
  ...baseWithoutServer,
  testDir: ".",
  testMatch: "native-accessibility.cases.ts",
  workers: 1,
  timeout: 30_000,
  globalTimeout: 180_000,
  use: {
    ...base.use,
    baseURL: process.env.NATIVE_ACCESSIBILITY_BASE_URL ?? "http://127.0.0.1:5174",
    headless: false,
    viewport: { width: 1440, height: 900 },
  },
  reporter: [
    ["line"],
    [
      "json",
      { outputFile: path.resolve("test-results/native-accessibility-browser-results.json") },
    ],
  ],
  outputDir: "../../test-results/native-accessibility-browser",
});
