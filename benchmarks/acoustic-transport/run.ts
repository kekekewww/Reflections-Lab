import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cpus, platform, release, arch } from "node:os";
import { generateOriginalPrefix } from "./capture.js";
import { encodeExact, decodeExact } from "./corpus-codec.js";
import { SOURCE_ROOT, loadFormal100Scene, qualifyPrimaryInput } from "./fixture.js";
import { exactDataEqual } from "./corpus.js";
import { invalidationScenarios } from "./scenarios.js";

const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
function configurationId(value: string): "A" | "B" | "C" | "D" {
  if (value !== "A" && value !== "B" && value !== "C" && value !== "D")
    throw new Error("COMPONENT_CONFIGURATION");
  return value;
}
function options(args: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index],
      value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined || values.has(key))
      throw new Error("COMPONENT_CLI_ARGUMENTS");
    values.set(key, value);
  }
  return values;
}
function outputPath(value: string | undefined) {
  if (!value) throw new Error("COMPONENT_OUTPUT_REQUIRED");
  const output = path.resolve(SOURCE_ROOT, value),
    relative = path.relative(SOURCE_ROOT, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("COMPONENT_OUTPUT_OUTSIDE_OWN_TREE");
  return output;
}
async function newOutput(directory: string) {
  try {
    await access(directory);
    throw new Error("COMPONENT_OUTPUT_EXISTS");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
  await mkdir(directory, { recursive: true });
}
let nodeExecutableSha256: string | null = null;
const environment = () => ({
  nodeExecutableSha256,
  execArgv: process.execArgv,
  node: process.version,
  v8: process.versions.v8,
  platform: platform(),
  release: release(),
  arch: arch(),
  cpu: cpus()[0]?.model ?? null,
  logicalCpus: cpus().length,
  pid: process.pid,
  browser: null,
  nativeAudioDevice: null,
  nativeAudioSampleRate: null,
  vmAllocationBytes: null,
  resourceScope: "Single ordinary Node component job; machine exclusivity is not asserted",
});

export async function main(args = process.argv.slice(2)) {
  const mode = args[0],
    opts = options(args.slice(1)),
    output = outputPath(opts.get("--out"));
  const known =
    mode === "capture" ? ["--out", "--runtime-root"] : ["--out", "--corpus", "--run-id", "--order"];
  if (
    [...opts.keys()].some((key) => !known.includes(key)) ||
    !["capture", "run"].includes(mode ?? "")
  )
    throw new Error("COMPONENT_CLI_MODE");
  await newOutput(output);
  nodeExecutableSha256 = sha(await readFile(process.execPath));
  const requiredNode = (await readFile(path.join(SOURCE_ROOT, ".node-version"), "utf8")).trim();
  if (process.version !== `v${requiredNode}`) throw new Error("COMPONENT_NODE_QUALIFICATION");
  const command = [process.execPath, ...process.execArgv, process.argv[1], ...args];
  try {
    if (mode === "capture") {
      const runtimeRoot = opts.get("--runtime-root");
      if (!runtimeRoot) throw new Error("COMPONENT_RUNTIME_ROOT_REQUIRED");
      const corpus = await generateOriginalPrefix(runtimeRoot);
      const exact = encodeExact(corpus),
        dataPath = path.join(output, "corpus.exact.json");
      await writeFile(dataPath, exact, { flag: "wx" });
      const manifest = {
        schemaVersion: "acoustic-component-manifest/1",
        status: "CAPTURED_NODE_COMPONENT_PREFIX_ONLY",
        command,
        environment: environment(),
        exactCorpusFile: dataPath,
        exactCorpusBytes: new TextEncoder().encode(exact).byteLength,
        exactCorpusSha256: sha(exact),
        rows: corpus.state.rows.length,
        acceptedRows: corpus.state.rows.filter((row) => row.expected.ok).length,
        referenceRejectedRows: corpus.state.rows.filter((row) => !row.expected.ok).length,
        physicsEvents: corpus.state.physicsEvents.length,
        audioEvents: corpus.state.audioEvents.length,
        controls: corpus.state.controls.length,
        metadata: corpus.metadata,
        actualFormalBrowserTrace: false,
        formal600Result: null,
        adoption: "NOT_DECIDED",
      };
      await writeFile(
        path.join(output, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
        { flag: "wx" },
      );
      console.log(
        JSON.stringify({
          status: manifest.status,
          output,
          rows: manifest.rows,
          acceptedRows: manifest.acceptedRows,
          referenceRejectedRows: manifest.referenceRejectedRows,
          exactCorpusSha256: manifest.exactCorpusSha256,
        }),
      );
      return;
    }
    const corpusFile = opts.get("--corpus"),
      runId = opts.get("--run-id"),
      order = opts.get("--order") ?? "ABCD";
    if (
      !corpusFile ||
      !runId ||
      !/^[a-zA-Z0-9._-]{1,64}$/.test(runId) ||
      [...order].sort().join("") !== "ABCD"
    )
      throw new Error("COMPONENT_RUN_ARGUMENTS");
    const exact = await readFile(path.resolve(corpusFile), "utf8");
    const decoded = decodeExact(exact) as Awaited<ReturnType<typeof generateOriginalPrefix>>;
    const manifest = JSON.parse(
      await readFile(path.join(path.dirname(path.resolve(corpusFile)), "manifest.json"), "utf8"),
    ) as { exactCorpusSha256?: string; exactCorpusBytes?: number; status?: string };
    if (
      manifest.exactCorpusSha256 !== sha(exact) ||
      manifest.exactCorpusBytes !== new TextEncoder().encode(exact).byteLength ||
      manifest.status !== "CAPTURED_NODE_COMPONENT_PREFIX_ONLY"
    )
      throw new Error("COMPONENT_CORPUS_MANIFEST_PIN");
    if (
      decoded.state.schemaVersion !== "acoustic-component-corpus/1" ||
      decoded.state.invalid ||
      !decoded.state.rows.length
    )
      throw new Error("COMPONENT_CORPUS_INVALID");
    const formal = await loadFormal100Scene();
    if (
      formal.constructionSha256 !== decoded.metadata.fixture.constructionSha256 ||
      !exactDataEqual(formal.scene, decoded.metadata.originalScene)
    )
      throw new Error("COMPONENT_ORIGINAL_SCENE_PIN");
    const critical = new Set([
      "src/app/acoustic-input.ts",
      "src/app/acoustic-service.ts",
      "src/app/acoustic-worker.ts",
      "src/app/acoustic-transport.ts",
      "src/app/acoustic-payload.ts",
      "src/app/acoustic-geometry-cache.ts",
      "src/app/defaults.ts",
      "src/app/behavior-acoustic-source.ts",
      "src/capabilities/acoustic-geometry.ts",
      "src/scene/index.ts",
      "src/scene/validate-scene.ts",
      "src/physics/math.ts",
    ]);
    for (const pin of decoded.metadata.sourcePins) {
      if (critical.has(pin.path) || pin.path.startsWith("src/acoustics/")) {
        if (sha(await readFile(path.join(SOURCE_ROOT, pin.path))) !== pin.sha256)
          throw new Error("COMPONENT_PRODUCT_SOURCE_PIN:" + pin.path);
      }
    }
    for (const row of decoded.state.rows)
      qualifyPrimaryInput(
        row.input,
        decoded.metadata.originalScene,
        decoded.metadata.originalMaterials,
      );
    // Captured rows remain exact and qualified above; synthetic invalidation rows are separately labeled and excluded from formal-trace claims.
    const supplementalRows = invalidationScenarios(decoded.state.rows);
    const replayRows = [...decoded.state.rows, ...supplementalRows];
    const driver = await import("./driver.js");
    const prepared = driver.prepareOracles(replayRows);
    const results = [];
    for (const id of order) {
      const result = await driver.runConfiguration(replayRows, configurationId(id), prepared, {
        warmup: 4,
        repetitions: 1,
        copyProbe: true,
      });
      if (
        result.warmup.performed !== 4 ||
        !result.allNodeWorkersExited ||
        !result.copyProbe?.allNodeWorkersExited
      )
        throw Object.assign(new Error("COMPONENT_RUN_QUALIFICATION"), { partial: result });
      results.push(result);
    }
    const report = {
      schemaVersion: "acoustic-component-run/1",
      status: "MEASURED_NODE_COMPONENT_ONLY",
      runId,
      command,
      order,
      recordedAt: new Date().toISOString(),
      environment: environment(),
      corpus: {
        file: path.resolve(corpusFile),
        sha256: sha(exact),
        rows: decoded.state.rows.length,
        origin: decoded.state.origin,
      },
      supplemental: {
        rows: supplementalRows.length,
        groups: supplementalRows.map((row) => row.group),
        origin:
          "Synthetic boundaries derived from one captured input; not original event trace or adoption timing evidence",
      },
      comparisonScopes: {
        capturedRowIds: decoded.state.rows.map((row) => row.id),
        supplementalRowIds: supplementalRows.map((row) => row.id),
        liveCandidateRowIds: decoded.state.rows
          .filter((row) => row.callScope === "default-live")
          .map((row) => row.id),
        driverOverallSummary:
          "All replay rows including synthetic boundaries; not an adoption timing summary. Compare matched captured row IDs and call scopes separately.",
      },
      results,
      adoption: "NOT_DECIDED",
      actualBrowserDispatch: null,
      nativeOnset: null,
      formal600Result: null,
      limitations: [
        "Frozen full100dynamic original-control prefix; not a formal browser trace or full600s run",
        "Supplemental invalidation groups are synthetic boundary checks, not captured motion speed evidence",
        "Sequential one-in-flight component replay is not realtime50ms scheduling",
        "Explicit clone container counts are not VM allocated bytes; body JSON bytes are not native wire bytes",
        "Checksum consumer is not Root AudioEngine/UI/native consumer",
        "Compare multiple fresh Node process invocations, preserve all reference rejection rows and exact oracles",
      ],
    };
    await writeFile(path.join(output, "run.json"), JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(
      JSON.stringify({
        status: report.status,
        output,
        runId,
        order,
        corpusSha256: report.corpus.sha256,
      }),
    );
  } catch (error) {
    const value = error as { name?: string; message?: string; stack?: string; partial?: unknown };
    let partial:
      | { file: string; sha256: string; bytes: number }
      | { preservationError: string }
      | null = null;
    if (value.partial !== undefined) {
      try {
        const encoded = encodeExact(value.partial),
          file = path.join(output, "partial.exact.json");
        await writeFile(file, encoded, { flag: "wx" });
        partial = {
          file,
          sha256: sha(encoded),
          bytes: new TextEncoder().encode(encoded).byteLength,
        };
      } catch (preservationError) {
        partial = { preservationError: String(preservationError) };
      }
    }
    await writeFile(
      path.join(output, "failure.json"),
      JSON.stringify(
        {
          status: "COMPONENT_FAILED_NOT_PUBLISHED",
          command,
          environment: environment(),
          name: value.name,
          message: value.message ?? String(error),
          stack: value.stack,
          partial,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
