import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { readFile, mkdir, realpath, readdir } from "node:fs/promises";
import { appendFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPcm } from "./verify-pcm.mjs";

// Delivered for Claude. No build, existing server attachment, external host, or
// user browser/profile. Every resource is owned by this invocation.
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const args = process.argv.slice(2),
  inputIndex = args.indexOf("--input"),
  executableIndex = args.indexOf("--executable");
if (inputIndex < 0 || !args[inputIndex + 1])
  throw Error("--input <passing Node evidence directory> is required");
const cacheRoot = await realpath(path.join(root, ".cache/voice-asset"));
const input = await realpath(path.resolve(args[inputIndex + 1]));
if (!input.startsWith(cacheRoot + path.sep))
  throw Error("Input must be inside this worktree's .cache/voice-asset");
const directory = path.join(
  cacheRoot,
  `browser-${new Date().toISOString().replace(/[:.]/g, "")}-${randomUUID().slice(0, 8)}`,
);
await mkdir(directory);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const write = (name, value) =>
  writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const timers = new Set();
async function bounded(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(`DEADLINE:${label}`)), ms);
        timers.add(timer);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    timers.delete(timer);
  }
}
let server, browserServer, browser, context;
const started = performance.now(),
  token = randomUUID();
const evidence = {
  status: "RUNNING",
  input,
  directory,
  deadlinesMs: {
    whole: 120000,
    startup: 20000,
    fixture: 15000,
    renderAndDecode: 60000,
    cleanupEach: 5000,
  },
  pageErrors: [],
  cleanup: [],
};
const watchdog = setTimeout(() => {
  evidence.status = "FAIL";
  evidence.error = "WHOLE_PROCESS_DEADLINE";
  writeFileSync(path.join(directory, "watchdog.json"), JSON.stringify(evidence));
  browserServer?.process()?.kill();
  process.exit(124);
}, 120000);
let sourcePin;
async function verifyPins() {
  for (const [relative, sha256] of Object.entries(sourcePin.sources)) {
    const resolved = path.resolve(root, relative);
    if (
      !resolved.startsWith(path.resolve(root) + path.sep) ||
      hash(await readFile(resolved)) !== sha256
    )
      throw Error(`SOURCE_DRIFT:${relative}`);
  }
}
try {
  const summary = JSON.parse(await readFile(path.join(input, "summary.json"), "utf8"));
  if (summary.status !== "PASS") throw Error("Input Node comparison did not pass");
  sourcePin = JSON.parse(await readFile(path.join(input, "source-pins.json"), "utf8"));
  await verifyPins();
  write("source-pins.json", sourcePin);
  const manifest = JSON.parse(await readFile(path.join(input, "fixtures.json"), "utf8"));
  const allowed = new Map();
  for (const name of ["corpus.json", "fixtures.json", ...manifest.map((f) => f.name)]) {
    if (path.basename(name) !== name) throw Error("INVALID_FIXTURE_NAME");
    const bytes = await readFile(path.join(input, name));
    if (hash(bytes) !== summary.artifacts?.[name]?.sha256)
      throw Error(`NODE_ARTIFACT_DRIFT:${name}`);
    const fixture = manifest.find((f) => f.name === name);
    if (fixture && hash(bytes) !== fixture.sha256) throw Error(`FIXTURE_DRIFT:${name}`);
    allowed.set(name, bytes);
  }
  evidence.inputs = Object.fromEntries(
    [...allowed].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: hash(bytes) }]),
  );
  const fixtureHtml = "tests/browser/nonadvanced/voice-asset/index.html";
  server = await bounded(
    createServer({
      root,
      configFile: false,
      cacheDir: path.join(directory, "vite-cache"),
      server: { host: "127.0.0.1", port: 0, strictPort: true },
      optimizeDeps: { entries: [fixtureHtml] },
      plugins: [
        {
          name: "owned-voice-asset-data",
          configureServer(vite) {
            vite.middlewares.use((request, response, next) => {
              const prefix = `/voice-asset-data/${token}/`;
              if (!request.url?.startsWith(prefix)) return next();
              const name = request.url.slice(prefix.length),
                bytes = allowed.get(name);
              if (!bytes) {
                response.statusCode = 404;
                response.end();
                return;
              }
              response.setHeader("Cache-Control", "no-store");
              response.setHeader(
                "Content-Type",
                name.endsWith("json") ? "application/json" : "audio/wav",
              );
              response.end(bytes);
            });
          },
        },
      ],
    }),
    20000,
    "create-server",
  );
  await bounded(server.listen(), 20000, "listen");
  const address = server.httpServer.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1")
    throw Error("LOOPBACK_OWNERSHIP");
  evidence.origin = `http://127.0.0.1:${address.port}`;
  browserServer = await bounded(
    chromium.launchServer({
      headless: true,
      timeout: 15000,
      ...(executableIndex < 0 ? {} : { executablePath: args[executableIndex + 1] }),
    }),
    20000,
    "launch-owned-browser",
  );
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 10000 });
  evidence.browserVersion = browser.version();
  const executable = executableIndex < 0 ? chromium.executablePath() : args[executableIndex + 1];
  evidence.executable = { path: executable, sha256: hash(await readFile(executable)) };
  context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    if (evidence.pageErrors.length < 32) evidence.pageErrors.push(String(error));
  });
  const names = new Set([
    "reference-0.f32",
    "reference-1.f32",
    "candidate-0.f32",
    "candidate-1.f32",
    ...["sine", "square", "sawtooth", "triangle", "sample-loop"].flatMap((w) => [
      `phase-${w}-reference.f32`,
      `phase-${w}-candidate.f32`,
    ]),
  ]);
  const sizes = new Map();
  await page.exposeBinding("saveVoiceAssetPcm", (_source, name, base64) => {
    if (!names.has(name) || typeof base64 !== "string" || base64.length > 44000)
      throw Error("PCM_TRANSPORT_BUDGET");
    const bytes = Buffer.from(base64, "base64"),
      size = (sizes.get(name) ?? 0) + bytes.length;
    if (size > 4 * 48000 * 10) throw Error("PCM_FILE_CAP");
    sizes.set(name, size);
    appendFileSync(path.join(directory, name), bytes, { flag: "a" });
  });
  await page.goto(`${evidence.origin}/${fixtureHtml}`, { waitUntil: "load", timeout: 15000 });
  await page.waitForFunction(() => typeof window.runVoiceAsset === "function", undefined, {
    timeout: 15000,
  });
  evidence.result = await bounded(
    page.evaluate(
      (base) => window.runVoiceAsset(base),
      `${evidence.origin}/voice-asset-data/${token}`,
    ),
    60000,
    "render-decode",
  );
  const independent = [];
  for (let ch = 0; ch < 2; ch++) {
    const reference = await readFile(path.join(directory, `reference-${ch}.f32`));
    const candidate = await readFile(path.join(directory, `candidate-${ch}.f32`));
    independent.push({
      channel: ch,
      referenceSha256: hash(reference),
      candidateSha256: hash(candidate),
      ...verifyPcm(reference, candidate),
    });
  }
  for (const waveform of ["sine", "square", "sawtooth", "triangle", "sample-loop"]) {
    const reference = await readFile(path.join(directory, `phase-${waveform}-reference.f32`));
    const candidate = await readFile(path.join(directory, `phase-${waveform}-candidate.f32`));
    if (reference.length !== 96000 * 4) throw Error("PHASE_PCM_TRUNCATED");
    independent.push({
      waveform,
      referenceSha256: hash(reference),
      candidateSha256: hash(candidate),
      ...verifyPcm(reference, candidate),
    });
  }
  evidence.independent = independent;
  const corpus = JSON.parse(allowed.get("corpus.json"));
  const expectedBytes = Math.ceil((corpus.ticks.at(-1).time + 2) * 48000) * 4;
  if (
    [...names]
      .filter((name) => !name.startsWith("phase-"))
      .some((name) => sizes.get(name) !== expectedBytes)
  )
    throw Error("PCM_TRUNCATED");
  if (
    evidence.result.status !== "PASS" ||
    independent.some((r) => !r.pass) ||
    evidence.pageErrors.length
  )
    throw Error("PCM_OR_FIXTURE_FAILURE");
  await verifyPins();
  evidence.status = "PASS";
} catch (error) {
  evidence.status = "FAIL";
  evidence.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  for (const [name, close] of [
    ["context", () => context?.close()],
    ["browser", () => browser?.close()],
    ["browserServer", () => browserServer?.close()],
    ["vite", () => server?.close()],
  ]) {
    try {
      await bounded(Promise.resolve().then(close), 5000, `cleanup-${name}`);
      evidence.cleanup.push({ name, status: "closed" });
    } catch (error) {
      evidence.cleanup.push({ name, error: String(error) });
      evidence.status = "FAIL";
      process.exitCode = 1;
      browserServer?.process()?.kill();
      server?.httpServer?.closeAllConnections();
    }
  }
  clearTimeout(watchdog);
  for (const timer of timers) clearTimeout(timer);
  evidence.elapsedMs = performance.now() - started;
  evidence.files = (await readdir(directory)).filter((name) => name.endsWith("f32"));
  write("summary.json", evidence);
  console.log(JSON.stringify({ status: evidence.status, directory, error: evidence.error }));
}
