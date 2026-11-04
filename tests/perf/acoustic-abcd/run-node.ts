import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARMS, ORDERS, runArm, summarize } from "./comparison.js";
import type { RawRow } from "./comparison.js";
import { recordCorpus, loadRow, sha256, pins } from "./corpus.js";
import { NodeMeasuredPort } from "./node-port.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--out" || !args[1])
  throw new Error(
    "Usage: node --import tsx tests/perf/acoustic-abcd/run-node.ts --out <fresh directory>",
  );
const out = path.resolve(args[1]),
  relative = path.relative(root, out);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
  throw new Error("OUTPUT_MUST_BE_INSIDE_WORKSPACE");
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out); // Deliberately refuses an existing attempt directory.
const deadline = setTimeout(
  () => {
    process.stderr.write("ABCD_TOTAL_DEADLINE\n");
    process.exit(2);
  },
  15 * 60 * 1000,
);
const all: RawRow[] = [];
try {
  process.stdout.write("Recording the 720-tick V4 runtime corpus...\n");
  const corpusDir = path.join(out, "corpus"),
    manifest = await recordCorpus(root, corpusDir);
  const corpusHash = sha256(await readFile(path.join(corpusDir, "corpus.json")));
  const metadata = {
    schema: "acoustic-abcd-node/1",
    beganAt: new Date().toISOString(),
    node: process.version,
    executable: process.execPath,
    executableSha256: sha256(await readFile(process.execPath)),
    cpu: cpus()[0]?.model,
    cpuCount: cpus().length,
    os: `${platform()} ${release()}`,
    corpusSha256: corpusHash,
    corpus: manifest,
    orders: ORDERS,
    sourcePins: await pins(root),
    measurementScope: {
      timing:
        "Per requests() batch (raw sourceCount retained), not divided by source count; nearest-rank p50/p95/p99. Real worker_threads postMessage, actual product handler and service validation. Instrumentation wrapper overhead included. One awaited in-flight batch, no replay queue.",
      queue:
        "Worker receive minus main post end, clipped at zero when receive overlaps synchronous send; receiveAndQueue includes native serialization/queue/deserialization, which cannot be separated portably.",
      allocation:
        "Node approximations only: JSON payload representation size and signed process.memoryUsage net deltas per request; GC, retained outputs, instrumentation, and shared process RSS affect deltas. Not allocated bytes, peak memory, or clone wire bytes.",
      transfer:
        "All four arms structured-clone object graphs, including compact packet; zero buffers transferred/detached. Owned-buffer lifecycle is an independent diagnostic test, not an arm benefit or a product transfer pool.",
      onset:
        "Unavailable: audio disabled, no native onset or actual AudioEngine/UI consumer. Bounded checksum consumer only.",
    },
  };
  await writeFile(path.join(out, "metadata.json"), JSON.stringify(metadata, null, 2));
  for (let repetition = 0; repetition < ORDERS.length; repetition++)
    for (const arm of ORDERS[repetition]!) {
      process.stdout.write(
        `repetition ${repetition + 1}/${ORDERS.length} arm ${arm}, ${manifest.rows.length} requests\n`,
      );
      const result = await runArm({
        arm,
        repetition,
        rowCount: manifest.rows.length,
        loadRow: (index) => loadRow(corpusDir, manifest.rows[index]!),
        createPort: () => new NodeMeasuredPort(),
        memory: () => process.memoryUsage(),
      });
      all.push(...result.rows);
      await writeFile(
        path.join(out, `raw-${repetition}-${arm}.json`),
        JSON.stringify(result, null, 2),
      );
    }
  const summary = {
    corpusSha256: corpusHash,
    requests: manifest.rows.length,
    ticks: manifest.ticks,
    objects: manifest.objects,
    dynamicBodies: manifest.dynamicBodies,
    repetitions: ORDERS.length,
    warmupRequestsPerArmRun: Math.min(8, manifest.rows.length),
    arms: Object.fromEntries(
      ARMS.map((arm) => [arm, summarize(all.filter((row) => row.arm === arm))]),
    ),
    measuredScope: metadata.measurementScope,
    recommendation:
      "Keep clone reference as default; evaluate cache and packet using same-load cost/age tails plus Chrome/native gates. No adoption inferred from JSON size alone.",
    completedAt: new Date().toISOString(),
  };
  await writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
  const lines = [
    "# Acoustic A/B/C/D — Node",
    "",
    `Corpus SHA-256: ${corpusHash}`,
    `720 ticks; 105 objects / 100 dynamic; ${manifest.rows.length} requests; 4 rotated repetitions.`,
    "",
    "| Arm | Exact result | Rejected | Build p95 ms | Send p95 ms | Decode p95 ms | Solve p95 ms | Return p95 ms | Age p95 ms | Body JSON p50 B |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const arm of ARMS) {
    const s = summary.arms[arm]!,
      f = (value: number | undefined) => value?.toFixed(3) ?? "n/a";
    lines.push(
      `| ${arm} | ${s.exactResults}/${s.rows} | ${s.buildRejections + s.serviceRejections} | ${f(s.ms.builder?.p95)} | ${f(s.ms.send?.p95)} | ${f(s.ms.decode?.p95)} | ${f(s.ms.solve?.p95)} | ${f(s.ms.resultReturn?.p95)} | ${f(s.ms.componentAge?.p95)} | ${s.bytes.postedBodyJSON?.p50 ?? "n/a"} |`,
    );
  }
  lines.push("", ...Object.values(metadata.measurementScope), "", summary.recommendation);
  await writeFile(path.join(out, "summary.md"), lines.join("\n") + "\n");
  process.stdout.write(lines.join("\n") + "\n");
  if (all.some((row) => row.difference)) process.exitCode = 1;
} catch (error) {
  await writeFile(
    path.join(out, "failure.json"),
    JSON.stringify(
      {
        error: String(error),
        stack: error instanceof Error ? error.stack : null,
        completedRows: all.length,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  clearTimeout(deadline);
}
