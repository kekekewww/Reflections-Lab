import type { Locator, Page } from "@playwright/test";
import { test, expect, type S4Evidence } from "./s4-fixtures.js";
import { inspectRecording } from "./s4-evidence.js";

const modeNames = {
  levels: "Levels",
  spectrum: "Spectrum",
  waveform: "Waveform",
  load: "Load",
} as const;
type Mode = keyof typeof modeNames;
const topMonitor = (page: Page) => page.locator("section.top-monitor");
const footer = (page: Page) => page.locator("footer.monitor-strip");
const transport = (page: Page) => page.locator(".transport-actions > .primary-button");
const tick = (page: Page) => page.locator(".run-status .subtle.mono");

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
  await expect(page.getByRole("region", { name: "Live monitoring", exact: true })).toBeVisible();
  await expect(topMonitor(page).locator("canvas")).toHaveCount(1);
  await expect(page.locator(".workspace-tabs")).toHaveCount(0);
  await expect(footer(page)).toBeVisible();
  return topMonitor(page);
}
async function selectMode(page: Page, mode: Mode) {
  const top = topMonitor(page),
    group = top.getByRole("group", { name: "Monitoring view", exact: true });
  await group.getByRole("button", { name: modeNames[mode], exact: true }).click();
  await expect(top).toHaveAttribute("data-monitor-mode", mode);
  await expect(group.locator("button[aria-pressed=true]")).toHaveCount(1);
  await expect(group.getByRole("button", { name: modeNames[mode], exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  return top;
}
async function footerControls(page: Page) {
  return footer(page).evaluate((element) =>
    Array.from(element.querySelectorAll("button,input,select"), (control) => {
      const input = control as HTMLInputElement;
      return {
        tag: control.tagName,
        text: control.textContent?.trim(),
        name: control.getAttribute("aria-label"),
        value: input.value ?? null,
        checked: input.type === "checkbox" ? input.checked : null,
        pressed: control.getAttribute("aria-pressed"),
      };
    }),
  );
}
async function publicPausedState(page: Page) {
  return {
    project: await page.locator(".project-name").innerText(),
    tick: await tick(page).innerText(),
    transport: await transport(page).innerText(),
    selected: await page.locator(".object-row[aria-pressed=true]").allTextContents(),
  };
}
async function archivedRecording(page: Page, s4: S4Evidence, label: string) {
  await page.getByRole("tab", { name: /^Events & recording/ }).click();
  const download = await s4.download(
    page.getByRole("button", { name: "Export archived recording", exact: true }),
    label,
  );
  const recording = inspectRecording(download.bytes);
  s4.attach(label, recording);
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  return recording;
}
async function addContinuousSpeaker(page: Page) {
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("zh-TW");
  await page
    .locator(".object-row")
    .filter({ has: page.locator('[title="speaker"]') })
    .click();
  await page
    .getByRole("combobox", { name: "新增行為觸發條件", exact: true })
    .selectOption("AlwaysOn");
  const count = await page.locator(".behavior-card").count();
  await page.locator(".inspector").getByRole("button", { name: "新增", exact: true }).click();
  await expect(page.locator(".behavior-card")).toHaveCount(count + 1);
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
}
async function expectActiveAudio(top: Locator) {
  await expect(top.locator(".top-monitor-message")).toBeHidden({ timeout: 30_000 });
  await expect(top.locator(".top-monitor-readout")).toHaveText(/^[LR] .+ dBFS$/, {
    timeout: 30_000,
  });
}

test("top monitoring switches all four views by keyboard without enabling audio or changing paused scene state", async ({
  page,
  s4,
}) => {
  const top = await open(page),
    group = top.getByRole("group", { name: "Monitoring view", exact: true });
  await page
    .locator(".object-row")
    .filter({ has: page.locator('[title="speaker"]') })
    .click();
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  const duration = page.getByRole("spinbutton", { name: "Capture duration s", exact: true });
  await duration.fill("17");
  await duration.press("Enter");
  const before = await publicPausedState(page),
    footerBefore = await footerControls(page);
  await expect(top).toHaveAttribute("data-monitor-mode", "levels");
  await expect(top.locator(".top-monitor-message")).toHaveText(
    "Enable listening to view the actual signal",
  );
  await expect(top.getByRole("img", { name: "Levels", exact: true })).toBeVisible();
  await expect(
    footer(page).getByRole("button", { name: "Enable listening", exact: true }),
  ).toBeVisible();
  s4.cover(
    "top-monitor.blocked",
    "real-fresh-context-audio-not-enabled-message-with-no-invented-signal",
  );
  s4.cover("top-monitor.levels", "default-levels-public-controls-and-dBFS-description", {
    actualSignal: "NOT_ENABLED_IN_THIS_STEP",
  });
  await group.getByRole("button", { name: "Levels", exact: true }).focus();
  for (const [mode, key] of [
    ["spectrum", "Space"],
    ["waveform", "Enter"],
    ["load", "Space"],
  ] as const) {
    await page.keyboard.press("Tab");
    const button = group.getByRole("button", { name: modeNames[mode], exact: true });
    await expect(button).toBeFocused();
    await button.press(key);
    await expect(top).toHaveAttribute("data-monitor-mode", mode);
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  s4.cover("top-monitor.keyboard", "native-Tab-Space-Enter-select-all-four-buttons");
  await expect(top.getByRole("combobox", { name: "Monitor channel", exact: true })).toHaveCount(0);
  await expect(top.getByText("Processing timings", { exact: true })).toBeVisible();
  await expect(top.locator(".top-monitor-accessible").first()).toContainText("Frame interval:");
  for (const name of ["Physics step:", "Last solver:", "Audio control:"])
    await expect(top.locator(".top-monitor-accessible").first()).toContainText(name);
  await expect(top.locator(".top-monitor-accessible").first()).toContainText(
    "not whole-system or native DSP CPU percentages",
  );
  s4.cover(
    "top-monitor.load",
    "four-actual-timing-fields-ms-with-unmeasured-values-retained-without-audio",
    { cpuPercentageClaimed: false, formalPerformance: "NOT_RUN" },
  );
  expect(await publicPausedState(page)).toEqual(before);
  expect(await footerControls(page)).toEqual(footerBefore);
  await expect(duration).toHaveValue("17");
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("zh-TW");
  await expect(page.getByRole("region", { name: "即時監測", exact: true })).toBeVisible();
  await expect(
    top
      .getByRole("group", { name: "監測檢視", exact: true })
      .getByRole("button", { name: "負載", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(top.getByText("處理耗時", { exact: true })).toBeVisible();
  await s4.snapshot("top-monitor-load-zh-keyboard-state-preserved", top);
  s4.attach("top-monitor-unchanged-public-paused-state", {
    before,
    footerBefore,
    after: await publicPausedState(page),
    recording: "No capture is requested by a view switch",
    nativeIme: "NOT_RUN",
  });
});

test("real listening exposes left and right monitoring while mute and pause preserve an archived recording", async ({
  page,
  s4,
}) => {
  const top = await open(page);
  await addContinuousSpeaker(page);
  await page.getByRole("tab", { name: "Audio export", exact: true }).click();
  const panel = page.locator(".render-panel"),
    duration = panel.getByRole("spinbutton", { name: "Capture duration s", exact: true });
  await duration.fill("1");
  await duration.press("Enter");
  await panel.getByRole("button", { name: "Capture 1 second", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Render audio files", exact: true })).toBeEnabled({
    timeout: 60_000,
  });
  const recordedBefore = await archivedRecording(page, s4, "top-monitor-before-source-recording");
  expect(recordedBefore.status).toBe("captured");
  await footer(page).getByRole("button", { name: "Enable listening", exact: true }).click();
  await transport(page).click();
  await expect(transport(page)).toHaveText("Pause");
  await selectMode(page, "levels");
  await expectActiveAudio(top);
  await expect(top.locator(".top-monitor-accessible").first()).toContainText("dBFS peak");
  await expect(top.locator(".top-monitor-accessible").first()).toContainText("dBFS RMS");
  s4.cover("top-monitor.levels", "real-enabled-audio-master-and-source-accessible-level-summary", {
    units: "dBFS",
    hearingOrDspReference: "NOT_CLAIMED",
  });
  for (const mode of ["spectrum", "waveform"] as const) {
    await selectMode(page, mode);
    const channel = top.getByRole("combobox", { name: "Monitor channel", exact: true });
    for (const [value, label, family] of [
      ["master-left", "L", `${mode}-left`],
      ["master-right", "R", `${mode}-right`],
    ] as const) {
      await channel.selectOption(value);
      await expect(channel).toHaveValue(value);
      await expect(
        top.getByRole("img", { name: `${modeNames[mode]} · Master ${label}`, exact: true }),
      ).toBeVisible();
      await expectActiveAudio(top);
      await expect(top.locator(".top-monitor-readout")).toHaveText(
        new RegExp(`^${label} .+ dBFS$`),
      );
      await s4.snapshot(`top-monitor-${family}-real-audio`, top);
      s4.cover(`top-monitor.${family}`, "real-channel-selector-and-active-audio-state", {
        input: value,
        numericFftOrWaveformReference: "SEPARATE_AUDIO_GATE",
      });
    }
  }
  await selectMode(page, "levels");
  await footer(page).getByRole("button", { name: "Mute monitor", exact: true }).click();
  await expect(
    footer(page).getByRole("button", { name: "Monitor muted", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(top.locator(".top-monitor-readout")).toHaveText("Muted · dBFS");
  const tickBeforeMuteSwitch = Number((await tick(page).innerText()).replace(/^tick /, ""));
  await selectMode(page, "waveform");
  await expect(top.locator(".top-monitor-readout")).toHaveText("Muted · dBFS");
  await expect(transport(page)).toHaveText("Pause");
  await expect
    .poll(async () => Number((await tick(page).innerText()).replace(/^tick /, "")))
    .toBeGreaterThan(tickBeforeMuteSwitch);
  s4.cover(
    "top-monitor.muted",
    "public-footer-mute-retained-while-simulation-continues-and-view-switches",
    { actualMasterPcmReference: "SEPARATE_AUDIO_GATE" },
  );
  await footer(page).getByRole("button", { name: "Monitor muted", exact: true }).click();
  await transport(page).click();
  await expect(transport(page)).toHaveText("Resume");
  await selectMode(page, "levels");
  await expect(top.locator(".top-monitor-message")).toHaveText("Listening is paused", {
    timeout: 30_000,
  });
  const pausedBefore = await publicPausedState(page),
    footerBefore = await footerControls(page);
  for (const mode of ["spectrum", "waveform", "load", "levels"] as const)
    await selectMode(page, mode);
  await expect(top.locator(".top-monitor-message")).toHaveText("Listening is paused");
  expect(await publicPausedState(page)).toEqual(pausedBefore);
  expect(await footerControls(page)).toEqual(footerBefore);
  await expect(duration).toHaveValue("1");
  const recordedAfter = await archivedRecording(page, s4, "top-monitor-after-source-recording");
  expect(recordedAfter.artifactSha256).toBe(recordedBefore.artifactSha256);
  expect(recordedAfter.canonicalSha256).toBe(recordedBefore.canonicalSha256);
  expect(recordedAfter.runId).toBe(recordedBefore.runId);
  expect(recordedAfter.runEpoch).toBe(recordedBefore.runEpoch);
  expect(recordedAfter.frameCount).toBe(recordedBefore.frameCount);
  s4.cover(
    "top-monitor.paused",
    "real-Pause-audio-message-and-switching-preserve-tick-selection-draft-recording-identities",
    { recordedBefore, recordedAfter, pausedBefore },
  );
  await s4.snapshot("top-monitor-paused-recording-preserved", top);
});

test("an actually hidden document retains the selected monitor view on return when the browser exposes background visibility", async ({
  page,
  s4,
}) => {
  const top = await open(page);
  await selectMode(page, "load");
  await expect(top.locator(".top-monitor-accessible").first()).toContainText("Frame interval:");
  const stateBefore = await publicPausedState(page),
    footerBefore = await footerControls(page);
  const background = await s4.newPage();
  try {
    await background.goto("about:blank");
    await background.bringToFront();
    const visibility = await page.evaluate(() => document.visibilityState);
    if (visibility !== "hidden") {
      s4.attach("top-monitor-hidden-conditional-not-reached", {
        status: "NOT_RUN_CONDITION_NOT_REACHED",
        observedVisibility: visibility,
        reason:
          "This browser did not expose a genuinely hidden document. No visibility property or product handler was replaced.",
        familyId: "top-monitor.hidden",
      });
      return;
    }
    await page.waitForTimeout(100);
    const hiddenSummary = await top.locator(".top-monitor-accessible").first().innerText();
    await page.waitForTimeout(250);
    expect(await top.locator(".top-monitor-accessible").first().innerText()).toBe(hiddenSummary);
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible");
    await expect(top).toHaveAttribute("data-monitor-mode", "load");
    expect(await publicPausedState(page)).toEqual(stateBefore);
    expect(await footerControls(page)).toEqual(footerBefore);
    s4.cover(
      "top-monitor.hidden",
      "actual-document-hidden-stable-summary-and-return-preserve-public-state",
      {
        hiddenVisibility: visibility,
        visibleOnReturn: true,
        pollingReleaseAndPerformance: "SEPARATE_SCHEDULER_AND_PERFORMANCE_GATES",
      },
    );
    await s4.snapshot("top-monitor-return-from-actual-hidden-page", top);
  } finally {
    await s4.closePage(background, "Controlled background-page cleanup; not an OS process crash");
    await page.bringToFront();
  }
});
