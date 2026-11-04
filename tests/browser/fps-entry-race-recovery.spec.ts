import { expect, test, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(".viewport-canvas-wrap canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "進入第一人稱", exact: true })).toBeVisible();
}

async function delayEntry(page: Page) {
  await page.evaluate(() => {
    const app = window.__reflectionLab as unknown as {
      staticPreview: { stop(): Promise<void> };
    };
    const old = app.staticPreview.stop.bind(app.staticPreview);
    const releases: Array<() => void> = [];
    app.staticPreview.stop = () =>
      new Promise<void>((resolve) => {
        releases.push(resolve);
      });
    (window as unknown as { releaseFpsEntry(): void }).releaseFpsEntry = () => {
      app.staticPreview.stop = old;
      releases.forEach((release) => release());
    };
  });
}

test("early native lock survives deferred entry and the entry click itself enables movement", async ({
  page,
}) => {
  await open(page);
  await delayEntry(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  // Nothing may start before the entry transaction commits.
  expect(await page.evaluate(() => window.__reflectionLab!.getSnapshot().simulationState)).not.toBe(
    "running",
  );
  await page.evaluate(() => (window as unknown as { releaseFpsEntry(): void }).releaseFpsEntry());
  // R18: once entry and the actual lock both complete, controls start without a second Enter.
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().simulationState))
    .toBe("running");
  await expect(page.locator(".viewport-fps-hint")).toContainText("左鍵 抓取");
  await expect(page.locator(".viewport-fps-hint")).toContainText("Enter 暫停");
  const before = await page.evaluate(() => window.__reflectionLab!.getFPSCamera()!.positionM[2]);
  await page.keyboard.down("w");
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getFPSCamera()!.positionM[2]))
    .toBeLessThan(before - 0.01);
  await page.keyboard.up("w");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().simulationState))
    .not.toBe("running");
});

test("busy entry releases the actual lock and gives a retry", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    (window.__reflectionLab as unknown as { busy: boolean }).busy = true;
  });
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect(page.getByText("無法進入第一人稱；請確認目前操作已完成後重試。")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.evaluate(() => {
    (window.__reflectionLab as unknown as { busy: boolean }).busy = false;
  });
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
});

test("escape interrupts pending entry without entering or resuming", async ({ page }) => {
  await open(page);
  await delayEntry(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.evaluate(() => (window as unknown as { releaseFpsEntry(): void }).releaseFpsEntry());
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().interactionMode))
    .toBe("editor");
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().simulationState))
    .not.toBe("running");
});

test("R18: a fixing safe pause keeps the real lock; Enter and a view click resume without throwing, and a view click re-locks", async ({
  page,
}) => {
  await open(page);
  const state = () => page.evaluate(() => window.__reflectionLab!.getSnapshot());
  await page.evaluate(() =>
    window.__reflectionLab!.dispatch({
      type: "patchObject",
      objectId: "ball",
      patch: { positionM: [0, 1.6, 2], mode: "dynamicNoGravity" },
    }),
  );
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(async () => (await state()).simulationState).toBe("running");
  // A paused world at tick 0 reports "ready"; fix the ball once time has advanced.
  await expect.poll(async () => (await state()).tick).toBeGreaterThan(2);
  await page.keyboard.press("f");
  await expect
    .poll(async () => (await state()).objects.find((object) => object.id === "ball")?.mode)
    .toBe("fixed");
  await expect.poll(async () => (await state()).simulationState).toBe("paused");
  expect(await page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await expect(page.getByText("已暫停 · 點擊畫面或按 Enter 繼續 · Esc 釋放滑鼠")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await state()).simulationState).toBe("running");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await state()).simulationState).toBe("paused");
  await page.mouse.click(720, 450);
  await expect.poll(async () => (await state()).simulationState).toBe("running");
  expect((await state()).events.filter((event) => event.type === "OnThrow")).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect.poll(async () => (await state()).simulationState).toBe("paused");
  await expect(page.getByText("滑鼠已釋放 · 點擊畫面或「啟用滑鼠控制」重新鎖定")).toBeVisible();
  // Chrome refuses an immediate relock after a user Escape; a later explicit click succeeds.
  await page.waitForTimeout(1300);
  await page.locator(".viewport-canvas-wrap canvas").click({ position: { x: 400, y: 300 } });
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await expect.poll(async () => (await state()).simulationState).toBe("running");
  expect((await state()).events.filter((event) => event.type === "OnThrow")).toHaveLength(0);
});

test("review 8: keyboard activates the bottom mouse-control button after native unlock", async ({
  page,
}, info) => {
  await open(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  const enable = page
    .locator(".viewport-fps-hint")
    .getByRole("button", { name: "啟用滑鼠控制", exact: true });
  await expect(enable).toBeVisible();
  await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  const english = page
    .locator(".viewport-fps-hint")
    .getByRole("button", { name: "Enable mouse control", exact: true });
  await expect(english).toBeVisible();
  await page.waitForTimeout(1300); // Native Escape relock cooldown.
  await english.focus();
  await expect(english).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().simulationState))
    .toBe("running");
  expect(
    await page.evaluate(() =>
      window.__reflectionLab!.getSnapshot().events.filter((event) => event.type === "OnThrow"),
    ),
  ).toHaveLength(0);
  await page.screenshot({ path: info.outputPath("keyboard-relock.png") });
});
