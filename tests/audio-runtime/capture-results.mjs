// Capture observed validation outputs and tested workspace bytes. This does not run the tests.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const folder = "tests/audio-runtime";
const nativePath = `${folder}/native-audio-bank-verified-20261027.json`;
const tapPath = `${folder}/node-final-20261027.tap`;
const native = JSON.parse(await readFile(join(root, nativePath), "utf8"));
const tapBytes = await readFile(join(root, tapPath));
const tap = (
  tapBytes[0] === 0xff && tapBytes[1] === 0xfe
    ? tapBytes.subarray(2).toString("utf16le")
    : tapBytes.toString("utf8")
)
  .replace(/^\uFEFF/, "")
  .replaceAll("\r\n", "\n");
const tests = Number(tap.match(/^# tests (\d+)$/m)?.[1]);
const passes = Number(tap.match(/^# pass (\d+)$/m)?.[1]);
const failures = Number(tap.match(/^# fail (\d+)$/m)?.[1]);
if (!tests || passes !== tests || failures !== 0 || native.status !== "PASS")
  throw new Error("Successful current Node and native output files are required");
const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
if (git.status !== 0) throw new Error(git.stderr || "Cannot read actual Git HEAD");
async function files(directory) {
  const items = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      items.map((item) =>
        item.isDirectory()
          ? files(join(directory, item.name))
          : item.name.endsWith(".ts")
            ? [join(directory, item.name)]
            : [],
      ),
    )
  ).flat();
}
async function digest(path) {
  return {
    path: relative(root, path).replaceAll("\\", "/"),
    sha256: createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
  };
}
const sourcePaths = [
  ...(await files(join(root, "src/audio"))),
  ...(await files(join(root, folder))),
].sort();
const artifactPaths = [
  nativePath,
  `${nativePath}.raw`,
  tapPath,
  `${folder}/README.md`,
  `${folder}/capture-results.mjs`,
];
const manifest = {
  schema_version: 1,
  captured_at: new Date().toISOString(),
  executor: "Codex; no Muse or model API used",
  git_head: git.stdout.trim(),
  code_state: "uncommitted workspace files; hashes identify tested bytes",
  environment: {
    node: process.versions.node,
    npm: "11.4.2 observed",
    native_browser: "Chromium156 / Windows; native fixture sample rate48000Hz",
  },
  commands: [
    {
      command: "node --import tsx --test tests/audio-runtime/*.test.ts",
      exit_code: 0,
      result: `${passes}/${tests} PASS`,
      artifact: tapPath,
    },
    {
      command:
        "TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes for every src/audio and tests/audio-runtime .ts file",
      exit_code: 0,
      result: "PASS; tool execution observed",
    },
    {
      command: "node node_modules/eslint/bin/eslint.js src/audio tests/audio-runtime",
      exit_code: 0,
      result: "PASS; tool execution observed",
    },
    {
      command: "node node_modules/prettier/bin/prettier.cjs --check src/audio tests/audio-runtime",
      exit_code: 0,
      result: "PASS; tool execution observed",
    },
    {
      command: "Isolated native HTML harness; baseline/pause/late/continuity/restore/WAV exports",
      result: `${native.checks}/${native.checks} PASS`,
      artifact: nativePath,
    },
  ],
  sources: await Promise.all(sourcePaths.map(digest)),
  artifacts: await Promise.all(artifactPaths.map((path) => digest(join(root, path)))),
  limitations: [
    "Native fixtures verify renderer/DSP, not room geometry or measurements",
    "Synthetic/perceptual late IR is not measured RT60 or an individual solver ray",
    "Cursor is epoch-mapped authored-rate history, not a hardware read pointer; missing historic automation uses declared approximation",
    "No seamless pause/seek waveform or filter-state claim",
    "V3 independent room solver comparison not run in this slice",
    "V4 long realtime capacity/device profiling/Worklet underrun NOT RUN",
    "V5 hearing/headphone/end-to-end latency/SPL/real-room measurement NOT RUN",
    "WAV preflight bounds inputs/frames/PCM reservations; native decoder internal resident peak not measured",
  ],
};
const output = join(root, folder, "audio-validation-manifest-20261027.json");
await writeFile(output, JSON.stringify(manifest, null, 2) + "\n");
process.stdout.write(
  `${relative(root, output)}: ${passes} Node / ${native.checks} native checks PASS\n`,
);
