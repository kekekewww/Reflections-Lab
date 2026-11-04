import { expect, test } from "@playwright/test";

test("pipeline tabs preserve motion drafts and remain keyboard reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  const motionTab = page.getByRole("tab", { name: "動作", exact: true });
  await motionTab.click();
  const motion = page.getByRole("tabpanel", { name: "動作", exact: true });
  const actionId = motion.getByRole("textbox", { name: "動作 ID", exact: true });
  await expect(actionId).toBeVisible();
  await actionId.fill("motion.preserved-draft");
  await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
  const output = page.getByRole("tabpanel", { name: "音訊匯出", exact: true });
  await expect(output.getByRole("button", { name: "錄製3秒", exact: true })).toBeVisible();
  await motionTab.click();
  await expect(actionId).toHaveValue("motion.preserved-draft");
  await motionTab.press("End");
  await expect(page.getByRole("tab", { name: "效能", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "效能", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "效能", exact: true }).press("Home");
  await expect(page.getByRole("tab", { name: /^事件/ })).toBeFocused();
});

test("pipeline navigation follows locale without losing current tab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
  await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
  const outputTab = page.getByRole("tab", { name: "Audio export", exact: true });
  await expect(outputTab).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel", { name: "Audio export", exact: true });
  await expect(panel.getByRole("button", { name: "Capture 3 seconds", exact: true })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Render audio files", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Motion", exact: true }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: "Motion", exact: true })
      .getByRole("textbox", { name: "Action ID", exact: true }),
  ).toBeVisible();
});
