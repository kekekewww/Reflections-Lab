import { expect, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected JSON object");
  return value as JsonObject;
}
export function list(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) throw new Error("Expected JSON object array");
  return value.map(object);
}
export const attempt = process.env.PIPELINE_ZONES_ATTEMPT ?? "unassigned";
if (!/^[a-z0-9-]+$/.test(attempt)) throw new Error("Invalid zone audit attempt");
export const evidenceDir = fileURLToPath(
  new URL(
    "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/zones/" + attempt + "/",
    import.meta.url,
  ),
);
export const cacheDir = fileURLToPath(
  new URL("../../../.cache/parameter-audit-pipeline-zones/" + attempt + "/", import.meta.url),
);
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export const zonePanel = (page: Page) => page.locator(".zone-panel");
export const zoneForm = (page: Page) => zonePanel(page).locator("form");
export const zoneRow = (page: Page, id: string) =>
  zonePanel(page)
    .getByRole("listitem")
    .filter({ has: page.getByText(id, { exact: true }) });
export const zoneInput = (page: Page, label: string) =>
  zoneForm(page).getByRole("spinbutton", { name: new RegExp("^" + label + "\\s*m$") });
export const sceneRevision = (page: Page) => page.locator(".project-name").getByText(/場景版本/);
export const transport = (page: Page) => page.locator(".transport-bar");

export async function inventory(scope: Locator) {
  return scope.evaluate((root) =>
    Array.from(root.querySelectorAll("button,input,select,summary,[tabindex]")).map((node) => {
      const input = node as HTMLInputElement;
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(),
        type: node.getAttribute("type"),
        role: node.getAttribute("role"),
        label:
          node.getAttribute("aria-label") ||
          (input.labels
            ? Array.from(input.labels, (label) => label.textContent?.trim() ?? "").join(" ")
            : "") ||
          node.textContent?.trim() ||
          "",
        value: "value" in node ? input.value : null,
        checked: "checked" in node ? input.checked : null,
        disabled: "disabled" in node ? input.disabled : null,
        min: node.getAttribute("min"),
        max: node.getAttribute("max"),
        step: node.getAttribute("step"),
        maxLength: node.getAttribute("maxlength"),
        invalid: node.getAttribute("aria-invalid"),
        visible: rect.width > 0 && rect.height > 0,
        options:
          node instanceof HTMLSelectElement
            ? Array.from(node.options, (option) => ({
                value: option.value,
                label: option.textContent,
                disabled: option.disabled,
                selected: option.selected,
              }))
            : null,
      };
    }),
  );
}

export interface Audit {
  scenario: string;
  actions: { id: string; result: unknown }[];
  artifacts: { label: string; filename: string; path: string; sha256: string; bytes: number }[];
  snapshots: unknown[];
  record(id: string, result: unknown): void;
  snapshot(state: string, scope?: Locator): Promise<void>;
}
export async function runAudit(
  page: Page,
  scenario: string,
  action: (audit: Audit) => Promise<void>,
) {
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const actions: Audit["actions"] = [],
    artifacts: Audit["artifacts"] = [],
    snapshots: unknown[] = [];
  const assets: unknown[] = [],
    blocked: string[] = [],
    agentRequests: string[] = [],
    pageErrors: string[] = [];
  const responseJobs: Promise<void>[] = [];
  const receipt: JsonObject = {
    schemaVersion: 1,
    scenario,
    attempt,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    browser: page.context().browser()?.version(),
    rootReportedCandidate: process.env.PIPELINE_ZONES_CANDIDATE ?? null,
    method:
      "Real production DOM pointer/keyboard/file upload/download; evaluate only reads DOM. No HostInternal/bridge.",
    notVerified: ["human or OS input", "hearing", "Meta live", "performance acceptance"],
    actions,
    artifacts,
    snapshots,
    assets,
    blocked,
    agentRequests,
    pageErrors,
  };
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/"))
      agentRequests.push(request.method() + " " + request.url());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      (url.pathname === "/" || /\.(js|css)$/.test(url.pathname))
    ) {
      responseJobs.push(
        response
          .body()
          .then((bytes) => {
            assets.push({ url: response.url(), bytes: bytes.length, sha256: sha256(bytes) });
          })
          .catch(() => {}),
      );
    }
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const external = /^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:4173";
    if (external || url.pathname.startsWith("/api/agent/propose")) {
      blocked.push(route.request().method() + " " + route.request().url());
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  const audit: Audit = {
    scenario,
    actions,
    artifacts,
    snapshots,
    record: (id, result) => actions.push({ id, result }),
    snapshot: async (state, scope = zonePanel(page)) => {
      snapshots.push({ state, text: await scope.innerText(), controls: await inventory(scope) });
      await page.screenshot({
        path: join(evidenceDir, scenario + "-" + state + ".png"),
        fullPage: true,
      });
    },
  };
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("tab", { name: "區域", exact: true }).click();
    await expect(zonePanel(page)).toBeVisible();
    await action(audit);
    expect(blocked).toEqual([]);
    expect(agentRequests.filter((value) => value.startsWith("POST "))).toEqual([]);
    expect(pageErrors).toEqual([]);
    receipt.status = "PASS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? error.stack : String(error);
    receipt.failureBody = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await audit.snapshot("failure", page.locator(".analysis-dock")).catch(() => {});
    throw error;
  } finally {
    await Promise.allSettled(responseJobs);
    receipt.finishedAt = new Date().toISOString();
    await writeFile(
      join(evidenceDir, scenario + "-receipt.json"),
      JSON.stringify(receipt, null, 2) + "\n",
    );
  }
}

export async function downloadJson(
  page: Page,
  audit: Audit,
  label: string,
  click: () => Promise<unknown>,
) {
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Unsafe artifact label");
  const pending = page.waitForEvent("download");
  await click();
  const download = await pending;
  const file = join(cacheDir, audit.scenario + "-" + label + ".json");
  await download.saveAs(file);
  const bytes = await readFile(file);
  audit.artifacts.push({
    label,
    filename: download.suggestedFilename(),
    path: file,
    sha256: sha256(bytes),
    bytes: bytes.length,
  });
  return object(JSON.parse(bytes.toString("utf8")));
}
export const exportProject = (page: Page, audit: Audit, label: string) =>
  downloadJson(page, audit, label, () =>
    page.getByRole("button", { name: "匯出專案", exact: true }).click(),
  );
export async function importProject(page: Page, project: JsonObject, accepted = true) {
  await page.getByRole("button", { name: "匯入專案 JSON", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "匯入專案 JSON", exact: true });
  await dialog
    .getByRole("button", { name: "套用並開啟專案", exact: true })
    .isDisabled()
    .then((disabled) => expect(disabled).toBe(true));
  await dialog
    .getByRole("button", { name: "取消匯入", exact: true })
    .isEnabled()
    .then((enabled) => expect(enabled).toBe(true));
  await dialog.getByLabel("選擇專案 JSON 檔案", { exact: true }).setInputFiles({
    name: "zone-authoring-audit.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  const apply = dialog.getByRole("button", { name: "套用並開啟專案", exact: true });
  await expect(apply).toBeEnabled();
  await apply.click();
  if (accepted) await expect(dialog).toBeHidden({ timeout: 30_000 });
  else {
    await expect(dialog.getByRole("alert")).not.toBeEmpty();
    const error = await dialog.getByRole("alert").innerText();
    await dialog.getByRole("button", { name: "取消匯入", exact: true }).click();
    return error;
  }
  return null;
}

export interface ZoneSpec {
  id: string;
  name: string;
  enabled: boolean;
  shape: "aabb" | "sphere";
  centerM: number[];
  hysteresisM: number;
  halfExtentsM?: number[];
  radiusM?: number;
}
export const crossingZone: ZoneSpec = {
  id: "zone.browser",
  name: "跨界測試區域",
  enabled: true,
  shape: "aabb",
  centerM: [-0.8, 1, 0],
  halfExtentsM: [0.5, 0.4, 0.5],
  hysteresisM: 0.02,
};
export async function addZone(page: Page, zone: ZoneSpec) {
  await page.getByRole("tab", { name: "區域", exact: true }).click();
  await zonePanel(page).getByRole("button", { name: "新增區域", exact: true }).click();
  const form = zoneForm(page);
  await form.getByRole("textbox", { name: "區域 ID", exact: true }).fill(zone.id);
  await form.getByRole("textbox", { name: "名稱", exact: true }).fill(zone.name);
  await form.getByRole("combobox", { name: "形狀", exact: true }).selectOption(zone.shape);
  for (const [index, axis] of ["X", "Y", "Z"].entries()) {
    await zoneInput(page, "中心位置 " + axis).fill(String(zone.centerM[index]));
    if (zone.shape === "aabb")
      await zoneInput(page, "半尺寸 " + axis).fill(String(zone.halfExtentsM![index]));
  }
  if (zone.shape === "sphere") await zoneInput(page, "半徑").fill(String(zone.radiusM));
  await zoneInput(page, "邊界遲滯").fill(String(zone.hysteresisM));
  await form.getByRole("checkbox", { name: "啟用", exact: true }).setChecked(zone.enabled);
  await form.getByRole("button", { name: "儲存區域", exact: true }).click();
  await expect(form).toBeHidden();
  await expect(zoneRow(page, zone.id)).toBeVisible();
}
export async function editZone(page: Page, id: string) {
  await page.getByRole("tab", { name: "區域", exact: true }).click();
  await zoneRow(page, id)
    .getByRole("button", { name: /^編輯 / })
    .click();
  await expect(
    zoneForm(page).getByRole("textbox", { name: "區域 ID", exact: true }),
  ).toBeDisabled();
}
export async function selectBall(page: Page) {
  await page
    .locator(".object-row")
    .filter({ has: page.getByText("ball", { exact: true }) })
    .click();
}
export async function addZoneRule(
  page: Page,
  type: "OnEnterZone" | "OnExitZone",
  zoneId = crossingZone.id,
  audit?: Audit,
) {
  const before = await page.locator(".behavior-card .rule-identity code").allTextContents();
  const row = page.locator(".add-rule-row");
  const option = row.locator('option[value="' + type + '"]');
  const disabled = await option.isDisabled();
  audit?.record("behavior.newZoneId.capability", {
    type,
    zoneId,
    optionDisabled: disabled,
    method: "actual DOM disabled read before selectOption",
  });
  if (disabled)
    throw new Error(
      "ENABLED_ZONE_CAPABILITY_LOCKED: " +
        type +
        " remains disabled after authoring enabled " +
        zoneId,
    );
  await expect(option).toBeEnabled();
  await row.getByRole("combobox", { name: "新增行為觸發條件", exact: true }).selectOption(type);
  const zone = row.getByRole("combobox", { name: "事件區域", exact: true });
  await zone.selectOption("");
  await expect(row.getByRole("button", { name: "新增", exact: true })).toBeDisabled();
  await zone.selectOption(zoneId);
  await row.getByRole("button", { name: "新增", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.locator(".behavior-card .rule-identity code").allTextContents()).length,
    )
    .toBe(before.length + 1);
  const ids = await page.locator(".behavior-card .rule-identity code").allTextContents();
  const id = ids.find((value) => !before.includes(value));
  if (!id) throw new Error("No new visible stable rule ID");
  return id;
}
export const ruleCard = (page: Page, id: string) =>
  page.locator(".behavior-card").filter({ has: page.getByText(id, { exact: true }) });
export async function capture(page: Page) {
  await page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
  const render = page.locator(".render-panel");
  await render.getByRole("button", { name: "錄製3秒", exact: true }).click();
  await expect(render.getByRole("button", { name: "產生音檔", exact: true })).toBeEnabled({
    timeout: 60_000,
  });
}
export async function exportRecording(page: Page, audit: Audit, label: string) {
  await page.getByRole("tab", { name: /^事件與錄放/ }).click();
  return downloadJson(page, audit, label, () =>
    page
      .locator(".events-panel")
      .getByRole("button", { name: "匯出已封存錄製", exact: true })
      .click(),
  );
}
export function zoneEvents(artifact: JsonObject) {
  return list(artifact.frames)
    .flatMap((frame) => list(frame.physicsEvents))
    .filter((event) => event.source === "zone" && event.zoneId === crossingZone.id);
}

export async function probeHelp(
  page: Page,
  audit: Audit,
  trigger: Locator,
  sourceCallsiteRef: JsonObject,
  expected: string,
) {
  await page.mouse.move(0, 0);
  await trigger.press("Tab");
  await expect(trigger).not.toBeFocused();
  await trigger.focus();
  await expect(page.getByRole("tooltip")).toContainText(expected);
  const focusTooltip = page.getByRole("tooltip");
  const focusId = await focusTooltip.getAttribute("id");
  const describedBy = await trigger.getAttribute("aria-describedby");
  expect(describedBy?.split(/\s+/)).toContain(focusId);
  audit.record("help.caller", {
    method: "focus/Escape",
    sourceCallsiteRef,
    label: await trigger.getAttribute("aria-label"),
    describedBy,
    tooltipId: focusId,
    text: await focusTooltip.innerText(),
  });
  await trigger.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await trigger.press("Tab");
  await page.mouse.move(0, 0);
  await trigger.click();
  await expect(page.getByRole("tooltip")).toContainText(expected);
  const clickTooltip = page.getByRole("tooltip");
  audit.record("help.caller", {
    method: "pointer click/Escape",
    sourceCallsiteRef,
    describedBy: await trigger.getAttribute("aria-describedby"),
    tooltipId: await clickTooltip.getAttribute("id"),
    text: await clickTooltip.innerText(),
  });
  await trigger.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
}

export async function selectEventById(
  page: Page,
  audit: Audit,
  panel: Locator,
  eventId: string,
  eventType: string,
  phase: string,
) {
  await panel.getByRole("searchbox").fill(eventType);
  const buttons = panel.locator(".event-table tbody button");
  const inspected: string[] = [];
  const count = await buttons.count();
  for (let index = 0; index < count; index++) {
    await buttons.nth(index).click();
    const detail = panel.locator(".dock-detail");
    const visibleId = await detail
      .locator(".detail-list")
      .first()
      .locator("dd")
      .first()
      .innerText();
    inspected.push(visibleId);
    if (visibleId === eventId) {
      audit.record("events.select.{eventId}", {
        phase,
        actualEventId: visibleId,
        expectedDownloadedRawId: eventId,
        eventType,
        method: "pointer selected visible rows; read actual detail ID, not row index identity",
        detail: await detail.innerText(),
      });
      return detail;
    }
  }
  throw new Error(
    "VISIBLE_RAW_EVENT_ID_NOT_FOUND: " + JSON.stringify({ phase, eventId, eventType, inspected }),
  );
}
