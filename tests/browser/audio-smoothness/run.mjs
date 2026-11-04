// Audio smoothness measurement for the real app in headless Chrome.
// Usage: node tests/browser/audio-smoothness/run.mjs --root <repo> --out <dir> [--seconds 30] [--scenario editor|fps-walk]
// It reports rendered-output dropouts (sudden level falls of the continuous source),
// audio pauses, engine counters and main-thread stalls. Headless Chrome evidence only.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i].startsWith("--")) throw new Error(`Unexpected argument ${process.argv[i]}`);
  args[process.argv[i].slice(2)] = process.argv[i + 1] ?? "";
}
const root = path.resolve(args.root || process.cwd());
const out = path.resolve(args.out || "artifacts/v1/r21-audio-smoothness");
const seconds = Number(args.seconds || 30);
const scenarios = (args.scenario || "editor,fps-walk").split(",");
const port = Number(args.port || 5199);
const variant = args.variant || ""; // query string such as "latency=playback&render=none"

const WINDOW_QUANTA = 4; // 4 x 128 frames, about 10.7 ms at 48 kHz
const BASELINE_WINDOWS = 30; // about 320 ms of preceding level
const SILENCE_DB = -70;
const DROP_DB = 20;

export function analyseRendered({ rms, sampleRate, quantumFrames }) {
  if (!rms.length)
    return {
      method: "NOT_RUN: tap disabled",
      dropoutCount: null,
      dropoutTotalMs: null,
      audibleWindowShare: null,
      dropouts: [],
    };
  const windows = [];
  for (let i = 0; i + WINDOW_QUANTA <= rms.length; i += WINDOW_QUANTA) {
    let sum = 0;
    for (let j = 0; j < WINDOW_QUANTA; j++) sum += rms[i + j] ** 2;
    windows.push(10 * Math.log10(sum / WINDOW_QUANTA + 1e-20));
  }
  const windowMs = ((WINDOW_QUANTA * quantumFrames) / (sampleRate || 48000)) * 1000;
  const dropouts = [];
  let open = null;
  for (let i = BASELINE_WINDOWS; i < windows.length; i++) {
    const previous = windows.slice(i - BASELINE_WINDOWS, i).sort((a, b) => a - b);
    const baseline = previous[Math.floor(previous.length / 2)];
    const falling = baseline > SILENCE_DB && windows[i] < baseline - DROP_DB;
    if (falling && !open)
      open = { startMs: i * windowMs, baselineDb: baseline, minDb: windows[i], windows: 1 };
    else if (falling && open) {
      open.windows++;
      open.minDb = Math.min(open.minDb, windows[i]);
    } else if (!falling && open) {
      dropouts.push({ ...open, durationMs: open.windows * windowMs });
      open = null;
    }
  }
  if (open) dropouts.push({ ...open, durationMs: open.windows * windowMs });
  const audible = windows.filter((value) => value > SILENCE_DB).length;
  return {
    method: `window ${WINDOW_QUANTA} quanta (${windowMs.toFixed(1)} ms); dropout = level below the median of the previous ${BASELINE_WINDOWS} windows by more than ${DROP_DB} dB while that median exceeds ${SILENCE_DB} dBFS`,
    capturedSeconds: (rms.length * quantumFrames) / (sampleRate || 48000),
    audibleWindowShare: windows.length ? audible / windows.length : 0,
    dropoutCount: dropouts.length,
    dropoutTotalMs: dropouts.reduce((sum, value) => sum + value.durationMs, 0),
    dropouts: dropouts.slice(0, 200),
  };
}

async function main() {
  await mkdir(out, { recursive: true });
  const server = await createServer({
    root,
    configFile: path.join(root, "vite.config.ts"),
    cacheDir: path.join(root, ".cache", "vite-audio-smoothness"),
    logLevel: "warn",
    server: { host: "127.0.0.1", port, strictPort: true },
  });
  await server.listen();
  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const summary = { root, seconds, variant, browser: browser.version(), results: [] };
  try {
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(
        `http://127.0.0.1:${port}/tests/browser/audio-smoothness/fixture.html${variant ? `?${variant}` : ""}`,
      );
      await page.waitForFunction(
        () => window.__audioSmoothness?.ready || window.__audioSmoothness?.error,
        null,
        {
          timeout: 120_000,
        },
      );
      const mountError = await page.evaluate(() => window.__audioSmoothness.error);
      if (mountError) throw new Error(mountError);
      await page.click("#enable-audio");
      await page.waitForFunction(() => window.__audioSmoothness.audioEnabled, null, {
        timeout: 30_000,
      });
      await page.waitForTimeout(1500);
      const result = await page.evaluate((options) => window.__audioSmoothness.run(options), {
        scenario,
        seconds,
      });
      const analysis = analyseRendered(result.rendered);
      const { rendered, ...rest } = result;
      void rendered;
      const record = { ...rest, renderedAnalysis: analysis, pageErrors: errors };
      await writeFile(path.join(out, `${scenario}.json`), JSON.stringify(record, null, 2));
      summary.results.push({
        scenario,
        wallSeconds: record.wallSeconds,
        simulatedSeconds: record.simulatedSeconds,
        audioPauseCalls: record.audio.pauseCalls.length,
        lateEvents: record.audio.lateEventsDelta,
        droppedVoices: record.audio.droppedVoicesDelta,
        droppedPaths: record.audio.droppedPathsDelta,
        staleFrames: record.audio.staleFramesDelta,
        dropoutCount: analysis.dropoutCount,
        dropoutTotalMs: analysis.dropoutTotalMs,
        audibleWindowShare: analysis.audibleWindowShare,
        frameP95Ms: record.mainThread.frameIntervalMs.p95,
        framesOver50ms: record.mainThread.framesOver50ms,
        longTaskTotalMs: record.mainThread.longTaskTotalMs,
        playbackStatsAfter: record.audio.playbackStatsAfter,
        renderLoadMean: record.audio.renderCapacity?.averageLoadMean ?? null,
        renderPeakLoadMax: record.audio.renderCapacity?.peakLoadMax ?? null,
        graphChurn: record.audio.graphChurn,
        maxActiveVoices: record.audio.maxActiveVoices,
        maxActivePaths: record.audio.maxActivePaths,
        pageErrors: errors.length,
      });
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  await writeFile(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

if (
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("run.mjs")
)
  await main();
