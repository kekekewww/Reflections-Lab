import { spawn, execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const directory = path.join(
  root,
  ".cache/voice-asset",
  `checks-${new Date().toISOString().replace(/[:.]/g, "")}-${randomUUID().slice(0, 8)}`,
);
await mkdir(directory, { recursive: true });
const changed = (await readdir(path.join(root, "tests/browser/nonadvanced/voice-asset")))
  .filter((n) => /\.(ts|mjs|html|json|md)$/.test(n))
  .map((n) => `tests/browser/nonadvanced/voice-asset/${n}`);
changed.push(
  "tests/audio-runtime/voice-asset-harness.test.ts",
  "tests/audio-runtime/voice-asset-pcm-verifier.test.mjs",
);
const audio = (await readdir(path.join(root, "tests/audio-runtime")))
  .filter(
    (n) =>
      n.endsWith(".test.ts") &&
      /^(asset-|engine\.|pause-regressions\.|restore-cursor\.|review2?\.|routes-response-reuse\.|smoothness\.|update-core\.|virtual-|voice-asset-|wav-preflight\.)/.test(
        n,
      ),
  )
  .map((n) => `tests/audio-runtime/${n}`);
const app = [
  "asset-host",
  "asset-residency",
  "runtime-asset-lease-lifecycle",
  "static-preview-asset-leases",
].map((n) => `tests/app/${n}.test.ts`);
const jobs = [
  [
    "tests",
    [
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=1",
      ...audio,
      "tests/audio-runtime/voice-asset-pcm-verifier.test.mjs",
      ...app,
    ],
  ],
  ["typecheck", ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."]],
  [
    "harness-typecheck",
    [
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "-p",
      "tests/browser/nonadvanced/voice-asset/tsconfig.json",
    ],
  ],
  [
    "eslint",
    ["node_modules/eslint/bin/eslint.js", ...changed.filter((n) => /\.(ts|mjs)$/.test(n))],
  ],
  ["prettier", ["node_modules/prettier/bin/prettier.cjs", "--check", ...changed]],
];
const results = [];
for (const [name, args] of jobs) {
  const started = performance.now(),
    stdout = createWriteStream(path.join(directory, `${name}.stdout.txt`), { flags: "wx" }),
    stderr = createWriteStream(path.join(directory, `${name}.stderr.txt`), { flags: "wx" });
  const child = spawn(process.execPath, args, {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  const timer = setTimeout(() => {
    // Windows process-tree cleanup is restricted to this exact owned child PID.
    if (process.platform === "win32" && child.pid)
      execFile(
        "taskkill",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true },
        () => {},
      );
    else child.kill();
  }, 180000);
  const outcome = await new Promise((resolve) => {
    child.once("error", (error) => resolve({ error: String(error) }));
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
  });
  clearTimeout(timer);
  await Promise.all([
    new Promise((resolve) => stdout.end(resolve)),
    new Promise((resolve) => stderr.end(resolve)),
  ]);
  const out = await readFile(path.join(directory, `${name}.stdout.txt`)),
    err = await readFile(path.join(directory, `${name}.stderr.txt`));
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const result = {
    name,
    command: [process.execPath, ...args],
    ...outcome,
    elapsedMs: performance.now() - started,
    stdout: { bytes: out.length, sha256: digest(out) },
    stderr: { bytes: err.length, sha256: digest(err) },
    tail: out.toString("utf8").split("\n").slice(-15).join("\n"),
  };
  results.push(result);
  console.log(JSON.stringify(result));
}
const summary = {
  status: results.every((r) => r.exitCode === 0) ? "PASS" : "FAIL",
  directory,
  results,
};
await writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n", {
  flag: "wx",
});
console.log(JSON.stringify({ status: summary.status, directory }));
if (summary.status !== "PASS") process.exitCode = 1;
