import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.js";

const selection = process.env.PRODUCT_BROWSER_CHANNEL ?? "chrome";
const observerLight = (process.env.PRODUCT_OBSERVER_PROFILE ?? "light") === "light";
const gpuProfile = process.env.PRODUCT_GPU_PROFILE ?? "default";
if (!["swiftshader", "default"].includes(gpuProfile))
  throw new Error("Unsupported product GPU profile");
if (
  process.env.PRODUCT_OBSERVER_PROFILE &&
  !["light", "instrumented"].includes(process.env.PRODUCT_OBSERVER_PROFILE)
)
  throw new Error("Unsupported product observer profile");
if (!["chrome", "msedge", "firefox", "webkit"].includes(selection))
  throw new Error("Unsupported product browser selection");
const engine = selection === "firefox" ? "firefox" : selection === "webkit" ? "webkit" : "chromium";
const resultsDirectory = selection === "chrome" ? "product-e2e" : `product-e2e-${selection}`;
const browserUse = { ...base.use };
delete browserUse.channel;
const chromiumLaunchOptions = {
  ...browserUse.launchOptions,
  args: (browserUse.launchOptions?.args ?? []).filter(
    (arg) =>
      gpuProfile !== "default" ||
      !/^--use-gl(?:=|$)|^--use-angle(?:=|$)|^--enable-unsafe-swiftshader$/.test(arg),
  ),
};
const productBase = { ...base };
delete productBase.webServer;

export default defineConfig({
  ...productBase,
  testDir: ".",
  testMatch: "product-e2e.spec.ts",
  timeout: 90_000,
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: fileURLToPath(
          new URL(`../../test-results/${resultsDirectory}/results.json`, import.meta.url),
        ),
      },
    ],
  ],
  outputDir: `../../test-results/${resultsDirectory}/cases`,
  use: {
    ...browserUse,
    browserName: engine,
    ...(engine === "chromium"
      ? { channel: selection as "chrome" | "msedge", launchOptions: chromiumLaunchOptions }
      : { launchOptions: {} }),
    baseURL: "http://127.0.0.1:5190",
    video: observerLight ? "off" : "retain-on-failure",
    trace: observerLight ? "off" : "retain-on-failure",
  },
});
