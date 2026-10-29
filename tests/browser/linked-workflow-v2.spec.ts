import { expect, test, type Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";

const locale = "介面語言 / Interface language";
const objectButton = (page: Page, id: string) =>
  page.locator(".object-row").filter({ has: page.locator(`[title='${id}']`) });
const snapshot = (page: Page) => page.evaluate(() => window.__reflectionLab!.getSnapshot());
const attach = async (info: import("@playwright/test").TestInfo, name: string, value: unknown) =>
  info.attach(name, { body: JSON.stringify(value, null, 2), contentType: "application/json" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/agent/propose**", (route) => route.abort("blockedbyclient"));
  await page.route("https://api.meta.ai/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.__reflectionLab)).toBe(true);
  await page.getByRole("combobox", { name: locale, exact: true }).selectOption("en");
});

test("actual canvas object picking shares stable ID with Explorer and Inspector after earlier-row deletion", async ({
  page,
}, info) => {
  await objectButton(page, "ball").click();
  await page.getByRole("button", { name: "Frame selection", exact: true }).click();
  await objectButton(page, "speaker").click();
  // The observer remains framed on ball: click the real rendered sphere, not a runtime selection command.
  const box = await page.locator("canvas").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(async () => (await snapshot(page)).selectedObjectId).toBe("ball");
  await expect(objectButton(page, "ball")).toHaveAttribute("aria-pressed", "true");
  await expect(objectButton(page, "speaker")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".inspector-identity code")).toHaveText("ball");
  const before = await snapshot(page);
  // Public command deletes an earlier array member; the selected ID must survive the changed index.
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({ type: "removeObject", objectId: "floor" }),
  );
  await expect(objectButton(page, "floor")).toHaveCount(0);
  await expect(objectButton(page, "ball")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".inspector-identity code")).toHaveText("ball");
  const after = await snapshot(page);
  expect(after.selectedObjectId).toBe(before.selectedObjectId);
  expect(after.listener).toEqual(before.listener);
  await attach(info, "actual-canvas-object-identity.json", {
    before,
    after,
    setup:
      "Real canvas click after public Frame selection; real public RemoveObject shifts scene indices. No renderer seam.",
  });
  await page.screenshot({ path: info.outputPath("object-linked.png") });
});

test("deleting the selected object clears selection rather than silently selecting another object", async ({
  page,
}, info) => {
  await objectButton(page, "ball").click();
  const before = await snapshot(page);
  await page
    .locator(".inspector-actions")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(objectButton(page, "ball")).toHaveCount(0);
  const after = await snapshot(page);
  await attach(info, "selected-object-delete.json", {
    before,
    after,
    oracle:
      "V1-UX-02 + WORKSPACE_ARCHITECTURE: deleted selection invalidated/cleared; another object cannot inherit its selection",
  });
  await page.screenshot({ path: info.outputPath("selected-object-delete.png") });
  expect(after.selectedObjectId).toBeNull();
  await expect(page.locator(".object-row[aria-pressed='true']")).toHaveCount(0);
  // An empty object selection presents the existing Listener/Environment inspector.
  // Its shared identity class must identify listener.main, never another scene object.
  await expect(page.locator(".inspector-identity code")).toHaveText(after.listener.id);
});

test("actual solver paths link table and canvas by stable ID and disclose units provenance and unavailable metrics", async ({
  page,
}, info) => {
  await page.getByRole("tab", { name: /^Acoustic paths/ }).click();
  await expect.poll(async () => (await snapshot(page)).paths.length).toBeGreaterThan(1);
  const before = await snapshot(page);
  const path = before.paths.find((path) => path.kind === "reflection")!;
  expect(path).toBeTruthy();
  await page.locator(".path-table").getByRole("button", { name: path.id, exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).selectedPathId).toBe(path.id);
  const detail = page.getByRole("complementary", { name: "Selected path details", exact: true });
  await expect(detail).toContainText(path.id);
  await expect(detail).toContainText(path.sourceId!);
  await expect(detail).toContainText("Numerical approximation");
  await expect(detail).toContainText("device latency");
  await expect(page.locator(".path-table")).toContainText("Distance m");
  await expect(page.locator(".path-table")).toContainText("Propagation delay ms");
  await expect(page.locator(".paths-panel .dock-toolbar")).toContainText(
    `acoustic rev ${before.acoustic.revision} / scene rev ${before.sceneRevision}`,
  );
  await expect(page.locator(".metric-card").filter({ hasText: "RT60" })).toContainText(
    "Not provided",
  );
  // Projection uses the documented actual default camera, measured canvas bounds and real solver vertices.
  // The click is delivered to the canvas through Playwright. No R3F/DOM/selection handler is invoked directly.
  const bounds = await page.locator("canvas").boundingBox();
  const camera = new PerspectiveCamera(50, bounds!.width / bounds!.height, 0.05, 250);
  camera.position.set(8, 6, 10);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const candidates = before.paths
    .flatMap((candidate) =>
      candidate.points.slice(1).flatMap((point, i) =>
        [0.35, 0.5, 0.65].map((fraction) => {
          const start = new Vector3(...candidate.points[i]!);
          const projected = start.lerp(new Vector3(...point), fraction).project(camera);
          return {
            id: candidate.id,
            x: bounds!.x + ((projected.x + 1) * bounds!.width) / 2,
            y: bounds!.y + ((1 - projected.y) * bounds!.height) / 2,
            z: projected.z,
          };
        }),
      ),
    )
    .filter(
      (point) =>
        point.id !== path.id &&
        point.z > -1 &&
        point.z < 1 &&
        point.x > bounds!.x + 30 &&
        point.x < bounds!.x + bounds!.width - 30 &&
        point.y > bounds!.y + 30 &&
        point.y < bounds!.y + bounds!.height - 30,
    );
  let picked: (typeof candidates)[number] | undefined;
  // Occlusion is allowed. A successful real hit must identify the exact line clicked; no fallback runtime command.
  for (const candidate of candidates.slice(0, 30)) {
    await page.locator(".path-table").getByRole("button", { name: path.id, exact: true }).click();
    await expect.poll(async () => (await snapshot(page)).selectedPathId).toBe(path.id);
    await page.mouse.click(candidate.x, candidate.y);
    const actual = (await snapshot(page)).selectedPathId;
    if (actual === candidate.id) {
      picked = candidate;
      break;
    }
  }
  expect(
    picked,
    "At least one visible real solver line must be selectable in the actual canvas",
  ).toBeTruthy();
  await expect(detail).toContainText(picked!.id);
  await expect(page.locator(".path-table tr.is-selected")).toContainText(picked!.id);
  const after = await snapshot(page);
  expect(after.paths).toEqual(before.paths);
  expect(after.listener).toEqual(before.listener);
  await attach(info, "actual-solver-table-canvas.json", {
    before,
    after,
    picked,
    attempted: candidates.slice(0, 30),
    scope:
      "Real numerical solver data and real mouse picking; no physics/acoustic accuracy or screenshot visual review claim",
  });
  await page.screenshot({ path: info.outputPath("path-linked.png") });
});

test("real unavailable propagation preserves path identity and null metrics with its actual reason", async ({
  page,
}, info) => {
  await page.getByRole("tab", { name: /^Acoustic paths/ }).click();
  await expect.poll(async () => (await snapshot(page)).paths.length).toBeGreaterThan(0);
  const before = await snapshot(page);
  const selected = before.paths[0]!;
  await page.locator(".path-table").getByRole("button", { name: selected.id, exact: true }).click();
  // Genuine public atmosphere command runs the actual solver under its unsupported vacuum condition.
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({ type: "setAtmosphere", medium: "vacuum" }),
  );
  await expect(page.locator(".path-table")).toHaveCount(0);
  expect((await snapshot(page)).acoustic.state).toBe("unavailable");
  await expect(page.locator(".paths-panel")).toContainText(/vacuum/i);
  await expect(page.locator(".paths-panel")).not.toContainText("No paths to display yet");
  await expect(page.locator(".evidence-tag")).not.toContainText("Computed");
  await expect(
    page.getByRole("complementary", { name: "Selected path details", exact: true }),
  ).toHaveCount(0);
  const after = await snapshot(page);
  expect(after.paths).toEqual([]);
  expect(after.selectedPathId).toBe(selected.id);
  for (const metric of after.acoustic.metrics) expect(metric.value).toBeNull();
  const cards = page.locator(".paths-panel .metric-card");
  await expect(cards).toHaveCount(after.acoustic.metrics.length);
  for (let i = 0; i < after.acoustic.metrics.length; i++)
    await expect(cards.nth(i)).toContainText("Not provided");
  await attach(info, "actual-empty-vacuum-frame.json", {
    before,
    after,
    limits:
      "No stale-worker injection; missing pinned-path explanation and unavailable-vs-empty/capability distinction require Root adjudication. Numeric zero is not produced by this fixture.",
  });
  await page.screenshot({ path: info.outputPath("empty-vacuum.png") });
});

test("real event selection survives filtering and newest-first insertion without changing its stable ID", async ({
  page,
}, info) => {
  await page.getByRole("tab", { name: /^Events/ }).click();
  const setup = await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    await app.dispatch({ type: "run" });
    for (let i = 0; i < 120; i++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    return app.getSnapshot();
  });
  const event = setup.events.find(
    (event) => event.type === "OnImpact" && event.decision?.action === "start",
  )!;
  expect(event).toBeTruthy();
  const filter = page.getByRole("searchbox", { name: "Filter events", exact: true });
  await filter.fill("OnImpact");
  const targetRow = page
    .locator(".event-table tbody tr")
    .filter({ hasText: event.ruleId! })
    .filter({ has: page.locator("td:nth-child(2)", { hasText: new RegExp(`^${event.tick}$`) }) });
  await expect(targetRow).toHaveCount(1);
  await targetRow.getByRole("button", { name: event.type, exact: true }).click();
  const detail = page.getByRole("complementary", { name: "Selected event details", exact: true });
  await expect(detail).toContainText(event.id);
  await expect(detail).toContainText(event.objectId!);
  await filter.fill("this-filter-matches-no-runtime-events");
  await expect(page.locator(".event-table tbody tr")).toHaveCount(0);
  // The zero-match view hides its detail panel; filtering must retain the exact runtime selection.
  expect((await snapshot(page)).selectedEventId).toBe(event.id);
  await filter.fill("");
  await expect(detail).toContainText(event.id);
  const appended = await page.evaluate(async () => {
    const app = window.__reflectionLab!;
    // The original ball has settled by now. A legal author command raises it for a second real drop,
    // yielding new Rapier contacts instead of assuming an idle settled body keeps emitting events.
    await app.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: { positionM: [-0.8, 4, 0] },
    });
    await app.dispatch({ type: "run" });
    for (let i = 0; i < 150; i++) app.advance(1 / 60);
    await app.dispatch({ type: "pause" });
    return app.getSnapshot();
  });
  expect(appended.events.length).toBeGreaterThan(setup.events.length);
  expect(appended.selectedEventId).toBe(event.id);
  const retained = appended.events.find((value) => value.id === event.id)!;
  expect(retained).toEqual(event);
  await expect(detail).toContainText(event.id);
  await expect(targetRow).toHaveClass("is-selected");
  await expect(targetRow.getByRole("button")).toHaveAttribute("aria-current", "true");
  await attach(info, "actual-event-newest-first-identity.json", {
    setup,
    event,
    appended,
    limits:
      "Exercises actual newest-first event ordering and filtering. No arbitrary user sorting control exists, and canvas marker visual inspection is separate.",
  });
  await page.screenshot({ path: info.outputPath("event-linked.png") });
});

test("actual rule authoring adds legal trigger edits gain pitch and classification with atomic version Apply and Undo", async ({
  page,
}, info) => {
  await objectButton(page, "ball").click();
  const read = async () =>
    page.evaluate(() => {
      const app = window.__reflectionLab!;
      return {
        view: app.getSnapshot(),
        document: app.getBehaviorDocument(),
        scene: app.getSceneDocument(),
      };
    });
  const before = await read();
  await page
    .getByRole("combobox", { name: "New behavior trigger", exact: true })
    .selectOption("OnThrow");
  await page.locator(".add-rule-row").getByRole("button", { name: "Add", exact: true }).click();
  const added = await read();
  const oldIds = before.view.behaviors
    .find((profile) => profile.objectId === "ball")!
    .rules.map((rule) => rule.id);
  const newRule = added.view.behaviors
    .find((profile) => profile.objectId === "ball")!
    .rules.find((rule) => !oldIds.includes(rule.id))!;
  expect(newRule.trigger).toBe("OnThrow");
  const card = page.getByRole("article", { name: `Sound behavior ${newRule.id}`, exact: true });
  await card.getByRole("combobox", { name: "Trigger", exact: true }).selectOption("OnGrab");
  await card.getByRole("spinbutton", { name: /Volume/ }).fill("0.19");
  await card.getByRole("spinbutton", { name: /Pitch/ }).fill("3");
  await expect(
    card.getByRole("button", { name: "Preview scene acoustics", exact: true }),
  ).toBeDisabled();
  const drafted = await read();
  expect(drafted.document).toEqual(added.document);
  await card.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(card.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
  const applied = await read();
  const committed = applied.view.behaviors
    .find((profile) => profile.objectId === "ball")!
    .rules.find((rule) => rule.id === newRule.id)!;
  expect({
    trigger: committed.trigger,
    gain: committed.gainLinear,
    pitch: committed.pitchSemitones,
  }).toEqual({ trigger: "OnGrab", gain: 0.19, pitch: 3 });
  expect(applied.view.lastBehaviorEdit?.beforeDocumentRevision).toBe(added.document.revision);
  expect(applied.view.lastBehaviorEdit?.afterDocumentRevision).toBe(applied.document.revision);
  expect(applied.document.revision).toBeGreaterThan(added.document.revision);
  await page.getByRole("button", { name: "Undo scene command", exact: true }).click();
  const undone = await read();
  const restored = undone.view.behaviors
    .find((profile) => profile.objectId === "ball")!
    .rules.find((rule) => rule.id === newRule.id)!;
  expect({
    trigger: restored.trigger,
    gain: restored.gainLinear,
    pitch: restored.pitchSemitones,
  }).toEqual({ trigger: newRule.trigger, gain: newRule.gainLinear, pitch: newRule.pitchSemitones });
  expect(undone.document.revision).toBeGreaterThan(applied.document.revision);
  await card.getByRole("checkbox").uncheck();
  await card.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(card.getByRole("checkbox")).not.toBeChecked();
  const disabled = await read();
  expect(
    disabled.view.behaviors
      .find((profile) => profile.objectId === "ball")!
      .rules.find((rule) => rule.id === newRule.id)!.enabled,
  ).toBe(false);
  await page.getByRole("combobox", { name: "Classification", exact: true }).selectOption("hybrid");
  const classified = await read();
  expect(classified.view.behaviors.find((profile) => profile.objectId === "ball")!.presetKind).toBe(
    "hybrid",
  );
  // Revision conflict arises from a real independent author transaction, never a patched dispatcher.
  await card.getByRole("spinbutton", { name: /Volume/ }).fill("0.28");
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({
      type: "patchObject",
      objectId: "wall.back",
      patch: { friction: 0.7 },
    }),
  );
  await expect(card).toContainText("The original rule has changed. Your draft is retained.");
  await expect(card.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
  await expect(card.getByRole("spinbutton", { name: /Volume/ })).toHaveValue("0.28");
  const stale = await read();
  await attach(info, "actual-authoring-versions.json", {
    before,
    added,
    drafted,
    applied,
    undone,
    disabled,
    classified,
    stale,
    limits:
      "Classification exercises current setPreset intent only; no claim of preset-library UI. Asset import/curve/binding overrides covered by separate retained suites.",
  });
  await page.screenshot({ path: info.outputPath("rule-stale-draft.png") });
});
