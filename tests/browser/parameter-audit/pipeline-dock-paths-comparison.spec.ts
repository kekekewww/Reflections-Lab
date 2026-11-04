import { test, expect, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const auditAttempt = (process.env.PIPELINE_DOCK_ATTEMPT ?? "initial").replace(
  /[^A-Za-z0-9_.-]/g,
  "-",
);
const evidenceDir = fileURLToPath(
  new URL(
    `../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/dock/${auditAttempt}/`,
    import.meta.url,
  ),
);
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function controls(scope: Locator) {
  return scope
    .locator('button,input,select,textarea,[tabindex="0"],summary')
    .evaluateAll((elements) =>
      elements.map((element, index) => {
        const input = element as HTMLInputElement;
        const rect = element.getBoundingClientRect();
        return {
          index,
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role"),
          type: element.getAttribute("type"),
          label:
            element.getAttribute("aria-label") ||
            (input.labels
              ? Array.from(input.labels, (label) => label.textContent).join(" ")
              : null) ||
            element.textContent?.trim() ||
            "",
          value: "value" in element ? input.value : null,
          disabled: "disabled" in element ? input.disabled : null,
          min: element.getAttribute("min"),
          max: element.getAttribute("max"),
          step: element.getAttribute("step"),
          maxLength: element.getAttribute("maxlength"),
          options:
            element instanceof HTMLSelectElement
              ? Array.from(element.options, (option) => ({
                  label: option.text,
                  value: option.value,
                  disabled: option.disabled,
                }))
              : null,
          expanded: element.getAttribute("aria-expanded"),
          selected: element.getAttribute("aria-selected"),
          visible: rect.width > 0 && rect.height > 0,
        };
      }),
    );
}

interface Audit {
  id: string;
  status: string;
  startedAt: string;
  browser: string;
  limitations: string[];
  network: { blocked: string[]; agentRequests: string[] };
  assets: { url: string; bytes: number; sha256: string }[];
  pageErrors: string[];
  snapshots: unknown[];
  checks: unknown[];
  error?: string;
  finishedAt?: string;
}

async function runAudit(
  page: Page,
  browserVersion: string,
  id: string,
  work: (
    audit: Audit,
    snapshot: (state: string, scope?: Locator) => Promise<void>,
  ) => Promise<void>,
) {
  await mkdir(evidenceDir, { recursive: true });
  const audit: Audit = {
    id,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    browser: browserVersion,
    limitations: [
      "Only UI clicks/keyboard and DOM reads; no HostInternal or runtime/test bridge",
      "Headless Chrome automation, not human input/hearing/performance acceptance",
      "Unreachable transient/unsupported solver states are not fabricated",
    ],
    network: { blocked: [], agentRequests: [] },
    assets: [],
    pageErrors: [],
    snapshots: [],
    checks: [],
  };
  const assetTasks: Promise<void>[] = [];
  page.on("pageerror", (error) => audit.pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      (/\.(?:js|css)$/.test(url.pathname) || url.pathname === "/")
    ) {
      assetTasks.push(
        response
          .body()
          .then((bytes) => {
            audit.assets.push({ url: response.url(), bytes: bytes.length, sha256: sha256(bytes) });
          })
          .catch(() => {}),
      );
    }
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/")) {
      audit.network.agentRequests.push(request.method() + " " + request.url());
    }
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      ((url.protocol === "http:" || url.protocol === "https:") &&
        url.origin !== "http://127.0.0.1:4173") ||
      url.pathname.startsWith("/api/agent/propose")
    ) {
      audit.network.blocked.push(route.request().method() + " " + route.request().url());
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  const snapshot = async (state: string, scope = page.locator(".analysis-dock")) => {
    audit.snapshots.push({ state, text: await scope.innerText(), controls: await controls(scope) });
    await page.screenshot({ path: evidenceDir + "/" + id + "-" + state + ".png", fullPage: true });
  };
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await work(audit, snapshot);
    expect(audit.network.blocked).toEqual([]);
    expect(audit.pageErrors).toEqual([]);
    audit.status = "PASS";
  } catch (error) {
    audit.status = "FAIL";
    audit.error = error instanceof Error ? error.stack : String(error);
    await snapshot("failure").catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled(assetTasks);
    audit.finishedAt = new Date().toISOString();
    await writeFile(
      evidenceDir + "/" + id + "-receipt.json",
      JSON.stringify(audit, null, 2) + "\n",
    );
  }
}

test("dock navigation and every solver path support pointer and keyboard selection", async ({
  page,
  browser,
}) => {
  await runAudit(page, browser.version(), "navigation-paths", async (audit, snapshot) => {
    const dock = page.locator(".analysis-dock");
    await snapshot("initial-collapsed");
    const tabs = dock.getByRole("tab");
    const labels = await tabs.allTextContents();
    const tabIds = await tabs.evaluateAll((items) =>
      items.map((item) => item.id.match(/-([a-z]+)-tab$/)?.[1] ?? "UNKNOWN"),
    );
    expect([7, 8]).toContain(tabIds.length);
    expect(new Set(tabIds).size).toBe(tabIds.length);
    expect(tabIds).toEqual(
      expect.arrayContaining([
        "events",
        "paths",
        "comparison",
        "agent",
        "motion",
        "render",
        "performance",
      ]),
    );
    if (tabIds.length === 8) expect(tabIds).toContain("zones");
    audit.checks.push({
      control: "dock.tab.inventory",
      observedTabIds: tabIds,
      zonesAvailable: tabIds.includes("zones"),
      result: "every actual tab will be operated; legacy seven-tab receipts stay separately pinned",
    });
    for (let index = 0; index < labels.length; index++) {
      await tabs.nth(index).click();
      await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
      await expect(dock.getByRole("tabpanel")).toHaveCount(1);
      audit.checks.push({
        control: "dock.tab." + tabIds[index],
        mode: "pointer",
        label: labels[index],
        result: "selected and one visible panel",
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
    audit.checks.push({
      control: "dock.tab.keyboard",
      keys: ["ArrowRight", "ArrowLeft", "Home", "End"],
      result: "wrap and endpoints preserve one selected tab",
    });
    await dock.getByRole("button", { name: "收合實驗面板", exact: true }).press("Enter");
    await expect(dock.getByRole("button", { name: "展開實驗面板", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await dock.getByRole("button", { name: "展開實驗面板", exact: true }).click();
    await expect(dock.getByRole("button", { name: "收合實驗面板", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await dock.getByRole("tab", { name: /^聲學路徑/ }).click();
    const paths = page.locator(".paths-panel");
    await expect(paths.locator(".path-table tbody tr")).not.toHaveCount(0);
    await snapshot("paths-ready", paths);
    const pathButtons = paths.locator(".path-table tbody button");
    const ids = await pathButtons.allTextContents();
    for (let index = 0; index < ids.length; index++) {
      const button = pathButtons.nth(index);
      if (index % 2 === 0) await button.click();
      else {
        await button.focus();
        await button.press(index % 3 ? "Enter" : "Space");
      }
      const detail = paths.getByRole("complementary", { name: "選取路徑詳細資料", exact: true });
      await expect(detail).toContainText(ids[index]!);
      await expect(paths.locator(".path-table tr.is-selected button")).toHaveText(ids[index]!);
      audit.checks.push({
        control: "paths.select.{pathId}",
        id: ids[index],
        mode: index % 2 ? "keyboard" : "pointer",
        detail: await detail.innerText(),
        result: "selection and provenance match",
      });
    }
    const rows = await paths
      .locator(".path-table tbody tr")
      .evaluateAll((items) =>
        items.map((row) =>
          Array.from(row.querySelectorAll("td"), (cell) => cell.textContent?.trim() ?? ""),
        ),
      );
    for (const row of rows) {
      for (const numeric of row.slice(2, 5)) {
        expect(Number.isFinite(Number(numeric))).toBe(true);
        expect(Number(numeric)).toBeGreaterThanOrEqual(0);
      }
    }
    const region = paths.getByRole("region", { name: "聲學路徑表，可捲動", exact: true });
    await region.focus();
    await expect(region).toBeFocused();
    await region.press("ArrowDown");
    const help = paths.locator(".dock-detail .help-tip-trigger");
    await help.hover();
    await expect(page.getByRole("tooltip")).toContainText("dB SPL");
    await page.mouse.move(0, 0);
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    await help.focus();
    await expect(page.getByRole("tooltip")).toContainText("dB SPL");
    await help.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    audit.checks.push({
      control: "paths.readout",
      result: "finite nonnegative m/ms/amplitude values; no metric inferred from UI timing",
      rows,
    });
    audit.checks.push({
      control: "paths.provenance.help",
      mode: "keyboard/Escape",
      result: "unit limitation appears and closes",
    });
    await snapshot("paths-selected", paths);
    await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
    await expect(dock.getByRole("tab", { name: /^Acoustic paths/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      paths.getByRole("complementary", { name: "Selected path details", exact: true }),
    ).toContainText(ids.at(-1)!);
    await snapshot("paths-english", paths);
  });
});

test("path unavailable state is reached through the real atmosphere UI and recovers", async ({
  page,
  browser,
}) => {
  await runAudit(page, browser.version(), "paths-state", async (audit, snapshot) => {
    await page.getByRole("tab", { name: /^聲學路徑/ }).click();
    const paths = page.locator(".paths-panel");
    await expect(paths.locator(".path-table tbody tr")).not.toHaveCount(0);
    await paths.locator(".path-table tbody button").first().click();
    const priorId = await paths.locator(".path-table tr.is-selected button").innerText();
    await page.locator(".listener-row").click();
    const medium = page.getByRole("combobox", { name: "傳播介質", exact: true });
    await medium.selectOption("vacuum");
    await expect(paths).toContainText("空氣聲傳播不可用");
    await expect(paths.locator(".path-table")).toHaveCount(0);
    await expect(paths).toContainText("真空沒有空氣聲傳播");
    await expect(paths).toContainText("先前選取的路徑不在目前結果中");
    await snapshot("vacuum-unavailable", paths);
    audit.checks.push({
      control: "paths.state.vacuum",
      mode: "UI select",
      selectedPathId: priorId,
      result: "no fake path table; unavailable and absent selection explained",
    });
    await medium.focus();
    await medium.press("Home");
    await medium.press("ArrowDown");
    await medium.press("Enter");
    if ((await medium.inputValue()) !== "air") await medium.selectOption("air");
    await expect(medium).toHaveValue("air");
    await expect(paths.locator(".path-table tbody tr")).not.toHaveCount(0);
    await snapshot("air-restored", paths);
    audit.checks.push({
      control: "paths.state.air",
      mode: "keyboard/select",
      result: "solver path table recovers",
    });
    audit.checks.push({
      control: "paths.states.other",
      result: "NOT_OBSERVED",
      reason:
        "pending/stale are transient; solver error/unsupported are not safely reachable with current backend through UI, no forced state/markup",
    });
  });
});

test("comparison controls enforce captured baseline, compare both kinds, update slots and reject geometry changes", async ({
  page,
  browser,
}) => {
  await runAudit(page, browser.version(), "comparison", async (audit, snapshot) => {
    await page.getByRole("tab", { name: "實驗比較", exact: true }).click();
    const panel = page.locator(".comparison-panel");
    const compare = panel.getByRole("button", { name: "檢查並比較", exact: true });
    const kind = panel.getByRole("combobox", { name: "比較類型", exact: true });
    await expect(compare).toBeDisabled();
    await snapshot("empty", panel);
    const emptyCompareHelp = panel.getByRole("button", { name: "說明：檢查並比較", exact: true });
    if (await emptyCompareHelp.count()) {
      await emptyCompareHelp.focus();
      await expect(page.getByRole("tooltip")).toContainText("先保存 A 與 B");
      await emptyCompareHelp.press("Escape");
      audit.checks.push({
        control: "comparison.help.execute",
        state: "missing-slots",
        result: "disabled action help exposes slot requirement via keyboard",
      });
    } else {
      audit.checks.push({
        control: "comparison.help.execute",
        state: "missing-slots",
        result: "NO_SEPARATE_HELP_TRIGGER_OBSERVED",
        description: await compare.getAttribute("aria-describedby"),
      });
    }
    const kindHelp = panel.locator(".comparison-summary .help-tip-trigger").first();
    await kindHelp.hover();
    await expect(page.getByRole("tooltip")).toContainText("聲學 A/B");
    await kindHelp.press("Escape");
    await page.mouse.move(0, 0);
    audit.checks.push({
      control: "comparison.help.kind",
      state: "acoustic",
      mode: "hover/Escape",
      result: "fixed condition description appears",
    });

    await panel.getByRole("button", { name: "保存 A 快照", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("A 必須來自完整錄製");
    audit.checks.push({
      control: "comparison.captureA.empty",
      mode: "pointer",
      result: "rejected",
      alert: await page.getByRole("alert").innerText(),
    });
    await panel.getByRole("button", { name: "保存 B 快照", exact: true }).press("Enter");
    await expect(page.getByRole("alert")).toContainText("請先保存 A");
    audit.checks.push({
      control: "comparison.captureB.noBaseline",
      mode: "keyboard",
      result: "rejected",
      alert: await page.getByRole("alert").innerText(),
    });
    await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
    const render = page.locator(".render-panel");
    await render.getByRole("button", { name: "錄製3秒", exact: true }).click();
    await expect(render.getByRole("button", { name: "產生音檔", exact: true })).toBeEnabled({
      timeout: 60_000,
    });
    await page.getByRole("tab", { name: "實驗比較", exact: true }).click();
    await panel.getByRole("button", { name: "保存 A 快照", exact: true }).click();
    await expect(panel.getByRole("button", { name: "更新 A 快照", exact: true })).toBeVisible();
    await expect(compare).toBeDisabled();
    await panel.getByRole("button", { name: "保存 B 快照", exact: true }).click();
    await expect(panel.getByRole("button", { name: "更新 B 快照", exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(compare).toBeEnabled();
    await kind.selectOption("acoustic");
    await compare.click();
    await expect(panel.getByRole("status")).toContainText("固定條件相符");
    await snapshot("acoustic-matched", panel);
    audit.checks.push({
      control: "comparison.acoustic",
      mode: "pointer",
      result: await panel.getByRole("status").innerText(),
      metrics: await panel.locator(".metric-grid").innerText(),
    });
    await kind.focus();
    await kind.press("End");
    await kind.press("Enter");
    await expect(kind).toHaveValue("behavior");
    await kindHelp.focus();
    await expect(page.getByRole("tooltip")).toContainText("行為 A/B");
    await kindHelp.press("Escape");
    audit.checks.push({
      control: "comparison.help.kind",
      state: "behavior",
      mode: "focus/Escape",
      result: "description follows selected comparison kind",
    });

    await compare.press("Enter");
    await expect(panel.getByRole("status")).toContainText("behavior A/B");
    await snapshot("behavior-matched", panel);
    audit.checks.push({
      control: "comparison.behavior",
      mode: "keyboard",
      result: await panel.getByRole("status").innerText(),
    });
    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="floor"]') })
      .click();
    await page
      .getByRole("combobox", { name: "聲學材質", exact: true })
      .selectOption("material.soft");
    await panel.getByRole("button", { name: "更新 B 快照", exact: true }).click();
    await expect(panel.getByRole("status")).toContainText("B 已重評", { timeout: 60_000 });
    await kind.selectOption("acoustic");
    await compare.click();
    await expect(panel.getByRole("status")).toContainText("固定條件相符");
    audit.checks.push({
      control: "comparison.updateB.material",
      mode: "pointer",
      result: "acoustic independent variable accepted",
    });
    await kind.selectOption("behavior");
    await compare.click();
    await expect(panel.getByRole("status")).toContainText("無法作相同條件比較");
    await snapshot("behavior-material-mismatch", panel);
    audit.checks.push({
      control: "comparison.behavior.invalidCondition",
      result: await panel.getByRole("status").innerText(),
    });
    await panel.getByRole("button", { name: "更新 A 快照", exact: true }).click();
    await expect(panel.getByRole("button", { name: "保存 B 快照", exact: true })).toBeVisible();
    await expect(compare).toBeDisabled();
    audit.checks.push({
      control: "comparison.updateA",
      result: "updates A and clears candidate B; compare disabled",
    });
    await page.locator(".primitive-library button").first().click();
    await panel.getByRole("button", { name: "保存 B 快照", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("重評物件集合必須");
    await expect(compare).toBeDisabled();
    await snapshot("geometry-rejected", page.locator(".analysis-dock"));
    audit.checks.push({
      control: "comparison.captureB.invalidGeometry",
      result: "rejected and B remains absent",
      alert: await page.getByRole("alert").innerText(),
    });
    audit.checks.push({
      control: "comparison.kind.options",
      options: await kind.locator("option").evaluateAll((options) =>
        options.map((item) => ({
          value: (item as HTMLOptionElement).value,
          label: item.textContent,
        })),
      ),
      invalidValueReachability: "native enum only; DOM value not injected",
    });
  });
});
