import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import preview from "./ui-preview.config.js";

/** Root runs only after a coordinated source freeze and fresh preview build. */
export default defineConfig({
  ...preview,
  testMatch: "static-preview.spec.ts",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/static-preview-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/static-preview",
});
