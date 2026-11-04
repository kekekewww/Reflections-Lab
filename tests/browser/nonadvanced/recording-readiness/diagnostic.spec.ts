import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { RecordingBackpressureDiagnostics } from "../../../../src/app/recording-host.js";
import type { MountedReflectionLab } from "../../../../src/app/bootstrap.js";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const buildDirectory =
  process.env.RECORDING_READINESS_DIST ?? ".cache/recording-readiness/e2e-dist";
const buildReceiptPath =
  process.env.RECORDING_READINESS_BUILD_RECEIPT ??
  ".cache/recording-readiness/e2e-build-receipt.json";
if (!/^\.cache\/recording-readiness\/e2e-dist(?:-attempt[0-9]{2})?$/.test(buildDirectory))
  throw new Error("Invalid diagnostic build directory");
if (
  !/^\.cache\/recording-readiness\/e2e-build-(?:receipt|attempt[0-9]{2})\.json$/.test(
    buildReceiptPath,
  )
)
  throw new Error("Invalid diagnostic build receipt path");
const sourcePaths = [
  "src/app/bootstrap.ts",
  "src/app/runtime.ts",
  "src/app/defaults.ts",
  "src/app/live-monitor-labels.ts",
  "src/app/live-monitor-observation.ts",
  "src/app/recording-host.ts",
  "src/app/recording-advance-diagnostics.ts",
  "src/app/recording-evaluation-client.ts",
  "src/app/recording-evaluation-lane.ts",
  "src/app/recording-evaluation.worker.ts",
  "src/experiments/recording-persistence.ts",
  "src/experiments/recording-commit-diagnostics.ts",
  "src/experiments/recorder.ts",
  "src/persistence/blob-store.ts",
  "src/ui/App.tsx",
  "src/ui/TopMonitor.tsx",
  "src/ui/locales/status.ts",
  "src/audio/engine.ts",
  "src/audio/live-monitor.ts",
  "tests/browser/nonadvanced/recording-readiness/diagnostic.config.ts",
  "tests/browser/nonadvanced/recording-readiness/diagnostic.spec.ts",
];
const file = (path: string) => new URL(`../../../../${path}`, import.meta.url);
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
async function pins() {
  return Promise.all(
    sourcePaths.map(async (path) => {
      const bytes = await readFile(file(path));
      return { path, bytes: bytes.length, sha256: sha(bytes) };
    }),
  );
}

test("observe the first recording guard with Levels unchanged for at most ten seconds", async ({
  page,
  request,
  browser,
}, info) => {
  const sourceBefore = await pins();
  const index = await readFile(file(`${buildDirectory}/index.html`));
  const scriptPath = /<script[^>]*\bsrc="(\/assets\/[A-Za-z0-9_.-]+\.js)"/.exec(
    index.toString("utf8"),
  )?.[1];
  expect(scriptPath, "diagnostic must use a built local entry").toBeTruthy();
  const script = await readFile(file(`${buildDirectory}${scriptPath!}`));
  const indexHttp = await request.get("/");
  const scriptHttp = await request.get(scriptPath!);
  expect(indexHttp.status()).toBe(200);
  expect(scriptHttp.status()).toBe(200);
  expect(sha(await indexHttp.body())).toBe(sha(index));
  expect(sha(await scriptHttp.body())).toBe(sha(script));
  const buildReceipt = JSON.parse(await readFile(file(buildReceiptPath), "utf8")) as {
    schemaVersion: number;
    command: string;
    mode: string;
    exitCode: number;
    head: string;
    sourcePins: { path: string; bytes: number; sha256: string }[];
    bundle: { indexSha256: string; scriptPath: string; scriptSha256: string };
  };
  expect(buildReceipt.schemaVersion).toBe(1);
  expect(buildReceipt.mode).toBe("e2e");
  expect(buildReceipt.exitCode).toBe(0);
  expect(buildReceipt.command.length).toBeGreaterThan(0);
  for (const pin of sourceBefore.filter((value) => value.path.startsWith("src/")))
    expect(buildReceipt.sourcePins.find((value) => value.path === pin.path)).toEqual(pin);
  expect(buildReceipt.bundle).toEqual({
    indexSha256: sha(index),
    scriptPath: scriptPath!,
    scriptSha256: sha(script),
  });
  const pageErrors: string[] = [],
    modelRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/agent/**", (route) => {
    modelRequests.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  const report: {
    method: string;
    outcome: string;
    observedHead: string;
    buildReceiptHead: string;
    buildDirectory: string;
    buildReceiptPath: string;
    browserVersion: string;
    sourceBefore: Awaited<ReturnType<typeof pins>>;
    sourceAfter?: Awaited<ReturnType<typeof pins>>;
    bundle: { indexSha256: string; scriptPath: string; scriptSha256: string };
    observations: unknown[];
    pressure: RecordingBackpressureDiagnostics | null;
    pageErrors: string[];
    modelRequests: string[];
    publicStopCompleted: boolean;
    recordingStarted: boolean;
    preparationObserved: boolean;
    lateRecordingStarted: boolean;
  } = {
    method: "E2E_READ_ONLY_RUNTIME_DIAGNOSTIC_WITH_PUBLIC_UI_INPUT",
    outcome: "NOT_REACHED",
    observedHead: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repository,
      encoding: "utf8",
    }).trim(),
    browserVersion: browser.version(),
    buildReceiptHead: buildReceipt.head,
    buildDirectory,
    buildReceiptPath,
    sourceBefore,
    bundle: { indexSha256: sha(index), scriptPath: scriptPath!, scriptSha256: sha(script) },
    observations: [],
    pressure: null,
    pageErrors,
    modelRequests,
    publicStopCompleted: false,
    recordingStarted: false,
    preparationObserved: false,
    lateRecordingStarted: false,
  };
  try {
    await page.goto("/");
    await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
    await page
      .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
      .selectOption("en");
    const monitor = page.getByRole("region", { name: "Live monitoring", exact: true });
    await expect(monitor).toHaveAttribute("data-monitor-mode", "levels");
    expect(
      await page.evaluate(() => {
        const mounted: MountedReflectionLab | undefined = window.__reflectionLabMount;
        return typeof mounted?.runtime.getRecordingBackpressureDiagnostics;
      }),
    ).toBe("function");
    expect(
      await page.evaluate(() =>
        window.__reflectionLabMount!.runtime.getRecordingBackpressureDiagnostics(),
      ),
    ).toBeNull();
    await page
      .locator(".monitor-strip")
      .getByRole("button", { name: "Enable listening", exact: true })
      .click();
    await page
      .locator(".transport-bar")
      .getByRole("button", { name: "Start simulation", exact: true })
      .click();
    await expect(
      page.locator(".transport-bar").getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await expect(monitor.locator("canvas")).toHaveAttribute("data-monitor-painted-state", "active");
    await page.getByRole("tab", { name: /^Events & recording/ }).click();
    report.observations.push({
      phase: "before_recording",
      state: await page.evaluate(() => {
        const runtime = window.__reflectionLabMount!.runtime,
          view = runtime.getSnapshot();
        return {
          tick: view.tick,
          simulationState: view.simulationState,
          recording: view.recording,
          performanceTimeOrigin: performance.timeOrigin,
          observedAtWallMs: performance.now(),
        };
      }),
    });
    const observationStarted = performance.now();
    const browserObservationStartedAtMs = await page.evaluate(() => performance.now());
    await page.getByRole("button", { name: "● Start recording", exact: true }).click();
    const stop = page.getByRole("button", { name: "■ Stop recording", exact: true });
    let pollCount = 0;
    let otherPause = false;
    let startError: string | null = null;
    while (performance.now() - observationStarted < 10_000) {
      pollCount++;
      const observed = await page.evaluate(() => {
        const runtime = window.__reflectionLabMount!.runtime,
          view = runtime.getSnapshot();
        const pressure = runtime.getRecordingBackpressureDiagnostics();
        const guarded = pressure !== null || view.simulationState === "paused";
        return {
          pressure,
          advanceDiagnostics: guarded ? runtime.getRecordingAdvanceDiagnostics() : null,
          commitDiagnostics: guarded ? runtime.getRecordingCommitDiagnostics() : null,
          state: view.simulationState,
          recordingState: view.recording.state,
          preparing: view.notice === "正在準備錄製…" && view.recording.state !== "recording",
          error: view.error?.slice(0, 512) ?? null,
          observedAtWallMs: performance.now(),
        };
      });
      if (observed.preparing) {
        if (!report.preparationObserved)
          report.observations.push({
            phase: "preparation_observed",
            observedAtWallMs: observed.observedAtWallMs,
          });
        report.preparationObserved = true;
        // Preparation deliberately pauses the world; it is not a recording guard.
        await page.waitForTimeout(50);
        continue;
      }
      if (
        observed.recordingState === "recording" &&
        observed.observedAtWallMs <= browserObservationStartedAtMs + 10_000
      )
        report.recordingStarted = true;
      if (!report.recordingStarted) {
        startError = observed.error;
        if (startError) break;
        await page.waitForTimeout(50);
        continue;
      }
      report.pressure = observed.pressure;
      otherPause = observed.pressure === null && observed.state === "paused";
      if (report.pressure || otherPause) {
        report.observations.push({
          phase: "first_guard",
          observedAtWallMs: observed.observedAtWallMs,
          advanceDiagnostics: observed.advanceDiagnostics,
          commitDiagnostics: observed.commitDiagnostics,
        });
        break;
      }
      await page.waitForTimeout(50);
    }
    report.outcome = !report.recordingStarted
      ? startError
        ? "RECORDING_PREPARATION_FAILED"
        : report.preparationObserved
          ? "PREPARATION_NOT_COMPLETED"
          : "RECORDING_NOT_STARTED_WITHIN_TEN_SECONDS"
      : report.pressure
        ? report.pressure.diagnosticError !== null
          ? "PARTIAL_DIAGNOSTIC_AT_FIRST_GUARD"
          : report.pressure.observedAtWallMs !== null &&
              report.pressure.observedAtWallMs <= browserObservationStartedAtMs + 10_000
            ? "FIRST_GUARD_OBSERVED"
            : "GUARD_OUTSIDE_OR_WITHOUT_OBSERVATION_CLOCK"
        : otherPause
          ? "OTHER_PAUSE_OBSERVED"
          : "GUARD_NOT_REPRODUCED_WITHIN_TEN_SECONDS";
    report.observations.push({
      phase: "observation_end",
      elapsedWallMs: performance.now() - observationStarted,
      browserObservationStartedAtMs,
      pollCount,
      startError,
      headerMode: await monitor.getAttribute("data-monitor-mode"),
      state: await page.evaluate(() => {
        const runtime = window.__reflectionLabMount!.runtime,
          view = runtime.getSnapshot();
        return {
          tick: view.tick,
          simulationState: view.simulationState,
          pauseReason: view.pauseReason,
          recording: view.recording,
          observedAtWallMs: performance.now(),
        };
      }),
    });
    await expect(monitor).toHaveAttribute("data-monitor-mode", "levels");
    const screenshot = info.outputPath("guard-or-ten-seconds.png");
    await page.screenshot({ path: screenshot, scale: "css", fullPage: false });
    await info.attach("guard-or-ten-seconds", { path: screenshot, contentType: "image/png" });
    const cleanupState = await page.evaluate(() => {
      const view = window.__reflectionLabMount!.runtime.getSnapshot();
      return {
        recordingState: view.recording.state,
        simulationState: view.simulationState,
        preparing: view.notice === "正在準備錄製…",
        observedAtWallMs: performance.now(),
      };
    });
    report.lateRecordingStarted =
      !report.recordingStarted && cleanupState.recordingState === "recording";
    report.observations.push({ phase: "cleanup_current_state", ...cleanupState });
    // A late start is cleaned up publicly, without changing the already-fixed window outcome.
    if (!report.recordingStarted && !report.lateRecordingStarted) {
      // No active capture was observed to Stop or seal; keep the bounded negative outcome explicit.
      expect(pageErrors).toEqual([]);
      expect(modelRequests).toEqual([]);
      return;
    }
    await expect(stop).toHaveAttribute("aria-pressed", "true");
    await stop.click();
    await expect(page.getByText("Recording saved", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const artifact = await page.evaluate(() => {
      const value = window.__reflectionLabMount!.runtime.getRecordingArtifact();
      return value
        ? {
            runId: value.runId,
            status: value.status,
            frameCount: value.frameCount,
            startTick: value.startTick,
            endTick: value.endTick,
            artifactSha256: value.artifactSha256,
          }
        : null;
    });
    expect(artifact).not.toBeNull();
    expect(artifact!.status).toBe("captured");
    expect(artifact!.frameCount).toBeGreaterThan(0);
    expect(artifact!.startTick).not.toBeNull();
    expect(artifact!.endTick).not.toBeNull();
    expect(artifact!.endTick! - artifact!.startTick! + 1).toBe(artifact!.frameCount);
    expect(artifact!.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
    report.observations.push({
      phase: "sealed_prefix",
      artifact,
      diagnostics: await page.evaluate(() => {
        const runtime = window.__reflectionLabMount!.runtime;
        return {
          observedAtWallMs: performance.now(),
          advanceDiagnostics: runtime.getRecordingAdvanceDiagnostics(),
          commitDiagnostics: runtime.getRecordingCommitDiagnostics(),
        };
      }),
    });
    report.publicStopCompleted = true;
    expect(pageErrors).toEqual([]);
    expect(modelRequests).toEqual([]);
  } finally {
    report.sourceAfter = await pins();
    const target = info.outputPath("diagnostic.json");
    await writeFile(
      target,
      JSON.stringify(
        {
          ...report,
          limitations: [
            "This e2e debug diagnostic is separate from production DOM acceptance, native Computer Use, numerical validation and the 600-second performance gate.",
            "A completed diagnostic is not proof of recording throughput. Guard-not-reproduced is bounded negative evidence only.",
            "Readiness times observe main-thread API/promise events; worker construction is not ready and a protocol reply is not DSP completion.",
            "Read-only polling, timing and trace instrumentation have nonzero observation cost; no internal retry or automatic Resume occurs.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    await info.attach("recording-readiness-diagnostic", {
      path: target,
      contentType: "application/json",
    });
    expect(report.sourceAfter).toEqual(sourceBefore);
  }
});

// Make the existing bootstrap Window declaration part of this isolated fixture's type program.
const mountedType: MountedReflectionLab | null = null;
void mountedType;
