import { defineConfig } from "@playwright/test";
import { dirname, basename, resolve } from "node:path";
import agent from "../parameter-audit/pipeline-agent-audit.config.js";
import dock from "../parameter-audit/pipeline-dock-paths-comparison.config.js";
import events from "../parameter-audit/pipeline-events-audit.config.js";
import motion from "../parameter-audit/pipeline-motion-audit.config.js";
import zones from "../parameter-audit/pipeline-zones-audit.config.js";
import render from "../parameter-audit/pipeline-render-performance-render.config.js";
import tail from "../parameter-audit/pipeline-render-performance-tail-validation.config.js";
import diagnostics from "../parameter-audit/pipeline-render-performance-diagnostics.config.js";
import combined from "../parameter-audit/pipeline-render-performance-combined.config.js";
import help from "../parameter-audit/pipeline-help-sweep-audit.config.js";

const configurations = {
  agent,
  dock,
  events,
  motion,
  zones,
  render,
  tail,
  diagnostics,
  combined,
  help,
};
const name = process.env.S4_LEGACY_CONFIG as keyof typeof configurations;
if (
  !name ||
  !(name in configurations) ||
  !process.env.S4_LEGACY_SPEC ||
  !process.env.S4_LANE_OUTPUT ||
  !process.env.S4_BROWSER_EXECUTABLE
)
  throw new Error("S4_LEGACY_METADATA_REQUIRED");
const { webServer: _server, ...legacy } = configurations[name];
/** Preserve legacy tests/expectations. Only metadata, browser identity and artifact destinations change. */
export default defineConfig({
  ...legacy,
  testDir: dirname(process.env.S4_LEGACY_SPEC),
  testMatch: basename(process.env.S4_LEGACY_SPEC),
  workers: 1,
  fullyParallel: false,
  retries: 0,
  outputDir: resolve(process.env.S4_LANE_OUTPUT, "playwright-artifacts"),
  reporter: [
    ["line"],
    ["json", { outputFile: resolve(process.env.S4_LANE_OUTPUT, "playwright-results.json") }],
  ],
  use: {
    ...legacy.use,
    baseURL: "http://127.0.0.1:4173",
    acceptDownloads: true,
    serviceWorkers: "block",
    launchOptions: {
      ...legacy.use?.launchOptions,
      executablePath: process.env.S4_BROWSER_EXECUTABLE,
    },
  },
});
