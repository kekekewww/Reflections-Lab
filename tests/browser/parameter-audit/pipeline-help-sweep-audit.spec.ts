import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

type Json = Record<string, unknown>;
const attempt = (process.env.PIPELINE_HELP_ATTEMPT ?? "unassigned").replace(
  /[^A-Za-z0-9_.-]/g,
  "-",
);
const evidence = fileURLToPath(
  new URL(
    `../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/help-sweep/${attempt}/`,
    import.meta.url,
  ),
);
const cache = fileURLToPath(
  new URL(`../../../.cache/pipeline-help-sweep/${attempt}/`, import.meta.url),
);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const ids = {
  dock: "ui.analysisdock.analysisdock.helptip.3ce42f3ee5",
  recording: "ui.analysisdock.eventspanel.helptip.047429dda4",
  path: "ui.analysisdock.pathspanel.helptip.1ea8a8a6a2",
  compare: "ui.analysisdock.comparisonpanel.helptip.cd13089abc",
  compareKind: "ui.analysisdock.comparisonpanel.helptip.671266b267",
  comparePrepare: "ui.analysisdock.comparisonpanel.helptip.c7bbe36cfd",
  raw: "ui.app.monitorstrip.helptip.54fc1d24fd",
  routing: "ui.app.monitorstrip.helptip.c34ecc040a",
  reverb: "ui.app.monitorstrip.helptip.d82512ba16",
  preview: "ui.inspector.previewinspector.section.c24a9572be",
  late: "ui.performancepanel.performancepanel.helptip.a145ac10d1",
  frames: "ui.performancepanel.performancepanel.helptip.94c33a39bc",
  native: "ui.performancepanel.performancepanel.helptip.6cae4bebb9",
  render: "ui.renderpanel.renderpanel.helptip.82fad18b0d",
  bounce: "ui.rulecard.rulecard.helptip.2ae73974bc",
  binding: "ui.rulecard.rulecard.helptip.1df7992c01",
  zone: "ui.rulecard.rulecard.helptip.e2595a7002",
  empty: "ui.sceneexplorer.sceneexplorer.helptip.a9db4be1e2",
  audition: "ui.sceneexplorer.sceneexplorer.helptip.113da508b3",
  zonesTitle: "ui.zonepanel.zonepanel.helptip.2a43c2d943",
  addZone: "ui.zonepanel.zonepanel.helptip.cb7efbc36a",
  nativeRule: "ui.rulecard.rulecard.helptip.ff9b12f624",
  nativeEvent: "ui.analysisdock.eventdetails.helptip.d773ccb4d7",
} as const;

function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected JSON object");
  return value as Json;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected JSON array");
  return value;
}
function originalWave(): Buffer {
  const rate = 48000,
    frames = 5760;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 2, 40);
  for (let frame = 0; frame < frames; frame++) {
    bytes.writeInt16LE(
      Math.round(0.003 * 32767 * Math.sin((2 * Math.PI * 330 * frame) / rate)),
      44 + frame * 2,
    );
  }
  return bytes;
}

test.beforeAll(() => {
  expect(process.env.PIPELINE_HELP_BROWSER_LEASE, "Explicit coordinator lease is required").toBe(
    "granted",
  );
  expect(attempt).not.toBe("unassigned");
  expect(process.env.PIPELINE_HELP_CANDIDATE).toMatch(/^[a-f0-9]{40}$/i);
  expect(process.env.PIPELINE_HELP_EXPECTED_ENTRY_SHA).toMatch(/^[a-f0-9]{64}$/i);
});

test("bounded real caller help reach and pointer keyboard methods without fabricated native rejection", async ({
  page,
  browser,
}) => {
  await mkdir(evidence, { recursive: true });
  await mkdir(cache, { recursive: true });
  const receipt: Json = {
    schemaVersion: 1,
    status: "RUNNING",
    method: "Playwright CLI scripted DOM / headless Chrome; not native app or MCP",
    rootCandidateHint: process.env.PIPELINE_HELP_CANDIDATE ?? null,
    attempt,
    browser: browser.version(),
    startedAt: new Date().toISOString(),
    policy:
      "UI-only actions; DOM-read evaluate; legal exported Project JSON patches; no HostInternal/bridge/paid API; no native rejection injection",
    callerObservations: [],
    stages: [],
    assets: [],
    downloads: [],
    pageErrors: [],
    consoleErrors: [],
    blockedRequests: [],
    agentRequests: [],
  };
  const observations = receipt.callerObservations as Json[];
  const stages = receipt.stages as Json[];
  const assets = receipt.assets as Json[];
  const downloads = receipt.downloads as Json[];
  const pageErrors = receipt.pageErrors as string[];
  const consoleErrors = receipt.consoleErrors as string[];
  const blocked = receipt.blockedRequests as string[];
  const agentRequests = receipt.agentRequests as string[];
  const tasks: Promise<void>[] = [];
  const covered = new Map<string, Json>();
  const coverageFile = process.env.PIPELINE_HELP_COVERAGE_FILE;
  if (coverageFile) {
    const bytes = await readFile(resolve(coverageFile));
    receipt.priorCoverageFile = { path: coverageFile, sha256: sha(bytes) };
    for (const item of array(object(JSON.parse(bytes.toString("utf8"))).covered).map(object)) {
      const methods = array(item.methods).map(String);
      if (
        methods.includes("pointer-click") &&
        methods.includes("focus") &&
        methods.includes("Escape") &&
        item.evidence
      ) {
        covered.set(String(item.sourceSiteId), item);
      }
    }
  }
  const need = (id: string) => !covered.has(id);
  const phaseFailures: string[] = [];
  const observedSites = new Set<string>();

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/"))
      agentRequests.push(request.method() + " " + request.url());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      (/\.(?:js|css)$/.test(url.pathname) || url.pathname === "/")
    ) {
      tasks.push(
        response
          .body()
          .then((bytes) => {
            assets.push({ url: response.url(), sha256: sha(bytes), bytes: bytes.length });
          })
          .catch(() => {}),
      );
    }
  });
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      (/^https?:$/.test(url.protocol) && url.origin !== "http://127.0.0.1:4173") ||
      url.pathname.startsWith("/api/agent/propose")
    ) {
      blocked.push(request.method() + " " + request.url());
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  const save = async () =>
    writeFile(join(evidence, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  const shot = async (label: string) => {
    await page.screenshot({ path: join(evidence, label + ".png"), fullPage: true });
  };
  async function phase(id: string, action: () => Promise<void>) {
    const selected = process.env.PIPELINE_HELP_PHASES?.split(",").filter(Boolean);
    if (selected && !selected.includes(id)) {
      stages.push({
        id,
        status: "NOT_RERUN_PRIOR_SCOPED_PASS",
        reason: "Narrow remainder attempt; prior fixed raw receipts remain authoritative.",
      });
      return;
    }
    const entry: Json = { id, status: "RUNNING", startedAt: new Date().toISOString() };
    stages.push(entry);
    try {
      await action();
      entry.status = "PASS";
    } catch (error) {
      entry.status = "FAIL";
      entry.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
      phaseFailures.push(id);
      await shot(id + "-failure").catch(() => {});
      entry.visibleBody = await page
        .locator("body")
        .innerText()
        .catch(() => "");
    }
    entry.finishedAt = new Date().toISOString();
    await save();
  }
  async function probe(
    id: string,
    topic: string,
    trigger: Locator,
    precondition: string,
    options: { hover?: boolean; actionRepositions?: boolean } = {},
  ) {
    if (!need(id)) {
      observations.push({
        sourceSiteId: id,
        topic,
        outcome: "PRIOR_VERIFIED_SCOPED_METHODS",
        evidence: covered.get(id),
      });
      observedSites.add(id);
      return;
    }
    const entry: Json = {
      sourceSiteId: id,
      topic,
      precondition,
      startedAt: new Date().toISOString(),
      outcome: "RUNNING",
      actions: [],
    };
    observations.push(entry);
    observedSites.add(id);
    const actions = entry.actions as Json[];
    await expect(trigger).toBeVisible();
    const label = (await trigger.getAttribute("aria-label")) ?? (await trigger.innerText());
    entry.actualTriggerLabel = label;
    entry.expandedBefore = await trigger.getAttribute("aria-expanded");
    const describe = async (method: string) => {
      const tooltip = page.getByRole("tooltip");
      await expect(tooltip).toHaveCount(1);
      await expect(tooltip).not.toBeEmpty();
      const idValue = await tooltip.getAttribute("id");
      const describedBy = await trigger.getAttribute("aria-describedby");
      expect(describedBy?.split(/\s+/)).toContain(idValue);
      actions.push({
        method,
        at: new Date().toISOString(),
        tooltipId: idValue,
        ariaDescribedBy: describedBy,
        actualText: await tooltip.innerText(),
        triggerFocused: await trigger.evaluate((element) => element === document.activeElement),
      });
    };
    await page.mouse.move(0, 0);
    await trigger.click();
    await expect(trigger).toBeFocused();
    if (options.actionRepositions) {
      const describedContent = await trigger.evaluate((element) =>
        (element.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => ({ id, text: document.getElementById(id)?.textContent ?? "" })),
      );
      expect(describedContent.some((entry) => entry.text.trim().length > 0)).toBe(true);
      actions.push({
        method: "pointer-click",
        at: new Date().toISOString(),
        tooltipVisibleAfterAction: (await page.getByRole("tooltip").count()) === 1,
        describedContent,
        scope:
          "Actual layout-changing action; pointer may leave the moved control. Visible content is independently required by focus below.",
      });
    } else await describe("pointer-click");
    await trigger.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    actions.push({
      method: "Escape-after-pointer",
      at: new Date().toISOString(),
      tooltipHidden: true,
    });
    await page.mouse.move(0, 0);
    await trigger.press("Tab");
    await trigger.focus();
    await describe("focus");
    await trigger.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    actions.push({
      method: "Escape-after-focus",
      at: new Date().toISOString(),
      tooltipHidden: true,
    });
    if (options.hover) {
      await trigger.press("Tab");
      await page.mouse.move(0, 0);
      await trigger.hover();
      await describe("hover");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      actions.push({
        method: "Escape-after-hover",
        at: new Date().toISOString(),
        tooltipHidden: true,
      });
    }
    entry.expandedAfter = await trigger.getAttribute("aria-expanded");
    entry.outcome = "PASS";
    entry.finishedAt = new Date().toISOString();
    await save();
  }
  async function exportProject(label: string): Promise<Json> {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export project", exact: true }).click();
    const download = await pending;
    const path = join(cache, label + ".project.json");
    await download.saveAs(path);
    const bytes = await readFile(path);
    downloads.push({
      kind: label,
      path,
      bytes: bytes.length,
      sha256: sha(bytes),
      filename: download.suggestedFilename(),
    });
    return object(JSON.parse(bytes.toString("utf8")));
  }
  async function importProject(project: Json, label: string) {
    const bytes = Buffer.from(JSON.stringify(project, null, 2) + "\n");
    const path = join(cache, label + ".project.json");
    await writeFile(path, bytes);
    stages.push({
      id: "legal-ui-import-" + label,
      source: "pure data patch of fresh UI-exported Project",
      path,
      sha256: sha(bytes),
      bytes: bytes.length,
    });
    await page.getByRole("button", { name: "Import project JSON", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Import project JSON", exact: true });
    await dialog.getByLabel("Choose a project JSON file", { exact: true }).setInputFiles({
      name: label + ".project.json",
      mimeType: "application/json",
      buffer: bytes,
    });
    const apply = dialog.getByRole("button", { name: "Apply and open project", exact: true });
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
  }

  async function scrollProbe(controlId: string, region: Locator) {
    const initialViewport = page.viewportSize();
    const record: Json = {
      controlId,
      method: "normal viewport resize; actual wheel and keyboard; DOM read only",
      status: "RUNNING",
      verticalRegionStatus: "NOT_OBSERVED",
      observations: [],
    };
    stages.push(record);
    const views = record.observations as Json[];
    const metrics = () =>
      region.evaluate((element) => {
        const ancestor = element.closest(".dock-content");
        return {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          scrollLeft: element.scrollLeft,
          outerDock: ancestor
            ? {
                clientHeight: ancestor.clientHeight,
                scrollHeight: ancestor.scrollHeight,
                scrollTop: ancestor.scrollTop,
              }
            : null,
        };
      });
    async function stable(axis: "scrollTop" | "scrollLeft") {
      let prior: number | undefined;
      let same = 0;
      await expect
        .poll(
          async () => {
            const current = (await metrics())[axis];
            same = current === prior ? same + 1 : 0;
            prior = current;
            return same;
          },
          { timeout: 2000, intervals: [16, 16, 32] },
        )
        .toBeGreaterThanOrEqual(3);
      return metrics();
    }
    try {
      for (const viewport of [
        { width: 1600, height: 1200 },
        { width: 1600, height: 700 },
        { width: 1000, height: 620 },
        { width: 900, height: 520 },
      ]) {
        await page.setViewportSize(viewport);
        if (!(await region.isVisible())) {
          views.push({ viewport, visible: false });
          continue;
        }
        await region.scrollIntoViewIfNeeded();
        const before = await metrics();
        views.push({ viewport, before });
        const vertical = before.scrollHeight > before.clientHeight + 1;
        const horizontal = before.scrollWidth > before.clientWidth + 1;
        if (!vertical && !horizontal) continue;
        const box = await region.boundingBox();
        if (!box) continue;
        const axis = vertical ? "scrollTop" : "scrollLeft";
        const outer = region.locator("xpath=ancestor::div[contains(@class,'dock-content')][1]");
        const outerBox = await outer.boundingBox();
        expect(outerBox).not.toBeNull();
        const clipped = {
          left: Math.max(box.x, outerBox!.x),
          right: Math.min(box.x + box.width, outerBox!.x + outerBox!.width),
          top: Math.max(box.y, outerBox!.y),
          bottom: Math.min(box.y + box.height, outerBox!.y + outerBox!.height),
        };
        const pointer = {
          x: (clipped.left + clipped.right) / 2,
          y: (clipped.top + clipped.bottom) / 2,
        };
        const actualHit = await region.evaluate((element, point) => {
          const hit = document.elementFromPoint(point.x, point.y);
          return {
            insideRegion: !!hit && element.contains(hit),
            tag: hit?.tagName,
            classes: hit?.className,
          };
        }, pointer);
        views.push({ pointer, actualHit, clipped, outerBox });
        expect(actualHit.insideRegion).toBe(true);
        await page.mouse.move(pointer.x, pointer.y);
        await page.mouse.wheel(vertical ? 0 : 400, vertical ? 400 : 0);
        await expect.poll(async () => (await metrics())[axis]).not.toBe(before[axis]);
        const afterWheel = await stable(axis);
        await region.focus();
        const beforeKey = await stable(axis);
        const key = vertical
          ? beforeKey.scrollTop > 0
            ? "ArrowUp"
            : "ArrowDown"
          : beforeKey.scrollLeft > 0
            ? "ArrowLeft"
            : "ArrowRight";
        await region.press(key);
        await expect.poll(async () => (await metrics())[axis]).not.toBe(beforeKey[axis]);
        const afterKey = await stable(axis);
        record.status = vertical
          ? "PASS_ACTUAL_REGION_VERTICAL_OVERFLOW"
          : "PASS_ACTUAL_REGION_HORIZONTAL_OVERFLOW_VERTICAL_NOT_OBSERVED";
        record.verticalRegionStatus = vertical
          ? "PASS"
          : "NOT_OBSERVED_OUTER_DOCK_IS_VERTICAL_CLIP_OWNER";
        record.axis = vertical ? "vertical" : "horizontal";
        record.actualViewport = viewport;
        record.key = key;
        record.before = before;
        record.afterWheel = afterWheel;
        record.beforeKey = beforeKey;
        record.afterKey = afterKey;
        await shot(controlId.replace(/\W/g, "-") + "-actual-scroll");
        break;
      }
      if (record.status === "RUNNING") record.status = "NOT_OBSERVED_REGION_OVERFLOW";
    } finally {
      if (initialViewport) await page.setViewportSize(initialViewport);
      await save();
    }
  }

  async function naturalNativeCallers(context: string) {
    const logical = page.getByRole("button", {
      name: "About Logical instance active",
      exact: true,
    });
    if (
      !observedSites.has(ids.nativeRule) &&
      (await logical
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      await probe(
        ids.nativeRule,
        "Logical instance active",
        logical.first(),
        "genuine naturally present native refusal in " + context,
      );
    }
    const event = page.getByRole("button", { name: "About Event evidence", exact: true });
    if (
      !observedSites.has(ids.nativeEvent) &&
      (await event
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      await probe(
        ids.nativeEvent,
        "Event evidence",
        event.first(),
        "genuine selected native rejection in " + context,
      );
    }
  }

  let base: Json | undefined;
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("combobox", { name: /介面語言.*Interface language/ }).selectOption("en");
    const expected = process.env.PIPELINE_HELP_EXPECTED_ENTRY_SHA;
    if (expected) {
      await expect
        .poll(() =>
          assets.some(
            (asset) => String(asset.url).includes("/assets/index-") && asset.sha256 === expected,
          ),
        )
        .toBe(true);
    }
    base = await exportProject("fresh-base-ui");
    await phase("base-pipeline-help", async () => {
      const dock = page.locator(".analysis-dock");
      await probe(
        ids.dock,
        "Expand/Collapse experiment panel",
        dock.locator(".dock-collapse"),
        "real dock collapse toggle",
        { actionRepositions: true },
      );
      await probe(
        ids.dock,
        "Collapse/Expand experiment panel",
        dock.locator(".dock-collapse"),
        "second real toggle direction; restore initial collapsed state",
        { actionRepositions: true },
      );
      if ((await dock.locator(".dock-collapse").getAttribute("aria-expanded")) === "false") {
        await dock.locator(".dock-collapse").click();
      }
      await page.getByRole("tab", { name: /^Acoustic paths/ }).click();
      const paths = page.locator(".paths-panel");
      await expect(paths.locator(".path-table tbody button").first()).toBeVisible();
      await paths.locator(".path-table tbody button").first().click();
      await probe(
        ids.path,
        "Path provenance",
        paths.getByRole("button", { name: "About Path provenance", exact: true }),
        "actual solver path selected",
      );

      await page.getByRole("tab", { name: "Experiment comparison", exact: true }).click();
      const comparison = page.locator(".comparison-panel");
      await expect(
        comparison.getByRole("button", { name: "Check and compare", exact: true }),
      ).toBeDisabled();
      await probe(
        ids.compare,
        "Check and compare",
        comparison.getByRole("button", { name: "About Check and compare", exact: true }),
        "A and B absent; genuine disabled-action info",
      );
      await probe(
        ids.compareKind,
        "Comparison type",
        comparison.getByRole("button", { name: "About Comparison type", exact: true }),
        "comparison type help",
        { hover: true },
      );
      const prepare = comparison.getByRole("button", {
        name: "About Experiment comparison",
        exact: true,
      });
      if (await prepare.count()) {
        await probe(
          ids.comparePrepare,
          "Experiment comparison",
          prepare,
          "actual product emitted empty comparison status",
        );
      } else {
        observations.push({
          sourceSiteId: ids.comparePrepare,
          outcome: "NOT_OBSERVED_NORMAL_PRODUCT_STATE",
          reason:
            "ComparisonPanel requires !model.comparison.status; RecordingHost.getView always supplies a default nonempty status. No mock/empty model injected.",
          sourceRefs: [
            "src/ui/AnalysisDock.tsx ComparisonPanel",
            "src/app/recording-host.ts getView status default",
          ],
          actualComparisonStatus: await comparison.getByRole("status").innerText(),
        });
        observedSites.add(ids.comparePrepare);
      }
      await page.getByRole("tab", { name: "Performance", exact: true }).click();
      const performancePanel = page.locator(".pipeline-diagnostics");
      await probe(
        ids.late,
        "Late onsets / total onsets",
        performancePanel.getByRole("button", {
          name: "About Late onsets / total onsets",
          exact: true,
        }),
        "diagnostic card present",
      );
      await probe(
        ids.frames,
        "Accepted / rejected audio frames",
        performancePanel.getByRole("button", {
          name: "About Accepted / rejected audio frames",
          exact: true,
        }),
        "diagnostic card present",
      );
      await probe(
        ids.native,
        "Native browser output",
        performancePanel.getByRole("button", { name: "About Native browser output", exact: true }),
        "status help, no invented counters",
      );
    });

    await phase("paths-table-scroll", async () => {
      await page.getByRole("tab", { name: /^Acoustic paths/ }).click();
      await scrollProbe(
        "paths.table-scroll",
        page.locator(".paths-panel .table-scroll[role=region]"),
      );
    });
    await phase("monitor-help", async () => {
      const footer = page.locator(".monitor-strip");
      const gain = footer.getByRole("slider", { name: "Monitor gain", exact: true });
      await gain.press("Home");
      const raw = footer.getByRole("button", { name: "Raw reference", exact: true });
      const initialRaw = await raw.getAttribute("aria-pressed");
      await probe(ids.raw, "Raw reference", raw, "actual Raw route toggle, then restore");
      if (initialRaw !== "true")
        await footer.getByRole("button", { name: "Simulated", exact: true }).click();
      await footer.locator(".monitor-metadata > summary").click();
      await probe(
        ids.routing,
        "Monitor routing",
        footer.getByRole("button", { name: "About Monitor routing", exact: true }),
        "real metadata disclosure open; reverb closed",
        { hover: true },
      );
      await footer.locator(".monitor-reverb > summary").click();
      await expect(footer.locator(".monitor-metadata")).not.toHaveAttribute("open", "");
      await probe(
        ids.reverb,
        "Synthetic late reverb",
        footer.getByRole("button", { name: "About Synthetic late reverb", exact: true }),
        "real mutually exclusive reverb disclosure",
      );
      await footer.locator(".monitor-reverb > summary").click();
    });

    await phase("preview-and-raw-rule-help", async () => {
      await page
        .locator(".object-row")
        .filter({ has: page.locator('[title="ball"]') })
        .click();
      const inspector = page.locator("aside.inspector");
      const gain = page
        .locator(".monitor-strip")
        .getByRole("slider", { name: "Monitor gain", exact: true });
      await gain.press("Home");
      const enable = page.getByRole("button", { name: "Enable listening", exact: true });
      if (await enable.isVisible()) await enable.click();
      const mute = page.getByRole("button", { name: "Mute monitor", exact: true });
      if (await mute.isVisible()) await mute.click();
      const grab = page.locator('.behavior-card[aria-label="Sound behavior rule.grab"]');
      await grab.getByRole("button", { name: "Preview scene acoustics", exact: true }).click();
      await expect(
        inspector.getByText("Preview snapshot and provenance", { exact: true }),
      ).toBeVisible();
      await probe(
        ids.preview,
        "Independent preview",
        inspector.getByRole("button", { name: "About Independent preview", exact: true }),
        "genuine OnGrab independent preview metadata exists",
      );
      await naturalNativeCallers("real independent preview");
      await inspector.getByRole("button", { name: "Stop preview", exact: true }).click();
      await grab.locator(".select-field select").first().selectOption("OnBounce");
      await probe(
        ids.bounce,
        "On bounce",
        grab.locator("header").getByRole("button", { name: "About On bounce", exact: true }),
        "genuine OnBounce rule draft, not applied",
      );
      await grab.getByRole("button", { name: "Discard", exact: true }).click();
    });

    if ([ids.zonesTitle, ids.addZone, ids.zone].some(need)) {
      await phase("zone-callers", async () => {
        await page.getByRole("tab", { name: "Zones", exact: true }).click();
        const zones = page.locator(".zone-panel");
        await probe(
          ids.zonesTitle,
          "Zones",
          zones.getByRole("button", { name: "About Zones", exact: true }),
          "real Zones panel",
        );
        await zones.getByRole("button", { name: "Add zone", exact: true }).click();
        await probe(
          ids.addZone,
          "Add zone",
          zones.getByRole("button", { name: "About Add zone", exact: true }),
          "real draft blocks a second Add, not forced capacity",
        );
        await zones.getByRole("button", { name: "Save zone", exact: true }).click();
        await expect(zones.getByRole("button", { name: "Save zone", exact: true })).toHaveCount(0);
        await page
          .locator(".object-row")
          .filter({ has: page.locator('[title="ball"]') })
          .click();
        const grab = page.locator('.behavior-card[aria-label="Sound behavior rule.grab"]');
        await grab.locator(".select-field select").first().selectOption("OnEnterZone");
        await probe(
          ids.zone,
          "Event zone",
          grab.getByRole("button", { name: "About Event zone", exact: true }),
          "actual draft OnEnterZone; real enabled zone exists",
        );
        await grab.getByRole("button", { name: "Discard", exact: true }).click();
      });
    } else {
      for (const id of [ids.zonesTitle, ids.addZone, ids.zone]) {
        observations.push({
          sourceSiteId: id,
          outcome: "PRIOR_VERIFIED_SCOPED_METHODS",
          evidence: covered.get(id),
        });
        observedSites.add(id);
      }
    }

    await phase("render-title-and-replay-record-help", async () => {
      await page.getByRole("tab", { name: "Audio export", exact: true }).click();
      const render = page.locator(".render-panel");
      await probe(
        ids.render,
        "Audio export",
        render.getByRole("button", { name: "About Audio export", exact: true }),
        "real export panel title",
      );
      // A real completed artifact is independently required for table-scroll coverage.
      await render.getByRole("button", { name: "Capture 3 seconds", exact: true }).click();
      await expect(
        render.getByRole("button", { name: "Render audio files", exact: true }),
      ).toBeEnabled({ timeout: 30_000 });
      await page.getByRole("tab", { name: /^Events & recording/ }).click();
      const events = page.locator(".events-panel");
      await expect(events).toContainText("Recording saved");
      if (need(ids.recording)) {
        await events.getByRole("slider").press("End");
        await events.getByRole("slider").press("Home");
        await expect(events.getByRole("slider")).toHaveValue("0");
        await expect(events.getByRole("button", { name: "End replay", exact: true })).toBeVisible();
        await expect(
          events.getByRole("button", { name: "● Start recording", exact: true }),
        ).toBeDisabled();
        await probe(
          ids.recording,
          "Start recording (replay disabled)",
          events.getByRole("button", { name: /About.*Start recording/ }),
          "genuine replay cursor paused through public header; disabled record info",
        );
        await events.getByRole("button", { name: "End replay", exact: true }).click();
      } else {
        observations.push({
          sourceSiteId: ids.recording,
          outcome: "PRIOR_VERIFIED_SCOPED_METHODS",
          evidence: covered.get(ids.recording),
        });
        observedSites.add(ids.recording);
      }
      await scrollProbe("events.table-scroll", events.locator(".table-scroll[role=region]"));
      const nativeCandidates = events.locator("tbody tr").filter({ hasText: /native|admission/i });
      if (await nativeCandidates.count())
        await nativeCandidates.first().getByRole("button").click();
      await naturalNativeCallers("real completed recording events");
    });

    await phase("ready-original-asset-help", async () => {
      if (!need(ids.audition)) {
        observations.push({
          sourceSiteId: ids.audition,
          outcome: "PRIOR_VERIFIED_SCOPED_METHODS",
          evidence: covered.get(ids.audition),
        });
        observedSites.add(ids.audition);
        return;
      }
      const details = page.locator(".scene-explorer .import-details");
      await details.locator("summary").click();
      await details.getByRole("checkbox").check();
      const chooserPending = page.waitForEvent("filechooser");
      await details.getByRole("button", { name: "Import audio", exact: true }).click();
      const chooser = await chooserPending;
      const wave = originalWave();
      await writeFile(join(cache, "help-original.wav"), wave);
      await chooser.setFiles({ name: "help-original.wav", mimeType: "audio/wav", buffer: wave });
      stages.push({
        id: "self-authored-wav-input",
        rights:
          "Original synthetic 330Hz PCM16 generated for this test; rights confirmed through UI",
        sha256: sha(wave),
        bytes: wave.length,
        peakAmplitude: 0.003,
      });
      const row = page.locator(".asset-list li").filter({ hasText: "help-original.wav" });
      const audition = row.getByRole("button", {
        name: "Audition help-original.wav dry",
        exact: true,
      });
      await expect(audition).toBeEnabled();
      await probe(
        ids.audition,
        "Audition help-original.wav dry",
        audition,
        "decoded ready original WAV imported with rights confirmation",
      );
    });

    await phase("binding-disabled-help", async () => {
      if (!need(ids.binding)) {
        observations.push({
          sourceSiteId: ids.binding,
          outcome: "PRIOR_VERIFIED_SCOPED_METHODS",
          evidence: covered.get(ids.binding),
        });
        observedSites.add(ids.binding);
        return;
      }
      const fixture = structuredClone(base!);
      const document = object(fixture.soundBehaviors);
      const binding = array(document.bindings)
        .map(object)
        .find((item) => item.objectId === "ball");
      expect(binding).toBeDefined();
      binding!.enabled = false;
      delete fixture.editorMetadata;
      delete fixture.activeRecordingId;
      await importProject(fixture, "binding-disabled");
      await page
        .locator(".object-row")
        .filter({ has: page.locator('[title="ball"]') })
        .click();
      const impactHeader = page.locator(
        '.behavior-card[aria-label="Sound behavior rule.impact"] header',
      );
      await expect(impactHeader.getByRole("checkbox")).toBeDisabled();
      await probe(
        ids.binding,
        "Enabled",
        impactHeader.getByRole("button", { name: "About Enabled", exact: true }),
        "actual top-level binding.enabled=false from legal Project UI import; not base/effective readout",
      );
    });

    await phase("zone-overlay-editor-replay-fps", async () => {
      const fixture = structuredClone(base!);
      const scene = object(fixture.scene);
      const ball = array(scene.objects)
        .map(object)
        .find((item) => item.id === "ball");
      expect(ball).toBeDefined();
      ball!.mode = "fixed";
      const center = array(ball!.positionM).map(Number);
      scene.zones = [
        {
          id: "zone.overlay-visible",
          name: "Overlay sphere enabled",
          enabled: true,
          shape: "sphere",
          centerM: center,
          radiusM: 0.9,
          hysteresisM: 0.02,
        },
        {
          id: "zone.overlay-disabled",
          name: "Overlay box disabled",
          enabled: false,
          shape: "aabb",
          centerM: center,
          halfExtentsM: [1.1, 1.1, 1.1],
          hysteresisM: 0.02,
        },
      ];
      fixture.recordings = [];
      delete fixture.activeRecordingId;
      delete fixture.editorMetadata;
      await importProject(fixture, "overlay-stable-fixed-ball");
      const row = page.locator(".object-row").filter({ has: page.locator('[title="ball"]') });
      const canvas = page.locator("canvas");
      await row.click();
      await page.getByRole("button", { name: "Frame selection", exact: true }).click();
      await page.getByRole("tab", { name: "Zones", exact: true }).click();
      const zones = page.locator(".zone-panel");
      await expect(zones.locator("li").filter({ hasText: "Overlay sphere enabled" })).toBeVisible();
      await expect(zones.locator("li").filter({ hasText: "Overlay box disabled" })).toBeVisible();
      await expect(page.locator(".viewport-fps")).toHaveCount(0);
      await canvas.screenshot({ path: join(evidence, "zone-overlay-editor-visible.png") });
      const bounds = await canvas.boundingBox();
      expect(bounds).not.toBeNull();
      await page.mouse.click(bounds!.x + 12, bounds!.y + 12);
      await expect(row).toHaveAttribute("aria-pressed", "false");
      const pick = {
        x: bounds!.x + bounds!.width / 2 + 25,
        y: bounds!.y + bounds!.height / 2 + 12,
      };
      await page.mouse.click(pick.x, pick.y);
      await expect(row).toHaveAttribute("aria-pressed", "true");
      await canvas.screenshot({ path: join(evidence, "zone-overlay-editor-pick-through.png") });
      const overlay: Json = {
        controlId: "zone.overlay.{zoneId}",
        method:
          "legal Project UI import; actual Frame selection and pointer picking; public replay/FPS controls; screenshot inspection required for visibility",
        zones: scene.zones,
        pickThrough: { blankDeselected: true, pointer: pick, ballSelected: true },
        screenshots: ["zone-overlay-editor-visible.png", "zone-overlay-editor-pick-through.png"],
        visualStatus: "PENDING_INDEPENDENT_SCREENSHOT_INSPECTION",
      };
      stages.push(overlay);
      await page.getByRole("tab", { name: "Audio export", exact: true }).click();
      const render = page.locator(".render-panel");
      await render.getByRole("button", { name: "Capture 3 seconds", exact: true }).click();
      await expect(
        render.getByRole("button", { name: "Render audio files", exact: true }),
      ).toBeEnabled({ timeout: 30_000 });
      await page.getByRole("tab", { name: /^Events & recording/ }).click();
      const events = page.locator(".events-panel");
      await events.getByRole("slider").press("End");
      await events.getByRole("slider").press("Home");
      await expect(events.getByRole("slider")).toHaveValue("0");
      await expect(events.getByRole("button", { name: "End replay", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Zones", exact: true }).click();
      await expect(zones.getByRole("button", { name: "Add zone", exact: true })).toBeDisabled();
      await canvas.screenshot({ path: join(evidence, "zone-overlay-replay-absent.png") });
      overlay.replay = {
        actualReplayEnded: false,
        zoneAddDisabled: true,
        screenshot: "zone-overlay-replay-absent.png",
      };
      await page.getByRole("tab", { name: /^Events & recording/ }).click();
      await events.getByRole("button", { name: "End replay", exact: true }).click();
      await page.getByRole("tab", { name: "Zones", exact: true }).click();
      await expect(zones.getByRole("button", { name: "Add zone", exact: true })).toBeEnabled();
      await canvas.screenshot({ path: join(evidence, "zone-overlay-editor-restored.png") });
      await page.getByRole("button", { name: "Enter first person", exact: true }).click();
      await expect(page.locator(".viewport-fps")).toBeVisible();
      await page.keyboard.press("Tab");
      const pause = page.locator(".transport-actions > button").first();
      if (/Pause/.test(await pause.innerText())) await pause.click();
      await expect(zones.getByRole("button", { name: "Add zone", exact: true })).toBeDisabled();
      await canvas.screenshot({ path: join(evidence, "zone-overlay-fps-absent.png") });
      overlay.fps = {
        actualFpsClass: true,
        zoneAddDisabled: true,
        screenshot: "zone-overlay-fps-absent.png",
      };
      await page.getByRole("button", { name: "Exit first person", exact: true }).click();
      await expect(page.locator(".viewport-fps")).toHaveCount(0);
      await expect(zones.getByRole("button", { name: "Add zone", exact: true })).toBeEnabled();
      overlay.publicLifecycleAssertions = "PASS";
      await save();
    });
    await phase("empty-scene-objects-help", async () => {
      if (!need(ids.empty)) {
        observations.push({
          sourceSiteId: ids.empty,
          outcome: "PRIOR_VERIFIED_SCOPED_METHODS",
          evidence: covered.get(ids.empty),
        });
        observedSites.add(ids.empty);
        return;
      }
      const empty = structuredClone(base!);
      const scene = object(empty.scene),
        behavior = object(empty.soundBehaviors);
      scene.objects = [];
      scene.sources = [];
      behavior.profiles = [];
      behavior.bindings = [];
      behavior.assets = [];
      empty.assets = [];
      empty.recordings = [];
      delete empty.editorMetadata;
      delete empty.activeRecordingId;
      await importProject(empty, "empty-scene");
      const explorer = page.locator(".scene-explorer");
      await expect(explorer.locator(".object-row")).toHaveCount(0);
      await expect(
        explorer.getByRole("textbox", { name: "Search scene objects", exact: true }),
      ).toHaveValue("");
      await probe(
        ids.empty,
        "Scene objects",
        explorer.getByRole("button", { name: "About Scene objects", exact: true }),
        "genuine scene.objects=[] and empty query through valid Project import; listener preserved",
      );
    });

    for (const [id, topic] of [
      [ids.nativeRule, "Logical instance active"],
      [ids.nativeEvent, "Event evidence"],
    ] as const) {
      if (observedSites.has(id!)) continue;
      const trigger = page.getByRole("button", { name: "About " + topic, exact: true });
      if (await trigger.isVisible().catch(() => false)) {
        await phase("natural-native-" + topic.replace(/\W/g, "-"), () =>
          probe(
            id!,
            topic!,
            trigger,
            "genuine naturally visible native rejection; no fault injection",
          ),
        );
      } else {
        observations.push({
          sourceSiteId: id,
          topic,
          outcome: "NOT_OBSERVED_GENUINE_NATIVE_REJECTION",
          reason:
            "No actual native rejection caller was naturally reachable in this bounded UI flow. No model/DOM injection, high-CPU overload or private state manipulation.",
        });
        observedSites.add(id!);
      }
    }
    expect(blocked).toEqual([]);
    expect(agentRequests.filter((item) => item.startsWith("POST "))).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(phaseFailures, "Each reachable caller preparation must actually work").toEqual([]);
    receipt.status = "PASS_SCOPED_CALLER_METHODS_WITH_EXPLICIT_NOT_OBSERVED_CONDITIONS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
    await shot("failure").catch(() => {});
    throw error;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    receipt.unvisitedSourceSiteIds = Object.values(ids).filter((id) => !observedSites.has(id));
    await Promise.allSettled(tasks);
    await save();
  }
});
