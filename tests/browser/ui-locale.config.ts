import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import preview from "./ui-preview.config.js";

/** Supplemental EN-01–04 proof; the frozen Chinese UI and product suites stay unchanged. */
export default defineConfig({
  ...preview,
  testMatch: "ui-locale.spec.ts",
  outputDir: "../../test-results/ui-locale",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/ui-locale-results.json", import.meta.url),
        ),
      },
    ],
  ],
});
