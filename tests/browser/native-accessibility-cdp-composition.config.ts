import { defineConfig } from "@playwright/test";
import path from "node:path";
import base from "./native-accessibility.config.js";

/** Separate from the five original input cases; experimental capability stays explicit. */
export default defineConfig({
  ...base,
  testMatch: "native-accessibility-cdp-composition.cases.ts",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: path.resolve("test-results/native-accessibility-cdp-composition-results.json"),
      },
    ],
  ],
  outputDir: "../../test-results/native-accessibility-cdp-composition",
});
