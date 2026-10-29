import { expect, test } from "@playwright/test";
import type { ProjectDocument } from "../../src/persistence/types.js";

const localeLabel = "介面語言 / Interface language";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/agent/propose**", (route) => route.abort("blockedbyclient"));
  await page.route("https://api.meta.ai/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__reflectionLab)).toBe(true);
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("en");
  await page.getByRole("tab", { name: /^Events/ }).click();
});

test("actual unrecorded voice-budget decision is inspectable and keeps identity across locales", async ({
  page,
}, info) => {
  // Public runtime API builds a deterministic over-budget fixture. Assertions below operate the actual UI.
  const observed = await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    const project = JSON.parse(app.exportProject()) as ProjectDocument;
    const object = project.scene.objects.find((value) => value.id === "speaker")!;
    const source = project.scene.sources[0]!;
    const binding = project.soundBehaviors.bindings.find((value) => value.objectId === "speaker")!;
    for (let i = 1; i <= 16; i++) {
      const objectId = `speaker.${String(i).padStart(2, "0")}`;
      project.scene.objects.push({ ...object, id: objectId, positionM: [i * 2, 1, -2] });
      project.scene.sources.push({ ...source, id: `source.${objectId}`, objectId });
      project.soundBehaviors.bindings.push({
        ...binding,
        bindingId: `binding.${objectId}`,
        objectId,
      });
    }
    await app.importProject(JSON.stringify(project));
    await app.dispatch({ type: "run" });
    app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const view = app.getSnapshot();
    return {
      tick: view.tick,
      recording: view.recording.state,
      starts: view.events.filter((event) => event.decision?.action === "start").length,
      rejected: view.events.find((event) => event.decision?.reason === "GLOBAL_VOICE_LIMIT"),
      documents: JSON.stringify([app.getSceneDocument(), app.getBehaviorDocument()]),
    };
  });
  expect(observed.recording).toBe("idle");
  expect(observed.starts).toBe(16);
  expect(observed.rejected?.suppressed).toBe(true);
  await page
    .getByRole("searchbox", { name: "Filter events", exact: true })
    .fill("GLOBAL_VOICE_LIMIT");
  const row = page.locator(".event-table tbody tr").filter({ hasText: "GLOBAL_VOICE_LIMIT" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Global voice limit reached");
  await row.getByRole("button").click();
  const detail = page.getByRole("complementary", { name: "Selected event details", exact: true });
  await expect(detail).toContainText(observed.rejected!.id);
  await expect(detail).toContainText(observed.rejected!.decision!.bindingId!);
  await expect(detail).toContainText("Suppressed");
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("zh-TW");
  await expect(page.locator(".dock-detail")).toContainText(
    "已達整體聲音實例上限 [GLOBAL_VOICE_LIMIT]",
  );
  await expect(page.locator(".dock-detail")).toContainText(observed.rejected!.id);
  const after = await page.evaluate(() => {
    const app = window.__reflectionLab!;
    return {
      tick: app.getSnapshot().tick,
      selected: app.getSnapshot().selectedEventId,
      documents: JSON.stringify([app.getSceneDocument(), app.getBehaviorDocument()]),
    };
  });
  expect(after).toEqual({
    tick: observed.tick,
    selected: observed.rejected!.id,
    documents: observed.documents,
  });
  await info.attach("actual-runtime-budget-fixture.json", {
    body: JSON.stringify(
      {
        setup:
          "Public runtime API; one actual Rapier/behavior tick; UI filter, selection and locale assertions",
        observed,
        after,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("budget-zh.png") });
});

test("real Rapier cooldown keeps collision evidence and displays contact separately from emission", async ({
  page,
}, info) => {
  // Public command setup and deterministic real fixed steps; no evaluator/DOM decision is mocked.
  const observed = await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    await app.dispatch({
      type: "patchRule",
      objectId: "ball",
      ruleId: "rule.impact",
      patch: { cooldownSeconds: 10 },
    });
    await app.dispatch({ type: "run" });
    for (let tick = 0; tick < 230; tick++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    const view = app.getSnapshot();
    const rejected = view.events.find((event) => event.decision?.reason === "COOLDOWN");
    return {
      tick: view.tick,
      recording: view.recording.state,
      rejected,
      raw: view.events.find((event) => event.id === rejected?.decision?.inputEventId),
    };
  });
  expect(observed.recording).toBe("idle");
  expect(observed.raw?.type).toBe("OnImpact");
  expect(observed.raw?.suppressed).toBeUndefined();
  expect(observed.rejected?.decision?.contactPositionM).toHaveLength(3);
  expect(observed.rejected?.decision?.emitterPositionM).toBeUndefined();
  await page.getByRole("searchbox", { name: "Filter events", exact: true }).fill("COOLDOWN");
  const row = page.locator(".event-table tbody tr").filter({ hasText: "COOLDOWN" }).first();
  await expect(row).toContainText("Rule cooldown is active");
  await row.getByRole("button").click();
  const detail = page.locator(".dock-detail");
  await expect(detail).toContainText("Contact point");
  await expect(detail).toContainText(observed.rejected!.decision!.inputEventId!);
  await expect(detail).toContainText(observed.rejected!.decision!.contactPairKey!);
  await expect(
    detail.locator(".detail-list > div").filter({ hasText: "Emitted source position (m)" }),
  ).toContainText("Not provided");
  await page.getByRole("combobox", { name: localeLabel, exact: true }).selectOption("zh-TW");
  await expect(detail).toContainText("規則冷卻中 [COOLDOWN]");
  await expect(detail).toContainText("輸入接觸位置（m）");
  await expect(detail).toContainText(observed.rejected!.id);
  await info.attach("actual-runtime-cooldown-fixture.json", {
    body: JSON.stringify(
      {
        setup:
          "Public runtime API; 230 actual Rapier/behavior ticks; UI filter and contact inspection",
        observed,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("cooldown-contact-zh.png") });
});
