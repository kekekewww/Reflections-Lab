import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { analyzeFormalTraceStreamV3 } from "./performance-native-v3.mjs";
import { metric } from "./performance-profile.mjs";
import { evaluateUIWorkload } from "./performance-profile-v3.mjs";
import {
  REANALYSIS_SOURCES,
  CAPTURE_FILES,
  snapshotFiles,
  verifyCaptureContract,
} from "./reanalyze-performance-v3.mjs";
async function readJson(file, cap) {
  const st = await stat(file);
  if (st.size > cap) throw Error("INPUT_JSON_CAP");
  return JSON.parse(await readFile(file, "utf8"));
}
async function worker(capture, output) {
  const sourceBefore = await snapshotFiles(process.cwd(), REANALYSIS_SOURCES),
    inputsBefore = await snapshotFiles(capture, CAPTURE_FILES);
  const report = await readJson(path.join(capture, "verification.json"), 64 * 1024 * 1024),
    oldAnalysis = await readJson(path.join(capture, "ui.trace-analysis.json"), 256 * 1024 * 1024);
  const context = verifyCaptureContract(report, oldAnalysis, inputsBefore),
    raw = await readJson(path.join(capture, "ui.raw.json"), 256 * 1024 * 1024);
  if (
    raw.sampleMilliseconds !== report.uiCheckpoint.sampleMilliseconds ||
    raw.collectionWindow?.collectionId !== report.uiCheckpoint.collectionId
  )
    throw Error("CHECKPOINT_CONTENT_MISMATCH");
  const analysis = await analyzeFormalTraceStreamV3(
    path.join(capture, "ui.trace.json.gz"),
    raw,
    context,
  );
  const traceInput = inputsBefore.find((item) => item.path === "ui.trace.json.gz");
  if (
    analysis.streamStats?.compressedSha256 !== traceInput.sha256 ||
    analysis.streamStats?.compressedBytes !== traceInput.bytes
  )
    throw Error("STREAM_INPUT_MISMATCH");
  await writeFile(path.join(output, "analysis.json"), JSON.stringify(analysis, null, 2) + "\n", {
    flag: "wx",
  });
  const flags = evaluateUIWorkload(raw, {
    pageErrors: report.pageErrors,
    traceCoverage: analysis.coverage,
  });
  const old = report.ui.workloadValidity;
  const keys = new Set([...Object.keys(old), ...Object.keys(flags)]);
  const drift = [...keys]
    .filter((k) => k !== "actual600Seconds" && old[k] !== flags[k])
    .map((key) => ({ key, original: old[key], reanalyzed: flags[key] }));
  const occupancy = metric("ui.rendererMainTaskOccupancyPerFrame", analysis.mainTaskOccupancyMs, 4);
  occupancy.method =
    "Conservative renderer-main wall occupancy; versioned formal-cap V2 arithmetic.";
  if (
    occupancy.status === "PASS" &&
    (!analysis.coverage?.complete || !Object.values(flags).every(Boolean))
  )
    occupancy.status = "UNVERIFIED";
  const sourcesAfter = await snapshotFiles(process.cwd(), REANALYSIS_SOURCES),
    inputsAfter = await snapshotFiles(capture, CAPTURE_FILES);
  const sourceStable = JSON.stringify(sourceBefore) === JSON.stringify(sourcesAfter),
    inputStable = JSON.stringify(inputsBefore) === JSON.stringify(inputsAfter);
  const verification = {
    retrospective: true,
    newCapture: false,
    capturedGitRevision: report.host.gitRevision,
    originalAnalysis: { status: oldAnalysis.status, reasons: oldAnalysis.reasons },
    newMethod: "formal-cap-2m-v3",
    sourceBefore,
    sourcesAfter,
    inputsBefore,
    inputsAfter,
    sourceStable,
    inputStable,
    context,
    workload: { original: old, reanalyzed: flags, drift },
    originalMetrics: report.metrics,
    rendererOccupancy: occupancy,
    originalReportStatus: report.status,
    performancePass: false,
    overallV1Complete: false,
    status:
      sourceStable &&
      inputStable &&
      drift.length === 0 &&
      analysis.nativeEligibility?.qualified === true &&
      analysis.complete === true
        ? "REANALYZED_SCOPED_NOT_PERFORMANCE_PASS"
        : "UNVERIFIED",
  };
  await writeFile(
    path.join(output, "verification.json"),
    JSON.stringify(verification, null, 2) + "\n",
    { flag: "wx" },
  );
  if (verification.status === "UNVERIFIED") process.exitCode = 1;
}
if (process.env.RLAB_REANALYSIS_WORKER !== "1" || process.argv.length !== 4)
  throw Error("WORKER_INVOCATION_REQUIRED");
worker(process.argv[2], process.argv[3]).catch((error) => {
  process.stderr.write(String(error?.stack ?? error) + "\n");
  process.exitCode = 1;
});
