import { expect, test, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
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

test("early native lock survives deferred entry and explicit Enter enables movement", async ({
  page,
}) => {
  await open(page);
  await delayEntry(page);
  await page.getByRole("button", { name: "進入第一人稱", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe("CANVAS");
  await page.evaluate(() => (window as unknown as { releaseFpsEntry(): void }).releaseFpsEntry());
  await expect(
    page.getByText("按 Enter 開始，再用 WASD 移動、滑鼠轉向 · Esc 釋放滑鼠"),
  ).toBeVisible();
  const before = await page.evaluate(() => window.__reflectionLab!.getFPSCamera()!.positionM[2]);
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__reflectionLab!.getSnapshot().simulationState))
    .toBe("running");
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
