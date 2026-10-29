import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const runDirectory = path.resolve(
  root,
  process.env.RLAB_LINKED_RUN_DIR ?? "test-results/linked-workflow-v2",
);

export default defineConfig({
  testDir: ".",
  testMatch: ["linked-workflow-v2.spec.ts", "sound-diagnostics-refined-v3.spec.ts"],
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["line"], ["json", { outputFile: path.join(runDirectory, "run-results.json") }]],
  outputDir: path.join(runDirectory, "proofs"),
  use: {
    baseURL: "http://127.0.0.1:5296",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "on",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--mute-audio",
      ],
    },
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --outDir test-results/ui-preview-dist --host 127.0.0.1 --port 5296 --strictPort",
    cwd: root,
    url: "http://127.0.0.1:5296",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
