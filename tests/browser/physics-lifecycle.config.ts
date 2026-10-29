import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "physics-lifecycle.spec.ts",
  timeout: 120_000,
  workers: 1,
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/v1-physics-browser-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/v1-physics-browser",
  use: { ...base.use, baseURL: "http://127.0.0.1:5176" },
  webServer:
    process.env.V1_PHYSICS_SERVER_MANAGED === "1"
      ? []
      : {
          command:
            "node node_modules/vite/bin/vite.js --config tests/browser/physics-lifecycle.vite.config.ts",
          cwd: fileURLToPath(new URL("../..", import.meta.url)),
          url: "http://127.0.0.1:5176",
          reuseExistingServer: true,
          timeout: 30_000,
        },
});
