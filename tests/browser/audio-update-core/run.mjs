import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const out = path.resolve(
  process.argv[2] || path.join(root, ".cache/audio-update-core/summary.json"),
);
const sourcePaths = [
  "src/audio/engine.ts",
  "src/audio/routes.ts",
  "src/audio/control.ts",
  "src/audio/route-response.ts",
  "src/audio/diagnostics.ts",
  "src/audio/types.ts",
  "tests/browser/audio-update-core/fixture.ts",
  "tests/browser/audio-update-core/run.mjs",
];
const files = [];
for (const relativePath of sourcePaths) {
  const bytes = await readFile(path.join(root, relativePath));
  files.push({
    path: relativePath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const server = await createServer({
  root,
  logLevel: "warn",
  cacheDir: path.join(root, ".cache/vite-audio-update"),
  server: { host: "127.0.0.1", port: 5216, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("http://127.0.0.1:5216/tests/browser/audio-update-core/fixture.html");
  await page.waitForFunction(() => Boolean(window.__audioUpdateCore), null, { timeout: 60000 });
  const result = await page.evaluate(() => window.__audioUpdateCore);
  const summary = {
    ...result,
    recordedAt: new Date().toISOString(),
    browser: browser.version(),
    node: process.version,
    command: "node tests/browser/audio-update-core/run.mjs <summary.json>",
    pageErrors,
    files,
  };
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(summary, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify({
      status: summary.status,
      cases: summary.results.length,
      pageErrors,
      output: out,
    }) + "\n",
  );
  if (summary.status !== "PASS" || pageErrors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
