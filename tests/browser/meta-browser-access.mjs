// Asks real browsers whether a page may send an Authorization header to Meta's API.
// The token is a deliberately invalid fixture, so Meta refuses it before any model runs.
// Run by hand: node tests/browser/meta-browser-access.mjs. It isn't part of npm run check.
import { chromium, firefox, webkit } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const PORT = 8798;
const BRAVE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "BraveSoftware/Brave-Browser/Application/brave.exe",
);
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end("<!doctype html><title>cors probe</title>");
});
const probe = async () => {
  try {
    const response = await window.fetch("https://api.meta.ai/v1/chat/completions", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        Authorization: "Bearer fixture-not-a-real-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "muse-spark-1.3",
        messages: [{ role: "user", content: "ping" }],
        max_completion_tokens: 1,
      }),
    });
    return {
      reachedMeta: true,
      status: response.status,
      body: (await response.text()).slice(0, 140),
    };
  } catch (error) {
    return { reachedMeta: false, error: String(error).slice(0, 200) };
  }
};
async function viaPage(name, page) {
  const logs = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) logs.push(m.text().slice(0, 300));
  });
  await page.goto(`http://127.0.0.1:${PORT}/`);
  const result = await page.evaluate(probe);
  await page.waitForTimeout(300);
  console.log(
    JSON.stringify({
      browser: name,
      version: page.context().browser()?.version() ?? null,
      ...result,
      logs,
    }),
  );
}
(async () => {
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rl-cors-"));
  try {
    const brave = await chromium.launchPersistentContext(dir, {
      executablePath: BRAVE,
      headless: true,
      args: ["--no-first-run", "--no-default-browser-check"],
    });
    await viaPage("brave", await brave.newPage());
    await brave.close();
  } catch (error) {
    console.log("brave failed", String(error).slice(0, 300));
  }
  for (const [name, type] of [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ]) {
    try {
      const browser = await type.launch({ headless: true });
      await viaPage(name, await (await browser.newContext()).newPage());
      await browser.close();
    } catch (error) {
      console.log(
        JSON.stringify({ browser: name, notAvailable: String(error).split("\n")[0].slice(0, 120) }),
      );
    }
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  server.close();
  process.exit(0);
})();
