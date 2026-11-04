import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { translate } from "../../src/ui/locale-model.js";

const helpEvidence = "artifacts/v1/r21-helptips-20261101";

test("review3 5: closed help leaves heading and project term accessible names clean", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await expect(page.locator(".scene-explorer h2")).toHaveAccessibleName(
    translate("zh-TW", "explorer.scene"),
  );
  await page
    .locator(".object-row")
    .filter({ has: page.locator('[title="ball"]') })
    .click();
  await expect(
    page.locator(".inspector h3").filter({ hasText: translate("zh-TW", "inspector.transform") }),
  ).toHaveAccessibleName(translate("zh-TW", "inspector.transform"));
  const project = await page.evaluate(() => window.__reflectionLab!.exportProject());
  await page.getByRole("button", { name: "匯入專案 JSON", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("h2")).toHaveAccessibleName("匯入專案 JSON");
  await dialog.getByLabel("選擇專案 JSON 檔案", { exact: true }).setInputFiles({
    name: "review3.json",
    mimeType: "application/json",
    buffer: Buffer.from(project),
  });
  // Native terms expose their child text in the accessibility tree, rather than
  // accepting an author-supplied accessible name like a heading.
  const term = dialog
    .locator("dt")
    .filter({ hasText: translate("zh-TW", "projectImport.contentSummary") });
  await expect(term).toMatchAriaSnapshot(
    `- term: ${translate("zh-TW", "projectImport.contentSummary")}`,
  );
});

test("review3 6: NumberField Escape reverts while a hover tooltip is open", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await page
    .locator(".object-row")
    .filter({ has: page.locator('[title="ball"]') })
    .click();
  const field = page.getByRole("spinbutton", { name: "直徑 m", exact: true });
  const original = await field.inputValue();
  await field.fill("9.25");
  await page.getByRole("button", { name: "說明：場景", exact: true }).hover();
  await expect(page.locator(".help-tip-bubble")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue(original);
  await expect(page.locator(".help-tip-bubble")).toHaveCount(0);
});

test("review3 9: adjacent hovered help appears immediately, first help uses token motion", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await page
    .locator(".object-row")
    .filter({ has: page.locator('[title="ball"]') })
    .click();
  const first = page.getByRole("button", { name: "說明：Transform", exact: true });
  const next = page.locator(".inspector .help-tip-trigger").filter({ visible: true }).nth(1);
  await page.mouse.move(1, 1);
  await first.hover();
  await expect(page.locator(".help-tip-bubble")).toHaveCSS("animation-duration", "0.125s");
  await next.hover();
  await expect(page.locator(".help-tip-bubble")).toHaveCSS("animation-name", "none");
  await page.mouse.move(1, 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await first.hover();
  await expect(page.locator(".help-tip-bubble")).toHaveCSS("animation-name", "none");
});
const helperKeys = [
  "shell.rawRoutingNote",
  "shell.simulatedRoutingNote",
  "shell.lateReverbExplanation",
  "explorer.addFirst",
  "explorer.noAssets",
  "explorer.importHelp",
  "explorer.sceneUnits",
  "explorer.gravityAndMedium",
  "inspector.authorPoseHelp",
  "inspector.noGravityHelp",
  "inspector.behaviorDescription",
  "inspector.classificationHelp",
  "inspector.noBehaviors",
  "inspector.physicalInspiredHelp",
  "inspector.unsupportedTriggers",
  "preview.help",
  "preview.limit",
  "inspector.listenerPoseHelp",
  "inspector.vacuumHelp",
  "inspector.selectObjectHelp",
  "analysis.native.scope",
  "editor.rule.curveHelp",
  "editor.mapping.instructions",
  "editor.mapping.clampHelp",
  "editor.mapping.midpointHelp",
  "editor.binding.help",
  "projectImport.validationHelp",
  "analysis.events.waitingHelp",
  "analysis.events.tryOtherFilter",
  "analysis.paths.delayHelp",
  "analysis.comparison.acousticHelp",
  "analysis.comparison.behaviorHelp",
  "analysis.comparison.prepareHelp",
  "analysis.agent.offlineHelp",
  "analysis.agent.metaHelp",
  "analysis.agent.shortcut",
  "analysis.agent.applyHelp",
] as const;
async function expectNoHelperProse(page: Page, locale: "zh-TW" | "en") {
  const prose = await page.locator("body").evaluate((body) => {
    const copy = body.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[role="tooltip"], script, style').forEach((node) => node.remove());
    return copy.textContent ?? "";
  });
  for (const key of helperKeys)
    expect(prose, `${key} must be available through help instead of page prose`).not.toContain(
      translate(locale, key, { zero: 0, one: 1 }),
    );
}
for (const locale of ["zh-TW", "en"] as const) {
  test(`R21 accessible help at 1280x720 (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(
      (locale) => localStorage.setItem("reflection-lab.locale", locale),
      locale,
    );
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: translate(locale, "shell.start"), exact: true }),
    ).toBeVisible();
    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="ball"]') })
      .click();
    const topic = translate(locale, "inspector.transform");
    const tip = page.getByRole("button", {
      name: translate(locale, "help.about", { topic }),
      exact: true,
    });
    const text = translate(locale, "inspector.authorPoseHelp");
    const describedBy = await tip.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(".help-tip-bubble")).toHaveCount(0);
    await tip.hover();
    await expect(page.locator('.help-tip-bubble[role="tooltip"]')).toHaveText(text);
    const box = await page.locator(".help-tip-bubble").boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
    await page.keyboard.press("Escape");
    await expect(page.locator(".help-tip-bubble")).toHaveCount(0);
    await page.mouse.move(5, 5);
    await expect(page.locator(".help-tip-bubble")).toHaveCount(0);
    await tip.focus();
    await expect(page.locator(".help-tip-bubble")).toHaveText(text);
    const cdp = await page.context().newCDPSession(page);
    const ax = await cdp.send("Accessibility.getFullAXTree");
    expect(
      ax.nodes.some(
        (node) =>
          node.role?.value === "button" &&
          node.name?.value === translate(locale, "help.about", { topic }) &&
          node.description?.value === text,
      ),
    ).toBe(true);
    await expect(page.locator(".inspector .section-copy, .inspector .inspector-help")).toHaveCount(
      0,
    );
    await expectNoHelperProse(page, locale);
    await page.screenshot({ path: `${helpEvidence}/help-${locale}.png`, timeout: 10_000 });
    await tip.press("Escape");
    await expect(tip).toBeFocused();
    await expect(page.locator(".help-tip-bubble")).toHaveCount(0);
    await expect(tip).toHaveAttribute("aria-describedby", describedBy!);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await tip.hover();
    await expect(page.locator(".help-tip-bubble")).toHaveCSS("animation-name", "none");
    await tip.press("Tab");
    await expect(page.locator(".help-tip-bubble")).toHaveCount(0);
    // Readable disabled reason, with no attempted command.
    await page.getByRole("button", { name: translate(locale, "shell.start"), exact: true }).click();
    const library = page.locator(".primitive-library");
    const reason = library.getByRole("button", {
      name: translate(locale, "help.about", {
        topic: translate(locale, "explorer.primitive.sphere"),
      }),
      exact: true,
    });
    const revision = await page.evaluate(
      () => (window as any).__reflectionLab.getSnapshot().sceneRevision,
    );
    await reason.focus();
    await expect(page.locator(".help-tip-bubble")).toHaveText(
      translate(locale, "explorer.pauseBeforeAdd"),
    );
    expect(
      await page.evaluate(() => (window as any).__reflectionLab.getSnapshot().sceneRevision),
    ).toBe(revision);
    await page
      .locator(".transport-bar")
      .getByRole("button", { name: translate(locale, "shell.pause"), exact: true })
      .click();
    // Numeric editing uses the actual transaction, and the retained invalid draft is localized.
    const diameter = page.getByRole("spinbutton", {
      name: `${translate(locale, "help.diameter")} m`,
      exact: true,
    });
    await diameter.fill("0.7");
    await diameter.press("Enter");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__reflectionLab.getSnapshot().objects.find((o: any) => o.id === "ball")
              .dimensionsM,
        ),
      )
      .toEqual([0.7, 0.7, 0.7]);
    await page.evaluate(async () => {
      const app = (window as any).__reflectionLab;
      await app.dispatch({ type: "addObject", shape: "capsule" });
    });
    const height = page.getByRole("spinbutton", {
      name: `${translate(locale, "help.height")} m`,
      exact: true,
    });
    await height.fill("0.01");
    await height.press("Enter");
    await expect(height).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".inspector .field-message")).toHaveText(
      translate(locale, "help.heightInvalid"),
    );
    const otherLocale = locale === "en" ? "zh-TW" : "en";
    const beforeLanguageChange = await page.evaluate(
      () => (window as any).__reflectionLab.getSnapshot().sceneRevision,
    );
    const language = page.getByRole("combobox", {
      name: "介面語言 / Interface language",
      exact: true,
    });
    await language.selectOption(otherLocale);
    await expect(page.locator(".inspector .field-message")).toHaveText(
      translate(otherLocale, "help.heightInvalid"),
    );
    await expect(page.locator('.inspector input[aria-invalid="true"]')).toHaveValue("0.01");
    expect(
      await page.evaluate(() => (window as any).__reflectionLab.getSnapshot().sceneRevision),
    ).toBe(beforeLanguageChange);
    await language.selectOption(locale);
    await expect(page.locator(".inspector .field-message")).toHaveText(
      translate(locale, "help.heightInvalid"),
    );
    await page
      .getByRole("button", {
        name: translate(locale, "explorer.listenerEnvironment"),
        exact: false,
      })
      .click();
    await expect(page.locator(".inspector .section-copy, .inspector .inspector-help")).toHaveCount(
      0,
    );
    await expectNoHelperProse(page, locale);
    for (const key of [
      "analysis.tabs.events",
      "analysis.tabs.paths",
      "analysis.tabs.comparison",
      "analysis.tabs.agent",
    ] as const) {
      await page.getByRole("tab", { name: translate(locale, key), exact: false }).click();
      await expectNoHelperProse(page, locale);
    }
    await page.locator(".monitor-reverb summary").click();
    await expectNoHelperProse(page, locale);
    await page.locator(".monitor-reverb summary").click();
    await page
      .getByRole("button", { name: translate(locale, "projectImport.title"), exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: translate(locale, "projectImport.title"), exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog").locator(".section-copy")).toHaveCount(0);
    await expect(
      page.getByText(translate(locale, "help.projectReplaces"), { exact: true }),
    ).toBeVisible();
    const projectJson = await page.evaluate(() => (window as any).__reflectionLab.exportProject());
    await page
      .getByRole("dialog")
      .locator('input[type="file"]')
      .setInputFiles({
        name: "help-review.json",
        mimeType: "application/json",
        buffer: Buffer.from(projectJson),
      });
    await expect(page.getByRole("dialog").locator(".project-import-review")).toBeVisible();
    await expectNoHelperProse(page, locale);
    await page
      .getByRole("button", { name: translate(locale, "projectImport.cancel"), exact: true })
      .click();
  });
}

async function openWorkspace(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
}

test("audio buffer preference persists across reload and both interface languages", async ({
  page,
}) => {
  await openWorkspace(page);
  const control = page.getByRole("combobox", { name: "音訊緩衝", exact: true });
  await expect(control).toHaveValue("playback");
  await control.selectOption("balanced");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("reflection-lab.audio-buffer")))
    .toBe("balanced");
  await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Audio buffer", exact: true })).toHaveValue(
    "balanced",
  );
  await page.locator(".monitor-metadata summary").click();
  await expect(page.getByText("Output underruns: NOT_AVAILABLE", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Audio buffer", exact: true })
    .selectOption("interactive");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("reflection-lab.audio-buffer")))
    .toBe("interactive");
});

test("native audio buffer restart restores live monitoring and refuses a recording restart", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const original = window.AudioContext;
    const contexts: AudioContext[] = [];
    (window as any).__audioBufferContexts = contexts;
    window.AudioContext = class extends original {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.push(this);
      }
    };
  });
  await openWorkspace(page);
  await page.getByRole("button", { name: "啟用聆聽", exact: true }).click();
  await page.getByRole("button", { name: "開始運算", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__reflectionLab.getSnapshot().monitor.activeVoices),
    )
    .toBe(1);
  await page.evaluate(async () => {
    const app = (window as any).__reflectionLab;
    await app.dispatch({ type: "setMonitorGain", gainLinear: 0.7 });
    await app.dispatch({ type: "setMonitorMode", mode: "raw" });
    await app.dispatch({ type: "toggleMute" });
  });
  await page.getByRole("combobox", { name: "音訊緩衝", exact: true }).selectOption("balanced");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__reflectionLab.getSnapshot().monitor.bufferPreset),
    )
    .toBe("balanced");
  const evidence = await page.evaluate(() => {
    const app = (window as any).__reflectionLab;
    return {
      monitor: app.getSnapshot().monitor,
      transport: app.getSnapshot().simulationState,
      contexts: (window as any).__audioBufferContexts.map((context: AudioContext) => ({
        state: context.state,
        baseLatency: context.baseLatency,
        outputLatency: context.outputLatency,
      })),
    };
  });
  expect(evidence.transport).toBe("running");
  expect(evidence.monitor).toMatchObject({
    activeVoices: 1,
    gainLinear: 0.7,
    muted: true,
    mode: "raw",
    bufferPreset: "balanced",
    rebuilding: false,
    schedulingLookaheadSeconds: 0.08,
  });
  expect(evidence.contexts).toHaveLength(2);
  expect(evidence.contexts[0].state).toBe("closed");
  expect(evidence.contexts[1].state).toBe("running");
  expect(evidence.monitor.outputLatencySeconds).toBe(
    evidence.contexts[1].baseLatency + evidence.contexts[1].outputLatency,
  );
  await page.locator(".monitor-metadata summary").click();
  await expect(page.getByText(/輸出中斷/)).toBeVisible();
  await expect(page.locator(".monitor-buffer output")).toHaveText(/\d.* ms/);
  await info.attach("native-buffer-restart.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("audio-buffer-monitor.png"), timeout: 10_000 });
  await page.evaluate(() => (window as any).__reflectionLab.dispatch({ type: "recordToggle" }));
  await page.getByRole("combobox", { name: "音訊緩衝", exact: true }).selectOption("interactive");
  await expect
    .poll(() => page.evaluate(() => (window as any).__reflectionLab.getSnapshot().error))
    .toBe("AUDIO_BUFFER_UNSAFE");
  await expect(page.getByRole("combobox", { name: "音訊緩衝", exact: true })).toHaveValue(
    "balanced",
  );
  expect(await page.evaluate(() => (window as any).__audioBufferContexts.length)).toBe(2);
});

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return;
  const evidence = await page.evaluate(
    () => (window as Window & { __uiInputEvidence?: unknown[] }).__uiInputEvidence,
  );
  if (evidence)
    await info.attach("input-event-order.json", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
});

test("real workspace renders three panels and keeps collapsed splitters out of focus", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openWorkspace(page);
  await expect(page.getByRole("complementary", { name: "場景與素材" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "屬性檢查器" })).toBeVisible();
  await page.locator(".panel-controls").getByRole("button", { name: "場景", exact: true }).click();
  await expect(page.locator(".panel-divider-left")).toHaveAttribute("tabindex", "-1");
  await expect(page.locator(".panel-divider-right")).toBeVisible();
  await page.locator(".panel-controls").getByRole("button", { name: "場景", exact: true }).click();
  await expect(page.locator(".panel-divider-left")).toHaveAttribute("tabindex", "0");
  await page.screenshot({ path: info.outputPath("desktop.png"), timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("the WebGL-unavailable fallback stays out of the accessibility tree while the canvas renders", async ({
  page,
}) => {
  await openWorkspace(page);
  // Chrome exposes <canvas> fallback content to assistive technology even when
  // WebGL works; Playwright's role queries treat it as hidden, so read the real tree.
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
    nodes: Array<{ ignored: boolean; role?: { value: string }; name?: { value: string } }>;
  };
  const exposed = nodes
    .filter((node) => !node.ignored && node.name?.value.includes("WebGL"))
    .map((node) => `${node.role?.value}: ${node.name?.value}`);
  expect(exposed).toEqual([]);
});

test("curved bodies state that they take no part in geometric acoustics; boxes stay editable", async ({
  page,
}) => {
  await openWorkspace(page);
  const role = page.getByRole("combobox", { name: /^聲學角色/ });
  const material = page.getByLabel("聲學材質", { exact: true });
  const note = page.getByText("球體與膠囊目前不進入幾何聲學", { exact: false });
  await page.getByRole("button", { name: /^ball/ }).first().click();
  await expect(note).toBeVisible();
  await expect(role).toBeDisabled();
  await expect(material).toBeDisabled();
  await expect(role).toHaveAttribute("aria-describedby", /.+/);
  await page
    .getByRole("button", { name: /^wall\.back/ })
    .first()
    .click();
  await expect(note).toHaveCount(0);
  await expect(role).toBeEnabled();
  await expect(material).toBeEnabled();
});

test("atmosphere controls change real solver paths and preserve gravity settings", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  const medium = page.getByRole("combobox", { name: "傳播介質" });
  await medium.selectOption("vacuum");
  await expect(medium).toHaveValue("vacuum");
  await expect(page.locator(".viewport-legend")).toContainText("0/0");
  await page.getByRole("button", { name: "說明：環境與聲學核心", exact: true }).focus();
  await expect(page.locator(".help-tip-bubble")).toContainText("真空不取消機械碰撞");
  await medium.selectOption("air");
  await expect(medium).toHaveValue("air");
  await expect(page.locator(".viewport-legend")).not.toContainText("0/0");
  await page
    .getByRole("button", { name: "ball 動態", exact: true })
    .filter({ has: page.locator('[title="ball"]') })
    .click();
  await expect(page.getByRole("combobox", { name: "剛體模式" })).toHaveValue("dynamicGravity");
});

test("synthetic perceptual reverb is explicit and raw reference stays selectable", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "啟用聆聽", exact: true }).click();
  await page.locator(".monitor-reverb summary").click();
  const enabled = page.getByRole("checkbox", {
    name: "啟用 Synthetic late reverb（perceptual）",
    exact: true,
  });
  await expect(enabled).not.toBeChecked();
  await enabled.check();
  await expect(enabled).toBeChecked();
  await expect(page.locator(".help-tip-bubble")).toHaveCount(0);
  await page.getByRole("button", { name: "說明：Synthetic late reverb", exact: true }).focus();
  await expect(page.locator(".help-tip-bubble")).toHaveText(
    "感知近似尾響；衰減參數不是測得的 RT60。Raw 參考旁路尾響。",
  );
  await page.getByRole("button", { name: "Raw 參考", exact: true }).click();
  await expect(page.getByRole("button", { name: "Raw 參考", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await enabled.uncheck();
  await expect(enabled).not.toBeChecked();
});

test("actual pointer lock starts controls from the entry click, Enter toggles, Tab exits and no acquisition throw", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const evidence: unknown[] = [];
    (window as Window & { __uiInputEvidence?: unknown[] }).__uiInputEvidence = evidence;
    const record = (event: Event) => {
      if (evidence.length >= 128) return;
      const target = event.target instanceof Element ? event.target : null;
      evidence.push({
        type: event.type,
        time: performance.now(),
        code: event instanceof KeyboardEvent ? event.code : null,
        trusted: event.isTrusted,
        target: target?.tagName,
        targetLabel: target?.textContent?.slice(0, 80),
        active: document.activeElement?.tagName,
        activeLabel: document.activeElement?.textContent?.slice(0, 80),
        lock: document.pointerLockElement?.tagName ?? null,
      });
    };
    for (const type of ["pointerlockchange", "keydown", "keyup", "focusin"])
      document.addEventListener(type, record, true);
    window.addEventListener("blur", record, true);
  });
  await openWorkspace(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  // R18: a successful entry click is the explicit start; no hidden second Enter gate.
  await expect(
    page.locator(".transport-actions").getByRole("button", { name: "暫停", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  const listenerZ = () =>
    page.evaluate(() => window.__reflectionLab!.getSnapshot().listener.positionM[2]);
  const start = await listenerZ();
  await page.keyboard.down("w");
  await expect.poll(listenerZ).toBeLessThan(start - 0.01);
  await page.keyboard.up("w");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "繼續運算", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".transport-actions").getByRole("button", { name: "暫停", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.getByRole("button", { name: "繼續運算", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "展開實驗面板", exact: true }).click();
  await expect(
    page.locator(".event-table").getByRole("button", { name: "OnThrow", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("searchbox", { name: "篩選事件" }).fill("WASD E 中文組字");
  await expect(page.getByRole("button", { name: "繼續運算", exact: true })).toBeVisible();
});

test("explicit alternative controls move the actual listener and place a live object without Enable", async ({
  page,
}, info) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.getByRole("button", { name: "啟用免鎖定操作", exact: true }).click();
  await expect(page.getByRole("button", { name: "停用免鎖定操作", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^(開始運算|繼續運算)$/ }).click();
  await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  const z = page
    .locator(".inspector .vector-fields")
    .first()
    .getByRole("spinbutton", { name: "Z", exact: true });
  const before = Number(await z.inputValue());
  await page.getByText("免鎖定移動與視角", { exact: true }).click();
  await page.getByRole("button", { name: "前進", exact: true }).click();
  await expect.poll(async () => Number(await z.inputValue())).not.toBe(before);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  for (let index = 0; index < 20; index += 1)
    await page.getByRole("button", { name: "向下看", exact: true }).click();
  const count = await page.locator(".object-list > li").count();
  await page.getByRole("button", { name: "開始放置預覽", exact: true }).click();
  const place = page.getByRole("button", { name: "放置", exact: true });
  await expect(place).toBeEnabled();
  await place.click();
  await expect(page.locator(".object-list > li")).toHaveCount(count + 1);
  await expect(page.getByRole("button", { name: "啟用物件", exact: true })).toHaveCount(0);
  await expect(
    page.locator(".transport-actions").getByRole("button", { name: "暫停", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "開始放置預覽", exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath("live-placement.png"), timeout: 10_000 });
  await expect(page.locator(".error-banner")).toHaveCount(0);
});

test("R21 FPS hint is docked below the crosshair at 1280x720", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openWorkspace(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect(page.locator(".viewport-fps-hint")).toContainText("左鍵 抓取");
  await expect(page.locator(".viewport-bottom > .viewport-fps-hint")).toHaveCount(1);
  const hint = await page.locator(".viewport-fps-hint").boundingBox();
  const crosshair = await page.locator(".viewport-crosshair").boundingBox();
  const canvas = await page.locator(".viewport-canvas-wrap").boundingBox();
  expect(hint).not.toBeNull();
  expect(crosshair).not.toBeNull();
  expect(canvas).not.toBeNull();
  expect(hint!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height);
  expect(hint!.y).toBeGreaterThan(crosshair!.y + crosshair!.height);
  try {
    await page.screenshot({ path: info.outputPath("fps-bottom-hint-1280.png"), timeout: 10_000 });
  } finally {
    await page.keyboard.press("Tab");
  }
});

test("R21 native right hold places, left grabs, right drops and a quick right click places again", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  const count = await page.locator(".object-list > li").count();
  try {
    await page.mouse.down({ button: "right" });
    await expect(page.locator(".viewport-fps-hint")).toContainText("放開右鍵 放置");
    await expect(page.locator(".viewport-fps-hint")).toContainText("空中（無重力）");
    await page.mouse.up({ button: "right" });
    await expect(page.locator(".object-list > li")).toHaveCount(count + 1);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator(".viewport-fps-hint")).toContainText("左鍵 投擲");
    await page.mouse.down({ button: "right" });
    await page.mouse.up({ button: "right" });
    await expect(page.locator(".viewport-fps-hint")).toContainText("左鍵 抓取");
    // Turn to empty space before the second placement, keeping the first body live.
    await page.mouse.move(900, 360);
    await page.mouse.click(900, 360, { button: "right" });
    await expect(page.locator(".object-list > li")).toHaveCount(count + 2);
    await expect(page.getByRole("button", { name: "啟用物件", exact: true })).toHaveCount(0);
  } finally {
    await page.keyboard.press("Tab");
  }
});

test("320 CSS px and reduced motion keep transport, monitor and forms reachable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openWorkspace(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.locator(".monitor-mute")).toBeVisible();
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "場景", exact: true })
    .click();
  await page.getByRole("button", { name: /Listener \/ 環境/ }).click();
  await expect(page.getByRole("combobox", { name: "傳播介質" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole("button", { name: "展開實驗面板", exact: true }).click();
  await page.getByRole("button", { name: "收合實驗面板", exact: true }).click();
  await page.locator(".monitor-reverb summary").click();
  const popup = await page.locator(".monitor-reverb-settings").boundingBox();
  expect(popup?.x).toBeGreaterThanOrEqual(0);
  expect((popup?.x ?? 0) + (popup?.width ?? 0)).toBeLessThanOrEqual(320);
  await expect(page.locator(".monitor-mute")).toBeInViewport({ ratio: 1 });
  await page.locator(".monitor-mute").click();
  await page.screenshot({ path: info.outputPath("mobile-320.png"), timeout: 10_000 });
  await page.locator(".monitor-reverb summary").click();
  const duration = await page
    .locator(".monitor-mute")
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration).toBe("0s");
  await page.setViewportSize({ width: 720, height: 500 });
  await expect(page.locator(".monitor-mute")).toBeVisible();
  await expect(page.locator(".monitor-mute")).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "開始運算", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("reflow-720.png"), timeout: 10_000 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(500);
});

test("audio import advertises only the preflighted WAV formats", async ({ page }) => {
  await openWorkspace(page);
  await expect(page.locator(".scene-explorer input[type='file']")).toHaveAttribute(
    "accept",
    ".wav,audio/wav,audio/x-wav",
  );
  await page.locator(".import-details summary").click();
  await page
    .locator(".import-details")
    .getByRole("button", { name: "說明：匯入聲音", exact: true })
    .first()
    .focus();
  await expect(page.locator(".help-tip-bubble")).toContainText(
    "PCM/float WAV，大小/時長限制依錯誤提示。",
  );
});

test("AI defaults offline and selecting a blocked Meta gate never proposes a model request", async ({
  page,
}) => {
  const proposed: string[] = [];
  await page.route("**/api/agent/propose**", async (route) => {
    proposed.push(route.request().url());
    await route.fulfill({
      status: 403,
      json: {
        error: { code: "TEST_BLOCKED", message: "Model requests are disabled in this UI test." },
      },
    });
  });
  await page.route("**/api/agent/status", async (route) => {
    await route.fulfill({
      json: {
        offline: {
          state: "AVAILABLE",
          provenance: "OFFLINE_DETERMINISTIC",
          modelId: null,
          cloudCostUsd: 0,
        },
        meta: {
          provider: "metaModelApi",
          state: "BLOCKED",
          reason: "BUDGET_ZERO：測試 gate；預算為 0。",
          modelId: null,
          remainingQuota: null,
          liveValidation: "NOT_RUN",
          estimatedCostCeilingUsd: 0,
        },
      },
    });
  });
  await openWorkspace(page);
  await page.getByRole("tab", { name: "Meta 實驗 Agent", exact: true }).click();
  const provider = page.getByRole("combobox", { name: "AI 執行方式", exact: true });
  await expect(provider).toHaveValue("offline");
  const prompt = page.getByRole("textbox", { name: "實驗指令", exact: true });
  await prompt.fill("新增一顆無重力的球");
  await provider.selectOption("meta");
  await expect(provider).toHaveValue("meta");
  await page.getByRole("button", { name: "重新檢查伺服器狀態", exact: true }).click();
  await expect(page.locator(".agent-provider-status")).toContainText("已阻擋");
  await expect(page.locator(".agent-provider-status")).toContainText("BUDGET_ZERO");
  await expect(page.getByRole("button", { name: "產生操作預覽", exact: true })).toBeDisabled();
  await prompt.press("Control+Enter");
  await expect(page.getByText("Meta Model API 目前不可用", { exact: false })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "剛體模式", exact: true })).toBeEnabled();
  await provider.selectOption("offline");
  await expect(prompt).toHaveValue("新增一顆無重力的球");
  await expect(page.getByRole("button", { name: "產生操作預覽", exact: true })).toBeEnabled();
  expect(proposed).toEqual([]);
});

test("project JSON stays a local review draft until explicit Apply", async ({ page }, info) => {
  await openWorkspace(page);
  await page.getByRole("tab", { name: "事件與錄放", exact: false }).click();
  await expect(page.getByRole("button", { name: "匯出已封存錄製", exact: true })).toBeDisabled();
  const originalName = await page.locator(".project-name strong").innerText();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出專案", exact: true }).click();
  const exported = await downloaded;
  const filePath = info.outputPath("exported-project.json");
  await exported.saveAs(filePath);
  const project = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  const text = JSON.stringify({ ...project, name: "JSON 檢視後匯入" });
  const trigger = page.getByRole("button", { name: "匯入專案 JSON", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "匯入專案 JSON", exact: true });
  const input = dialog.getByLabel("選擇專案 JSON 檔案", { exact: true });
  await input.setInputFiles({
    name: "review-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "JSON 檢視後匯入",
  );
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await page.setViewportSize({ width: 320, height: 800 });
  const reviewBounds = await dialog.boundingBox();
  expect(reviewBounds?.x).toBeGreaterThanOrEqual(0);
  expect((reviewBounds?.x ?? 0) + (reviewBounds?.width ?? 0)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("project-review-320.png"), timeout: 10_000 });
  await dialog.getByRole("button", { name: "取消匯入", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await trigger.click();
  await input.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "套用並開啟專案", exact: true })).toBeDisabled();
  await input.setInputFiles({
    name: "too-large.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 32),
  });
  await expect(dialog.getByRole("alert")).toContainText("SIZE_LIMIT");
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await input.setInputFiles({
    name: "domain-rejected.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ name: "保留被拒絕的草稿" })),
  });
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "保留被拒絕的草稿",
  );
  await dialog.getByRole("button", { name: "套用並開啟專案", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "保留被拒絕的草稿",
  );
  await expect(page.locator(".project-name strong")).toHaveText(originalName);
  await input.setInputFiles({
    name: "review-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(dialog.getByRole("region", { name: "專案匯入預覽", exact: true })).toContainText(
    "JSON 檢視後匯入",
  );
  await dialog.getByRole("button", { name: "套用並開啟專案", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".project-name strong")).toHaveText("JSON 檢視後匯入");
});

test("completed recording exports a separate raw RecordingArtifact JSON", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await openWorkspace(page);
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "場景", exact: true })
    .click();
  await page.getByRole("tab", { name: "事件與錄放", exact: false }).click();
  const exportRecording = page.getByRole("button", { name: "匯出已封存錄製", exact: true });
  await expect(exportRecording).toBeDisabled();
  await page.getByRole("button", { name: "● 開始錄製", exact: true }).click();
  await expect(exportRecording).toBeDisabled();
  await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  await page.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
  await expect(exportRecording).toBeEnabled();
  const downloaded = page.waitForEvent("download");
  await exportRecording.click();
  const exported = await downloaded;
  const filePath = info.outputPath("recording-artifact.json");
  await exported.saveAs(filePath);
  const artifact = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  expect(artifact).toHaveProperty("schemaVersion");
  expect(artifact).toHaveProperty("runId");
  expect(artifact).toHaveProperty("configuration");
  expect(artifact).toHaveProperty("artifactSha256");
  expect(Array.isArray(artifact.frames)).toBe(true);
  expect((artifact.frames as unknown[]).length).toBeGreaterThan(0);
});

test("reset seals an interrupted recording for export while replay remains unavailable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await openWorkspace(page);
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "場景", exact: true })
    .click();
  await page.getByRole("tab", { name: "事件與錄放", exact: false }).click();
  await page.getByRole("button", { name: "● 開始錄製", exact: true }).click();
  await expect(page.locator(".run-status .subtle.mono")).not.toHaveText("tick 0");
  await page.getByRole("button", { name: "重設", exact: true }).click();
  await expect(page.locator(".run-status .subtle.mono")).toHaveText("tick 0");
  await expect(page.getByText("中斷紀錄已封存；不可重播", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ 重播紀錄", exact: true })).toBeDisabled();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出已封存錄製", exact: true }).click();
  const filePath = info.outputPath("interrupted-recording-artifact.json");
  await (await exported).saveAs(filePath);
  const artifact = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  expect(artifact.status).toBe("interrupted");
  expect(artifact.reason).toBe("RESET");
  expect(artifact.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(Array.isArray(artifact.frames)).toBe(true);
  expect((artifact.frames as unknown[]).length).toBeGreaterThan(0);
});

test("rule drafts survive selection and rejected transactions until actual acknowledgement", async ({
  page,
}) => {
  await openWorkspace(page);
  const impact = page.getByRole("article", { name: "聲音行為 rule.impact", exact: true });
  const gain = impact.getByRole("spinbutton", { name: /音量/ });
  for (const trigger of ["OnBounce", "OnEnterZone", "OnExitZone"]) {
    await expect(
      page
        .getByRole("combobox", { name: "新增行為觸發條件", exact: true })
        .locator(`option[value='${trigger}']`),
    ).toHaveJSProperty("disabled", true);
    await expect(
      impact
        .getByRole("combobox", { name: "觸發條件", exact: true })
        .locator(`option[value='${trigger}']`),
    ).toHaveJSProperty("disabled", true);
  }
  await gain.fill("0.23");
  await page
    .getByRole("button", { name: "speaker 固定", exact: true })
    .filter({ has: page.locator('[title="speaker"]') })
    .click();
  await expect(page.getByRole("region", { name: "保留的聲音行為草稿", exact: true })).toContainText(
    "已保留 1 份",
  );
  await page
    .getByRole("button", { name: "ball 動態", exact: true })
    .filter({ has: page.locator('[title="ball"]') })
    .click();
  await expect(gain).toHaveValue("0.23");
  await gain.fill("");
  await page
    .getByRole("button", { name: "speaker 固定", exact: true })
    .filter({ has: page.locator('[title="speaker"]') })
    .click();
  await page
    .getByRole("button", { name: "ball 動態", exact: true })
    .filter({ has: page.locator('[title="ball"]') })
    .click();
  await expect(gain).toHaveValue("");
  await expect(impact.getByRole("button", { name: "套用", exact: true })).toBeDisabled();
  await gain.fill("0.23");
  // This e2e-only fault affects the transaction result, never engine values.
  const originalDispatch = await page.evaluateHandle(() => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("E2E controller unavailable");
    const original = runtime.dispatch;
    runtime.dispatch = (action) =>
      action.type === "patchRule"
        ? Promise.reject(new Error("UI_TEST_REJECTED：保留原草稿"))
        : original.call(runtime, action);
    return original;
  });
  await impact.getByRole("button", { name: "套用", exact: true }).click();
  await expect(impact.getByRole("alert")).toContainText("UI_TEST_REJECTED");
  await expect(gain).toHaveValue("0.23");
  await page
    .getByRole("button", { name: "speaker 固定", exact: true })
    .filter({ has: page.locator('[title="speaker"]') })
    .click();
  await page
    .getByRole("button", { name: "ball 動態", exact: true })
    .filter({ has: page.locator('[title="ball"]') })
    .click();
  await expect(gain).toHaveValue("0.23");
  await expect(impact.getByRole("alert")).toContainText("UI_TEST_REJECTED");
  await page.evaluate((original) => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    window.__reflectionLab.dispatch = original;
  }, originalDispatch);
  await originalDispatch.dispose();
  await impact.getByRole("button", { name: "套用", exact: true }).click();
  await expect(page.getByRole("region", { name: "保留的聲音行為草稿", exact: true })).toHaveCount(
    0,
  );
  const actual = await page.evaluate(
    () =>
      window.__reflectionLab
        ?.getSnapshot()
        .behaviors.find((profile) => profile.objectId === "ball")
        ?.rules.find((rule) => rule.id === "rule.impact")?.gainLinear,
  );
  expect(actual).toBeCloseTo(0.23, 8);
});

test("nonlinear curve and object override Apply/Clear/Undo retain source playback intent", async ({
  page,
}, info) => {
  await openWorkspace(page);
  const sourcesBefore = await page.evaluate(() => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    return JSON.stringify(JSON.parse(window.__reflectionLab.exportProject()).scene.sources);
  });
  const override = page.getByRole("region", { name: "此物件覆寫 rule.impact", exact: true });
  await override.locator("summary").click();
  await override.getByRole("checkbox", { name: "覆寫音量", exact: true }).check();
  await override.getByRole("spinbutton", { name: "此物件音量 linear", exact: true }).fill("0.4");
  const originalDispatch = await page.evaluateHandle(() => {
    const runtime = window.__reflectionLab;
    if (!runtime) throw new Error("E2E controller unavailable");
    const original = runtime.dispatch;
    runtime.dispatch = (action) =>
      action.type === "setBindingOverride"
        ? Promise.reject(new Error("UI_OVERRIDE_REJECTED：草稿保留"))
        : original.call(runtime, action);
    return original;
  });
  await override.getByRole("button", { name: "套用此物件覆寫", exact: true }).click();
  await expect(override.getByRole("alert")).toContainText("UI_OVERRIDE_REJECTED");
  await expect(
    override.getByRole("spinbutton", { name: "此物件音量 linear", exact: true }),
  ).toHaveValue("0.4");
  await page.evaluate((original) => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    window.__reflectionLab.dispatch = original;
  }, originalDispatch);
  await originalDispatch.dispose();
  await override.getByRole("button", { name: "套用此物件覆寫", exact: true }).click();
  await expect(override.getByRole("button", { name: "套用此物件覆寫", exact: true })).toHaveCount(
    0,
  );
  const impact = page.getByRole("article", { name: "聲音行為 rule.impact", exact: true });
  await impact
    .getByRole("article", { name: "參數映射 mapping.impact-gain", exact: true })
    .getByRole("button", { name: "移除映射", exact: true })
    .click();
  await expect(impact.locator(".mapping-card")).toHaveCount(0);
  await impact.getByRole("button", { name: "新增參數映射", exact: true }).click();
  const mappings = impact.getByRole("region", { name: "參數映射曲線編輯器", exact: true });
  await mappings
    .getByRole("combobox", { name: "映射輸入 metric", exact: true })
    .selectOption("closingSpeedMetresPerSecond");
  await mappings
    .getByRole("combobox", { name: "映射輸出參數", exact: true })
    .selectOption("gainLinear");
  await mappings.getByRole("spinbutton", { name: "映射輸入下限", exact: true }).fill("0");
  await mappings.getByRole("spinbutton", { name: "映射輸入上限", exact: true }).fill("10");
  await mappings.getByRole("spinbutton", { name: "映射輸出下限", exact: true }).fill("0");
  await mappings.getByRole("spinbutton", { name: "映射輸出上限", exact: true }).fill("1");
  await mappings.getByRole("spinbutton", { name: "映射平滑時間 s", exact: true }).fill("0");
  await mappings.getByRole("button", { name: "新增曲線點", exact: true }).click();
  const middleY = mappings.getByRole("spinbutton", { name: "曲線點 2 y", exact: true });
  await middleY.fill("2");
  await expect(middleY).toHaveAttribute("aria-invalid", "true");
  await expect(impact.getByRole("button", { name: "套用", exact: true })).toBeDisabled();
  await middleY.press("Escape");
  await expect(middleY).toHaveValue("0.5");
  await mappings.getByRole("spinbutton", { name: "曲線點 2 y", exact: true }).fill("0.2");
  await expect(mappings.getByLabel("曲線中點預覽", { exact: true })).toContainText("0.2 linear");
  await impact.getByRole("button", { name: "套用", exact: true }).click();
  await expect(impact.getByRole("button", { name: "套用", exact: true })).toHaveCount(0);
  const saved = await page.evaluate(() =>
    window.__reflectionLab
      ?.getSnapshot()
      .behaviors.find((profile) => profile.objectId === "ball")
      ?.rules.find((rule) => rule.id === "rule.impact"),
  );
  expect(saved?.mappings?.[0]?.curve).toEqual([
    { x: 0, y: 0 },
    { x: 0.5, y: 0.2 },
    { x: 1, y: 1 },
  ]);
  expect(saved?.bindingOverride?.gainLinear).toBeCloseTo(0.4, 8);
  await override.getByRole("button", { name: "清除已儲存覆寫", exact: true }).click();
  await expect(
    override.getByRole("button", { name: "清除已儲存覆寫", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "復原場景命令", exact: true }).click();
  await expect(override.getByRole("button", { name: "清除已儲存覆寫", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "重做場景命令", exact: true }).click();
  await expect(
    override.getByRole("button", { name: "清除已儲存覆寫", exact: true }),
  ).toBeDisabled();
  const after = await page.evaluate(() => {
    if (!window.__reflectionLab) throw new Error("E2E controller unavailable");
    return {
      sources: JSON.stringify(JSON.parse(window.__reflectionLab.exportProject()).scene.sources),
      state: window.__reflectionLab.getSnapshot().simulationState,
    };
  });
  expect(after.sources).toBe(sourcesBefore);
  expect(after.state).not.toBe("running");
  await mappings.getByLabel("曲線中點預覽", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("curve-override.png"), timeout: 10_000 });
  await page.setViewportSize({ width: 320, height: 700 });
  await page
    .getByRole("navigation", { name: "主要面板" })
    .getByRole("button", { name: "檢查器", exact: true })
    .click();
  const pointTable = mappings.getByRole("table");
  await pointTable.scrollIntoViewIfNeeded();
  const tableBounds = await pointTable.boundingBox();
  expect(tableBounds).not.toBeNull();
  expect(tableBounds!.x).toBeGreaterThanOrEqual(0);
  expect(tableBounds!.x + tableBounds!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("curve-mobile.png"), timeout: 10_000 });
});
