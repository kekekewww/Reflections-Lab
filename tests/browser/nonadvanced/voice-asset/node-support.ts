import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FakeAudioBuffer } from "../../../audio-runtime/fake-context.js";
import { AudioEngine } from "../../../../src/audio/engine.js";
import { BUDGET, GENERATOR_SOURCE, PROVENANCE, type WaveFixture } from "./contracts.js";
import { ControlContext } from "./voice-node.js";
import { wave } from "./wave-fixture.js";
import type { AssetAdapter } from "./asset-comparison.js";

export const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export async function freshDirectory(kind: string) {
  const directory = path.join(
    ROOT,
    ".cache",
    "voice-asset",
    `${kind}-${new Date().toISOString().replace(/[:.]/g, "")}-${randomUUID().slice(0, 8)}`,
  );
  await mkdir(directory, { recursive: true });
  return directory;
}
export async function json(directory: string, name: string, value: unknown) {
  await writeFile(path.join(directory, name), JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
}
export async function pins() {
  const paths = [
    "package.json",
    "package-lock.json",
    ".node-version",
    "AGENTS.md",
    GENERATOR_SOURCE,
    "tests/audio-runtime/fake-context.ts",
    "knowledge/tasks/RLAB-TASK-PERF-20261101-006.json",
    "knowledge/tasks/RLAB-TASK-PERF-20261101-007.json",
    "docs/01-compliance/PROVENANCE_POLICY.md",
    "tests/audio-runtime/voice-asset-harness.test.ts",
    "tests/audio-runtime/voice-asset-pcm-verifier.test.mjs",
  ];
  // Pin the full product source tree (including transitive helpers), schema types,
  // and this harness. Do not infer an implementation version from HEAD alone.
  const visit = async (relative: string) => {
    for (const entry of await readdir(path.join(ROOT, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(next);
      else if (/\.(ts|tsx|mjs|html|json)$/.test(entry.name)) paths.push(next);
    }
  };
  await visit("src");
  await visit("schemas");
  await visit("tests/browser/nonadvanced/voice-asset");
  const result: Record<string, string> = {};
  for (const relative of [...new Set(paths)].sort())
    result[relative] = hash(await readFile(path.join(ROOT, relative)));
  return {
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(),
    branch: execFileSync("git", ["branch", "--show-current"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim(),
    node: process.version,
    platform: process.platform,
    sources: result,
  };
}
export async function materialize(directory: string) {
  const fixtures: WaveFixture[] = [],
    manifest = [];
  const generatorSha256 = hash(await readFile(path.join(ROOT, GENERATOR_SOURCE)));
  for (const rate of [44100, 48000])
    for (const channels of [1, 2]) {
      const sample = 1000 + fixtures.length * 100,
        frames = rate;
      const name = `synthetic-${rate}-${channels}ch.wav`;
      const bytes = wave(sample, frames, rate, channels),
        sha256 = hash(new Uint8Array(bytes));
      await writeFile(path.join(directory, name), new Uint8Array(bytes), { flag: "wx" });
      fixtures.push({
        assetId: `fixture.${rate}.${channels}`,
        name,
        sample,
        frames,
        rate,
        channels,
        sha256,
        bytes,
      });
      manifest.push({
        assetId: `fixture.${rate}.${channels}`,
        name,
        sample,
        frames,
        rate,
        channels,
        sha256,
        byteLength: bytes.byteLength,
        generator: {
          path: GENERATOR_SOURCE,
          sha256: generatorSha256,
          function: "wave(sample, frames, rate, channels)",
          materializerPath: "tests/browser/nonadvanced/voice-asset/wave-fixture.ts",
          modifications:
            "same PCM16 algorithm; frames expanded to one second; full 2x2 rate/channel matrix",
        },
        provenance: PROVENANCE,
        licenseRef:
          "PROJECT_GENERATED_TEST_FIXTURE; project root distribution license remains undecided",
        licenseSource: "docs/01-compliance/PROVENANCE_POLICY.md",
      });
    }
  await json(directory, "fixtures.json", manifest);
  return fixtures;
}
export function nodeAssetAdapter(): AssetAdapter {
  const context = new ControlContext();
  return {
    method:
      "Node/FakeAudioContext; independent PCM16 file decoder; measured wall latency is a fake-decode approximation, not native performance",
    setTime: (time) => {
      context.currentTime = time;
    },
    createEngine: () =>
      new AudioEngine({
        context: context.asContext(),
        budget: BUDGET,
        oscillatorModel: "nativeReference",
        virtualization: false,
      }),
    createContext: (rate) => ({
      sampleRate: rate,
      createBuffer: (channels, frames, sampleRate) =>
        new FakeAudioBuffer(channels, frames, sampleRate) as unknown as AudioBuffer,
      decodeAudioData: async (bytes) => {
        const view = new DataView(bytes),
          channels = view.getUint16(22, true),
          frames = view.getUint32(40, true) / (channels * 2);
        const buffer = new FakeAudioBuffer(channels, frames, rate);
        for (let ch = 0; ch < channels; ch++)
          for (let n = 0; n < frames; n++)
            buffer.getChannelData(ch)[n] =
              view.getInt16(44 + (n * channels + ch) * 2, true) / 32768;
        return buffer as unknown as AudioBuffer;
      },
    }),
  };
}
