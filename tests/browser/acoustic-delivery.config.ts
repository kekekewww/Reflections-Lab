import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "acoustic-delivery.spec.ts",
  timeout: 60_000,
  outputDir: "../../test-results/acoustic-delivery",
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/acoustic-delivery-results.json", import.meta.url),
        ),
      },
    ],
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:5187" },
  webServer:
    process.env.REFLECTION_ACOUSTIC_EXTERNAL_SERVER === "1"
      ? undefined
      : {
          command:
            "node node_modules/vite/bin/vite.js preview --outDir test-results/acoustic-delivery-dist --host 127.0.0.1 --port 5187 --strictPort",
          cwd: fileURLToPath(new URL("../..", import.meta.url)),
          url: "http://127.0.0.1:5187/tests/browser/acoustic-delivery-harness.html",
          reuseExistingServer: true,
          timeout: 30_000,
        },
});
