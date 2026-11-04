import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../..", import.meta.url));
/** Explicit local build selection; traversal, absolute paths and arbitrary URLs are rejected. */
const productionDist = (process.env.TOP_MONITOR_PRODUCTION_DIST ?? "dist").replaceAll("\\", "/");
if (
  productionDist !== "dist" &&
  !/^\.cache\/top-monitor-production-attempt\d{2}(?:-[a-z0-9-]+)?$/.test(productionDist)
)
  throw new Error("TOP_MONITOR_PRODUCTION_DIST_INVALID");
if (productionDist !== "dist" && !process.env.TOP_MONITOR_BUILD_RECEIPT)
  throw new Error("TOP_MONITOR_FRESH_DIST_REQUIRES_BUILD_RECEIPT");
const sourcePaths = [
  "src/app/bootstrap.ts",
  "src/app/runtime.ts",
  "src/app/live-monitor-labels.ts",
  "src/app/live-monitor-observation.ts",
  "src/app/recording-host.ts",
  "src/app/recording-evaluation-client.ts",
  "src/app/recording-evaluation.worker.ts",
  "src/experiments/recording-persistence.ts",
  "src/ui/locales/status.ts",
  "src/audio/engine.ts",
  "src/audio/live-monitor.ts",
  "src/ui/App.tsx",
  "src/ui/TopMonitor.tsx",
  "src/ui/contracts.ts",
  "src/ui/controller-ports.ts",
  "src/ui/live-monitor-contracts.ts",
  "src/ui/top-monitor-loop.ts",
  "src/ui/top-monitor-model.ts",
  "src/ui/top-monitor.css",
  "src/ui/styles.css",
  "tests/browser/top-monitor-production.config.ts",
  "tests/browser/top-monitor-production.spec.ts",
];
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const file = (path: string) => new URL(`../../${path}`, import.meta.url);
const monitor = (page: Page) => page.getByRole("region", { name: "Live monitoring", exact: true });
const summary = (page: Page) => monitor(page).locator(":scope > .top-monitor-accessible").first();
const modes = ["Levels", "Spectrum", "Waveform", "Load"] as const;
const modeKeys = ["levels", "spectrum", "waveform", "load"] as const;
interface SourcePin {
  path: string;
  sha256: string;
  bytes: number;
}
interface Evidence {
  schemaVersion: 1;
  method: "PLAYWRIGHT_PUBLIC_PRODUCTION_DOM";
  browserVersion: string;
  head: string;
  trackedDiffSha256: string;
  headSourceTree: string;
  productionDist: string;
  sourcePins: SourcePin[];
  bundle: {
    indexSha256: string;
    scriptPath: string;
    scriptSha256: string;
    httpMatchesDisk: boolean;
  };
  buildReceipt: { path: string; sha256: string; head: string; completedAt: string };
  screenshots: string[];
  observations: unknown[];
  pageErrors: string[];
  blockedModelRequests: string[];
}
const evidence = new Map<string, Evidence>();
async function sourcePins(): Promise<SourcePin[]> {
  return Promise.all(
    sourcePaths.map(async (path) => {
      const bytes = await readFile(file(path));
      return { path, sha256: sha256(bytes), bytes: bytes.length };
    }),
  );
}

async function openEnglish(page: Page) {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await expect(page.getByRole("region", { name: "即時監測", exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
    .selectOption("en");
  await expect(monitor(page)).toBeVisible();
  await expect(monitor(page)).toHaveAttribute("data-monitor-mode", "levels");
}
async function tick(page: Page): Promise<number> {
  const text = await page.locator(".run-status .subtle").innerText();
  const match = /^tick (\d+)$/.exec(text);
  expect(match, "public tick readout must be parseable").not.toBeNull();
  return Number(match![1]);
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  const target = info.outputPath(`${name}.png`);
  await page.screenshot({ path: target, fullPage: false, scale: "css" });
  await info.attach(name, { path: target, contentType: "image/png" });
  evidence.get(info.testId)!.screenshots.push(target);
}
function parseMeters(text: string) {
  // Read the accessible values rendered by production UI, never an engine/test API.
  return [
    ...text.matchAll(
      /([^:]{1,110}): (−∞|—|[+-]?\d+(?:\.\d+)?) dBFS peak, (−∞|—|[+-]?\d+(?:\.\d+)?) dBFS RMS\./g,
    ),
  ].map((entry) => ({
    label: entry[1]!.split(". ").at(-1)!.trim(),
    peak: entry[2] === "—" ? null : entry[2] === "−∞" ? -Infinity : Number(entry[2]),
    rms: entry[3] === "—" ? null : entry[3] === "−∞" ? -Infinity : Number(entry[3]),
  }));
}
async function meters(page: Page) {
  return parseMeters((await summary(page).textContent()) ?? "");
}
function loadMetrics(text: string): readonly (number | null)[] {
  return ["Frame interval", "Physics step", "Last solver", "Audio control"].map((label) => {
    const match = new RegExp(`${label}: (\\d+(?:\\.\\d+)?) ms\\.`).exec(text);
    const value = match ? Number(match[1]) : null;
    return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
  });
}
async function startSignal(page: Page) {
  const footer = page.locator(".monitor-strip");
  await footer.getByRole("button", { name: "Enable listening", exact: true }).click();
  await page.getByRole("button", { name: "Start simulation", exact: true }).click();
  await expect(
    page.locator(".transport-bar").getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await meters(page)).some(
          (value) => value.label === "Master L" && Number.isFinite(value.peak),
        ),
      { message: "real master signal must reach the UI after warmup" },
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await meters(page)).some(
          (value) => !/^Master [LR]$/.test(value.label) && Number.isFinite(value.rms),
        ),
      { message: "a real native source meter must be measured" },
    )
    .toBe(true);
}
async function expectPaint(page: Page, mode: string, input: string | null, state: string) {
  const canvas = monitor(page).locator("canvas");
  await expect(canvas).toHaveAttribute("data-monitor-painted-mode", mode);
  if (input !== null) await expect(canvas).toHaveAttribute("data-monitor-painted-input", input);
  await expect(canvas).toHaveAttribute("data-monitor-painted-state", state);
}
async function canvasObservation(page: Page) {
  return monitor(page)
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("2d");
      if (!context) return null;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const probe = document.createElement("canvas");
      probe.width = probe.height = 1;
      const probeContext = probe.getContext("2d")!;
      probeContext.fillStyle = getComputedStyle(canvas).getPropertyValue("--color-accent").trim();
      probeContext.fillRect(0, 0, 1, 1);
      const accent = probeContext.getImageData(0, 0, 1, 1).data;
      let drawn = 0,
        accentPixels = 0,
        accentMinY = Infinity,
        accentMaxY = -Infinity,
        checksum = 2166136261;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3]! > 0) drawn++;
        if (
          pixels[index + 3]! > 0 &&
          [0, 1, 2].every((channel) => Math.abs(pixels[index + channel]! - accent[channel]!) <= 2)
        ) {
          accentPixels++;
          const y = Math.floor(index / 4 / canvas.width);
          accentMinY = Math.min(accentMinY, y);
          accentMaxY = Math.max(accentMaxY, y);
        }
        checksum = Math.imul(checksum ^ pixels[index]!, 16777619) >>> 0;
        checksum = Math.imul(checksum ^ pixels[index + 1]!, 16777619) >>> 0;
        checksum = Math.imul(checksum ^ pixels[index + 2]!, 16777619) >>> 0;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        drawnPixels: drawn,
        accentPixels,
        signalVerticalSpan: accentPixels ? accentMaxY - accentMinY : 0,
        checksum,
      };
    });
}

test.beforeEach(async ({ page, browser, request }, info) => {
  const sources = await sourcePins();
  const index = await readFile(file(`${productionDist}/index.html`));
  const entry = /<script[^>]*\bsrc="(\/assets\/[A-Za-z0-9_.-]+\.js)"/.exec(
    index.toString("utf8"),
  )?.[1];
  expect(entry, "production build must have a bounded local asset entry").toBeTruthy();
  const script = await readFile(file(`${productionDist}${entry!}`));
  const indexResponse = await request.get("/");
  const scriptResponse = await request.get(entry!);
  expect(indexResponse.status()).toBe(200);
  expect(scriptResponse.status()).toBe(200);
  const httpMatchesDisk =
    sha256(await indexResponse.body()) === sha256(index) &&
    sha256(await scriptResponse.body()) === sha256(script);
  expect(httpMatchesDisk, "4173 must serve this integration tree's exact production build").toBe(
    true,
  );
  const buildReceiptPath =
    process.env.TOP_MONITOR_BUILD_RECEIPT ??
    fileURLToPath(file(".cache/nonadvanced-20261103/root/top-monitor-production-build.json"));
  const buildReceiptBytes = await readFile(buildReceiptPath);
  const buildReceipt = JSON.parse(buildReceiptBytes.toString("utf8")) as {
    schemaVersion: number;
    command: string;
    exitCode: number;
    head: string;
    completedAt: string;
    sourcePins: SourcePin[];
    bundle: { indexSha256: string; scriptPath: string; scriptSha256: string };
  };
  expect(buildReceipt.schemaVersion).toBe(1);
  expect(buildReceipt.exitCode, "Root's actual build must have completed successfully").toBe(0);
  expect(buildReceipt.command).toMatch(/build/);
  expect(Number.isFinite(Date.parse(buildReceipt.completedAt))).toBe(true);
  expect(buildReceipt.head).toMatch(/^[a-f0-9]{40}$/);
  for (const pin of sources.filter((value) => value.path.startsWith("src/"))) {
    expect(
      buildReceipt.sourcePins.find((value) => value.path === pin.path),
      `build-time source pin: ${pin.path}`,
    ).toEqual(pin);
  }
  expect(buildReceipt.bundle).toEqual({
    indexSha256: sha256(index),
    scriptPath: entry!,
    scriptSha256: sha256(script),
  });
  const data: Evidence = {
    schemaVersion: 1,
    method: "PLAYWRIGHT_PUBLIC_PRODUCTION_DOM",
    browserVersion: browser.version(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(),
    trackedDiffSha256: sha256(
      execFileSync("git", ["diff", "--no-ext-diff", "--binary"], {
        cwd: repository,
        maxBuffer: 16 * 1024 * 1024,
      }),
    ),
    headSourceTree: execFileSync("git", ["rev-parse", "HEAD:src"], {
      cwd: repository,
      encoding: "utf8",
    }).trim(),
    productionDist,
    sourcePins: sources,
    buildReceipt: {
      path: buildReceiptPath,
      sha256: sha256(buildReceiptBytes),
      head: buildReceipt.head,
      completedAt: buildReceipt.completedAt,
    },
    bundle: {
      indexSha256: sha256(index),
      scriptPath: entry!,
      scriptSha256: sha256(script),
      httpMatchesDisk,
    },
    screenshots: [],
    observations: [],
    pageErrors: [],
    blockedModelRequests: [],
  };
  evidence.set(info.testId, data);
  page.on("pageerror", (error) => data.pageErrors.push(error.message));
  await page.route("**/api/agent/**", (route) => {
    data.blockedModelRequests.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  await page.route("https://api.meta.ai/**", (route) => {
    data.blockedModelRequests.push(route.request().url());
    return route.abort("blockedbyclient");
  });
});
test.afterEach(async ({}, info) => {
  const data = evidence.get(info.testId);
  if (!data) return;
  const finalPins = await sourcePins();
  const sourcesUnchanged = JSON.stringify(finalPins) === JSON.stringify(data.sourcePins);
  const receipt = {
    ...data,
    statusBeforeAfterEachAssertions: info.status,
    expectedStatus: info.expectedStatus,
    sourcesUnchanged,
    finishedAt: new Date().toISOString(),
    limitations: [
      "Public DOM and pixels prove UI behavior; they do not independently calibrate FFT/RMS or prove sample phase continuity.",
      "Playwright method is separate from Windows Computer Use and subjective hearing.",
      "This suite does not qualify the original 600-second performance gate.",
    ],
  };
  const target = info.outputPath("production-receipt.json");
  await writeFile(
    target,
    `${JSON.stringify(receipt, (_key, value) => (typeof value === "number" && !Number.isFinite(value) ? String(value) : value), 2)}\n`,
  );
  await info.attach("production-receipt", { path: target, contentType: "application/json" });
  evidence.delete(info.testId);
  expect(sourcesUnchanged, "source mutation during this frozen run invalidates attribution").toBe(
    true,
  );
  expect(data.pageErrors).toEqual([]);
  expect(data.blockedModelRequests, "no model call should be attempted by monitoring").toEqual([]);
});

test("blocked monitor switches all views with pointer, keyboard, channel and locale without starting the scene", async ({
  page,
}, info) => {
  await openEnglish(page);
  await expect(page.locator(".project-bar .workspace-tabs")).toHaveCount(0);
  for (const name of ["Build scene", "Interactive experiment", "Inspect & compare"])
    await expect(
      page.locator(".project-bar").getByRole("button", { name, exact: true }),
    ).toHaveCount(0);
  const initialTick = await tick(page);
  const project = await page.locator(".project-name").textContent();
  for (let index = 0; index < modes.length; index++) {
    await monitor(page).getByRole("button", { name: modes[index]!, exact: true }).click();
    await expect(monitor(page)).toHaveAttribute("data-monitor-mode", modeKeys[index]!);
    await expect(
      monitor(page).getByRole("button", { name: modes[index]!, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    if (modeKeys[index] !== "load")
      await expect(monitor(page).locator(".top-monitor-message")).toHaveText(
        "Enable listening to view the actual signal",
      );
  }
  const levels = monitor(page).getByRole("button", { name: "Levels", exact: true });
  await levels.focus();
  await page.keyboard.press("Space");
  for (const name of ["Spectrum", "Waveform", "Load"] as const) {
    await page.keyboard.press("Tab");
    await expect(monitor(page).getByRole("button", { name, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(monitor(page).getByRole("button", { name, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  for (const name of ["Spectrum", "Waveform"] as const) {
    await monitor(page).getByRole("button", { name, exact: true }).click();
    const channel = monitor(page).getByRole("combobox", { name: "Monitor channel", exact: true });
    for (const value of ["master-right", "master-left", "master-right"]) {
      await channel.selectOption(value);
      await expect(channel).toHaveValue(value);
      await expect(monitor(page).getByRole("img")).toHaveAttribute(
        "aria-label",
        `${name} · Master ${value === "master-right" ? "R" : "L"}`,
      );
    }
  }
  expect(await page.locator(".project-name").textContent()).toBe(project);
  await page
    .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
    .selectOption("zh-TW");
  const chinese = page.getByRole("region", { name: "即時監測", exact: true });
  await expect(chinese.getByRole("button", { name: "波形", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(chinese.getByRole("combobox", { name: "監測聲道", exact: true })).toHaveValue(
    "master-right",
  );
  for (const name of ["音量", "頻譜", "波形", "負載"])
    await expect(chinese.getByRole("button", { name, exact: true })).toBeVisible();
  expect(await tick(page)).toBe(initialTick);
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  evidence.get(info.testId)!.observations.push({
    initialTick,
    finalTick: await tick(page),
    blocked: true,
    locale: "zh-TW",
    selectedMode: "waveform",
    channel: "master-right",
  });
  await screenshot(page, info, "blocked-zh-waveform");
});

test("real master/source levels, spectrum, waveform and load remain usable through mute and pause", async ({
  page,
}, info) => {
  await openEnglish(page);
  await startSignal(page);
  const before = await meters(page);
  evidence.get(info.testId)!.observations.push({ phase: "audible", meters: before });
  await screenshot(page, info, "active-levels");
  for (const name of ["Spectrum", "Waveform", "Load"] as const) {
    await monitor(page).getByRole("button", { name, exact: true }).click();
    await expect(monitor(page).locator(".top-monitor-message")).toBeEmpty();
    await expectPaint(page, name.toLowerCase(), null, "active");
    await expect
      .poll(async () => (await canvasObservation(page))?.drawnPixels ?? 0)
      .toBeGreaterThan(0);
    if (name !== "Load") {
      for (const value of ["master-right", "master-left"]) {
        await monitor(page)
          .getByRole("combobox", { name: "Monitor channel", exact: true })
          .selectOption(value);
        await expectPaint(page, name.toLowerCase(), value, "active");
        await expect
          .poll(async () => (await canvasObservation(page))?.signalVerticalSpan ?? 0, {
            message: `${name} must show real non-flat signal data, not just axes`,
          })
          .toBeGreaterThan(2);
      }
    } else {
      await expect(summary(page)).toContainText("Physics step:");
      await expect(summary(page)).toContainText("Worker");
      await expect(summary(page)).toContainText("not whole-system");
      await expect
        .poll(
          async () =>
            loadMetrics((await summary(page).textContent()) ?? "").every((value) => value !== null),
          {
            message:
              "all four actual load observations must be available before capture; missing values are not zero",
          },
        )
        .toBe(true);
      evidence.get(info.testId)!.observations.push({
        phase: "measured-load-values",
        fields: ["frameIntervalMs", "physicsMs", "acousticWorkerMs", "audioControlMs"],
        values: loadMetrics((await summary(page).textContent()) ?? ""),
      });
    }
    evidence.get(info.testId)!.observations.push({
      phase: name,
      canvas: await canvasObservation(page),
      summary: await summary(page).textContent(),
      tick: await tick(page),
    });
    await screenshot(page, info, `active-${name.toLowerCase()}`);
  }
  await monitor(page).getByRole("button", { name: "Levels", exact: true }).click();
  await page
    .locator(".monitor-strip")
    .getByRole("button", { name: "Mute monitor", exact: true })
    .click();
  await expect
    .poll(
      async () => {
        const values = await meters(page);
        return (
          values.filter((value) => /^Master [LR]$/.test(value.label)).length === 2 &&
          values
            .filter((value) => /^Master [LR]$/.test(value.label))
            .every((value) => value.peak === -Infinity && value.rms === -Infinity) &&
          values.some((value) => !/^Master [LR]$/.test(value.label) && Number.isFinite(value.rms))
        );
      },
      { message: "muted post-output is digital zero while pre-propagation source stays active" },
    )
    .toBe(true);
  evidence.get(info.testId)!.observations.push({ phase: "muted", meters: await meters(page) });
  await screenshot(page, info, "muted-levels");
  await page
    .locator(".monitor-strip")
    .getByRole("button", { name: "Monitor muted", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await meters(page)).some(
        (value) => value.label === "Master L" && Number.isFinite(value.peak),
      ),
    )
    .toBe(true);
  await page.locator(".transport-bar").getByRole("button", { name: "Pause", exact: true }).click();
  await expect(monitor(page).locator(".top-monitor-message")).toHaveText("Listening is paused");
  evidence.get(info.testId)!.observations.push({
    phase: "paused",
    summary: await summary(page).textContent(),
    tick: await tick(page),
  });
});

test("switching views and channels preserves a live recording and monotonic public tick", async ({
  page,
}, info) => {
  await openEnglish(page);
  await startSignal(page);
  await page.getByRole("tab", { name: /^Events & recording/ }).click();
  await page.getByRole("button", { name: "● Start recording", exact: true }).click();
  const stop = page.getByRole("button", { name: "■ Stop recording", exact: true });
  await expect(stop).toHaveAttribute("aria-pressed", "true");
  const project = await page.locator(".project-name").textContent();
  let previousTick = await tick(page);
  const history: unknown[] = [];
  for (const name of ["Spectrum", "Waveform", "Load", "Levels"] as const) {
    await monitor(page).getByRole("button", { name, exact: true }).click();
    if (name === "Spectrum" || name === "Waveform")
      await monitor(page)
        .getByRole("combobox", { name: "Monitor channel", exact: true })
        .selectOption("master-right");
    await expect(stop).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator(".transport-bar").getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => tick(page), { message: `recorded fixed ticks must advance in ${name}` })
      .toBeGreaterThan(previousTick);
    const current = await tick(page);
    expect(current).toBeGreaterThan(previousTick);
    history.push({ mode: name, tick: current });
    previousTick = current;
    expect(await page.locator(".project-name").textContent()).toBe(project);
  }
  await screenshot(page, info, "recording-levels");
  await stop.click();
  await expect(page.getByText("Recording saved", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("button", { name: "▶ Replay recording", exact: true }),
  ).toBeEnabled();
  const publicDuration = await page.locator(".events-panel .dock-toolbar > .numeric").innerText();
  const durationMatch = /(\d+(?:\.\d+)?)\s*s/.exec(publicDuration);
  expect(durationMatch, "saved public recording duration must be present").not.toBeNull();
  expect(Number(durationMatch![1])).toBeGreaterThan(0);
  evidence.get(info.testId)!.observations.push({
    publicDuration,
    recordingStayedActiveAcrossAllViews: true,
    history,
    finalRecording: "Recording saved",
    sourcePhaseContinuity: "NOT_INDEPENDENTLY_MEASURED_BY_DOM",
  });
  await page.locator(".transport-bar").getByRole("button", { name: "Pause", exact: true }).click();
});

test("header modes fit 390/929/1440 CSS px and footer controls remain reachable", async ({
  page,
}, info) => {
  await openEnglish(page);
  for (const width of [390, 929, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
    const geometry: unknown[] = [];
    for (let index = 0; index < modes.length; index++) {
      const name = modes[index]!;
      const button = monitor(page).getByRole("button", { name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      const bounds = await monitor(page).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      for (const candidate of modes) {
        const target = monitor(page).getByRole("button", { name: candidate, exact: true });
        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
        expect(box!.width).toBeGreaterThanOrEqual(24);
        expect(box!.height).toBeGreaterThanOrEqual(24);
      }
      geometry.push({ mode: modeKeys[index], bounds });
      await screenshot(page, info, `header-${width}-${modeKeys[index]}`);
    }
    const viewportToolbar = page.locator(".viewport-toolbar");
    const viewportButtons = viewportToolbar.getByRole("button");
    const viewportButtonBounds: {
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
    for (const button of await viewportButtons.all()) {
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      viewportButtonBounds.push({ name: (await button.textContent())?.trim() ?? "", ...box! });
    }
    for (let first = 0; first < viewportButtonBounds.length; first++) {
      for (let second = first + 1; second < viewportButtonBounds.length; second++) {
        const a = viewportButtonBounds[first]!,
          b = viewportButtonBounds[second]!;
        const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(
          overlapWidth <= 0 || overlapHeight <= 0,
          `viewport controls overlap at ${width}: ${a.name} / ${b.name}`,
        ).toBe(true);
      }
    }
    await viewportToolbar.getByRole("button", { name: "Frame selection", exact: true }).click();
    await expect(
      viewportToolbar.getByRole("button", { name: "Enter first person", exact: true }),
    ).toBeEnabled();
    evidence.get(info.testId)!.observations.push({
      width,
      viewportControlsNonOverlapping: true,
      viewportButtonBounds,
      frameSelectionClicked: true,
    });
    await screenshot(page, info, `viewport-tools-${width}`);
    const footer = page.locator(".monitor-strip");
    for (const target of [
      footer.locator(".monitor-mute"),
      footer.getByRole("slider", { name: "Monitor gain", exact: true }),
      footer.getByRole("combobox", { name: "Audio buffer", exact: true }),
      footer.getByRole("button", { name: "Simulated", exact: true }),
      footer.getByRole("button", { name: "Raw reference", exact: true }),
    ]) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toBeInViewport({ ratio: 1 });
      await target.focus();
      await expect(target).toBeFocused();
    }
    const gain = footer.getByRole("slider", { name: "Monitor gain", exact: true });
    await gain.focus();
    await page.keyboard.press("Home");
    await expect(gain).toHaveValue("-40");
    await expect(gain).toHaveAttribute("aria-valuetext", "-40 dB");
    await page.keyboard.press("End");
    await expect(gain).toHaveValue("12");
    await expect(gain).toHaveAttribute("aria-valuetext", "+12 dB");
    for (let step = 0; step < 12; step++) await page.keyboard.press("ArrowLeft");
    await expect(gain).toHaveValue("0");
    const mute = footer.locator(".monitor-mute");
    if (await mute.textContent().then((value) => value?.includes("Enable listening"))) {
      await mute.click();
      await expect(mute).toHaveText("Mute monitor");
    } else {
      const beforeMute = await mute.getAttribute("aria-pressed");
      await mute.click();
      await expect(mute).toHaveAttribute("aria-pressed", beforeMute === "true" ? "false" : "true");
      await mute.click();
      await expect(mute).toHaveAttribute("aria-pressed", beforeMute!);
    }
    await footer.getByRole("button", { name: "Raw reference", exact: true }).click();
    await expect(
      footer.getByRole("button", { name: "Raw reference", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await footer.getByRole("button", { name: "Simulated", exact: true }).click();
    await expect(footer.getByRole("button", { name: "Simulated", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await footer
      .getByRole("combobox", { name: "Audio buffer", exact: true })
      .selectOption("balanced");
    await expect(footer.getByRole("combobox", { name: "Audio buffer", exact: true })).toHaveValue(
      "balanced",
    );
    await footer
      .getByRole("combobox", { name: "Audio buffer", exact: true })
      .selectOption("playback");
    await screenshot(page, info, `footer-${width}`);
    evidence
      .get(info.testId)!
      .observations.push({ width, deviceScaleFactor: 1, geometry, footerControlsReachable: true });
  }
});

test("switching all monitor views preserves the selected object and an unsaved valid zone draft", async ({
  page,
}, info) => {
  await openEnglish(page);
  const speaker = page
    .getByRole("list", { name: "Scene object list", exact: true })
    .getByRole("button", { name: "speaker Fixed", exact: true });
  await speaker.click();
  await expect(speaker).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Zones", exact: true }).click();
  const zones = page.locator(".zone-panel");
  await zones.getByRole("button", { name: "Add zone", exact: true }).click();
  const draft = zones.locator("form");
  await expect(draft).toBeVisible();
  await draft.getByRole("textbox", { name: "Zone ID", exact: true }).fill("zone.monitor-draft");
  await draft.getByRole("textbox", { name: "Name", exact: true }).fill("Monitor draft — 尚未儲存");
  await draft.getByRole("combobox", { name: "Shape", exact: true }).selectOption("sphere");
  await draft.getByRole("spinbutton", { name: /^Radius\s*m$/ }).fill("2.5");
  const project = await page.locator(".project-name").textContent();
  const initialTick = await tick(page);
  for (const name of modes) {
    await monitor(page).getByRole("button", { name, exact: true }).click();
    await expect(monitor(page).getByRole("button", { name, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(speaker).toHaveAttribute("aria-pressed", "true");
    await expect(draft.getByRole("textbox", { name: "Zone ID", exact: true })).toHaveValue(
      "zone.monitor-draft",
    );
    await expect(draft.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
      "Monitor draft — 尚未儲存",
    );
    await expect(draft.getByRole("combobox", { name: "Shape", exact: true })).toHaveValue("sphere");
    await expect(draft.getByRole("spinbutton", { name: /^Radius\s*m$/ })).toHaveValue("2.5");
    await expect(draft.getByRole("button", { name: "Save zone", exact: true })).toBeEnabled();
    await expect(zones.getByText("No zones yet", { exact: true })).toBeVisible();
    expect(await page.locator(".project-name").textContent()).toBe(project);
    expect(await tick(page)).toBe(initialTick);
    await expect(
      page.locator(".monitor-strip").getByRole("button", { name: "Enable listening", exact: true }),
    ).toBeVisible();
  }
  await screenshot(page, info, "selected-speaker-unsaved-zone-draft");
  await draft.getByRole("button", { name: "Cancel draft", exact: true }).click();
  await expect(draft).toHaveCount(0);
  await expect(zones.getByText("No zones yet", { exact: true })).toBeVisible();
  await expect(speaker).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator(".project-name").textContent()).toBe(project);
  evidence.get(info.testId)!.observations.push({
    selectedObject: "speaker",
    fourViewsPreservedUnsavedDraft: true,
    draft: {
      id: "zone.monitor-draft",
      name: "Monitor draft — 尚未儲存",
      shape: "sphere",
      radiusM: "2.5",
    },
    initialTick,
    finalTick: await tick(page),
    sceneRevisionTextUnchanged: true,
    explicitlyCancelledWithoutSaving: true,
  });
});
