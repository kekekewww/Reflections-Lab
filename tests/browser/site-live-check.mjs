// Checks the deployed site from outside. It types nothing into the key field. The one Meta probe uses a
// deliberately invalid token sent by script, which Meta refuses before any model runs.
// Usage: node tests/browser/site-live-check.mjs [site URL] [screenshot path]
import { chromium } from "@playwright/test";
import https from "node:https";

const ROOT = process.argv[2] ?? "https://reflection-lab-dmd.pages.dev/";
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok) });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail).slice(0, 260)}`}`,
  );
};
const get = (pathname) =>
  new Promise((resolve, reject) => {
    https
      .get(new URL(pathname, ROOT), (res) => {
        let body = "";
        res.on("data", (d) => {
          if (body.length < 400) body += d;
        });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      })
      .on("error", reject);
  });
(async () => {
  let home;
  for (let i = 0; i < 12; i++) {
    home = await get("/").catch(() => null);
    if (home?.status === 200) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  check("the home page answers", home?.status === 200, home?.status);
  const csp = home.headers["content-security-policy"] ?? "";
  check(
    "Cloudflare sends the network rules",
    csp.includes("connect-src 'self' https://api.meta.ai") &&
      csp.includes("script-src 'self' 'unsafe-eval'") &&
      csp.includes("frame-ancestors 'none'"),
  );
  check(
    "no-sniff, no-referrer and frame headers are sent",
    home.headers["x-content-type-options"] === "nosniff" &&
      home.headers["referrer-policy"] === "no-referrer" &&
      home.headers["x-frame-options"] === "DENY",
  );
  const script =
    /src="(\/assets\/index-[^"]+\.js)"/.exec(home.body)?.[1] ??
    (await get("/")).body.match(/\/assets\/index-[^"]+\.js/)?.[0];
  const asset = await get(script);
  check(
    "scripts are served with long caching",
    asset.status === 200 && /immutable/.test(asset.headers["cache-control"] ?? ""),
    { script, cache: asset.headers["cache-control"] },
  );
  const map = await get(`${script}.map`);
  check("source maps aren't served", map.status === 404, map.status);
  const headersFile = await get("/_headers");
  check("the _headers file isn't served", headersFile.status === 404, headersFile.status);
  const api = await get("/api/agent/status");
  check(
    "unknown paths give the 404 page",
    api.status === 404 && /Page not found/.test(api.body),
    api.status,
  );
  const notices = await get("/third-party-notices.txt");
  check(
    "licence notices are served",
    notices.status === 200 && /Third-party software/.test(notices.body),
    notices.status,
  );

  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  const page = await context.newPage();
  const errors = [];
  const meta = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 220)));
  page.on("request", (r) => {
    if (r.url().includes("api.meta.ai")) meta.push(r.method());
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.goto(ROOT);
  await page.getByRole("combobox", { name: /Interface language/ }).selectOption("en");
  const expand = button("Expand experiment panel");
  if (await expand.count()) await expand.click();
  await button("Enable listening").click({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page
    .getByRole("tab", { name: /^Acoustic paths/ })
    .first()
    .click();
  await button("Start simulation").first().click();
  await page.waitForTimeout(5000);
  const body = await page.locator("body").innerText();
  const level = /\bL\s+(-?[\d.]+|-∞)\s+dBFS/.exec(body)?.[1] ?? null;
  const paths = /Acoustic paths\s*\n?\s*(\d+)/.exec(body)?.[1] ?? null;
  check(
    "physics, the solver worker and audio run on the live site",
    level !== null && Number(paths) > 0,
    { level, paths },
  );
  await button("Pause").first().click();
  await page.waitForTimeout(300);
  await page
    .getByRole("tab", { name: /^Meta experiment agent/ })
    .first()
    .click();
  await page.waitForTimeout(400);
  check(
    "offline tools are the default, and no Meta call has happened",
    (await page.getByLabel("AI execution mode").inputValue()) === "offline" && meta.length === 0,
  );
  await page.getByLabel("AI execution mode").selectOption("meta");
  const field = page.locator("#experiment-agent-key");
  await field.waitFor({ timeout: 5000 });
  const help = await page.locator("#experiment-agent-key-help").innerText();
  check(
    "the key field is there, empty and masked",
    (await field.getAttribute("type")) === "password" && (await field.inputValue()) === "",
    help.slice(-60),
  );
  check("the help text gives the advice", /separate key/.test(help) && /api\.meta\.ai/.test(help));
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });

  const probe = await page.evaluate(async () => {
    const out = {};
    try {
      await window.fetch("https://example.com/", { mode: "no-cors" });
      out.otherSite = "allowed";
    } catch {
      out.otherSite = "blocked";
    }
    try {
      const reply = await window.fetch("https://api.meta.ai/v1/chat/completions", {
        method: "POST",
        credentials: "omit",
        headers: {
          Authorization: "Bearer deliberately-invalid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "muse-spark-1.3",
          messages: [{ role: "user", content: "ping" }],
          max_completion_tokens: 1,
        }),
      });
      out.meta = reply.status;
    } catch (error) {
      out.meta = String(error).slice(0, 120);
    }
    return out;
  });
  check("the live page can't reach other sites", probe.otherSite === "blocked", probe.otherSite);
  check(
    "the live page can reach Meta, which refuses the invalid token",
    probe.meta === 401,
    probe.meta,
  );
  const violations = (await page.evaluate(() => window.__violations)).filter(
    (v) => !v.includes("example.com"),
  );
  check("no rule violations and no page errors", violations.length === 0 && errors.length === 0, {
    violations,
    errors,
  });
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`DONE ${results.length - failed} of ${results.length} live checks passed.`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.log("STOPPED", String(error).slice(0, 500));
  process.exit(1);
});
