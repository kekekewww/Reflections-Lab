import { expect, test } from "@playwright/test";

for (const locale of ["zh-TW", "en"] as const) {
  test(`first use exposes primary actions and keyboard disclosure: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page
      .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
      .selectOption(locale);
    const english = locale === "en";
    await expect(page.locator("canvas")).toBeVisible();
    await expect(
      page.getByText(english ? "Independent preview" : "獨立預聽", { exact: true }),
    ).toHaveCount(0);
    const status = page.locator(".status-banner:not(.error-banner)");
    await expect(status).toBeVisible();
    await expect(status).not.toHaveText(/^\s*$/);
    await expect(
      page.getByRole("button", {
        name: english ? "Enter first person" : "進入第一人稱",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".monitor-mute")).toBeVisible();
    const expand = page.getByRole("button", {
      name: english ? "Expand experiment panel" : "展開實驗面板",
      exact: true,
    });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expand.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", {
        name: english ? "Collapse experiment panel" : "收合實驗面板",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    const summary = page.locator(".import-details summary");
    await expect(summary).toBeVisible();
    await expect(page.locator(".import-details")).not.toHaveAttribute("open", "");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("checkbox", {
        name: english
          ? "I confirm that I have the right to use the imported audio"
          : "我確認有權使用匯入的音檔",
        exact: true,
      }),
    ).toBeVisible();
    const divider = page.getByRole("separator", {
      name: english ? "Resize scene panel" : "調整場景面板寬度",
      exact: true,
    });
    const before = Number(await divider.getAttribute("aria-valuenow"));
    await divider.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => Number(await divider.getAttribute("aria-valuenow")))
      .toBeGreaterThan(before);
    await page.keyboard.press("Home");
    await expect(divider).toHaveAttribute("aria-valuenow", String(before));
    await page
      .getByRole("button", { name: english ? "Import project JSON" : "匯入專案 JSON", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: english ? "Import project JSON" : "匯入專案 JSON",
      exact: true,
    });
    await dialog
      .getByLabel(english ? "Choose a project JSON file" : "選擇專案 JSON 檔案", { exact: true })
      .setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from("[]"),
      });
    await expect(dialog.getByRole("alert")).toBeVisible();
  });

  test(`320 CSS px keeps first use actions reachable: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await page
      .getByRole("combobox", { name: "介面語言 / Interface language", exact: true })
      .selectOption(locale);
    const english = locale === "en";
    await expect(
      page.getByRole("button", {
        name: english ? "Enter first person" : "進入第一人稱",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".monitor-mute")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: english ? "Expand experiment panel" : "展開實驗面板",
        exact: true,
      }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
}
