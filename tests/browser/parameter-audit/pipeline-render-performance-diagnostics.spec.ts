import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const evidenceDir = fileURLToPath(
  new URL(
    "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/render-performance/diagnostics/",
    import.meta.url,
  ),
);
const digest = (body: Buffer) => createHash("sha256").update(body).digest("hex");

async function readPanel(panel: Locator) {
  return {
    text: await panel.innerText(),
    nativeStatus: await panel.locator(".panel-heading").nth(1).locator(".badge").innerText(),
    cards: await panel.locator("dl > div").evaluateAll((cards) =>
      cards.map((card) => ({
        label: Array.from(card.querySelector("dt")?.childNodes ?? [])
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent?.trim() ?? "")
          .join(" ")
          .trim(),
        value: card.querySelector("dd")?.textContent?.trim() ?? null,
      })),
    ),
    details: await panel.locator("tbody tr").evaluateAll((rows) =>
      rows.map((row) => ({
        label: row.querySelector("th")?.textContent?.trim() ?? "",
        value: row.querySelector("td")?.textContent?.trim() ?? "",
      })),
    ),
    checkbox: {
      enabled: await panel.getByRole("checkbox").isEnabled(),
      checked: await panel.getByRole("checkbox").isChecked(),
    },
  };
}

test("all performance controls and available diagnostics states through pointer and keyboard", async ({
  page,
  browser,
}) => {
  await mkdir(evidenceDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const stages: Record<string, unknown>[] = [];
  const inventory: Record<string, unknown>[] = [];
  const blockedRequests: string[] = [];
  const pageErrors: string[] = [];
  const assetRequests: Promise<void>[] = [];
  const assets: Record<string, unknown>[] = [];
  const dialogs: string[] = [];
  const receipt: Record<string, unknown> = {
    status: "RUNNING",
    schemaVersion: 1,
    startedAt,
    browser: browser.version(),
    baseURL: "http://127.0.0.1:4173",
    declaredSource: "19db9f9 / index-BDGeI4Sd (actual network bytes separately pinned)",
    operations:
      "UI pointer and keyboard only; evaluate reads DOM only; no runtime bridge or HostInternal",
    scope:
      "Performance panel controls and browser-observed readouts, not hardware hearing or performance acceptance",
    stages,
    inventory,
    blockedRequests,
    pageErrors,
    dialogs,
    assets,
    unsupportedCoverage: [
      "No numeric editable inputs in this panel; numeric invalid/bounds checks are inapplicable.",
      "No manual refresh action exists in this panel.",
      "Browser-native AVAILABLE/UNSUPPORTED/WARMUP/COUNTER_RESET are observed as emitted; no injected capability or fake counter reset.",
      "No device hearing, calibrated SPL, DSP callback CPU, PCM continuity, or 600-second performance measurement.",
    ],
  };
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type() + ": " + dialog.message());
    void dialog.dismiss();
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      (url.pathname === "/" || /\.(js|css)$/.test(url.pathname))
    ) {
      assetRequests.push(
        response
          .body()
          .then((body) => {
            assets.push({
              url: response.url(),
              status: response.status(),
              sha256: digest(body),
              bytes: body.length,
            });
          })
          .catch((error) => {
            assets.push({
              url: response.url(),
              status: response.status(),
              bodyReadError: String(error),
            });
          }),
      );
    }
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const external = /^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:4173";
    const forbiddenAPI = url.pathname.startsWith("/api/agent/propose");
    if (external || forbiddenAPI) {
      blockedRequests.push(route.request().method() + " " + route.request().url());
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("tab", { name: "效能", exact: true }).click();
    const panel = page.locator(".pipeline-diagnostics");
    const switchControl = panel.getByRole("checkbox", { name: "啟用成本觀測", exact: true });
    await expect(panel).toBeVisible();
    await expect(switchControl).toBeDisabled();
    await expect(switchControl).not.toBeChecked();
    const initial = await readPanel(panel);
    expect(initial.nativeStatus).toBe("尚無原生輸出觀測");
    expect(initial.cards.every((card) => card.value?.includes("—"))).toBe(true);
    stages.push({ name: "audio-not-enabled", observed: initial });
    inventory.push({
      id: "performance.cost-observations",
      label: "啟用成本觀測",
      role: "checkbox",
      valueDomain: [false, true],
      min: null,
      max: null,
      step: null,
      invalidAndBounds: "Native binary control; no arbitrary text/numeric value surface.",
      dependency:
        "disabled before listening creates audio diagnostics; enabled once observations are available",
      initial: initial.checkbox,
      pointerTest: "Pending",
      keyboardTest: "Pending",
    });
    const buttonInventory = await panel
      .locator("button,summary,[tabindex]")
      .evaluateAll((elements) =>
        elements.map((el) => ({
          tag: el.tagName.toLowerCase(),
          label: el.getAttribute("aria-label") ?? el.textContent?.trim(),
          tabIndex: el.getAttribute("tabindex"),
          disabled: el instanceof HTMLButtonElement ? el.disabled : null,
          expanded:
            el instanceof HTMLElement && el.tagName === "SUMMARY"
              ? (el.parentElement as HTMLDetailsElement).open
              : null,
        })),
      );
    receipt.domControlInventory = buttonInventory;
    expect(await panel.getByRole("button", { name: /更新|重新整理|refresh/i }).count()).toBe(0);

    const scopeTrigger = panel.locator(".panel-heading").first().locator("span[tabindex='0']");
    await scopeTrigger.click();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await expect(page.getByRole("tooltip")).toContainText("不是 DSP callback CPU");
    await scopeTrigger.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    inventory.push({
      id: "performance.scope-help",
      label: "控制執行緒觀測",
      role: "focusable span",
      pointerTest: "click/focus opened scope tooltip",
      keyboardTest: "Escape dismissed tooltip",
      outcome: "PASS",
      invalidAndBounds: "not a value control",
    });
    for (const topic of ["延後起音／起音總數", "接受／拒絕的音訊影格", "瀏覽器原生輸出"]) {
      const help = panel.getByRole("button", { name: "說明：" + topic, exact: true });
      await help.hover();
      await expect(page.getByRole("tooltip")).toBeVisible();
      const text = await page.getByRole("tooltip").innerText();
      await help.click();
      await help.press("Escape");
      await expect(page.getByRole("tooltip")).toBeHidden();
      inventory.push({
        id: "performance.help." + topic,
        label: "說明：" + topic,
        role: "button",
        pointerTest: "hover displayed tooltip",
        keyboardTest: "Escape dismissed focused tooltip",
        actualText: text,
        outcome: "PASS",
        invalidAndBounds: "not a value control",
      });
    }

    const summary = panel.getByText("更新成本與分項計數", { exact: true });
    await summary.click();
    await expect(panel.locator("details")).toHaveAttribute("open", "");
    await expect(panel.locator("tbody tr")).toHaveCount(11);
    const noAudioDetails = await readPanel(panel);
    expect(noAudioDetails.details.every((row) => row.value.includes("—"))).toBe(true);
    await summary.press("Enter");
    await expect(panel.locator("details")).not.toHaveAttribute("open");
    await summary.press("Space");
    await expect(panel.locator("details")).toHaveAttribute("open", "");
    inventory.push({
      id: "performance.cost-details",
      label: "更新成本與分項計數",
      role: "summary",
      pointerTest: "click opened 11 readonly rows",
      keyboardTest: "Enter closed, Space reopened",
      outcome: "PASS",
      invalidAndBounds: "not a value control",
    });

    await page.getByRole("button", { name: "啟用聆聽", exact: true }).click();
    await expect(switchControl).toBeEnabled();
    await expect(switchControl).toBeChecked();
    stages.push({ name: "audio-enabled", observed: await readPanel(panel) });
    await page
      .locator(".transport-actions")
      .getByRole("button", { name: "開始運算", exact: true })
      .click();
    const tick = page.locator(".run-status .subtle");
    const tickNumber = async () => Number((await tick.innerText()).replace("tick ", ""));
    await expect.poll(tickNumber).toBeGreaterThan(45);
    await expect
      .poll(async () => Number((await readPanel(panel)).cards[1]!.value?.split("/")[0]?.trim()))
      .toBeGreaterThan(0);
    const running = await readPanel(panel);
    const nativeAvailable = running.nativeStatus === "原生計數可用";
    if (!nativeAvailable) {
      expect(running.cards.slice(4).every((card) => card.value === "—")).toBe(true);
    }
    stages.push({
      name: "simulation-running-auto-update",
      tick: await tickNumber(),
      observed: running,
    });
    await switchControl.click();
    await expect(switchControl).not.toBeChecked();
    await expect(panel.getByRole("status")).toHaveText("觀測已停用；顯示保留資料");
    const stopped = await readPanel(panel);
    const disabledTick = await tickNumber();
    await expect.poll(tickNumber).toBeGreaterThan(disabledTick + 35);
    const retained = await readPanel(panel);
    expect(retained.cards).toEqual(stopped.cards);
    expect(retained.details).toEqual(stopped.details);
    stages.push({
      name: "cost-observations-disabled-while-simulation-progresses",
      tickBefore: disabledTick,
      tickAfter: await tickNumber(),
      observedAtDisable: stopped,
      observedAfterProgress: retained,
      retainedReadoutsUnchanged: true,
    });

    await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
    await page.getByRole("tab", { name: "效能", exact: true }).click();
    await expect(switchControl).not.toBeChecked();
    await switchControl.click();
    await expect(switchControl).toBeChecked();
    await switchControl.press("Space");
    await expect(switchControl).not.toBeChecked();
    await switchControl.press("Space");
    await expect(switchControl).toBeChecked();
    await expect(panel.getByRole("status")).toHaveCount(0);
    const resumedCounter = Number((await readPanel(panel)).cards[1]!.value?.split("/")[0]?.trim());
    await expect
      .poll(async () => Number((await readPanel(panel)).cards[1]!.value?.split("/")[0]?.trim()))
      .toBeGreaterThan(resumedCounter);
    stages.push({ name: "pointer-and-keyboard-enable-resume", observed: await readPanel(panel) });
    inventory[0]!.pointerTest =
      "click toggled off/on; retained readouts frozen while simulation advanced";
    inventory[0]!.keyboardTest = "Space toggled off/on";
    inventory[0]!.outcome = "PASS";
    await page
      .locator(".transport-actions")
      .getByRole("button", { name: "暫停", exact: true })
      .click();
    await page.screenshot({ path: evidenceDir + "/performance-observed-zh.png", fullPage: true });

    await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
    await expect(page.getByRole("tab", { name: "Performance", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      panel.getByRole("checkbox", { name: "Enable cost observations", exact: true }),
    ).toBeChecked();
    await expect(panel.getByText("Update costs and counters", { exact: true })).toBeVisible();
    stages.push({ name: "english-locale-state-retained", text: await panel.innerText() });
    await page.screenshot({ path: evidenceDir + "/performance-observed-en.png", fullPage: true });
    expect(blockedRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(dialogs).toEqual([]);
    receipt.status = "PASS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? error.stack : String(error);
    receipt.failureVisibleText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await page.screenshot({ path: evidenceDir + "/failure.png", fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled(assetRequests);
    receipt.finishedAt = new Date().toISOString();
    await writeFile(
      evidenceDir + "/performance-parameter-receipt.json",
      JSON.stringify(receipt, null, 2) + "\n",
    );
  }
});
