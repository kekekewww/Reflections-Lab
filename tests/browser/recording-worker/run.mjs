import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "../../../scripts/agents/process-runner.mjs";
const root = process.cwd(),
  home = path.dirname(fileURLToPath(import.meta.url)),
  chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(p)));
    else if (entry.isFile()) result.push(p);
    else throw Error(`UNSUPPORTED_SOURCE_ENTRY:${p}`);
  }
  return result;
}
async function digest(file) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const b of createReadStream(file)) {
    hash.update(b);
    bytes += b.length;
  }
  return { path: file, bytes, sha256: hash.digest("hex") };
}
async function snapshot() {
  const files = [
    ...(await walk(path.resolve("src"))),
    ...(await walk(path.resolve("schemas"))),
    ...["index.html", "fixture.mjs", "vite.config.mjs", "worker.mjs", "run.mjs"].map((x) =>
      path.join(home, x),
    ),
    path.resolve("artifacts/v1/r15-recording-worker-20261028/fixture.json"),
    path.resolve("artifacts/v1/r15-recording-worker-20261028/control.json"),
    path.resolve("package.json"),
    path.resolve("package-lock.json"),
    path.resolve(".node-version"),
    path.resolve("scripts/agents/process-runner.mjs"),
    process.execPath,
    chrome,
  ];
  return Promise.all(files.sort().map(digest));
}
if (process.version !== "v22.17.0" || process.argv.length !== 2)
  throw Error("EXACT_NODE_AND_NO_ARGS_REQUIRED");
const control = JSON.parse(
  await readFile("artifacts/v1/r15-recording-worker-20261028/control.json", "utf8"),
);
if (
  control.artifactSha256 !== "b92fa8d066e5d84206b4f839e11e033d35b78c0b7a771673f3ca79c82f012c5b" ||
  control.encodedSha256 !== "243177464749f430a858de5c4374c592e4d1b45f13f489ca43fbe65d3ac948a6" ||
  control.encodedBytes !== 8257745
)
  throw Error("BASELINE_MISMATCH");
const before = await snapshot();
const fixture = before.find((x) =>
    x.path.endsWith(path.join("r15-recording-worker-20261028", "fixture.json")),
  ),
  browserFile = before.find((x) => x.path === chrome);
if (
  fixture?.sha256 !== control.fixtureSha256 ||
  browserFile?.sha256 !== "480f275b63d1ea39113cbc8344ac395578acc25b432bd39af5fbc77005179aca"
)
  throw Error("FIXTURE_OR_CHROME_HASH_MISMATCH");
const out = path.join(
  root,
  "artifacts/v1",
  `recording-worker-browser-${new Date().toISOString().replace(/[:.]/g, "")}-${randomUUID().slice(0, 8)}`,
);
await mkdir(out);
const command = {
  file: process.execPath,
  args: [path.join(home, "worker.mjs"), out],
  cwd: root,
  timeoutMs: 120000,
  maxOutputBytes: 4 * 1024 * 1024,
};
await writeFile(
  path.join(out, "command.json"),
  JSON.stringify(
    {
      ...command,
      before,
      scope:
        "owned headless Chrome, synthetic fixture, no audio or network except localhost, no paid calls",
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
const result = await runProcess(command),
  after = await snapshot(),
  stable = JSON.stringify(before) === JSON.stringify(after);
await writeFile(path.join(out, "stdout.txt"), result.stdout, { flag: "wx" });
await writeFile(path.join(out, "stderr.txt"), result.stderr, { flag: "wx" });
await writeFile(
  path.join(out, "process.json"),
  JSON.stringify({ result, after, sourceStable: stable, overallV1Complete: false }, null, 2) + "\n",
  { flag: "wx" },
);
process.stdout.write(
  JSON.stringify({
    directory: out,
    exit: result.exit_code,
    timedOut: result.timed_out,
    stopped: result.process_stopped,
    sourceStable: stable,
  }) + "\n",
);
if (
  result.exit_code !== 0 ||
  result.timed_out ||
  !result.process_stopped ||
  result.output_limit ||
  !stable
)
  process.exitCode = 1;
