import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import preview from "./ui-preview.config.js";

/** Root schedules this suite against a frozen, freshly built preview; never invokes a model. */
export default defineConfig({
  ...preview,
  testMatch: "sound-diagnostics.spec.ts",
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL("../../test-results/sound-diagnostics-results.json", import.meta.url),
        ),
      },
    ],
  ],
  outputDir: "../../test-results/sound-diagnostics",
});
