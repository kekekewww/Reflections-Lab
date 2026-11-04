import { expect, test } from "@playwright/test";
import {
  addZone,
  addZoneRule,
  capture,
  crossingZone,
  editZone,
  exportProject,
  exportRecording,
  importProject,
  list,
  object,
  ruleCard,
  runAudit,
  probeHelp,
  sceneRevision,
  selectBall,
  selectEventById,
  transport,
  zoneEvents,
  zoneForm,
  zoneInput,
  zonePanel,
  zoneRow,
  type JsonObject,
} from "./pipeline-zones-helpers.js";

test.beforeAll(() => {
  if (process.env.PIPELINE_ZONES_BROWSER_LEASE !== "granted") {
    throw new Error("NO_BROWSER_LEASE: coordinator must grant this lane before execution");
  }
});
const axes = ["X", "Y", "Z"];
const scene = (project: JsonObject) => object(project.scene);
const zones = (project: JsonObject) => list(scene(project).zones ?? []);
const profiles = (project: JsonObject) => list(object(project.soundBehaviors).profiles);
const findRule = (project: JsonObject, id: string) =>
  profiles(project)
    .flatMap((profile) => list(profile.rules))
    .find((rule) => rule.ruleId === id)!;

test("zone eight-tab navigation and all raw authoring bounds", async ({ page }) => {
  await runAudit(page, "01-authoring-bounds", async (a) => {
    const tabs = page.locator(".dock-tabs").getByRole("tab");
    await expect(tabs).toHaveCount(8);
    const ids = await tabs.evaluateAll((items) =>
      items.map((item) => item.id.match(/-([a-z]+)-tab$/)?.[1] ?? null),
    );
    expect(ids).toEqual([
      "events",
      "paths",
      "comparison",
      "agent",
      "motion",
      "render",
      "performance",
      "zones",
    ]);
    for (let i = 0; i < ids.length; i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
      await expect(page.locator(".analysis-dock").getByRole("tabpanel")).toHaveCount(1);
      a.record("dock.tab." + ids[i], {
        method: "pointer",
        result: "PASS",
        singleVisiblePanel: true,
      });
    }
    await tabs.last().press("ArrowRight");
    await expect(tabs.first()).toBeFocused();
    await tabs.first().press("ArrowLeft");
    await expect(tabs.last()).toBeFocused();
    await tabs.last().press("Home");
    await expect(tabs.first()).toBeFocused();
    await tabs.first().press("End");
    await expect(tabs.last()).toBeFocused();
    a.record("dock.tabs.keyboard", {
      keys: ["ArrowRight", "ArrowLeft", "Home", "End"],
      result: "PASS",
    });
    await probeHelp(
      page,
      a,
      zonePanel(page).getByRole("button", { name: "說明：區域", exact: true }),
      {
        sourceSiteId: "ui.zonepanel.zonepanel.helptip.2a43c2d943",
        file: "src/ui/ZonePanel.tsx",
        line: 302,
        topicExpression: "copy.title",
        topic: "區域",
      },
      "物件中心",
    );

    await zonePanel(page).getByRole("button", { name: "新增區域", exact: true }).click();
    await probeHelp(
      page,
      a,
      zonePanel(page).getByRole("button", { name: "說明：新增區域", exact: true }),
      {
        sourceSiteId: "ui.zonepanel.zonepanel.helptip.cb7efbc36a",
        file: "src/ui/ZonePanel.tsx",
        line: 303,
        topicExpression: "copy.add",
        topic: "新增區域",
        state: "draft exists",
      },
      "先儲存或取消",
    );
    const form = zoneForm(page),
      save = form.getByRole("button", { name: "儲存區域", exact: true });
    const id = form.getByRole("textbox", { name: "區域 ID", exact: true });
    const name = form.getByRole("textbox", { name: "名稱", exact: true });
    for (const raw of ["", "Zone.invalid", "zone invalid", "-zone"]) {
      await id.fill(raw);
      await expect(save).toBeDisabled();
      a.record("zone.id", { raw, actual: await id.inputValue(), result: "INVALID_SAVE_DISABLED" });
    }
    await id.fill("z".repeat(65));
    await expect(id).toHaveValue("z".repeat(64));
    await id.fill("zone.bounds");
    for (const raw of ["", "   "]) {
      await name.fill(raw);
      await expect(save).toBeDisabled();
      a.record("zone.name", { raw, result: "INVALID_SAVE_DISABLED" });
    }
    await name.fill("邊".repeat(81));
    await expect(name).toHaveValue("邊".repeat(80));
    await name.fill("  邊界測試  ");
    await expect(save).toBeEnabled();
    for (const [label, min, max, normal] of [
      ...axes.map((axis) => ["中心位置 " + axis, -200, 200, 0] as const),
      ...axes.map((axis) => ["半尺寸 " + axis, 0.05, 50, 1] as const),
      ["邊界遲滯", 0, 0.25, 0.02] as const,
    ]) {
      const input = zoneInput(page, label);
      for (const valid of [min, max]) {
        await input.fill(String(valid));
        await expect(save).toBeEnabled();
        a.record(
          label.startsWith("中心")
            ? "zone.center.{axis}"
            : label.startsWith("半尺寸")
              ? "zone.half-extents.{axis}"
              : "zone.hysteresis",
          {
            label,
            method: "fill",
            value: valid,
            actual: await input.inputValue(),
            result: "VALID_DRAFT",
          },
        );
      }
      for (const invalid of ["", String(min - 0.01), String(max + 0.01)]) {
        await input.fill(invalid);
        await expect(save).toBeDisabled();
        a.record("zone.numeric.invalid", {
          label,
          invalid,
          actual: await input.inputValue(),
          result: "INVALID_SAVE_DISABLED",
        });
      }
      await input.fill(String(normal));
    }
    const x = zoneInput(page, "中心位置 X");
    const before = await x.inputValue();
    await x.press("ArrowUp");
    const keyboardUp = await x.inputValue();
    await x.press("ArrowDown");
    const keyboardDown = await x.inputValue();
    expect(Number(keyboardUp)).toBeGreaterThan(Number(before));
    expect(keyboardDown).toBe(before);
    const box = await x.boundingBox();
    expect(box).not.toBeNull();
    const metrics = await x.evaluate((input) => {
      const s = getComputedStyle(input);
      return {
        top: parseFloat(s.paddingTop) + parseFloat(s.borderTopWidth),
        bottom: parseFloat(s.paddingBottom) + parseFloat(s.borderBottomWidth),
        right: parseFloat(s.paddingRight) + parseFloat(s.borderRightWidth),
      };
    });
    const contentHeight = box!.height - metrics.top - metrics.bottom;
    const spinX = box!.x + box!.width - metrics.right - 7;
    await page.mouse.click(spinX, box!.y + metrics.top + contentHeight * 0.25);
    const pointerUp = await x.inputValue();
    await page.mouse.click(spinX, box!.y + metrics.top + contentHeight * 0.75);
    const pointerDown = await x.inputValue();
    expect(Number(pointerUp)).toBeGreaterThan(Number(before));
    expect(pointerDown).toBe(before);
    a.record("zone.center.X", {
      method: "native-keyboard-and-spinner",
      before,
      keyboardUp,
      keyboardDown,
      pointerUp,
      pointerDown,
      box,
      metrics,
    });
    await zoneInput(page, "半尺寸 X").fill("0.05");
    await zoneInput(page, "邊界遲滯").fill("0.05");
    await expect(save).toBeDisabled();
    await zoneInput(page, "邊界遲滯").fill("0.049");
    await expect(save).toBeEnabled();
    a.record("zone.hysteresis", {
      relation: "strictly below minimum extent",
      equalRejected: true,
      justBelowAccepted: true,
    });
    await form.getByRole("combobox", { name: "形狀", exact: true }).selectOption("sphere");
    await expect(zoneInput(page, "半尺寸 X")).toHaveCount(0);
    const radius = zoneInput(page, "半徑");
    for (const valid of [0.05, 50]) {
      await radius.fill(String(valid));
      await expect(save).toBeEnabled();
    }
    for (const invalid of ["", "0.049", "50.01"]) {
      await radius.fill(invalid);
      await expect(save).toBeDisabled();
    }
    await radius.fill("0.05");
    await zoneInput(page, "邊界遲滯").fill("0.05");
    await expect(save).toBeDisabled();
    await zoneInput(page, "邊界遲滯").fill("0");
    await form.getByRole("checkbox", { name: "啟用", exact: true }).uncheck();
    await name.press("Enter");
    await expect(form).toBeHidden();
    const project = await exportProject(page, a, "sphere-minimum-disabled");
    expect(zones(project)[0]).toMatchObject({
      id: "zone.bounds",
      shape: "sphere",
      enabled: false,
      radiusM: 0.05,
      hysteresisM: 0,
    });
    await editZone(page, "zone.bounds");
    await expect(
      zoneForm(page).getByRole("textbox", { name: "區域 ID", exact: true }),
    ).toBeDisabled();
    await zoneForm(page).getByRole("textbox", { name: "名稱", exact: true }).fill("未儲存草稿");
    await zoneForm(page).getByRole("textbox", { name: "名稱", exact: true }).press("Escape");
    await expect(zoneForm(page)).toHaveCount(0);
    expect(zones(await exportProject(page, a, "escape-preserves-zone"))[0]!.name).toBe("邊界測試");
    await zonePanel(page).getByRole("button", { name: "新增區域", exact: true }).click();
    await zoneForm(page).getByRole("textbox", { name: "區域 ID", exact: true }).fill("zone.bounds");
    await expect(
      zoneForm(page).getByRole("button", { name: "儲存區域", exact: true }),
    ).toBeDisabled();
    a.record("zone.id", { duplicateZoneId: "zone.bounds", result: "UI_DUPLICATE_SAVE_DISABLED" });
    await zoneForm(page).getByRole("button", { name: "取消草稿", exact: true }).click();
    await expect(zoneForm(page)).toHaveCount(0);
    await zonePanel(page).getByRole("button", { name: "新增區域", exact: true }).click();
    await zoneForm(page).getByRole("textbox", { name: "區域 ID", exact: true }).fill("ball");
    await expect(
      zoneForm(page).getByRole("button", { name: "儲存區域", exact: true }),
    ).toBeEnabled();
    const collisionRevision = await sceneRevision(page).innerText();
    await zoneForm(page).getByRole("button", { name: "儲存區域", exact: true }).click();
    await expect(zonePanel(page).getByRole("alert").last()).not.toBeEmpty();
    expect(await sceneRevision(page).innerText()).toBe(collisionRevision);
    await expect(zoneRow(page, "ball")).toHaveCount(0);
    a.record("zone.id", {
      crossEntityId: "ball",
      result: "ATOMIC_HOST_REJECTED",
      error: await zonePanel(page).getByRole("alert").last().innerText(),
    });
    await zoneForm(page).getByRole("button", { name: "取消草稿", exact: true }).click();

    await a.snapshot("bounds-complete");
  });
});

test("zone history persistence with rule references and same-revision stale drafts", async ({
  page,
}) => {
  await runAudit(page, "02-history-stale", async (a) => {
    const baseline = await exportProject(page, a, "legacy-before");
    expect("zones" in scene(baseline)).toBe(false);
    await addZone(page, { ...crossingZone, id: "zone.history", name: "歷史區域" });
    await page.getByRole("button", { name: "復原場景命令", exact: true }).click();
    expect("zones" in scene(await exportProject(page, a, "undo-legacy-absence"))).toBe(false);
    await page.getByRole("button", { name: "重做場景命令", exact: true }).click();
    await expect(zoneRow(page, "zone.history")).toBeVisible();
    await selectBall(page);
    const ruleId = await addZoneRule(page, "OnEnterZone", "zone.history", a);
    const withRule = await exportProject(page, a, "with-zone-rule");
    expect(object(findRule(withRule, ruleId).trigger).zoneId).toBe("zone.history");
    await page.getByRole("button", { name: "儲存專案", exact: true }).click();
    await editZone(page, "zone.history");
    await zoneForm(page).getByRole("textbox", { name: "名稱", exact: true }).fill("未保存修改");
    await zoneForm(page).getByRole("button", { name: "儲存區域", exact: true }).click();
    await page.getByRole("button", { name: "載入本機已儲存的專案", exact: true }).click();
    await expect(zoneRow(page, "zone.history")).toContainText("歷史區域");
    expect(
      object(findRule(await exportProject(page, a, "loaded-with-zone-rule"), ruleId).trigger)
        .zoneId,
    ).toBe("zone.history");
    await importProject(page, withRule);
    await expect(zoneRow(page, "zone.history")).toContainText("歷史區域");
    a.record("zone.persistence", {
      ruleId,
      methods: ["save/load", "export/import", "undo/redo"],
      optionalAbsenceRestored: true,
    });

    const modified = structuredClone(withRule);
    list(scene(modified).zones)[0]!.name = "同版本匯入的不同內容";
    await editZone(page, "zone.history");
    await zoneForm(page)
      .getByRole("textbox", { name: "名稱", exact: true })
      .fill("不可覆寫的舊草稿");
    const beforeRevision = await sceneRevision(page).innerText();
    await importProject(page, modified);
    expect(await sceneRevision(page).innerText()).toBe(beforeRevision);
    if (await zoneForm(page).count()) {
      await expect(
        zoneForm(page).getByRole("button", { name: "儲存區域", exact: true }),
      ).toBeDisabled();
      await expect(zoneForm(page)).toContainText("場景已更新");
      await zoneForm(page).getByRole("textbox", { name: "名稱", exact: true }).press("Enter");
      await zoneForm(page).getByRole("button", { name: "取消草稿", exact: true }).click();
      a.record("zone.stale-registry", {
        sameProjectAndRevision: true,
        result: "STALE_SAVE_DISABLED",
      });
    } else
      a.record("zone.stale-registry", {
        sameProjectAndRevision: true,
        result: "DRAFT_SAFELY_CLEARED_ON_IMPORT",
      });
    expect(zones(await exportProject(page, a, "same-revision-registry-after"))[0]!.name).toBe(
      "同版本匯入的不同內容",
    );
    await editZone(page, "zone.history");
    await page.locator(".primitive-library button").first().click();
    await expect(
      zoneForm(page).getByRole("button", { name: "儲存區域", exact: true }),
    ).toBeDisabled();
    await zoneForm(page).getByRole("button", { name: "取消草稿", exact: true }).click();
    a.record("zone.stale-scene", { result: "REVISION_CHANGE_BLOCKS_DRAFT" });
    await a.snapshot("history-stale");
  });
});

test("zone project capacity and closed-schema import failures preserve authoring", async ({
  page,
}) => {
  await runAudit(page, "03-import-rejections", async (a) => {
    const base = await exportProject(page, a, "base");
    const sixteen = structuredClone(base);
    scene(sixteen).zones = Array.from({ length: 16 }, (_, i) => ({
      ...crossingZone,
      id: "zone.capacity." + (i + 1),
      name: "容量 " + (i + 1),
      centerM: [i * 2, 1, 0],
    }));
    await importProject(page, sixteen);
    await expect(zonePanel(page).getByRole("listitem")).toHaveCount(16);
    await expect(
      zonePanel(page).getByRole("button", { name: "新增區域", exact: true }),
    ).toBeDisabled();
    const before = await sceneRevision(page).innerText();
    for (const kind of ["seventeen", "cross-entity-id", "wrong-shape-field", "unknown-field"]) {
      const bad = structuredClone(sixteen),
        registry = list(scene(bad).zones);
      if (kind === "seventeen") registry.push({ ...registry[0]!, id: "zone.capacity.17" });
      if (kind === "cross-entity-id") registry[0]!.id = "ball";
      if (kind === "wrong-shape-field") registry[0]!.radiusM = 1;
      if (kind === "unknown-field") registry[0]!.unapproved = true;
      scene(bad).zones = registry;
      const error = await importProject(page, bad, false);
      expect(await sceneRevision(page).innerText()).toBe(before);
      await expect(zonePanel(page).getByRole("listitem")).toHaveCount(16);
      a.record("zone.import." + kind, { result: "ATOMICALLY_REJECTED", error });
    }
    await a.snapshot("capacity-and-rejections");
  });
});

test("zone rule selectors retain disabled references and guard removal", async ({ page }) => {
  await runAudit(page, "04-rule-references", async (a) => {
    await selectBall(page);
    const triggers = page.locator("#new-trigger");
    await expect(triggers.locator('option[value="OnEnterZone"]')).toBeDisabled();
    await addZone(page, crossingZone);
    await addZone(page, {
      ...crossingZone,
      id: "zone.other",
      name: "替代區域",
      centerM: [20, 1, 0],
    });
    await selectBall(page);
    const enter = await addZoneRule(page, "OnEnterZone", crossingZone.id, a),
      exit = await addZoneRule(page, "OnExitZone", crossingZone.id, a);
    let project = await exportProject(page, a, "default-object-anchors");
    for (const id of [enter, exit])
      expect(object(findRule(project, id).emitter).attachment).toBe("object");
    await page.getByRole("tab", { name: "區域", exact: true }).click();
    const before = await sceneRevision(page).innerText();
    await zoneRow(page, crossingZone.id)
      .getByRole("button", { name: /^刪除 / })
      .click();
    await expect(
      zonePanel(page).getByRole("alert").filter({ hasText: "ZONE_IN_USE" }).last(),
    ).toContainText(enter);
    await expect(
      zonePanel(page).getByRole("alert").filter({ hasText: "ZONE_IN_USE" }).last(),
    ).toContainText(exit);
    expect(await sceneRevision(page).innerText()).toBe(before);
    a.record("zone.remove.{zoneId}", {
      zoneId: crossingZone.id,
      result: "ZONE_IN_USE",
      enter,
      exit,
    });
    await zoneRow(page, crossingZone.id).getByRole("checkbox").uncheck();
    await expect(zoneRow(page, crossingZone.id).getByRole("checkbox")).not.toBeChecked();
    const enterCard = ruleCard(page, enter),
      exitCard = ruleCard(page, exit);
    for (const ruleId of [enter, exit]) {
      await probeHelp(
        page,
        a,
        ruleCard(page, ruleId).getByRole("button", { name: "說明：事件區域", exact: true }),
        {
          sourceSiteId: "ui.rulecard.rulecard.helptip.e2595a7002",
          file: "src/ui/RuleCard.tsx",
          line: 336,
          topicExpression: 't("editor.zone.label")',
          topic: "事件區域",
          ruleId,
        },
        "物件中心",
      );
    }
    const retained = enterCard.getByRole("combobox", { name: /^事件區域/ });
    await expect(retained).toHaveValue(crossingZone.id);
    await expect(retained.locator('option[value="zone.browser"]')).toContainText("停用");
    await page.locator("#new-trigger").selectOption("OnEnterZone");
    await expect(
      page
        .locator(".add-rule-row")
        .getByRole("combobox", { name: /^事件區域/ })
        .locator('option[value="zone.browser"]'),
    ).toHaveCount(0);
    await enterCard.getByRole("combobox", { name: "觸發條件", exact: true }).selectOption("OnGrab");
    await expect(enterCard.getByRole("combobox", { name: /^事件區域/ })).toHaveCount(0);
    await enterCard.getByRole("button", { name: "套用", exact: true }).click();
    await exitCard.getByRole("combobox", { name: /^事件區域/ }).selectOption("zone.other");
    await exitCard.getByRole("button", { name: "套用", exact: true }).click();
    project = await exportProject(page, a, "retargeted-rules");
    expect("zoneId" in object(findRule(project, enter).trigger)).toBe(false);
    expect(object(findRule(project, exit).trigger).zoneId).toBe("zone.other");
    await zoneRow(page, crossingZone.id)
      .getByRole("button", { name: /^刪除 / })
      .click();
    await expect(zoneRow(page, crossingZone.id)).toHaveCount(0);
    await page.getByRole("button", { name: "復原場景命令", exact: true }).click();
    await expect(zoneRow(page, crossingZone.id)).toBeVisible();
    a.record("rule.zone.{ruleId}", {
      enter,
      exit,
      defaultAttachment: "object",
      existingDisabledRetained: true,
      newSelectionExcludesDisabled: true,
      nonZoneClearsId: true,
    });
    await a.snapshot("rule-reference-guards");
  });
});

test("real zone enter exit recording replay and fixed-registry behavior comparison", async ({
  page,
}) => {
  await runAudit(page, "05-events-replay-ab", async (a) => {
    await addZone(page, crossingZone);
    await selectBall(page);
    const enter = await addZoneRule(page, "OnEnterZone", crossingZone.id, a),
      exit = await addZoneRule(page, "OnExitZone", crossingZone.id, a);
    const legalProject = await exportProject(page, a, "zone-rules-handoff-project");
    expect(object(findRule(legalProject, enter).trigger).zoneId).toBe(crossingZone.id);
    await capture(page);
    const recording = await exportRecording(page, a, "zone-crossing-recording");
    expect(recording.status).toBe("captured");
    const raw = zoneEvents(recording);
    expect(raw.some((event) => event.type === "OnEnterZone")).toBe(true);
    expect(raw.some((event) => event.type === "OnExitZone")).toBe(true);
    const normalized = list(recording.frames)
      .flatMap((frame) => list(object(object(frame.behaviorSnapshot).inputFrame).events))
      .filter((event) => event.source === "zone" && event.zoneId === crossingZone.id);
    expect(normalized.map((event) => [event.eventId, event.type, event.zoneId])).toEqual(
      raw.map((event) => [event.eventId, event.type, event.zoneId]),
    );
    const starts = list(recording.frames)
      .flatMap((frame) => list(frame.audioEvents))
      .filter((event) => event.action === "start" && [enter, exit].includes(String(event.ruleId)));
    expect(starts.length).toBeGreaterThanOrEqual(2);
    for (const sound of starts) {
      expect(object(sound.trigger).zoneId).toBe(crossingZone.id);
      const input = raw.find((event) => event.eventId === sound.parentPhysicsEventId);
      expect(input).toBeDefined();
      expect(sound.positionMetres).toEqual(input!.positionMetres);
      expect(sound.positionMetres).not.toEqual(crossingZone.centerM);
    }
    a.record("zone.producer.trace", {
      raw,
      normalized,
      audioStarts: starts,
      result: "TRUE_FIXED_STEP_RAW_AND_NORMALIZED_MATCH",
    });
    const events = page.locator(".events-panel");
    const eventTargets = ["OnEnterZone", "OnExitZone"].map((type) => ({
      type,
      eventId: String(raw.filter((event) => event.type === type).at(-1)!.eventId),
    }));
    for (const target of eventTargets) {
      const detail = await selectEventById(
        page,
        a,
        events,
        target.eventId,
        target.type,
        "live-captured",
      );
      await expect(detail).toContainText("Zone " + crossingZone.id);
    }
    await events.getByRole("searchbox").fill("");
    await events.getByRole("button", { name: "▶ 重播紀錄", exact: true }).click();
    await events.getByRole("slider").press("Home");
    for (const target of eventTargets) {
      const detail = await selectEventById(
        page,
        a,
        events,
        target.eventId,
        target.type,
        "replayed-same-raw-ID",
      );
      await expect(detail).toContainText("Zone " + crossingZone.id);
      await expect(detail).toContainText("RecordedOutput");
    }
    const replayExport = await exportRecording(page, a, "replay-preserves-recording");
    expect(replayExport).toEqual(recording);
    await events.getByRole("button", { name: "結束重播", exact: true }).click();
    await page.getByRole("tab", { name: "實驗比較", exact: true }).click();
    const comparison = page.locator(".comparison-panel");
    await comparison.getByRole("button", { name: "保存 A 快照", exact: true }).click();
    await comparison.getByRole("button", { name: "保存 B 快照", exact: true }).click();
    await expect(comparison.getByRole("button", { name: "更新 B 快照", exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await comparison
      .getByRole("combobox", { name: "比較類型", exact: true })
      .selectOption("behavior");
    await comparison.getByRole("button", { name: "檢查並比較", exact: true }).click();
    await expect(comparison.getByRole("status")).toContainText("固定條件相符");
    a.record("zone.comparison", { unchangedRegistry: "MATCHED_BEHAVIOR_AB" });
    await editZone(page, crossingZone.id);
    await zoneInput(page, "中心位置 Y").fill("1.1");
    await zoneForm(page).getByRole("button", { name: "儲存區域", exact: true }).click();
    await page.getByRole("tab", { name: "實驗比較", exact: true }).click();
    await comparison.getByRole("button", { name: "更新 B 快照", exact: true }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({
          hasText:
            /ZONE_REGISTRY_CHANGED|不可假定相同實驗|物理設定改變|區域配置變更|fresh physics run|不能沿用原區域進出事件/,
        })
        .last(),
    ).toBeVisible();
    a.record("zone.comparison.changed-registry", {
      result: "REJECTED_REQUIRES_FRESH_PHYSICS",
      error: await page
        .getByRole("alert")
        .filter({
          hasText:
            /ZONE_REGISTRY_CHANGED|不可假定相同實驗|物理設定改變|區域配置變更|fresh physics run|不能沿用原區域進出事件/,
        })
        .last()
        .innerText(),
    });
    await a.snapshot("trace-and-comparison", page.locator(".analysis-dock"));
  });
});

test("disabled volume keeps an explicit JSON-authored zone anchor and blocks editor during replay", async ({
  page,
}) => {
  await runAudit(page, "06-disabled-anchor-availability", async (a) => {
    await addZone(page, { ...crossingZone, enabled: false });
    await selectBall(page);
    const beforeIds = await page.locator(".behavior-card .rule-identity code").allTextContents();
    await page.locator("#new-trigger").selectOption("AlwaysOn");
    await page.locator(".add-rule-row").getByRole("button", { name: "新增", exact: true }).click();
    await expect
      .poll(async () => await page.locator(".behavior-card .rule-identity code").count())
      .toBe(beforeIds.length + 1);
    const ruleId = (
      await page.locator(".behavior-card .rule-identity code").allTextContents()
    ).find((id) => !beforeIds.includes(id))!;
    const project = await exportProject(page, a, "object-anchor-project");
    findRule(project, ruleId).emitter = { attachment: "zone", zoneId: crossingZone.id };
    await importProject(page, project);
    const imported = await exportProject(page, a, "explicit-zone-anchor-project");
    expect(object(findRule(imported, ruleId).emitter)).toEqual({
      attachment: "zone",
      zoneId: crossingZone.id,
    });
    a.record("rule.emitterAttachment", {
      ui: "ABSENT_NOT_A_CONTROL",
      method: "legal exported project JSON edited and explicitly imported through UI",
      ruleId,
    });
    await capture(page);
    const artifact = await exportRecording(page, a, "disabled-zone-anchor-recording");
    expect(zoneEvents(artifact)).toEqual([]);
    const frames = list(artifact.frames);
    const y = frames.flatMap((frame) =>
      list(frame.poses)
        .filter((pose) => pose.objectId === "ball")
        .map((pose) => (pose.positionM as number[])[1]!),
    );
    expect(Math.min(...y)).toBeLessThan(0.58);
    expect(Math.max(...y)).toBeGreaterThan(1.42);
    const sounds = frames
      .flatMap((frame) => list(frame.audioEvents))
      .filter((event) => event.ruleId === ruleId);
    expect(sounds.length).toBeGreaterThan(0);
    expect(
      sounds.every(
        (event) => JSON.stringify(event.positionMetres) === JSON.stringify(crossingZone.centerM),
      ),
    ).toBe(true);
    a.record("zone.enabled.{zoneId}", {
      zoneId: crossingZone.id,
      disabled: true,
      sampledBodyCrossedVolume: true,
      occupancyEvents: 0,
      explicitAnchorStillAtCenter: true,
    });
    await page.getByRole("tab", { name: "區域", exact: true }).click();
    await zoneRow(page, crossingZone.id)
      .getByRole("button", { name: /^刪除 / })
      .click();
    await expect(
      zonePanel(page).getByRole("alert").filter({ hasText: "ZONE_IN_USE" }).last(),
    ).toContainText(ruleId);
    await page.getByRole("tab", { name: /^事件與錄放/ }).click();
    const events = page.locator(".events-panel");
    await events.getByRole("button", { name: "▶ 重播紀錄", exact: true }).click();
    await events.getByRole("slider").press("Home");
    await page.getByRole("tab", { name: "區域", exact: true }).click();
    await expect(
      zonePanel(page).getByRole("button", { name: "新增區域", exact: true }),
    ).toBeDisabled();
    await expect(
      zoneRow(page, crossingZone.id).getByRole("button", { name: /^編輯 / }),
    ).toBeDisabled();
    await a.snapshot("replay-blocks-editor");
    await page.getByRole("tab", { name: /^事件與錄放/ }).click();
    await events.getByRole("button", { name: "結束重播", exact: true }).click();
    await page.getByRole("tab", { name: "區域", exact: true }).click();
    await expect(
      zonePanel(page).getByRole("button", { name: "新增區域", exact: true }),
    ).toBeEnabled();
    await transport(page)
      .getByRole("button", { name: /^(開始運算|繼續運算)$/ })
      .click();
    await expect(
      zonePanel(page).getByRole("button", { name: "新增區域", exact: true }),
    ).toBeDisabled();
    await transport(page).getByRole("button", { name: "暫停", exact: true }).click();
    await expect(
      zonePanel(page).getByRole("button", { name: "新增區域", exact: true }),
    ).toBeEnabled();
    await page.getByRole("tab", { name: /^事件與錄放/ }).click();
    const tickBefore = Number(
      (await transport(page).innerText()).match(/tick\s+(\d+)/)?.[1] ?? "-1",
    );
    await events.getByRole("button", { name: "● 開始錄製", exact: true }).click();
    await page.getByRole("tab", { name: "區域", exact: true }).click();
    await expect(
      zonePanel(page).getByRole("button", { name: "新增區域", exact: true }),
    ).toBeDisabled();
    await expect
      .poll(async () =>
        Number((await transport(page).innerText()).match(/tick\s+(\d+)/)?.[1] ?? "-1"),
      )
      .toBeGreaterThan(tickBefore);
    const pause = transport(page).getByRole("button", { name: "暫停", exact: true });
    if (await pause.isVisible()) await pause.click();
    await page.getByRole("tab", { name: /^事件與錄放/ }).click();
    await events.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
    await page.getByRole("tab", { name: "區域", exact: true }).click();
    await expect(
      zonePanel(page).getByRole("button", { name: "新增區域", exact: true }),
    ).toBeEnabled();
    a.record("zone.availability.recording", {
      result: "BLOCKED_DURING_RECORDING_AND_RECOVERS_AFTER_STOP",
    });

    a.record("zone.availability", {
      running: "BLOCKED",
      replayingPaused: "BLOCKED",
      pausedEditor: "ENABLED",
      nonEditor: "NOT_EXERCISED_NO_PERMISSION_PROMPT",
    });
  });
});
