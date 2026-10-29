import { defineConfig } from "@playwright/test";
import base from "./product-e2e.config.js";

export default defineConfig({
  ...base,
  testMatch: "product-e2e-refined-v2.spec.ts",
});
