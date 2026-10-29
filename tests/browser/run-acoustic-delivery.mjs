import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const port = 5187;
const url = `http://127.0.0.1:${port}`;
const ownedPaths = [
  "src/app/acoustic-service.ts",
  "src/app/acoustic-worker.ts",
  "tests/app/acoustic-service.test.ts",
  "tests/browser/acoustic-delivery.spec.ts",
  "tests/browser/acoustic-delivery.config.ts",
  "tests/browser/run-acoustic-delivery.mjs",
  "tests/browser/build-acoustic-delivery.mjs",
  "tests/browser/acoustic-delivery-entry.ts",
  "tests/browser/acoustic-delivery-harness.html",
  "tests/app/acoustic-service.tsconfig.json",
  "src/acoustics/index.ts",
  "src/acoustics/solver.ts",
  "src/acoustics/geometry.ts",
  "src/acoustics/types.ts",
  "tests/acoustics-runtime/solver.test.ts",
  "package-lock.json",
];
const digest = async (path) =>
  createHash("sha256")
    .update(await readFile(new URL(`../../${path}`, import.meta.url)))
    .digest("hex");
const hashes = async () =>
  Object.fromEntries(await Promise.all(ownedPaths.map(async (path) => [path, await digest(path)])));
const before = await hashes();
const buildArgs = ["tests/browser/build-acoustic-delivery.mjs"];
const buildResult = spawnSync(process.execPath, buildArgs, {
  cwd,
  windowsHide: true,
  encoding: "utf8",
  timeout: 30_000,
  maxBuffer: 8 * 1024 * 1024,
});
await mkdir(new URL("../../tests/acoustics-runtime/delivery-evidence-20261027", import.meta.url), {
  recursive: true,
});
await writeFile(
  new URL(
    "../../tests/acoustics-runtime/delivery-evidence-20261027/build.stdout.txt",
    import.meta.url,
  ),
  buildResult.stdout ?? "",
);
await writeFile(
  new URL(
    "../../tests/acoustics-runtime/delivery-evidence-20261027/build.stderr.txt",
    import.meta.url,
  ),
  buildResult.stderr ?? "",
);
if (buildResult.status !== 0)
  throw new Error(`Production fixture build failed: ${buildResult.stderr ?? buildResult.error}`);
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--outDir",
    "test-results/acoustic-delivery-dist",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));
server.on("error", (error) => {
  serverLog += error.message;
});
let exitCode = 1;
const childResults = [
  { name: "build", command: [process.execPath, ...buildArgs], exitCode: buildResult.status },
];
try {
  const deadline = Date.now() + 30_000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Owned Vite server exited: ${serverLog}`);
    try {
      if ((await fetch(`${url}/tests/browser/acoustic-delivery-harness.html`)).ok) break;
    } catch {
      /* Wait only for this explicitly owned local server. */
    }
    if (Date.now() >= deadline) throw new Error(`Owned Vite startup timed out: ${serverLog}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const run = async (name, args) => {
    const child = spawn(process.execPath, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, REFLECTION_ACOUSTIC_EXTERNAL_SERVER: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    const code = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", resolve);
    });
    await mkdir(
      new URL("../../tests/acoustics-runtime/delivery-evidence-20261027", import.meta.url),
      {
        recursive: true,
      },
    );
    await writeFile(
      new URL(
        `../../tests/acoustics-runtime/delivery-evidence-20261027/${name}.stdout.txt`,
        import.meta.url,
      ),
      stdout,
    );
    await writeFile(
      new URL(
        `../../tests/acoustics-runtime/delivery-evidence-20261027/${name}.stderr.txt`,
        import.meta.url,
      ),
      stderr,
    );
    childResults.push({ name, command: [process.execPath, ...args], exitCode: code });
    return code;
  };
  const strict = await run("strict", [
    "node_modules/typescript/bin/tsc",
    "--project",
    "tests/app/acoustic-service.tsconfig.json",
    "--noEmit",
  ]);
  const node = await run("node", [
    "--import",
    "tsx",
    "--test",
    "tests/app/acoustic-service.test.ts",
    "tests/acoustics-runtime/solver.test.ts",
  ]);
  const browser = await run("browser", [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "tests/browser/acoustic-delivery.config.ts",
  ]);
  await copyFile(
    new URL("../../test-results/acoustic-delivery-results.json", import.meta.url),
    new URL(
      "../../tests/acoustics-runtime/delivery-evidence-20261027/browser.results.json",
      import.meta.url,
    ),
  );
  exitCode = strict === 0 && node === 0 && browser === 0 ? 0 : 1;
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("exit", resolve);
      setTimeout(resolve, 5000);
    }
  });
  const after = await hashes();
  if (JSON.stringify(before) !== JSON.stringify(after)) exitCode = 1;
  await writeFile(
    new URL(
      "../../tests/acoustics-runtime/delivery-validation-manifest-20261027.json",
      import.meta.url,
    ),
    JSON.stringify(
      {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        sources: after,
        sourceStable: JSON.stringify(before) === JSON.stringify(after),
        commands: childResults,
        exitCode,
        serverExitCode: server.exitCode,
        serverSignalCode: server.signalCode,
        serverLog,
        artifacts: {
          "tests/acoustics-runtime/delivery-evidence-20261027/browser.results.json": await digest(
            "tests/acoustics-runtime/delivery-evidence-20261027/browser.results.json",
          ),
          "tests/acoustics-runtime/delivery-build-20261027.json": await digest(
            "tests/acoustics-runtime/delivery-build-20261027.json",
          ),
          "tests/acoustics-runtime/delivery-browser-20261027.json": await digest(
            "tests/acoustics-runtime/delivery-browser-20261027.json",
          ),
          ...Object.fromEntries(
            await Promise.all(
              childResults.flatMap((result) =>
                ["stdout", "stderr"].map(async (stream) => {
                  const path = `tests/acoustics-runtime/delivery-evidence-20261027/${result.name}.${stream}.txt`;
                  return [path, await digest(path)];
                }),
              ),
            ),
          ),
        },
        limitations: [
          "Node transport cases are mock fault injection; browser profile uses real native Workers.",
          "Order1 profile only; no order2 or whole-product 10-minute/audio/hearing validation.",
        ],
      },
      null,
      2,
    ),
  );
}
process.exitCode = exitCode;
