import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const root = await realpath(fileURLToPath(new URL("../../../../", import.meta.url)));
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--corpus" || args[2] !== "--out")
  throw new Error(
    "Usage: node tests/browser/nonadvanced/acoustic-abcd/run.mjs --corpus <Node attempt/corpus/corpus.json> --out <fresh directory>",
  );
const corpusPath = await realpath(path.resolve(args[1])),
  out = path.resolve(args[3]);
for (const target of [corpusPath, out]) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("PATH_OUTSIDE_WORKSPACE");
}
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile(corpusPath),
  manifest = JSON.parse(manifestBytes);
if (manifest.format !== "acoustic-abcd/1" || !manifest.rows.length || manifest.rows.length > 4096)
  throw new Error("CORPUS_FORMAT");
// Refuse stale sources rather than mixing a recorded reference with changed product code.
for (const pin of manifest.sourcePins) {
  const relative = path.normalize(pin.path);
  if (path.isAbsolute(relative) || relative.startsWith("..")) throw new Error("PIN_PATH");
  if (hash(await readFile(path.join(root, relative))) !== pin.sha256)
    throw new Error(`STALE_SOURCE:${pin.path}`);
}
const allowed = new Map([
  [
    "corpus.json",
    { path: path.basename(corpusPath), sha256: hash(manifestBytes), bytes: manifestBytes.length },
  ],
  ...manifest.rows.map((entry) => [entry.path, entry]),
]);
for (const entry of manifest.rows)
  if (!/^row-\d{5}\.json$/.test(entry.path)) throw new Error("CORPUS_ROW_PATH");
let server, browser, timer;
try {
  // Only an owned Vite dev server on a free loopback port. Never builds, runs npm, or attaches to another server/browser.
  server = await createServer({
    root,
    configFile: false,
    cacheDir: path.join(out, "vite-cache"),
    // ajv ships CommonJS; pre-bundle it so the solver schema import has its named export.
    optimizeDeps: { noDiscovery: true, include: ["ajv/dist/2020.js"] },
    server: { host: "127.0.0.1", port: 0, strictPort: true },
    plugins: [
      {
        name: "owned-acoustic-corpus",
        configureServer(vite) {
          vite.middlewares.use((request, response, next) => {
            const prefix = "/__abcd-corpus__/";
            if (!request.url?.startsWith(prefix)) return next();
            const entry = allowed.get(request.url.slice(prefix.length));
            if (!entry) {
              response.statusCode = 404;
              response.end();
              return;
            }
            void readFile(path.join(path.dirname(corpusPath), entry.path))
              .then((bytes) => {
                if (hash(bytes) !== entry.sha256 || bytes.length !== entry.bytes)
                  throw new Error("CORPUS_HASH");
                response.setHeader("Content-Type", "application/json");
                response.setHeader("Cache-Control", "no-store");
                response.end(bytes);
              })
              .catch((error) => {
                response.statusCode = 500;
                response.end(String(error));
              });
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1")
    throw new Error("LOOPBACK_REQUIRED");
  browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 20000 });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.exposeFunction("saveABCD", async (result) => {
    if (
      !["A", "B", "C", "D"].includes(result.arm) ||
      !Number.isInteger(result.repetition) ||
      result.repetition < 0 ||
      result.repetition > 3
    )
      throw new Error("RESULT_IDENTITY");
    await writeFile(
      path.join(out, `raw-${result.repetition}-${result.arm}.json`),
      JSON.stringify(result, null, 2),
    );
  });
  await page.goto(
    `http://127.0.0.1:${address.port}/tests/browser/nonadvanced/acoustic-abcd/index.html`,
    { waitUntil: "load", timeout: 20000 },
  );
  await page.waitForFunction(() => typeof window.runABCD === "function");
  const summary = await Promise.race([
    page.evaluate(() => window.runABCD()),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("CHROME_ABCD_DEADLINE")), 10 * 60 * 1000);
    }),
  ]);
  await writeFile(
    path.join(out, "summary.json"),
    JSON.stringify(
      {
        ...summary,
        browserVersion: browser.version(),
        corpusSha256: hash(manifestBytes),
        sourcePins: manifest.sourcePins,
        node: process.version,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length || summary.differences.length) process.exitCode = 1;
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
} catch (error) {
  await writeFile(
    path.join(out, "failure.json"),
    JSON.stringify({ error: String(error), stack: error.stack }, null, 2),
  );
  throw error;
} finally {
  clearTimeout(timer);
  // Each cleanup has a deadline; Vite and Chrome resources belong only to this invocation.
  const bounded = async (operation, label) => {
    let timeout;
    try {
      await Promise.race([
        operation(),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error(label)), 10000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };
  try {
    if (browser) await bounded(() => browser.close(), "CHROME_CLOSE_TIMEOUT");
  } finally {
    if (server) await bounded(() => server.close(), "VITE_CLOSE_TIMEOUT");
  }
}
