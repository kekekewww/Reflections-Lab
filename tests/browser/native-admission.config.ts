import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import preview from "./ui-preview.config.js";

/** Root schedules this only against a frozen preview; the native budget override is test-only. */
export default defineConfig({
  ...preview,
  testMatch: "native-admission.spec.ts",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/native-admission-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/native-admission",
});
