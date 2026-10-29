import { defineConfig } from "@playwright/test";
import base from "./ui-preview.config.js";

/** Current disclosure-based UI plus first-use and FPS ownership regressions. */
export default defineConfig({
  ...base,
  testMatch: [
    "ui-refined-v2.spec.ts",
    "ui-locale-refined-v2.spec.ts",
    "ui-first-use-refined-v2.spec.ts",
    "fps-entry-race-recovery.spec.ts",
  ],
  webServer: {
    ...base.webServer,
    reuseExistingServer: false,
  },
});
