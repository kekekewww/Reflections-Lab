import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const rootEvidenceDir = fileURLToPath(
  new URL(
    "../../../docs/14-core-pipeline/stages/11-ui-parameters/pipeline/motion/",
    import.meta.url,
  ),
);
const evidenceDir = join(rootEvidenceDir, process.env.MOTION_AUDIT_ATTEMPT ?? "attempt-01");
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type Step = Record<string, unknown>;
type Document = {
  revision: number;
  scenePin: Record<string, unknown>;
  actions: Record<string, unknown>[];
  [key: string]: unknown;
};
type Audit = {
  page: Page;
  panel: Locator;
  steps: Step[];
  snapshot(label: string): Promise<void>;
  download(label: string): Promise<Document>;
};
const numericLabels = [
  "X",
  "Y",
  "Z",
  "最大速度 m/s",
  "動態控制最大加速度 m/s²",
  "最大衝量 N·s",
  "逾時 s",
];

async function inventory(panel: Locator) {
  return panel.locator("input,select,textarea,button").evaluateAll((elements) =>
    elements.map((element) => {
      const field = element as HTMLInputElement;
      const select = element instanceof HTMLSelectElement ? element : null;
      const legend =
        element.closest("fieldset")?.querySelector("legend")?.textContent?.trim() ?? "";
      const label =
        element.getAttribute("aria-label") ||
        (field.labels
          ? Array.from(field.labels, (item) =>
              Array.from(item.childNodes)
                .filter((node) => node.nodeType === Node.TEXT_NODE)
                .map((node) => node.textContent?.trim() ?? "")
                .join(" "),
            ).join(" ")
          : "") ||
        element.textContent?.trim() ||
        "";
      const row = element.closest("li")?.querySelector("span")?.textContent?.trim() ?? "";
      const semanticLabels: Record<string, string> = {
        "動作 ID": "motion.action-id",
        動作種類: "motion.kind",
        "最大速度 m/s": "motion.max-speed",
        "動態控制最大加速度 m/s²": "motion.max-acceleration",
        "最大衝量 N·s": "motion.max-impulse",
        "逾時 s": "motion.timeout",
        釋放速度: "motion.release-policy",
        釋放後模式: "motion.release-mode",
        儲存動作: "motion.save",
        復原動作編輯: "motion.undo",
        重做動作編輯: "motion.redo",
        重新綁定目前場景: "motion.rebase",
        匯出動作: "motion.export",
        匯入動作: "motion.import",
      };
      const runText =
        element.closest(".motion-run")?.querySelector("span:not(.badge)")?.textContent?.trim() ??
        "";
      const visibleActionId = (row || runText).split(" · ")[0] || null;
      const semanticId =
        semanticLabels[label] ??
        (["X", "Y", "Z"].includes(label)
          ? `motion.${legend.includes("目標") ? "target" : "impulse"}.${label}`
          : label === "執行"
            ? `motion.run.${visibleActionId}`
            : label === "移除"
              ? `motion.remove.${visibleActionId}`
              : label === "取消"
                ? "motion.cancel.{runId}"
                : "motion.unknown");

      const semanticFamilyId = semanticId.startsWith("motion.target.")
        ? "motion.target.{axis}"
        : semanticId.startsWith("motion.impulse.")
          ? "motion.impulse.{axis}"
          : semanticId.startsWith("motion.run.")
            ? "motion.run.{actionId}"
            : semanticId.startsWith("motion.remove.")
              ? "motion.remove.{actionId}"
              : semanticId;

      return {
        id: semanticId,
        semanticFamilyId,
        axis: ["X", "Y", "Z"].includes(label) ? label : undefined,
        visibleActionId,
        runId: label === "取消" ? null : undefined,
        runIdAvailability: label === "取消" ? "DOM_NOT_EXPOSED" : undefined,
        label,
        tag: element.tagName.toLowerCase(),
        type: field.type ?? null,
        group: legend || null,
        value: field.value ?? null,
        min: element.getAttribute("min"),
        max: element.getAttribute("max"),
        step: element.getAttribute("step"),
        maxLength: element.getAttribute("maxlength"),
        pattern: element.getAttribute("pattern"),
        accept: element.getAttribute("accept"),
        required: field.required ?? false,
        disabled: element.matches(":disabled"),
        ariaInvalid: element.getAttribute("aria-invalid"),
        nativeValidity: field.validity
          ? {
              valid: field.validity.valid,
              valueMissing: field.validity.valueMissing,
              patternMismatch: field.validity.patternMismatch,
              rangeOverflow: field.validity.rangeOverflow,
              rangeUnderflow: field.validity.rangeUnderflow,
              stepMismatch: field.validity.stepMismatch,
              badInput: field.validity.badInput,
            }
          : null,
        options: select
          ? Array.from(select.options, (option) => ({
              value: option.value,
              label: option.label,
              disabled: option.disabled,
              selected: option.selected,
            }))
          : null,
      };
    }),
  );
}
async function withAudit(page: Page, info: TestInfo, work: (audit: Audit) => Promise<void>) {
  await mkdir(evidenceDir, { recursive: true });
  const slug = info.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const caseDir = join(evidenceDir, slug);
  await mkdir(caseDir, { recursive: true });
  const steps: Step[] = [];
  const pageErrors: string[] = [];
  const deniedNetwork: string[] = [];
  const apiRequests: string[] = [];
  const bundles: { url: string; bytes: number; sha256: string }[] = [];
  const responses: Promise<void>[] = [];
  const receipt: Record<string, unknown> = {
    case: info.title,
    startedAt: new Date().toISOString(),
    baseURL: "http://127.0.0.1:4173",
    browser: page.context().browser()?.version(),
    status: "RUNNING",
    method:
      "Real production DOM pointer/keyboard/file input/download; evaluate reads only DOM/native validity.",
    priorEvidenceReused: "docs/14-core-pipeline/stages/05-motion-form-production/receipt.json",
    notVerified: [
      "Meta paid/live",
      "hearing",
      "human native keyboard/mouse",
      "formal performance",
      "unexposed Host internals",
    ],
    bundles,
    pageErrors,
    deniedNetwork,
    apiRequests,
    steps,
  };
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/agent/")) apiRequests.push(request.url());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      url.origin === "http://127.0.0.1:4173" &&
      (url.pathname === "/" || /\.(?:js|css)$/.test(url.pathname))
    ) {
      responses.push(
        response
          .body()
          .then((bytes) => {
            bundles.push({ url: response.url(), bytes: bytes.length, sha256: sha(bytes) });
          })
          .catch(() => {}),
      );
    }
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      (url.protocol.startsWith("http") && url.origin !== "http://127.0.0.1:4173") ||
      url.pathname.startsWith("/api/agent/propose")
    ) {
      deniedNetwork.push(url.href);
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  const panel = page.locator(".motion-panel");
  let downloads = 0;
  const audit: Audit = {
    page,
    panel,
    steps,
    async snapshot(label) {
      steps.push({
        kind: "inventory",
        state: label,
        controls: await inventory(panel),
        visibleText: await panel.innerText(),
      });
    },
    async download(label) {
      const event = page.waitForEvent("download");
      await panel.getByRole("button", { name: "匯出動作", exact: true }).click();
      const download = await event;
      const path = join(caseDir, String(++downloads) + "-" + label + ".json");
      await download.saveAs(path);
      const bytes = await readFile(path);
      const value = JSON.parse(bytes.toString()) as Document;
      steps.push({
        kind: "download",
        label,
        suggestedFilename: download.suggestedFilename(),
        path: path.slice(evidenceDir.length),
        bytes: bytes.length,
        sha256: sha(bytes),
        document: value,
      });
      return value;
    },
  };
  try {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("tab", { name: "動作", exact: true }).click();
    await expect(panel).toBeVisible();
    await work(audit);
    expect(pageErrors).toEqual([]);
    expect(deniedNetwork).toEqual([]);
    expect(apiRequests).toEqual([]);
    receipt.status = "PASS";
  } catch (error) {
    receipt.status = "FAIL";
    receipt.error = error instanceof Error ? error.stack : String(error);
    throw error;
  } finally {
    if (await panel.isVisible()) {
      await audit.snapshot("final").catch(() => {});
      await page.screenshot({ path: join(caseDir, "final.png"), fullPage: true }).catch(() => {});
    }
    receipt.visiblePageText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await Promise.allSettled(responses);
    receipt.finishedAt = new Date().toISOString();
    await writeFile(join(caseDir, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  }
}
async function selectBall(a: Audit) {
  await a.page
    .locator(".object-row")
    .filter({ has: a.page.locator('[title="ball"]') })
    .click();
  await expect(a.panel.getByRole("textbox", { name: "動作 ID", exact: true })).toHaveValue(
    "motion.ball",
  );
}
async function fillNumber(field: Locator, value: string) {
  await field.fill(value);
  await field.press("Enter");
}
async function pause(a: Audit) {
  const button = a.page
    .getByLabel("模擬控制", { exact: true })
    .getByRole("button", { name: "暫停", exact: true });
  if (await button.isVisible()) await button.click();
  await expect(
    a.page
      .getByLabel("模擬控制", { exact: true })
      .getByRole("button", { name: "繼續運算", exact: true }),
  ).toBeVisible();
}
async function save(a: Audit, id: string) {
  await a.panel.getByRole("textbox", { name: "動作 ID", exact: true }).fill(id);
  await a.panel.getByRole("button", { name: "儲存動作", exact: true }).click();
  await expect(a.panel.locator(".motion-actions li").filter({ hasText: id })).toHaveCount(1);
}
async function run(a: Audit, id: string) {
  await a.panel
    .locator(".motion-actions li")
    .filter({ hasText: id })
    .getByRole("button", { name: "執行", exact: true })
    .click();
}
async function setMode(a: Audit, mode: string) {
  await a.page.getByRole("combobox", { name: "剛體模式", exact: true }).selectOption(mode);
  await expect(a.page.getByRole("combobox", { name: "剛體模式", exact: true })).toHaveValue(mode);
}
async function upload(a: Audit, value: unknown, filename = "motion.json") {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  await a.panel.getByLabel("匯入動作", { exact: true }).setInputFiles({
    name: filename,
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
}
async function dismissError(a: Audit) {
  const dismiss = a.page.locator(".error-banner").getByRole("button");
  if (await dismiss.isVisible()) await dismiss.click();
}

test("motion initial states identifier and numeric boundary controls", async ({ page }, info) => {
  await withAudit(page, info, async (a) => {
    await a.snapshot("production default selection");
    await a.page.locator(".listener-row").click();
    await a.snapshot("no object selected via Listener");
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeDisabled();
    await a.page
      .locator(".object-row")
      .filter({ has: a.page.locator('[title="floor"]') })
      .click();
    await a.snapshot("fixed object");
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeDisabled();
    await selectBall(a);
    await a.snapshot("dynamic moveTo defaults");
    const id = a.panel.getByRole("textbox", { name: "動作 ID", exact: true });
    await id.fill("Invalid ID");
    await a.panel.getByRole("button", { name: "儲存動作", exact: true }).click();
    expect(
      await id.evaluate((element) => (element as HTMLInputElement).validity.patternMismatch),
    ).toBe(true);
    await expect(a.panel.locator(".motion-actions li")).toHaveCount(0);
    a.steps.push({
      kind: "identifier",
      invalidValue: "Invalid ID",
      outcome: "native pattern blocked Save",
    });
    await id.fill("m".repeat(65));
    expect((await id.inputValue()).length).toBe(64);
    await id.fill("m".repeat(64));
    await a.panel.getByRole("button", { name: "儲存動作", exact: true }).click();
    await expect(a.panel.locator(".motion-actions li")).toHaveCount(1);
    a.steps.push({
      kind: "identifier",
      acceptedLength: 64,
      rejectedExtraCharacter: true,
      outcome: "saved",
    });
    for (const label of numericLabels) {
      const field = a.panel.getByRole("spinbutton", { name: label, exact: true });
      const original = await field.inputValue();
      const min = Number(await field.getAttribute("min"));
      const max = Number(await field.getAttribute("max"));
      const results: Step[] = [];
      for (const value of [min, max]) {
        await fillNumber(field, String(value));
        await expect(field).toHaveAttribute("aria-invalid", "false");
        expect(
          await field.evaluate((element) => (element as HTMLInputElement).validity.valid),
        ).toBe(true);
        results.push({ value, outcome: "accepted native-valid committed via Enter" });
      }
      for (const value of [String(min - 1), String(max + 1), ""]) {
        await fillNumber(field, value);
        await expect(field).toHaveAttribute("aria-invalid", "true");
        const message = await field.getAttribute("title");
        await field.press("Escape");
        await expect(field).toHaveValue(String(max));
        await expect(field).toHaveAttribute("aria-invalid", "false");
        results.push({ value, outcome: "invalid, Escape restored last committed max", message });
      }
      await fillNumber(field, original);
      a.steps.push({
        kind: "numeric-boundary",
        label,
        min,
        max,
        step: await field.getAttribute("step"),
        results,
      });
    }
    await a.snapshot("moveTo boundaries restored");
    await a.panel.getByRole("combobox", { name: "動作種類", exact: true }).selectOption("impulse");
    const vector = a.panel.getByRole("group", { name: /衝量/ });
    for (const axis of ["X", "Y", "Z"]) {
      const field = vector.getByRole("spinbutton", { name: axis, exact: true });
      for (const value of ["-1000", "1000"]) {
        await fillNumber(field, value);
        await expect(field).toHaveAttribute("aria-invalid", "false");
      }
      await fillNumber(field, "1001");
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await field.press("Escape");
      await expect(field).toHaveValue("1000");
      await fillNumber(field, axis === "Y" ? "1" : "0");
      a.steps.push({
        kind: "impulse-axis-boundary",
        axis,
        bounds: [-1000, 1000],
        aboveMaxRejected: true,
        escapeRestored: true,
      });
    }
    await a.snapshot("impulse controls");
  });
});

test("motion impulse saved applied and norm limit rejection", async ({ page }, info) => {
  await withAudit(page, info, async (a) => {
    await selectBall(a);
    const kind = a.panel.getByRole("combobox", { name: "動作種類", exact: true });
    await kind.focus();
    await kind.press("End");
    await expect(kind).toHaveValue("impulse");
    const vector = a.panel.getByRole("group", { name: /衝量/ });
    await fillNumber(vector.getByRole("spinbutton", { name: "X", exact: true }), "2");
    await fillNumber(vector.getByRole("spinbutton", { name: "Y", exact: true }), "1");
    await fillNumber(vector.getByRole("spinbutton", { name: "Z", exact: true }), "-1");
    await fillNumber(a.panel.getByRole("spinbutton", { name: "最大衝量 N·s", exact: true }), "5");
    await save(a, "motion.audit.impulse");
    const doc = await a.download("accepted-impulse");
    expect(doc.actions[0]).toMatchObject({
      kind: "impulse",
      impulseNs: [2, 1, -1],
      maxImpulseNs: 5,
    });
    await run(a, "motion.audit.impulse");
    await expect(a.panel.locator(".motion-run").last()).toContainText("applied");
    await a.snapshot("impulse applied running simulation");
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeDisabled();
    await pause(a);
    await fillNumber(vector.getByRole("spinbutton", { name: "X", exact: true }), "10");
    await fillNumber(vector.getByRole("spinbutton", { name: "Y", exact: true }), "10");
    await fillNumber(vector.getByRole("spinbutton", { name: "Z", exact: true }), "0");
    await fillNumber(a.panel.getByRole("spinbutton", { name: "最大衝量 N·s", exact: true }), "10");
    await a.panel
      .getByRole("textbox", { name: "動作 ID", exact: true })
      .fill("motion.audit.too-large");
    await a.panel.getByRole("button", { name: "儲存動作", exact: true }).click();
    await expect(a.page.getByRole("alert")).toContainText(/impulse|衝量/i);
    await expect(a.panel.locator(".motion-actions li")).toHaveCount(1);
    a.steps.push({
      kind: "domain-rejection",
      attempted: { impulseNs: [10, 10, 0], maxImpulseNs: 10 },
      alert: await a.page.getByRole("alert").innerText(),
      unchangedCount: 1,
    });
    const retained = await a.download("after-norm-rejection");
    expect(retained.actions).toEqual(doc.actions);
  });
});

test("motion dynamic moveAndRelease preserve zero history and JSON import", async ({
  page,
}, info) => {
  await withAudit(page, info, async (a) => {
    await selectBall(a);
    await a.panel
      .getByRole("combobox", { name: "動作種類", exact: true })
      .selectOption("moveAndRelease");
    const policy = a.panel.getByRole("combobox", { name: "釋放速度", exact: true });
    expect(
      await policy
        .locator("option")
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)),
    ).toEqual(["preserve", "zero"]);
    await expect(a.panel.getByRole("combobox", { name: "釋放後模式", exact: true })).toHaveCount(0);
    await a.snapshot("dynamic release preserve");
    await save(a, "motion.audit.release");
    const preserve = await a.download("preserve");
    expect(preserve.actions[0]).toMatchObject({
      kind: "moveAndRelease",
      releasePolicy: "preserve",
    });
    await policy.focus();
    await policy.press("End");
    await expect(policy).toHaveValue("zero");
    await save(a, "motion.audit.release");
    const zero = await a.download("zero");
    expect(zero.actions[0]).toMatchObject({ releasePolicy: "zero", revision: 2 });
    await a.panel.getByRole("button", { name: "復原動作編輯", exact: true }).click();
    const undone = await a.download("undo");
    expect(undone.actions[0]?.releasePolicy).toBe("preserve");
    await a.panel.getByRole("button", { name: "重做動作編輯", exact: true }).click();
    const redone = await a.download("redo");
    expect(redone.actions[0]?.releasePolicy).toBe("zero");
    await run(a, "motion.audit.release");
    await expect(a.panel.locator(".motion-run").last()).toContainText("reached");
    await pause(a);
    await a.panel
      .locator(".motion-actions li")
      .getByRole("button", { name: "移除", exact: true })
      .click();
    await expect(a.panel.locator(".motion-actions li")).toHaveCount(0);
    await upload(a, preserve);
    await expect(a.panel.locator(".motion-actions li")).toHaveCount(1);
    const imported = await a.download("imported-preserve");
    expect(imported.actions[0]).toMatchObject({
      actionId: "motion.audit.release",
      releasePolicy: "preserve",
    });
    const before = imported.actions;
    for (const [label, value] of [
      ["malformed", "{bad json"],
      ["schema", { ...preserve, schemaVersion: "9.0.0" }],
      [
        "foreign-scene",
        { ...preserve, scenePin: { ...preserve.scenePin, sceneId: "scene.foreign" } },
      ],
      [
        "foreign-object",
        { ...preserve, actions: [{ ...preserve.actions[0], objectId: "missing.object" }] },
      ],
    ] as const) {
      await upload(a, value, label + ".json");
      await expect(a.page.getByRole("alert")).toBeVisible();
      a.steps.push({
        kind: "import-rejection",
        label,
        error: await a.page.getByRole("alert").innerText(),
      });
      const retained = await a.download("retained-after-" + label);
      expect(retained.actions).toEqual(before);
      await dismissError(a);
    }
  });
});

test("motion kinematic release modes trajectory import and unsupported impulse", async ({
  page,
}, info) => {
  await withAudit(page, info, async (a) => {
    await selectBall(a);
    await setMode(a, "kinematic");
    await a.panel
      .getByRole("combobox", { name: "動作種類", exact: true })
      .selectOption("moveAndRelease");
    const policy = a.panel.getByRole("combobox", { name: "釋放速度", exact: true });
    expect(
      await policy
        .locator("option")
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)),
    ).toEqual(["zero", "transfer"]);
    await expect(
      a.panel.getByRole("spinbutton", { name: "動態控制最大加速度 m/s²", exact: true }),
    ).toBeDisabled();
    const mode = a.panel.getByRole("combobox", { name: "釋放後模式", exact: true });
    await policy.selectOption("zero");
    await mode.selectOption("dynamicGravity");
    await save(a, "motion.audit.kinematic-zero");
    const zero = await a.download("kinematic-zero-gravity");
    expect(zero.actions[0]).toMatchObject({ releasePolicy: "zero", releaseMode: "dynamicGravity" });
    await policy.selectOption("transfer");
    await mode.selectOption("dynamicNoGravity");
    await save(a, "motion.audit.kinematic-transfer");
    const transfer = await a.download("kinematic-transfer-nogravity");
    expect(
      transfer.actions.find((action) => action.actionId === "motion.audit.kinematic-transfer"),
    ).toMatchObject({ releasePolicy: "transfer", releaseMode: "dynamicNoGravity" });
    await a.snapshot("kinematic release transfer noGravity");
    const template = transfer.actions.find(
      (action) => action.actionId === "motion.audit.kinematic-transfer",
    )!;
    const target = a.panel.getByRole("group", { name: /目標位置/ });
    const position = await Promise.all(
      ["X", "Y", "Z"].map((axis) =>
        target.getByRole("spinbutton", { name: axis, exact: true }).inputValue().then(Number),
      ),
    );
    const trajectory = {
      ...transfer,
      actions: [
        {
          ...template,
          actionId: "motion.audit.trajectory",
          kind: "trajectory",
          releasePolicy: "zero",
          maxSpeedMps: 3,
          timeoutS: 3,
          samples: [
            { timeS: 0, positionM: position, orientationQuaternion: [0, 0, 0, 1] },
            {
              timeS: 1,
              positionM: [position[0], position[1]! + 0.5, position[2]],
              orientationQuaternion: [0, 0, 0, 1],
            },
          ],
        },
      ],
    };
    delete (trajectory.actions[0] as Record<string, unknown>).targetPositionM;
    await upload(a, trajectory, "trajectory.json");
    await expect(a.panel.locator(".motion-actions li")).toHaveCount(1);
    const imported = await a.download("trajectory");
    expect(imported.actions[0]?.kind).toBe("trajectory");
    await run(a, "motion.audit.trajectory");
    await expect(a.panel.locator(".motion-run").last()).toContainText("reached", {
      timeout: 12_000,
    });
    await pause(a);
    await a.snapshot("trajectory imported run reached");
    await a.panel.getByRole("combobox", { name: "動作種類", exact: true }).selectOption("impulse");
    await save(a, "motion.audit.unsupported-kinematic-impulse");
    await run(a, "motion.audit.unsupported-kinematic-impulse");
    await expect(a.page.getByRole("alert")).toContainText(/dynamic/i);
    a.steps.push({
      kind: "capability-rejection",
      operation: "kinematic impulse Run",
      error: await a.page.getByRole("alert").innerText(),
      truthful: "saved definition is allowed, Host rejects unsupported body at Run",
    });
  });
});

test("motion active cancellation paused authoring timeout and stale rebase", async ({
  page,
}, info) => {
  await withAudit(page, info, async (a) => {
    await selectBall(a);
    const target = a.panel.getByRole("group", { name: /目標位置/ });
    await fillNumber(target.getByRole("spinbutton", { name: "Y", exact: true }), "100");
    await fillNumber(
      a.panel.getByRole("spinbutton", { name: "最大速度 m/s", exact: true }),
      "0.01",
    );
    await fillNumber(a.panel.getByRole("spinbutton", { name: "逾時 s", exact: true }), "60");
    await save(a, "motion.audit.cancel");
    await run(a, "motion.audit.cancel");
    await expect(a.panel.locator(".motion-run").last()).toContainText("running");
    await expect(a.panel.getByRole("button", { name: "取消", exact: true })).toBeVisible();
    await a.snapshot("active run authoring disabled");
    for (const name of ["儲存動作", "復原動作編輯", "重做動作編輯", "重新綁定目前場景"]) {
      await expect(a.panel.getByRole("button", { name, exact: true })).toBeDisabled();
    }
    await expect(a.panel.getByLabel("匯入動作", { exact: true })).toBeDisabled();
    await expect(a.panel.getByRole("button", { name: "匯出動作", exact: true })).toBeEnabled();
    await a.panel.getByRole("button", { name: "取消", exact: true }).focus();
    await a.panel.getByRole("button", { name: "取消", exact: true }).press("Enter");
    await expect(a.panel.locator(".motion-run").last()).toContainText("cancelled");
    await expect(a.panel.getByRole("button", { name: "取消", exact: true })).toHaveCount(0);
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeDisabled();
    await pause(a);
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeEnabled();
    await fillNumber(a.panel.getByRole("spinbutton", { name: "逾時 s", exact: true }), "0.1");
    await save(a, "motion.audit.timeout");
    await run(a, "motion.audit.timeout");
    await expect(a.panel.locator(".motion-run").last()).toContainText("timedOut");
    await pause(a);
    await setMode(a, "dynamicNoGravity");
    await expect(a.panel).toContainText("場景已更新");
    await expect(
      a.panel
        .locator(".motion-actions li")
        .first()
        .getByRole("button", { name: "執行", exact: true }),
    ).toBeDisabled();
    await expect(
      a.panel.getByRole("button", { name: "重新綁定目前場景", exact: true }),
    ).toBeEnabled();
    await a.snapshot("stale scene Run disabled");
    await a.panel.getByRole("button", { name: "重新綁定目前場景", exact: true }).click();
    await expect(a.panel).not.toContainText("場景已更新");
    await expect(
      a.panel
        .locator(".motion-actions li")
        .first()
        .getByRole("button", { name: "執行", exact: true }),
    ).toBeEnabled();
    await expect(
      a.panel.getByRole("button", { name: "重新綁定目前場景", exact: true }),
    ).toBeDisabled();
    await a.download("rebased");
    await a.snapshot("rebound scene");
  });
});

test("motion native keyboard and pointer spin controls", async ({ page }, info) => {
  await withAudit(page, info, async (a) => {
    await selectBall(a);
    const observations: Step[] = [];
    for (const label of ["X", "最大速度 m/s", "逾時 s"]) {
      const field = a.panel.getByRole("spinbutton", { name: label, exact: true });
      const before = await field.inputValue();
      await field.focus();
      await field.press("ArrowUp");
      const keyboardUp = await field.inputValue();
      await field.press("Enter");
      await field.press("ArrowDown");
      const keyboardDown = await field.inputValue();
      await field.press("Enter");
      await fillNumber(field, before);
      await field.scrollIntoViewIfNeeded();
      await field.hover();
      const box = await field.boundingBox();
      expect(box).not.toBeNull();
      const metrics = await field.evaluate((element) => {
        const style = getComputedStyle(element);
        const spin = getComputedStyle(element, "::-webkit-inner-spin-button");
        return {
          paddingTop: parseFloat(style.paddingTop),
          paddingBottom: parseFloat(style.paddingBottom),
          paddingRight: parseFloat(style.paddingRight),
          borderTop: parseFloat(style.borderTopWidth),
          borderBottom: parseFloat(style.borderBottomWidth),
          borderRight: parseFloat(style.borderRightWidth),
          spinAppearance: spin.webkitAppearance,
          spinDisplay: spin.display,
          spinOpacity: spin.opacity,
        };
      });
      const contentTop = box!.y + metrics.paddingTop + metrics.borderTop;
      const contentHeight =
        box!.height -
        metrics.paddingTop -
        metrics.paddingBottom -
        metrics.borderTop -
        metrics.borderBottom;
      const spinX = box!.x + box!.width - metrics.paddingRight - metrics.borderRight - 7;
      const upper = { x: spinX, y: contentTop + contentHeight * 0.25 };
      const lower = { x: spinX, y: contentTop + contentHeight * 0.75 };
      const screenshotName = "native-" + label.replace(/[^a-z0-9]+/gi, "-") + ".png";
      await field.screenshot({ path: join(evidenceDir, screenshotName) });
      await a.page.mouse.click(upper.x, upper.y);
      const pointerUp = await field.inputValue();
      await field.press("Enter");
      await a.page.mouse.click(lower.x, lower.y);
      const pointerDown = await field.inputValue();
      await field.press("Enter");
      const result = {
        kind: "native-stepper",
        label,
        step: await field.getAttribute("step"),
        before,
        keyboardUp,
        keyboardDown,
        pointerUp,
        pointerDown,
        pointerLocationsFromActualDOMBox: { box, metrics, upper, lower, screenshotName },
        keyboardChanged: Number(keyboardUp) > Number(before),
        keyboardReturned: Math.abs(Number(keyboardDown) - Number(before)) < 1e-9,
        pointerChangedAtSampledSpinLocation: Number(pointerUp) > Number(before),
        pointerReturned: Math.abs(Number(pointerDown) - Number(before)) < 1e-9,
      };
      observations.push(result);
      a.steps.push(result);
      await fillNumber(field, before);
    }
    await a.snapshot("native increment observations");
    expect(observations.every((item) => item.keyboardChanged && item.keyboardReturned)).toBe(true);
    expect(
      observations.every(
        (item) => item.pointerChangedAtSampledSpinLocation && item.pointerReturned,
      ),
    ).toBe(true);
  });
});

test("motion recording and replay authoring dependencies", async ({ page }, info) => {
  await withAudit(page, info, async (a) => {
    await selectBall(a);
    await save(a, "motion.audit.recording-gate");
    await a.page.getByRole("tab", { name: /^事件與錄放/ }).click();
    const events = a.page.locator(".events-panel");
    await events.getByRole("button", { name: "● 開始錄製", exact: true }).click();
    await a.page.getByRole("tab", { name: "動作", exact: true }).click();
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeDisabled();
    await expect(a.panel.getByLabel("匯入動作", { exact: true })).toBeDisabled();
    await expect(a.panel.getByRole("button", { name: "匯出動作", exact: true })).toBeEnabled();
    await a.snapshot("recording authoring disabled, export enabled");
    await expect
      .poll(async () => (await a.page.locator("body").innerText()).includes("固定步負載超限"), {
        timeout: 8_000,
      })
      .toBe(true);
    const guardLines = (await a.page.locator("body").innerText())
      .split("\n")
      .filter((line) => /固定步負載超限|保留固定步欠帳/.test(line));
    a.steps.push({
      kind: "natural-overload-precondition",
      observed: true,
      guardLines,
      meaning: "Real safety/load limit, not performance-health evidence.",
    });
    a.steps.push({
      kind: "recording-prefix",
      tick: await a.page.locator(".transport-bar .subtle.mono").innerText(),
      notice: await a.page.locator(".transport-bar").innerText(),
      method: "Respect explicit fixed-step overload pause; stop and retain the continuous prefix.",
    });
    await a.page.getByRole("tab", { name: /^事件與錄放/ }).click();
    await events.getByRole("button", { name: "■ 停止錄製", exact: true }).click();
    await expect(events.getByRole("button", { name: "■ 停止錄製", exact: true })).toHaveCount(0);
    await expect(events.getByRole("button", { name: "▶ 重播紀錄", exact: true })).toBeEnabled();
    async function downloadRecording(label: string) {
      const downloadEvent = a.page.waitForEvent("download");
      await events.getByRole("button", { name: "匯出已封存錄製", exact: true }).click();
      const download = await downloadEvent;
      const path = join(evidenceDir, label + "-" + download.suggestedFilename());
      await download.saveAs(path);
      const bytes = await readFile(path);
      const recording = JSON.parse(bytes.toString()) as {
        runId: string;
        status: string;
        frameCount: number;
        frames: { tick: number }[];
        startTick: number;
        endTick: number;
        artifactSha256: string;
      };
      const ticks = recording.frames.map((frame) => frame.tick);
      expect(recording.frames.length).toBe(recording.frameCount);
      expect(ticks.every((tick, index) => tick === ticks[0]! + index)).toBe(true);
      a.steps.push({
        kind: "public-recording-download",
        label,
        path: path.slice(evidenceDir.length),
        suggestedFilename: download.suggestedFilename(),
        bytes: bytes.length,
        sha256: sha(bytes),
        runId: recording.runId,
        status: recording.status,
        frameCount: recording.frameCount,
        startTick: recording.startTick,
        endTick: recording.endTick,
        ticks,
        artifactSha256: recording.artifactSha256,
      });
      return recording;
    }
    const sealedPrefix = await downloadRecording("sealed-overload-prefix");
    expect(sealedPrefix.status).toBe("captured");
    expect(sealedPrefix.frameCount).toBeGreaterThan(0);
    await a.page.getByRole("tab", { name: "音訊匯出", exact: true }).click();
    const capture = a.page
      .locator(".render-panel")
      .getByRole("button", { name: "錄製3秒", exact: true });
    await capture.click();
    await expect(capture).toBeEnabled({ timeout: 30_000 });
    await a.page.getByRole("tab", { name: /^事件與錄放/ }).click();
    await expect(events.getByRole("button", { name: "▶ 重播紀錄", exact: true })).toBeEnabled({
      timeout: 30_000,
    });
    const controlled = await downloadRecording("controlled-after-overload");
    expect(controlled.status).toBe("captured");
    expect(controlled.frameCount).toBe(180);
    expect(controlled.runId).not.toBe(sealedPrefix.runId);
    a.steps.push({
      kind: "bounded-public-capture",
      method: "Audio export Capture 3 seconds",
      observedSliderMaxS: Number(await events.locator("#recording-playhead").getAttribute("max")),
      verifiedFrameCount: controlled.frameCount,
      verifiedConsecutiveTicks: true,
      sealedPrefixRunId: sealedPrefix.runId,
      controlledRunId: controlled.runId,
      purpose:
        "Public UI exact180-frame replay source after real natural overload; does not relax protection or claim performance health.",
    });
    await events.getByRole("button", { name: "▶ 重播紀錄", exact: true }).click();
    await a.page.getByRole("tab", { name: "動作", exact: true }).click();
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeDisabled();
    await expect(a.panel.getByLabel("匯入動作", { exact: true })).toBeDisabled();
    await a.snapshot("replaying authoring disabled");
    await a.page.getByRole("tab", { name: /^事件與錄放/ }).click();
    await events.getByRole("button", { name: "結束重播", exact: true }).click();
    await a.page.getByRole("tab", { name: "動作", exact: true }).click();
    await expect(a.panel.getByRole("button", { name: "儲存動作", exact: true })).toBeEnabled();
    await a.snapshot("replay ended authoring available");
  });
});
