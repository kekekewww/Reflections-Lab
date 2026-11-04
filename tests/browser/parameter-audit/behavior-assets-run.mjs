import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../../..", import.meta.url));
const selected = new Set((process.argv[2] ?? "").split(",").filter(Boolean));
const runLabel = process.argv[3] ?? "final";
const out = resolve(
  root,
  "docs/14-core-pipeline/stages/11-ui-parameters/behavior/assets",
  runLabel,
);
await mkdir(out, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const sourcePaths = [
  "src/ui/SceneExplorer.tsx",
  "src/ui/RuleCard.tsx",
  "src/app/asset-host.ts",
  "src/audio/wav.ts",
];
const receipt = {
  schemaVersion: 1,
  kind: "PRODUCTION_DOM_ASSET_PARAMETER_AUDIT",
  status: "RUNNING",
  startedAtUtc: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  baseURL: "http://127.0.0.1:4173",
  method:
    "Isolated production Chrome, real pointer/keyboard/filechooser and downloaded project JSON; no runtime/test bridge or paid provider",
  sources: await Promise.all(
    sourcePaths.map(async (path) => ({ path, sha256: hash(await readFile(resolve(root, path))) })),
  ),
  cases: [],
  blockedRequests: [],
  consoleErrors: [],
  pageErrors: [],
  loadedAssets: [],
  notVerified: [
    "Native Windows file dialog",
    "human hearing or calibrated SPL",
    "formal performance acceptance",
  ],
  notExposed: [
    {
      control: "delete/rename asset or edit license/provenance",
      status: "NOT_EXPOSED",
      reason:
        "The product offers immutable imported asset references and read-only provenance. No such parameter is rendered.",
    },
  ],
};
function wave({ rate = 48000, channels = 1, bits = 16, float = false, seconds = 0.12 } = {}) {
  const frames = Math.round(rate * seconds),
    align = (channels * bits) / 8,
    b = Buffer.alloc(44 + frames * align);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(float ? 3 : 1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * align, 28);
  b.writeUInt16LE(align, 32);
  b.writeUInt16LE(bits, 34);
  b.write("data", 36);
  b.writeUInt32LE(frames * align, 40);
  for (let f = 0; f < frames; f++)
    for (let c = 0; c < channels; c++) {
      const v = 0.12 * Math.sin((2 * Math.PI * 330 * f) / rate),
        p = 44 + f * align + (c * bits) / 8;
      if (float) b.writeFloatLE(v, p);
      else if (bits === 8) b.writeUInt8(Math.round(v * 127 + 128), p);
      else b.writeIntLE(Math.round(v * (2 ** (bits - 1) - 1)), p, bits / 8);
    }
  return b;
}
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
receipt.browser = browser.version();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  acceptDownloads: true,
});
await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.setDefaultNavigationTimeout(30000);
page.on("pageerror", (e) => receipt.pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") receipt.consoleErrors.push(m.text());
});
page.on("response", async (response) => {
  if (/\/assets\/.*\.js$/.test(response.url())) {
    try {
      const bytes = await response.body();
      receipt.loadedAssets.push({ url: response.url(), sha256: hash(bytes), bytes: bytes.length });
    } catch {}
  }
});
await page.route("**/*", async (route) => {
  const u = new URL(route.request().url());
  if ((u.protocol === "http:" || u.protocol === "https:") && u.origin !== "http://127.0.0.1:4173") {
    receipt.blockedRequests.push(u.href);
    return route.abort("blockedbyclient");
  }
  if (u.pathname.startsWith("/api/agent/propose")) {
    receipt.blockedRequests.push(u.href);
    return route.abort("blockedbyclient");
  }
  return route.continue();
});
async function save() {
  await writeFile(resolve(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
}
async function audit(id, parameters, method, run) {
  if (selected.size && !selected.has(id)) return;
  const entry = {
    id,
    parameters,
    method,
    status: "RUNNING",
    startedAtUtc: new Date().toISOString(),
  };
  receipt.cases.push(entry);
  await save();
  try {
    entry.observed = await run();
    entry.status = "PASS";
  } catch (e) {
    entry.status = "FAIL";
    entry.error = String(e.stack || e);
    await page
      .screenshot({ path: resolve(out, id + "-failure.png"), fullPage: true })
      .catch(() => {});
  }
  entry.finishedAtUtc = new Date().toISOString();
  await save();
}
async function project() {
  const d = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: "Export project", exact: true }).click();
  const stream = await (await d).createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function importFile(name, buffer) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    page.getByRole("button", { name: "Import audio", exact: true }).click(),
  ]);
  await chooser.setFiles({ name, mimeType: "audio/wav", buffer });
}

receipt.workingTreeDiff = execFileSync(
  "git",
  [
    "diff",
    "--name-only",
    "HEAD",
    "--",
    "src",
    "server",
    "schemas",
    "package.json",
    "package-lock.json",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
receipt.sourceCommitMeaning =
  "Git HEAD is a provenance pin; loaded JS hashes identify the served build. Working edits may be unbuilt.";
try {
  await page.goto(receipt.baseURL);
  await page.getByRole("combobox", { name: "介面語言 / Interface language" }).selectOption("en");
  const explorer = page.locator(".scene-explorer");
  if (!(await explorer.isVisible()))
    await page.getByRole("button", { name: "Scene", exact: true }).click();
  const details = explorer.locator(".import-details");
  if (selected.size && !selected.has("assets-01-rights-gate")) {
    await details.locator("summary").click();
    await details.getByRole("checkbox").check();
  }
  await audit(
    "assets-01-rights-gate",
    ["Import audio disclosure", "Local rights checkbox", "Import audio filechooser button"],
    "keyboard Enter/Space and pointer toggling",
    async () => {
      await details.locator("summary").focus();
      await details.locator("summary").press("Enter");
      await expect(details).toHaveAttribute("open", "");
      const button = details.getByRole("button", { name: "Import audio", exact: true }),
        rights = details.getByRole("checkbox");
      await expect(button).toBeDisabled();
      await rights.focus();
      await rights.press("Space");
      await expect(button).toBeEnabled();
      await rights.click();
      await expect(button).toBeDisabled();
      await rights.focus();
      await rights.press("Space");
      await expect(button).toBeEnabled();
      return { uncheckedDisabled: true, checkedEnabled: true };
    },
  );
  for (const item of [
    { id: "assets-02-empty", name: "empty.wav", buffer: Buffer.alloc(0), code: "ASSET_SIZE_LIMIT" },
    {
      id: "assets-03-malformed",
      name: "not-wave.wav",
      buffer: Buffer.from("not a WAV container"),
      code: "WAV_CAPABILITY_UNSUPPORTED",
    },
    {
      id: "assets-04-oversize",
      name: "too-large.wav",
      buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
      code: "ASSET_SIZE_LIMIT",
    },
  ]) {
    await audit(
      item.id,
      ["Import audio validation", "Atomic failed import"],
      "filechooser selected invalid original local fixture",
      async () => {
        const before = (await project()).assets;
        const visibleBefore = await explorer.locator(".asset-list li").count();
        await importFile(item.name, item.buffer);
        await expect(page.locator(".error-banner")).toContainText(
          item.code === "WAV_CAPABILITY_UNSUPPORTED"
            ? /RIFF.WAVE|uncompressed|PCM|WAV_CAPABILITY/
            : item.code,
        );
        await expect(explorer.locator(".asset-list li")).toHaveCount(visibleBefore);
        const observedError = await page.locator(".error-banner").innerText();
        const after = (await project()).assets;
        expect(after).toEqual(before);
        return {
          bytes: item.buffer.length,
          requestedValidationCode: item.code,
          observedError,
          projectAssetsBefore: before.length,
          projectAssetsAfter: after.length,
          visibleAssetsBefore: visibleBefore,
          visibleAssetsAfter: await explorer.locator(".asset-list li").count(),
        };
      },
    );
  }
  const fixtures = [
    { name: "audit-original-pcm16.wav", options: { rate: 48000, bits: 16, channels: 1 } },
    {
      name: "audit-original-float32-stereo.wav",
      options: { rate: 44100, bits: 32, float: true, channels: 2 },
    },
    { name: "audit-original-pcm8.wav", options: { rate: 8000, bits: 8, channels: 1 } },
    { name: "audit-original-pcm24.wav", options: { rate: 96000, bits: 24, channels: 1 } },
    { name: "audit-original-pcm32.wav", options: { rate: 192000, bits: 32, channels: 1 } },
  ];
  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i],
      bytes = wave(f.options);
    f.buffer = bytes;
    await audit(
      "assets-05-import-" + i,
      ["Import audio encoding/rate/channel support", "Read-only source information"],
      "pointer filechooser / original synthesized waveform",
      async () => {
        await importFile(f.name, bytes);
        const row = explorer.locator(".asset-list li").filter({ hasText: f.name });
        await expect(row).toHaveCount(1);
        await row.locator("summary").focus();
        await row.locator("summary").press("Enter");
        await expect(row.locator("details")).toHaveAttribute("open", "");
        const doc = await project(),
          asset = doc.assets.find((a) => a.name === f.name);
        expect(asset.sha256).toBe(hash(bytes));
        expect(asset.rights.license).toBe("USER_CONFIRMED_LOCAL_USE");
        return {
          name: f.name,
          fixture: {
            ...f.options,
            bytes: bytes.length,
            sha256: hash(bytes),
            generator: "original 330Hz sine; 0.12 peak; 120ms; synthesized by this runner",
          },
          assetId: asset.assetId,
          provenance: await row.locator("small").innerText(),
        };
      },
    );
  }
  if (selected.size && selected.has("assets-08-sample-rule-selection")) {
    await importFile(fixtures[0].name, fixtures[0].buffer);
  }
  await audit(
    "assets-06-reimport-identity",
    ["Same-byte reimport/relink", "Asset identity"],
    "same WAV renamed through filechooser",
    async () => {
      const before = await project(),
        asset = before.assets.find((a) => a.name === fixtures[0].name);
      await importFile("audit-renamed-identical.wav", fixtures[0].buffer);
      await expect(explorer.locator(".asset-list li")).toHaveCount(fixtures.length);
      const after = await project(),
        matches = after.assets.filter((a) => a.sha256 === asset.sha256);
      expect(matches).toHaveLength(1);
      expect(matches[0].assetId).toBe(asset.assetId);
      expect(matches[0].name).toBe(asset.name);
      return { assetId: asset.assetId, sha256: asset.sha256, preservedName: matches[0].name };
    },
  );
  await audit(
    "assets-07-dry-audition",
    ["Dry audition", "Paused/running audition gate"],
    "keyboard activation of dry audition; pointer transport",
    async () => {
      const audition = explorer.getByRole("button", {
        name: "Audition " + fixtures[0].name + " dry",
        exact: true,
      });
      await expect(audition).toBeEnabled();
      await audition.focus();
      await audition.press("Enter");
      await expect(page.locator("body")).toContainText(/Asset audition|素材預聽|Dry audition/);
      const auditionLabels = await explorer
        .locator(".asset-list button")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
      for (const label of auditionLabels) {
        const control = explorer.getByRole("button", { name: label, exact: true });
        await control.focus();
        await control.press("Enter");
      }
      await page.getByRole("button", { name: "Start simulation", exact: true }).click();
      await expect(audition).toBeDisabled();
      await expect(
        details.getByRole("button", { name: "Import audio", exact: true }),
      ).toBeDisabled();
      await page
        .getByLabel("Simulation controls", { exact: true })
        .getByRole("button", { name: "Pause", exact: true })
        .click();
      await expect(audition).toBeEnabled();
      return {
        auditionRequested: true,
        auditionLabels,
        runningDisabled: true,
        pausedEnabled: true,
        hearing: "NOT_RUN",
      };
    },
  );
  await audit(
    "assets-08-sample-rule-selection",
    ["Sound asset generator selection", "Explicit Apply", "Scene sample preview/stop"],
    "pointer dropdown and Apply; keyboard preview",
    async () => {
      const inspector = page.locator(".inspector");
      if (!(await inspector.isVisible()))
        await page.getByRole("button", { name: "Inspector", exact: true }).click();
      const rule = inspector.getByRole("article", {
          name: "Sound behavior rule.grab",
          exact: true,
        }),
        doc = await project(),
        asset = doc.assets.find((a) => a.name === fixtures[0].name);
      await rule
        .getByText("Sound asset", { exact: true })
        .locator("..")
        .locator("select")
        .selectOption(asset.assetId);
      await rule.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(rule.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
      const after = await project(),
        grab = after.soundBehaviors.profiles
          .flatMap((p) => p.rules)
          .find((r) => r.ruleId === "rule.grab");
      expect(grab).toBeTruthy();
      expect(grab.generator.kind).toBe("sample");
      expect(grab.generator.asset.assetId).toBe(asset.assetId);
      await rule.getByRole("button", { name: "Preview scene acoustics", exact: true }).focus();
      await rule
        .getByRole("button", { name: "Preview scene acoustics", exact: true })
        .press("Enter");
      await expect(page.getByRole("button", { name: "Stop preview", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Stop preview", exact: true }).click();
      return {
        assetId: asset.assetId,
        generator: grab.generator,
        preview: "Requested via rule UI, explicit stop available",
        hearing: "NOT_RUN",
      };
    },
  );
  await audit(
    "assets-09-persistence",
    [
      "Save project with imported original WAV",
      "Reload locally saved project",
      "Decoded readiness",
    ],
    "pointer save/reload/load; downloaded JSON pin comparison",
    async () => {
      const before = await project();
      await page.getByRole("button", { name: "Save project", exact: true }).click();
      await page.reload();
      await page
        .getByRole("combobox", { name: "介面語言 / Interface language" })
        .selectOption("en");
      await page.getByRole("button", { name: "Load locally saved project", exact: true }).click();
      for (const fixture of fixtures)
        await expect(
          page.locator(".asset-list").getByText(fixture.name, { exact: true }),
        ).toHaveCount(1);
      const after = await project();
      expect(after.assets.map((a) => ({ id: a.assetId, hash: a.sha256 }))).toEqual(
        before.assets.map((a) => ({ id: a.assetId, hash: a.sha256 })),
      );
      const chooser = page.locator(".scene-explorer .import-details");
      if (!(await chooser.locator("summary").isVisible()))
        await page.getByRole("button", { name: "Scene", exact: true }).click();
      for (const fixture of fixtures)
        await expect(
          page.getByRole("button", { name: "Audition " + fixture.name + " dry", exact: true }),
        ).toBeEnabled();
      return {
        restoredAssetReferences: after.assets.length,
        importedAssetsReady: fixtures.length,
        pinsPreserved: true,
      };
    },
  );
  receipt.finishedAtUtc = new Date().toISOString();
  receipt.status =
    receipt.cases.every((x) => x.status === "PASS") &&
    receipt.pageErrors.length === 0 &&
    receipt.consoleErrors.length === 0
      ? "PASS"
      : "FAIL";
  receipt.summary = {
    passed: receipt.cases.filter((x) => x.status === "PASS").length,
    failed: receipt.cases.filter((x) => x.status === "FAIL").length,
    total: receipt.cases.length,
  };
  await page.screenshot({ path: resolve(out, "assets-final.png"), fullPage: true });
  await context.tracing.stop({
    path: resolve(root, ".cache/behavior-assets-audit-" + runLabel + "-trace.zip"),
  });
  await save();
} finally {
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      summary: receipt.summary,
      failures: receipt.cases
        .filter((x) => x.status === "FAIL")
        .map((x) => ({ id: x.id, error: x.error })),
      receipt: resolve(out, "receipt.json"),
    },
    null,
    2,
  ),
);
process.exitCode = receipt.status === "PASS" ? 0 : 1;
