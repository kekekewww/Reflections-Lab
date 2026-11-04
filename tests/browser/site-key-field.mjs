// Serves the hosted build the way Cloudflare Pages would, _headers included, with Meta's API mocked,
// and uses the key field in a real browser. The key is a fixture. Nothing reaches Meta.
// Usage: npm run build:site, then node tests/browser/site-key-field.mjs [chromium|brave|firefox|webkit] [--no-audio]
// Results and screenshots go to .cache/site-key-field. The process exits 1 if a check fails.
import { chromium, firefox, webkit } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const SITE = path.resolve("dist-site");
const OUT = process.env.SITE_KEY_FIELD_OUT ?? ".cache/site-key-field";
const BROWSER = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "chromium";
const AUDIO = !process.argv.includes("--no-audio");
const PORT = 8799;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const KEY = "fixture-not-a-real-browser-key";
const BRAVE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "BraveSoftware/Brave-Browser/Application/brave.exe",
);
const HAN = /\p{Script=Han}/u;
fs.mkdirSync(OUT, { recursive: true });

function parseHeaders(text) {
  const rules = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: {} };
      rules.push(current);
    } else {
      const colon = line.indexOf(":");
      current.headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }
  return rules;
}
const RULES = parseHeaders(fs.readFileSync(path.join(SITE, "_headers"), "utf8"));
const headersFor = (pathname) =>
  Object.assign(
    {},
    ...RULES.filter((r) => pathname.startsWith(r.pattern.replace(/\*$/, ""))).map((r) => r.headers),
  );
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};
const served = [];
const leaks = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  served.push(`${req.method} ${url.pathname}`);
  if ((req.url + JSON.stringify(req.headers)).includes(KEY))
    leaks.push(`site server saw the key: ${req.url}`);
  let file = path.join(SITE, decodeURIComponent(url.pathname));
  if (url.pathname === "/") file = path.join(SITE, "index.html");
  const hidden = path.basename(file) === "_headers";
  if (!hidden && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
      ...headersFor(url.pathname),
    });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8", ...headersFor(url.pathname) });
    fs.createReadStream(path.join(SITE, "404.html")).pipe(res);
  }
});

// Mock of Meta's API, with the same browser permission headers the real one sent.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
};
const metaCalls = [];
const script = [];
let replies = 0;
const toolReply = (calls, text = "Adding it.") => ({
  id: `response.site-${++replies}`,
  model: "muse-spark-1.3",
  choices: [
    {
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: text,
        tool_calls: calls.map(([name, args], i) => ({
          id: `call.${replies}-${i}`,
          type: "function",
          function: { name, arguments: JSON.stringify(args) },
        })),
      },
    },
  ],
  usage: { prompt_tokens: 120, completion_tokens: 60 },
});
const box = (id, materialId = "material.wood") => [
  "AddObject",
  {
    objectId: id,
    label: id,
    shape: "box",
    dimensionsM: [0.5, 0.5, 0.5],
    positionM: [2, 0.25, 2],
    orientationQuaternion: [0, 0, 0, 1],
    materialId,
    mode: "fixed",
    massKg: 5,
  },
];
const hanging = [];
async function metaRoute(route) {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
  const body = req.postData() ?? "";
  const headers = await req.allHeaders();
  metaCalls.push({
    url: req.url(),
    method: req.method(),
    authorization: headers.authorization ?? null,
    origin: headers.origin ?? null,
    cookie: headers.cookie ?? null,
    referer: headers.referer ?? null,
    body,
  });
  if (body.includes(KEY)) leaks.push("the key was inside a request body");
  const next = script.shift() ?? { status: 500, json: { error: { code: "unexpected_call" } } };
  if (next.abort) return route.abort("failed");
  if (next.hang) {
    hanging.push(route);
    return undefined;
  }
  return route.fulfill({
    status: next.status ?? 200,
    headers: { ...CORS, "content-type": "application/json" },
    body: JSON.stringify(next.json),
  });
}

const results = [];
const failures = [];
const note = (entry) => {
  results.push(entry);
  console.log(JSON.stringify(entry).slice(0, 900));
};
const check = (name, ok, detail) => {
  if (!ok) failures.push(name);
  note({ check: name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
};

const launch = async (dir) => {
  const common = { viewport: { width: 1600, height: 1000 } };
  if (BROWSER === "firefox") {
    const browser = await firefox.launch({
      headless: true,
      firefoxUserPrefs: { "media.autoplay.default": 0, "webgl.force-enabled": true },
    });
    return { context: await browser.newContext(common), close: () => browser.close() };
  }
  if (BROWSER === "webkit") {
    const browser = await webkit.launch({ headless: true });
    return { context: await browser.newContext(common), close: () => browser.close() };
  }
  if (BROWSER === "chromium") {
    const browser = await chromium.launch({
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    return { context: await browser.newContext(common), close: () => browser.close() };
  }
  const context = await chromium.launchPersistentContext(dir, {
    executablePath: BRAVE,
    headless: false,
    viewport: null,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1700,1050",
      "--window-position=30,30",
    ],
  });
  return { context, close: () => context.close() };
};

const scanStorage = async (page) =>
  page.evaluate(async (key) => {
    const found = {};
    found.html = document.documentElement.outerHTML.includes(key);
    found.fields = [...document.querySelectorAll("input,textarea")].some((e) =>
      e.value.includes(key),
    );
    found.url = location.href.includes(key);
    found.cookie = document.cookie.includes(key);
    found.localStorage = JSON.stringify({ ...localStorage }).includes(key);
    found.sessionStorage = JSON.stringify({ ...sessionStorage }).includes(key);
    found.indexedDB = false;
    const names = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : [];
    for (const name of names) {
      const db = await new Promise((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      for (const store of db.objectStoreNames) {
        const rows = await new Promise((resolve, reject) => {
          const all = db.transaction(store).objectStore(store).getAll();
          all.onsuccess = () => resolve(all.result);
          all.onerror = () => reject(all.error);
        });
        const text = JSON.stringify(rows, (_k, v) =>
          v instanceof ArrayBuffer || ArrayBuffer.isView(v) || v instanceof Blob ? undefined : v,
        );
        if (text && text.includes(key)) found.indexedDB = true;
      }
      db.close();
    }
    found.caches = false;
    if (self.caches) {
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys())
          if (req.url.includes(key)) found.caches = true;
      }
    }
    return { found, indexedDBs: names.length };
  }, KEY);

(async () => {
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rl-site-key-"));
  const { context, close } = await launch(dir);
  const errors = [];
  const failed = [];
  try {
    await context.route("https://api.meta.ai/**", metaRoute);
    await context.addInitScript(() => {
      window.__violations = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`),
      );
      // Records any busy error, however briefly it shows.
      window.__busySeen = 0;
      new MutationObserver((records) => {
        for (const record of records) {
          const text = record.target.textContent ?? "";
          if (text.length < 2000 && text.includes("TRANSACTION_BUSY")) window.__busySeen++;
          for (const node of record.addedNodes)
            if ((node.textContent ?? "").includes("TRANSACTION_BUSY")) window.__busySeen++;
        }
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    const page = await context.newPage();
    for (const other of context.pages()) if (other !== page) await other.close().catch(() => {});
    const watch = (p) => {
      p.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
      p.on("console", (m) => {
        const text = m.text();
        if (text.includes(KEY)) leaks.push(`console: ${text.slice(0, 120)}`);
        if (m.type() === "error" && !/status of (401|500)/.test(text))
          errors.push(text.slice(0, 300));
      });
      p.on("response", (r) => {
        if (r.status() >= 400 && r.url().startsWith(ORIGIN))
          failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
      });
    };
    watch(page);
    const shot = (n) => page.screenshot({ path: `${OUT}/${BROWSER}-${n}.png` });
    const button = (name) => page.getByRole("button", { name, exact: true });
    const tab = (re) => page.getByRole("tab", { name: re }).first();
    const status = () => page.locator("#experiment-agent-provider-status").innerText();
    const keyInput = page.locator("#experiment-agent-key");
    const submit = page.locator(".agent-form button[type=submit]");
    const prompt = page.locator("#experiment-agent-prompt");
    const objects = () => page.locator(".object-row").count();
    const agentMessage = async () =>
      (await page.locator(".agent-message").allInnerTexts()).join(" | ");
    const panelBusy = async () => (await submit.getAttribute("aria-busy")) === "true";
    const waitIdle = async () => {
      for (let i = 0; i < 80 && (await panelBusy()); i++) await page.waitForTimeout(250);
    };

    const first = await page.goto(`${ORIGIN}/`);
    const csp = first.headers()["content-security-policy"] ?? "";
    check(
      "the page is served with the network rules",
      csp.includes("connect-src 'self' https://api.meta.ai"),
      csp.slice(0, 90),
    );
    await page.getByRole("combobox", { name: /Interface language/ }).selectOption("en");
    const expand = button("Expand experiment panel");
    if (await expand.count()) await expand.click();

    if (AUDIO) {
      await button("Enable listening").click({ timeout: 30000 });
      await page.waitForTimeout(800);
      await tab(/^Acoustic paths/).click();
      await button("Start simulation").first().click();
      await page.waitForTimeout(5000);
      const body = await page.locator("body").innerText();
      const level = /\bL\s+(-?[\d.]+|-∞)\s+dBFS/.exec(body)?.[1] ?? null;
      const paths = /Acoustic paths\s*\n?\s*(\d+)/.exec(body)?.[1] ?? null;
      check(
        "physics, the solver worker and audio run under the network rules",
        level !== null && Number(paths) > 0,
        { level, paths },
      );
      await shot("1-running");
      await button("Pause").first().click();
      await page.waitForTimeout(300);
    }

    await tab(/^Meta experiment agent/).click();
    await page.waitForTimeout(600);
    const mode = page.getByLabel("AI execution mode");
    check(
      "no key field or request while offline tools are selected",
      (await keyInput.count()) === 0 && metaCalls.length === 0,
    );
    check(
      "offline status points to Muse",
      /choose Meta Model API/.test(await status()),
      await status(),
    );
    check(
      "no server status button on the hosted site",
      (await button("Check server status again").count()) === 0,
    );
    await shot("2-offline");

    await mode.selectOption("meta");
    await keyInput.waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    check(
      "the field hides what you type and asks browsers not to autofill",
      (await keyInput.getAttribute("type")) === "password" &&
        (await keyInput.getAttribute("autocomplete")) === "off" &&
        (await keyInput.getAttribute("spellcheck")) === "false",
    );
    check(
      "without a key, submitting is disabled",
      /Enter your own Meta API key/.test(await status()),
      await status(),
    );
    await prompt.fill("Add a small wooden box on the floor.");
    check("the submit button stays off without a key", !(await submit.isEnabled()));
    const help = await page.locator("#experiment-agent-key-help").innerText();
    check("the help text is shown", /api\.meta\.ai/.test(help), help);
    await shot("3-needs-key");

    await keyInput.fill("two words");
    await button("Use key").click();
    await page.waitForTimeout(200);
    const alert = await page
      .locator(".agent-key-field [role=alert]")
      .innerText()
      .catch(() => "");
    check(
      "a malformed key is refused with a message",
      /doesn't look like an API key/.test(alert),
      alert,
    );
    await shot("4-invalid");
    await keyInput.fill("");

    const beforeTyping = await page.locator("body").innerText();
    await keyInput.click();
    await page.keyboard.type(KEY);
    const afterTyping = await page.locator("body").innerText();
    check(
      "typing a key doesn't trigger app shortcuts",
      /Start simulation|Resume simulation/.test(afterTyping) ===
        /Start simulation|Resume simulation/.test(beforeTyping) &&
        (await keyInput.inputValue()) === KEY,
    );
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    check("using the key clears the field", (await keyInput.count()) === 0);
    check(
      "the panel shows the key is in use",
      (await button("Forget key").count()) === 1 && /Muse is ready/.test(await status()),
      await status(),
    );
    check(
      "focus moves to the instruction box",
      (await page.evaluate(() => document.activeElement?.id)) === "experiment-agent-prompt",
    );
    check("no Meta request until an instruction is submitted", metaCalls.length === 0);
    const held = await scanStorage(page);
    check(
      "the key isn't in the page, URL, cookies or browser storage",
      !Object.values(held.found).some(Boolean),
      held,
    );
    await shot("5-key-in-use");

    const objectsBefore = await objects();
    script.push({ json: toolReply([box("box.site-one")]) });
    await prompt.fill("Add a small wooden box on the floor.");
    await submit.click();
    await page.locator(".agent-preview").waitFor({ timeout: 30000 });
    check(
      "a proposal comes back as a preview",
      metaCalls.length === 1 && (await objects()) === objectsBefore,
    );
    const call = metaCalls[0];
    check(
      "the request went to Meta with the visitor's key and no cookies or referrer",
      call.url === "https://api.meta.ai/v1/chat/completions" &&
        call.authorization === `Bearer ${KEY}` &&
        call.origin === ORIGIN &&
        !call.cookie &&
        !call.referer,
      {
        ...call,
        body: undefined,
        authorization:
          call.authorization === `Bearer ${KEY}` ? "fixture as expected" : "unexpected",
      },
    );
    const sent = JSON.parse(call.body);
    check(
      "the request uses the planned model settings",
      sent.model === "muse-spark-1.3" &&
        sent.parallel_tool_calls === true &&
        sent.reasoning_effort === "medium",
    );
    await shot("6-preview");
    await page.locator(".agent-preview .primary-button").first().click();
    await page.waitForTimeout(1200);
    check("Apply adds the object", (await objects()) === objectsBefore + 1, {
      before: objectsBefore,
      after: await objects(),
    });
    const undo = button("Undo last AI apply");
    await undo.click();
    await page.waitForTimeout(800);
    check("Undo takes it back", (await objects()) === objectsBefore);

    const calls2 = metaCalls.length;
    script.push(
      { json: toolReply([box("box.site-two", "material.missing")]) },
      { json: toolReply([box("box.site-two")]) },
    );
    await prompt.fill("Add a second box.");
    await submit.click();
    await page.locator(".agent-preview").waitFor({ timeout: 30000 });
    check(
      "a failed check goes back to Muse in the browser",
      metaCalls.length === calls2 + 2 &&
        /material\.missing|MATERIAL|UNKNOWN/i.test(
          JSON.stringify(JSON.parse(metaCalls.at(-1).body).messages),
        ),
      { calls: metaCalls.length - calls2 },
    );
    await page.getByRole("button", { name: "Cancel preview" }).click();
    await page.waitForTimeout(400);

    script.push({
      status: 401,
      json: {
        error: { code: "invalid_api_key", message: "Unauthorized", type: "authentication_error" },
      },
    });
    await prompt.fill("Add a third box.");
    await submit.click();
    await page.waitForTimeout(300);
    await waitIdle();
    let shown = await agentMessage();
    check(
      "a refused key gets a plain English message",
      /Meta rejected this key/.test(shown) && !HAN.test(shown) && !shown.includes(KEY),
      shown,
    );
    await shot("7-refused");

    const calls3 = metaCalls.length;
    script.push({
      status: 401,
      json: {
        error: { code: "invalid_api_key", message: "Unauthorized", type: "authentication_error" },
      },
    });
    await prompt.fill("Raise the pitch of the ball's impact sound by 7 semitones.");
    await submit.click();
    await page.waitForTimeout(300);
    await waitIdle();
    check(
      "sound instructions go through the same browser path",
      metaCalls.length === calls3 + 1 &&
        metaCalls.at(-1).body.includes("ProposeSoundBehavior") &&
        metaCalls.at(-1).authorization === `Bearer ${KEY}`,
    );

    script.push({ abort: true });
    await prompt.fill("Add a fourth box.");
    await submit.click();
    await page.waitForTimeout(300);
    await waitIdle();
    shown = await agentMessage();
    check(
      "a blocked or failed connection gets a plain English message",
      /Couldn't confirm whether Meta replied/.test(shown) && !HAN.test(shown),
      shown,
    );

    script.push({ hang: true });
    await prompt.fill("Add a fifth box.");
    await submit.click();
    await page.waitForTimeout(600);
    check("a request is running", await panelBusy());
    await button("Forget key").click();
    await page.waitForTimeout(800);
    shown = await agentMessage();
    check(
      "Forget key stops a running request",
      !(await panelBusy()) && /stopped/i.test(shown) && !HAN.test(shown),
      shown,
    );
    check(
      "Forget key returns to the empty field",
      (await keyInput.count()) === 1 &&
        (await keyInput.inputValue()) === "" &&
        /Enter your own Meta API key/.test(await status()),
      await status(),
    );
    check(
      "focus returns to the field",
      (await page.evaluate(() => document.activeElement?.id)) === "experiment-agent-key",
    );
    check("submitting is off again", !(await submit.isEnabled()));
    const pageText = await page.locator("body").innerText();
    check(
      "forgetting mid-request raises no busy error",
      !/TRANSACTION_BUSY|Wait for the current transaction/.test(pageText),
    );
    await shot("8-forgotten");
    for (const route of hanging.splice(0)) await route.abort("failed").catch(() => {});

    // A page-cache event, the case where the page would otherwise come back with its memory intact.
    const leavePage = () =>
      page.evaluate(() =>
        window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
      );
    await keyInput.fill(KEY);
    await leavePage();
    check("leaving the page clears a typed key", (await keyInput.inputValue()) === "");
    await keyInput.fill(KEY);
    await button("Use key").click();
    await page.waitForTimeout(300);
    await leavePage();
    await page.waitForTimeout(300);
    check(
      "leaving the page clears a key in use",
      (await button("Forget key").count()) === 0 && (await keyInput.count()) === 1,
    );

    await keyInput.fill(KEY);
    await button("Use key").click();
    await page.waitForTimeout(300);
    check(
      "no busy error appeared at any point before the reload",
      (await page.evaluate(() => window.__busySeen)) === 0,
      await page.evaluate(() => window.__busySeen),
    );
    await page.reload();
    await page.waitForTimeout(2000);
    const violationsBeforeReload = await page.evaluate(() => window.__violations);
    await tab(/^Meta experiment agent/).click();
    await page.waitForTimeout(400);
    await page.getByLabel("AI execution mode").selectOption("meta");
    await keyInput.waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    check(
      "a reload clears the key",
      (await keyInput.inputValue()) === "" &&
        (await button("Forget key").count()) === 0 &&
        /Enter your own Meta API key/.test(await status()),
      await status(),
    );
    const after = await scanStorage(page);
    check(
      "nothing about the key survives a reload",
      !Object.values(after.found).some(Boolean),
      after,
    );

    await page.getByRole("combobox", { name: /Interface language|介面語言/ }).selectOption("zh-TW");
    await page.waitForTimeout(400);
    await shot("9-traditional-chinese");
    const zh = await page.locator(".agent-key-field").innerText();
    check(
      "the field reads in Traditional Chinese",
      HAN.test(zh) && zh.includes("api.meta.ai"),
      zh.slice(0, 120),
    );
    await page.getByRole("combobox", { name: /Interface language|介面語言/ }).selectOption("en");

    if (AUDIO) {
      // The rest of the app, under the same rules, after the key is gone.
      const callsBefore = metaCalls.length;
      await page.getByLabel("AI execution mode").selectOption("offline");
      await page.waitForTimeout(400);
      await prompt.fill("ball impact audio quiet");
      await submit.click();
      await page.locator(".agent-preview").waitFor({ timeout: 15000 });
      check("offline tools work and call nothing", metaCalls.length === callsBefore);
      await page.getByRole("button", { name: "Cancel preview" }).click();
      await page.waitForTimeout(300);

      await tab(/^Events & recording/).click();
      await page.waitForTimeout(300);
      await page
        .getByRole("button", { name: /Start recording/ })
        .first()
        .click();
      await page.waitForTimeout(4000);
      await page
        .getByRole("button", { name: /Stop recording/ })
        .first()
        .click();
      const replay = page.getByRole("button", { name: /Replay recording/ }).first();
      let replayReady = false;
      for (let i = 0; i < 20 && !replayReady; i++) {
        await page.waitForTimeout(1000);
        replayReady = (await replay.count()) > 0 && (await replay.isEnabled());
      }
      check("recording seals under the network rules", replayReady);
      await replay.click();
      await page.waitForTimeout(2000);
      const endReplay = page.getByRole("button", { name: /End replay/ }).first();
      check("replay runs under the network rules", (await endReplay.count()) > 0);
      await endReplay.click().catch(() => {});
      await page.waitForTimeout(600);

      await button("Reset")
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(600);
      await button("Enter first person").first().click();
      await page.waitForTimeout(1500);
      check(
        "first person opens under the network rules",
        (await page.locator("body").innerText()).includes("First-person interaction"),
      );
      await shot("9b-first-person");
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(300);
      const exit = button("Exit first person");
      if (await exit.count())
        await exit
          .first()
          .click()
          .catch(() => {});
      await page.waitForTimeout(500);
      await tab(/^Meta experiment agent/).click();
      await page.getByLabel("AI execution mode").selectOption("meta");
      await keyInput.waitFor({ timeout: 5000 });
    }

    await page.setViewportSize({ width: 1100, height: 720 }).catch(() => {});
    await page.waitForTimeout(300);
    const overflow = await page
      .locator(".agent-key-field")
      .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    check("the field fits a smaller window", overflow.scroll <= overflow.client + 1, overflow);
    await shot("10-small-window");

    const probe = await page.evaluate(async () => {
      const get = async (u) => (await window.fetch(u)).status;
      const assets = performance
        .getEntriesByType("resource")
        .map((e) => new URL(e.name).pathname)
        .filter((p) => p.endsWith(".js") && p.startsWith("/assets/"));
      return {
        map: await get(`${assets[0]}.map`),
        headers: await get("/_headers"),
        notices: await get("/third-party-notices.txt"),
        api: await get("/api/agent/status"),
      };
    });
    check(
      "source maps and _headers aren't served; notices are",
      probe.map === 404 && probe.headers === 404 && probe.notices === 200,
      probe,
    );
    check(
      "the page never asked for the local API by itself",
      !served.filter((s) => s !== "GET /api/agent/status").some((s) => s.includes("/api/")) &&
        served.filter((s) => s === "GET /api/agent/status").length === 1,
    );
    const blocked = await page.evaluate(async () => {
      try {
        await window.fetch("https://example.com/", { mode: "no-cors" });
        return false;
      } catch {
        return true;
      }
    });
    check("the network rules block requests to other sites", blocked);
    await page.waitForTimeout(200);
    const finalViolations = (await page.evaluate(() => window.__violations)).filter(
      (v) => !v.includes("example.com"),
    );
    check(
      "no other rule violations",
      violationsBeforeReload.length === 0 && finalViolations.length === 0,
      { violationsBeforeReload, finalViolations },
    );
    check(
      "no busy error appeared after the reload",
      (await page.evaluate(() => window.__busySeen)) === 0,
      await page.evaluate(() => window.__busySeen),
    );
    check(
      "the key never appeared in logs, the site server or a request body",
      leaks.length === 0,
      leaks,
    );
    note({
      browserErrors: [...new Set(errors)]
        .filter(
          (e) =>
            !/example\.com|Content Security Policy|api\/agent\/status|_headers|\.map|404/.test(e),
        )
        .slice(0, 12),
      failedSiteRequests: [...new Set(failed)].slice(0, 12),
      metaCalls: metaCalls.length,
    });
  } catch (error) {
    failures.push("the script stopped early");
    note({
      stopped: String(error).slice(0, 300),
      errors: [...new Set(errors)].slice(0, 8),
      violations: await context
        .pages()[0]
        ?.evaluate(() => window.__violations)
        .catch(() => null),
      failed: [...new Set(failed)].slice(0, 8),
    });
    await context
      .pages()[0]
      ?.screenshot({ path: `${OUT}/${BROWSER}-stopped.png` })
      .catch(() => {});
  } finally {
    await close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    server.close();
  }
  fs.writeFileSync(`${OUT}/${BROWSER}-results.json`, JSON.stringify(results, null, 2));
  console.log(
    `DONE ${BROWSER}: ${results.filter((r) => r.check).length - failures.filter((f) => f !== "the script stopped early").length} of ${results.filter((r) => r.check).length} checks passed.${failures.length ? ` Failed: ${failures.join("; ")}` : ""}`,
  );
  process.exit(failures.length ? 1 : 0);
})();
