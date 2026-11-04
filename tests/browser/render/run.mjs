import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = process.cwd();
const server = await createServer({
  configFile: false,
  cacheDir: root + "/.cache/render-vite",
  root,
  server: { port: 5348, strictPort: true, host: "127.0.0.1" },
});
const output =
  "docs/14-core-pipeline/stages/06-render-browser-" +
  new Date().toISOString().replace(/[:.]/g, "") +
  ".json";
await mkdir("docs/14-core-pipeline/stages", { recursive: true });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-first-run"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5348/tests/browser/render/index.html");
  await page.waitForFunction(() => typeof window.runRenderValidation === "function", {
    timeout: 30000,
  });
  const result = await page.evaluate(() =>
    Promise.race([
      window.runRenderValidation(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("RENDER_BROWSER_TIMEOUT")), 60000),
      ),
    ]),
  );
  const files = [
    "src/audio/render-backend.ts",
    "src/audio/render-contract.ts",
    "src/audio/render-pcm.ts",
    "src/audio/render-preset.ts",
    "src/audio/render-types.ts",
    "src/audio/render-validation.ts",
    "src/audio/engine.ts",
    "src/audio/routes.ts",
    "tests/audio-runtime/render-fixture.ts",
    "tests/browser/render/fixture.mjs",
    "tests/browser/render/run.mjs",
  ];
  const sources = await Promise.all(
    files.map(async (path) => {
      const bytes = await readFile(path);
      return { path, sha256: createHash("sha256").update(bytes).digest("hex") };
    }),
  );
  const evidence = {
    ...result,
    errors,
    revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceState: "Working render changes on audio seam commit; exact hashes below",
    browserVersion: browser.version(),
    sources,
  };
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(
    JSON.stringify({
      output,
      status: result.status,
      checks: result.checks.map((value) => ({ id: value.id, pass: value.pass })),
      errors,
    }),
  );
  if (result.status !== "PASS" || errors.length) process.exitCode = 1;
} catch (error) {
  await writeFile(
    output,
    JSON.stringify({ status: "ERROR", error: String(error), stack: error.stack }, null, 2) + "\n",
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
