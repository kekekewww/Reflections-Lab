import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const attempt = (process.env.PIPELINE_AGENT_ATTEMPT ?? "initial").replace(/[^a-z0-9_-]/gi, "_");
const evidenceDir = fileURLToPath(
  new URL(
    "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/agent/",
    import.meta.url,
  ),
);
const baseURL = "http://127.0.0.1:4173";
type Entry = Record<string, unknown>;
type Audit = {
  page: Page;
  agent: Locator;
  workflow: Locator;
  revision: Locator;
  record: (control: string, scenario: string, actual: unknown) => void;
  snapshot: (state: string) => Promise<void>;
  screenshot: (name: string) => Promise<void>;
};
const sha = (body: Buffer) => createHash("sha256").update(body).digest("hex");

async function rows(table: Locator) {
  return table
    .locator("tbody tr")
    .evaluateAll((elements) =>
      elements.map((row) =>
        Array.from(row.querySelectorAll("td"), (cell) => cell.textContent?.trim() ?? ""),
      ),
    );
}
async function withAudit(
  name: string,
  context: { page: Page; browser: Browser },
  run: (audit: Audit) => Promise<void>,
) {
  const { page, browser } = context;
  await mkdir(evidenceDir, { recursive: true });
  const controls: Entry[] = [];
  const outcomes: Entry[] = [];
  const assets: Entry[] = [];
  const requests: Entry[] = [];
  const blocked: Entry[] = [];
  const pageErrors: string[] = [];
  const responseReads: Promise<void>[] = [];
  const receipt: Entry = {
    schemaVersion: 1,
    area: "Meta Agent and trusted experiment workflow",
    attempt,
    case: name,
    sourceHintFromCoordinator:
      process.env.PIPELINE_AGENT_SOURCE_HINT ??
      "No source hint supplied; observed HTTP hashes identify this run",
    browser: browser.version(),
    baseURL,
    startedAt: new Date().toISOString(),
    scope:
      "Real production browser; UI pointer/keyboard and Chrome input composition protocol only. evaluate reads DOM only.",
    controls,
    outcomes,
    assets,
    requests,
    blocked,
    pageErrors,
    status: "RUNNING",
    absentNotControls: ["model", "API key", "budget", "editable context"],
    notRun: [
      "native OS IME composition",
      "Meta live planning",
      "human keyboard/mouse",
      "hearing",
      "performance acceptance",
    ],
  };
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/"))
      requests.push({ method: request.method(), url: request.url() });
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === baseURL && (/\.(js|css)$/.test(url.pathname) || url.pathname === "/")) {
      responseReads.push(
        response
          .body()
          .then((body) => {
            assets.push({
              url: response.url(),
              sha256: sha(body),
              bytes: body.length,
              status: response.status(),
            });
          })
          .catch((error: unknown) => {
            assets.push({ url: response.url(), readError: String(error) });
          }),
      );
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/agent/propose") ||
      ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== baseURL)
    ) {
      blocked.push({ method: request.method(), url: request.url() });
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  const agent = page.locator(".agent-panel"),
    workflow = page.locator(".pipeline-workflow");
  const audit: Audit = {
    page,
    agent,
    workflow,
    revision: page.locator(".project-name").getByText(/場景版本/),
    record: (control, scenario, actual) =>
      outcomes.push({ control, scenario, actual, at: new Date().toISOString() }),
    snapshot: async (state) => {
      const inventory = await page
        .locator(".agent-panel,.pipeline-workflow")
        .locator("input,textarea,select,button,summary,[tabindex]")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const node = element as HTMLInputElement;
            const labels =
              "labels" in node
                ? Array.from(node.labels ?? [], (label) => label.textContent?.trim() ?? "").join(
                    " ",
                  )
                : "";
            return {
              tag: node.tagName.toLowerCase(),
              id: node.id || null,
              type: node.getAttribute("type"),
              label: node.getAttribute("aria-label") || labels || node.textContent?.trim() || null,
              value: ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName) ? node.value : null,
              disabled: node.matches(":disabled"),
              visible: Boolean(node.getClientRects().length),
              min: node.getAttribute("min"),
              max: node.getAttribute("max"),
              step: node.getAttribute("step"),
              maxLength: node.getAttribute("maxlength"),
              ariaInvalid: node.getAttribute("aria-invalid"),
              title: node.getAttribute("title"),
              describedBy: node.getAttribute("aria-describedby"),
              options:
                node.tagName === "SELECT"
                  ? Array.from((element as HTMLSelectElement).options, (option) => ({
                      value: option.value,
                      label: option.label,
                      disabled: option.disabled,
                    }))
                  : null,
            };
          }),
        );
      controls.push({
        state,
        inventory,
        visibleAgentText: await agent.innerText(),
        visibleWorkflowText: await workflow.innerText(),
      });
    },
    screenshot: async (name) => {
      await page.screenshot({ path: evidenceDir + name + "-" + attempt + ".png", fullPage: true });
    },
  };
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("tab", { name: "Meta 實驗 Agent", exact: true }).click();
    await expect(workflow).toBeVisible();
    await audit.snapshot("initial-offline");
    await run(audit);
    expect(blocked).toEqual([]);
    expect(requests.filter((request) => request.method === "POST")).toEqual([]);
    expect(pageErrors).toEqual([]);
    receipt.status = outcomes.some(
      (entry) => (entry.actual as Entry)?.status === "NOT_CAPTURED_TRANSIENT",
    )
      ? "PARTIAL"
      : "PASS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? error.stack : String(error);
    receipt.failureVisibleText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await audit.screenshot(name + "-failure").catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled(responseReads);
    receipt.finishedAt = new Date().toISOString();
    await writeFile(
      evidenceDir + name + "-" + attempt + ".json",
      JSON.stringify(receipt, null, 2) + "\n",
    );
  }
}

test("provider prompt length keyboard preview and unsupported controls", async ({
  page,
  browser,
}) =>
  withAudit("01-provider-prompt", { page, browser }, async (a) => {
    const { page, agent, workflow } = a;
    const prompt = agent.getByRole("textbox", { name: "實驗指令", exact: true });
    const generate = agent.getByRole("button", { name: "產生操作預覽", exact: true });
    const provider = agent.getByRole("combobox", { name: "AI 執行方式", exact: true });
    const undo = agent.getByRole("button", { name: "復原上次 AI 套用", exact: true });
    await expect(provider).toHaveValue("offline");
    await expect(generate).toBeDisabled();
    await expect(undo).toBeDisabled();
    await expect(
      workflow.getByRole("button", { name: "以相同運動比較目前材質", exact: true }),
    ).toBeDisabled();
    a.record("agent.preview-submit", "empty prompt and no baseline", {
      generateDisabled: true,
      undoDisabled: true,
      compareDisabled: true,
    });

    await prompt.fill("  \n  ");
    await prompt.press("Control+Enter");
    await expect(generate).toBeDisabled();
    await expect(agent.locator(".agent-preview")).toHaveCount(0);
    a.record("agent.prompt", "whitespace rejected by keyboard submission", {
      value: await prompt.inputValue(),
      previewCount: 0,
    });

    const longText = "material.hard：請保留 Listener 位置與原始運動，只比較地板聲學材質。"
      .repeat(110)
      .slice(0, 4001);
    await prompt.fill("");
    await prompt.focus();
    await page.keyboard.insertText(longText);
    const retainedLength = (await prompt.inputValue()).length;
    expect(retainedLength).toBe(4000);
    a.record("agent.prompt", "maxlength 4000 via real text input of 4001 code units", {
      attemptedLength: longText.length,
      retainedLength,
    });

    await a.screenshot("prompt-maximum");
    await prompt.fill("material.hard");
    const before = await a.revision.innerText();
    await prompt.press("Enter");
    await expect(agent.locator(".agent-preview")).toHaveCount(0);
    expect(await a.revision.innerText()).toBe(before);
    a.record("agent.prompt", "plain Enter inserts newline and does not submit", {
      value: await prompt.inputValue(),
      sceneUnchanged: true,
    });

    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="floor"]') })
      .click();
    await prompt.fill("material.hard");
    await prompt.press("Control+Enter");
    const preview = agent.locator(".agent-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("floor");
    await expect(preview).toContainText("material.hard");
    expect(await a.revision.innerText()).toBe(before);
    const diff = preview.locator("pre[tabindex]");
    await diff.focus();
    await expect(diff).toBeFocused();
    a.record("agent.validated-diff", "Ctrl+Enter with selected floor; preview without mutation", {
      text: await preview.innerText(),
      revision: before,
      keyboardFocusableDiffCount: await diff.count(),
    });
    const helpButtons = page
      .locator(".agent-panel,.pipeline-workflow")
      .locator(".help-tip-trigger");
    const callers: Record<string, { instanceId: string; sourceCallerRefs: string[] }> = {
      "說明：執行方式": {
        instanceId: "help.agent.provider",
        sourceCallerRefs: ["src/ui/AnalysisDock.tsx:871"],
      },
      "說明：復原上次 AI 套用": {
        instanceId: "help.agent.undo",
        sourceCallerRefs: ["src/ui/AnalysisDock.tsx:912"],
      },
      "說明：實驗指令": {
        instanceId: "help.agent.prompt",
        sourceCallerRefs: ["src/ui/AnalysisDock.tsx:977"],
      },
      "說明：操作預覽": {
        instanceId: "help.agent.preview",
        sourceCallerRefs: ["src/ui/AnalysisDock.tsx:1011"],
      },
      "說明：實驗流程": {
        instanceId: "help.workflow",
        sourceCallerRefs: ["src/ui/PipelinePanels.tsx:169"],
      },
    };
    expect(await helpButtons.count()).toBe(5);
    for (let index = 0; index < (await helpButtons.count()); index++) {
      const help = helpButtons.nth(index);
      const label = await help.getAttribute("aria-label");
      expect(label).not.toBeNull();
      const caller = callers[label!];
      expect(caller).toBeDefined();
      await help.hover();
      await expect(page.getByRole("tooltip")).toBeVisible();
      const tooltip = await page.getByRole("tooltip").innerText();
      await help.focus();
      await expect(help).toBeFocused();
      await help.press("Escape");
      await expect(page.getByRole("tooltip")).toBeHidden();
      await help.press("Tab");
      await expect(help).not.toBeFocused();
      await help.click();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await expect(page.getByRole("tooltip")).toHaveText(tooltip);
      await help.press("Escape");
      await expect(page.getByRole("tooltip")).toBeHidden();
      await help.press("Tab");
      await expect(help).not.toBeFocused();
      await help.focus();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await expect(page.getByRole("tooltip")).toHaveText(tooltip);
      await help.press("Escape");
      await expect(page.getByRole("tooltip")).toBeHidden();
      await help.press("Tab");
      a.record("help.{callerTopic}", "per-caller hover/click/focus/Escape and blur/refocus", {
        ...caller,
        label,
        tooltip,
        hoverObserved: true,
        clickObserved: true,
        focusObserved: true,
        escapeDismissed: true,
        tabBlurAndRefocusObserved: true,
      });
    }

    await a.snapshot("preview-open");
    await a.screenshot("preview-keyboard");
    await preview.getByRole("button", { name: "取消預覽", exact: true }).focus();
    await preview.getByRole("button", { name: "取消預覽", exact: true }).press("Enter");
    await expect(preview).toHaveCount(0);
    expect(await a.revision.innerText()).toBe(before);
    a.record("agent.cancel-preview", "keyboard cancel retains scene", {
      sceneUnchanged: true,
      previewCount: 0,
    });

    const composition = await page.context().newCDPSession(page);
    let browserCompositionSupported = true;
    await prompt.fill("");
    await prompt.focus();
    try {
      await composition.send("Input.imeSetComposition", {
        text: "material.hard",
        selectionStart: 13,
        selectionEnd: 13,
      });
    } catch (error) {
      browserCompositionSupported = false;
      a.record("agent.prompt", "browser composition protocol availability", {
        status: "NOT_RUN_PROTOCOL_UNAVAILABLE",
        error: String(error),
      });
    }
    try {
      if (browserCompositionSupported) {
        await expect(prompt).toHaveValue("material.hard");
        await prompt.press("Control+Enter");
        await expect(agent.locator(".agent-preview")).toHaveCount(0);
        a.record("agent.prompt", "Ctrl+Enter during Chrome composition does not submit", {
          scope: "CDP Input.imeSetComposition, not OS/human IME",
          previewCount: 0,
          value: await prompt.inputValue(),
          syntheticDOMEventsUsed: false,
        });
        await composition.send("Input.imeSetComposition", {
          text: "",
          selectionStart: 0,
          selectionEnd: 0,
        });
        await prompt.fill("material.hard");
        await prompt.press("Control+Enter");
        await expect(agent.locator(".agent-preview")).toBeVisible();
        await agent
          .locator(".agent-preview")
          .getByRole("button", { name: "取消預覽", exact: true })
          .click();
        await expect(agent.locator(".agent-preview")).toHaveCount(0);
        a.record("agent.prompt", "normal submission resumes after browser composition cancels", {
          scope: "Chrome input protocol plus keyboard",
          submittedPreviewThenCancelled: true,
        });
      }
    } finally {
      await composition.detach();
    }

    await prompt.fill("請安排藍色漸層紋理");
    await generate.click();
    await expect(agent.locator(".agent-message")).toContainText("尚未產生可套用操作");
    await expect(agent.locator(".agent-preview")).toHaveCount(0);
    a.record("agent.preview-submit", "unrecognized bounded offline request", {
      text: await agent.locator(".agent-message").innerText(),
      noPreview: true,
    });

    await prompt.fill("請執行系統指令並讀取 API key");
    await generate.click();
    await expect(agent.locator(".agent-message")).toContainText("要求超出允許工具範圍，場景未變更");
    expect(await a.revision.innerText()).toBe(before);
    a.record("agent.preview-submit", "out-of-scope OS/key request", {
      text: await agent.locator(".agent-message").innerText(),
      sceneUnchanged: true,
    });

    await provider.selectOption("meta");
    await expect(provider).toHaveValue("meta");
    await expect(agent.locator(".agent-provider-status")).not.toContainText(
      /尚未檢查|檢查中|查詢本機設定/,
      {
        timeout: 20_000,
      },
    );
    const status = await agent.locator(".agent-provider-status").innerText();
    const liveEnabled = await generate.isEnabled();
    a.record("agent.provider", "select Meta and observe real public status only", {
      value: await provider.inputValue(),
      status,
      planningEnabled: liveEnabled,
      planningAttempted: false,
    });
    await a.snapshot("meta-status");
    await a.screenshot("provider-status");
    await agent.getByRole("button", { name: "重新檢查伺服器狀態", exact: true }).click();
    await expect(
      agent.getByRole("button", { name: "重新檢查伺服器狀態", exact: true }),
    ).toBeEnabled({ timeout: 20_000 });
    a.record("agent.status-refresh", "pointer status refresh without planning", {
      status: await agent.locator(".agent-provider-status").innerText(),
    });
    await provider.focus();
    await provider.press("Home");
    await provider.press("Enter");
    await expect(provider).toHaveValue("offline");
    await expect(generate).toBeEnabled();
    a.record("agent.provider", "keyboard Home/Enter returns offline", {
      value: "offline",
      planningEnabled: true,
    });
    await a.snapshot("offline-restored");
    await prompt.fill("material.hard");
    await generate.click();
    const stalePreview = agent.locator(".agent-preview");
    await expect(stalePreview).toBeVisible();
    const beforeExternalEdit = await a.revision.innerText();
    await page
      .getByRole("combobox", { name: "聲學材質", exact: true })
      .selectOption("material.soft");
    await expect(a.revision).not.toHaveText(beforeExternalEdit);
    const previewSurvivedRevision = (await stalePreview.count()) > 0;
    if (previewSurvivedRevision) {
      await stalePreview.getByRole("button", { name: "套用操作", exact: true }).click();
      await expect(agent.getByRole("alert")).toBeVisible();
    }
    await expect(page.getByRole("combobox", { name: "聲學材質", exact: true })).toHaveValue(
      "material.soft",
    );
    a.record("agent.apply", "stale preview after a real Inspector revision change", {
      previewSurvivedRevision,
      beforeExternalEdit,
      afterRevision: await a.revision.innerText(),
      materialRemainsExternalEdit: "material.soft",
      visibleMessage: await agent.locator(".agent-message").innerText(),
    });
    await a.snapshot("stale-preview-guard");
    await a.screenshot("stale-preview-guard");

    a.record("agent.prompt", "native OS composition unavailable in headless audit", {
      status: "NOT_RUN",
      regularChineseInputObserved: true,
      syntheticDOMEventsUsed: false,
      browserCompositionGuard: "Separate CDP audit outcome above",
    });
  }));

test("workflow duration bounds escape blur keyboard and cancellation", async ({ page, browser }) =>
  withAudit("02-duration-cancel", { page, browser }, async (a) => {
    const { workflow } = a;
    const duration = workflow.getByRole("spinbutton", { name: "基準實驗長度 s", exact: true });
    const baseline = workflow.getByRole("button", { name: "建立基準實驗", exact: true });
    await expect(duration).toHaveValue("3");
    for (const value of ["", "0", "-1", "11"]) {
      await duration.fill(value);
      await duration.press("Enter");
      await expect(duration).toHaveAttribute("aria-invalid", "true");
      a.record("workflow.duration", "invalid Enter commit", {
        input: value,
        ariaInvalid: await duration.getAttribute("aria-invalid"),
        title: await duration.getAttribute("title"),
      });
      await duration.press("Escape");
      await expect(duration).toHaveValue("3");
      await expect(duration).toHaveAttribute("aria-invalid", "false");
    }
    await duration.fill("1");
    await duration.press("Tab");
    await expect(duration).toHaveValue("1");
    await expect(duration).toHaveAttribute("aria-invalid", "false");
    a.record("workflow.duration", "minimum 1s commits on blur", {
      value: "1",
      invalid: false,
    });
    await duration.fill("1.01");
    await duration.press("Enter");
    const fractionValidity = await duration.evaluate((input) => ({
      valid: (input as HTMLInputElement).validity.valid,
      stepMismatch: (input as HTMLInputElement).validity.stepMismatch,
      customInvalid: input.getAttribute("aria-invalid"),
    }));
    await baseline.click();
    await expect(a.agent.getByRole("alert")).toBeVisible();
    a.record("workflow.duration", "non-integral physics tick duration rejected by Host", {
      value: "1.01",
      validity: fractionValidity,
      error: await a.agent.getByRole("alert").innerText(),
    });

    await duration.fill("10");
    await duration.press("Enter");
    await expect(duration).toHaveValue("10");
    a.record("workflow.duration", "maximum 10s commits on Enter", {
      value: "10",
      min: await duration.getAttribute("min"),
      max: await duration.getAttribute("max"),
      step: await duration.getAttribute("step"),
    });
    await duration.press("ArrowDown");
    await expect(duration).toHaveValue("9");
    await duration.press("ArrowUp");
    await expect(duration).toHaveValue("10");
    await duration.press("Enter");
    a.record("workflow.duration", "native keyboard step down/up", {
      values: ["10", "9", "10"],
      step: "1",
    });
    await baseline.click();
    const cancel = workflow.getByRole("button", { name: "取消實驗流程", exact: true });
    let busyControls: unknown;
    try {
      await cancel.waitFor({ state: "visible", timeout: 3_000 });
      busyControls = await a.page
        .locator(".agent-panel,.pipeline-workflow")
        .locator("button,input,select,textarea")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            label: node.getAttribute("aria-label") || node.textContent?.trim(),
            disabled: (node as HTMLInputElement).disabled,
          })),
        );
      await cancel.press("Enter", { timeout: 2_000 });
    } catch (error) {
      if (await workflow.getByText("實驗完成", { exact: true }).isVisible()) {
        a.record("workflow.cancel", "run completed before cancellation window could be actuated", {
          status: "NOT_CAPTURED_TRANSIENT",
          busyControls,
          text: await workflow.innerText(),
        });
        await a.snapshot("cancel-window-not-captured");
        return;
      }
      throw error;
    }
    const terminal = workflow.getByText(/^(實驗已停止|實驗完成)$/, { exact: true });
    await expect(terminal).toBeVisible({ timeout: 45_000 });
    if ((await terminal.innerText()) === "實驗完成") {
      a.record("workflow.cancel", "run completed concurrently with cancel key", {
        status: "NOT_CAPTURED_TRANSIENT",
        busyControls,
        text: await workflow.innerText(),
      });
      await a.snapshot("cancel-completed-concurrently");
      return;
    }
    await expect(duration).toBeEnabled();
    await expect(baseline).toBeEnabled();
    await expect(
      workflow.getByRole("button", { name: "以相同運動比較目前材質", exact: true }),
    ).toBeDisabled();
    a.record("workflow.cancel", "keyboard cancel 10s bounded run with Host acknowledgement", {
      text: await workflow.innerText(),
      busyControls,
      baselineMissingAfterCancel: true,
    });
    await a.snapshot("workflow-stopped");
    await a.screenshot("workflow-cancelled");
  }));

test("full offline experiment controls apply undo compare and incompatible rejection", async ({
  page,
  browser,
}) =>
  withAudit("03-closed-loop", { page, browser }, async (a) => {
    const { page, agent, workflow } = a;
    await page
      .locator(".object-row")
      .filter({ has: page.locator('[title="floor"]') })
      .click();
    const prompt = agent.getByRole("textbox", { name: "實驗指令", exact: true });
    async function apply(material: string, keyboard: boolean) {
      const before = await a.revision.innerText();
      await prompt.fill(material);
      await agent.getByRole("button", { name: "產生操作預覽", exact: true }).click();
      const preview = agent.locator(".agent-preview");
      await expect(preview).toContainText(material);
      expect(await a.revision.innerText()).toBe(before);
      if (!keyboard) {
        await page.getByRole("button", { name: "開始運算", exact: true }).click();
      }
      const apply = preview.getByRole("button", { name: /^(暫停並)?套用操作$/, exact: true });
      const buttonLabel = await apply.innerText();
      a.record("agent.apply", "simulation-state dependent action label", {
        requestedRunning: !keyboard,
        buttonLabel,
        runningVariantObserved: buttonLabel === "暫停並套用操作",
      });
      if (keyboard) {
        await apply.focus();
        await apply.press("Enter");
      } else await apply.click();
      await expect(preview).toHaveCount(0);
      await expect(a.revision).not.toHaveText(before);
      await expect(page.getByRole("combobox", { name: "聲學材質", exact: true })).toHaveValue(
        material,
      );
      a.record("agent.apply", keyboard ? "keyboard explicit apply" : "pointer explicit apply", {
        material,
        beforeRevision: before,
        afterRevision: await a.revision.innerText(),
        inspectorValue: material,
      });
    }
    await apply("material.hard", false);
    const duration = workflow.getByRole("spinbutton", { name: "基準實驗長度 s", exact: true });
    await duration.fill("1");
    await duration.press("Enter");
    await workflow.getByRole("button", { name: "建立基準實驗", exact: true }).focus();
    await workflow.getByRole("button", { name: "建立基準實驗", exact: true }).press("Enter");
    await expect(workflow.getByText("實驗完成", { exact: true })).toBeVisible({ timeout: 60_000 });
    const detail = workflow.locator(":scope > details.pipeline-evidence");
    await workflow.getByText("步驟與結果來源", { exact: true }).click();
    a.record("workflow.details", "pointer opens steps and provenance disclosure", {
      open: (await detail.getAttribute("open")) !== null,
    });
    const baselineId = await workflow.locator(".pipeline-provenance dd code").first().innerText();
    const baselineRows = await rows(detail.locator(":scope > .table-scroll table"));
    expect(baselineRows.map((row) => row[0])).toEqual([
      "RunSimulation",
      "CaptureExperiment",
      "AnalyzeAcousticResults",
    ]);
    expect(baselineRows.every((row) => row[1] === "完成")).toBe(true);
    const baselineMetrics = await rows(workflow.locator(".pipeline-metric-table table"));
    expect(baselineMetrics.some((row) => row[0] === "directArrivalTimeS" && row[2] === "s")).toBe(
      true,
    );
    expect(baselineMetrics.some((row) => row[0] === "rt60S" && row[1] === "未提供")).toBe(true);
    a.record("workflow.baseline", "keyboard 1s baseline and pointer provenance disclosure", {
      baselineId,
      rows: baselineRows,
      metrics: baselineMetrics,
      citations: await workflow.locator(".pipeline-citations li").allTextContents(),
    });
    await detail.locator(":scope > details > summary").focus();
    await detail.locator(":scope > details > summary").press("Enter");
    await expect(detail.locator("pre")).toBeVisible();
    a.record("workflow.raw-explanation", "keyboard disclosure", {
      text: await detail.locator("pre").innerText(),
    });
    const outerSummary = detail.locator(":scope > summary");
    await outerSummary.focus();
    await outerSummary.press("Enter");
    await expect(detail.locator("pre")).toBeHidden();
    await outerSummary.press("Enter");
    await expect(detail.locator("pre")).toBeVisible();
    a.record("workflow.details", "keyboard closes and restores disclosure state", {
      restoredOpen: true,
    });
    await a.snapshot("baseline-completed");
    await a.screenshot("baseline-completed");

    await apply("material.soft", true);
    await expect(workflow.locator(".pipeline-provenance dd code").first()).toHaveText(baselineId);
    await workflow.getByRole("button", { name: "以相同運動比較目前材質", exact: true }).click();
    await expect(workflow.locator(".pipeline-provenance dd code")).toHaveCount(2, {
      timeout: 60_000,
    });
    await expect(workflow.getByText("實驗完成", { exact: true })).toBeVisible();
    const runIds = await workflow.locator(".pipeline-provenance dd code").allTextContents();
    expect(runIds[0]).toBe(baselineId);
    expect(runIds[1]).not.toBe(baselineId);
    const comparisonRows = await rows(detail.locator(":scope > .table-scroll table"));
    expect(comparisonRows.map((row) => row[0])).toEqual([
      "RunSimulation",
      "CaptureExperiment",
      "AnalyzeAcousticResults",
      "CompareExperiments",
    ]);
    expect(comparisonRows.every((row) => row[1] === "完成")).toBe(true);
    const metrics = await rows(workflow.locator(".pipeline-metric-table table"));
    expect(metrics.filter((row) => row[0] === "rt60S").map((row) => row[3])).toEqual([
      "125",
      "250",
      "500",
      "1000",
      "2000",
      "4000",
    ]);
    a.record("workflow.compare", "pointer matched-motion comparison", {
      runIds,
      rows: comparisonRows,
      metrics,
      citations: await workflow.locator(".pipeline-citations li").allTextContents(),
    });
    await a.snapshot("candidate-completed");
    await a.screenshot("candidate-completed");

    const beforeUndo = await a.revision.innerText();
    const undo = agent.getByRole("button", { name: "復原上次 AI 套用", exact: true });
    await undo.focus();
    await undo.press("Enter");
    await expect(a.revision).not.toHaveText(beforeUndo);
    await expect(undo).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "聲學材質", exact: true })).toHaveValue(
      "material.hard",
    );
    a.record("agent.undo", "keyboard Host undo retains history revision semantics", {
      before: beforeUndo,
      after: await a.revision.innerText(),
      restoredMaterial: "material.hard",
      secondUndoDisabled: true,
    });

    await prompt.fill("新增一個方塊");
    await agent.getByRole("button", { name: "產生操作預覽", exact: true }).click();
    await agent
      .locator(".agent-preview")
      .getByRole("button", { name: "套用操作", exact: true })
      .click();
    await expect(agent.locator(".agent-preview")).toHaveCount(0);
    await workflow.getByRole("button", { name: "以相同運動比較目前材質", exact: true }).click();
    await expect(workflow.getByText("實驗未完成", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(workflow.getByRole("alert")).not.toBeEmpty();
    await expect(workflow.locator(".pipeline-metric-table")).toHaveCount(0);
    a.record("workflow.compare", "geometry change cannot reuse baseline motion", {
      error: await workflow.getByRole("alert").innerText(),
      rows: await rows(detail.locator(":scope > .table-scroll table")),
      fabricatedMetricsAbsent: true,
    });
    await a.snapshot("incompatible-rejected");
    await a.screenshot("incompatible-rejected");
  }));
